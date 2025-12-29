import sharp from "sharp";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

// Directory for converted stickers
const STICKERS_DIR = path.join(process.cwd(), "public", "uploads", "stickers");

// Ensure stickers directory exists (do once at startup)
try {
    if (!fs.existsSync(STICKERS_DIR)) {
        fs.mkdirSync(STICKERS_DIR, { recursive: true });
    }
} catch { }

export interface StickerResult {
    localPath: string;
    localUrl: string;
    filename: string;
}

/**
 * FAST sticker creation - optimized for speed
 * Converts image to WebP 512x512 sticker format
 */
export async function createSticker(imageUrl: string): Promise<StickerResult> {
    const stickerId = randomUUID().substring(0, 8);
    const filename = `sticker_${stickerId}.webp`;
    const outputPath = path.join(STICKERS_DIR, filename);

    try {
        // Fetch the image with timeout
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

        const response = await fetch(imageUrl, { signal: controller.signal });
        clearTimeout(timeout);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const imageBuffer = Buffer.from(await response.arrayBuffer());

        // FAST conversion settings
        await sharp(imageBuffer, {
            failOnError: false,  // Don't fail on minor issues
            limitInputPixels: false  // No limit
        })
            .resize(512, 512, {
                fit: "contain",
                background: { r: 0, g: 0, b: 0, alpha: 0 },
                fastShrinkOnLoad: true  // Faster resize
            })
            .webp({
                quality: 60,      // Lower quality = faster + smaller
                effort: 0,        // Fastest compression
                lossless: false
            })
            .toFile(outputPath);

        return {
            localPath: outputPath,
            localUrl: `/uploads/stickers/${filename}`,
            filename
        };
    } catch (error: any) {
        // Clean up on error
        try { if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath); } catch { }
        throw new Error(error.message || "Konversi gagal");
    }
}

/**
 * Async cleanup - don't block main thread
 */
export function cleanupOldStickers() {
    // Run cleanup in background, don't await
    setImmediate(() => {
        try {
            const files = fs.readdirSync(STICKERS_DIR);
            const thirtyMinAgo = Date.now() - 30 * 60 * 1000; // 30 min

            for (const file of files) {
                try {
                    const filePath = path.join(STICKERS_DIR, file);
                    const stats = fs.statSync(filePath);
                    if (stats.mtimeMs < thirtyMinAgo) {
                        fs.unlinkSync(filePath);
                    }
                } catch { }
            }
        } catch { }
    });
}
