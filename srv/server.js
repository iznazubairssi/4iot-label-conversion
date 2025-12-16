// srv/server.js
const cds = require('@sap/cds');
const express = require('express');
const multer = require('multer');

// Configure multer to store files in memory (as a buffer)
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

cds.on('bootstrap', app => {
    
    // Simple upload endpoint that bypasses OData
    app.post('/upload', upload.array('exampleFiles', 5), async (req, res) => {
        console.log('Upload endpoint called');
        console.log('Files received:', req.files ? req.files.length : 0);
        
        try {
            // 1. Extract JSON data from the 'slug' header
            const slugHeader = req.headers.slug;
            let customerData = {};

            if (slugHeader) {
                try {
                    customerData = JSON.parse(slugHeader);
                    console.log('Parsed customer data:', customerData);
                } catch (e) {
                    console.error("Error parsing slug header:", e.message);
                    return res.status(400).json({ error: "Invalid JSON data in slug header." });
                }
            }
            
            // 2. Validate required fields
            if (!customerData.contactName || !customerData.contactMail || !customerData.numLabels) {
                return res.status(400).json({ error: "Missing required fields: contactName, contactMail, or numLabels" });
            }
            
            // 3. Import the handler logic
            const { containerClient } = require('./lib/azure-connector');
            
            // 4. Generate unique Request ID
            const now = new Date();
            const timestamp = now.toISOString().replace(/[:.]/g, '-').substring(0, 19);
            const requestID = `REQ-${timestamp}-${Math.floor(Math.random() * 1000)}`;
            
            customerData.ID = requestID;
            customerData.createdAt = now.toISOString();
            customerData.status = 0;
            
            console.log(`Processing request ${requestID} with ${req.files.length} files`);

            // 5. Azure Upload Logic
            const uploadPromises = [];
            
            // A. Generate Request Text File
            const requestFileName = `${requestID}_request.txt`;
            const requestContent = JSON.stringify(customerData, null, 2);
            
            const requestBlockBlobClient = containerClient.getBlockBlobClient(requestFileName);
            uploadPromises.push(
                requestBlockBlobClient.upload(requestContent, requestContent.length, {
                    blobHTTPHeaders: { blobContentType: 'text/plain' }
                })
            );
            
            // B. Upload Sample Files
            req.files.forEach((file, index) => {
                const blobName = `${requestID}_sample${index + 1}_${file.originalname}`;
                const blockBlobClient = containerClient.getBlockBlobClient(blobName);
                
                uploadPromises.push(
                    blockBlobClient.uploadData(file.buffer, {
                        blobHTTPHeaders: { blobContentType: file.mimetype || 'application/octet-stream' }
                    })
                );
            });
            
            // Wait for all uploads
            await Promise.all(uploadPromises);
            
            console.log(`✓ Request ID ${requestID} and ${req.files.length} files uploaded to Azure. Status set to 50%.`);
            
            // 6. Save to database using CDS
            const db = await cds.connect.to('db');
            const { Requests } = db.entities('four_iot.conversion');
            
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
                createdAt: now.toISOString(),
                azureRequestFile: requestFileName
            });
            
            console.log(`✓ Database record created for ${requestID}`);
            
            // 7. Send success response
            res.status(201).json({
                success: true,
                requestID: requestID,
                message: 'Files uploaded successfully',
                filesUploaded: req.files.length
            });
            
        } catch (error) {
            console.error('Upload failed:', error.message);
            console.error('Error details:', error);
            res.status(500).json({ 
                error: 'File upload failed',
                details: error.message 
            });
        }
    });

    // Enable JSON parsing for other routes
    app.use(express.json());
});

module.exports = cds.server;
