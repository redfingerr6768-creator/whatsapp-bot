"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { RefreshCw, Send, User, Users, Search, MessageSquare, ArrowLeft } from "lucide-react"

// Helper to safely extract ID string from WAHA response
const getIdString = (id: any): string => {
    if (!id) return "Unknown";
    if (typeof id === "string") return id;
    if (typeof id === "object") {
        if (id._serialized) return id._serialized;
        if (id.user && id.server) return `${id.user}@${id.server}`;
        return JSON.stringify(id);
    }
    return String(id);
}

interface Chat {
    id: any;
    name?: string;
    isGroup?: boolean;
    unreadCount?: number;
    lastMessage?: any;
    timestamp?: number;
}

interface Message {
    id: any;
    body?: string;
    type?: string;
    fromMe?: boolean;
    timestamp?: number;
    from?: any;
    to?: any;
}

export default function ChatPage() {
    const [chats, setChats] = useState<Chat[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedChat, setSelectedChat] = useState<Chat | null>(null)
    const [messages, setMessages] = useState<Message[]>([])
    const [loadingMessages, setLoadingMessages] = useState(false)
    const [newMessage, setNewMessage] = useState("")
    const [sending, setSending] = useState(false)
    const [searchTerm, setSearchTerm] = useState("")
    const messagesEndRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        fetchChats()
    }, [])

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [messages])

    const fetchChats = async () => {
        setLoading(true)
        try {
            const res = await fetch("/api/chats?action=list&limit=100")
            const data = await res.json()
            setChats(Array.isArray(data) ? data : [])
        } catch (e) {
            setChats([])
        } finally {
            setLoading(false)
        }
    }

    const selectChat = async (chat: Chat) => {
        setSelectedChat(chat)
        setLoadingMessages(true)
        try {
            const chatId = getIdString(chat.id)
            const res = await fetch(`/api/chats?action=messages&chatId=${encodeURIComponent(chatId)}&limit=50`)
            const data = await res.json()
            // Reverse to get chronological order (oldest first)
            setMessages(Array.isArray(data) ? data.reverse() : [])
        } catch (e) {
            setMessages([])
        } finally {
            setLoadingMessages(false)
        }
    }

    const goBackToList = () => {
        setSelectedChat(null)
        setMessages([])
    }

    const sendMessage = async () => {
        if (!newMessage.trim() || !selectedChat) return

        setSending(true)
        try {
            const chatId = getIdString(selectedChat.id)
            const res = await fetch("/api/messages", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "sendText",
                    chatId,
                    text: newMessage
                })
            })
            const data = await res.json()

            if (!data.error) {
                // Add message to list optimistically
                setMessages(prev => [...prev, {
                    id: Date.now(),
                    body: newMessage,
                    fromMe: true,
                    timestamp: Math.floor(Date.now() / 1000)
                }])
                setNewMessage("")
            }
        } catch (e) {
            console.error("Failed to send", e)
        } finally {
            setSending(false)
        }
    }

    const filteredChats = chats.filter(c => {
        const name = c.name || getIdString(c.id)
        return name.toLowerCase().includes(searchTerm.toLowerCase())
    })

    const formatTime = (ts?: number) => {
        if (!ts) return ""
        const date = new Date(ts * 1000)
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }

    return (
        <div className="flex h-[calc(100vh-120px)] gap-4">
            {/* Chat List - hidden on mobile when a chat is selected */}
            <Card className={`w-full md:w-80 flex flex-col ${selectedChat ? 'hidden md:flex' : 'flex'}`}>
                <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">Chats</CardTitle>
                        <Button size="sm" variant="ghost" onClick={fetchChats} disabled={loading}>
                            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        </Button>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-8 h-9"
                        />
                    </div>
                </CardHeader>
                <CardContent className="flex-1 overflow-auto p-2 space-y-1">
                    {loading ? (
                        <div className="flex items-center justify-center p-8">
                            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : filteredChats.length === 0 ? (
                        <div className="text-center p-8 text-muted-foreground text-sm">
                            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            No chats found
                        </div>
                    ) : (
                        filteredChats.map((chat) => {
                            const chatId = getIdString(chat.id)
                            const isSelected = selectedChat && getIdString(selectedChat.id) === chatId
                            return (
                                <div
                                    key={chatId}
                                    className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${isSelected ? 'bg-primary/10' : 'hover:bg-muted'
                                        }`}
                                    onClick={() => selectChat(chat)}
                                >
                                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                                        {chat.isGroup ? (
                                            <Users className="h-5 w-5 text-muted-foreground" />
                                        ) : (
                                            <User className="h-5 w-5 text-muted-foreground" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-sm truncate">
                                            {chat.name || chatId.split('@')[0]}
                                        </p>
                                        <p className="text-xs text-muted-foreground truncate">
                                            {chat.lastMessage?.body || "No messages"}
                                        </p>
                                    </div>
                                    {chat.unreadCount && chat.unreadCount > 0 && (
                                        <Badge variant="default" className="text-xs">
                                            {chat.unreadCount}
                                        </Badge>
                                    )}
                                </div>
                            )
                        })
                    )}
                </CardContent>
            </Card>

            {/* Chat Window - full width on mobile when a chat is selected */}
            <Card className={`flex-1 flex flex-col ${selectedChat ? 'flex' : 'hidden md:flex'}`}>
                {selectedChat ? (
                    <>
                        <CardHeader className="border-b py-3">
                            <div className="flex items-center gap-3">
                                {/* Back button - mobile only */}
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="md:hidden -ml-1"
                                    onClick={goBackToList}
                                >
                                    <ArrowLeft className="h-5 w-5" />
                                </Button>
                                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                                    {selectedChat.isGroup ? (
                                        <Users className="h-5 w-5 text-muted-foreground" />
                                    ) : (
                                        <User className="h-5 w-5 text-muted-foreground" />
                                    )}
                                </div>
                                <div className="min-w-0">
                                    <CardTitle className="text-base truncate">
                                        {selectedChat.name || getIdString(selectedChat.id).split('@')[0]}
                                    </CardTitle>
                                    <p className="text-xs text-muted-foreground truncate">
                                        {getIdString(selectedChat.id)}
                                    </p>
                                </div>
                            </div>
                        </CardHeader>

                        <CardContent className="flex-1 overflow-auto p-4 space-y-3">
                            {loadingMessages ? (
                                <div className="flex items-center justify-center h-full">
                                    <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                                </div>
                            ) : messages.length === 0 ? (
                                <div className="flex items-center justify-center h-full text-muted-foreground">
                                    No messages yet
                                </div>
                            ) : (
                                messages.map((msg, i) => (
                                    <div
                                        key={i}
                                        className={`flex ${msg.fromMe ? 'justify-end' : 'justify-start'}`}
                                    >
                                        <div
                                            className={`max-w-[85%] sm:max-w-[70%] px-3 py-2 rounded-lg ${msg.fromMe
                                                ? 'bg-primary text-primary-foreground'
                                                : 'bg-muted'
                                                }`}
                                        >
                                            <p className="text-sm whitespace-pre-wrap break-words">
                                                {msg.body || `[${msg.type || 'media'}]`}
                                            </p>
                                            <p className={`text-[10px] mt-1 ${msg.fromMe ? 'text-primary-foreground/70' : 'text-muted-foreground'
                                                }`}>
                                                {formatTime(msg.timestamp)}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            )}
                            <div ref={messagesEndRef} />
                        </CardContent>

                        <div className="border-t p-3">
                            <form
                                onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
                                className="flex gap-2"
                            >
                                <Input
                                    placeholder="Type a message..."
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    disabled={sending}
                                    className="flex-1"
                                />
                                <Button type="submit" disabled={sending || !newMessage.trim()}>
                                    {sending ? (
                                        <RefreshCw className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Send className="h-4 w-4" />
                                    )}
                                </Button>
                            </form>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center text-muted-foreground">
                        <div className="text-center">
                            <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>Select a chat to start messaging</p>
                        </div>
                    </div>
                )}
            </Card>
        </div>
    )
}
