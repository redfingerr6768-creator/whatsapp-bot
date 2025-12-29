/**
 * Bot Commands Handler
 * Parses and executes bot commands from messages
 */

import { GowaClient, getGowaClient } from "./gowa";
import { isAdmin } from "./adminConfig";
import { getGroupTemplates } from "./groupTemplates";
// Pre-import for speed (avoid dynamic import delay)
import { createSticker, cleanupOldStickers } from "./sticker";
import { createVideoSticker, cleanupOldVideoStickers } from "./vsticker";
import { getRandomDelay, setDelay, getBroadcastConfig } from "./broadcastConfig";
import { convertImageForBroadcast, cleanupOldBroadcastMedia } from "./broadcastMedia";

const GOWA_URL = process.env.GOWA_URL || "http://localhost:3030";
const GOWA_BASIC_AUTH = process.env.GOWA_BASIC_AUTH;

export interface CommandResult {
    handled: boolean;
    response?: string;
    error?: string;
}

export interface MessagePayload {
    id: string;
    from: string;
    body: string;
    hasMedia?: boolean;
    mediaUrl?: string;
    mimetype?: string;
    quotedMsg?: {
        hasMedia?: boolean;
        mediaUrl?: string;
        mimetype?: string;
        body?: string;
    };
}

// Available commands
const COMMANDS = {
    STICKER: ["/sticker", "/s", ".sticker", ".s"],
    VIDEO_STICKER: ["/vsticker", "/vs", ".vsticker", ".vs"],
    DOWNLOAD: ["/download", "/dl", ".download", ".dl", "/tt", "/ig", "/yt"],
    HELP: ["/help", "/menu", ".help", ".menu"],
    // Admin commands
    ADMIN_BROADCAST: ["/broadcast", "/bc"],
    ADMIN_CANCEL: ["/cancel", "/stop"],
    ADMIN_STATUS: ["/status", "/stat"],
    ADMIN_TEMPLATES: ["/templates", "/tpl"],
    ADMIN_GROUPS: ["/groups", "/grp"],
    ADMIN_CONTACTS: ["/contacts", "/kontak"],
    ADMIN_SEND: ["/send", "/kirim"],
    ADMIN_SENDGROUP: ["/sendgroup", "/sg"],
    ADMIN_AI_TOGGLE: ["/aitoggle", "/aiswitch"],
    ADMIN_PING: ["/ping"],
    ADMIN_SETDELAY: ["/setdelay", "/delay"],
    // AI Query (available to everyone)
    AI_QUERY: ["/ai"],
};

// Broadcast state for cancellation
let broadcastInProgress = false;
let cancelBroadcast = false;

/**
 * Check if message is a command
 */
export function isCommand(message: string): boolean {
    const lowerMsg = message.toLowerCase().trim();
    return lowerMsg.startsWith("/") || lowerMsg.startsWith(".");
}

/**
 * Parse command from message
 * Format: /command arg1, arg2, arg3
 * Uses comma as separator for arguments
 */
export function parseCommand(message: string): { command: string; args: string } {
    const trimmed = message.trim();
    // Find first space to separate command from args
    const spaceIndex = trimmed.indexOf(" ");
    if (spaceIndex === -1) {
        return { command: trimmed.toLowerCase(), args: "" };
    }
    const command = trimmed.substring(0, spaceIndex).toLowerCase();
    const args = trimmed.substring(spaceIndex + 1).trim();
    return { command, args };
}

/**
 * Parse comma-separated arguments
 */
export function parseArgs(args: string): string[] {
    return args.split(",").map(a => a.trim()).filter(Boolean);
}

/**
 * Handle bot command
 */
