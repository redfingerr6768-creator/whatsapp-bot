"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Plus, Zap, MessageSquare, RefreshCw, Trash2, Edit, Webhook, AlertCircle } from "lucide-react"

interface AutomationRule {
    id: string;
    name: string;
    keywords: string[];
    matchType: "exact" | "contains" | "startsWith";
    reply: string;
    enabled: boolean;
    createdAt: number;
}

export default function AutomationPage() {
    const [rules, setRules] = useState<AutomationRule[]>([])
    const [loading, setLoading] = useState(true)
    const [showDialog, setShowDialog] = useState(false)
    const [editingRule, setEditingRule] = useState<AutomationRule | null>(null)

    // Form state
    const [formName, setFormName] = useState("")
    const [formKeywords, setFormKeywords] = useState("")
    const [formMatchType, setFormMatchType] = useState<"exact" | "contains" | "startsWith">("contains")
    const [formReply, setFormReply] = useState("")
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        fetchRules()
    }, [])

    const fetchRules = async () => {
        setLoading(true)
        try {
            const res = await fetch("/api/automation")
            const data = await res.json()
            setRules(Array.isArray(data) ? data : [])
        } catch (e) {
            setRules([])
        } finally {
            setLoading(false)
        }
    }

    const openNewDialog = () => {
        setEditingRule(null)
        setFormName("")
        setFormKeywords("")
        setFormMatchType("contains")
        setFormReply("")
        setShowDialog(true)
    }

    const openEditDialog = (rule: AutomationRule) => {
        setEditingRule(rule)
        setFormName(rule.name)
        setFormKeywords(rule.keywords.join(", "))
        setFormMatchType(rule.matchType)
        setFormReply(rule.reply)
        setShowDialog(true)
    }

    const saveRule = async () => {
        setSaving(true)
        try {
            const keywords = formKeywords.split(",").map(k => k.trim()).filter(Boolean)

            const res = await fetch("/api/automation", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: editingRule ? "update" : "create",
                    id: editingRule?.id,
                    name: formName,
                    keywords,
                    matchType: formMatchType,
                    reply: formReply
                })
            })

            if (res.ok) {
                await fetchRules()
                setShowDialog(false)
            }
        } catch (e) {
            console.error(e)
        } finally {
            setSaving(false)
        }
    }

    const toggleRule = async (id: string) => {
        try {
            await fetch("/api/automation", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "toggle", id })
            })
            await fetchRules()
        } catch (e) {
            console.error(e)
        }
    }

    const deleteRule = async (id: string) => {
        if (!confirm("Are you sure you want to delete this rule?")) return

        try {
            await fetch("/api/automation", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "delete", id })
            })
            await fetchRules()
        } catch (e) {
            console.error(e)
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Automation</h2>
                    <p className="text-muted-foreground">Configure auto-reply rules for incoming messages.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={fetchRules} disabled={loading}>
                        <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                    <Button onClick={openNewDialog}>
                        <Plus className="mr-2 h-4 w-4" /> New Rule
                    </Button>
                </div>
            </div>

            {/* Webhook Configuration Info */}
            <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
                <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Webhook className="h-5 w-5" />
                        Webhook Configuration
                    </CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-3">
                    <p>Webhook otomatis dikonfigurasi saat server start via <code>start-gowa.bat</code>.</p>
                    <code className="block bg-muted p-2 rounded text-xs font-mono">
                        Target: http://localhost:3000/api/webhook
                    </code>
                    <div className="flex gap-2 pt-2">
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                                try {
                                    const res = await fetch("/api/webhook", {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({
                                            event: "message",
                                            device_id: "test",
                                            payload: {
                                                id: "test_" + Date.now(),
                                                from: "6281234567890@c.us",
                                                fromMe: false,
                                                body: "halo",
                                                timestamp: Math.floor(Date.now() / 1000)
                                            }
                                        })
                                    });
                                    const data = await res.json();
                                    alert("Test Result:\n" + JSON.stringify(data, null, 2));
                                } catch (e: any) {
                                    alert("Error: " + e.message);
                                }
                            }}
                        >
                            Test Webhook Loopback
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Stats */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Total Rules</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{rules.length}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Active Rules</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">
                            {rules.filter(r => r.enabled).length}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Paused Rules</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-yellow-600">
                            {rules.filter(r => !r.enabled).length}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Rules List */}
            <div className="grid gap-4">
                {loading ? (
                    <Card>
                        <CardContent className="p-8 text-center">
                            <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                        </CardContent>
                    </Card>
                ) : rules.length === 0 ? (
                    <Card>
                        <CardContent className="p-8 text-center text-muted-foreground">
                            <AlertCircle className="h-8 w-8 mx-auto mb-4 opacity-50" />
                            <p>No automation rules yet. Click "New Rule" to create one.</p>
                        </CardContent>
                    </Card>
                ) : (
                    rules.map((rule) => (
                        <Card key={rule.id}>
                            <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-6">
                                <div className="flex items-center gap-3 sm:space-x-4 min-w-0">
                                    <div className={`p-2 rounded-full shrink-0 ${rule.enabled
                                        ? 'bg-green-100 dark:bg-green-900'
                                        : 'bg-gray-100 dark:bg-gray-800'
                                        }`}>
                                        <Zap className={`h-6 w-6 ${rule.enabled
                                            ? 'text-green-600 dark:text-green-400'
                                            : 'text-gray-400'
                                            }`} />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-lg font-medium leading-none">{rule.name}</p>
                                        <p className="text-sm text-muted-foreground mt-1">
                                            Keywords: {rule.keywords.join(", ")}
                                            <span className="ml-2 text-xs">
                                                ({rule.matchType})
                                            </span>
                                        </p>
                                        <p className="text-xs text-muted-foreground mt-1 truncate max-w-full sm:max-w-md">
                                            Reply: {rule.reply}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 sm:space-x-4 ml-auto">
                                    <Badge variant={rule.enabled ? "default" : "outline"}>
                                        {rule.enabled ? "Active" : "Paused"}
                                    </Badge>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => openEditDialog(rule)}
                                    >
                                        <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => deleteRule(rule.id)}
                                    >
                                        <Trash2 className="h-4 w-4 text-red-500" />
                                    </Button>
                                    <Switch
                                        checked={rule.enabled}
                                        onCheckedChange={() => toggleRule(rule.id)}
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>

            {/* Rule Dialog */}
            <Dialog open={showDialog} onOpenChange={setShowDialog}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>
                            {editingRule ? "Edit Rule" : "New Automation Rule"}
                        </DialogTitle>
                        <DialogDescription>
                            Configure auto-reply for specific keywords.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Rule Name</Label>
                            <Input
                                placeholder="e.g. Welcome Message"
                                value={formName}
                                onChange={(e) => setFormName(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Keywords (comma separated)</Label>
                            <Input
                                placeholder="e.g. hi, hello, halo"
                                value={formKeywords}
                                onChange={(e) => setFormKeywords(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Match Type</Label>
                            <Select value={formMatchType} onValueChange={(v: any) => setFormMatchType(v)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="exact">Exact Match</SelectItem>
                                    <SelectItem value="contains">Contains</SelectItem>
                                    <SelectItem value="startsWith">Starts With</SelectItem>
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                                Exact: message must match keyword exactly.
                                Contains: message contains keyword anywhere.
                                Starts With: message starts with keyword.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label>Auto-Reply Message</Label>
                            <Textarea
                                placeholder="Type the automatic response..."
                                value={formReply}
                                onChange={(e) => setFormReply(e.target.value)}
                                rows={4}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowDialog(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={saveRule}
                            disabled={saving || !formName || !formKeywords || !formReply}
                        >
                            {saving ? (
                                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                            ) : null}
                            {editingRule ? "Update" : "Create"} Rule
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
