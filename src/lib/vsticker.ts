import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

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
 * Convert video to GIF for WhatsApp animated sticker
 * Requirements: 512x512 max, 6 seconds max, GIF format
 */
export async function createVideoSticker(videoUrl: string): Promise<VideoStickerResult> {
    const stickerId = randomUUID().substring(0, 8);
    const tempVideo = path.join(VSTICKERS_DIR, `temp_${stickerId}.mp4`);
    const outputGif = path.join(VSTICKERS_DIR, `vsticker_${stickerId}.gif`);

    try {
        // 1. Download video
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

        const response = await fetch(videoUrl, { signal: controller.signal });
        clearTimeout(timeout);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const videoBuffer = Buffer.from(await response.arrayBuffer());
        fs.writeFileSync(tempVideo, videoBuffer);

        // 2. Convert to GIF using ffmpeg
        // Scale to 512x512 (fit inside), limit to 6 seconds, optimize for sticker
        const ffmpegArgs = [
            "-i", tempVideo,
            "-t", "6",                          // Max 6 seconds
            "-vf", "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=white@0,fps=10",
            "-loop", "0",                       // Infinite loop
            "-y",                               // Overwrite output
            outputGif
        ];

        await execFileAsync("ffmpeg", ffmpegArgs, { timeout: 60000 }); // 60s timeout

        // 3. Clean up temp video
        try { fs.unlinkSync(tempVideo); } catch { }

        // 4. Check if GIF was created successfully
        if (!fs.existsSync(outputGif)) {
            throw new Error("GIF conversion failed");
        }

        const filename = `vsticker_${stickerId}.gif`;
        return {
            localPath: outputGif,
            localUrl: `/uploads/vstickers/${filename}`,
            filename
        };
    } catch (error: any) {
        // Cleanup on error
        try { fs.unlinkSync(tempVideo); } catch { }
        try { fs.unlinkSync(outputGif); } catch { }
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
