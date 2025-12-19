// srv/server.js
const cds = require('@sap/cds');
const express = require('express');
const multer = require('multer');

// Configure multer
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }
});

// Helper function to get next request ID (simple counter: REQ-1, REQ-2, REQ-3, etc.)
async function getNextRequestID() {
    const db = await cds.connect.to('db');
    const { RequestCounter } = db.entities('four_iot.conversion');
    
    // Get current counter
    let counterRecord = await SELECT.one.from(RequestCounter).where({ id: 1 });
    
    if (!counterRecord) {
        // Initialize counter if doesn't exist
        await INSERT.into(RequestCounter).entries({ id: 1, counter: 0 });
        counterRecord = { counter: 0 };
    }
    
    // Increment counter
    const newCounter = counterRecord.counter + 1;
    await UPDATE(RequestCounter).set({ counter: newCounter }).where({ id: 1 });
    
    // Return simple Request ID
    return `REQ-${newCounter}`;
}

// Helper function to sanitize filename for Content-Disposition header
function sanitizeFilename(filename) {
    const encoded = encodeURIComponent(filename);
    return encoded;
}

cds.on('bootstrap', app => {
    
    // Upload endpoint
    app.post('/upload', upload.array('exampleFiles', 5), async (req, res) => {
        console.log('\n========== UPLOAD REQUEST ==========');
        console.log('Files received:', req.files ? req.files.length : 0);
        
        try {
            const slugHeader = req.headers.slug;
            let customerData = {};

            if (slugHeader) {
                try {
                    customerData = JSON.parse(slugHeader);
                } catch (e) {
                    console.error("Error parsing slug header:", e.message);
                    return res.status(400).json({ error: "Invalid JSON data in slug header." });
                }
            }
            
            if (!customerData.contactName || !customerData.contactMail || !customerData.numLabels) {
                return res.status(400).json({ error: "Missing required fields" });
            }
            
            // Check if email already exists
            const db = await cds.connect.to('db');
            const { Requests } = db.entities('four_iot.conversion');
            
            const existingRequests = await SELECT.from(Requests).where({ contactMail: customerData.contactMail });
            
            if (existingRequests.length > 0) {
                console.log(`Request already exists for email: ${customerData.contactMail}`);
                return res.status(409).json({ 
                    error: 'Request already exists for this email',
                    existingRequestId: existingRequests[0].ID
                });
            }
            
            const { containerClient } = require('./lib/azure-connector');
            
            // Generate simple incremental Request ID
            const requestID = await getNextRequestID();
            
            // FIXED: Create folder name using EMAIL ONLY (unique identifier)
            // This ensures each email has its own unique folder
            const sanitizedEmail = customerData.contactMail.replace(/[^a-zA-Z0-9@.]/g, '_');
            const folderName = sanitizedEmail;
            
            console.log('Request ID:', requestID);
            console.log('Folder Name:', folderName);
            
            customerData.ID = requestID;
            customerData.createdAt = new Date().toISOString();
            customerData.status = 0;
            customerData.azureFolderName = folderName;

            const uploadPromises = [];
            
            // A. Generate Request Text File
            const requestFileName = `${folderName}/${requestID}_request.txt`;
            const requestContent = JSON.stringify(customerData, null, 2);
            
            const requestBlockBlobClient = containerClient.getBlockBlobClient(requestFileName);
            uploadPromises.push(
                requestBlockBlobClient.upload(requestContent, requestContent.length, {
                    blobHTTPHeaders: { blobContentType: 'text/plain' }
                })
            );
            
            // B. Upload Sample Files to "uploaded_files" subfolder
            // Keep original filenames (no timestamp prefix)
            req.files.forEach((file) => {
                const originalName = file.originalname;
                const blobName = `${folderName}/uploaded_files/${originalName}`;
                
                console.log(`Uploading: ${originalName}`);
                
                const blockBlobClient = containerClient.getBlockBlobClient(blobName);
                uploadPromises.push(
                    blockBlobClient.uploadData(file.buffer, {
                        blobHTTPHeaders: { blobContentType: file.mimetype || 'application/octet-stream' }
                    })
                );
            });
            
            // C. Create converted_files folder with placeholder
            const placeholderBlob = `${folderName}/converted_files/.placeholder`;
            const placeholderClient = containerClient.getBlockBlobClient(placeholderBlob);
            uploadPromises.push(
                placeholderClient.upload('', 0, {
                    blobHTTPHeaders: { blobContentType: 'text/plain' }
                })
            );
            
            await Promise.all(uploadPromises);
            
            console.log(`✓ All files uploaded successfully`);
            
            await INSERT.into(Requests).entries({
                ID: requestID,
                labelSoftware: customerData.labelSoftware,
                otherSoftwareName: customerData.otherSoftwareName || null,
                otherSoftwareWebsite: customerData.otherSoftwareWebsite || null,
                numLabels: customerData.numLabels,
                conversionFonts: customerData.conversionFonts || false,
                conversionFieldnames: customerData.conversionFieldnames || false,
                comparisonPrintScan: customerData.comparisonPrintScan || false,
                supportADS: customerData.supportADS || false,
                contactName: customerData.contactName,
                contactMail: customerData.contactMail,
                contactPhone: customerData.contactPhone || null,
                status: 50,
                createdAt: new Date().toISOString(),
                azureRequestFile: requestFileName,
                azureFolderName: folderName
            });
            
            console.log(`✓ Database record created`);
            console.log('====================================\n');
            
            res.status(201).json({
                success: true,
                requestID: requestID,
                folderName: folderName,
                message: 'Files uploaded successfully',
                filesUploaded: req.files.length
            });
            
        } catch (error) {
            console.error('Upload failed:', error.message);
            console.error('Stack:', error.stack);
            res.status(500).json({ 
                error: 'File upload failed',
                details: error.message 
            });
        }
    });

    // List files endpoint - Bidirectional status update
    app.get('/azure/files', async (req, res) => {
        try {
            const folderName = req.query.folder;
            
            if (!folderName) {
                return res.status(400).json({ error: 'Folder name is required' });
            }
            
            const { containerClient } = require('./lib/azure-connector');
            
            console.log(`Listing files in folder: ${folderName}`);
            
            const uploadedFiles = [];
            const convertedFiles = [];
            
            for await (const blob of containerClient.listBlobsFlat({ prefix: folderName })) {
                const fileName = blob.name.split('/').pop();
                
                if (fileName === '.placeholder' || fileName.endsWith('_request.txt')) {
                    continue;
                }
                
                const fileInfo = {
                    name: fileName,
                    fullPath: blob.name,
                    size: blob.properties.contentLength,
                    lastModified: blob.properties.lastModified,
                    contentType: blob.properties.contentType
                };
                
                if (blob.name.includes('/uploaded_files/')) {
                    uploadedFiles.push(fileInfo);
                } else if (blob.name.includes('/converted_files/')) {
                    convertedFiles.push(fileInfo);
                }
            }
            
            console.log(`Found ${uploadedFiles.length} uploaded, ${convertedFiles.length} converted files`);
            
            // Bidirectional status update
            const db = await cds.connect.to('db');
            const { Requests } = db.entities('four_iot.conversion');
            
            const requests = await SELECT.from(Requests).where({ azureFolderName: folderName });
            let updatedStatus = null;
            
            if (requests.length > 0) {
                const currentStatus = requests[0].status;
                
                if (convertedFiles.length > 0 && currentStatus !== 100) {
                    // Converted files exist → Update to 100%
                    await UPDATE(Requests).set({ status: 100 }).where({ azureFolderName: folderName });
                    console.log(`✓ Updated status: ${currentStatus}% → 100% (converted files found)`);
                    updatedStatus = 100;
                } else if (convertedFiles.length === 0 && currentStatus === 100) {
                    // No converted files but status is 100% → Move back to 50%
                    await UPDATE(Requests).set({ status: 50 }).where({ azureFolderName: folderName });
                    console.log(`✓ Updated status: 100% → 50% (converted files deleted)`);
                    updatedStatus = 50;
                } else {
                    // No change needed
                    updatedStatus = currentStatus;
                }
            }
            
            res.json({
                uploadedFiles: uploadedFiles,
                convertedFiles: convertedFiles,
                updatedStatus: updatedStatus
            });
            
        } catch (error) {
            console.error('Error listing files:', error);
            res.status(500).json({ error: 'Failed to list files' });
        }
    });

    // Download file endpoint
    app.get('/azure/download', async (req, res) => {
        try {
            const folderName = req.query.folder;
            const fileName = req.query.file;
            const fileType = req.query.type;
            
            if (!folderName || !fileName) {
                return res.status(400).json({ error: 'Folder and file name are required' });
            }
            
            const { containerClient } = require('./lib/azure-connector');
            
            const subfolder = fileType === 'converted' ? 'converted_files' : 'uploaded_files';
            const blobPath = `${folderName}/${subfolder}/${fileName}`;
            
            console.log(`Downloading: ${blobPath}`);
            
            const blobClient = containerClient.getBlockBlobClient(blobPath);
            
            const exists = await blobClient.exists();
            if (!exists) {
                console.error(`File not found: ${blobPath}`);
                return res.status(404).json({ error: 'File not found' });
            }
            
            const properties = await blobClient.getProperties();
            const downloadResponse = await blobClient.download();
            
            const contentType = properties.contentType || 'application/octet-stream';
            const safeFileName = sanitizeFilename(fileName);
            const plainFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
            
            res.setHeader('Content-Type', contentType);
            res.setHeader('Content-Length', properties.contentLength);
            
            try {
                res.setHeader('Content-Disposition', 
                    `attachment; filename="${plainFileName}"; filename*=UTF-8''${safeFileName}`
                );
            } catch (headerError) {
                res.setHeader('Content-Disposition', `attachment; filename="${plainFileName}"`);
            }
            
            downloadResponse.readableStreamBody.pipe(res);
            
            downloadResponse.readableStreamBody.on('error', (streamError) => {
                console.error('Stream error:', streamError);
                if (!res.headersSent) {
                    res.status(500).json({ error: 'Stream error' });
                }
            });
            
        } catch (error) {
            console.error('Error downloading file:', error);
            
            if (!res.headersSent) {
                res.status(500).json({ 
                    error: 'Failed to download file',
                    details: error.message 
                });
            }
        }
    });

    app.use(express.json());
});

module.exports = cds.server;
