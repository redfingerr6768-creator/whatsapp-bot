import fs from 'fs';
import path from 'path';

/**
 * Admin Configuration Storage
 * Manages admin phone numbers who can control the bot via WhatsApp
 */

export interface AdminConfig {
    adminNumbers: string[];  // Phone numbers without @ suffix, e.g. "628123456789"
    enabled: boolean;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'admin-config.json');

// Default config
const DEFAULT_CONFIG: AdminConfig = {
    adminNumbers: [],
    enabled: true
};

let config: AdminConfig | null = null;

function ensureInitialized(): void {
    if (config) return;

    console.log("[ADMIN_CONFIG] Initializing...");
    try {
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
        }

        if (fs.existsSync(DATA_FILE)) {
            const data = fs.readFileSync(DATA_FILE, 'utf-8');
            config = JSON.parse(data);
        } else {
            config = { ...DEFAULT_CONFIG };
            saveConfig();
        }
    } catch (error) {
        console.error("[ADMIN_CONFIG] Init failed:", error);
        config = { ...DEFAULT_CONFIG };
    }
}

function saveConfig(): void {
    if (!config) return;
    try {
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
        }
        fs.writeFileSync(DATA_FILE, JSON.stringify(config, null, 2), 'utf-8');
    } catch (error) {
        console.error("[ADMIN_CONFIG] Failed to save:", error);
    }
}

export function getAdminConfig(): AdminConfig {
    ensureInitialized();
    return { ...config! };
}

export function isAdmin(phone: string): boolean {
    ensureInitialized();
    if (!config!.enabled) return false;

    // Normalize phone number - remove @s.whatsapp.net, @c.us, leading +, etc.
    const normalizedPhone = phone
        .replace(/@s\.whatsapp\.net$/, '')
        .replace(/@c\.us$/, '')
        .replace(/@.*$/, '')
        .replace(/^\+/, '')
        .replace(/\D/g, '');

    return config!.adminNumbers.some(admin => {
        const normalizedAdmin = admin.replace(/\D/g, '');
        return normalizedPhone === normalizedAdmin ||
            normalizedPhone.endsWith(normalizedAdmin) ||
            normalizedAdmin.endsWith(normalizedPhone);
    });
}

export function addAdminNumber(phone: string): boolean {
    ensureInitialized();
    const normalized = phone.replace(/\D/g, '');
    if (!normalized || config!.adminNumbers.includes(normalized)) {
        return false;
    }
    config!.adminNumbers.push(normalized);
    saveConfig();
    return true;
}

export function removeAdminNumber(phone: string): boolean {
    ensureInitialized();
    const normalized = phone.replace(/\D/g, '');
    const index = config!.adminNumbers.indexOf(normalized);
    if (index === -1) return false;

    config!.adminNumbers.splice(index, 1);
    saveConfig();
    return true;
}

export function setAdminEnabled(enabled: boolean): void {
    ensureInitialized();
    config!.enabled = enabled;
    saveConfig();
}

export function getAdminNumbers(): string[] {
    ensureInitialized();
    return [...config!.adminNumbers];
}
