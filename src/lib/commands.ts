/**
 * Bot Commands Handler
 * Parses and executes bot commands from messages
 */

import { GowaClient, getGowaClient } from "./gowa";
import { isAdmin } from "./adminConfig";
import { getGroupTemplates } from "./groupTemplates";
import { getBroadcastTemplates, addBroadcastTemplate, deleteBroadcastTemplate, getBroadcastTemplateByName, updateBroadcastTemplate } from "./broadcastTemplates";
// Pre-import for speed (avoid dynamic import delay)
import { createSticker, cleanupOldStickers } from "./sticker";
import { createVideoSticker, cleanupOldVideoStickers } from "./vsticker";
import { getRandomDelay, setDelay, getBroadcastConfig } from "./broadcastConfig";
import { startAutoBroadcast, stopAutoBroadcast, getAutoBroadcastStatus } from "./autoBroadcast";
import { convertImageForBroadcast, cleanupOldBroadcastMedia } from "./broadcastMedia";
import { stickerToImage, videoToMp3 } from "./mediaTools";

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
    participant?: string;
    body: string;
    hasMedia?: boolean;
    mediaUrl?: string;
    mimetype?: string;
    quotedMsg?: {
        id?: string;
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
    ADMIN_SAVEBC: ["/svbc", "/simpanbc"],
    ADMIN_LOADBC: ["/listbc", "/daftarbc"],
    ADMIN_EDITBC: ["/editbc", "/ebc"],
    ADMIN_AUTOBC: ["/autobc", "/abc"],
    ADMIN_STOP_AUTOBC: ["/stopautobc", "/sabc"],
    ADMIN_STATUS_AUTOBC: ["/statusautobc", "/stabc"],
    // AI Query (available to everyone)
    AI_QUERY: ["/ai"],
    // Useful tools
    TAGALL: ["/tagall", "/hidetag", "/all", ".tagall"],
    TOIMG: ["/toimg", "/toimage", ".toimg"],
    TOMP3: ["/tomp3", "/mp3", ".tomp3"],
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

        let helpText = `╭━━━  *BOT MENU*  ━━━╮
┃  🤖 *AI Assistant*
┃  📸 *Media Tools*
┃  🛠️ *Utilities*
╰━━━━━━━━━━━━━━━━╯

✨ *FITUR PUBLIK*
📸 */sticker* » Gambar ke Sticker
🎬 */vsticker* » Video ke Sticker (Gerak)
⬇️ */download* [url] » Download Sosmed
🧠 */ai* [tanya] » Tanya AI Pintar
🏓 */ping* » Cek Status Bot`;

        if (senderIsAdmin) {
            helpText += `

╭━━━  *ADMIN PANEL*  ━━━╮
📢 */bc* [nama] » Kirim Broadcast
📝 */svbc* » Simpan Template BC
📋 */listbc* » List Template BC
✏️ */editbc* » Edit Template BC
🤖 */autobc* [tpl] [min] [max] » Auto BC
🛑 */stopautobc* » Stop Auto BC
📊 */statusautobc* » Status Auto BC
💾 */templates* » List Group Template
👥 */groups* » List Semua Grup
🛑 */cancel* » Stop Broadcast
⚙️ */setdelay* » Atur Jeda
🔄 */aitoggle* » AI On/Off
📨 */send* [no], [pesan]
╰━━━━━━━━━━━━━━━━━╯`;
        }

        helpText += `

_💡 Ketik command untuk memulai_`;

        await client.sendText(chatId, helpText);
        return { handled: true, response: "help sent" };
    }

    // Ping command (public)
    if (COMMANDS.ADMIN_PING.includes(command)) {
        const uptime = process.uptime();
        const uptimeStr = new Date(uptime * 1000).toISOString().substr(11, 8);

        const pongText = `╭───  *SYSTEM STATUS*  ───╮
│
│  🟢 *ONLINE*
│  ⚡ *Speed:* _Fast_
│  ⏱️ *Uptime:* _${uptimeStr}_
│  📅 *Server Time:*
│  _${new Date().toLocaleString('id-ID')}_
│
╰─────────────────────╯`;
        await client.sendText(chatId, pongText);
        return { handled: true, response: "pong" };
    }

    // AI Query command (public) - /ai <question>
    if (COMMANDS.AI_QUERY.includes(command)) {
        if (!args) {
            await client.sendText(chatId, `╭──  *AI ASSISTANT*  ──╮
│
│  ❌ *Pertanyaan Kosong!*
│
│  _Contoh penggunaan:_
│  */ai apa itu koding?*
│
╰────────────────────╯`);
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

    // Tag All (Hidetag)
    if (COMMANDS.TAGALL.includes(command)) {
        return await handleTagAll(client, chatId, args, payload);
    }

    // Sticker to Image
    if (COMMANDS.TOIMG.includes(command)) {
        return await handleToImg(client, chatId, payload);
    }

    // Video to MP3
    if (COMMANDS.TOMP3.includes(command)) {
        return await handleToMp3(client, chatId, payload);
    }

    // === ADMIN COMMANDS ===
    // Check if sender is admin for admin-only commands
    const senderIsAdmin = isAdmin(chatId);

    // Admin: Status command
    if (COMMANDS.ADMIN_STATUS.includes(command)) {
        if (!senderIsAdmin) {
            return { handled: false };
        }
        const templates = getGroupTemplates();
        const memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024;

        const statusText = `╭━━━  *DASHBOARD*  ━━━╮
│
│  📊 *STATISTICS*
│  • Status: 🟢 _Active_
│  • Templates: _${templates.length}_
│  • Memory: _${memoryUsage.toFixed(1)} MB_
│  • Mode: _Admin Access_
│
│  🛠 *QUICK ACTIONS*
│  • /broadcast
│  • /templates
│  • /groups
│
╰━━━━━━━━━━━━━━━━━╯`;

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
            await client.sendText(chatId, "❌ *Tidak Ada Template*\n\n_Buat template di Dashboard → Broadcast atau Groups._");
            return { handled: true, response: "no templates" };
        }

        const templateList = templates.map((t, i) =>
            `│ ${i + 1}. *${t.name}* (${t.groupIds.length} grup)`
        ).join("\n");

        await client.sendText(chatId, `╭━━━  *DAFTAR TEMPLATE*  ━━━╮
│
${templateList}
│
│  _Gunakan:_
│  */broadcast <nama>, <pesan>*
│
╰━━━━━━━━━━━━━━━━━━╯`);
        return { handled: true, response: "templates listed" };
    }

    // Admin: List groups command
    if (COMMANDS.ADMIN_GROUPS.includes(command)) {
        if (!senderIsAdmin) return { handled: false };
        try {
            const groups = await client.getGroups();
            if (!groups || groups.length === 0) {
                await client.sendText(chatId, "❌ *Tidak Ada Grup*\n\n_Bot belum terhubung ke grup manapun._");
                return { handled: true, response: "no groups" };
            }
            const groupList = groups.slice(0, 15).map((g: any, i: number) =>
                `│ ${i + 1}. ${g.subject || g.name || g.id}`
            ).join("\n");

            await client.sendText(chatId, `╭━━━  *DAFTAR GRUP*  ━━━╮
│  Total: ${groups.length} Grup
│
${groupList}
${groups.length > 15 ? `│  _... dan ${groups.length - 15} lainnya_` : ""}
│
╰━━━━━━━━━━━━━━━━╯`);
            return { handled: true, response: "groups listed" };
        } catch (e) {
            await client.sendText(chatId, "❌ *Gagal mengambil data grup*");
            return { handled: true, error: "failed to get groups" };
        }
    }

    // Admin: Contacts info
    if (COMMANDS.ADMIN_CONTACTS.includes(command)) {
        if (!senderIsAdmin) return { handled: false };
        try {
            const contacts = await client.getContacts();
            await client.sendText(chatId, `╭───  *INFO KONTAK*  ───╮
│
│  📇 *Total Kontak:*
│  _${contacts?.length || 0} Kontak tersimpan_
│
╰───────────────────╯`);
            return { handled: true, response: "contacts info" };
        } catch (e) {
            await client.sendText(chatId, "❌ *Gagal mengambil data kontak*");
            return { handled: true, error: "failed" };
        }
    }

    // Admin: Send to number
    if (COMMANDS.ADMIN_SEND.includes(command)) {
        if (!senderIsAdmin) return { handled: false };
        const parts = parseArgs(args);
        if (parts.length < 2) {
            await client.sendText(chatId, "❌ *Format Salah*\n\n_Contoh: /send 628123456789, Halo!_");
            return { handled: true, error: "invalid format" };
        }
        // GOWA uses plain phone number without @c.us
        const targetNumber = parts[0].replace(/\D/g, "");
        const message = parts.slice(1).join(", ");
        if (!targetNumber || targetNumber.length < 10) {
            await client.sendText(chatId, "❌ *Nomor Tidak Valid*\n_Gunakan format internasional: 628xxx_");
            return { handled: true, error: "invalid number" };
        }
        try {
            await client.sendText(targetNumber, message);
            await client.sendText(chatId, `✅ *PESAN TERKIRIM*\nTujuan: ${targetNumber}`);
            return { handled: true, response: "sent" };
        } catch (e: any) {
            await client.sendText(chatId, `❌ *Gagal Kirim*\nError: ${e.message}`);
            return { handled: true, error: e.message };
        }
    }

    // Admin: Send to group
    if (COMMANDS.ADMIN_SENDGROUP.includes(command)) {
        if (!senderIsAdmin) return { handled: false };
        const parts = parseArgs(args);
        if (parts.length < 2) {
            await client.sendText(chatId, "❌ *Format Salah*\n\n_Contoh: /sendgroup 120363xxx@g.us, Halo grup!_");
            return { handled: true, error: "invalid format" };
        }
        const groupId = parts[0];
        const message = parts.slice(1).join(", ");
        try {
            await client.sendText(groupId, message);
            await client.sendText(chatId, `✅ *PESAN TERKIRIM KE GRUP*`);
            return { handled: true, response: "sent to group" };
        } catch (e: any) {
            await client.sendText(chatId, `❌ *Gagal Kirim*\nError: ${e.message}`);
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
            await client.sendText(chatId, `╭━━━  *AI CONFIG*  ━━━╮
│
│  Status: ${newState ? "🟢 *AKTIF*" : "🔴 *NONAKTIF*"}
│
╰━━━━━━━━━━━━━━━━━╯`);
            return { handled: true, response: `ai ${newState ? "enabled" : "disabled"}` };
        } catch (e: any) {
            await client.sendText(chatId, `❌ *Gagal Setting AI*\nError: ${e.message}`);
            return { handled: true, error: e.message };
        }
    }

    // Admin: Broadcast command
    if (COMMANDS.ADMIN_BROADCAST.includes(command)) {
        if (!senderIsAdmin) {
            await client.sendText(chatId, "❌ *Admin Only*\n\n_Command ini hanya untuk admin._");
            return { handled: true, error: "not admin" };
        }
        return await handleAdminBroadcast(client, chatId, args, payload);
    }

    // Admin: Cancel broadcast
    if (COMMANDS.ADMIN_CANCEL.includes(command)) {
        if (!senderIsAdmin) return { handled: false };
        if (broadcastInProgress) {
            cancelBroadcast = true;
            await client.sendText(chatId, "🛑 *Membatalkan broadcast...*\n\n_Menunggu proses saat ini selesai..._");
            return { handled: true, response: "cancel requested" };
        } else {
            await client.sendText(chatId, "⚠️ *Tidak ada broadcast yang berjalan*");
            return { handled: true, error: "no broadcast" };
        }
    }

    // Admin: Set delay - /setdelay min max (in seconds)
    // Example: /setdelay 3 5 = random delay between 3000ms-5000ms
    if (COMMANDS.ADMIN_SETDELAY.includes(command)) {
        if (!senderIsAdmin) return { handled: false };

        const parts = args.trim().split(/\s+/).map(p => parseFloat(p));

        // Validate input
        if (parts.length < 1 || parts.length > 2 || parts.some(isNaN)) {
            const config = getBroadcastConfig();
            const currentMin = (config.minDelay / 1000).toFixed(1);
            const currentMax = (config.maxDelay / 1000).toFixed(1);

            await client.sendText(chatId, `╭───  ⏱️ *SET DELAY*  ───╮
│
│  📌 *Format:*
│  /setdelay <min> <max>
│
│  📋 *Contoh:*
│  /setdelay 3 5
│  _(delay random 3-5 detik)_
│
│  ⚙️ *Delay Saat Ini:*
│  _${currentMin}s - ${currentMax}s_
│
╰────────────────────╯`);
            return { handled: true, error: "invalid format" };
        }

        let minSec = parts[0];
        let maxSec = parts.length === 2 ? parts[1] : minSec + 2; // Default: min + 2 seconds

        // Ensure min < max
        if (minSec > maxSec) {
            [minSec, maxSec] = [maxSec, minSec];
        }

        // Validate range (0.5s to 60s)
        if (minSec < 0.5 || maxSec > 60) {
            await client.sendText(chatId, "❌ *Range Tidak Valid*\n\n_Delay harus antara 0.5 - 60 detik_");
            return { handled: true, error: "invalid range" };
        }

        setDelay(minSec, maxSec);

        await client.sendText(chatId, `╭───  ✅ *DELAY DIATUR*  ───╮
│
│  ⏱️ *Broadcast Delay:*
│  _Random ${minSec}s - ${maxSec}s_
│
│  💡 *Info:*
│  _Setiap pesan ke grup akan
│  dijeda random sesuai setting_
│
╰─────────────────────╯`);
        return { handled: true, response: `delay set to ${minSec}s-${maxSec}s` };
    }

    // Admin: Save broadcast template - /svbc <nama>, <group_template>, <pesan>
    if (COMMANDS.ADMIN_SAVEBC.includes(command)) {
        if (!senderIsAdmin) return { handled: false };

        const parts = args.split(",").map(a => a.trim());
        if (parts.length < 3 || !parts[0] || !parts[1] || !parts[2]) {
            await client.sendText(chatId, `╭───  📝 *SIMPAN BROADCAST*  ───╮
│
│  📌 *Format:*
│  /svbc <nama>, <group_tpl>, <pesan>
│
│  📋 *Contoh:*
│  /svbc promo, marketing, Halo! Promo
│
│  💡 *Tips:*
│  _Kirim dengan gambar/video_
│  _untuk simpan template media_
│
│  📂 *Lihat Group Template:*
│  _Ketik /templates_
│
╰────────────────────────────╯`);
            return { handled: true, error: "invalid format" };
        }

        const templateName = parts[0];
        const groupTemplateName = parts[1];
        const message = parts.slice(2).join(", ");

        // Check if group template exists
        const groupTemplates = getGroupTemplates();
        const groupTemplate = groupTemplates.find(t =>
            t.name.toLowerCase() === groupTemplateName.toLowerCase() ||
            t.name.toLowerCase().includes(groupTemplateName.toLowerCase())
        );

        if (!groupTemplate) {
            const available = groupTemplates.map(t => t.name).join(", ") || "tidak ada";
            await client.sendText(chatId, `❌ *Group Template Tidak Ditemukan*\n\nTemplate tersedia:\n${available}\n\n_Buat group template di Dashboard → Groups_`);
            return { handled: true, error: "group template not found" };
        }

        // Check for media
        const mediaUrl = payload.mediaUrl || payload.quotedMsg?.mediaUrl;
        const mimetype = payload.mimetype || payload.quotedMsg?.mimetype || "";
        let mediaType: "text" | "image" | "video" | "file" = "text";

        if (mediaUrl) {
            if (mimetype.startsWith("image/")) mediaType = "image";
            else if (mimetype.startsWith("video/")) mediaType = "video";
            else mediaType = "file";
        }

        // Check if template with same name exists
        const existing = getBroadcastTemplateByName(templateName);
        if (existing) {
            await client.sendText(chatId, `❌ *Template Sudah Ada*\n\n_Template "${templateName}" sudah tersimpan._\n_Hapus dulu dengan /listbc ${templateName}_`);
            return { handled: true, error: "template exists" };
        }

        // Check for ghost mention flag (4th argument or keyword in message)
        // Format: /svbc nama, group, pesan, ghost
        const lastPart = parts.length >= 4 ? parts[parts.length - 1].toLowerCase() : "";
        const ghostMention = ["ghost", "ghostmention", "mention", "everyone", "tag"].includes(lastPart);
        // If last part is a ghost flag, remove it from the message
        const finalMessage = ghostMention && parts.length >= 4 ? parts.slice(2, -1).join(", ") : message;

        // Save template with group template reference
        const newTemplate = addBroadcastTemplate(templateName, groupTemplate.name, finalMessage, mediaType, mediaUrl, ghostMention);

        const mediaInfo = mediaType !== "text" ? `\n│  📎 *Media:* ${mediaType}` : "";
        const ghostInfo = ghostMention ? `\n│  👻 *Ghost Mention:* ON` : "";
        await client.sendText(chatId, `╭───  ✅ *TEMPLATE TERSIMPAN*  ───╮
│
│  📝 *Nama:* ${newTemplate.name}
│  👥 *Target:* ${groupTemplate.name} (${groupTemplate.groupIds.length} grup)
│  💬 *Pesan:* _${finalMessage.substring(0, 40)}${finalMessage.length > 40 ? "..." : ""}_${mediaInfo}${ghostInfo}
│
│  🚀 *Cara Pakai:*
│  */bc ${templateName}*
│
╰─────────────────────────────╯`);
        return { handled: true, response: "template saved" };
    }

    // Admin: Load/List broadcast message templates - /loadbc [nama_hapus]
    if (COMMANDS.ADMIN_LOADBC.includes(command)) {
        if (!senderIsAdmin) return { handled: false };

        const templates = getBroadcastTemplates();

        // If args provided, try to delete that template
        if (args) {
            const templateToDelete = templates.find(t =>
                t.name.toLowerCase() === args.toLowerCase() ||
                t.id === args
            );

            if (templateToDelete) {
                deleteBroadcastTemplate(templateToDelete.id);
                await client.sendText(chatId, `✅ *Template Dihapus*\n\n_"${templateToDelete.name}" berhasil dihapus._`);
                return { handled: true, response: "template deleted" };
            } else {
                await client.sendText(chatId, `❌ *Template Tidak Ditemukan*\n\n_"${args}" tidak ada dalam daftar._`);
                return { handled: true, error: "template not found" };
            }
        }

        // List all templates
        if (templates.length === 0) {
            await client.sendText(chatId, `╭───  📋 *BROADCAST TEMPLATES*  ───╮
│
│  📭 *Belum Ada Template*
│
│  _Simpan template baru dengan:_
│  */savebc <nama>, <pesan>*
│
╰──────────────────────────╯`);
            return { handled: true, response: "no templates" };
        }

        const templateList = templates.map((t, i) => {
            const mediaIcon = t.mediaType === "image" ? "🖼️" : t.mediaType === "video" ? "🎬" : t.mediaType === "file" ? "📎" : "📝";
            return `│ ${i + 1}. ${mediaIcon} *${t.name}* → ${t.groupTemplateName}\n│    _${t.message.substring(0, 25)}${t.message.length > 25 ? "..." : ""}_`;
        }).join("\n");

        await client.sendText(chatId, `╭───  📋 *BROADCAST TEMPLATES*  ───╮
│
${templateList}
│
│  🚀 *Kirim Broadcast:*
│  /bc <nama>
│
│  🗑️ *Hapus Template:*
│  /listbc <nama>
│
│  📝 *Tambah Template:*
│  /svbc <nama>, <group>, <pesan>
│
│  ✏️ *Edit Template:*
│  /editbc <nama>, <field>, <value>
│
╰──────────────────────────────╯`);
        return { handled: true, response: "templates listed" };
    }

    // Admin: Edit broadcast template - /editbc <nama>, <field>, <value>
    // Fields: message, group, media
    if (COMMANDS.ADMIN_EDITBC.includes(command)) {
        if (!senderIsAdmin) return { handled: false };

        if (!args.trim()) {
            const bcTemplates = getBroadcastTemplates();
            const templateList = bcTemplates.length > 0
                ? bcTemplates.map(t => `│  • *${t.name}* → ${t.groupTemplateName}`).join("\n")
                : "│  _Belum ada template_";

            await client.sendText(chatId, `╭───  ✏️ *EDIT BROADCAST*  ───╮
│
│  📌 *Format:*
│  /editbc <nama>, <field>, <value>
│
│  📋 *Field yang bisa diedit:*
│  • *message* — ubah pesan
│  • *group* — ubah group template
│  • *name* — ubah nama template
│
│  📋 *Contoh:*
│  /editbc promo, message, Halo promo baru!
│  /editbc promo, group, VAPE2
│  /editbc promo, name, promo_baru
│
│  💡 *Edit media:*
│  _Kirim gambar/video dengan caption:_
│  /editbc promo, media
│
│  📂 *Template Tersedia:*
${templateList}
│
╰────────────────────────────╯`);
            return { handled: true, error: "no args" };
        }

        const parts = args.split(",").map(a => a.trim());
        const templateName = parts[0];
        const field = parts.length >= 2 ? parts[1].toLowerCase() : "";
        const value = parts.length >= 3 ? parts.slice(2).join(", ") : "";

        if (!templateName) {
            await client.sendText(chatId, "❌ *Nama template diperlukan*\n\n_Contoh: /editbc promo, message, Pesan baru_");
            return { handled: true, error: "no template name" };
        }

        // Find template
        const template = getBroadcastTemplateByName(templateName);
        if (!template) {
            await client.sendText(chatId, `❌ *Template "${templateName}" tidak ditemukan*\n\n_Cek daftar: /listbc_`);
            return { handled: true, error: "template not found" };
        }

        if (!field) {
            // Show current template details
            const mediaInfo = template.mediaType !== "text" ? `\n│  📎 *Media:* ${template.mediaType}\n│  🔗 _${template.mediaUrl?.substring(0, 40)}..._` : "";
            await client.sendText(chatId, `╭───  📋 *DETAIL TEMPLATE*  ───╮
│
│  📝 *Nama:* ${template.name}
│  👥 *Group:* ${template.groupTemplateName}
│  💬 *Pesan:*
│  _${template.message}_${mediaInfo}
│
│  ✏️ *Edit:*
│  /editbc ${template.name}, message, <pesan baru>
│  /editbc ${template.name}, group, <group baru>
│  /editbc ${template.name}, name, <nama baru>
│
╰───────────────────────────╯`);
            return { handled: true, response: "template detail" };
        }

        // Edit based on field
        switch (field) {
            case "message":
            case "msg":
            case "pesan": {
                if (!value) {
                    await client.sendText(chatId, "❌ *Pesan baru diperlukan*\n\n_Contoh: /editbc promo, message, Pesan baru disini_");
                    return { handled: true, error: "no value" };
                }
                const updated = updateBroadcastTemplate(template.id, { message: value });
                await client.sendText(chatId, `✅ *Pesan Template Diupdate*\n\n📝 *${template.name}*\n💬 _${value.substring(0, 60)}${value.length > 60 ? "..." : ""}_`);
                return { handled: true, response: "message updated" };
            }

            case "group":
            case "grp":
            case "grup": {
                if (!value) {
                    await client.sendText(chatId, "❌ *Nama group template diperlukan*\n\n_Contoh: /editbc promo, group, VAPE2_");
                    return { handled: true, error: "no value" };
                }
                // Validate group template exists
                const groupTemplates = getGroupTemplates();
                const grpTemplate = groupTemplates.find(t =>
                    t.name.toLowerCase() === value.toLowerCase() ||
                    t.name.toLowerCase().includes(value.toLowerCase())
                );
                if (!grpTemplate) {
                    const available = groupTemplates.map(t => t.name).join(", ") || "tidak ada";
                    await client.sendText(chatId, `❌ *Group Template Tidak Ditemukan*\n\nTersedia: ${available}`);
                    return { handled: true, error: "group template not found" };
                }
                updateBroadcastTemplate(template.id, { groupTemplateName: grpTemplate.name });
                await client.sendText(chatId, `✅ *Group Template Diupdate*\n\n📝 *${template.name}*\n👥 Target: _${grpTemplate.name}_ (${grpTemplate.groupIds.length} grup)`);
                return { handled: true, response: "group updated" };
            }

            case "name":
            case "nama": {
                if (!value) {
                    await client.sendText(chatId, "❌ *Nama baru diperlukan*\n\n_Contoh: /editbc promo, name, promo_baru_");
                    return { handled: true, error: "no value" };
                }
                // Check if name already taken
                const existing = getBroadcastTemplateByName(value);
                if (existing && existing.id !== template.id) {
                    await client.sendText(chatId, `❌ *Nama "${value}" sudah dipakai*`);
                    return { handled: true, error: "name taken" };
                }
                updateBroadcastTemplate(template.id, { name: value });
                await client.sendText(chatId, `✅ *Nama Template Diupdate*\n\n_${template.name}_ → *${value}*`);
                return { handled: true, response: "name updated" };
            }

            case "media": {
                // Update media from attached image/video
                const mediaUrl = payload.mediaUrl || payload.quotedMsg?.mediaUrl;
                const mimetype = payload.mimetype || payload.quotedMsg?.mimetype || "";

                if (!mediaUrl) {
                    await client.sendText(chatId, "❌ *Kirim gambar/video bersama command*\n\n_Contoh: kirim gambar dengan caption:_\n/editbc promo, media");
                    return { handled: true, error: "no media" };
                }

                let mediaType: "image" | "video" | "file" = "file";
                if (mimetype.startsWith("image/")) mediaType = "image";
                else if (mimetype.startsWith("video/")) mediaType = "video";

                updateBroadcastTemplate(template.id, { mediaType, mediaUrl });
                await client.sendText(chatId, `✅ *Media Template Diupdate*\n\n📝 *${template.name}*\n📎 Media: _${mediaType}_`);
                return { handled: true, response: "media updated" };
            }

            case "nomedia":
            case "hapusmedia": {
                updateBroadcastTemplate(template.id, { mediaType: "text", mediaUrl: undefined });
                await client.sendText(chatId, `✅ *Media Dihapus*\n\n📝 *${template.name}* sekarang text only`);
                return { handled: true, response: "media removed" };
            }

            case "ghost":
            case "ghostmention":
            case "mention":
            case "tag": {
                const newGhostState = !(template.ghostMention ?? false);
                updateBroadcastTemplate(template.id, { ghostMention: newGhostState });
                await client.sendText(chatId, `✅ *Ghost Mention ${newGhostState ? "ON 👻" : "OFF"}*\n\n📝 *${template.name}*\n_${newGhostState ? "Semua member akan di-tag saat broadcast" : "Broadcast tanpa tag"}_`);
                return { handled: true, response: `ghost mention ${newGhostState ? "on" : "off"}` };
            }

            default:
                await client.sendText(chatId, `❌ *Field "${field}" tidak dikenal*\n\n_Field: message, group, name, media, nomedia, ghost_`);
                return { handled: true, error: "unknown field" };
        }
    }

    // Admin: Auto Broadcast - /autobc <template_name> [min_interval] [max_interval]
    if (COMMANDS.ADMIN_AUTOBC.includes(command)) {
        if (!senderIsAdmin) return { handled: false };

        if (!args.trim()) {
            // Show help
            const bcTemplates = getBroadcastTemplates();
            const templateList = bcTemplates.length > 0
                ? bcTemplates.map(t => `│  • *${t.name}* → ${t.groupTemplateName}`).join("\n")
                : "│  _Belum ada template_";

            await client.sendText(chatId, `╭───  🤖 *AUTO BROADCAST*  ───╮
│
│  📌 *Format:*
│  /autobc <template> [min] [max]
│
│  📋 *Contoh:*
│  /autobc promo 60 80
│  _(broadcast setiap 60-80 menit)_
│
│  /autobc promo
│  _(default: 60-80 menit)_
│
│  📂 *Template Tersedia:*
${templateList}
│
│  💡 *Tips:*
│  _Bisa pakai beberapa template_
│  _dipisah koma untuk rotasi:_
│  /autobc promo1,promo2 60 80
│
╰────────────────────────────╯`);
            return { handled: true, error: "no args" };
        }

        // Parse args: <template_names> [min] [max]
        const parts = args.trim().split(/\s+/);
        const templateNamesRaw = parts[0];
        const minInterval = parts.length >= 2 ? parseFloat(parts[1]) : 60;
        const maxInterval = parts.length >= 3 ? parseFloat(parts[2]) : (parts.length >= 2 ? parseFloat(parts[1]) + 20 : 80);

        // Support comma-separated template names for rotation
        const templateNames = templateNamesRaw.split(",").map(n => n.trim()).filter(Boolean);

        // Validate templates exist
        const invalidTemplates: string[] = [];
        for (const name of templateNames) {
            const tmpl = getBroadcastTemplateByName(name);
            if (!tmpl) invalidTemplates.push(name);
        }

        if (invalidTemplates.length > 0) {
            await client.sendText(chatId, `❌ *Template Tidak Ditemukan:*\n${invalidTemplates.join(", ")}\n\n_Cek daftar template: /listbc_`);
            return { handled: true, error: "template not found" };
        }

        // Validate intervals
        if (isNaN(minInterval) || isNaN(maxInterval) || minInterval < 1 || maxInterval < 1) {
            await client.sendText(chatId, "❌ *Interval tidak valid*\n\n_Minimum 1 menit_");
            return { handled: true, error: "invalid interval" };
        }

        let finalMin = Math.min(minInterval, maxInterval);
        let finalMax = Math.max(minInterval, maxInterval);

        // Start auto broadcast
        const config = startAutoBroadcast(templateNames, finalMin, finalMax);

        const templateListStr = templateNames.map(n => `│  • *${n}*`).join("\n");
        await client.sendText(chatId, `╭━━━  ✅ *AUTO BC AKTIF*  ━━━╮
│
│  📋 *Template:*
${templateListStr}
│
│  ⏱️ *Interval:*
│  _Random ${finalMin}-${finalMax} menit_
│
│  🔄 *Mode:* ${templateNames.length > 1 ? "Rotasi" : "Single"}
│
│  📊 *Cek Status:* /statusautobc
│  🛑 *Stop:* /stopautobc
│
╰━━━━━━━━━━━━━━━━━━━━╯`);
        return { handled: true, response: "auto broadcast started" };
    }

    // Admin: Stop Auto Broadcast
    if (COMMANDS.ADMIN_STOP_AUTOBC.includes(command)) {
        if (!senderIsAdmin) return { handled: false };

        const status = getAutoBroadcastStatus();
        if (!status.isRunning && !status.config.enabled) {
            await client.sendText(chatId, "⚠️ *Auto broadcast tidak aktif*");
            return { handled: true, error: "not running" };
        }

        const config = stopAutoBroadcast();

        await client.sendText(chatId, `╭━━━  🛑 *AUTO BC DIHENTIKAN*  ━━━╮
│
│  📊 *Total Sesi:* ${config.totalSent}
│  ⏱️ *Terakhir:*
│  _${config.lastBroadcastAt ? new Date(config.lastBroadcastAt).toLocaleString("id-ID") : "Belum pernah"}_
│
╰━━━━━━━━━━━━━━━━━━━━━━╯`);
        return { handled: true, response: "auto broadcast stopped" };
    }

    // Admin: Status Auto Broadcast
    if (COMMANDS.ADMIN_STATUS_AUTOBC.includes(command)) {
        if (!senderIsAdmin) return { handled: false };

        const status = getAutoBroadcastStatus();
        const cfg = status.config;

        const statusIcon = status.isRunning ? "🟢" : "🔴";
        const statusText = status.isRunning ? "AKTIF" : "NONAKTIF";
        const executingText = status.isExecuting ? "\n│  ⚡ _Sedang mengirim broadcast..._" : "";

        const templateList = cfg.templateNames.length > 0
            ? cfg.templateNames.map((n, i) => `│  ${i === cfg.currentIndex ? "▶" : "  "} ${n}`).join("\n")
            : "│  _Belum ada template_";

        const lastBC = cfg.lastBroadcastAt
            ? new Date(cfg.lastBroadcastAt).toLocaleString("id-ID")
            : "Belum pernah";

        const nextBC = status.nextIn || "-";

        await client.sendText(chatId, `╭━━━  📊 *AUTO BC STATUS*  ━━━╮
│
│  ${statusIcon} *Status:* ${statusText}${executingText}
│
│  📋 *Templates:*
${templateList}
│
│  ⏱️ *Interval:* ${cfg.minIntervalMinutes}-${cfg.maxIntervalMinutes} menit
│  📡 *Total Sent:* ${cfg.totalSent} sesi
│  🕐 *Terakhir:* ${lastBC}
│  ⏳ *Berikutnya:* ${nextBC}
│
│  🤖 */autobc* - mulai
│  🛑 */stopautobc* - stop
│
╰━━━━━━━━━━━━━━━━━━━━━╯`);
        return { handled: true, response: "auto broadcast status" };
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
            await client.sendText(chatId, "🤖 *AI sedang istirahat*\n\n_Silakan hubungi admin untuk mengaktifkan._");
            return { handled: true, error: "AI disabled" };
        }

        // Send typing indicator
        await client.sendText(chatId, "🧠 _Sedang berpikir..._");

        const aiResponse = await generateAIResponse(question);

        // Format stylish response
        const emojis = ["✨", "💡", "🎯", "🔮", "⚡", "🌟", "💫", "🚀"];
        const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];

        const styledResponse = `╭━━━  ${randomEmoji} *AI ASSISTANT*  ━━━╮
│
📝 *Pertanyaan:*
_${question}_
━━━━━━━━━━━━━━━━━━━━
💬 *Jawaban:*
${aiResponse}
━━━━━━━━━━━━━━━━━━━━
🤖 _Powered by Groq AI_
╰━━━━━━━━━━━━━━━━━━━╯`;

        await client.sendText(chatId, styledResponse);
        return { handled: true, response: "ai response sent" };
    } catch (error: any) {
        await client.sendText(chatId, `❌ *AI Error*\n${error.message}\n\n_Silakan coba lagi nanti._`);
        return { handled: true, error: error.message };
    }
}

