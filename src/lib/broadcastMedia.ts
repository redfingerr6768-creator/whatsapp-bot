import sharp from "sharp";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

// Directory for converted broadcast images
const BROADCAST_MEDIA_DIR = path.join(process.cwd(), "public", "uploads", "broadcast");

// Ensure directory exists
try {
    if (!fs.existsSync(BROADCAST_MEDIA_DIR)) {
        fs.mkdirSync(BROADCAST_MEDIA_DIR, { recursive: true });
    }
} catch { }

export interface ConvertedMedia {
    localPath: string;
    localUrl: string;
    filename: string;
}

/**
 * Convert image to JPEG format for broadcast
 * GOWA doesn't support all image formats (like .jfif)
 */
export async function convertImageForBroadcast(imageUrl: string): Promise<ConvertedMedia> {
    const mediaId = randomUUID().substring(0, 8);
    const filename = `bc_${mediaId}.jpg`;
    const outputPath = path.join(BROADCAST_MEDIA_DIR, filename);

    try {
        // Fetch image with timeout
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);

        const response = await fetch(imageUrl, { signal: controller.signal });
        clearTimeout(timeout);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const imageBuffer = Buffer.from(await response.arrayBuffer());

        // Convert to JPEG
        await sharp(imageBuffer, { failOnError: false })
            .jpeg({ quality: 85 })
            .toFile(outputPath);

        return {
            localPath: outputPath,
            localUrl: `/uploads/broadcast/${filename}`,
            filename
        };
    } catch (error: any) {
        try { if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath); } catch { }
        throw new Error(error.message || "Image conversion failed");
    }
}

/**
 * Cleanup old broadcast media (async, non-blocking)
 */
export function cleanupOldBroadcastMedia() {
    setImmediate(() => {
        try {
            const files = fs.readdirSync(BROADCAST_MEDIA_DIR);
            const oneHourAgo = Date.now() - 60 * 60 * 1000;

            for (const file of files) {
                try {
                    const filePath = path.join(BROADCAST_MEDIA_DIR, file);
                    const stats = fs.statSync(filePath);
                    if (stats.mtimeMs < oneHourAgo) {
                        fs.unlinkSync(filePath);
                    }
                } catch { }
            }
        } catch { }
    });
}
