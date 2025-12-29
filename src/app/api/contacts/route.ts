import { NextRequest, NextResponse } from "next/server";
import { getGowaClient } from "@/lib/gowa";

const GOWA_URL = process.env.GOWA_URL || "http://localhost:3030";
const GOWA_BASIC_AUTH = process.env.GOWA_BASIC_AUTH;

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");
    const phone = searchParams.get("phone");

    const client = getGowaClient(GOWA_URL, GOWA_BASIC_AUTH);

    try {
        if (action === "list") {
            const data = await client.getContacts();
            return NextResponse.json(Array.isArray(data) ? data : []);
        }

        if (action === "check" && phone) {
            const data = await client.checkNumber(phone);
            return NextResponse.json(data);
        }

        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
