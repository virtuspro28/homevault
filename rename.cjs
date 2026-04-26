const fs = require('fs');
const path = require('path');

const excludeDirs = ['.git', 'node_modules', 'dist'];
const excludeExts = ['.png', '.jpg', '.jpeg', '.svg', '.db', '.bak', '.ico'];

function replaceInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let newContent = content
    .replace(/HomeVault/g, 'HomeVault')
    .replace(/homevault/g, 'homevault')
    .replace(/Homevault/g, 'Homevault');
    
  if (content !== newContent) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log(`Updated: ${filePath}`);
  }
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (!excludeDirs.includes(file)) {
        walkDir(fullPath);
      }
    } else {
      if (!excludeExts.includes(path.extname(file))) {
        try {
          replaceInFile(fullPath);
        } catch (e) {
          // ignore binary read errors
        }
      }
    }
  }
}

walkDir(__dirname);
