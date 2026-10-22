import { copyFile } from 'node:fs/promises';
await copyFile('THIRD_PARTY_LICENSES.txt', 'public/THIRD_PARTY_LICENSES.txt');
