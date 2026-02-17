/**
 * Auto Broadcast Scheduler
 * Automatically broadcasts using saved templates at random intervals
 * Managed via WhatsApp admin commands
 */

import fs from "fs";
import path from "path";
import { getGowaClient } from "./gowa";
import { getBroadcastTemplateByName, getBroadcastTemplates } from "./broadcastTemplates";
import { getGroupTemplates } from "./groupTemplates";
import { getRandomDelay } from "./broadcastConfig";
import { convertImageForBroadcast, cleanupOldBroadcastMedia } from "./broadcastMedia";
import { getAdminNumbers } from "./adminConfig";

const GOWA_URL = process.env.GOWA_URL || "http://localhost:3030";
const GOWA_BASIC_AUTH = process.env.GOWA_BASIC_AUTH;

// ==================== CONFIG ====================

const CONFIG_FILE = path.join(process.cwd(), "data", "auto-broadcast-config.json");

export interface AutoBroadcastConfig {
    enabled: boolean;
    templateNames: string[];       // List of broadcast template names to rotate
    minIntervalMinutes: number;    // Min interval in minutes
    maxIntervalMinutes: number;    // Max interval in minutes
    currentIndex: number;          // Current template rotation index
    lastBroadcastAt: string | null;
    nextBroadcastAt: string | null;
    totalSent: number;
    updatedAt: string;
    updatedBy: string;
}

const DEFAULT_CONFIG: AutoBroadcastConfig = {
    enabled: false,
    templateNames: [],
    minIntervalMinutes: 60,
    maxIntervalMinutes: 80,
    currentIndex: 0,
    lastBroadcastAt: null,
    nextBroadcastAt: null,
    totalSent: 0,
    updatedAt: new Date().toISOString(),
    updatedBy: "system",
};

export function getAutoBroadcastConfig(): AutoBroadcastConfig {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            const data = fs.readFileSync(CONFIG_FILE, "utf-8");
            return { ...DEFAULT_CONFIG, ...JSON.parse(data) };
        }
    } catch { }
    return { ...DEFAULT_CONFIG };
}

export function saveAutoBroadcastConfig(
    updates: Partial<AutoBroadcastConfig>,
    updatedBy: string = "admin"
): AutoBroadcastConfig {
    const dir = path.dirname(CONFIG_FILE);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    const current = getAutoBroadcastConfig();
    const updated: AutoBroadcastConfig = {
        ...current,
        ...updates,
        updatedAt: new Date().toISOString(),
        updatedBy,
    };

    fs.writeFileSync(CONFIG_FILE, JSON.stringify(updated, null, 2));
    return updated;
}

// ==================== SCHEDULER ====================

let schedulerTimer: ReturnType<typeof setTimeout> | null = null;
let isExecuting = false;

/**
 * Get a random interval in milliseconds between min and max minutes
 */
function getRandomInterval(minMinutes: number, maxMinutes: number): number {
    const range = maxMinutes - minMinutes;
    const randomMinutes = Math.random() * range + minMinutes;
    return Math.floor(randomMinutes * 60 * 1000);
}

/**
 * Notify all admin numbers about auto broadcast events
 */
async function notifyAdmins(message: string): Promise<void> {
    try {
        const client = getGowaClient(GOWA_URL, GOWA_BASIC_AUTH);
        const adminNumbers = getAdminNumbers();
        for (const admin of adminNumbers) {
            try {
                await client.sendText(admin, message);
            } catch (e) {
                console.error(`[AUTO_BC] Failed to notify admin ${admin}:`, e);
            }
        }
    } catch (e) {
        console.error("[AUTO_BC] Failed to notify admins:", e);
    }
}

/**
 * Execute a single auto broadcast cycle
 */
