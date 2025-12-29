/**
 * Conversation History Storage
 * Stores recent messages per chat for AI context
 */

export interface ConversationMessage {
    role: "user" | "assistant";
    content: string;
    timestamp: number;
}

// In-memory storage (in production, use Redis or database)
const conversationHistory: Map<string, ConversationMessage[]> = new Map();

// Max messages to keep per conversation
const MAX_HISTORY_LENGTH = 10;

// Max age in milliseconds (30 minutes)
const MAX_HISTORY_AGE = 30 * 60 * 1000;

/**
 * Get conversation history for a chat
 */
export function getConversationHistory(chatId: string): ConversationMessage[] {
    const history = conversationHistory.get(chatId) || [];

    // Filter out old messages
    const now = Date.now();
    const recentHistory = history.filter(msg => (now - msg.timestamp) < MAX_HISTORY_AGE);

    // Update storage with filtered history
    if (recentHistory.length !== history.length) {
        conversationHistory.set(chatId, recentHistory);
    }

    return recentHistory;
}

/**
 * Add a message to conversation history
 */
export function addToConversationHistory(chatId: string, role: "user" | "assistant", content: string): void {
    const history = conversationHistory.get(chatId) || [];

    history.push({
        role,
        content,
        timestamp: Date.now()
    });

    // Keep only the last N messages
    if (history.length > MAX_HISTORY_LENGTH) {
        history.splice(0, history.length - MAX_HISTORY_LENGTH);
    }

    conversationHistory.set(chatId, history);
}

/**
 * Clear conversation history for a chat
 */
export function clearConversationHistory(chatId: string): void {
    conversationHistory.delete(chatId);
}

/**
 * Get all active conversations count
 */
export function getActiveConversationsCount(): number {
    return conversationHistory.size;
}

/**
 * Convert to format expected by Groq API
 */
export function getHistoryForAI(chatId: string): Array<{ role: "user" | "assistant"; content: string }> {
    const history = getConversationHistory(chatId);
    return history.map(msg => ({
        role: msg.role,
        content: msg.content
    }));
}