/**
 * Handle admin broadcast command
 * Usage: /bc <saved_template_name> OR /broadcast <group_template>, <message>
 * Supports media: send image/video with caption
 */
async function handleAdminBroadcast(client: GowaClient, adminChatId: string, args: string, payload: MessagePayload): Promise<CommandResult> {
    try {
        // Check if already broadcasting
        if (broadcastInProgress) {
            await client.sendText(adminChatId, "⚠️ *BROADCAST SEDANG BERJALAN*\n\n_Gunakan /cancel untuk membatalkan._");
            return { handled: true, error: "broadcast in progress" };
        }

        // FIRST: Check if args is a saved broadcast template name (one-command broadcast)
        const savedTemplate = getBroadcastTemplateByName(args.trim());

        let templateName: string;
        let message: string;
        let mediaUrl: string | undefined;
        let mimetype: string;
        let hasMedia: boolean;

        if (savedTemplate) {
            // Use saved broadcast template
            templateName = savedTemplate.groupTemplateName;
            message = savedTemplate.message;
            mediaUrl = savedTemplate.mediaUrl;
            mimetype = savedTemplate.mediaType === "image" ? "image/jpeg" :
                savedTemplate.mediaType === "video" ? "video/mp4" :
                    savedTemplate.mediaType === "file" ? "application/octet-stream" : "";
            hasMedia = savedTemplate.mediaType !== "text" && !!savedTemplate.mediaUrl;

            await client.sendText(adminChatId, `📡 *Menggunakan template:* ${savedTemplate.name}\n_Target: ${templateName}_`);
        } else {
            // Parse template name and message (comma separated) - legacy format
            const parts = args.split(",").map(a => a.trim());
            if (parts.length < 2 || !parts[0] || !parts[1]) {
                // Show help with both formats
                const savedTemplates = getBroadcastTemplates();
                const savedList = savedTemplates.length > 0
                    ? `\n\n📋 *Template Tersimpan:*\n${savedTemplates.map(t => `• ${t.name}`).join("\n")}`
                    : "";
                await client.sendText(adminChatId, `╭───  📢 *BROADCAST*  ───╮
│
│  📌 *Format Cepat:*
│  /bc <nama_template>
│
│  📌 *Format Manual:*
│  /bc <group_tpl>, <pesan>
│${savedList}
│
│  💡 *Simpan Template:*
│  /svbc <nama>, <group>, <pesan>
│
╰──────────────────────╯`);
                return { handled: true, error: "invalid format" };
            }

            templateName = parts[0];
            message = parts.slice(1).join(", ");

            // Check for media attachment from message
            mediaUrl = payload.mediaUrl || payload.quotedMsg?.mediaUrl;
            mimetype = payload.mimetype || payload.quotedMsg?.mimetype || "";
            hasMedia = !!mediaUrl;
        }

        // Find group template
        const templates = getGroupTemplates();
        const template = templates.find(t =>
            t.name.toLowerCase() === templateName.toLowerCase() ||
            t.name.toLowerCase().includes(templateName.toLowerCase())
        );

        if (!template) {
            const available = templates.map(t => t.name).join(", ") || "tidak ada";
            await client.sendText(adminChatId, `❌ *Template Tidak Ditemukan*\n\nTemplate tersedia:\n${available}`);
            return { handled: true, error: "template not found" };
        }

        // Deduplicate group IDs
        const uniqueGroupIds = [...new Set(template.groupIds)];
        const totalGroups = uniqueGroupIds.length;

        // Check if template has groups
        if (totalGroups === 0) {
            await client.sendText(adminChatId, `❌ *Template Kosong*\n\n_Template "${template.name}" tidak memiliki grup._`);
            return { handled: true, error: "template has no groups" };
        }

        // Set broadcast state
        broadcastInProgress = true;
        cancelBroadcast = false;

        // Prepare media if needed
        let finalMediaUrl = mediaUrl;

        if (hasMedia && mimetype.startsWith("image/")) {
            try {
                await client.sendText(adminChatId, "⏳ _Mengkonversi media..._");
                const converted = await convertImageForBroadcast(mediaUrl!);
                finalMediaUrl = `http://localhost:3000${converted.localUrl}`;
                cleanupOldBroadcastMedia(); // Async cleanup
                console.log(`[BROADCAST] Image converted to: ${finalMediaUrl}`);
            } catch (error: any) {
                console.error(`[BROADCAST] Image conversion failed: ${error.message}`);
                await client.sendText(adminChatId, `⚠️ *Gagal Konversi Gambar*\n${error.message}\n_Mencoba kirim gambar asli..._`);
            }
        }

        // Progress notification settings
        const PROGRESS_INTERVAL = 1; // Update every 1 group (TESTING)
        let progressMessageId: string | undefined;
        const startTime = Date.now();

        // Helper to generate progress bar
        const generateProgressBar = (current: number, total: number, success: number, fail: number) => {
            const percent = Math.floor((current / total) * 100);
            const filled = Math.floor(percent / 10);
            const empty = 10 - filled;
            const bar = "▓".repeat(filled) + "░".repeat(empty);
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            const eta = current > 0 ? Math.floor((elapsed / current) * (total - current)) : 0;

            return `╭━━━  📡 *BROADCAST PROGRESS*  ━━━╮
│
│  📊 *Progress:* ${current}/${total} grup
│  ${bar} ${percent}%
│
│  ✅ Berhasil: ${success}
│  ❌ Gagal: ${fail}
│  ⏱️ Waktu: ${elapsed}s | ETA: ${eta}s
│
│  🎯 Target: ${template.name}
│
╰──  _Ketik /cancel untuk stop_  ──╯`;
        };

        // Send initial progress message
        const mediaInfo = hasMedia ? `\n📎 Media: ${mimetype.split("/")[0]}` : "";
        const initialRes = await client.sendText(adminChatId, `╭━━━  *BROADCAST START*  ━━━╮
│
│  📡 *Target:* ${template.name}
│  👥 *Jumlah:* ${totalGroups} Grup${mediaInfo}
│  📝 *Pesan:*
│  _${message.length > 50 ? message.substring(0, 50) + "..." : message}_
│
╰──  _Mengirim... 0/${totalGroups}_  ──╯`);

        progressMessageId = initialRes.messageId;

        // Send to all groups with progress updates
        let successCount = 0;
        let failCount = 0;
        let cancelledAt = 0;

        // Ghost mention: check if template has ghostMention enabled
        const useGhostMention = savedTemplate ? savedTemplate.ghostMention : false;
        const mentions = useGhostMention ? ["@everyone"] : undefined;

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
                        if (message) await client.sendText(groupId, message, mentions);
                    }
                    // For image/video with ghost mention, send extra mention
                    if (mentions && (mimetype.startsWith("image/") || mimetype.startsWith("video/"))) {
                        await client.sendText(groupId, "​", mentions);
                    }
                } else {
                    await client.sendText(groupId, message, mentions);
                }
                successCount++;
            } catch (e: any) {
                console.log(`[BROADCAST] Failed for ${groupId}: ${e.message}`);
                failCount++;
            }

            // Update progress every PROGRESS_INTERVAL groups via edit message
            const current = i + 1;
            if (current % PROGRESS_INTERVAL === 0 || current === totalGroups) {
                const progressMsg = generateProgressBar(current, totalGroups, successCount, failCount);

                // Edit the existing progress message
                if (progressMessageId) {
                    try {
                        await client.editMessage(adminChatId, progressMessageId, progressMsg);
                    } catch (editError) {
                        // Edit failed, log and continue (don't spam with new messages)
                        console.log(`[BROADCAST] Edit progress failed: ${editError}`);
                    }
                }
            }

            // Delay from config (anti-ban)
            const delay = getRandomDelay();
            await new Promise(r => setTimeout(r, delay));
        }

        // Reset broadcast state
        broadcastInProgress = false;

        const totalTime = Math.floor((Date.now() - startTime) / 1000);

        // No need to delete - just send final result (progress message stays as history)

        // Send final result
        if (cancelBroadcast) {
            cancelBroadcast = false;
            await client.sendText(adminChatId, `╭━━━  🛑 *BROADCAST STOPPED*  ━━━╮
│
│  ⏹️ *Dibatalkan oleh Admin*
│
│  ✅ Terkirim: ${successCount}
│  ❌ Gagal: ${failCount}
│  ⏸️ Posisi: ${cancelledAt}/${totalGroups}
│  ⏱️ Waktu: ${totalTime}s
│
╰━━━━━━━━━━━━━━━━━━━━╯`);
            return { handled: true, response: "broadcast cancelled" };
        }

        await client.sendText(adminChatId, `╭━━━  ✅ *BROADCAST SELESAI*  ━━━╮
│
│  🎉 *Sukses!*
│
│  ✅ Berhasil: ${successCount}
│  ❌ Gagal: ${failCount}
│  📊 Total: ${totalGroups} grup
│  ⏱️ Waktu: ${totalTime}s
│
╰━━━━━━━━━━━━━━━━━━━━╯`);
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
            await client.sendText(chatId, "❌ *Mana Gambarnya?*\n\n_Kirim gambar dengan caption /sticker_");
            return { handled: true, error: "no media" };
        }

        // SMART FEATURE: If video is detected, route to Video Sticker handler
        if (mimetype.startsWith("video/")) {
            return handleVideoStickerCommand(client, chatId, payload);
        }

        if (!mimetype.startsWith("image/")) {
            await client.sendText(chatId, "❌ *Format Salah*\n\n_File harus berupa gambar (JPG/PNG) atau Video (MP4)_");
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
        await client.sendText(chatId, `❌ *Gagal Membuat Sticker*\n\nError: ${msg}`);
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
            await client.sendText(chatId, "❌ *Mana Videonya?*\n\n_Kirim video dengan caption /vsticker_");
            return { handled: true, error: "no media" };
        }

        if (!mimetype.startsWith("video/")) {
            await client.sendText(chatId, "❌ *Format Salah*\n\n_File harus video (MP4, max 6 detik)_");
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
        await client.sendText(chatId, `❌ *Gagal Video Sticker*\n\nError: ${msg}\n_Pastikan video < 6 detik_`);
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
            await client.sendText(chatId, "❌ *Mana URL-nya?*\n\n_Contoh: /download https://tiktok.com/..._");
            return { handled: true, error: "no url" };
        }

        // Validate URL
        if (!url.startsWith("http")) {
            await client.sendText(chatId, "❌ *Link Tidak Valid*\n\n_Harus dimulai dengan http:// atau https://_");
            return { handled: true, error: "invalid url" };
        }

        await client.sendText(chatId, "⏳ *Sedang Mendownload...*\n_Mohon tunggu sebentar_");

        // Download video locally using yt-dlp
        const result = await downloadVideo(url);

        // Clean up old videos occasionally
        cleanupOldVideos();

        // Get localhost URL for GOWA to fetch
        const localUrl = getLocalFileUrl(result.localUrl);

        // Send the video from local server
        await client.sendVideo(chatId, localUrl, `╭━━━  *DOWNLOAD SUCCESS*  ━━━╮
│
│  🎬 *Title:*
│  _${result.title || "Video Tanpa Judul"}_
│
│  📱 *Platform:* ${result.platform}
│
╰──  _Powered by Gowa Bot_  ──╯`);
        return { handled: true, response: "video sent" };
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error("Download error:", errorMessage);
        await client.sendText(chatId, `❌ *Download Gagal*\n\nError: ${errorMessage}\n\n_Pastikan link valid dan tidak private._`);
        return { handled: true, error: errorMessage };
    }
}

