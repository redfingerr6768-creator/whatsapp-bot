/**
 * Groq AI Client Wrapper
 * Manages multiple API keys with rotation for load balancing
 */

export interface GroqConfig {
    apiKeys: string[];
    currentKeyIndex: number;
    systemPrompt: string;
    model: string;
    enabled: boolean;
}

// In-memory storage (in production, use database)
let groqConfig: GroqConfig = {
    apiKeys: [
        "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",
        "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",
        "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",
        "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",
        "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",
        "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",
        "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",
        "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",
        "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",
        "gsk_BDSIANXzvyx4pACax2QWGdyb3FYksZZPMaX1cUx7ct3T1VvwmCJ"
    ],
    currentKeyIndex: 0,
    systemPrompt: `Kamu adalah asisten virtual WhatsApp yang ramah dan membantu.
Jawab pertanyaan dengan singkat, jelas, dan sopan.
Gunakan bahasa yang sama dengan user (Indonesia/English).
Jika tidak tahu jawabannya, akui dengan jujur.
Jangan membuat informasi palsu.`,
    model: "llama-3.1-8b-instant",
    enabled: true
};

export function getGroqConfig(): GroqConfig {
    return { ...groqConfig };
}

export function updateGroqConfig(updates: Partial<GroqConfig>): GroqConfig {
    groqConfig = { ...groqConfig, ...updates };
    return groqConfig;
}

export function addApiKey(key: string): void {
    if (!groqConfig.apiKeys.includes(key)) {
        groqConfig.apiKeys.push(key);
    }
}

export function removeApiKey(key: string): void {
    groqConfig.apiKeys = groqConfig.apiKeys.filter(k => k !== key);
    if (groqConfig.currentKeyIndex >= groqConfig.apiKeys.length) {
        groqConfig.currentKeyIndex = 0;
    }
}

// Rotate to next API key
function rotateApiKey(): string {
    if (groqConfig.apiKeys.length === 0) {
        throw new Error("No Groq API keys configured");
    }
    const key = groqConfig.apiKeys[groqConfig.currentKeyIndex];
    groqConfig.currentKeyIndex = (groqConfig.currentKeyIndex + 1) % groqConfig.apiKeys.length;
    return key;
}

export interface ChatMessage {
    role: "system" | "user" | "assistant";
    content: string;
}

export async function generateAIResponse(userMessage: string, conversationHistory: ChatMessage[] = []): Promise<string> {
    if (!groqConfig.enabled) {
        throw new Error("AI is disabled");
    }

    if (groqConfig.apiKeys.length === 0) {
        throw new Error("No API keys configured");
    }

    // Build messages array
    const messages: ChatMessage[] = [
        { role: "system", content: groqConfig.systemPrompt },
        ...conversationHistory,
        { role: "user", content: userMessage }
    ];

    // Try all API keys before giving up
    const maxRetries = groqConfig.apiKeys.length;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        const apiKey = rotateApiKey();

        try {
            const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: groqConfig.model,
                    messages: messages,
                    temperature: 0.7,
                    max_tokens: 500
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`Groq API Error (${response.status}) with key ${attempt + 1}:`, errorText);

                // On 401 (Unauthorized) or 429 (Rate Limited), try next key
                if (response.status === 401 || response.status === 429) {
                    console.log(`Key ${attempt + 1} failed with ${response.status}, trying next key...`);
                    lastError = new Error(`Groq API Error: ${response.status}`);
                    continue; // Try next key
                }

                throw new Error(`Groq API Error: ${response.status}`);
            }

            const data = await response.json();
            const aiMessage = data.choices?.[0]?.message?.content;

            if (!aiMessage) {
                throw new Error("No response from AI");
            }

            return aiMessage.trim();
        } catch (error) {
            console.error(`Groq API request failed (attempt ${attempt + 1}):`, error);
            lastError = error instanceof Error ? error : new Error("Unknown error");

            // Continue to next key on network errors
            if (attempt < maxRetries - 1) {
                console.log(`Retrying with next API key...`);
                continue;
            }
        }
    }

    // All keys failed
    throw lastError || new Error("All Groq API keys failed");
}
