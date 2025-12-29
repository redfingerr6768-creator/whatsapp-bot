import { NextRequest, NextResponse } from "next/server";
import { getGowaClient } from "@/lib/gowa";

const GOWA_URL = process.env.GOWA_URL || "http://localhost:3030";
const GOWA_BASIC_AUTH = process.env.GOWA_BASIC_AUTH;

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");
    const groupId = searchParams.get("groupId");

    const client = getGowaClient(GOWA_URL, GOWA_BASIC_AUTH);

    try {
        if (action === "list") {
            // GOWA: Get user's groups
            const data = await client.getGroups();
            return NextResponse.json(Array.isArray(data) ? data : []);
        }

        if (action === "count") {
            const groups = await client.getGroups();
            return NextResponse.json({ count: groups.length });
        }

        if (action === "detail" && groupId) {
            const data = await client.getGroupInfo(groupId);
            return NextResponse.json(data);
        }

        if (action === "participants" && groupId) {
            const data = await client.getGroupInfo(groupId);
            return NextResponse.json(data.participants || []);
        }

        // Note: GOWA doesn't have invite code retrieval in same format
        // You would need to use getGroupInfo and extract from the group data

        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error("API Groups Error:", error);
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const body = await req.json();
    const { action, groupId, name, participants, inviteLink } = body;

    const client = getGowaClient(GOWA_URL, GOWA_BASIC_AUTH);

    try {
        if (action === "create") {
            const data = await client.createGroup(name, participants || []);
            return NextResponse.json(data);
        }

        if (action === "leave" && groupId) {
            const data = await client.leaveGroup(groupId);
            return NextResponse.json(data);
        }

        if (action === "join" && inviteLink) {
            const data = await client.joinGroup(inviteLink);
            return NextResponse.json(data);
        }

        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
