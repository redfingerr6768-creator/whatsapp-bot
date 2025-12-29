import { NextRequest, NextResponse } from "next/server";
import { getGowaClient } from "@/lib/gowa";

const GOWA_URL = process.env.GOWA_URL || "http://localhost:3030";
const GOWA_BASIC_AUTH = process.env.GOWA_BASIC_AUTH;

export async function POST(req: NextRequest) {
    const body = await req.json();
    const { action, chatId, text, imageUrl, fileUrl, videoUrl, caption } = body;

    const client = getGowaClient(GOWA_URL, GOWA_BASIC_AUTH);

    try {
        if (action === "sendText") {
            const data = await client.sendText(chatId, text);
            return NextResponse.json(data);
        }

        if (action === "sendImage") {
            const data = await client.sendImage(chatId, imageUrl, caption);
            return NextResponse.json(data);
        }

        if (action === "sendVideo") {
            const data = await client.sendVideo(chatId, videoUrl, caption);
            return NextResponse.json(data);
        }

        if (action === "sendFile") {
            const data = await client.sendFile(chatId, fileUrl);
            return NextResponse.json(data);
        }

        if (action === "sendSticker") {
            const data = await client.sendImageAsSticker(chatId, imageUrl);
            return NextResponse.json(data);
        }

        if (action === "markRead") {
            const messageId = body.messageId;
            const data = await client.markAsRead(chatId, messageId);
            return NextResponse.json(data);
        }

        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
