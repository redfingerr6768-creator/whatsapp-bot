import { NextRequest, NextResponse } from "next/server";
import { GowaClient, getGowaClient } from "@/lib/gowa";
import { getAutomationRules, AutomationRule } from "@/lib/automation";
import fs from 'fs';
import path from 'path';

const GOWA_URL = process.env.GOWA_URL || "http://localhost:3030";
const GOWA_BASIC_AUTH = process.env.GOWA_BASIC_AUTH;

// File-based logging for debugging
const LOG_FILE = path.join(process.cwd(), 'data', 'webhook-log.txt');
function logToFile(message: string) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}\n`;
    try {
        const dir = path.dirname(LOG_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.appendFileSync(LOG_FILE, logEntry);
    } catch (e) {
        console.error("Failed to write log:", e);
    }
}

// Message deduplication - prevent processing same message multiple times
const processedMessages = new Set<string>();
const MAX_CACHE_SIZE = 1000;

function isMessageProcessed(messageId: string): boolean {
    if (processedMessages.has(messageId)) {
        return true;
    }
    // Add to cache
    processedMessages.add(messageId);
    // Limit cache size
    if (processedMessages.size > MAX_CACHE_SIZE) {
        const firstItem = processedMessages.values().next().value;
        if (firstItem) processedMessages.delete(firstItem);
    }
    return false;
}

/**
 * Webhook endpoint to receive incoming messages from GOWA
 * Configure GOWA to send webhooks to: http://your-server:3001/api/webhook
 * 
 * In GOWA, set environment variables or flags:
 * WHATSAPP_WEBHOOK=http://host.docker.internal:3001/api/webhook
 * WHATSAPP_WEBHOOK_EVENTS=message
 */

interface GowaWebhookPayload {
    event: "message" | "message.reaction" | "message.revoked" | "message.edited" | "message.ack" | "group.participants";
    device_id: string;
    payload: {
        id: string;
        chat_id: string;
        from: string;
        from_lid?: string;
        from_name?: string;
        timestamp: string;
        body?: string;
        // Media fields
        image?: string | { url: string; caption?: string };
        video?: string | { url: string; caption?: string };
        audio?: string;
        sticker?: string;
        document?: string | { url: string; filename?: string };
        // Reply fields
        replied_to_id?: string;
        quoted_body?: string;
    };
}

function extractMediaInfo(payload: GowaWebhookPayload["payload"]): {
    mediaUrl?: string;
    mimetype?: string;
    hasMedia: boolean;
} {
    // Check each media type
    if (payload.image) {
        const url = typeof payload.image === "string" ? payload.image : payload.image.url;
        return { mediaUrl: url, mimetype: "image/jpeg", hasMedia: true };
    }
    if (payload.video) {
        const url = typeof payload.video === "string" ? payload.video : payload.video.url;
        return { mediaUrl: url, mimetype: "video/mp4", hasMedia: true };
    }
    if (payload.audio) {
        return { mediaUrl: payload.audio, mimetype: "audio/ogg", hasMedia: true };
    }
    if (payload.sticker) {
        return { mediaUrl: payload.sticker, mimetype: "image/webp", hasMedia: true };
    }
    if (payload.document) {
        const url = typeof payload.document === "string" ? payload.document : payload.document.url;
        return { mediaUrl: url, mimetype: "application/octet-stream", hasMedia: true };
    }
    return { hasMedia: false };
}

function isOwnMessage(payload: GowaWebhookPayload, deviceId: string): boolean {
    // Check if message is from our own device
    // In GOWA, compare from with device_id
    return payload.payload.from === deviceId;
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        // Log incoming webhook for debugging (file + console)
        logToFile(`WEBHOOK RECEIVED: ${JSON.stringify(body)}`);
        console.log("[WEBHOOK] Received:", JSON.stringify(body, null, 2));

        // GOWA has two payload formats:
        // 1. Test/Old format: {event: "message", device_id: "...", payload: {from, body, ...}}
        // 2. Real format: {chat_id: "...", from: "...", message: {text: "..."}, ...}

        let messageText = "";
        let chatId = "";
        let deviceId = "";
        let isTestMode = false;

        // Detect which format we're dealing with
        if (body.event && body.payload) {
            // Old/Test format
            const event = body.event;
            deviceId = body.device_id || "";
            isTestMode = deviceId === "test";

            if (event !== "message") {
                return NextResponse.json({ status: "ignored", event });
            }

            const payload = body.payload;
            messageText = payload.body || "";
            chatId = payload.chat_id || payload.from || "";
        } else if (body.from && body.chat_id) {
            // Real GOWA format - check for media with caption first
            chatId = body.from || body.chat_id || "";
            deviceId = "real";
            isTestMode = false;

            // Priority: image caption > video caption > message text
            if (body.image && body.image.caption) {
                messageText = body.image.caption;
            } else if (body.video && body.video.caption) {
                messageText = body.video.caption;
            } else if (body.document && body.document.caption) {
                messageText = body.document.caption;
            } else {
                messageText = body.message?.text || "";
            }
        } else {
            // Unknown format, log and ignore
            logToFile(`UNKNOWN FORMAT - ignored`);
            return NextResponse.json({ status: "unknown format", received: body });
        }

        if (!chatId) {
            return NextResponse.json({ status: "no chatId" });
        }

        // Allow processing if there's messageText OR if there's media (for sticker command reply)
        if (!messageText && !body.image && !body.video) {
            return NextResponse.json({ status: "no message text" });
        }

        console.log(`[WEBHOOK] Message from ${chatId}: ${messageText}`);
        if (body.message) {
            console.log(`[WEBHOOK] Message keys: ${Object.keys(body.message).join(", ")}`);
        }

        // Deduplicate messages - prevent processing same message multiple times
        const messageId = body.message?.id || body.payload?.id || `${chatId}-${Date.now()}`;
        if (isMessageProcessed(messageId)) {
            console.log(`[WEBHOOK] Duplicate message ${messageId} - skipping`);
            return NextResponse.json({ status: "duplicate", messageId });
        }

        // Check for bot commands first
        const { isCommand, handleCommand } = await import("@/lib/commands");

        if (isCommand(messageText)) {
            console.log(`[WEBHOOK] Processing command: ${messageText}`);

            // Extract media info from payload (both formats)
            let mediaUrl = "";
            let mimetype = "";
            let hasMedia = false;

            // Old format (body.payload)
            if (body.payload) {
                const mediaInfo = extractMediaInfo(body.payload);
                mediaUrl = mediaInfo.mediaUrl || "";
                mimetype = mediaInfo.mimetype || "";
                hasMedia = mediaInfo.hasMedia;
            }

            // Real GOWA format - media at top level with media_path
            // Image/Video/Document are at body level, not inside body.message
            const GOWA_BASE = process.env.GOWA_URL || "http://localhost:3030";

            if (body.image && body.image.media_path) {
                mediaUrl = `${GOWA_BASE}/${body.image.media_path}`;
                mimetype = body.image.mime_type || "image/jpeg";
                hasMedia = true;
                console.log(`[WEBHOOK] Found image: ${mediaUrl}`);
            } else if (body.video && body.video.media_path) {
                mediaUrl = `${GOWA_BASE}/${body.video.media_path}`;
                mimetype = body.video.mime_type || "video/mp4";
                hasMedia = true;
                console.log(`[WEBHOOK] Found video: ${mediaUrl}`);
            } else if (body.document && body.document.media_path) {
                mediaUrl = `${GOWA_BASE}/${body.document.media_path}`;
                mimetype = body.document.mime_type || "application/octet-stream";
                hasMedia = true;
                console.log(`[WEBHOOK] Found document: ${mediaUrl}`);
            }

            // Build message payload with media
            const msgPayload = {
                id: body.message?.id || body.payload?.id || "",
                from: chatId,
                body: messageText,
                hasMedia,
                mediaUrl,
                mimetype,
                quotedMsg: body.message?.replied_id ? {
                    hasMedia: false,
                    mediaUrl: "",
                    mimetype: "",
                    body: body.message?.quoted_message || "",
                } : undefined
            };

            console.log(`[WEBHOOK] Payload media: hasMedia=${hasMedia}, url=${mediaUrl?.substring(0, 50)}...`);

            const result = await handleCommand(msgPayload);

            if (result.handled) {
                console.log(`[WEBHOOK] Command handled: ${result.response || result.error}`);
                return NextResponse.json({
                    status: "command_handled",
                    result
                });
            }
        }

        // If no command or command not handled, check automation rules
        if (!messageText) {
            return NextResponse.json({ status: "no message" });
        }

        // Get automation rules
        const rules = getAutomationRules();
        const activeRules = rules.filter((r: AutomationRule) => r.enabled);

        // Check each rule first
        for (const rule of activeRules) {
            const matched = checkRuleMatch(rule, messageText);

            if (matched) {
                console.log(`[WEBHOOK] Rule matched: ${rule.name}`);

                // Send auto-reply
                if (deviceId === "test") {
                    console.log(`[WEBHOOK] Test mode: Simulated reply to ${chatId}: ${rule.reply}`);
                } else {
                    const client = getGowaClient(GOWA_URL, GOWA_BASIC_AUTH);
                    await client.sendText(chatId, rule.reply);
                }

                console.log(`[WEBHOOK] Auto-reply sent to ${chatId}`);

                return NextResponse.json({
                    status: "replied",
                    rule: rule.name,
                    chatId,
                    reply: rule.reply,
                    isTest: deviceId === "test"
                });
            }
        }

        // No rule matched - try AI response with conversation context
        try {
            const { getGroqConfig, generateAIResponse } = await import("@/lib/groq");
            const { getHistoryForAI, addToConversationHistory } = await import("@/lib/conversation");
            const aiConfig = getGroqConfig();

            if (aiConfig.enabled && aiConfig.apiKeys.length > 0) {
                console.log(`[WEBHOOK] No rule matched, using AI response with context`);

                // Get conversation history for this chat
                const conversationHistory = getHistoryForAI(chatId);
                console.log(`[WEBHOOK] Conversation history: ${conversationHistory.length} messages`);

                // Add current user message to history
                addToConversationHistory(chatId, "user", messageText);

                // Generate AI response with context
                const aiResponse = await generateAIResponse(messageText, conversationHistory);

                // Add AI response to history
                addToConversationHistory(chatId, "assistant", aiResponse);

                // Send AI response
                const client = getGowaClient(GOWA_URL, GOWA_BASIC_AUTH);
                await client.sendText(chatId, aiResponse);

                console.log(`[WEBHOOK] AI response sent to ${chatId}`);

                return NextResponse.json({
                    status: "ai_replied",
                    chatId,
                    historyLength: conversationHistory.length + 1
                });
            }
        } catch (aiError: unknown) {
            const errorMessage = aiError instanceof Error ? aiError.message : "Unknown error";
            console.error("[WEBHOOK] AI Error:", errorMessage);
        }

        return NextResponse.json({ status: "no rule matched, AI disabled or failed" });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error("[WEBHOOK] Error:", error);
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}

function checkRuleMatch(rule: AutomationRule, message: string): boolean {
    const msgLower = message.toLowerCase();

    for (const keyword of rule.keywords) {
        const kwLower = keyword.toLowerCase();

        if (rule.matchType === "exact") {
            if (msgLower === kwLower) return true;
        } else if (rule.matchType === "contains") {
            if (msgLower.includes(kwLower)) return true;
        } else if (rule.matchType === "startsWith") {
            if (msgLower.startsWith(kwLower)) return true;
        }
    }

    return false;
}

// GET endpoint to check webhook status
export async function GET(req: NextRequest) {
    return NextResponse.json({
        status: "active",
        info: "Webhook endpoint ready to receive GOWA events",
        configure: "Set WHATSAPP_WEBHOOK=http://host.docker.internal:3001/api/webhook in GOWA"
    });
}
