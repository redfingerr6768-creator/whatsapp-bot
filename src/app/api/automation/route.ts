import { NextRequest, NextResponse } from "next/server";
import {
    getAutomationRules,
    addAutomationRule,
    updateAutomationRule,
    deleteAutomationRule,
    toggleAutomationRule,
    AutomationRule
} from "@/lib/automation";

// GET - List all rules
export async function GET(req: NextRequest) {
    const rules = getAutomationRules();
    return NextResponse.json(rules);
}

// POST - Create or update rule
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { action, id, ...data } = body;

        if (action === "create") {
            const rule = addAutomationRule({
                name: data.name || "New Rule",
                keywords: data.keywords || [],
                matchType: data.matchType || "contains",
                reply: data.reply || "",
                enabled: data.enabled ?? true
            });
            return NextResponse.json(rule);
        }

        if (action === "update" && id) {
            const rule = updateAutomationRule(id, data);
            if (!rule) {
                return NextResponse.json({ error: "Rule not found" }, { status: 404 });
            }
            return NextResponse.json(rule);
        }

        if (action === "toggle" && id) {
            const rule = toggleAutomationRule(id);
            if (!rule) {
                return NextResponse.json({ error: "Rule not found" }, { status: 404 });
            }
            return NextResponse.json(rule);
        }

        if (action === "delete" && id) {
            const success = deleteAutomationRule(id);
            if (!success) {
                return NextResponse.json({ error: "Rule not found" }, { status: 404 });
            }
            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
