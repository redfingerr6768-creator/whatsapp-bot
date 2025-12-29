import { NextRequest, NextResponse } from "next/server";
import {
    getGroupTemplates,
    getTemplateById,
    addGroupTemplate,
    updateGroupTemplate,
    deleteGroupTemplate,
    GroupTemplate
} from "@/lib/groupTemplates";

// GET - List all templates
export async function GET(req: NextRequest) {
    const templates = getGroupTemplates();
    return NextResponse.json(templates);
}

// POST - Create, Update, or Delete template
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { action, id, name, groupIds } = body;

        if (action === "create") {
            if (!name || !groupIds || !Array.isArray(groupIds)) {
                return NextResponse.json({ error: "Name and groupIds required" }, { status: 400 });
            }
            const template = addGroupTemplate(name, groupIds);
            return NextResponse.json(template);
        }

        if (action === "update" && id) {
            const template = updateGroupTemplate(id, { name, groupIds });
            if (!template) {
                return NextResponse.json({ error: "Template not found" }, { status: 404 });
            }
            return NextResponse.json(template);
        }

        if (action === "delete" && id) {
            const success = deleteGroupTemplate(id);
            if (!success) {
                return NextResponse.json({ error: "Template not found" }, { status: 404 });
            }
            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
