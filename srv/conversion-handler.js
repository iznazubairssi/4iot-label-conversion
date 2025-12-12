const cds = require('@sap/cds');
const { containerClient } = require('./lib/azure-connector');

module.exports = async function (srv) {

    srv.before('CREATE', 'Requests', async (req) => {
        const now = new Date();
        const timestamp = now.toISOString().replace(/[:.]/g, '-').substring(0, 19);
        const requestID = `REQ-${timestamp}-${Math.floor(Math.random() * 1000)}`;
        
        req.data.ID = requestID;
        req.data.createdAt = now.toISOString();
        req.data.status = 0; 
        
        const customerData = req.data;
        const uploadedFiles = req.filesData || []; 

        console.log(`Processing request ${requestID} with ${uploadedFiles.length} files`);

        const uploadPromises = [];
        
        try {
            const requestFileName = `${requestID}_request.txt`;
            const requestContent = JSON.stringify(customerData, null, 2);
            
            const requestBlockBlobClient = containerClient.getBlockBlobClient(requestFileName);
            uploadPromises.push(
                requestBlockBlobClient.upload(requestContent, requestContent.length, {
                    blobHTTPHeaders: { blobContentType: 'text/plain' }
                })
            );
            
            uploadedFiles.forEach((file, index) => {
                const blobName = `${requestID}_sample${index + 1}_${file.originalname}`;
                const blockBlobClient = containerClient.getBlockBlobClient(blobName);
                
                uploadPromises.push(
                    blockBlobClient.uploadData(file.buffer, {
                        blobHTTPHeaders: { blobContentType: file.mimetype || 'application/octet-stream' }
                    })
                ); 
            });
            
            await Promise.all(uploadPromises);
            
            req.data.status = 50; 
            req.data.azureRequestFile = requestFileName;
            
            console.log(`✓ Request ID ${requestID} and ${uploadedFiles.length} files uploaded to Azure. Status set to 50%.`);
            
        } catch (error) {
            console.error('❌ Azure Upload Failed:', error.message);
            console.error('Error details:', error);
            
            req.error(500, 'File upload to Azure storage failed. Please check Azure connection and credentials.', 'AzureUploadError');
        }
    });

    srv.after('READ', 'Requests', (data) => {
        if (Array.isArray(data)) {
            data.forEach(request => {
                console.log(`Request ${request.ID} status: ${request.status}%`);
            });
        }
    });
}
