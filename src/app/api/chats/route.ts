import { NextRequest, NextResponse } from "next/server";
import { getGowaClient } from "@/lib/gowa";

const GOWA_URL = process.env.GOWA_URL || "http://localhost:3030";
const GOWA_BASIC_AUTH = process.env.GOWA_BASIC_AUTH;

/**
 * GOWA doesn't have a chat history endpoint like WAHA.
 * We provide a simplified chat list using contacts + groups.
 */
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");
    const chatId = searchParams.get("chatId");

    const client = getGowaClient(GOWA_URL, GOWA_BASIC_AUTH);

    try {
        if (action === "list") {
            // Build chat list from contacts and groups
            const chats: any[] = [];

            try {
                const contacts = await client.getContacts();
                contacts.forEach(c => {
                    chats.push({
                        id: c.jid,
                        name: c.name || c.notify || c.jid?.split("@")[0],
                        isGroup: false
                    });
                });
            } catch (e) {
                // Contacts may fail if not synced yet
            }

            try {
                const groups = await client.getGroups();
                groups.forEach(g => {
                    chats.push({
                        id: g.jid,
                        name: g.name || g.jid?.split("@")[0],
                        isGroup: true
                    });
                });
            } catch (e) {
                // Groups may fail
            }

            return NextResponse.json(chats);
        }

        if (action === "messages" && chatId) {
            // GOWA doesn't support fetching message history
            // Return empty array with notice
            return NextResponse.json([]);
        }

        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
