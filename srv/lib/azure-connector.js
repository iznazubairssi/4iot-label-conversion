const { BlobServiceClient } = require('@azure/storage-blob');

function getBlobServiceClient() {
    const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING;
    if (connStr) {
        console.log("✓ Using Azure Connection String for authentication");
        return BlobServiceClient.fromConnectionString(connStr);
    }
    
    console.error('❌ Azure credentials missing!');
    throw new Error("Azure credentials missing. Cannot authenticate.");
}

function getContainerName() {
    return process.env.AZURE_CONTAINER_NAME || 'labelconversion';
}

const blobServiceClient = getBlobServiceClient();
const containerName = getContainerName();

const containerClient = blobServiceClient.getContainerClient(containerName);

(async () => {
    try {
        const exists = await containerClient.exists();
        if (exists) {
            console.log('✓ Azure container "' + containerName + '" is accessible');
        } else {
            console.error('❌ Azure container "' + containerName + '" does NOT exist!');
        }
    } catch (error) {
        console.error('❌ Error connecting to Azure Storage:', error.message);
    }
})();

module.exports = {
    containerClient,
    getContainerClient: () => containerClient
};
