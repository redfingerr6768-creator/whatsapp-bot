/**
 * Telegram Admin Bot
 * Control WhatsApp bot via Telegram commands
 */

import TelegramBot from "node-telegram-bot-api";
import { getGowaClient } from "./gowa";
import { getBroadcastTemplates, getBroadcastTemplateByName } from "./broadcastTemplates";
import { getGroupTemplates } from "./groupTemplates";
import {
    startAutoBroadcast,
    stopAutoBroadcast,
    getAutoBroadcastStatus,
} from "./autoBroadcast";
import { getRandomDelay, setDelay, getBroadcastConfig } from "./broadcastConfig";

// ==================== CONFIG ====================

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const ADMIN_IDS = (process.env.TELEGRAM_ADMIN_IDS || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

let bot: TelegramBot | null = null;
let started = false;
const startTime = Date.now();

// ==================== AUTH ====================

function isAuthorized(userId: number): boolean {
    return ADMIN_IDS.includes(String(userId));
}

function unauthorized(chatId: number) {
    bot?.sendMessage(chatId, "⛔ Unauthorized. Your ID is not in the admin list.");
}

// ==================== HELPERS ====================

function escapeMarkdown(text: string): string {
    return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, "\\$&");
}

function formatUptime(): string {
    const ms = Date.now() - startTime;
    const seconds = Math.floor(ms / 1000) % 60;
    const minutes = Math.floor(ms / 60000) % 60;
    const hours = Math.floor(ms / 3600000) % 24;
    const days = Math.floor(ms / 86400000);
    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    parts.push(`${seconds}s`);
    return parts.join(" ");
}

// ==================== SEND MESSAGE HELPER ====================

async function reply(chatId: number, text: string, parseMode: "HTML" | "Markdown" | undefined = "HTML") {
    try {
        await bot?.sendMessage(chatId, text, { parse_mode: parseMode });
    } catch (err: any) {
        // Fallback to plain text if parse fails
        try {
            await bot?.sendMessage(chatId, text.replace(/<[^>]+>/g, ""));
        } catch { }
    }
}

// ==================== COMMAND HANDLERS ====================

async function handleStart(chatId: number) {
    const msg = `🤖 <b>WhatsApp Bot Admin Panel</b>

<b>Available Commands:</b>

📊 <b>Info</b>
/ping - Check bot status
/status - WhatsApp connection status
/groups - List joined groups
/templates - List broadcast templates

📡 <b>Broadcasting</b>
/broadcast &lt;name&gt; - Execute broadcast
/autobc start &lt;tpl1,tpl2&gt; &lt;min&gt; &lt;max&gt;
/autobc stop - Stop auto broadcast
/autobc status - Check auto broadcast

💬 <b>Messaging</b>
/send &lt;phone&gt; &lt;message&gt;
/sendgroup &lt;groupId&gt; &lt;message&gt;

⚙️ <b>Settings</b>
/setdelay &lt;min&gt; &lt;max&gt; - Set BC delay`;

    await bot?.sendMessage(chatId, msg, {
        parse_mode: "HTML",
        reply_markup: {
            keyboard: [
                [{ text: "📊 Status" }, { text: "👥 Groups" }],
                [{ text: "📝 Templates" }, { text: "📡 Auto Broadcast" }],
                [{ text: "🏓 Ping" }, { text: "❓ Help" }]
            ],
            resize_keyboard: true
        }
    });
}

async function handlePing(chatId: number) {
    await reply(chatId, `🏓 <b>Pong!</b>\n⏱ Uptime: ${formatUptime()}`);
}

