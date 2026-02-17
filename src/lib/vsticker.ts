import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

import ffmpegPath from "ffmpeg-static";

const execFileAsync = promisify(execFile);

// Directory for converted video stickers
const VSTICKERS_DIR = path.join(process.cwd(), "public", "uploads", "vstickers");

// Ensure directory exists
try {
    if (!fs.existsSync(VSTICKERS_DIR)) {
        fs.mkdirSync(VSTICKERS_DIR, { recursive: true });
    }
} catch { }

export interface VideoStickerResult {
    localPath: string;
    localUrl: string;
    filename: string;
}

/**
 * Convert video to animated WebP for WhatsApp sticker
 * Requirements: 512x512 max, 6 seconds max, WebP format
 */
export async function createVideoSticker(videoUrl: string): Promise<VideoStickerResult> {
    const stickerId = randomUUID().substring(0, 8);

    // Cleanup old files before creating new one
    cleanupOldVideoStickers();

    const tempVideo = path.join(VSTICKERS_DIR, `temp_${stickerId}.mp4`);
    const outputWebp = path.join(VSTICKERS_DIR, `vsticker_${stickerId}.webp`);

    try {
        if (!ffmpegPath) {
            throw new Error("FFmpeg binary not found!");
        }

        // 1. Download video
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);

        const response = await fetch(videoUrl, { signal: controller.signal });
        clearTimeout(timeout);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const videoBuffer = Buffer.from(await response.arrayBuffer());
        fs.writeFileSync(tempVideo, videoBuffer);

        // 2. Convert to animated WebP using ffmpeg
        // Scale to 512x512, limit to 6 seconds, use libwebp encoder
        const ffmpegArgs = [
            "-i", tempVideo,
            "-t", "6",                          // Max 6 seconds
            "-vf", "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=white@0.0,fps=15",
            "-c:v", "libwebp",                  // WebP encoder
            "-lossless", "0",
            "-compression_level", "3",
            "-q:v", "60",                       // Quality
            "-loop", "0",                       // Infinite loop
            "-an",                              // No audio
            "-y",                               // Overwrite
            outputWebp
        ];

        await execFileAsync(ffmpegPath, ffmpegArgs, { timeout: 60000 });

        // 3. Clean up temp video
        try { fs.unlinkSync(tempVideo); } catch { }

        // 4. Check if WebP was created
        if (!fs.existsSync(outputWebp)) {
            throw new Error("WebP conversion failed");
        }

        const filename = `vsticker_${stickerId}.webp`;
        return {
            localPath: outputWebp,
            localUrl: `/uploads/vstickers/${filename}`,
            filename
        };
    } catch (error: any) {
        // Cleanup on error
        try { fs.unlinkSync(tempVideo); } catch { }
        try { fs.unlinkSync(outputWebp); } catch { }
        throw new Error(error.message || "Video conversion failed");
    }
}

/**
 * Async cleanup old video stickers
 */
export function cleanupOldVideoStickers() {
    setImmediate(() => {
        try {
            const files = fs.readdirSync(VSTICKERS_DIR);
            const thirtyMinAgo = Date.now() - 30 * 60 * 1000;

            for (const file of files) {
                try {
                    const filePath = path.join(VSTICKERS_DIR, file);
                    const stats = fs.statSync(filePath);
                    if (stats.mtimeMs < thirtyMinAgo) {
                        fs.unlinkSync(filePath);
                    }
                } catch { }
            }
        } catch { }
    });
}
