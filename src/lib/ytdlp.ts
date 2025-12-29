import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export interface YtDlpResult {
    url: string;
    title: string;
    platform: string;
    duration?: number;
    thumbnail?: string;
}

export async function getVideoInfo(url: string): Promise<YtDlpResult> {
    try {
        const args = [
            url,
            "--dump-json",
            "--no-playlist",
            "-S", "res:720,vcodec:h264,vn:false,acodec:aac",
            "--no-warnings",
            "--force-ipv4"
        ];

        // 10MB buffer for large JSON output
        const { stdout } = await execFileAsync("yt-dlp", args, { maxBuffer: 10 * 1024 * 1024 });

        const info = JSON.parse(stdout);

        // Some extractors return 'formats' which might need selection, but --dump-json usually returns 'url' of best format selected by -S
        // If 'url' is missing, it might be in 'requested_downloads'
        const directUrl = info.url || (info.requested_downloads && info.requested_downloads[0] && info.requested_downloads[0].url);

        if (!directUrl) {
            throw new Error("No direct URL found");
        }

        return {
            url: directUrl,
            title: info.title || "Video",
            platform: info.extractor_key || "Unknown",
            duration: info.duration,
            thumbnail: info.thumbnail
        };
    } catch (error: any) {
        console.error("yt-dlp error:", error.stderr || error.message);
        throw new Error("Gagal mengambil info video. Pastikan link valid dan publik.");
    }
}