async function handleStatus(chatId: number) {
    try {
        const client = getGowaClient();
        const groups = await client.getGroups();
        const devices = await client.getDevices();

        const deviceInfo = devices.length > 0
            ? devices.map((d) => `• ${d.name} (${d.device})`).join("\n")
            : "No devices connected";

        await reply(chatId, `📊 <b>WhatsApp Bot Status</b>

✅ <b>Connected</b>
👥 Groups: ${groups.length}
📱 Devices:
${deviceInfo}
⏱ Uptime: ${formatUptime()}`);
    } catch (err: any) {
        await reply(chatId, `❌ <b>Error:</b> ${err.message}`);
    }
}

async function handleGroups(chatId: number) {
    try {
        const client = getGowaClient();
        const groups = await client.getGroups();

        if (groups.length === 0) {
            await reply(chatId, "📋 No groups found.");
            return;
        }

        // Split into chunks to avoid message limit
        const chunkSize = 30;
        for (let i = 0; i < groups.length; i += chunkSize) {
            const chunk = groups.slice(i, i + chunkSize);
            const lines = chunk.map(
                (g, idx) => `${i + idx + 1}. <b>${escapeHtml(g.name)}</b>\n   👥 ${(g as any).participants?.length || "?"} members`
            );
            const header = i === 0 ? `📋 <b>Groups (${groups.length} total)</b>\n\n` : "";
            await reply(chatId, header + lines.join("\n\n"));
        }
    } catch (err: any) {
        await reply(chatId, `❌ <b>Error:</b> ${err.message}`);
    }
}

async function handleTemplates(chatId: number) {
    try {
        const templates = getBroadcastTemplates();

        if (templates.length === 0) {
            await reply(chatId, "📋 No broadcast templates saved.");
            return;
        }

        const lines = templates.map(
            (t) =>
                `📝 <b>${escapeHtml(t.name)}</b>\n` +
                `   📎 ${t.mediaType}${t.ghostMention ? " 👻" : ""}\n` +
                `   💬 ${escapeHtml(t.message.substring(0, 60))}${t.message.length > 60 ? "..." : ""}`
        );

        // Create inline keyboard for broadcasting
        const keyboard = templates.map(t => [{
            text: `📢 Broadcast: ${t.name}`,
            callback_data: `bc:${t.name}`
        }]);

        await bot?.sendMessage(chatId, `📋 <b>Broadcast Templates (${templates.length})</b>\n\n${lines.join("\n\n")}`, {
            parse_mode: "HTML",
            reply_markup: {
                inline_keyboard: keyboard
            }
        });
    } catch (err: any) {
        await reply(chatId, `❌ <b>Error:</b> ${err.message}`);
    }
}

async function handleBroadcast(chatId: number, args: string) {
    if (!args.trim()) {
        await reply(chatId, "⚠️ Usage: /broadcast &lt;template_name&gt;");
        return;
    }

    const templateName = args.trim();
    const template = getBroadcastTemplateByName(templateName);

    if (!template) {
        await reply(chatId, `❌ Template "<b>${escapeHtml(templateName)}</b>" not found.`);
        return;
    }

    // Get group template
    const groupTemplates = getGroupTemplates();
    const groupTemplate = groupTemplates.find(
        (gt) => gt.name === template.groupTemplateName
    );

    if (!groupTemplate) {
        await reply(
            chatId,
            `❌ Group template "<b>${escapeHtml(template.groupTemplateName)}</b>" not found.`
        );
        return;
    }

    const totalGroups = groupTemplate.groupIds.length;
    await reply(
        chatId,
        `📡 <b>Starting broadcast...</b>\n\n` +
        `📝 Template: ${escapeHtml(template.name)}\n` +
        `🎯 Target: ${escapeHtml(groupTemplate.name)} (${totalGroups} groups)\n` +
        `👻 Ghost Mention: ${template.ghostMention ? "ON" : "OFF"}`
    );

    try {
        const client = getGowaClient();
        let success = 0;
        let fail = 0;
        const mentions = template.ghostMention ? ["@everyone"] : undefined;

        for (const groupId of groupTemplate.groupIds) {
            try {
                if (template.mediaType === "image" && template.mediaUrl) {
                    await client.sendImage(groupId, template.mediaUrl, template.message);
                } else if (template.mediaType === "video" && template.mediaUrl) {
                    await client.sendVideo(groupId, template.mediaUrl, template.message);
                } else if (template.mediaType === "file" && template.mediaUrl) {
                    await client.sendFile(groupId, template.mediaUrl);
                    if (template.message) await client.sendText(groupId, template.message, mentions);
                } else {
                    await client.sendText(groupId, template.message, mentions);
                }

                // Ghost mention for media
                if (mentions && (template.mediaType === "image" || template.mediaType === "video")) {
                    await client.sendText(groupId, "\u200B", mentions);
                }

                success++;
            } catch (e: any) {
                fail++;
            }

            // Anti-ban delay
            const delay = getRandomDelay();
            await new Promise((r) => setTimeout(r, delay));
        }

        await reply(
            chatId,
            `✅ <b>Broadcast Complete</b>\n\n` +
            `✅ Success: ${success}\n` +
            `❌ Failed: ${fail}\n` +
            `📊 Total: ${totalGroups}`
        );
    } catch (err: any) {
        await reply(chatId, `❌ <b>Broadcast Error:</b> ${err.message}`);
    }
}

