import { copyFile } from 'node:fs/promises';

for (const name of ['LICENSE.md', 'THIRD_PARTY_NOTICES.md']) {
  await copyFile(name, `dist/${name}`);
}
await copyFile(
  'node_modules/@imgly/background-removal/ThirdPartyLicenses.json',
  'dist/IMG-LY-ThirdPartyLicenses.json',
);
