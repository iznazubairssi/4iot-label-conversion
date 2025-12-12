const cds = require('@sap/cds');
const { BlobServiceClient } = require('@azure/storage-blob');
const { DefaultAzureCredential } = require('@azure/identity');

function getBlobServiceClient() {
    if (process.env.VCAP_SERVICES) {
        const vcapServices = JSON.parse(process.env.VCAP_SERVICES);
        const upService = vcapServices['user-provided']?.find(s => s.name === 'azure-storage-connector');
        
        if (upService?.credentials.AZURE_CLIENT_ID) {
            process.env.AZURE_TENANT_ID = upService.credentials.AZURE_TENANT_ID;
            process.env.AZURE_CLIENT_ID = upService.credentials.AZURE_CLIENT_ID;
            process.env.AZURE_CLIENT_SECRET = upService.credentials.AZURE_CLIENT_SECRET;
            const accountName = upService.credentials.AZURE_STORAGE_ACCOUNT_NAME;
            
            console.log('✓ Using Azure Service Principal authentication (BTP mode)');
            return BlobServiceClient.fromUrl(`https://${accountName}.blob.core.windows.net`, new DefaultAzureCredential());
        }
    }
    const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING;
    if (connStr) {
        console.log("✓ Using Azure Connection String for authentication (local dev)");
        return BlobServiceClient.fromConnectionString(connStr);
    }
    
    console.error('❌ Azure credentials missing!');
    throw new Error("Azure credentials missing. Cannot authenticate.");
}

function getContainerName() {
    if (process.env.VCAP_SERVICES) {
        const vcapServices = JSON.parse(process.env.VCAP_SERVICES);
        const upService = vcapServices['user-provided']?.find(s => s.name === 'azure-storage-connector');
        return upService?.credentials.AZURE_CONTAINER_NAME || process.env.AZURE_CONTAINER_NAME;
    }
    return process.env.AZURE_CONTAINER_NAME;
}

const blobServiceClient = getBlobServiceClient();
const containerName = getContainerName();

console.log('Azure Storage Configuration:');
console.log('  Container Name:', containerName);

if (!containerName) {
    console.error('❌ AZURE_CONTAINER_NAME is not set in environment variables!');
    throw new Error('AZURE_CONTAINER_NAME environment variable is required');
}

const containerClient = blobServiceClient.getContainerClient(containerName);

(async () => {
    try {
        const exists = await containerClient.exists();
        if (exists) {
            console.log('✓ Azure container "' + containerName + '" is accessible');
        } else {
            console.error('❌ Azure container "' + containerName + '" does NOT exist!');
            console.error('   Please create the container in Azure Portal first.');
        }
    } catch (error) {
        console.error('❌ Error connecting to Azure Storage:', error.message);
    }
})();

module.exports = {
    containerClient,
    getContainerClient: () => containerClient
};