async function handleAutoBC(chatId: number, args: string) {
    const parts = args.trim().split(/\s+/);
    const action = parts[0]?.toLowerCase();

    if (action === "start") {
        // /autobc start tpl1,tpl2 60 80
        const tplNames = parts[1]?.split(",").filter(Boolean);
        const min = parseInt(parts[2]) || 60;
        const max = parseInt(parts[3]) || 80;

        if (!tplNames || tplNames.length === 0) {
            await reply(chatId, "⚠️ Usage: /autobc start &lt;tpl1,tpl2&gt; &lt;min_minutes&gt; &lt;max_minutes&gt;");
            return;
        }

        try {
            const config = startAutoBroadcast(tplNames, min, max, "telegram");
            await reply(
                chatId,
                `✅ <b>Auto Broadcast Started</b>\n\n` +
                `📝 Templates: ${tplNames.join(", ")}\n` +
                `⏱ Interval: ${min}-${max} minutes`
            );
        } catch (err: any) {
            await reply(chatId, `❌ <b>Error:</b> ${err.message}`);
        }
    } else if (action === "stop") {
        try {
            stopAutoBroadcast();
            await reply(chatId, `⏹ <b>Auto Broadcast Stopped</b>`);
        } catch (err: any) {
            await reply(chatId, `❌ <b>Error:</b> ${err.message}`);
        }
    } else if (action === "status") {
        try {
            const status = getAutoBroadcastStatus();
            const c = status.config;

            const msg = `📊 <b>Auto Broadcast Status</b>\n\n` +
                `${status.isRunning ? "🟢 Running" : "🔴 Stopped"}\n` +
                `📝 Templates: ${c.templateNames.join(", ") || "-"}\n` +
                `⏱ Interval: ${c.minIntervalMinutes}-${c.maxIntervalMinutes}m\n` +
                `📤 Total Sent: ${c.totalSent}\n` +
                `🕐 Last: ${c.lastBroadcastAt || "-"}\n` +
                `⏭ Next: ${status.nextIn || "-"}`;

            const keyboard = [];
            if (status.isRunning) {
                keyboard.push([{ text: "⏹ Stop Auto Broadcast", callback_data: "autobc:stop" }]);
            }
            keyboard.push([{ text: "🔄 Refresh Status", callback_data: "autobc:status" }]);

            await bot?.sendMessage(chatId, msg, {
                parse_mode: "HTML",
                reply_markup: { inline_keyboard: keyboard }
            });
        } catch (err: any) {
            await reply(chatId, `❌ <b>Error:</b> ${err.message}`);
        }
    } else {
        await reply(
            chatId,
            "⚠️ Usage:\n/autobc start &lt;tpl1,tpl2&gt; &lt;min&gt; &lt;max&gt;\n/autobc stop\n/autobc status"
        );
    }
}

