const { execSync } = require('child_process');
const fs = require('fs');

function run(command) {
    console.log(`Running: ${command}`);
    try {
        const output = execSync(command, { encoding: 'utf-8', stdio: 'pipe' });
        console.log(output);
        return output;
    } catch (error) {
        console.error(`Error running command: ${command}`);
        console.error(error.message);
        if (error.stdout) console.log(error.stdout);
        if (error.stderr) console.error(error.stderr);
        throw error;
    }
}

async function main() {
    try {
        console.log('Checking firebase login status...');
        run('npx --yes firebase-tools projects:list');

        console.log('Creating project dechy-inventario...');
        try {
            run('npx --yes firebase-tools projects:create dechy-inventario --display-name "Dechy Inventario" -n');
        } catch (e) {
            console.log('Project might already exist or creation failed. Proceeding...');
        }

        console.log('Registering web app admin...');
        let adminConfig;
        try {
            adminConfig = run('npx --yes firebase-tools apps:create web admin --project dechy-inventario');
        } catch (e) {
             console.log('App might already exist.');
        }

        console.log('Fetching SDK config for admin...');
        const sdkConfigAdmin = run('npx --yes firebase-tools apps:sdkconfig web admin --project dechy-inventario');
        console.log('SDK Config Admin:', sdkConfigAdmin);

        console.log('Registering web app catalogo...');
        let catalogoConfig;
        try {
            catalogoConfig = run('npx --yes firebase-tools apps:create web catalogo --project dechy-inventario');
        } catch (e) {
             console.log('App might already exist.');
        }

        console.log('Fetching SDK config for catalogo...');
        const sdkConfigCatalogo = run('npx --yes firebase-tools apps:sdkconfig web catalogo --project dechy-inventario');
        console.log('SDK Config Catalogo:', sdkConfigCatalogo);

        console.log('Done with setup.');
    } catch (err) {
        console.error('Setup failed.', err);
    }
}

main();
