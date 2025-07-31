const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Path to data directory
const dataDir = path.join(__dirname, 'data');

// Make sure the data directory exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

console.log('===== COMPLETE DATA RESET =====');
console.log(`Removing all files from: ${dataDir}`);

try {
  // Use a more aggressive approach for complete deletion
  // First, create a temporary backup in case something goes wrong
  const backupDir = path.join(__dirname, `data_backup_${Date.now()}`);
  fs.mkdirSync(backupDir, { recursive: true });
  
  console.log(`Created backup directory: ${backupDir}`);
  
  // Copy all files to backup
  const files = fs.readdirSync(dataDir);
  
  files.forEach(file => {
    const srcPath = path.join(dataDir, file);
    const destPath = path.join(backupDir, file);
    
    // Skip directories
    if (fs.statSync(srcPath).isDirectory()) {
      console.log(`Skipping directory: ${file}`);
      return;
    }
    
    try {
      fs.copyFileSync(srcPath, destPath);
      console.log(`Backed up: ${file}`);
    } catch (copyError) {
      console.error(`Failed to backup ${file}:`, copyError.message);
    }
  });
  
  console.log('Backup complete. Deleting all files...');
  
  // Empty the data directory forcefully, but one by one instead of recursive deletion
  files.forEach(file => {
    const filePath = path.join(dataDir, file);
    
    // Skip directories
    if (fs.statSync(filePath).isDirectory()) {
      return;
    }
    
    try {
      fs.unlinkSync(filePath);
      console.log(`Deleted: ${file}`);
    } catch (unlinkError) {
      console.error(`Failed to delete ${file}:`, unlinkError.message);
    }
  });
  
  console.log('All files deleted successfully');
  
  // Create empty files for essential persistence
  const emptyFiles = [
    'wallets.json',
    'nftOwnership.json',
    'wantedNfts.json',
    'rejection_preferences.json',
    'nft_demand_metrics.json',
    'completedSteps.json',
    'nft_value_records.json'
  ];
  
  emptyFiles.forEach(file => {
    try {
      fs.writeFileSync(path.join(dataDir, file), '{}', 'utf8');
      console.log(`Created empty file: ${file}`);
    } catch (writeError) {
      console.error(`Error creating empty file ${file}:`, writeError.message);
    }
  });
  
  console.log('\n===== DATA RESET COMPLETE =====');
  console.log('You must restart the server for changes to take effect.');
  
} catch (error) {
  console.error('Error during data reset:', error);
  process.exit(1);
} 