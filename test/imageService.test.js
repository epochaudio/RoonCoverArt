"use strict";

const assert = require('assert');
const fs = require('fs').promises;
const os = require('os');
const path = require('path');

async function main() {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'coverart-image-service-'));

    try {
        process.env.NODE_CONFIG = JSON.stringify({
            artwork: {
                saveDir: tempDir,
                format: 'jpg'
            }
        });

        const imageService = require('../src/services/imageService');
        const saveResults = await Promise.all(
            Array.from({ length: 20 }, (_, index) =>
                imageService.saveArtwork(Buffer.from(`image-${index}`), `album-${index}`)
            )
        );

        assert(saveResults.every(Boolean), 'all concurrent saves should succeed');

        const files = await fs.readdir(tempDir);
        const imageFiles = files.filter(file => file.endsWith('.jpg'));
        const imageInfo = JSON.parse(
            await fs.readFile(path.join(tempDir, 'image_info.json'), 'utf8')
        );
        const stats = await imageService.getImageStats();

        assert.strictEqual(imageFiles.length, 20, 'all image files should be present');
        assert.strictEqual(Object.keys(imageInfo).length, 20, 'the index should contain every image');
        assert.strictEqual(stats.totalImages, 20, 'reported image count should match the index');

        console.log('imageService concurrent save test passed');
    } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
    }
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
