const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const readdir = promisify(fs.readdir);
const unlink = promisify(fs.unlink);
const writeFile = promisify(fs.writeFile);
const stat = promisify(fs.stat);
const http = require('http');

// Path to data directory
const dataDir = path.join(__dirname, 'data');

async function clearTradeData() {
  try {
    console.log('Starting complete trade data cleanup...');
    
    // 1. First call the API endpoint to clear the system state
    console.log('Calling API to clear system state...');
    try {
      await new Promise((resolve, reject) => {
        const req = http.request({
          hostname: 'localhost',
          port: 3001,
          path: '/api/trades/system/clear',
          method: 'POST'
        }, (res) => {
          let data = '';
          res.on('data', chunk => { data += chunk; });
          res.on('end', () => {
            console.log('API response:', data);
            resolve();
          });
        });
        
        req.on('error', (err) => {
          console.error('API request error:', err);
          reject(err);
        });
        
        req.end();
      });
      console.log('System state cleared via API');
    } catch (apiErr) {
      console.error('Failed to clear via API, continuing with file deletion:', apiErr);
    }
    
    // 2. Read all files in the data directory
    const files = await readdir(dataDir);
    
    // 3. Delete ALL files except the directory structure itself
    let deletedCount = 0;
    let skippedCount = 0;
    
    // Process backup directory separately if it exists
    let hasBackupDir = false;
    try {
      const backupDirPath = path.join(dataDir, 'backup');
      const backupStats = await stat(backupDirPath);
      hasBackupDir = backupStats.isDirectory();
    } catch (err) {
      // Backup directory doesn't exist, that's fine
    }
    
    // Process each file
    for (const file of files) {
      const filePath = path.join(dataDir, file);
      
      try {
        const stats = await stat(filePath);
        
        // Skip directories (except process contents if needed)
        if (stats.isDirectory()) {
          if (file === 'backup' && hasBackupDir) {
            console.log('Skipping backup directory');
          } else {
            console.log(`Skipping directory: ${file}`);
          }
          skippedCount++;
          continue;
        }
        
        // Delete the file
        await unlink(filePath);
        deletedCount++;
        
        // Log progress periodically
        if (deletedCount % 100 === 0) {
          console.log(`Deleted ${deletedCount} files so far...`);
        }
      } catch (err) {
        console.error(`Error processing ${file}:`, err.message);
        skippedCount++;
      }
    }
    
    // 4. Create empty files for essential persistence
    const emptyFiles = [
      'wallets.json',
      'nftOwnership.json',
      'rejection_preferences.json',
      'nft_demand_metrics.json',
      'completedSteps.json',
      'nft_value_records.json'
    ];
    
    for (const file of emptyFiles) {
      try {
        await writeFile(path.join(dataDir, file), '{}', 'utf8');
        console.log(`Created empty file: ${file}`);
      } catch (writeErr) {
        console.error(`Error creating empty file ${file}:`, writeErr.message);
      }
    }
    
    console.log(`Successfully deleted ${deletedCount} files, skipped ${skippedCount} items`);
    console.log('Trade data has been cleared. Please restart the server to ensure a fresh state.');
  } catch (err) {
    console.error('Error clearing trade data:', err);
  }
}

// Run the function
clearTradeData(); 