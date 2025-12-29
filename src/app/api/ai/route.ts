import { NextRequest, NextResponse } from "next/server";
import { getGroqConfig, updateGroqConfig, addApiKey, removeApiKey, generateAIResponse } from "@/lib/groq";

// GET - Get current AI config
export async function GET(req: NextRequest) {
    const config = getGroqConfig();
    // Don't expose full API keys, just show masked versions
    return NextResponse.json({
        ...config,
        apiKeys: config.apiKeys.map(k => k.substring(0, 10) + "..." + k.substring(k.length - 4))
    });
}

// POST - Update AI config or test AI
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { action } = body;

        if (action === "update") {
            const { systemPrompt, model, enabled } = body;
            const config = updateGroqConfig({
                ...(systemPrompt !== undefined && { systemPrompt }),
                ...(model !== undefined && { model }),
                ...(enabled !== undefined && { enabled })
            });
            return NextResponse.json({
                success: true, config: {
                    ...config,
                    apiKeys: config.apiKeys.map(k => k.substring(0, 10) + "...")
                }
            });
        }

        if (action === "addKey") {
            const { key } = body;
            if (!key || !key.startsWith("gsk_")) {
                return NextResponse.json({ error: "Invalid API key format" }, { status: 400 });
            }
            addApiKey(key);
            return NextResponse.json({ success: true, keyCount: getGroqConfig().apiKeys.length });
        }

        if (action === "removeKey") {
            const { index } = body;
            const config = getGroqConfig();
            if (index >= 0 && index < config.apiKeys.length) {
                removeApiKey(config.apiKeys[index]);
            }
            return NextResponse.json({ success: true, keyCount: getGroqConfig().apiKeys.length });
        }

        if (action === "setKeys") {
            const { keys } = body;
            if (Array.isArray(keys)) {
                updateGroqConfig({ apiKeys: keys.filter(k => k.startsWith("gsk_")), currentKeyIndex: 0 });
            }
            return NextResponse.json({ success: true, keyCount: getGroqConfig().apiKeys.length });
        }

        if (action === "test") {
            const { message } = body;
            const response = await generateAIResponse(message || "Hello, siapa kamu?");
            return NextResponse.json({ success: true, response });
        }

        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
