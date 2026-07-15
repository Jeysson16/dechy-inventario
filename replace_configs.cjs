const fs = require('fs');
const path = require('path');

const filesToUpdate = [
    '.firebaserc',
    'catalogo-astro/src/config/firebase.ts',
    'src/config/firebase.js',
    'src/pages/EmployeeManager.jsx',
    'src/pages/Sales.jsx',
    'fix-pending-sales.mjs',
    'scratch_query.js',
    'public/firebase-messaging-sw.js'
];

const newConfig = `  apiKey: "AIzaSyAatVXzAYES-bKrWQDGcZqoYL_MnYy2quk",
  authDomain: "dechy-inventario.firebaseapp.com",
  projectId: "dechy-inventario",
  storageBucket: "dechy-inventario.firebasestorage.app",
  messagingSenderId: "314212389763",
  appId: "1:314212389763:web:31b95d4a925724646d5cb6"`;

filesToUpdate.forEach(file => {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, 'utf-8');
        // Replace firebaserc contents
        if (file === '.firebaserc') {
            content = content.replace(/inventory-app-jey-123/g, 'dechy-inventario');
        } else {
            // Replace old config
            content = content.replace(/apiKey:\s*"AIzaSyDzPYYgwvGcYng9ddI4A8nXEpLasoMxXf4",\s*authDomain:\s*"inventory-app-jey-123.firebaseapp.com",\s*projectId:\s*"inventory-app-jey-123",\s*storageBucket:\s*"inventory-app-jey-123.firebasestorage.app",\s*messagingSenderId:\s*"225468681713",\s*appId:\s*"1:225468681713:web:af0b4bb8c73a3237520850",?/g, newConfig);
        }
        fs.writeFileSync(filePath, content, 'utf-8');
        console.log(`Updated ${file}`);
    } else {
        console.log(`File not found: ${file}`);
    }
});
