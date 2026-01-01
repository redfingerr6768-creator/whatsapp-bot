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
        const { action, id, name, message, mediaType, mediaUrl } = body;

        switch (action) {
            case "create":
                if (!name || !message) {
                    return NextResponse.json({ error: "Name and message are required" }, { status: 400 });
                }
                const newTemplate = addBroadcastTemplate(name, message, mediaType || 'text', mediaUrl);
                return NextResponse.json(newTemplate);

            case "update":
                if (!id) {
                    return NextResponse.json({ error: "ID is required" }, { status: 400 });
                }
                const updated = updateBroadcastTemplate(id, { name, message, mediaType, mediaUrl });
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
