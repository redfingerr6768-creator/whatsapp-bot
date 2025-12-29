"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { RefreshCw, Search, UserPlus, Send, CheckCircle, XCircle, Phone, User } from "lucide-react"

// Helper to safely extract ID string
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

interface Contact {
    id: any;
    name?: string;
    pushname?: string;
    shortName?: string;
    isMe?: boolean;
    isGroup?: boolean;
    isWAContact?: boolean;
    number?: string;
}

export default function ContactsPage() {
    const [contacts, setContacts] = useState<Contact[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [searchTerm, setSearchTerm] = useState("")

    // Quick Message Dialog
    const [showSendDialog, setShowSendDialog] = useState(false)
    const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
    const [messageText, setMessageText] = useState("")
    const [sending, setSending] = useState(false)
    const [sendResult, setSendResult] = useState<{ success: boolean, error?: string } | null>(null)

    // Check Number Dialog
    const [showCheckDialog, setShowCheckDialog] = useState(false)
    const [checkPhone, setCheckPhone] = useState("")
    const [checking, setChecking] = useState(false)
    const [checkResult, setCheckResult] = useState<any>(null)

    useEffect(() => {
        fetchContacts()
    }, [])

    const fetchContacts = async () => {
        setLoading(true)
        setError(null)
        try {
            const res = await fetch("/api/contacts?action=list")
            const data = await res.json()

            if (data.error) {
                setError(data.error)
                setContacts([])
            } else {
                // Filter out groups and self
                const filtered = (Array.isArray(data) ? data : [])
                    .filter((c: Contact) => !c.isGroup && !c.isMe)
                setContacts(filtered)
            }
        } catch (e: any) {
            setError(e.message || "Failed to fetch contacts")
            setContacts([])
        } finally {
            setLoading(false)
        }
    }

    const openSendDialog = (contact: Contact) => {
        setSelectedContact(contact)
        setMessageText("")
        setSendResult(null)
        setShowSendDialog(true)
    }

    const sendQuickMessage = async () => {
        if (!selectedContact || !messageText.trim()) return

        setSending(true)
        setSendResult(null)
        try {
            const chatId = getIdString(selectedContact.id)
            const res = await fetch("/api/messages", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "sendText",
                    chatId,
                    text: messageText
                })
            })
            const data = await res.json()

            if (data.error) {
                setSendResult({ success: false, error: data.error })
            } else {
                setSendResult({ success: true })
                setMessageText("")
            }
        } catch (e: any) {
            setSendResult({ success: false, error: e.message })
        } finally {
            setSending(false)
        }
    }

    const checkNumber = async () => {
        if (!checkPhone.trim()) return

        setChecking(true)
        setCheckResult(null)
        try {
            const res = await fetch(`/api/contacts?action=check&phone=${encodeURIComponent(checkPhone)}`)
            const data = await res.json()
            setCheckResult(data)
        } catch (e: any) {
            setCheckResult({ error: e.message })
        } finally {
            setChecking(false)
        }
    }

    const filteredContacts = contacts.filter(c => {
        const name = c.name || c.pushname || getIdString(c.id)
        return name.toLowerCase().includes(searchTerm.toLowerCase())
    })

    const getPhoneNumber = (contact: Contact) => {
        const id = getIdString(contact.id)
        return id.replace('@c.us', '').replace('@s.whatsapp.net', '')
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Contacts</h2>
                    <p className="text-muted-foreground">
                        {contacts.length > 0 ? `${contacts.length} contacts from WhatsApp` : "Manage your WhatsApp contacts"}
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => { setShowCheckDialog(true); setCheckResult(null); setCheckPhone(""); }}>
                        <Phone className="mr-2 h-4 w-4" /> Check Number
                    </Button>
                    <Button onClick={fetchContacts} disabled={loading}>
                        <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        {loading ? "Loading..." : "Refresh"}
                    </Button>
                </div>
            </div>

            {error && (
                <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
                    <CardContent className="p-4">
                        <p className="text-sm text-red-600">⚠️ {error}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                            Make sure WhatsApp is connected in Settings
                        </p>
                    </CardContent>
                </Card>
            )}

            <div className="flex items-center space-x-2">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search contacts..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-8"
                    />
                </div>
            </div>

            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-12"></TableHead>
                                <TableHead>Name</TableHead>
                                <TableHead>Phone Number</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8">
                                        <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                                    </TableCell>
                                </TableRow>
                            ) : filteredContacts.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                        {contacts.length === 0 ? "No contacts found. Connect WhatsApp first." : "No matching contacts"}
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredContacts.slice(0, 100).map((contact, i) => (
                                    <TableRow key={i}>
                                        <TableCell>
                                            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                                                <User className="h-4 w-4 text-muted-foreground" />
                                            </div>
                                        </TableCell>
                                        <TableCell className="font-medium">
                                            {contact.name || contact.pushname || "Unknown"}
                                        </TableCell>
                                        <TableCell className="font-mono text-sm">
                                            +{getPhoneNumber(contact)}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={contact.isWAContact ? "default" : "secondary"}>
                                                {contact.isWAContact ? "WhatsApp" : "Contact"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => openSendDialog(contact)}
                                            >
                                                <Send className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                    {filteredContacts.length > 100 && (
                        <div className="p-4 text-center text-sm text-muted-foreground border-t">
                            Showing 100 of {filteredContacts.length} contacts
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Quick Message Dialog */}
            <Dialog open={showSendDialog} onOpenChange={setShowSendDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Send Quick Message</DialogTitle>
                        <DialogDescription>
                            Send a message to {selectedContact?.name || selectedContact?.pushname || "this contact"}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Message</Label>
                            <Input
                                placeholder="Type your message..."
                                value={messageText}
                                onChange={(e) => setMessageText(e.target.value)}
                            />
                        </div>
                        {sendResult && (
                            <div className={`p-3 rounded-lg ${sendResult.success ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                                }`}>
                                {sendResult.success ? (
                                    <span className="flex items-center gap-2">
                                        <CheckCircle className="h-4 w-4" /> Message sent!
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-2">
                                        <XCircle className="h-4 w-4" /> {sendResult.error}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowSendDialog(false)}>Cancel</Button>
                        <Button onClick={sendQuickMessage} disabled={sending || !messageText.trim()}>
                            {sending ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                            Send
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Check Number Dialog */}
            <Dialog open={showCheckDialog} onOpenChange={setShowCheckDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Check Phone Number</DialogTitle>
                        <DialogDescription>
                            Check if a phone number is registered on WhatsApp
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Phone Number (with country code)</Label>
                            <Input
                                placeholder="628123456789"
                                value={checkPhone}
                                onChange={(e) => setCheckPhone(e.target.value)}
                            />
                        </div>
                        {checkResult && (
                            <div className={`p-3 rounded-lg ${checkResult.numberExists ? 'bg-green-50' : 'bg-yellow-50'
                                }`}>
                                {checkResult.error ? (
                                    <span className="text-red-600">{checkResult.error}</span>
                                ) : checkResult.numberExists ? (
                                    <div className="text-green-600">
                                        <CheckCircle className="h-4 w-4 inline mr-2" />
                                        Number exists on WhatsApp
                                        {checkResult.chatId && (
                                            <p className="text-xs mt-1 font-mono">{getIdString(checkResult.chatId)}</p>
                                        )}
                                    </div>
                                ) : (
                                    <div className="text-yellow-600">
                                        <XCircle className="h-4 w-4 inline mr-2" />
                                        Number not registered on WhatsApp
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowCheckDialog(false)}>Close</Button>
                        <Button onClick={checkNumber} disabled={checking || !checkPhone.trim()}>
                            {checking ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Phone className="h-4 w-4 mr-2" />}
                            Check
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