export async function handleCommand(payload: MessagePayload): Promise<CommandResult> {
    const { command, args } = parseCommand(payload.body);
    const chatId = payload.from;
    const client = getGowaClient(GOWA_URL, GOWA_BASIC_AUTH);

    // Help command
    if (COMMANDS.HELP.includes(command)) {
        const senderIsAdmin = isAdmin(chatId);

        let helpText = `╔══════════════════════════════╗
║    🤖 *BOT COMMAND CENTER*    ║
╚══════════════════════════════╝

━━━━━ 🎨 *KREATOR* ━━━━━
📸 /sticker ➜ Gambar → Sticker
🎬 /vsticker ➜ Video → Sticker animasi
⬇️ /download [URL] ➜ Download video sosmed

━━━━━ 🧠 *AI ASSISTANT* ━━━━━
🤖 /ai [pertanyaan] ➜ Tanya AI apapun
_Contoh: /ai apa itu blockchain?_

━━━━━ ℹ️ *INFO* ━━━━━
❓ /help ➜ Tampilkan menu ini
🏓 /ping ➜ Cek status bot`;

        if (senderIsAdmin) {
            helpText += `

━━━━━ 👑 *ADMIN ONLY* ━━━━━
📊 /status ➜ Status lengkap bot
📁 /templates ➜ Lihat template grup
📢 /broadcast [tpl], [msg] ➜ Broadcast
🛑 /cancel ➜ Batalkan broadcast
👥 /groups ➜ List semua grup
📇 /contacts ➜ Info kontak
✉️ /send [no], [msg] ➜ Kirim ke nomor
📨 /sendgroup [id], [msg] ➜ Kirim ke grup
🔄 /aitoggle ➜ ON/OFF AI response`;
        }

        helpText += `

╔══════════════════════════════╗
║  💡 _Reply /help untuk bantuan_  ║
╚══════════════════════════════╝`;

        await client.sendText(chatId, helpText);
        return { handled: true, response: "help sent" };
    }

    // Ping command (public)
    if (COMMANDS.ADMIN_PING.includes(command)) {
        const pongText = `🏓 *PONG!*

╭─────────────────╮
│  ✅ Bot Online   │
│  ⚡ Latency: <1s │
│  🕐 ${new Date().toLocaleTimeString('id-ID')}  │
╰─────────────────╯`;
        await client.sendText(chatId, pongText);
        return { handled: true, response: "pong" };
    }

    // AI Query command (public) - /ai <question>
    if (COMMANDS.AI_QUERY.includes(command)) {
        if (!args) {
            await client.sendText(chatId, `🤖 *AI Assistant*\n\n❌ Masukkan pertanyaan!\n\n_Contoh: /ai apa itu komputer?_`);
            return { handled: true, error: "no question" };
        }
        return await handleAiQuery(client, chatId, args);
    }

    // Sticker command
    if (COMMANDS.STICKER.includes(command)) {
        return await handleStickerCommand(client, chatId, payload);
    }

    // Video sticker command
    if (COMMANDS.VIDEO_STICKER.includes(command)) {
        return await handleVideoStickerCommand(client, chatId, payload);
    }

    // Download command
    if (COMMANDS.DOWNLOAD.includes(command)) {
        return await handleDownloadCommand(client, chatId, args, command);
    }

    // === ADMIN COMMANDS ===
    // Check if sender is admin for admin-only commands
    const senderIsAdmin = isAdmin(chatId);

    // Admin: Status command
    if (COMMANDS.ADMIN_STATUS.includes(command)) {
        if (!senderIsAdmin) {
            return { handled: false }; // Silently ignore for non-admins
        }
        const templates = getGroupTemplates();
        const statusText = `📊 *Bot Status*

✅ Bot aktif dan berjalan
📁 Templates tersimpan: ${templates.length}
🔧 Admin mode: aktif

*Commands tersedia:*
/broadcast <template> <pesan> - Broadcast ke template grup
/templates - Lihat daftar template
/status - Lihat status bot`;

        await client.sendText(chatId, statusText);
        return { handled: true, response: "status sent" };
    }

    // Admin: List templates command
    if (COMMANDS.ADMIN_TEMPLATES.includes(command)) {
        if (!senderIsAdmin) {
            return { handled: false };
        }
        const templates = getGroupTemplates();
        if (templates.length === 0) {
            await client.sendText(chatId, "📁 Belum ada template tersimpan.\n\nBuat template di Dashboard → Broadcast atau Groups.");
            return { handled: true, response: "no templates" };
        }

        const templateList = templates.map((t, i) =>
            `${i + 1}. *${t.name}* (${t.groupIds.length} grup)`
        ).join("\n");

        await client.sendText(chatId, `📁 *Daftar Template*\n\n${templateList}\n\nGunakan: /broadcast <nama_template>, <pesan>\n_Kirim dengan media untuk broadcast gambar/video!_`);
        return { handled: true, response: "templates listed" };
    }

    // Admin: Cancel broadcast
    if (COMMANDS.ADMIN_CANCEL.includes(command)) {
        if (!senderIsAdmin) return { handled: false };
        if (!broadcastInProgress) {
            await client.sendText(chatId, "❌ Tidak ada broadcast yang sedang berjalan.");
            return { handled: true, response: "no broadcast" };
        }
        cancelBroadcast = true;
        await client.sendText(chatId, "🛑 Menghentikan broadcast...");
        return { handled: true, response: "cancelling" };
    }

    // Admin: Broadcast command
    if (COMMANDS.ADMIN_BROADCAST.includes(command)) {
        if (!senderIsAdmin) {
            return { handled: false };
        }
        return await handleAdminBroadcast(client, chatId, args, payload);
    }

    // Admin: Set broadcast delay
    if (COMMANDS.ADMIN_SETDELAY.includes(command)) {
        if (!senderIsAdmin) return { handled: false };

        const config = getBroadcastConfig();

        if (!args) {
            // Show current delay
            const minSec = (config.minDelay / 1000).toFixed(1);
            const maxSec = (config.maxDelay / 1000).toFixed(1);
            await client.sendText(chatId, `⏱️ *Delay Broadcast*\n\nMin: ${minSec}s\nMax: ${maxSec}s\n\nUntuk mengubah:\n/setdelay <min> [max]\n\nContoh:\n/setdelay 1 → 1-4 detik\n/setdelay 2 5 → 2-5 detik\n/setdelay 0.5 1 → 0.5-1 detik`);
            return { handled: true, response: "delay shown" };
        }

        const parts = args.split(/\s+/);
        const minSec = parseFloat(parts[0]);
        const maxSec = parts[1] ? parseFloat(parts[1]) : undefined;

        if (isNaN(minSec) || minSec < 0) {
            await client.sendText(chatId, "❌ Format salah. Contoh: /setdelay 2 5");
            return { handled: true, error: "invalid format" };
        }

        const newConfig = setDelay(minSec, maxSec, payload.from);
        const newMinSec = (newConfig.minDelay / 1000).toFixed(1);
        const newMaxSec = (newConfig.maxDelay / 1000).toFixed(1);
        await client.sendText(chatId, `✅ Delay broadcast diubah!\n\nMin: ${newMinSec}s\nMax: ${newMaxSec}s`);
        return { handled: true, response: "delay updated" };
    }

    // Admin: List groups command
    if (COMMANDS.ADMIN_GROUPS.includes(command)) {
        if (!senderIsAdmin) return { handled: false };
        try {
            const groups = await client.getGroups();
            if (!groups || groups.length === 0) {
                await client.sendText(chatId, "👥 Tidak ada grup yang terhubung.");
                return { handled: true, response: "no groups" };
            }
            const groupList = groups.slice(0, 20).map((g: any, i: number) =>
                `${i + 1}. ${g.subject || g.name || g.id}`
            ).join("\n");
            await client.sendText(chatId, `👥 *Daftar Grup (${groups.length} total)*\n\n${groupList}${groups.length > 20 ? "\n\n_... dan " + (groups.length - 20) + " grup lainnya_" : ""}`);
            return { handled: true, response: "groups listed" };
        } catch (e) {
            await client.sendText(chatId, "❌ Gagal mengambil daftar grup");
            return { handled: true, error: "failed to get groups" };
        }
    }

    // Admin: Contacts info
    if (COMMANDS.ADMIN_CONTACTS.includes(command)) {
        if (!senderIsAdmin) return { handled: false };
        try {
            const contacts = await client.getContacts();
            await client.sendText(chatId, `📇 *Info Kontak*\n\n📱 Total kontak: ${contacts?.length || 0}`);
            return { handled: true, response: "contacts info" };
        } catch (e) {
            await client.sendText(chatId, "❌ Gagal mengambil info kontak");
            return { handled: true, error: "failed" };
        }
    }

    // Admin: Send to number
    if (COMMANDS.ADMIN_SEND.includes(command)) {
        if (!senderIsAdmin) return { handled: false };
        const parts = parseArgs(args);
        if (parts.length < 2) {
            await client.sendText(chatId, "❌ Format: /send <nomor>, <pesan>\n\n_Contoh: /send 628123456789, Halo!_");
            return { handled: true, error: "invalid format" };
        }
        // GOWA uses plain phone number without @c.us
        const targetNumber = parts[0].replace(/\D/g, "");
        const message = parts.slice(1).join(", ");
        if (!targetNumber || targetNumber.length < 10) {
            await client.sendText(chatId, "❌ Nomor tidak valid. Gunakan format: 628xxx");
            return { handled: true, error: "invalid number" };
        }
        try {
            await client.sendText(targetNumber, message);
            await client.sendText(chatId, `✅ Pesan terkirim ke ${targetNumber}`);
            return { handled: true, response: "sent" };
        } catch (e: any) {
            await client.sendText(chatId, `❌ Gagal kirim: ${e.message}`);
            return { handled: true, error: e.message };
        }
    }

    // Admin: Send to group
    if (COMMANDS.ADMIN_SENDGROUP.includes(command)) {
        if (!senderIsAdmin) return { handled: false };
        const parts = parseArgs(args);
        if (parts.length < 2) {
            await client.sendText(chatId, "❌ Format: /sendgroup <groupId>, <pesan>\n\n_Contoh: /sendgroup 120363xxx@g.us, Halo grup!_");
            return { handled: true, error: "invalid format" };
        }
        const groupId = parts[0];
        const message = parts.slice(1).join(", ");
        try {
            await client.sendText(groupId, message);
            await client.sendText(chatId, `✅ Pesan terkirim ke grup`);
            return { handled: true, response: "sent to group" };
        } catch (e: any) {
            await client.sendText(chatId, `❌ Gagal kirim: ${e.message}`);
            return { handled: true, error: e.message };
        }
    }

    // Admin: Toggle AI
    if (COMMANDS.ADMIN_AI_TOGGLE.includes(command)) {
        if (!senderIsAdmin) return { handled: false };
        try {
            const { getGroqConfig, updateGroqConfig } = await import("./groq");
            const config = getGroqConfig();
            const newState = !config.enabled;
            updateGroqConfig({ enabled: newState });
            await client.sendText(chatId, `🤖 AI Response: ${newState ? "✅ *AKTIF*" : "❌ *NONAKTIF*"}`);
            return { handled: true, response: `ai ${newState ? "enabled" : "disabled"}` };
        } catch (e: any) {
            await client.sendText(chatId, `❌ Gagal toggle AI: ${e.message}`);
            return { handled: true, error: e.message };
        }
    }

    return { handled: false };
}