/**
 * Handle Tag All (Hidetag)
 * Admin only command to tag everyone in the group
 */
async function handleTagAll(client: GowaClient, chatId: string, args: string, payload: MessagePayload): Promise<CommandResult> {
    try {
        // 1. Check if group
        if (!chatId.endsWith("@g.us")) {
            await client.sendText(chatId, "❌ *Perintah Grup*\n\n_Command ini hanya bisa digunakan di grup._");
            return { handled: true, error: "not a group" };
        }

        // 2. Get group info
        const group = await client.getGroupInfo(chatId);

        // 3. Check if sender is admin
        // Sender ID in group is in payload.participant
        const senderId = payload.participant || payload.from;
        if (!senderId) {
            // Fallback if unable to identify sender
            await client.sendText(chatId, "⚠️ *Gagal Identifikasi Admin*\n\n_Pastikan bot admin grup._");
            return { handled: true, error: "no sender id" };
        }

        // Normalize sender ID (sometimes has : separator)
        const senderJid = senderId.split(":")[0].split("@")[0];
        const participant = group.participants.find(p => p.jid.split("@")[0] === senderJid);
        const isAdmin = participant?.isAdmin || participant?.isSuperAdmin;

        if (!isAdmin) {
            await client.sendText(chatId, "❌ *Admin Only*\n\n_Hanya admin grup yang bisa menggunakan command ini._");
            return { handled: true, error: "not admin" };
        }

        // 4. Get all participants for mention
        const mentions = group.participants.map(p => p.jid);

        // 5. Send message with mentions
        // Logic: Since GOWA API (REST) doesn't support 'mentions' field, we must use visible tags.
        // We append the mentions to the text.
        const baseText = args ? args : "📢 *TAG ALL*";

        // Construct mention string: @628xxx @628yyy...
        const mentionText = group.participants
            .map(p => `@${p.jid.split("@")[0]}`)
            .join(" ");

        // Combine (limit length if needed, but for now just send)
        // Note: This will be a visible tag. Hidetag is not supported by current API.
        const text = `${baseText}\n\n${mentionText}`;

        await client.sendText(chatId, text);

        return { handled: true, response: `tagged ${group.participants.length} members` };
    } catch (error: any) {
        await client.sendText(chatId, `❌ *Gagal Tag All*\nError: ${error.message}`);
        return { handled: true, error: error.message };
    }
}

