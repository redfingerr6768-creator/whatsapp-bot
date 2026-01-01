import fs from 'fs';
import path from 'path';

/**
 * Broadcast Message Templates Storage with File Persistence
 * Allows saving message templates for quick broadcast reuse
 */

export interface BroadcastTemplate {
    id: string;
    name: string;
    groupTemplateName: string; // Name of the group template to broadcast to
    message: string;
    mediaType: "text" | "image" | "video" | "file";
    mediaUrl?: string;
    createdAt: number;
    updatedAt: number;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'broadcast-templates.json');

// Lazy load
let templates: BroadcastTemplate[] | null = null;

function ensureInitialized() {
    if (templates) return;

    console.log("[BROADCAST_TEMPLATES] Initializing storage...");
    try {
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
        }

        if (fs.existsSync(DATA_FILE)) {
            const data = fs.readFileSync(DATA_FILE, 'utf-8');
            templates = JSON.parse(data);
        } else {
            templates = [];
            saveTemplates();
        }
    } catch (error) {
        console.error("[BROADCAST_TEMPLATES] Init failed:", error);
        templates = [];
    }
}

function saveTemplates(): void {
    if (!templates) return;
    try {
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
        }
        fs.writeFileSync(DATA_FILE, JSON.stringify(templates, null, 2), 'utf-8');
    } catch (error) {
        console.error("[BROADCAST_TEMPLATES] Failed to save:", error);
    }
}

export function getBroadcastTemplates(): BroadcastTemplate[] {
    ensureInitialized();
    return templates!;
}

export function getBroadcastTemplateById(id: string): BroadcastTemplate | null {
    ensureInitialized();
    return templates!.find(t => t.id === id) || null;
}

export function getBroadcastTemplateByName(name: string): BroadcastTemplate | null {
    ensureInitialized();
    return templates!.find(t => t.name.toLowerCase() === name.toLowerCase()) || null;
}

export function addBroadcastTemplate(
    name: string,
    groupTemplateName: string,
    message: string,
    mediaType: BroadcastTemplate['mediaType'] = 'text',
    mediaUrl?: string
): BroadcastTemplate {
    ensureInitialized();
    const now = Date.now();
    const newTemplate: BroadcastTemplate = {
        id: now.toString(),
        name,
        groupTemplateName,
        message,
        mediaType,
        mediaUrl,
        createdAt: now,
        updatedAt: now
    };
    templates!.push(newTemplate);
    saveTemplates();
    return newTemplate;
}

export function updateBroadcastTemplate(
    id: string,
    updates: Partial<Pick<BroadcastTemplate, 'name' | 'groupTemplateName' | 'message' | 'mediaType' | 'mediaUrl'>>
): BroadcastTemplate | null {
    ensureInitialized();
    const index = templates!.findIndex(t => t.id === id);
    if (index === -1) return null;

    templates![index] = {
        ...templates![index],
        ...updates,
        updatedAt: Date.now()
    };
    saveTemplates();
    return templates![index];
}

export function deleteBroadcastTemplate(id: string): boolean {
    ensureInitialized();
    const index = templates!.findIndex(t => t.id === id);
    if (index === -1) return false;

    templates!.splice(index, 1);
    saveTemplates();
    return true;
}