/**
 * Handle AI query with stylish response
 * Usage: /ai <question>
 */
async function handleAiQuery(client: GowaClient, chatId: string, question: string): Promise<CommandResult> {
    try {
        const { generateAIResponse, getGroqConfig } = await import("./groq");
        const config = getGroqConfig();

        if (!config.enabled) {
            await client.sendText(chatId, "🤖 AI sedang tidak aktif.\n\n_Admin dapat mengaktifkan dengan /aitoggle_");
            return { handled: true, error: "AI disabled" };
        }

        // Send typing indicator
        await client.sendText(chatId, "🧠 _Thinking..._");

        const aiResponse = await generateAIResponse(question);

        // Format stylish response
        const emojis = ["✨", "💡", "🎯", "🔮", "⚡", "🌟", "💫", "🚀"];
        const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];

        const styledResponse = `╭───────────────────────╮
│   ${randomEmoji} *AI ASSISTANT* ${randomEmoji}   │
╰───────────────────────╯

📝 *Pertanyaan:*
_${question}_

━━━━━━━━━━━━━━━━━━━━━━

💬 *Jawaban:*
${aiResponse}

━━━━━━━━━━━━━━━━━━━━━━
🤖 _Powered by Groq AI_`;

        await client.sendText(chatId, styledResponse);
        return { handled: true, response: "ai response sent" };
    } catch (error: any) {
        await client.sendText(chatId, `❌ AI Error: ${error.message}\n\n_Coba lagi nanti._`);
        return { handled: true, error: error.message };
    }
}

