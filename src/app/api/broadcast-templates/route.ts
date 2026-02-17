import { NextRequest, NextResponse } from "next/server";
import {
    getBroadcastTemplates,
    getBroadcastTemplateById,
    addBroadcastTemplate,
    updateBroadcastTemplate,
    deleteBroadcastTemplate
} from "@/lib/broadcastTemplates";

export async function GET() {
    try {
        const templates = getBroadcastTemplates();
        return NextResponse.json(templates);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { action, id, name, groupTemplateName, message, mediaType, mediaUrl, ghostMention } = body;

        switch (action) {
            case "create":
                if (!name || !groupTemplateName || !message) {
                    return NextResponse.json({ error: "Name, groupTemplateName, and message are required" }, { status: 400 });
                }
                const newTemplate = addBroadcastTemplate(name, groupTemplateName, message, mediaType || 'text', mediaUrl, ghostMention ?? false);
                return NextResponse.json(newTemplate);

            case "update":
                if (!id) {
                    return NextResponse.json({ error: "ID is required" }, { status: 400 });
                }
                const updates: any = { name, groupTemplateName, message, mediaType, mediaUrl };
                if (ghostMention !== undefined) updates.ghostMention = ghostMention;
                const updated = updateBroadcastTemplate(id, updates);
                if (!updated) {
                    return NextResponse.json({ error: "Template not found" }, { status: 404 });
                }
                return NextResponse.json(updated);

            case "delete":
                if (!id) {
                    return NextResponse.json({ error: "ID is required" }, { status: 400 });
                }
                const deleted = deleteBroadcastTemplate(id);
                if (!deleted) {
                    return NextResponse.json({ error: "Template not found" }, { status: 404 });
                }
                return NextResponse.json({ success: true });

            case "get":
                if (!id) {
                    return NextResponse.json({ error: "ID is required" }, { status: 400 });
                }
                const template = getBroadcastTemplateById(id);
                if (!template) {
                    return NextResponse.json({ error: "Template not found" }, { status: 404 });
                }
                return NextResponse.json(template);

            default:
                return NextResponse.json({ error: "Invalid action" }, { status: 400 });
        }
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
