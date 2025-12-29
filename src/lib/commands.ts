/**
 * Bot Commands Handler
 * Parses and executes bot commands from messages
 */

import { GowaClient, getGowaClient } from "./gowa";
import { isAdmin } from "./adminConfig";
import { getGroupTemplates } from "./groupTemplates";

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
        const targetNumber = parts[0].replace(/\D/g, "") + "@c.us";
        const message = parts.slice(1).join(", ");
        try {
            await client.sendText(targetNumber, message);
            await client.sendText(chatId, `✅ Pesan terkirim ke ${parts[0]}`);
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

        // Set broadcast state
        broadcastInProgress = true;
        cancelBroadcast = false;

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
                    if (mimetype.startsWith("image/")) {
                        await client.sendImage(groupId, mediaUrl!, message);
                    } else if (mimetype.startsWith("video/")) {
                        await client.sendVideo(groupId, mediaUrl!, message);
                    } else {
                        await client.sendFile(groupId, mediaUrl!);
                        if (message) await client.sendText(groupId, message);
                    }
                } else {
                    await client.sendText(groupId, message);
                }
                successCount++;
            } catch (e) {
                failCount++;
            }

            // Random delay 2-5 seconds (anti-ban)
            const delay = Math.floor(Math.random() * 3000) + 2000;
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
 * Handle sticker creation from image
 */
async function handleStickerCommand(client: GowaClient, chatId: string, payload: MessagePayload): Promise<CommandResult> {
    try {
        // Check if message has media or is replying to media
        const mediaUrl = payload.mediaUrl || payload.quotedMsg?.mediaUrl;
        const mimetype = payload.mimetype || payload.quotedMsg?.mimetype || "";

        if (!mediaUrl) {
            await client.sendText(chatId, "❌ Kirim gambar dengan caption /sticker atau reply ke gambar dengan /sticker");
            return { handled: true, error: "no media" };
        }

        if (!mimetype.startsWith("image/")) {
            await client.sendText(chatId, "❌ File harus berupa gambar (PNG, JPG, WEBP)");
            return { handled: true, error: "not an image" };
        }

        await client.sendText(chatId, "⏳ Membuat sticker...");

        // GOWA: Use sendImageAsSticker which sends image with sticker=true
        await client.sendImageAsSticker(chatId, mediaUrl);
        return { handled: true, response: "sticker sent" };
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        await client.sendText(chatId, `❌ Gagal membuat sticker: ${errorMessage}`);
        return { handled: true, error: errorMessage };
    }
}

/**
 * Handle video sticker creation
 */
async function handleVideoStickerCommand(client: GowaClient, chatId: string, payload: MessagePayload): Promise<CommandResult> {
    try {
        const mediaUrl = payload.mediaUrl || payload.quotedMsg?.mediaUrl;
        const mimetype = payload.mimetype || payload.quotedMsg?.mimetype || "";

        if (!mediaUrl) {
            await client.sendText(chatId, "❌ Kirim video dengan caption /vsticker atau reply ke video dengan /vsticker");
            return { handled: true, error: "no media" };
        }

        if (!mimetype.startsWith("video/")) {
            await client.sendText(chatId, "❌ File harus berupa video (MP4, max 10 detik)");
            return { handled: true, error: "not a video" };
        }

        await client.sendText(chatId, "⏳ Membuat video sticker...");
        await client.sendVideoAsSticker(chatId, mediaUrl);
        return { handled: true, response: "video sticker sent" };
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        await client.sendText(chatId, `❌ Gagal membuat video sticker: ${errorMessage}`);
        return { handled: true, error: errorMessage };
    }
}

/**
 * Handle video download from social media
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

        // Detect platform
        const platform = detectPlatform(url);

        // Use external API for downloading
        const videoInfo = await downloadVideo(url, platform);

        if (videoInfo.error) {
            await client.sendText(chatId, `❌ Gagal download: ${videoInfo.error}`);
            return { handled: true, error: videoInfo.error };
        }

        // Send the video
        await client.sendVideo(chatId, videoInfo.url, `📹 ${platform} Video\n${videoInfo.title || ""}`);
        return { handled: true, response: "video sent" };
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        await client.sendText(chatId, `❌ Gagal download: ${errorMessage}`);
        return { handled: true, error: errorMessage };
    }
}

/**
 * Detect platform from URL
 */
function detectPlatform(url: string): string {
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes("tiktok.com") || lowerUrl.includes("vm.tiktok")) return "TikTok";
    if (lowerUrl.includes("instagram.com")) return "Instagram";
    if (lowerUrl.includes("youtube.com") || lowerUrl.includes("youtu.be")) return "YouTube";
    if (lowerUrl.includes("twitter.com") || lowerUrl.includes("x.com")) return "Twitter";
    if (lowerUrl.includes("facebook.com") || lowerUrl.includes("fb.watch")) return "Facebook";
    return "Unknown";
}

/**
 * Download video using external API
 */
async function downloadVideo(url: string, platform: string): Promise<{ url: string; title?: string; error?: string }> {
    try {
        // Use a multi-platform video downloader API
        // You can replace this with your preferred API service
        const apiUrl = `https://api.cobalt.tools/api/json`;

        const response = await fetch(apiUrl, {
            method: "POST",
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                url: url,
                vCodec: "h264",
                vQuality: "720",
                aFormat: "mp3",
                filenamePattern: "basic",
                isAudioOnly: false,
                disableMetadata: false,
            })
        });

        if (!response.ok) {
            throw new Error(`API returned ${response.status}`);
        }

        const data = await response.json();

        if (data.status === "error") {
            return { url: "", error: data.text || "Download failed" };
        }

        if (data.status === "redirect" || data.status === "stream") {
            return { url: data.url, title: data.filename || "" };
        }

        if (data.status === "picker" && data.picker && data.picker.length > 0) {
            // Multiple options, return first video
            return { url: data.picker[0].url, title: "" };
        }

        return { url: "", error: "No video found" };
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error("Download error:", error);
        return { url: "", error: errorMessage };
    }
}
