import { NextRequest, NextResponse } from "next/server";
import { getGowaClient } from "@/lib/gowa";

const GOWA_URL = process.env.GOWA_URL || "http://localhost:3030";
const GOWA_BASIC_AUTH = process.env.GOWA_BASIC_AUTH;

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");

    const client = getGowaClient(GOWA_URL, GOWA_BASIC_AUTH);

    try {
        if (action === "sessions" || action === "devices") {
            // GOWA: Get connected devices
            const data = await client.getDevices();
            return NextResponse.json(Array.isArray(data) ? data : []);
        }

        if (action === "qr") {
            // GOWA: Login returns QR link, not blob
            const data = await client.login();
            return NextResponse.json({ qr_link: data.qr_link, qr_duration: data.qr_duration });
        }

        if (action === "me") {
            // GOWA: Get user info (our own number)
            const devices = await client.getDevices();
            if (devices.length > 0) {
                return NextResponse.json({
                    name: devices[0].name,
                    device: devices[0].device,
                    connected: true
                });
            }
            return NextResponse.json({ connected: false });
        }

        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const body = await req.json();
    const { action, config } = body;

    // Update server config (Temporary in-memory) - kept for compatibility
    if (action === "config") {
        // GOWA config is done via environment variables
        return NextResponse.json({
            success: true,
            message: "GOWA config is managed via environment variables",
            url: GOWA_URL
        });
    }

    const client = getGowaClient(GOWA_URL, GOWA_BASIC_AUTH);

    try {
        if (action === "start" || action === "login") {
            // GOWA: Login and get QR
            const data = await client.login();
            return NextResponse.json(data);
        }

        if (action === "reconnect") {
            await client.reconnect();
            return NextResponse.json({ success: true });
        }

        if (action === "logout") {
            await client.logout();
            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
