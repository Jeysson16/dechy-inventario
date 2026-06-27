const fs = require('fs');
const path = require('path');

function replaceInDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            if (file !== 'node_modules' && file !== '.git' && file !== '.firebase' && file !== 'dist') {
                replaceInDir(fullPath);
            }
        } else {
            if (fullPath.endsWith('.jsx') || fullPath.endsWith('.js') || fullPath.endsWith('.html') || fullPath.endsWith('.css') || fullPath.endsWith('.astro') || fullPath.endsWith('.tsx') || fullPath.endsWith('.md')) {
                let content = fs.readFileSync(fullPath, 'utf8');
                let newContent = content.replace(/Jieda/g, 'Dechy');
                newContent = newContent.replace(/jieda/g, 'dechy');
                newContent = newContent.replace(/JIEDA/g, 'DECHY');
                if (content !== newContent) {
                    fs.writeFileSync(fullPath, newContent, 'utf8');
                    console.log(`Updated ${fullPath}`);
                }
            }
        }
    }
}

replaceInDir(__dirname);