/**
 * Handle admin broadcast command
 * Usage: /broadcast <template_name>, <message>
 * Supports media: send image/video with caption /broadcast template, message
 */
async function handleAdminBroadcast(client: GowaClient, adminChatId: string, args: string, payload: MessagePayload): Promise<CommandResult> {
    try {
        // Check if already broadcasting
        if (broadcastInProgress) {
            await client.sendText(adminChatId, "⚠️ Broadcast sedang berjalan!\n\nGunakan /cancel untuk membatalkan.");
            return { handled: true, error: "broadcast in progress" };
        }

        // Parse template name and message (comma separated)
        const parts = args.split(",").map(a => a.trim());
        if (parts.length < 2 || !parts[0] || !parts[1]) {
            await client.sendText(adminChatId, `❌ Format salah.\n\nGunakan: /broadcast <nama_template>, <pesan>\nContoh: /broadcast marketing, Promo hari ini!\n\n_Kirim dengan gambar/video untuk broadcast media!_`);
            return { handled: true, error: "invalid format" };
        }

        const templateName = parts[0];
        const message = parts.slice(1).join(", ");

        // Check for media attachment
        const mediaUrl = payload.mediaUrl || payload.quotedMsg?.mediaUrl;
        const mimetype = payload.mimetype || payload.quotedMsg?.mimetype || "";
        const hasMedia = !!mediaUrl;

        // Find template
        const templates = getGroupTemplates();
        const template = templates.find(t =>
            t.name.toLowerCase() === templateName.toLowerCase() ||
            t.name.toLowerCase().includes(templateName.toLowerCase())
        );

        if (!template) {
            const available = templates.map(t => t.name).join(", ") || "tidak ada";
            await client.sendText(adminChatId, `❌ Template "${templateName}" tidak ditemukan.\n\nTemplate tersedia: ${available}`);
            return { handled: true, error: "template not found" };
        }

        // Deduplicate group IDs
        const uniqueGroupIds = [...new Set(template.groupIds)];
        const totalGroups = uniqueGroupIds.length;

        // Check if template has groups
        if (totalGroups === 0) {
            await client.sendText(adminChatId, `❌ Template "${template.name}" tidak memiliki grup!\n\nTambahkan grup di Dashboard → Groups → pilih grup → Save as Template`);
            return { handled: true, error: "template has no groups" };
        }

        // Set broadcast state
        broadcastInProgress = true;
        cancelBroadcast = false;

        // Prepare media if needed
        let finalMediaUrl = mediaUrl;

        if (hasMedia && mimetype.startsWith("image/")) {
            try {
                await client.sendText(adminChatId, "⏳ Memproses gambar untuk broadcast...");
                const converted = await convertImageForBroadcast(mediaUrl!);
                finalMediaUrl = `http://localhost:3000${converted.localUrl}`;
                cleanupOldBroadcastMedia(); // Async cleanup
                console.log(`[BROADCAST] Image converted to: ${finalMediaUrl}`);
            } catch (error: any) {
                console.error(`[BROADCAST] Image conversion failed: ${error.message}`);
                await client.sendText(adminChatId, `⚠️ Gagal konversi gambar: ${error.message}\nMencoba kirim URL asli...`);
            }
        }

        // Send broadcast notification
        const mediaInfo = hasMedia ? `\n📎 Media: ${mimetype.split("/")[0]}` : "";
        await client.sendText(adminChatId, `📡 *Mulai broadcast...*\n\nTemplate: ${template.name}\nGrup: ${totalGroups}${mediaInfo}\nPesan: ${message}\n\n_Ketik /cancel untuk membatalkan_`);

        // Send to all groups
        let successCount = 0;
        let failCount = 0;
        let cancelledAt = 0;

        for (let i = 0; i < uniqueGroupIds.length; i++) {
            // Check for cancellation
            if (cancelBroadcast) {
                cancelledAt = i;
                break;
            }

            const groupId = uniqueGroupIds[i];
            try {
                if (hasMedia) {
                    // Send media with caption
                    console.log(`[BROADCAST] Sending media to ${groupId}: ${finalMediaUrl?.substring(0, 50)}...`);
                    if (mimetype.startsWith("image/")) {
                        await client.sendImage(groupId, finalMediaUrl!, message);
                    } else if (mimetype.startsWith("video/")) {
                        await client.sendVideo(groupId, finalMediaUrl!, message);
                    } else {
                        await client.sendFile(groupId, finalMediaUrl!);
                        if (message) await client.sendText(groupId, message);
                    }
                } else {
                    await client.sendText(groupId, message);
                }
                successCount++;
            } catch (e: any) {
                console.log(`[BROADCAST] Failed for ${groupId}: ${e.message}`);
                failCount++;
            }

            // Delay from config (anti-ban)
            const delay = getRandomDelay();
            await new Promise(r => setTimeout(r, delay));
        }

        // Reset broadcast state
        broadcastInProgress = false;

        // Send result
        if (cancelBroadcast) {
            cancelBroadcast = false;
            await client.sendText(adminChatId, `🛑 *Broadcast dibatalkan!*\n\n✓ Terkirim: ${successCount}\n✗ Gagal: ${failCount}\n⏸️ Dibatalkan pada: ${cancelledAt}/${totalGroups}`);
            return { handled: true, response: "broadcast cancelled" };
        }

        await client.sendText(adminChatId, `✅ *Broadcast selesai!*\n\n✓ Berhasil: ${successCount}\n✗ Gagal: ${failCount}\n📊 Total: ${totalGroups} grup`);
        return { handled: true, response: `broadcast sent to ${successCount} groups` };
    } catch (error: any) {
        broadcastInProgress = false;
        await client.sendText(adminChatId, `❌ Error: ${error.message}`);
        return { handled: true, error: error.message };
    }
}
/**
 * Handle sticker creation from image - FAST VERSION
 * Downloads → Converts to WebP 512x512 → Sends sticker
 */
