// test-azure-connection.js
// Run this to test your Azure Storage connection before starting the app
// Usage: node test-azure-connection.js

require('dotenv').config();
const { BlobServiceClient } = require('@azure/storage-blob');

async function testConnection() {
    console.log('\n=== Testing Azure Storage Connection ===\n');
    
    // 1. Check environment variables
    console.log('1. Checking environment variables...');
    const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING;
    const containerName = process.env.AZURE_CONTAINER_NAME;
    
    if (!connStr) {
        console.error('   ❌ AZURE_STORAGE_CONNECTION_STRING is not set!');
        console.error('   → Create a .env file in project root with your connection string');
        process.exit(1);
    }
    console.log('   ✓ Connection string found');
    
    if (!containerName) {
        console.error('   ❌ AZURE_CONTAINER_NAME is not set!');
        console.error('   → Add AZURE_CONTAINER_NAME to your .env file');
        process.exit(1);
    }
    console.log('   ✓ Container name:', containerName);
    
    try {
        // 2. Create BlobServiceClient
        console.log('\n2. Connecting to Azure Storage...');
        const blobServiceClient = BlobServiceClient.fromConnectionString(connStr);
        console.log('   ✓ BlobServiceClient created');
        
        // 3. Get container client
        console.log('\n3. Getting container client...');
        const containerClient = blobServiceClient.getContainerClient(containerName);
        console.log('   ✓ Container client created');
        
        // 4. Check if container exists
        console.log('\n4. Checking if container exists...');
        const exists = await containerClient.exists();
        
        if (!exists) {
            console.error('   ❌ Container "' + containerName + '" does NOT exist!');
            console.error('\n   HOW TO FIX:');
            console.error('   1. Go to: https://portal.azure.com');
            console.error('   2. Navigate to: Storage Accounts → 4iotlabelconversion');
            console.error('   3. Click: Containers (in left menu)');
            console.error('   4. Click: + Container');
            console.error('   5. Name: ' + containerName);
            console.error('   6. Public access level: Private');
            console.error('   7. Click: Create\n');
            process.exit(1);
        }
        
        console.log('   ✓ Container "' + containerName + '" exists!');
        
        // 5. Try to list blobs (optional)
        console.log('\n5. Listing existing files in container...');
        let blobCount = 0;
        for await (const blob of containerClient.listBlobsFlat()) {
            console.log('   - ' + blob.name);
            blobCount++;
        }
        if (blobCount === 0) {
            console.log('   (Container is empty - this is fine for a new setup)');
        } else {
            console.log('   Found ' + blobCount + ' existing file(s)');
        }
        
        // 6. Test write permission by creating a test blob
        console.log('\n6. Testing write permissions...');
        const testBlobName = 'test-connection-' + Date.now() + '.txt';
        const testContent = 'This is a test file created by test-azure-connection.js';
        const blockBlobClient = containerClient.getBlockBlobClient(testBlobName);
        
        await blockBlobClient.upload(testContent, testContent.length);
        console.log('   ✓ Successfully wrote test file: ' + testBlobName);
        
        // Delete test file
        await blockBlobClient.delete();
        console.log('   ✓ Cleaned up test file');
        
        // Success!
        console.log('\n=== ✓ ALL TESTS PASSED ===');
        console.log('\nYour Azure Storage is properly configured!');
        console.log('You can now run: npm start\n');
        
    } catch (error) {
        console.error('\n❌ ERROR:', error.message);
        console.error('\nFull error details:');
        console.error(error);
        process.exit(1);
    }
}

testConnection();
