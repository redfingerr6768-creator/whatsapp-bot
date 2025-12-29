import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";

const execFileAsync = promisify(execFile);

// Directory for downloaded videos
const DOWNLOADS_DIR = path.join(process.cwd(), "public", "uploads", "videos");

// Ensure downloads directory exists
if (!fs.existsSync(DOWNLOADS_DIR)) {
    fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
}

export interface YtDlpResult {
    localPath: string;  // Local file path
    localUrl: string;   // URL to access from localhost
    title: string;
    platform: string;
    duration?: number;
}

/**
 * Download video using yt-dlp and save to local storage
 * Returns local URL that GOWA can access
 */
export async function downloadVideo(url: string): Promise<YtDlpResult> {
    const videoId = randomUUID().substring(0, 8);
    const outputTemplate = path.join(DOWNLOADS_DIR, `${videoId}.%(ext)s`);

    try {
        // First, get video info
        const infoArgs = [
            url,
            "--dump-json",
            "--no-playlist",
            "--no-warnings"
        ];

        const { stdout: infoJson } = await execFileAsync("yt-dlp", infoArgs, {
            maxBuffer: 10 * 1024 * 1024
        });
        const info = JSON.parse(infoJson);

        // Then download the video
        const downloadArgs = [
            url,
            "-f", "b[ext=mp4]/bv*[ext=mp4]+ba[ext=m4a]/b",  // Prefer mp4
            "-S", "res:720,vcodec:h264",  // 720p h264 for compatibility
            "-o", outputTemplate,
            "--no-playlist",
            "--no-warnings",
            "--force-ipv4",
            "--max-filesize", "50M"  // Limit to 50MB for WhatsApp
        ];

        await execFileAsync("yt-dlp", downloadArgs, {
            maxBuffer: 10 * 1024 * 1024,
            timeout: 120000  // 2 minute timeout
        });

        // Find the downloaded file
        const files = fs.readdirSync(DOWNLOADS_DIR).filter(f => f.startsWith(videoId));
        if (files.length === 0) {
            throw new Error("Download completed but file not found");
        }

        const filename = files[0];
        const localPath = path.join(DOWNLOADS_DIR, filename);

        // Return local URL (GOWA will fetch from this server)
        return {
            localPath,
            localUrl: `/uploads/videos/${filename}`,
            title: info.title || "Video",
            platform: info.extractor_key || "Unknown",
            duration: info.duration
        };
    } catch (error: any) {
        console.error("yt-dlp download error:", error.stderr || error.message);

        // Clean up any partial downloads
        const files = fs.readdirSync(DOWNLOADS_DIR).filter(f => f.startsWith(videoId));
        files.forEach(f => {
            try { fs.unlinkSync(path.join(DOWNLOADS_DIR, f)); } catch { }
        });

        if (error.message?.includes("max-filesize")) {
            throw new Error("Video terlalu besar (max 50MB)");
        }

        throw new Error("Gagal download video. Pastikan link valid dan publik.");
    }
}

/**
 * Clean up old downloaded videos (older than 1 hour)
 */
export function cleanupOldVideos() {
    try {
        const files = fs.readdirSync(DOWNLOADS_DIR);
        const oneHourAgo = Date.now() - 60 * 60 * 1000;

        files.forEach(file => {
            const filePath = path.join(DOWNLOADS_DIR, file);
            const stats = fs.statSync(filePath);
            if (stats.mtimeMs < oneHourAgo) {
                fs.unlinkSync(filePath);
            }
        });
    } catch (error) {
        console.error("Cleanup error:", error);
    }
}
