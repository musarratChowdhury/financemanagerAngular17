const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, '..', 'src', 'environments', 'environment.ts');
const apiUrl = process.env.API_URL || 'https://fmapi.muhit.dev';
const syncfusionLicenseKey = process.env.SYNCFUSION_LICENSE_KEY || '';

const envConfigFile = `export const environment = {
  production: true,
  apiUrl: '${apiUrl}',
  syncfusionLicenseKey: '${syncfusionLicenseKey}',
};
`;

fs.writeFileSync(targetPath, envConfigFile, { encoding: 'utf8' });
console.log(`✓ environment.ts updated with API_URL: ${apiUrl}`);
