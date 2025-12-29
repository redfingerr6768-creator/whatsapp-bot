import sharp from "sharp";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// Directories
const MEDIA_DIR = path.join(process.cwd(), "public", "uploads", "media");

// Ensure directory exists
try {
    if (!fs.existsSync(MEDIA_DIR)) {
        fs.mkdirSync(MEDIA_DIR, { recursive: true });
    }
} catch { }

export interface ConvertedMedia {
    localPath: string;
    localUrl: string;
    filename: string;
    mimetype: string;
}

/**
 * Convert WebP sticker (or any image) to JPEG
 */
export async function stickerToImage(url: string): Promise<ConvertedMedia> {
    const mediaId = randomUUID().substring(0, 8);
    const filename = `img_${mediaId}.jpg`;
    const outputPath = path.join(MEDIA_DIR, filename);

    try {
        // Fetch image
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch media: ${response.status}`);
        const buffer = Buffer.from(await response.arrayBuffer());

        // Convert to JPG using sharp
        await sharp(buffer)
            .jpeg({ quality: 90 })
            .toFile(outputPath);

        return {
            localPath: outputPath,
            localUrl: `/uploads/media/${filename}`,
            filename,
            mimetype: "image/jpeg"
        };
    } catch (error: any) {
        throw new Error(`Sticker conversion failed: ${error.message}`);
    }
}

/**
 * Convert Video to MP3
 */
export async function videoToMp3(url: string): Promise<ConvertedMedia> {
    const mediaId = randomUUID().substring(0, 8);
    const inputFilename = `temp_${mediaId}.mp4`;
    const outputFilename = `audio_${mediaId}.mp3`;
    const inputPath = path.join(MEDIA_DIR, inputFilename);
    const outputPath = path.join(MEDIA_DIR, outputFilename);

    try {
        // Fetch video
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch video: ${response.status}`);
        const buffer = Buffer.from(await response.arrayBuffer());
        fs.writeFileSync(inputPath, buffer);

        // Convert to MP3 using ffmpeg
        // -vn: disable video
        // -acodec libmp3lame: audio codec
        // -q:a 2: variable bit rate (high quality)
        await execAsync(`ffmpeg -i "${inputPath}" -vn -acodec libmp3lame -q:a 2 "${outputPath}"`);

        // Clean input file
        try { fs.unlinkSync(inputPath); } catch { }

        return {
            localPath: outputPath,
            localUrl: `/uploads/media/${outputFilename}`,
            filename: outputFilename,
            mimetype: "audio/mpeg"
        };
    } catch (error: any) {
        // Clean up on error
        try { if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath); } catch { }
        try { if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath); } catch { }
        throw new Error(`Video to MP3 failed: ${error.message}`);
    }
}

/**
 * Cleanup old media files (older than 1 hour)
 */
export function cleanupMediaTools() {
    setImmediate(() => {
        try {
            const files = fs.readdirSync(MEDIA_DIR);
            const oneHourAgo = Date.now() - 60 * 60 * 1000;

            for (const file of files) {
                try {
                    const filePath = path.join(MEDIA_DIR, file);
                    const stats = fs.statSync(filePath);
                    if (stats.mtimeMs < oneHourAgo) {
                        fs.unlinkSync(filePath);
                    }
                } catch { }
            }
        } catch { }
    });
}
