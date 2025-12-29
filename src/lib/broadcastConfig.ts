/**
 * Broadcast Configuration
 * Stores broadcast settings that can be modified by admin
 */

import fs from "fs";
import path from "path";

const CONFIG_FILE = path.join(process.cwd(), "data", "broadcast-config.json");

interface BroadcastConfig {
    minDelay: number;  // Minimum delay in ms
    maxDelay: number;  // Maximum delay in ms
    updatedAt?: string;
    updatedBy?: string;
}

const DEFAULT_CONFIG: BroadcastConfig = {
    minDelay: 2000,   // 2 seconds
    maxDelay: 5000,   // 5 seconds
};

/**
 * Get current broadcast config
 */
export function getBroadcastConfig(): BroadcastConfig {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            const data = fs.readFileSync(CONFIG_FILE, "utf-8");
            return { ...DEFAULT_CONFIG, ...JSON.parse(data) };
        }
    } catch { }
    return DEFAULT_CONFIG;
}

/**
 * Save broadcast config
 */
export function saveBroadcastConfig(config: Partial<BroadcastConfig>, updatedBy?: string): BroadcastConfig {
    const dir = path.dirname(CONFIG_FILE);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    const current = getBroadcastConfig();
    const updated: BroadcastConfig = {
        ...current,
        ...config,
        updatedAt: new Date().toISOString(),
        updatedBy: updatedBy || "admin",
    };

    fs.writeFileSync(CONFIG_FILE, JSON.stringify(updated, null, 2));
    return updated;
}

/**
 * Get random delay based on config
 */
export function getRandomDelay(): number {
    const config = getBroadcastConfig();
    const range = config.maxDelay - config.minDelay;
    return Math.floor(Math.random() * range) + config.minDelay;
}

/**
 * Set delay (in seconds for user-friendly input)
 * @param minSeconds Minimum delay in seconds
 * @param maxSeconds Maximum delay in seconds (optional, defaults to min + 3)
 */
export function setDelay(minSeconds: number, maxSeconds?: number, updatedBy?: string): BroadcastConfig {
    const minDelay = Math.max(500, minSeconds * 1000);  // Minimum 0.5s
    const maxDelay = maxSeconds ? maxSeconds * 1000 : minDelay + 3000;

    return saveBroadcastConfig({ minDelay, maxDelay }, updatedBy);
}