async function executeBroadcast(): Promise<void> {
    if (isExecuting) {
        console.log("[AUTO_BC] Already executing, skipping...");
        return;
    }

    isExecuting = true;
    const config = getAutoBroadcastConfig();

    // Check if still enabled
    if (!config.enabled || config.templateNames.length === 0) {
        console.log("[AUTO_BC] Disabled or no templates, stopping...");
        isExecuting = false;
        return;
    }

    try {
        const client = getGowaClient(GOWA_URL, GOWA_BASIC_AUTH);

        // Get current template (rotate through list)
        const templateIndex = config.currentIndex % config.templateNames.length;
        const templateName = config.templateNames[templateIndex];

        console.log(`[AUTO_BC] Executing broadcast for template: ${templateName} (index: ${templateIndex})`);

        // Find the saved broadcast template
        const savedTemplate = getBroadcastTemplateByName(templateName);
        if (!savedTemplate) {
            await notifyAdmins(
                `╭───  ⚠️ *AUTO BC ERROR*  ───╮\n│\n│  Template "${templateName}" tidak ditemukan!\n│  Auto broadcast dihentikan.\n│\n╰────────────────────────╯`
            );
            saveAutoBroadcastConfig({ enabled: false });
            isExecuting = false;
            return;
        }

        // Find the group template
        const groupTemplates = getGroupTemplates();
        const groupTemplate = groupTemplates.find(
            (t) =>
                t.name.toLowerCase() === savedTemplate.groupTemplateName.toLowerCase() ||
                t.name.toLowerCase().includes(savedTemplate.groupTemplateName.toLowerCase())
        );

        if (!groupTemplate || groupTemplate.groupIds.length === 0) {
            await notifyAdmins(
                `╭───  ⚠️ *AUTO BC ERROR*  ───╮\n│\n│  Group template "${savedTemplate.groupTemplateName}"\n│  tidak ditemukan atau kosong!\n│  Auto broadcast dihentikan.\n│\n╰────────────────────────╯`
            );
            saveAutoBroadcastConfig({ enabled: false });
            isExecuting = false;
            return;
        }

        // Deduplicate group IDs
        const uniqueGroupIds = [...new Set(groupTemplate.groupIds)];
        const totalGroups = uniqueGroupIds.length;

        // Prepare message and media
        const message = savedTemplate.message;
        const hasMedia = savedTemplate.mediaType !== "text" && !!savedTemplate.mediaUrl;
        const mimetype =
            savedTemplate.mediaType === "image" ? "image/jpeg" :
                savedTemplate.mediaType === "video" ? "video/mp4" :
                    savedTemplate.mediaType === "file" ? "application/octet-stream" : "";

        let finalMediaUrl = savedTemplate.mediaUrl;

        // Convert image if needed
        if (hasMedia && mimetype.startsWith("image/") && finalMediaUrl) {
            try {
                const converted = await convertImageForBroadcast(finalMediaUrl);
                finalMediaUrl = `http://localhost:3000${converted.localUrl}`;
                cleanupOldBroadcastMedia();
            } catch (error: any) {
                console.error(`[AUTO_BC] Image conversion failed: ${error.message}`);
            }
        }

        // Notify admins that broadcast is starting
        await notifyAdmins(
            `╭━━━  🤖 *AUTO BROADCAST*  ━━━╮\n│\n│  📡 *Template:* ${savedTemplate.name}\n│  🎯 *Target:* ${groupTemplate.name}\n│  👥 *Grup:* ${totalGroups}\n│  📝 *Pesan:* _${message.substring(0, 40)}${message.length > 40 ? "..." : ""}_\n│\n╰──  _Mengirim otomatis..._  ──╯`
        );

        // Send to all groups
        let successCount = 0;
        let failCount = 0;
        const startTime = Date.now();

        // Prepare mentions for ghost mention feature
        const mentions = savedTemplate.ghostMention ? ["@everyone"] : undefined;

        for (const groupId of uniqueGroupIds) {
            try {
                if (hasMedia && finalMediaUrl) {
                    if (mimetype.startsWith("image/")) {
                        await client.sendImage(groupId, finalMediaUrl, message);
                    } else if (mimetype.startsWith("video/")) {
                        await client.sendVideo(groupId, finalMediaUrl, message);
                    } else {
                        await client.sendFile(groupId, finalMediaUrl);
                        if (message) await client.sendText(groupId, message, mentions);
                    }
                    // For image/video with ghost mention, send an extra invisible mention message
                    if (mentions && (mimetype.startsWith("image/") || mimetype.startsWith("video/"))) {
                        await client.sendText(groupId, "​", mentions); // Zero-width space with mention
                    }
                } else {
                    await client.sendText(groupId, message, mentions);
                }
                successCount++;
            } catch (e: any) {
                console.log(`[AUTO_BC] Failed for ${groupId}: ${e.message}`);
                failCount++;
            }

            // Anti-ban delay
            const delay = getRandomDelay();
            await new Promise((r) => setTimeout(r, delay));
        }

        const totalTime = Math.floor((Date.now() - startTime) / 1000);

        // Update config
        const nextIndex = (templateIndex + 1) % config.templateNames.length;
        saveAutoBroadcastConfig({
            currentIndex: nextIndex,
            lastBroadcastAt: new Date().toISOString(),
            totalSent: config.totalSent + 1,
        });

        // Notify admins of completion
        await notifyAdmins(
            `╭━━━  ✅ *AUTO BC SELESAI*  ━━━╮\n│\n│  📡 *Template:* ${savedTemplate.name}\n│  ✅ Berhasil: ${successCount}\n│  ❌ Gagal: ${failCount}\n│  ⏱️ Waktu: ${totalTime}s\n│  📊 Total sesi: #${config.totalSent + 1}\n│\n╰━━━━━━━━━━━━━━━━━━━━━╯`
        );

        console.log(`[AUTO_BC] Broadcast complete: ${successCount}/${totalGroups} success, ${failCount} failed`);
    } catch (error: any) {
        console.error("[AUTO_BC] Broadcast execution error:", error);
        await notifyAdmins(
            `╭───  ❌ *AUTO BC ERROR*  ───╮\n│\n│  ${error.message}\n│\n╰────────────────────────╯`
        );
    } finally {
        isExecuting = false;
    }

    // Schedule next broadcast (re-read config in case it was changed)
    const latestConfig = getAutoBroadcastConfig();
    if (latestConfig.enabled) {
        scheduleNext();
    }
}