async function handleSend(chatId: number, args: string) {
    const spaceIdx = args.indexOf(" ");
    if (spaceIdx === -1) {
        await reply(chatId, "⚠️ Usage: /send &lt;phone&gt; &lt;message&gt;");
        return;
    }

    let phone = args.substring(0, spaceIdx).trim();
    const message = args.substring(spaceIdx + 1).trim();

    if (!phone || !message) {
        await reply(chatId, "⚠️ Usage: /send &lt;phone&gt; &lt;message&gt;");
        return;
    }

    // Add suffix if needed
    if (!phone.includes("@")) {
        phone = phone + "@s.whatsapp.net";
    }

    try {
        const client = getGowaClient();
        await client.sendText(phone, message);
        await reply(chatId, `✅ Message sent to <b>${escapeHtml(phone)}</b>`);
    } catch (err: any) {
        await reply(chatId, `❌ <b>Error:</b> ${err.message}`);
    }
}

async function handleSendGroup(chatId: number, args: string) {
    const spaceIdx = args.indexOf(" ");
    if (spaceIdx === -1) {
        await reply(chatId, "⚠️ Usage: /sendgroup &lt;groupId&gt; &lt;message&gt;");
        return;
    }

    let groupId = args.substring(0, spaceIdx).trim();
    const message = args.substring(spaceIdx + 1).trim();

    if (!groupId.includes("@")) {
        groupId = groupId + "@g.us";
    }

    try {
        const client = getGowaClient();
        await client.sendText(groupId, message);
        await reply(chatId, `✅ Message sent to group <b>${escapeHtml(groupId)}</b>`);
    } catch (err: any) {
        await reply(chatId, `❌ <b>Error:</b> ${err.message}`);
    }
}

async function handleSetDelay(chatId: number, args: string) {
    const parts = args.trim().split(/\s+/);
    const min = parseInt(parts[0]);
    const max = parseInt(parts[1]);

    if (isNaN(min) || isNaN(max)) {
        const current = getBroadcastConfig();
        await reply(
            chatId,
            `⚙️ <b>Current Delay:</b> ${current.minDelay}-${current.maxDelay}ms\n\n` +
            `Usage: /setdelay &lt;min_ms&gt; &lt;max_ms&gt;`
        );
        return;
    }

    setDelay(min, max);
    await reply(chatId, `✅ Broadcast delay set to <b>${min}-${max}ms</b>`);
}

// ==================== HTML ESCAPE ====================

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

// ==================== INIT ====================

