export class WahaClient {
    private baseUrl: string;
    private apiKey?: string;

    constructor(baseUrl: string, apiKey?: string) {
        this.baseUrl = baseUrl.replace(/\/$/, ""); // Remove trailing slash
        this.apiKey = apiKey;
    }

    private async request(endpoint: string, options: RequestInit = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
            ...(this.apiKey ? { "X-Api-Key": this.apiKey } : {}),
            ...((options.headers as Record<string, string>) || {}),
        };

        try {
            const res = await fetch(url, { ...options, headers });
            if (!res.ok) {
                const text = await res.text();
                throw new Error(`WAHA Error (${res.status}): ${text}`);
            }
            return res.json();
        } catch (error) {
            console.error("WAHA Request Failed:", error);
            throw error;
        }
    }

    // ==================== SESSION ====================
    async getSessions() {
        return this.request("/api/sessions?all=true");
    }

    async startSession(name: string, webhookUrl?: string) {
        const config: any = { proxy: null, webhooks: [] };

        // Add webhook if URL provided
        if (webhookUrl) {
            config.webhooks = [{
                url: webhookUrl,
                events: ["message"]
            }];
        }

        return this.request("/api/sessions", {
            method: "POST",
            body: JSON.stringify({ name, config }),
        });
    }

    async stopSession(name: string) {
        return this.request(`/api/sessions/${name}/stop`, { method: "POST" });
    }

    async logout(name: string) {
        return this.request(`/api/sessions/${name}/logout`, { method: "POST" });
    }

    async getMe(name: string) {
        return this.request(`/api/sessions/${name}/me`);
    }

    async getQR(name: string) {
        const url = `${this.baseUrl}/api/sessions/${name}/auth/qr?format=image`;
        const headers: Record<string, string> = {
            ...(this.apiKey ? { "X-Api-Key": this.apiKey } : {}),
        };
        const res = await fetch(url, { headers });
        if (!res.ok) throw new Error("Failed to fetch QR");
        return res.blob();
    }

    async getScreenshot(name: string) {
        const url = `${this.baseUrl}/api/sessions/${name}/screenshot`;
        const headers: Record<string, string> = {
            ...(this.apiKey ? { "X-Api-Key": this.apiKey } : {}),
        };
        const res = await fetch(url, { headers });
        if (!res.ok) throw new Error("Failed to fetch screenshot");
        return res.blob();
    }

    // ==================== GROUPS ====================
    async getGroups(session: string, limit = 100, offset = 0) {
        return this.request(`/api/${session}/groups?limit=${limit}&offset=${offset}`);
    }

    async getGroupsCount(session: string) {
        return this.request(`/api/${session}/groups/count`);
    }

    async getGroup(session: string, groupId: string) {
        const encodedId = encodeURIComponent(groupId);
        return this.request(`/api/${session}/groups/${encodedId}`);
    }

    async getGroupParticipants(session: string, groupId: string) {
        const encodedId = encodeURIComponent(groupId);
        return this.request(`/api/${session}/groups/${encodedId}/participants/v2`);
    }

    async createGroup(session: string, name: string, participants: string[]) {
        return this.request(`/api/${session}/groups`, {
            method: "POST",
            body: JSON.stringify({
                name,
                participants: participants.map(id => ({ id }))
            }),
        });
    }

    async leaveGroup(session: string, groupId: string) {
        const encodedId = encodeURIComponent(groupId);
        return this.request(`/api/${session}/groups/${encodedId}/leave`, { method: "POST" });
    }

    async getGroupInviteCode(session: string, groupId: string) {
        const encodedId = encodeURIComponent(groupId);
        return this.request(`/api/${session}/groups/${encodedId}/invite-code`);
    }

    async joinGroup(session: string, inviteCode: string) {
        return this.request(`/api/${session}/groups/join`, {
            method: "POST",
            body: JSON.stringify({ code: inviteCode }),
        });
    }

    // ==================== MESSAGING ====================
    // Note: WAHA messaging endpoints use /api/sendX format with session in body
    async sendText(session: string, chatId: string, text: string) {
        return this.request(`/api/sendText`, {
            method: "POST",
            body: JSON.stringify({ session, chatId, text }),
        });
    }

    async sendImage(session: string, chatId: string, imageUrl: string, caption?: string) {
        return this.request(`/api/sendImage`, {
            method: "POST",
            body: JSON.stringify({
                session,
                chatId,
                file: { url: imageUrl },
                caption: caption || "",
            }),
        });
    }

    async sendFile(session: string, chatId: string, fileUrl: string, caption?: string) {
        return this.request(`/api/sendFile`, {
            method: "POST",
            body: JSON.stringify({
                session,
                chatId,
                file: { url: fileUrl },
                caption: caption || "",
            }),
        });
    }

    async sendSeen(session: string, chatId: string) {
        return this.request(`/api/sendSeen`, {
            method: "POST",
            body: JSON.stringify({ session, chatId }),
        });
    }

    // ==================== STICKERS ====================
    async sendImageAsSticker(session: string, chatId: string, imageData: string, mimeType: string = "image/webp") {
        // imageData can be base64 or URL
        const isUrl = imageData.startsWith("http");
        return this.request(`/api/sendImageAsSticker`, {
            method: "POST",
            body: JSON.stringify({
                session,
                chatId,
                file: isUrl ? { url: imageData } : { data: imageData, mimetype: mimeType }
            }),
        });
    }

    async sendVideoAsSticker(session: string, chatId: string, videoData: string) {
        const isUrl = videoData.startsWith("http");
        return this.request(`/api/sendVideoAsSticker`, {
            method: "POST",
            body: JSON.stringify({
                session,
                chatId,
                file: isUrl ? { url: videoData } : { data: videoData, mimetype: "video/mp4" }
            }),
        });
    }

    async sendVideo(session: string, chatId: string, videoUrl: string, caption?: string) {
        return this.request(`/api/sendVideo`, {
            method: "POST",
            body: JSON.stringify({
                session,
                chatId,
                file: { url: videoUrl },
                caption: caption || "",
            }),
        });
    }

    // ==================== CONTACTS / CHATS ====================
    async getChats(session: string, limit = 100, offset = 0) {
        return this.request(`/api/${session}/chats?limit=${limit}&offset=${offset}`);
    }

    async getContacts(session: string, limit = 1000, offset = 0) {
        // WAHA uses /api/contacts/all with session as query param
        return this.request(`/api/contacts/all?session=${session}&limit=${limit}&offset=${offset}`);
    }

    async checkNumberStatus(session: string, phone: string) {
        // WAHA uses /api/contacts/check-exists with session as query param
        return this.request(`/api/contacts/check-exists?session=${session}&phone=${encodeURIComponent(phone)}`);
    }

    // ==================== MESSAGES ====================
    async getMessages(session: string, chatId: string, limit = 50) {
        const encodedId = encodeURIComponent(chatId);
        return this.request(`/api/${session}/chats/${encodedId}/messages?limit=${limit}`);
    }
}

// Singleton or factory could go here, but for now we export the class

