const cds = require('@sap/cds');
const express = require('express');
const multer = require('multer');

const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }
});

let azureConnectionString;

if (process.env.VCAP_SERVICES) {
    const services = JSON.parse(process.env.VCAP_SERVICES);
    const azureService = services['user-provided']?.find(s => s.name === 'azure-storage');
    if (azureService) {
        azureConnectionString = azureService.credentials['connection-string'];
        console.log('✓ Azure connection string loaded from VCAP_SERVICES');
    }
} else {
    azureConnectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
}

process.env.AZURE_STORAGE_CONNECTION_STRING = azureConnectionString;

async function getNextRequestID() {
    const db = await cds.connect.to('db');
    const result = await db.run(`SELECT "counter" FROM four_iot_conversion_requestcounter WHERE "id" = 1`);
    
    let newCounter = 1;
    if (result && result.length > 0) {
        newCounter = result[0].counter + 1;
        await db.run(`UPDATE four_iot_conversion_requestcounter SET "counter" = ${newCounter} WHERE "id" = 1`);
    } else {
        await db.run(`INSERT INTO four_iot_conversion_requestcounter ("id", "counter") VALUES (1, 1)`);
    }
    
    return `REQ-${newCounter}`;
}

cds.on('bootstrap', app => {
    
    app.post('/upload', upload.array('exampleFiles', 5), async (req, res) => {
        try {
            const slugHeader = req.headers.slug;
            let customerData = JSON.parse(slugHeader || '{}');
            
            if (!customerData.contactName || !customerData.contactMail || !customerData.numLabels) {
                return res.status(400).json({ error: "Missing required fields" });
            }
            
            const db = await cds.connect.to('db');
            
            const existing = await db.run(`SELECT "ID" FROM four_iot_conversion_requests WHERE "contactMail" = '${customerData.contactMail}'`);
            if (existing && existing.length > 0) {
                return res.status(409).json({ 
                    error: 'Request already exists for this email',
                    existingRequestId: existing[0].ID
                });
            }
            
            const { containerClient } = require('./lib/azure-connector');
            const requestID = await getNextRequestID();
            const folderName = customerData.contactMail.replace(/[^a-zA-Z0-9@.]/g, '_');
            
            const uploadPromises = [];
            
            const requestFileName = `${folderName}/${requestID}_request.txt`;
            const requestContent = JSON.stringify(customerData, null, 2);
            const requestBlobClient = containerClient.getBlockBlobClient(requestFileName);
            uploadPromises.push(requestBlobClient.upload(requestContent, requestContent.length));
            
            req.files.forEach((file) => {
                const blobName = `${folderName}/uploaded_files/${file.originalname}`;
                const blobClient = containerClient.getBlockBlobClient(blobName);
                uploadPromises.push(blobClient.uploadData(file.buffer));
            });
            
            const placeholderBlob = `${folderName}/converted_files/.placeholder`;
            uploadPromises.push(containerClient.getBlockBlobClient(placeholderBlob).upload('', 0));
            
            await Promise.all(uploadPromises);
            
            await db.run(`
                INSERT INTO four_iot_conversion_requests (
                    "ID", "labelSoftware", "otherSoftwareName", "otherSoftwareWebsite",
                    "numLabels", "conversionFonts", "conversionFieldnames", "comparisonPrintScan",
                    "supportADS", "contactName", "contactMail", "contactPhone",
                    "status", "createdAt", "azureRequestFile", "azureFolderName"
                ) VALUES (
                    '${requestID}',
                    '${customerData.labelSoftware}',
                    ${customerData.otherSoftwareName ? `'${customerData.otherSoftwareName}'` : 'NULL'},
                    ${customerData.otherSoftwareWebsite ? `'${customerData.otherSoftwareWebsite}'` : 'NULL'},
                    ${customerData.numLabels},
                    ${customerData.conversionFonts || false},
                    ${customerData.conversionFieldnames || false},
                    ${customerData.comparisonPrintScan || false},
                    ${customerData.supportADS || false},
                    '${customerData.contactName}',
                    '${customerData.contactMail}',
                    ${customerData.contactPhone ? `'${customerData.contactPhone}'` : 'NULL'},
                    50,
                    NOW(),
                    '${requestFileName}',
                    '${folderName}'
                )
            `);
            
            res.status(201).json({
                success: true,
                requestID: requestID,
                folderName: folderName,
                message: 'Files uploaded successfully',
                filesUploaded: req.files.length
            });
            
        } catch (error) {
            console.error('Upload failed:', error);
            res.status(500).json({ 
                error: 'File upload failed',
                details: error.message 
            });
        }
    });

    // Custom endpoint for fetching requests with Azure folder check
    app.get('/api/requests/:email', async (req, res) => {
        try {
            const email = req.params.email;
            const db = await cds.connect.to('db');
            const results = await db.run(`SELECT * FROM four_iot_conversion_requests WHERE "contactMail" = '${email}'`);
            
            if (results && results.length > 0) {
                const request = results[0];
                const { containerClient } = require('./lib/azure-connector');
                
                // Check if Azure folder still exists
                let folderExists = false;
                try {
                    for await (const blob of containerClient.listBlobsFlat({ prefix: request.azureFolderName, maxPageSize: 1 })) {
                        folderExists = true;
                        break;
                    }
                } catch (azureError) {
                    console.error('Error checking Azure folder:', azureError);
                }
                
                // If folder doesn't exist, delete the database record
                if (!folderExists) {
                    console.log(`Azure folder deleted, removing DB record for: ${email}`);
                    await db.run(`DELETE FROM four_iot_conversion_requests WHERE "contactMail" = '${email}'`);
                    return res.json({ value: [] });
                }
            }
            
            res.json({ value: results || [] });
        } catch (error) {
            console.error('Error fetching requests:', error);
            res.status(500).json({ error: error.message });
        }
    });

    app.get('/azure/files', async (req, res) => {
        try {
            const folderName = req.query.folder;
            if (!folderName) return res.status(400).json({ error: 'Folder name required' });
            
            const { containerClient } = require('./lib/azure-connector');
            const uploadedFiles = [];
            const convertedFiles = [];
            
            for await (const blob of containerClient.listBlobsFlat({ prefix: folderName })) {
                const fileName = blob.name.split('/').pop();
                if (fileName === '.placeholder' || fileName.endsWith('_request.txt')) continue;
                
                const fileInfo = {
                    name: fileName,
                    fullPath: blob.name,
                    size: blob.properties.contentLength
                };
                
                if (blob.name.includes('/uploaded_files/')) uploadedFiles.push(fileInfo);
                else if (blob.name.includes('/converted_files/')) convertedFiles.push(fileInfo);
            }
            
            const db = await cds.connect.to('db');
            const requests = await db.run(`SELECT "status" FROM four_iot_conversion_requests WHERE "azureFolderName" = '${folderName}'`);
            
            let updatedStatus = requests && requests.length > 0 ? requests[0].status : null;
            
            if (requests && requests.length > 0) {
                const currentStatus = requests[0].status;
                if (convertedFiles.length > 0 && currentStatus !== 100) {
                    await db.run(`UPDATE four_iot_conversion_requests SET "status" = 100 WHERE "azureFolderName" = '${folderName}'`);
                    updatedStatus = 100;
                } else if (convertedFiles.length === 0 && currentStatus === 100) {
                    await db.run(`UPDATE four_iot_conversion_requests SET "status" = 50 WHERE "azureFolderName" = '${folderName}'`);
                    updatedStatus = 50;
                }
            }
            
            res.json({ uploadedFiles, convertedFiles, updatedStatus });
            
        } catch (error) {
            console.error('Error:', error);
            res.status(500).json({ error: 'Failed to list files' });
        }
    });

    app.get('/azure/download', async (req, res) => {
        try {
            const { folder, file, type } = req.query;
            if (!folder || !file) return res.status(400).json({ error: 'Missing parameters' });
            
            const { containerClient } = require('./lib/azure-connector');
            const subfolder = type === 'converted' ? 'converted_files' : 'uploaded_files';
            
            const decodedFileName = decodeURIComponent(file);
            const blobPath = `${folder}/${subfolder}/${decodedFileName}`;
            const blobClient = containerClient.getBlockBlobClient(blobPath);
            
            const exists = await blobClient.exists();
            if (!exists) return res.status(404).json({ error: 'File not found' });
            
            const properties = await blobClient.getProperties();
            const downloadResponse = await blobClient.download();
            
            const safeFileName = decodedFileName.replace(/[^\x00-\x7F]/g, '_'); // Remove non-ASCII
            res.setHeader('Content-Type', 'application/octet-stream');
            res.setHeader('Content-Disposition', `attachment; filename="${safeFileName}"`);
            res.setHeader('Content-Length', properties.contentLength);
            
            downloadResponse.readableStreamBody.pipe(res);
            
        } catch (error) {
            console.error('Download error:', error);
            if (!res.headersSent) res.status(500).json({ error: 'Download failed', details: error.message });
        }
    });
});

module.exports = cds.server;