async function handleStickerCommand(client: GowaClient, chatId: string, payload: MessagePayload): Promise<CommandResult> {

    try {
        const mediaUrl = payload.mediaUrl || payload.quotedMsg?.mediaUrl;
        const mimetype = payload.mimetype || payload.quotedMsg?.mimetype || "";

        if (!mediaUrl) {
            await client.sendText(chatId, "❌ Kirim gambar dengan /sticker");
            return { handled: true, error: "no media" };
        }

        if (!mimetype.startsWith("image/")) {
            await client.sendText(chatId, "❌ File harus gambar");
            return { handled: true, error: "not an image" };
        }

        // Convert & send - no progress message for speed
        const sticker = await createSticker(mediaUrl);
        cleanupOldStickers(); // Async, non-blocking

        const stickerUrl = `http://localhost:3000${sticker.localUrl}`;
        await client.sendImageAsSticker(chatId, stickerUrl);

        return { handled: true, response: "sticker sent" };
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Error";
        await client.sendText(chatId, `❌ Gagal: ${msg}`);
        return { handled: true, error: msg };
    }
}

/**
 * Handle video sticker creation
 * Downloads video → Converts to GIF 512x512 → Sends as sticker
 */
async function handleVideoStickerCommand(client: GowaClient, chatId: string, payload: MessagePayload): Promise<CommandResult> {

    try {
        const mediaUrl = payload.mediaUrl || payload.quotedMsg?.mediaUrl;
        const mimetype = payload.mimetype || payload.quotedMsg?.mimetype || "";

        if (!mediaUrl) {
            await client.sendText(chatId, "❌ Kirim video dengan /vsticker");
            return { handled: true, error: "no media" };
        }

        if (!mimetype.startsWith("video/")) {
            await client.sendText(chatId, "❌ File harus video (MP4, max 6 detik)");
            return { handled: true, error: "not a video" };
        }

        // Convert video to GIF (GOWA only accepts image/GIF for stickers)
        const vsticker = await createVideoSticker(mediaUrl);
        cleanupOldVideoStickers(); // Async cleanup

        // Send GIF as sticker
        const stickerUrl = `http://localhost:3000${vsticker.localUrl}`;
        await client.sendVideoAsSticker(chatId, stickerUrl);

        return { handled: true, response: "video sticker sent" };
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Error";
        await client.sendText(chatId, `❌ Video sticker gagal: ${msg}`);
        return { handled: true, error: msg };
    }
}

