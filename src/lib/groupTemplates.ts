import fs from 'fs';
import path from 'path';

/**
 * Group Templates Storage with File Persistence
 * Allows saving named lists of groups for quick broadcast selection
 */

export interface GroupTemplate {
    id: string;
    name: string;
    groupIds: string[];
    createdAt: number;
    updatedAt: number;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'group-templates.json');

// Lazy load
let templates: GroupTemplate[] | null = null;

function ensureInitialized() {
    if (templates) return;

    console.log("[GROUP_TEMPLATES] Initializing storage...");
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
        console.error("[GROUP_TEMPLATES] Init failed:", error);
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
        console.error("[GROUP_TEMPLATES] Failed to save:", error);
    }
}

export function getGroupTemplates(): GroupTemplate[] {
    ensureInitialized();
    return templates!;
}

export function getTemplateById(id: string): GroupTemplate | null {
    ensureInitialized();
    return templates!.find(t => t.id === id) || null;
}

export function addGroupTemplate(name: string, groupIds: string[]): GroupTemplate {
    ensureInitialized();
    const now = Date.now();
    const newTemplate: GroupTemplate = {
        id: now.toString(),
        name,
        groupIds,
        createdAt: now,
        updatedAt: now
    };
    templates!.push(newTemplate);
    saveTemplates();
    return newTemplate;
}

export function updateGroupTemplate(id: string, updates: Partial<Pick<GroupTemplate, 'name' | 'groupIds'>>): GroupTemplate | null {
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

export function deleteGroupTemplate(id: string): boolean {
    ensureInitialized();
    const index = templates!.findIndex(t => t.id === id);
    if (index === -1) return false;

    templates!.splice(index, 1);
    saveTemplates();
    return true;
}