/**
 * Schedule the next auto broadcast
 */
function scheduleNext(): void {
    // Clear any existing timer
    if (schedulerTimer) {
        clearTimeout(schedulerTimer);
        schedulerTimer = null;
    }

    const config = getAutoBroadcastConfig();
    if (!config.enabled) return;

    const intervalMs = getRandomInterval(config.minIntervalMinutes, config.maxIntervalMinutes);
    const nextTime = new Date(Date.now() + intervalMs);

    // Save the next broadcast time
    saveAutoBroadcastConfig({
        nextBroadcastAt: nextTime.toISOString(),
    });

    const intervalMinutes = (intervalMs / 60000).toFixed(1);
    console.log(`[AUTO_BC] Next broadcast scheduled in ${intervalMinutes} minutes at ${nextTime.toLocaleString("id-ID")}`);

    schedulerTimer = setTimeout(() => {
        executeBroadcast();
    }, intervalMs);
}

// ==================== PUBLIC API ====================

/**
 * Start auto broadcast scheduler
 */
export function startAutoBroadcast(
    templateNames: string[],
    minIntervalMinutes: number = 60,
    maxIntervalMinutes: number = 80,
    updatedBy: string = "admin"
): AutoBroadcastConfig {
    // Stop any existing scheduler
    stopAutoBroadcast();

    // Save config
    const config = saveAutoBroadcastConfig(
        {
            enabled: true,
            templateNames,
            minIntervalMinutes,
            maxIntervalMinutes,
            currentIndex: 0,
            totalSent: 0,
            lastBroadcastAt: null,
        },
        updatedBy
    );

    // Execute first broadcast immediately, then schedule next
    setTimeout(() => {
        executeBroadcast();
    }, 1000);

    return config;
}

/**
 * Stop auto broadcast scheduler
 */
export function stopAutoBroadcast(): AutoBroadcastConfig {
    if (schedulerTimer) {
        clearTimeout(schedulerTimer);
        schedulerTimer = null;
    }

    return saveAutoBroadcastConfig({
        enabled: false,
        nextBroadcastAt: null,
    });
}

/**
 * Restore auto broadcast from saved config (on bot restart)
 */
export function restoreAutoBroadcast(): void {
    const config = getAutoBroadcastConfig();
    if (config.enabled && config.templateNames.length > 0) {
        console.log("[AUTO_BC] Restoring auto broadcast from saved config...");

        // Validate that all templates still exist
        const validTemplates = config.templateNames.filter((name) => {
            const template = getBroadcastTemplateByName(name);
            return template !== null;
        });

        if (validTemplates.length === 0) {
            console.log("[AUTO_BC] No valid templates found, disabling auto broadcast.");
            saveAutoBroadcastConfig({ enabled: false });
            return;
        }

        if (validTemplates.length !== config.templateNames.length) {
            saveAutoBroadcastConfig({ templateNames: validTemplates });
        }

        // Schedule next
        scheduleNext();

        notifyAdmins(
            `╭───  🔄 *AUTO BC RESTORED*  ───╮\n│\n│  📡 Bot restart terdeteksi\n│  Auto broadcast dilanjutkan\n│  📋 Templates: ${validTemplates.join(", ")}\n│  ⏱️ Interval: ${config.minIntervalMinutes}-${config.maxIntervalMinutes} menit\n│\n╰──────────────────────────╯`
        );
    }
}

/**
 * Get formatted status for admin
 */
export function getAutoBroadcastStatus(): {
    config: AutoBroadcastConfig;
    isRunning: boolean;
    isExecuting: boolean;
    hasTimer: boolean;
    nextIn: string | null;
} {
    const config = getAutoBroadcastConfig();
    let nextIn: string | null = null;

    if (config.nextBroadcastAt) {
        const nextTime = new Date(config.nextBroadcastAt).getTime();
        const now = Date.now();
        const diffMs = nextTime - now;
        if (diffMs > 0) {
            const diffMinutes = Math.floor(diffMs / 60000);
            const diffSeconds = Math.floor((diffMs % 60000) / 1000);
            nextIn = `${diffMinutes}m ${diffSeconds}s`;
        } else {
            nextIn = "segera";
        }
    }

    return {
        config,
        isRunning: config.enabled && schedulerTimer !== null,
        isExecuting,
        hasTimer: schedulerTimer !== null,
        nextIn,
    };
}