/**
 * Handle Sticker to Image conversion
 */
// Helper to get media from quoted message (with history fallback)
async function getMediaFromQuoted(client: GowaClient, chatId: string, quotedMsg: { id?: string, hasMedia?: boolean, mediaUrl?: string, mimetype?: string }): Promise<{ mediaUrl?: string, mimetype?: string }> {
    // 1. If payload has media, use it
    if (quotedMsg.hasMedia && quotedMsg.mediaUrl) {
        return { mediaUrl: quotedMsg.mediaUrl, mimetype: quotedMsg.mimetype || "" };
    }

    // 2. Fallback: Fetch message from history if we have ID
    if (quotedMsg.id) {
        try {
            console.log(`[MEDIA_FALLBACK] Fetching msg ${quotedMsg.id} from ${chatId}`);
            // Fetch recent 20 messages (usually enough for direct reply)
            // @ts-ignore
            const messages = await client.getChatMessages(chatId, 50);

            // Find message by ID
            // @ts-ignore
            const msg: any = messages.find((m: any) => m.id === quotedMsg.id || m.key?.id === quotedMsg.id);

            if (msg) {
                // Determine raw GOWA URL
                const GOWA_BASE = process.env.GOWA_URL || "http://localhost:3030";

                // Check common media fields in history object
                // GOWA history might have different structure than webhook
                let mediaPath = "";
                let mimeType = "";

                // Check image
                if (msg.imageMessage || (msg.image && msg.image.media_path)) {
                    mediaPath = msg.imageMessage?.url || msg.image?.media_path;
                    mimeType = msg.imageMessage?.mimetype || msg.image?.mime_type || "image/jpeg";
                }
                // Check sticker
                else if (msg.stickerMessage || (msg.sticker && msg.sticker.media_path)) {
                    // GOWA sticker payload
                    mediaPath = msg.stickerMessage?.url || msg.sticker?.media_path;
                    mimeType = msg.stickerMessage?.mimetype || msg.sticker?.mime_type || "image/webp";
                }
                // Check video
                else if (msg.videoMessage || (msg.video && msg.video.media_path)) {
                    mediaPath = msg.videoMessage?.url || msg.video?.media_path;
                    mimeType = msg.videoMessage?.mimetype || msg.video?.mime_type || "video/mp4";
                }

                if (mediaPath) {
                    // Normalize URL (if it's a path, prepend GOWA_BASE)
                    const fullUrl = mediaPath.startsWith("http") ? mediaPath : `${GOWA_BASE}/${mediaPath}`;
                    console.log(`[MEDIA_FALLBACK] Found media: ${fullUrl} (${mimeType})`);
                    return { mediaUrl: fullUrl, mimetype: mimeType };
                }
            }
        } catch (e) {
            console.error("[MEDIA_FALLBACK] Error:", e);
        }
    }

    return { mediaUrl: undefined, mimetype: undefined };
}

