import sharp from "sharp";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

// Directory for converted stickers
const STICKERS_DIR = path.join(process.cwd(), "public", "uploads", "stickers");

// Ensure stickers directory exists
if (!fs.existsSync(STICKERS_DIR)) {
    fs.mkdirSync(STICKERS_DIR, { recursive: true });
}

export interface StickerResult {
    localPath: string;
    localUrl: string;
    filename: string;
}

/**
 * Download image and convert to WebP sticker format
 * WhatsApp stickers: 512x512 WebP, max 100KB for static, 500KB for animated
 */
export async function createSticker(imageUrl: string): Promise<StickerResult> {
    const stickerId = randomUUID().substring(0, 8);
    const filename = `sticker_${stickerId}.webp`;
    const outputPath = path.join(STICKERS_DIR, filename);

    try {
        console.log(`[STICKER] Downloading image from: ${imageUrl}`);

        // Fetch the image
        const response = await fetch(imageUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.status}`);
        }

        const imageBuffer = Buffer.from(await response.arrayBuffer());
        console.log(`[STICKER] Downloaded ${imageBuffer.length} bytes`);

        // Convert to WebP sticker format
        // WhatsApp sticker specs: 512x512, WebP format
        await sharp(imageBuffer)
            .resize(512, 512, {
                fit: "contain",
                background: { r: 0, g: 0, b: 0, alpha: 0 }  // Transparent background
            })
            .webp({
                quality: 80,
                lossless: false
            })
            .toFile(outputPath);

        console.log(`[STICKER] Created sticker at: ${outputPath}`);

        return {
            localPath: outputPath,
            localUrl: `/uploads/stickers/${filename}`,
            filename
        };
    } catch (error: any) {
        console.error("[STICKER] Conversion error:", error.message);
        // Clean up on error
        if (fs.existsSync(outputPath)) {
            fs.unlinkSync(outputPath);
        }
        throw new Error(`Gagal membuat sticker: ${error.message}`);
    }
}

/**
 * Clean up old sticker files (older than 1 hour)
 */
export function cleanupOldStickers() {
    try {
        const files = fs.readdirSync(STICKERS_DIR);
        const oneHourAgo = Date.now() - 60 * 60 * 1000;

        files.forEach(file => {
            const filePath = path.join(STICKERS_DIR, file);
            const stats = fs.statSync(filePath);
            if (stats.mtimeMs < oneHourAgo) {
                fs.unlinkSync(filePath);
            }
        });
    } catch (error) {
        // Ignore cleanup errors
    }
}
