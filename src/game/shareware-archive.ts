import { Archive } from 'libarchive.js';

const assetUrl = (path: string): string => new URL(
    `${import.meta.env.BASE_URL}${path}`,
    window.location.origin
).toString();

export const quakePakUrl = (): string => assetUrl('game-data/id1/pak0.pak');

export const extractQuakeSharewarePak = async (
    status: (message: string) => void
): Promise<ArrayBuffer> => {
    status('Downloading the verified Quake shareware package…');
    const response = await fetch(assetUrl('game-data/quake106.zip'));
    if (!response.ok) {
        throw new Error(`Could not load game data (${response.status})`);
    }

    Archive.init({
        workerUrl: assetUrl('libarchive/worker-bundle.js')
    });
    status('Opening the Quake shareware package…');
    const outerArchive = await Archive.open(new File([
        await response.blob()
    ], 'quake106.zip'));
    let installerArchive: File;
    try {
        installerArchive = await outerArchive.extractSingleFile('resource.1');
    } finally {
        await outerArchive.close();
    }

    status('Extracting id1/pak0.pak in the browser…');
    const innerArchive = await Archive.open(installerArchive);
    try {
        return await (
            await innerArchive.extractSingleFile('ID1/PAK0.PAK')
        ).arrayBuffer();
    } finally {
        await innerArchive.close();
    }
};
