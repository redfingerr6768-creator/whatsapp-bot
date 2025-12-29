import { NextRequest, NextResponse } from "next/server";
import {
    getAdminConfig,
    addAdminNumber,
    removeAdminNumber,
    setAdminEnabled
} from "@/lib/adminConfig";

// GET - Get admin config
export async function GET(req: NextRequest) {
    const config = getAdminConfig();
    return NextResponse.json(config);
}

// POST - Manage admin config
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { action, phone, enabled } = body;

        if (action === "add" && phone) {
            const success = addAdminNumber(phone);
            if (!success) {
                return NextResponse.json({ error: "Invalid or duplicate number" }, { status: 400 });
            }
            return NextResponse.json({ success: true, config: getAdminConfig() });
        }

        if (action === "remove" && phone) {
            const success = removeAdminNumber(phone);
            if (!success) {
                return NextResponse.json({ error: "Number not found" }, { status: 404 });
            }
            return NextResponse.json({ success: true, config: getAdminConfig() });
        }

        if (action === "setEnabled" && typeof enabled === "boolean") {
            setAdminEnabled(enabled);
            return NextResponse.json({ success: true, config: getAdminConfig() });
        }

        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