/**
 * Handle Sticker to Image conversion
 */
async function handleToImg(client: GowaClient, chatId: string, payload: MessagePayload): Promise<CommandResult> {
    try {
        const quoted = payload.quotedMsg;
        if (!quoted) {
            await client.sendText(chatId, "❌ *Reply Sticker*\n\n_Reply sticker yang ingin diubah ke gambar dengan /toimg_");
            return { handled: true, error: "no quoted message" };
        }

        /* Attempt to get media, falling back to history fetch */
        const { mediaUrl, mimetype } = await getMediaFromQuoted(client, chatId, quoted);

        if (!mediaUrl || !mimetype?.includes("webp")) {
            // Try check if it was image/jpeg (maybe user replied to image?)
            // But command is for sticker. User wants to save sticker as image.
            // If quoted message is missing media info completely:
            await client.sendText(chatId, "❌ *Gagal Mengambil Sticker*\n\n_Pastikan reply sticker yang valid. Coba kirim ulang stickernya lalu reply._");
            return { handled: true, error: "no quoted media found" };
        }

        await client.sendText(chatId, "⏳ _Mengubah ke gambar..._");

        const result = await stickerToImage(mediaUrl);
        const localUrl = `http://localhost:3000${result.localUrl}`;

        await client.sendImage(chatId, localUrl, "✅ *Sticker to Image*");

        return { handled: true, response: "sticker converted" };
    } catch (error: any) {
        await client.sendText(chatId, `❌ *Gagal Convert*\nError: ${error.message}`);
        return { handled: true, error: error.message };
    }
}

