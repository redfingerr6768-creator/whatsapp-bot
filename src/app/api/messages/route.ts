import { NextRequest, NextResponse } from "next/server";
import { getGowaClient } from "@/lib/gowa";
import { convertImageForBroadcast, cleanupOldBroadcastMedia } from "@/lib/broadcastMedia";

const GOWA_URL = process.env.GOWA_URL || "http://localhost:3030";
const GOWA_BASIC_AUTH = process.env.GOWA_BASIC_AUTH;

// Extensions that GOWA doesn't support for images
const UNSUPPORTED_IMAGE_EXTS = [".jfif", ".jpe", ".pjpeg", ".pjp"];

function hasUnsupportedExt(url: string): boolean {
    const base = url.split("?")[0].toLowerCase();
    return UNSUPPORTED_IMAGE_EXTS.some(ext => base.endsWith(ext));
}

export async function POST(req: NextRequest) {
    const body = await req.json();
    const { action, chatId, text, imageUrl, fileUrl, videoUrl, caption, mentions } = body;

    const client = getGowaClient(GOWA_URL, GOWA_BASIC_AUTH);

    try {
        if (action === "sendText") {
            const data = await client.sendText(chatId, text, mentions);
            return NextResponse.json(data);
        }

        if (action === "sendImage") {
            let finalImageUrl = imageUrl;

            // Convert unsupported image formats (e.g. .jfif) to JPEG
            if (hasUnsupportedExt(imageUrl)) {
                try {
                    const converted = await convertImageForBroadcast(imageUrl);
                    finalImageUrl = `http://localhost:3000${converted.localUrl}`;
                    cleanupOldBroadcastMedia();
                } catch (convErr: any) {
                    console.error("[API] Image conversion failed:", convErr.message);
                    // Try sending original URL as fallback
                }
            }

            const data = await client.sendImage(chatId, finalImageUrl, caption);
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
