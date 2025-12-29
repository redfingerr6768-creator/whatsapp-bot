"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Plus, Send, Users, Clock, CheckCircle, XCircle, RefreshCw, Save, FolderOpen, Trash2, Upload } from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"

interface Group {
    id: string;
    subject?: string;
    name?: string;
}

interface BroadcastResult {
    chatId: string;
    success: boolean;
    error?: string;
}

interface GroupTemplate {
    id: string;
    name: string;
    groupIds: string[];
    createdAt: number;
}

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

export default function BroadcastPage() {
    const [groups, setGroups] = useState<Group[]>([])
    const [loadingGroups, setLoadingGroups] = useState(true)
    const [showNewDialog, setShowNewDialog] = useState(false)

    // Templates
    const [templates, setTemplates] = useState<GroupTemplate[]>([])
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>("")
    const [showSaveTemplateDialog, setShowSaveTemplateDialog] = useState(false)
    const [newTemplateName, setNewTemplateName] = useState("")

    // New broadcast form
    const [targetType, setTargetType] = useState<"groups" | "numbers">("groups")
    const [selectedGroups, setSelectedGroups] = useState<string[]>([])
    const [phoneNumbers, setPhoneNumbers] = useState("")
    const [message, setMessage] = useState("")
    const [mediaType, setMediaType] = useState<"text" | "image" | "video" | "file">("text")
    const [mediaUrl, setMediaUrl] = useState("")
    const [caption, setCaption] = useState("")
    const [uploading, setUploading] = useState(false)
    const [uploadedFileName, setUploadedFileName] = useState("")
    const [sending, setSending] = useState(false)
    const [results, setResults] = useState<BroadcastResult[]>([])
    const [showResults, setShowResults] = useState(false)

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setUploading(true)
        try {
            const formData = new FormData()
            formData.append("file", file)

            const res = await fetch("/api/upload", {
                method: "POST",
                body: formData
            })
            const data = await res.json()

            if (data.error) {
                alert("Upload failed: " + data.error)
            } else {
                // Use the origin + path for full URL that GOWA can access
                const fullUrl = window.location.origin + data.url
                setMediaUrl(fullUrl)
                setUploadedFileName(file.name)
            }
        } catch (error: any) {
            alert("Upload error: " + error.message)
        } finally {
            setUploading(false)
        }
    }

    useEffect(() => {
        fetchGroups()
        fetchTemplates()
    }, [])

    const fetchGroups = async () => {
        setLoadingGroups(true)
        try {
            const res = await fetch("/api/groups?action=list&limit=200")
            const data = await res.json()
            setGroups(Array.isArray(data) ? data : [])
        } catch (e) {
            setGroups([])
        } finally {
            setLoadingGroups(false)
        }
    }

    const fetchTemplates = async () => {
        try {
            const res = await fetch("/api/group-templates")
            const data = await res.json()
            setTemplates(Array.isArray(data) ? data : [])
        } catch (e) {
            setTemplates([])
        }
    }

    const loadTemplate = (templateId: string) => {
        const template = templates.find(t => t.id === templateId)
        if (template) {
            setSelectedGroups(template.groupIds)
            setSelectedTemplateId(templateId)
        }
    }

    const saveAsTemplate = async () => {
        if (!newTemplateName || selectedGroups.length === 0) return
        try {
            await fetch("/api/group-templates", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "create",
                    name: newTemplateName,
                    groupIds: selectedGroups
                })
            })
            await fetchTemplates()
            setShowSaveTemplateDialog(false)
            setNewTemplateName("")
        } catch (e) {
            console.error(e)
        }
    }

    const deleteTemplate = async (id: string) => {
        if (!confirm("Delete this template?")) return
        try {
            await fetch("/api/group-templates", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "delete", id })
            })
            await fetchTemplates()
            if (selectedTemplateId === id) setSelectedTemplateId("")
        } catch (e) {
            console.error(e)
        }
    }

    const toggleGroup = (groupId: string) => {
        setSelectedGroups(prev =>
            prev.includes(groupId)
                ? prev.filter(id => id !== groupId)
                : [...prev, groupId]
        )
    }

    const sendBroadcast = async () => {
        setSending(true)
        setResults([])

        const targets: string[] = []

        if (targetType === "groups") {
            targets.push(...selectedGroups)
        } else {
            // Parse phone numbers (one per line or comma separated)
            const nums = phoneNumbers.split(/[\n,]/).map(n => n.trim()).filter(Boolean)
            nums.forEach(num => {
                // Convert to WhatsApp format
                const cleaned = num.replace(/\D/g, "")
                targets.push(`${cleaned}@c.us`)
            })
        }

        const newResults: BroadcastResult[] = []

        for (const chatId of targets) {
            try {
                let requestBody: any = { chatId }

                // Build request based on media type
                if (mediaType === "text") {
                    requestBody.action = "sendText"
                    requestBody.text = message
                } else if (mediaType === "image") {
                    requestBody.action = "sendImage"
                    requestBody.imageUrl = mediaUrl
                    requestBody.caption = caption || message
                } else if (mediaType === "video") {
                    requestBody.action = "sendVideo"
                    requestBody.videoUrl = mediaUrl
                    requestBody.caption = caption || message
                } else if (mediaType === "file") {
                    requestBody.action = "sendFile"
                    requestBody.fileUrl = mediaUrl
                }

                const res = await fetch("/api/messages", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(requestBody)
                })
                const data = await res.json()

                newResults.push({
                    chatId,
                    success: !data.error,
                    error: data.error
                })

                // Add small delay between messages (anti-ban)
                await new Promise(r => setTimeout(r, 1500))
            } catch (error: any) {
                newResults.push({
                    chatId,
                    success: false,
                    error: error.message
                })
            }
        }

        setResults(newResults)
        setSending(false)
        setShowResults(true)
    }

    const successCount = results.filter(r => r.success).length
    const failCount = results.filter(r => !r.success).length

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Broadcast</h2>
                    <p className="text-muted-foreground">Send messages to multiple groups or contacts at once.</p>
                </div>
                <Button onClick={() => setShowNewDialog(true)}>
                    <Plus className="mr-2 h-4 w-4" /> New Broadcast
                </Button>
            </div>

            {/* Quick Stats */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Available Groups</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{groups.length}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Last Broadcast</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {results.length > 0 ? `${successCount}/${results.length}` : "-"}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {results.length > 0 ? "messages sent" : "No broadcast yet"}
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Status</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-2">
                            {sending ? (
                                <>
                                    <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />
                                    <span className="text-blue-500">Sending...</span>
                                </>
                            ) : (
                                <>
                                    <CheckCircle className="h-4 w-4 text-green-500" />
                                    <span className="text-green-500">Ready</span>
                                </>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Results Card */}
            {showResults && results.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                            Broadcast Results
                            <div className="flex gap-2">
                                <Badge variant="default" className="bg-green-500">
                                    <CheckCircle className="h-3 w-3 mr-1" /> {successCount} Sent
                                </Badge>
                                {failCount > 0 && (
                                    <Badge variant="destructive">
                                        <XCircle className="h-3 w-3 mr-1" /> {failCount} Failed
                                    </Badge>
                                )}
                            </div>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="max-h-60 overflow-auto space-y-1">
                            {results.map((r, i) => (
                                <div key={i} className={`flex items-center justify-between p-2 rounded text-sm ${r.success ? 'bg-green-50 dark:bg-green-950/20' : 'bg-red-50 dark:bg-red-950/20'
                                    }`}>
                                    <span className="font-mono text-xs truncate max-w-[200px]">{r.chatId}</span>
                                    {r.success ? (
                                        <CheckCircle className="h-4 w-4 text-green-500" />
                                    ) : (
                                        <span className="text-xs text-red-500">{r.error}</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* New Broadcast Dialog */}
            <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
                    <DialogHeader>
                        <DialogTitle>New Broadcast</DialogTitle>
                        <DialogDescription>
                            Send a message to multiple recipients at once.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        {/* Target Type */}
                        <div className="space-y-2">
                            <Label>Send To</Label>
                            <Select value={targetType} onValueChange={(v: any) => setTargetType(v)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="groups">WhatsApp Groups</SelectItem>
                                    <SelectItem value="numbers">Phone Numbers</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Target Selection */}
                        {targetType === "groups" ? (
                            <div className="space-y-2">
                                {/* Template Selector */}
                                <div className="flex gap-2 items-end">
                                    <div className="flex-1">
                                        <Label>Load Template</Label>
                                        <Select value={selectedTemplateId} onValueChange={loadTemplate}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select a saved template..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {templates.map(t => (
                                                    <SelectItem key={t.id} value={t.id}>
                                                        <FolderOpen className="inline h-3 w-3 mr-2" />
                                                        {t.name} ({t.groupIds.length} groups)
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    {selectedTemplateId && (
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => deleteTemplate(selectedTemplateId)}
                                        >
                                            <Trash2 className="h-4 w-4 text-red-500" />
                                        </Button>
                                    )}
                                </div>

                                <Label>Select Groups ({selectedGroups.length} selected)</Label>
                                <div className="border rounded-lg max-h-48 overflow-auto p-2 space-y-1">
                                    {loadingGroups ? (
                                        <div className="flex items-center justify-center p-4">
                                            <RefreshCw className="h-4 w-4 animate-spin" />
                                        </div>
                                    ) : groups.length === 0 ? (
                                        <p className="text-sm text-muted-foreground text-center p-4">
                                            No groups found. Connect WhatsApp first.
                                        </p>
                                    ) : (
                                        groups.map(g => {
                                            const gId = getIdString(g.id);
                                            return (
                                                <div
                                                    key={gId}
                                                    className={`flex items-center p-2 rounded cursor-pointer ${selectedGroups.includes(gId)
                                                        ? 'bg-primary/10 border border-primary'
                                                        : 'bg-muted/50 hover:bg-muted'
                                                        }`}
                                                    onClick={() => toggleGroup(gId)}
                                                >
                                                    <Users className="h-4 w-4 mr-2 text-muted-foreground" />
                                                    <span className="text-sm flex-1 truncate">
                                                        {g.subject || g.name || gId}
                                                    </span>
                                                    {selectedGroups.includes(gId) && (
                                                        <CheckCircle className="h-4 w-4 text-primary" />
                                                    )}
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setSelectedGroups(groups.map(g => getIdString(g.id)))}
                                    >
                                        Select All
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setSelectedGroups([])}
                                    >
                                        Clear
                                    </Button>
                                    {selectedGroups.length > 0 && (
                                        <Button
                                            size="sm"
                                            variant="secondary"
                                            onClick={() => setShowSaveTemplateDialog(true)}
                                        >
                                            <Save className="h-3 w-3 mr-1" />
                                            Save as Template
                                        </Button>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <Label>Phone Numbers (one per line)</Label>
                                <Textarea
                                    placeholder="628123456789&#10;628987654321&#10;6281234567890"
                                    value={phoneNumbers}
                                    onChange={(e) => setPhoneNumbers(e.target.value)}
                                    rows={5}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Enter phone numbers with country code (no + sign)
                                </p>
                            </div>
                        )}

                        {/* Message Type */}
                        <div className="space-y-2">
                            <Label>Content Type</Label>
                            <Select value={mediaType} onValueChange={(v: any) => setMediaType(v)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="text">📝 Text Only</SelectItem>
                                    <SelectItem value="image">🖼️ Image</SelectItem>
                                    <SelectItem value="video">🎥 Video</SelectItem>
                                    <SelectItem value="file">📎 File/Document</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Media URL (for image/video/file) */}
                        {mediaType !== "text" && (
                            <div className="space-y-2">
                                <Label>
                                    {mediaType === "image" ? "Image" :
                                        mediaType === "video" ? "Video" : "File"}
                                </Label>

                                {/* File Upload */}
                                <div className="flex gap-2">
                                    <Input
                                        type="file"
                                        accept={mediaType === "image" ? "image/*" : mediaType === "video" ? "video/*" : "*/*"}
                                        onChange={handleFileUpload}
                                        disabled={uploading}
                                        className="flex-1"
                                    />
                                </div>

                                {uploading && (
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <RefreshCw className="h-4 w-4 animate-spin" />
                                        Uploading...
                                    </div>
                                )}

                                {uploadedFileName && mediaUrl && (
                                    <div className="flex items-center gap-2 text-sm text-green-600">
                                        <CheckCircle className="h-4 w-4" />
                                        Uploaded: {uploadedFileName}
                                    </div>
                                )}

                                {/* Or enter URL manually */}
                                <div className="text-xs text-muted-foreground my-2">— atau masukkan URL —</div>
                                <Input
                                    placeholder={`https://example.com/${mediaType}.${mediaType === "image" ? "jpg" : mediaType === "video" ? "mp4" : "pdf"}`}
                                    value={mediaUrl}
                                    onChange={(e) => { setMediaUrl(e.target.value); setUploadedFileName(""); }}
                                />
                            </div>
                        )}

                        {/* Message / Caption */}
                        <div className="space-y-2">
                            <Label>{mediaType === "text" ? "Message" : "Caption (optional)"}</Label>
                            <Textarea
                                placeholder={mediaType === "text"
                                    ? "Type your broadcast message here..."
                                    : "Add a caption for your media..."}
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                rows={mediaType === "text" ? 4 : 2}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowNewDialog(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={sendBroadcast}
                            disabled={sending ||
                                (mediaType === "text" ? !message : !mediaUrl) ||
                                (targetType === "groups" ? selectedGroups.length === 0 : !phoneNumbers)}
                        >
                            {sending ? (
                                <>
                                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                    Sending...
                                </>
                            ) : (
                                <>
                                    <Send className="mr-2 h-4 w-4" />
                                    Send Broadcast
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Save Template Dialog */}
            <Dialog open={showSaveTemplateDialog} onOpenChange={setShowSaveTemplateDialog}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Save as Template</DialogTitle>
                        <DialogDescription>
                            Save the current selection ({selectedGroups.length} groups) as a template for quick access.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Label>Template Name</Label>
                        <Input
                            placeholder="e.g. Marketing Groups, Support Channels"
                            value={newTemplateName}
                            onChange={(e) => setNewTemplateName(e.target.value)}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowSaveTemplateDialog(false)}>
                            Cancel
                        </Button>
                        <Button onClick={saveAsTemplate} disabled={!newTemplateName}>
                            <Save className="h-4 w-4 mr-2" />
                            Save Template
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div >
    )
}
