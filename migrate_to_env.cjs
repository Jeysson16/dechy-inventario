const fs = require('fs');
const path = require('path');

const filesToUpdate = [
    'catalogo-astro/src/config/firebase.ts',
    'src/config/firebase.js',
    'src/pages/EmployeeManager.jsx',
    'src/pages/Sales.jsx'
];

const envConfig = `  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID`;

filesToUpdate.forEach(file => {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, 'utf-8');
        // Replace old config
        content = content.replace(/apiKey:\s*"AIzaSyAatVXzAYES-bKrWQDGcZqoYL_MnYy2quk",\s*authDomain:\s*"dechy-inventario\.firebaseapp\.com",\s*projectId:\s*"dechy-inventario",\s*storageBucket:\s*"dechy-inventario\.firebasestorage\.app",\s*messagingSenderId:\s*"314212389763",\s*appId:\s*"1:314212389763:web:31b95d4a925724646d5cb6",?/g, envConfig);
        
        fs.writeFileSync(filePath, content, 'utf-8');
        console.log(`Updated to env variables in ${file}`);
    }
});
