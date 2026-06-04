const fs = require('fs');
const content = fs.readFileSync('src/app/globals.css', 'utf-8');
const lines = content.split('\n');
lines.forEach((line, i) => {
  if (line.includes('dash-tab-bar') || line.includes('dash-tab-btn')) {
    console.log(`Line ${i + 1}: ${line}`);
  }
});
