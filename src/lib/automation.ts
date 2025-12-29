import fs from 'fs';
import path from 'path';

/**
 * Automation Rules Storage with File Persistence
 */

export interface AutomationRule {
    id: string;
    name: string;
    keywords: string[];
    matchType: "exact" | "contains" | "startsWith";
    reply: string;
    enabled: boolean;
    createdAt: number;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'automation.json');

// Initial default rules
const defaultRules: AutomationRule[] = [
    {
        id: "1",
        name: "Welcome Message",
        keywords: ["hi", "hello", "halo", "hai"],
        matchType: "exact",
        reply: "Hi! Welcome to our service. How can I help you today?",
        enabled: true,
        createdAt: Date.now()
    },
    {
        id: "2",
        name: "Price Info",
        keywords: ["price", "harga", "cost", "berapa"],
        matchType: "contains",
        reply: "Thank you for your interest! Please check our catalog at example.com/catalog or contact our sales team.",
        enabled: true,
        createdAt: Date.now()
    }
];

// Lazy load
let automationRules: AutomationRule[] | null = null;

function ensureInitialized() {
    if (automationRules) return;

    console.log("[AUTOMATION] Initializing storage...");
    try {
        if (!fs.existsSync(DATA_DIR)) {
            console.log("[AUTOMATION] Creating data directory:", DATA_DIR);
            fs.mkdirSync(DATA_DIR, { recursive: true });
        }

        if (fs.existsSync(DATA_FILE)) {
            console.log("[AUTOMATION] Loading rules from:", DATA_FILE);
            const data = fs.readFileSync(DATA_FILE, 'utf-8');
            automationRules = JSON.parse(data);
        } else {
            console.log("[AUTOMATION] No data file, using defaults");
            automationRules = [...defaultRules];
            saveRules(); // Save defaults
        }
    } catch (error) {
        console.error("[AUTOMATION] Init failed:", error);
        automationRules = [...defaultRules];
    }
}

function saveRules(): void {
    if (!automationRules) return;
    try {
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
        }
        fs.writeFileSync(DATA_FILE, JSON.stringify(automationRules, null, 2), 'utf-8');
        console.log("[AUTOMATION] Rules saved");
    } catch (error) {
        console.error("[AUTOMATION] Failed to save rules:", error);
    }
}

export function getAutomationRules(): AutomationRule[] {
    ensureInitialized();
    return automationRules!;
}

export function addAutomationRule(rule: Omit<AutomationRule, "id" | "createdAt">): AutomationRule {
    ensureInitialized();
    const newRule: AutomationRule = {
        ...rule,
        id: Date.now().toString(),
        createdAt: Date.now()
    };
    automationRules!.push(newRule);
    saveRules();
    return newRule;
}

export function updateAutomationRule(id: string, updates: Partial<AutomationRule>): AutomationRule | null {
    ensureInitialized();
    const index = automationRules!.findIndex(r => r.id === id);
    if (index === -1) return null;

    automationRules![index] = { ...automationRules![index], ...updates };
    saveRules();
    return automationRules![index];
}

export function deleteAutomationRule(id: string): boolean {
    ensureInitialized();
    const index = automationRules!.findIndex(r => r.id === id);
    if (index === -1) return false;

    automationRules!.splice(index, 1);
    saveRules();
    return true;
}

export function toggleAutomationRule(id: string): AutomationRule | null {
    ensureInitialized();
    const rule = automationRules!.find(r => r.id === id);
    if (!rule) return null;

    rule.enabled = !rule.enabled;
    saveRules();
    return rule;
}