import { downloadVideo, cleanupOldVideos } from "./ytdlp";

// Get the host URL for local file serving
function getLocalFileUrl(relativePath: string): string {
    // Use localhost:3000 where Next.js serves static files
    return `http://localhost:3000${relativePath}`;
}

/**
 * Handle video download from social media using yt-dlp
 * Downloads file locally then sends via localhost URL
 */
async function handleDownloadCommand(client: GowaClient, chatId: string, url: string, command: string): Promise<CommandResult> {
    try {
        if (!url) {
            await client.sendText(chatId, "❌ Masukkan URL video. Contoh: /download https://tiktok.com/...");
            return { handled: true, error: "no url" };
        }

        // Validate URL
        if (!url.startsWith("http")) {
            await client.sendText(chatId, "❌ URL tidak valid. Harus dimulai dengan http:// atau https://");
            return { handled: true, error: "invalid url" };
        }

        await client.sendText(chatId, "⏳ Mendownload video, mohon tunggu...");

        // Download video locally using yt-dlp
        const result = await downloadVideo(url);

        // Clean up old videos occasionally
        cleanupOldVideos();

        // Get localhost URL for GOWA to fetch
        const localUrl = getLocalFileUrl(result.localUrl);

        // Send the video from local server
        await client.sendVideo(chatId, localUrl, `📹 ${result.platform}\n${result.title || ""}`);
        return { handled: true, response: "video sent" };
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error("Download error:", errorMessage);
        await client.sendText(chatId, `❌ Gagal download: ${errorMessage}`);
        return { handled: true, error: errorMessage };
    }
}