export function initTelegramBot(): TelegramBot | null {
    if (started) return bot;
    if (!BOT_TOKEN) {
        console.log("[TELEGRAM] No TELEGRAM_BOT_TOKEN set, skipping init.");
        return null;
    }

    if (ADMIN_IDS.length === 0) {
        console.log("[TELEGRAM] No TELEGRAM_ADMIN_IDS set, skipping init.");
        return null;
    }

    console.log("[TELEGRAM] Starting Telegram admin bot...");

    bot = new TelegramBot(BOT_TOKEN, { polling: true });
    started = true;

    // Notify admins that bot is ready
    notifyTelegramAdmins("🚀 <b>Bot Restarted & Ready!</b>\nAll systems go.");

    // Register command handlers
    bot.on("message", async (msg) => {
        const chatId = msg.chat.id;
        const userId = msg.from?.id;
        const text = msg.text || "";

        if (!userId || !isAuthorized(userId)) {
            if (text.startsWith("/")) unauthorized(chatId);
            return;
        }

        // Parse command

        // Handle button clicks (text messages)
        let cmd = "";
        let args = "";

        if (text.startsWith("/")) {
            const match = text.match(/^\/(\w+)(?:@\w+)?\s*([\s\S]*)?$/);
            if (match) {
                cmd = match[1].toLowerCase();
                args = (match[2] || "").trim();
            }
        } else {
            // Map button text to commands
            switch (text) {
                case "📊 Status": cmd = "status"; break;
                case "👥 Groups": cmd = "groups"; break;
                case "📝 Templates": cmd = "templates"; break;
                case "📡 Auto Broadcast": cmd = "autobc"; args = "status"; break;
                case "🏓 Ping": cmd = "ping"; break;
                case "❓ Help": cmd = "help"; break;
            }
        }

        if (!cmd) return;


        try {
            switch (cmd) {
                case "start":
                case "help":
                case "menu":
                    await handleStart(chatId);
                    break;
                case "ping":
                    await handlePing(chatId);
                    break;
                case "status":
                case "stat":
                    await handleStatus(chatId);
                    break;
                case "groups":
                case "grp":
                    await handleGroups(chatId);
                    break;
                case "templates":
                case "tpl":
                    await handleTemplates(chatId);
                    break;
                case "broadcast":
                case "bc":
                    await handleBroadcast(chatId, args);
                    break;
                case "autobc":
                case "abc":
                    await handleAutoBC(chatId, args);
                    break;
                case "send":
                    await handleSend(chatId, args);
                    break;
                case "sendgroup":
                case "sg":
                    await handleSendGroup(chatId, args);
                    break;
                case "setdelay":
                case "delay":
                    await handleSetDelay(chatId, args);
                    break;
                default:
                    await reply(chatId, `❓ Unknown command: /${cmd}\nType /help for available commands.`);
            }
        } catch (err: any) {
            await reply(chatId, `❌ <b>Error:</b> ${err.message}`);
        }
    });

    // Handle Callback Queries (Inline Buttons)
    bot.on("callback_query", async (query) => {
        console.log("[TELEGRAM] Callback query received:", query.data, "from", query.from.id);
        const chatId = query.message?.chat.id;
        const data = query.data;

        if (!chatId || !data) {
            console.log("[TELEGRAM] Missing chatId or data in callback");
            return;
        }

        // Answer callback to stop loading animation
        try {
            await bot?.answerCallbackQuery(query.id);
        } catch (e) {
            console.error("[TELEGRAM] Error answering callback:", e);
        }

        // Check auth again
        const userId = query.from.id;
        if (!isAuthorized(userId)) {
            await bot?.sendMessage(chatId, "⛔ Unauthorized.");
            return;
        }

        try {
            if (data.startsWith("bc:")) {
                const tplName = data.substring(3);
                await handleBroadcast(chatId, tplName);
            } else if (data === "autobc:stop") {
                await handleAutoBC(chatId, "stop");
                await handleAutoBC(chatId, "status"); // Refresh status
            } else if (data === "autobc:status") {
                await handleAutoBC(chatId, "status");
            }
        } catch (err: any) {
            await reply(chatId, `❌ <b>Error:</b> ${err.message}`);
        }
    });

    bot.on("polling_error", (error) => {
        console.error("[TELEGRAM] Polling error:", error.message);
    });

    console.log(`[TELEGRAM] Bot started! Admin IDs: ${ADMIN_IDS.join(", ")}`);
    return bot;
}

/**
 * Send a notification to all admin Telegram chats
 */
export async function notifyTelegramAdmins(message: string): Promise<void> {
    if (!bot) return;
    for (const adminId of ADMIN_IDS) {
        try {
            await bot.sendMessage(parseInt(adminId), message, { parse_mode: "HTML" });
            console.log(`[TELEGRAM] Notification sent to ${adminId}`);
        } catch (error: any) {
            console.error(`[TELEGRAM] Failed to send notification to ${adminId}:`, error.message);
        }
    }
}

export function getTelegramBot(): TelegramBot | null {
    return bot;
}
