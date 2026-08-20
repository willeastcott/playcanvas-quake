import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import AdmZip from 'adm-zip';

const ARCHIVE_URL = 'https://ftp.gwdg.de/pub/misc/ftp.idsoftware.com/idstuff/quake/quake106.zip';
const ARCHIVE_SIZE = 9_094_045;
const ARCHIVE_SHA256 = 'ec6c9d34b1ae0252ac0066045b6611a7919c2a0d78a3a66d9387a8f597553239';
const PAK_SIZE = 18_689_235;
const PAK_SHA256 = '35a9c55e5e5a284a159ad2a62e0e8def23d829561fe2f54eb402dbc0a9a946af';

const dataRoot = path.resolve('.quake-data');
const archivePath = path.join(dataRoot, 'quake106.zip');
const installerRoot = path.join(dataRoot, 'installer');
const targetRoot = path.join(dataRoot, 'id1');
const targetPak = path.join(targetRoot, 'pak0.pak');

const digest = filePath => crypto
.createHash('sha256')
.update(fs.readFileSync(filePath))
.digest('hex');

const verify = (filePath, size, sha256, label) => {
    const stat = fs.statSync(filePath);
    const actualHash = digest(filePath);
    if (stat.size !== size || actualHash !== sha256) {
        throw new Error(`${label} verification failed (size ${stat.size}, SHA-256 ${actualHash})`);
    }
};

fs.mkdirSync(dataRoot, { recursive: true });

if (!fs.existsSync(archivePath)) {
    console.log(`Downloading the official Quake 1.06 shareware archive from ${ARCHIVE_URL}`);
    const response = await fetch(ARCHIVE_URL);
    if (!response.ok) {
        throw new Error(`Download failed: ${response.status} ${response.statusText}`);
    }
    fs.writeFileSync(archivePath, Buffer.from(await response.arrayBuffer()));
}

verify(archivePath, ARCHIVE_SIZE, ARCHIVE_SHA256, 'quake106.zip');
fs.mkdirSync(installerRoot, { recursive: true });

const zip = new AdmZip(archivePath);
for (const entryName of ['resource.1', 'resource.dat']) {
    const entry = zip.getEntry(entryName);
    if (!entry) {
        throw new Error(`${entryName} is missing from quake106.zip`);
    }
    fs.writeFileSync(path.join(installerRoot, entryName), entry.getData());
}

fs.mkdirSync(targetRoot, { recursive: true });
const extractionRoot = path.join(dataRoot, 'shareware-extract');
fs.mkdirSync(extractionRoot, { recursive: true });
const extractionArguments = [
    '-xf', path.join(installerRoot, 'resource.1'),
    '-C', extractionRoot,
    'ID1/PAK0.PAK', 'LICINFO.TXT', 'SLICNSE.TXT'
];
const extractionTools = process.platform === 'win32' ? ['tar'] : ['bsdtar', 'tar'];
const extracted = extractionTools.some(tool => (
    spawnSync(tool, extractionArguments, { stdio: 'inherit' }).status === 0
));

if (!extracted) {
    throw new Error('Could not extract the LHA resource.1 payload. Install bsdtar or 7-Zip and retry.');
}

fs.copyFileSync(path.join(extractionRoot, 'ID1', 'PAK0.PAK'), targetPak);
fs.mkdirSync(path.join(dataRoot, 'licenses'), { recursive: true });
for (const filename of ['LICINFO.TXT', 'SLICNSE.TXT']) {
    fs.copyFileSync(
        path.join(extractionRoot, filename),
        path.join(dataRoot, 'licenses', filename.toLowerCase())
    );
}

verify(targetPak, PAK_SIZE, PAK_SHA256, 'id1/pak0.pak');
console.log(`Verified shareware PAK ready at ${targetPak}`);
