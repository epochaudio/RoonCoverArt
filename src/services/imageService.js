const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const config = require('config');

class ImageService {
    constructor() {
        this.saveDir = config.has('artwork.saveDir') ? config.get('artwork.saveDir') : './images';
        this.format = this.normalizeFormat(config.has('artwork.format') ? config.get('artwork.format') : 'jpg');
        this.maxImages = 300;
        this.imageInfoFile = 'image_info.json';
        this.imageInfoCache = null;
        this.saveQueue = Promise.resolve();
    }

    normalizeFormat(format) {
        const normalized = String(format || 'jpg').toLowerCase();
        return normalized === 'png' ? 'png' : 'jpg';
    }

    get contentType() {
        return this.format === 'png' ? 'image/png' : 'image/jpeg';
    }

    get extension() {
        return this.format === 'png' ? 'png' : 'jpg';
    }

    getImageOptions(width, height) {
        return {
            scale: "fit",
            width,
            height,
            format: this.contentType
        };
    }

    async ensureDirectoryExists(directory) {
        try {
            await fs.mkdir(directory, { recursive: true });
        } catch (error) {
            if (error.code !== 'EEXIST') throw error;
        }
    }

    async calculateMD5(buffer) {
        const hash = crypto.createHash('md5');
        hash.update(buffer);
        return hash.digest('hex');
    }

    sanitizeFilename(filename) {
        return filename.replace(/[<>:"/\\|?*#%\x00-\x1F]/g, '_')
            .replace(/\s+/g, '_')
            .trim();
    }

    async loadImageInfo() {
        if (this.imageInfoCache) return this.imageInfoCache;

        const infoPath = path.join(this.saveDir, this.imageInfoFile);
        try {
            const data = await fs.readFile(infoPath, 'utf8');
            this.imageInfoCache = JSON.parse(data);
        } catch (error) {
            this.imageInfoCache = {};
        }
        return this.imageInfoCache;
    }

    async saveImageInfo(imageInfo) {
        const infoPath = path.join(this.saveDir, this.imageInfoFile);
        const tempPath = `${infoPath}.${process.pid}.tmp`;

        try {
            await fs.writeFile(tempPath, JSON.stringify(imageInfo, null, 2));
            await fs.rename(tempPath, infoPath);
        } catch (error) {
            await fs.unlink(tempPath).catch(() => {});
            throw error;
        }

        this.imageInfoCache = imageInfo;
    }

    async getImages() {
         try {
            const files = await fs.readdir(this.saveDir);
            return files.filter(file => /\.(jpg|jpeg|png)$/i.test(file));
        } catch (error) {
            console.error('Error reading image directory:', error);
            return [];
        }
    }

    async getRandomImages(count) {
        const images = await this.getImages();
        if (images.length === 0) return [];

        const result = [];
        const taken = new Set();
        
        // If requesting more images than available, return all shuffled
        if (count >= images.length) {
             for (let i = images.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [images[i], images[j]] = [images[j], images[i]];
            }
            return images;
        }

        while (result.length < count) {
            const index = Math.floor(Math.random() * images.length);
            if (!taken.has(index)) {
                taken.add(index);
                result.push(images[index]);
            }
        }
        return result;
    }

    async getImageStats() {
        const imageInfo = await this.loadImageInfo();
        const totalImages = Object.keys(imageInfo).length;
        const oldestImage = Object.values(imageInfo)
            .reduce((oldest, current) => 
                (!oldest || new Date(current.savedAt) < new Date(oldest.savedAt)) 
                    ? current 
                    : oldest
            , null);
        
        return {
            totalImages,
            oldestImage: oldestImage ? {
                albumName: oldestImage.albumName,
                savedAt: oldestImage.savedAt
            } : null
        };
    }

    async manageImageCount() {
        const files = await this.getImages();
        const imageInfo = await this.loadImageInfo();
        
        const imageFiles = [];
        for (const file of files) {
             const filePath = path.join(this.saveDir, file);
             try {
                const stats = await fs.stat(filePath);
                imageFiles.push({
                    name: file,
                    path: filePath,
                    createTime: stats.birthtime
                });
             } catch(e) {
                 console.error(`Error processing file ${file}:`, e);
             }
        }
        
        imageFiles.sort((a, b) => b.createTime - a.createTime);

        if (imageFiles.length >= this.maxImages) {
            const filesToDelete = imageFiles.slice(this.maxImages - 1);
            for (const file of filesToDelete) {
                try {
                    await fs.unlink(file.path);
                    delete imageInfo[file.name];
                    console.log(`Deleted old image: ${file.path}`);
                } catch (error) {
                    console.error(`Error deleting file: ${file.path}`, error);
                }
            }
            await this.saveImageInfo(imageInfo);
        }
    }

    saveArtwork(imageBuffer, albumName) {
        const operation = this.saveQueue.then(() => this.saveArtworkInternal(imageBuffer, albumName));
        this.saveQueue = operation.catch(() => undefined);
        return operation;
    }

    async saveArtworkInternal(imageBuffer, albumName) {
        try {
            await this.ensureDirectoryExists(this.saveDir);

            const sanitizedName = this.sanitizeFilename(albumName);
            const filename = `${sanitizedName}.${this.extension}`;
            const filepath = path.join(this.saveDir, filename);

            const currentMD5 = await this.calculateMD5(imageBuffer);
            const imageInfo = await this.loadImageInfo();

             // Check if exists and md5 matches
             if (imageInfo[filename] && imageInfo[filename].md5 === currentMD5) {
                 // Check if file actually exists on disk
                 try {
                     await fs.access(filepath);
                     console.log(`Artwork exists and matches, skipping: ${filepath}`);
                     return true;
                 } catch (e) {
                     // File doesn't exist, proceed to save
                 }
            }

            await this.manageImageCount();
            await fs.writeFile(filepath, imageBuffer);

            imageInfo[filename] = {
                albumName,
                md5: currentMD5,
                savedAt: new Date().toISOString()
            };
            await this.saveImageInfo(imageInfo);
            
            console.log(`Artwork saved: ${filepath}`);
            return true;

        } catch (error) {
            console.error('Error saving artwork:', error);
            return false;
        }
    }
}

module.exports = new ImageService();
