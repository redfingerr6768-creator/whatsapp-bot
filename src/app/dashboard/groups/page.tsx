"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RefreshCw, Users, Link, Search, ExternalLink, Copy, Check, UserPlus, CheckSquare, Square, Save } from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from "@/components/ui/dialog"

interface Group {
    id: string;
    subject?: string;
    name?: string;
    description?: string;
    size?: number;
    participants?: any[];
    creation?: number;
}

// Helper to safely extract ID string from WAHA response
// WAHA may return id as string or as object {server, user, _serialized}
const getIdString = (id: any): string => {
    if (!id) return "Unknown";
    if (typeof id === "string") return id;
    if (typeof id === "object") {
        // Try _serialized first, then construct from user@server
        if (id._serialized) return id._serialized;
        if (id.user && id.server) return `${id.user}@${id.server}`;
        return JSON.stringify(id);
    }
    return String(id);
}

export default function GroupsPage() {
    const [groups, setGroups] = useState<Group[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [searchTerm, setSearchTerm] = useState("")
    const [selectedGroup, setSelectedGroup] = useState<Group | null>(null)
    const [participants, setParticipants] = useState<any[]>([])
    const [loadingParticipants, setLoadingParticipants] = useState(false)
    const [copiedId, setCopiedId] = useState<string | null>(null)
    const [groupCount, setGroupCount] = useState(0)

    // Template creation mode
    const [selectMode, setSelectMode] = useState(false)
    const [selectedGroups, setSelectedGroups] = useState<string[]>([])
    const [showTemplateDialog, setShowTemplateDialog] = useState(false)
    const [templateName, setTemplateName] = useState("")
    const [savingTemplate, setSavingTemplate] = useState(false)

    useEffect(() => {
        fetchGroups()
    }, [])

    const fetchGroups = async () => {
        setLoading(true)
        setError(null)
        try {
            const res = await fetch("/api/groups?action=list&limit=200")
            const data = await res.json()

            if (data.error) {
                setError(data.error)
                setGroups([])
            } else {
                setGroups(Array.isArray(data) ? data : [])
            }

            // Get count
            const countRes = await fetch("/api/groups?action=count")
            const countData = await countRes.json()
            if (countData.count) setGroupCount(countData.count)
        } catch (e: any) {
            setError(e.message || "Failed to fetch groups")
            setGroups([])
        } finally {
            setLoading(false)
        }
    }

    const fetchParticipants = async (groupId: string) => {
        setLoadingParticipants(true)
        try {
            const res = await fetch(`/api/groups?action=participants&groupId=${encodeURIComponent(groupId)}`)
            const data = await res.json()
            setParticipants(Array.isArray(data) ? data : [])
        } catch (e) {
            setParticipants([])
        } finally {
            setLoadingParticipants(false)
        }
    }

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text)
        setCopiedId(text)
        setTimeout(() => setCopiedId(null), 2000)
    }

    const filteredGroups = groups.filter(g => {
        const name = g.subject || g.name || getIdString(g.id)
        return name.toLowerCase().includes(searchTerm.toLowerCase())
    })

    const toggleGroupSelection = (groupId: string) => {
        setSelectedGroups(prev =>
            prev.includes(groupId)
                ? prev.filter(id => id !== groupId)
                : [...prev, groupId]
        )
    }

    const selectAllFiltered = () => {
        setSelectedGroups(filteredGroups.map(g => getIdString(g.id)))
    }

    const clearSelection = () => {
        setSelectedGroups([])
    }

    const saveTemplate = async () => {
        if (!templateName || selectedGroups.length === 0) return
        setSavingTemplate(true)
        try {
            await fetch("/api/group-templates", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "create",
                    name: templateName,
                    groupIds: selectedGroups
                })
            })
            setShowTemplateDialog(false)
            setTemplateName("")
            setSelectedGroups([])
            setSelectMode(false)
            alert(`Template "${templateName}" saved with ${selectedGroups.length} groups!`)
        } catch (e) {
            console.error(e)
            alert("Failed to save template")
        } finally {
            setSavingTemplate(false)
        }
    }

    const openGroupDetail = (group: Group) => {
        if (selectMode) {
            toggleGroupSelection(getIdString(group.id))
            return
        }
        setSelectedGroup(group)
        fetchParticipants(getIdString(group.id))
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">WhatsApp Groups</h2>
                    <p className="text-muted-foreground">
                        {selectMode
                            ? `${selectedGroups.length} groups selected`
                            : groupCount > 0 ? `${groupCount} groups detected` : "Manage your WhatsApp groups"}
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant={selectMode ? "default" : "outline"}
                        onClick={() => { setSelectMode(!selectMode); if (selectMode) clearSelection(); }}
                    >
                        <CheckSquare className="mr-2 h-4 w-4" />
                        {selectMode ? "Cancel" : "Select Mode"}
                    </Button>
                    <Button onClick={fetchGroups} disabled={loading}>
                        <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        {loading ? "Loading..." : "Refresh"}
                    </Button>
                </div>
            </div>

            {/* Selection Mode Toolbar */}
            {selectMode && (
                <Card className="bg-primary/5 border-primary/20">
                    <CardContent className="p-3 flex items-center justify-between">
                        <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={selectAllFiltered}>
                                Select All ({filteredGroups.length})
                            </Button>
                            <Button size="sm" variant="outline" onClick={clearSelection}>
                                Clear
                            </Button>
                        </div>
                        <Button
                            size="sm"
                            disabled={selectedGroups.length === 0}
                            onClick={() => setShowTemplateDialog(true)}
                        >
                            <Save className="mr-2 h-4 w-4" />
                            Create Template ({selectedGroups.length})
                        </Button>
                    </CardContent>
                </Card>
            )}

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
                        placeholder="Search groups..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-8"
                    />
                </div>
            </div>

            {!loading && !error && groups.length === 0 && (
                <Card>
                    <CardContent className="p-8 text-center">
                        <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <h3 className="font-medium mb-2">No Groups Found</h3>
                        <p className="text-sm text-muted-foreground">
                            Connect your WhatsApp first or join some groups.
                        </p>
                    </CardContent>
                </Card>
            )}

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredGroups.map((group) => (
                    <Card key={getIdString(group.id)} className="hover:shadow-md transition-shadow cursor-pointer"
                        onClick={() => openGroupDetail(group)}>
                        <CardHeader className="pb-2">
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-2">
                                    {selectMode && (
                                        selectedGroups.includes(getIdString(group.id))
                                            ? <CheckSquare className="h-5 w-5 text-primary" />
                                            : <Square className="h-5 w-5 text-muted-foreground" />
                                    )}
                                    <CardTitle className="text-base line-clamp-1">
                                        {group.subject || group.name || "Unnamed Group"}
                                    </CardTitle>
                                </div>
                                <Badge variant="secondary" className="ml-2 shrink-0">
                                    <Users className="h-3 w-3 mr-1" />
                                    {group.size || group.participants?.length || "?"}
                                </Badge>
                            </div>
                            <CardDescription className="line-clamp-2 text-xs">
                                {group.description || "No description"}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-0">
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span className="font-mono truncate max-w-[180px]">{getIdString(group.id)}</span>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 px-2"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        copyToClipboard(getIdString(group.id))
                                    }}
                                >
                                    {copiedId === getIdString(group.id) ? (
                                        <Check className="h-3 w-3 text-green-500" />
                                    ) : (
                                        <Copy className="h-3 w-3" />
                                    )}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Group Detail Dialog */}
            <Dialog open={!!selectedGroup} onOpenChange={() => setSelectedGroup(null)}>
                <DialogContent className="max-w-lg max-h-[80vh] overflow-auto">
                    <DialogHeader>
                        <DialogTitle>{selectedGroup?.subject || selectedGroup?.name || "Group"}</DialogTitle>
                        <DialogDescription>{selectedGroup?.description || "No description"}</DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div>
                            <p className="text-sm font-medium mb-1">Group ID</p>
                            <code className="text-xs bg-muted p-2 rounded block break-all">
                                {selectedGroup ? getIdString(selectedGroup.id) : ""}
                            </code>
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-sm font-medium">
                                    Participants ({participants.length})
                                </p>
                                {loadingParticipants && <RefreshCw className="h-4 w-4 animate-spin" />}
                            </div>

                            <div className="max-h-60 overflow-auto space-y-1">
                                {participants.map((p, i) => (
                                    <div key={i} className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm">
                                        <span className="font-mono text-xs">{getIdString(p.id)}</span>
                                        <Badge variant={
                                            p.role === "superadmin" ? "default" :
                                                p.role === "admin" ? "secondary" :
                                                    "outline"
                                        } className="text-xs">
                                            {p.role || "member"}
                                        </Badge>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => copyToClipboard(selectedGroup ? getIdString(selectedGroup.id) : "")}
                            >
                                <Copy className="h-4 w-4 mr-2" /> Copy Group ID
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Create Template Dialog */}
            <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Create Group Template</DialogTitle>
                        <DialogDescription>
                            Save {selectedGroups.length} groups as a template for quick broadcast access.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Label>Template Name</Label>
                        <Input
                            placeholder="e.g., Marketing Groups, Support Teams"
                            value={templateName}
                            onChange={(e) => setTemplateName(e.target.value)}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowTemplateDialog(false)}>
                            Cancel
                        </Button>
                        <Button onClick={saveTemplate} disabled={!templateName || savingTemplate}>
                            {savingTemplate ? "Saving..." : "Save Template"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