/**
 * Handle Video to MP3 conversion
 */
async function handleToMp3(client: GowaClient, chatId: string, payload: MessagePayload): Promise<CommandResult> {
    try {
        // Check current message media first
        let mediaUrl = payload.mediaUrl;
        let mimetype = payload.mimetype || "";

        // If no media in current message, checks quoted
        if (!mediaUrl) {
            if (payload.quotedMsg) {
                const quotedMedia = await getMediaFromQuoted(client, chatId, payload.quotedMsg);
                mediaUrl = quotedMedia.mediaUrl;
                mimetype = quotedMedia.mimetype || "";
            }
        }

        if (!mediaUrl || !mimetype.startsWith("video/")) {
            await client.sendText(chatId, "❌ *Mana Videonya?*\n\n_Kirim/Reply video dengan /tomp3_");
            return { handled: true, error: "no video" };
        }

        await client.sendText(chatId, "⏳ _Mengambil audio..._");

        const result = await videoToMp3(mediaUrl);
        const localUrl = `http://localhost:3000${result.localUrl}`;

        await client.sendAudio(chatId, localUrl);

        return { handled: true, response: "video converted to mp3" };
    } catch (error: any) {
        await client.sendText(chatId, `❌ *Gagal Convert*\nError: ${error.message}`);
        return { handled: true, error: error.message };
    }
}
