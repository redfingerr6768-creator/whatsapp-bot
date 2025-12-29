/**
 * GOWA Client - Go WhatsApp Multi-Device API Client
 * Docs: https://github.com/aldinokemal/go-whatsapp-web-multidevice
 */

export interface GowaResponse<T = unknown> {
    code: number;
    message: string;
    results?: T;
}

export interface Device {
    name: string;
    device: string;
}

export interface GroupInfo {
    jid: string;
    name: string;
    topic: string;
    participants: Array<{
        jid: string;
        isAdmin: boolean;
        isSuperAdmin: boolean;
    }>;
}

export interface ContactInfo {
    jid: string;
    name: string;
    notify: string;
}

export class GowaClient {
    private baseUrl: string;
    private authHeader?: string;

    constructor(baseUrl: string, basicAuth?: string) {
        this.baseUrl = baseUrl.replace(/\/$/, ""); // Remove trailing slash
        if (basicAuth) {
            this.authHeader = "Basic " + Buffer.from(basicAuth).toString("base64");
        }
    }

    public async request(
        endpoint: string,
        options: RequestInit = {},
        isFormData: boolean = false
    ): Promise<any> {
        const url = `${this.baseUrl}${endpoint}`;
        const headers: Record<string, string> = {
            ...(this.authHeader ? { Authorization: this.authHeader } : {}),
            ...((options.headers as Record<string, string>) || {}),
        };

        if (!isFormData) {
            headers["Content-Type"] = "application/json";
        }

        let response: Response | undefined;
        let lastError: any;
        const maxRetries = 3;
        const baseDelay = 1000;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                if (attempt > 0) {
                    const delay = baseDelay * Math.pow(2, attempt - 1);
                    console.log(`[GOWA] Retry attempt ${attempt}/${maxRetries} for ${endpoint} after ${delay}ms`);
                    await new Promise((resolve) => setTimeout(resolve, delay));
                }

                response = await fetch(url, { ...options, headers });

                if (response.status >= 500) {
                    throw new Error(`Server Error ${response.status}`);
                }
                break;
            } catch (error) {
                lastError = error;
                if (attempt === maxRetries) {
                    console.error(`[GOWA] Failed after ${maxRetries} retries: ${endpoint}`, error);
                }
            }
        }

        if (!response) {
            throw lastError || new Error("Network request failed");
        }

        let text = "";
        try {
            text = await response.text();
        } catch (e) {
            throw new Error("Failed to read GOWA response body");
        }

        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            console.error("[GOWA] Parse error. Raw response:", text);
            throw new Error(`Invalid JSON from GOWA (Status ${response.status}): ${(text || "").substring(0, 200)}`);
        }

        if (data.code && data.code !== "SUCCESS") {
            throw new Error(`GOWA Error: ${data.code} - ${data.message}`);
        }

        return data;
    }

    private createFormData(fields: Record<string, string | Blob>): FormData {
        const formData = new FormData();
        for (const [key, value] of Object.entries(fields)) {
            if (value !== undefined && value !== null && value !== "") {
                formData.append(key, value);
            }
        }
        return formData;
    }

    // ==================== APP / LOGIN ====================
    async login(): Promise<{ qr_link: string; qr_duration: number }> {
        const res = await this.request("/app/login", { method: "GET" });
        return (res as GowaResponse<{ qr_link: string; qr_duration: number }>).results!;
    }

    async loginWithCode(phone: string): Promise<{ code: string }> {
        const res = await this.request(`/app/login-with-code?phone=${encodeURIComponent(phone)}`, {
            method: "GET",
        });
        return (res as GowaResponse<{ code: string }>).results!;
    }

    async logout(): Promise<void> {
        await this.request("/app/logout", { method: "GET" });
    }

    async reconnect(): Promise<void> {
        await this.request("/app/reconnect", { method: "GET" });
    }

    async getDevices(): Promise<Device[]> {
        const res = await this.request("/app/devices", { method: "GET" });
        return (res as GowaResponse<Device[]>).results || [];
    }

    // ==================== USER ====================
    async getUserInfo(phone: string): Promise<unknown> {
        const res = await this.request(`/user/info?phone=${encodeURIComponent(phone)}`, {
            method: "GET",
        });
        return (res as GowaResponse).results;
    }

    async checkNumber(phone: string): Promise<{ on_whatsapp: boolean; jid: string }> {
        const res = await this.request(`/user/check?phone=${encodeURIComponent(phone)}`, {
            method: "GET",
        });
        return (res as GowaResponse<{ on_whatsapp: boolean; jid: string }>).results!;
    }

    async getContacts(): Promise<ContactInfo[]> {
        // @ts-ignore
        const res: any = await this.request("/user/my/contacts", { method: "GET", cache: "no-store" });
        let results = res.results || (res.data && res.data.results);

        if (!Array.isArray(results)) {
            if (results && typeof results === "object") {
                if (results.jid || results.id || results.phone) {
                    results = [results];
                } else {
                    const values = Object.values(results);
                    if (values.length > 0 && typeof values[0] === "object") {
                        results = values;
                    } else {
                        results = [];
                    }
                }
            } else {
                results = [];
            }
        }

        if (Array.isArray(results) && results.length > 0 && Array.isArray(results[0])) {
            // @ts-ignore
            results = results.flat();
        }

        // Normalize keys (GOWA returns PascalCase JID, Name, etc.)
        // @ts-ignore
        return results.map((c: any) => ({
            ...c,
            id: c.JID || c.jid || c.id,
            jid: c.JID || c.jid,
            name: c.Name || c.name || c.notify,
            notify: c.Name || c.notify || c.name,
            phone: c.Phone || c.phone || (c.JID ? c.JID.split("@")[0] : "")
        }));
    }

    async getGroups(): Promise<GroupInfo[]> {
        // @ts-ignore
        const res: any = await this.request("/user/my/groups", { method: "GET", cache: "no-store" });
        let results = res.results || (res.data && res.data.results);

        if (!Array.isArray(results)) {
            if (results && typeof results === "object") {
                // Handle possible single object or map return
                if (results.jid || results.id || results.JID) {
                    results = [results];
                } else {
                    // Try to treat as map of objects
                    const values = Object.values(results);
                    if (values.length > 0 && typeof values[0] === "object") {
                        results = values;
                    } else {
                        results = [];
                    }
                }
            } else {
                results = [];
            }
        }

        if (Array.isArray(results) && results.length > 0 && Array.isArray(results[0])) {
            // @ts-ignore
            results = results.flat();
        }

        // Normalize keys (GOWA returns PascalCase JID, Name, etc.)
        // @ts-ignore
        return results.map((g: any) => ({
            ...g,
            id: g.JID || g.jid || g.id,
            jid: g.JID || g.jid,
            name: g.Name || g.name || g.subject,
            subject: g.Name || g.subject || g.name,
            topic: g.Topic || g.topic || "",
            participants: (g.Participants || g.participants || []).map((p: any) => ({
                ...p,
                jid: p.JID || p.jid,
                isAdmin: p.IsAdmin || p.isAdmin || false,
                isSuperAdmin: p.IsSuperAdmin || p.isSuperAdmin || false
            }))
        }));
    }

    // ==================== MESSAGING ====================
    async sendText(phone: string, message: string): Promise<GowaResponse> {
        const formData = this.createFormData({
            phone,
            message,
        });

        return this.request(
            "/send/message",
            { method: "POST", body: formData },
            true
        ) as Promise<GowaResponse>;
    }

    async sendImage(
        phone: string,
        imageUrl: string,
        caption?: string,
        asSticker: boolean = false
    ): Promise<GowaResponse> {
        const formData = this.createFormData({
            phone,
            image_url: imageUrl,
            caption: caption || "",
            compress: "false",
            sticker: asSticker ? "true" : "false",
        });

        return this.request(
            "/send/image",
            { method: "POST", body: formData },
            true
        ) as Promise<GowaResponse>;
    }



    async sendVideo(phone: string, videoUrl: string, caption?: string): Promise<GowaResponse> {
        const formData = this.createFormData({
            phone,
            video_url: videoUrl,
            caption: caption || "",
            compress: "false",
        });

        return this.request(
            "/send/video",
            { method: "POST", body: formData },
            true
        ) as Promise<GowaResponse>;
    }

    async sendFile(phone: string, fileUrl: string): Promise<GowaResponse> {
        const formData = this.createFormData({
            phone,
            file_url: fileUrl,
        });

        return this.request(
            "/send/file",
            { method: "POST", body: formData },
            true
        ) as Promise<GowaResponse>;
    }

    async sendAudio(phone: string, audioUrl: string): Promise<GowaResponse> {
        const formData = this.createFormData({
            phone,
            audio_url: audioUrl,
        });

        return this.request(
            "/send/audio",
            { method: "POST", body: formData },
            true
        ) as Promise<GowaResponse>;
    }

    // ==================== STICKERS ====================
    async sendImageAsSticker(phone: string, imageUrl: string): Promise<GowaResponse> {
        // Use dedicated /send/sticker endpoint - GOWA auto-converts to WebP 512x512
        const formData = this.createFormData({
            phone,
            sticker_url: imageUrl,  // Parameter name is sticker_url, not image_url
        });

        return this.request(
            "/send/sticker",
            { method: "POST", body: formData },
            true
        ) as Promise<GowaResponse>;
    }

    async sendVideoAsSticker(phone: string, videoUrl: string): Promise<GowaResponse> {
        // Use /send/sticker endpoint - GOWA may convert video/GIF to animated sticker
        const formData = this.createFormData({
            phone,
            sticker_url: videoUrl,
        });

        return this.request(
            "/send/sticker",
            { method: "POST", body: formData },
            true
        ) as Promise<GowaResponse>;
    }

    // ==================== MESSAGE ACTIONS ====================
    async markAsRead(chatId: string, messageId: string): Promise<GowaResponse> {
        const formData = this.createFormData({
            chat_id: chatId,
            message_id: messageId,
        });

        return this.request(
            "/message/read",
            { method: "POST", body: formData },
            true
        ) as Promise<GowaResponse>;
    }

    async reactToMessage(
        chatId: string,
        messageId: string,
        emoji: string
    ): Promise<GowaResponse> {
        const formData = this.createFormData({
            chat_id: chatId,
            message_id: messageId,
            emoji,
        });

        return this.request(
            "/message/react",
            { method: "POST", body: formData },
            true
        ) as Promise<GowaResponse>;
    }

    // ==================== GROUPS ====================
    async getGroupInfo(groupId: string): Promise<GroupInfo> {
        const res = await this.request(`/group?group_id=${encodeURIComponent(groupId)}`, {
            method: "GET",
        });
        return (res as GowaResponse<GroupInfo>).results!;
    }

    async createGroup(name: string, participants: string[]): Promise<GowaResponse> {
        const formData = this.createFormData({
            title: name,
            participants: participants.join(","),
        });

        return this.request(
            "/group",
            { method: "POST", body: formData },
            true
        ) as Promise<GowaResponse>;
    }

    async leaveGroup(groupId: string): Promise<GowaResponse> {
        const formData = this.createFormData({
            group_id: groupId,
        });

        return this.request(
            "/group/leave",
            { method: "POST", body: formData },
            true
        ) as Promise<GowaResponse>;
    }

    async joinGroup(inviteLink: string): Promise<GowaResponse> {
        const formData = this.createFormData({
            link: inviteLink,
        });

        return this.request(
            "/group/join",
            { method: "POST", body: formData },
            true
        ) as Promise<GowaResponse>;
    }

    // ==================== CHATS ====================
    async getChats(): Promise<unknown[]> {
        const res = await this.request("/chat", { method: "GET" });
        return (res as GowaResponse<unknown[]>).results || [];
    }

    async getChatMessages(chatId: string, limit: number = 50): Promise<unknown[]> {
        const res = await this.request(
            `/chat/messages?chat_id=${encodeURIComponent(chatId)}&limit=${limit}`,
            { method: "GET" }
        );
        return (res as GowaResponse<unknown[]>).results || [];
    }
}

// Export singleton factory
let gowaInstance: GowaClient | null = null;

export function getGowaClient(baseUrl?: string, basicAuth?: string): GowaClient {
    if (!gowaInstance) {
        const url = baseUrl || process.env.GOWA_URL || "http://localhost:3030";
        const auth = basicAuth || process.env.GOWA_BASIC_AUTH;
        gowaInstance = new GowaClient(url, auth);
    }
    return gowaInstance;
}
