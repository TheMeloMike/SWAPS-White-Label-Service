const fs = require('fs');
const path = require('path');
const util = require('util');

const readdir = util.promisify(fs.readdir);
const stat = util.promisify(fs.stat);
const readFile = util.promisify(fs.readFile);

const methodName = process.argv[2];

if (!methodName) {
  console.error('Please provide a method name to search for');
  process.exit(1);
}

console.log(`Searching for method: ${methodName}`);

async function findInFile(filePath) {
  try {
    const content = await readFile(filePath, 'utf8');
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes(methodName)) {
        console.log(`${filePath}:${i+1}: ${line.trim()}`);
      }
    }
  } catch (err) {
    console.error(`Error reading file ${filePath}:`, err);
  }
}

async function walkDir(dir) {
  try {
    const files = await readdir(dir);
    
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stats = await stat(filePath);
      
      if (stats.isDirectory()) {
        await walkDir(filePath);
      } else if (stats.isFile() && (filePath.endsWith('.ts') || filePath.endsWith('.js'))) {
        await findInFile(filePath);
      }
    }
  } catch (err) {
    console.error(`Error reading directory ${dir}:`, err);
  }
}

walkDir('./src').catch(err => {
  console.error('Error:', err);
}); 