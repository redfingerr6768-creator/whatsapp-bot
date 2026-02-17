"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { QrCode, RefreshCw, LogOut, Power, Smartphone, Bot, Key, Trash2, Plus, Send, ExternalLink } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

export default function SettingsPage() {
    // GOWA State (replacing WAHA)
    const [isConnected, setIsConnected] = useState(false)
    const [qrLink, setQrLink] = useState<string | null>(null)
    const [sessionStatus, setSessionStatus] = useState<"STOPPED" | "CONNECTING" | "CONNECTED">("STOPPED")
    const [loading, setLoading] = useState(false)
    const [deviceInfo, setDeviceInfo] = useState<any>(null)
    const [error, setError] = useState<string | null>(null)

    // AI State
    const [aiEnabled, setAiEnabled] = useState(true)
    const [aiModel, setAiModel] = useState("llama-3.1-8b-instant")
    const [aiSystemPrompt, setAiSystemPrompt] = useState("")
    const [aiApiKeys, setAiApiKeys] = useState<string[]>([])
    const [newApiKey, setNewApiKey] = useState("")
    const [aiLoading, setAiLoading] = useState(false)
    const [testMessage, setTestMessage] = useState("")
    const [testResponse, setTestResponse] = useState("")

    // Admin State
    const [adminNumbers, setAdminNumbers] = useState<string[]>([])
    const [newAdminNumber, setNewAdminNumber] = useState("")
    const [adminEnabled, setAdminEnabled] = useState(true)

    useEffect(() => {
        checkStatus()
        loadAiConfig()
        loadAdminConfig()
    }, [])

    // Polling for GOWA status
    useEffect(() => {
        let interval: NodeJS.Timeout
        if (sessionStatus === "CONNECTING") {
            interval = setInterval(checkStatus, 3000)
        }
        return () => clearInterval(interval)
    }, [sessionStatus])

    // ==================== GOWA Functions ====================
    const checkStatus = async () => {
        try {
            setError(null)
            const res = await fetch("/api/waha?action=devices")
            const data = await res.json()

            if (data.error) {
                setError(data.error)
                setSessionStatus("STOPPED")
                setIsConnected(false)
                return
            }

            // GOWA returns array of devices if connected
            const devices = Array.isArray(data) ? data : []

            if (devices.length > 0) {
                setSessionStatus("CONNECTED")
                setIsConnected(true)
                setDeviceInfo(devices[0])
                setQrLink(null)
            } else {
                setSessionStatus("STOPPED")
                setIsConnected(false)
                setDeviceInfo(null)
            }
        } catch (e) {
            console.error("Failed to check status", e)
            setError("Cannot connect to GOWA server. Make sure it's running on port 3030.")
            setSessionStatus("STOPPED")
            setIsConnected(false)
        }
    }

    const startSession = async () => {
        setLoading(true)
        setError(null)
        try {
            const res = await fetch("/api/waha", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "login" })
            })
            const data = await res.json()

            if (data.error) {
                setError(data.error)
            } else if (data.qr_link) {
                // GOWA returns QR link, open in new tab or show link
                setQrLink(data.qr_link)
                setSessionStatus("CONNECTING")
            } else {
                // Already connected
                checkStatus()
            }
        } catch (e: any) {
            setError(e.message || "Failed to start session")
        } finally {
            setLoading(false)
        }
    }

    const reconnect = async () => {
        setLoading(true)
        setError(null)
        try {
            await fetch("/api/waha", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "reconnect" })
            })
            setTimeout(checkStatus, 2000)
        } catch (e: any) {
            setError(e.message || "Failed to reconnect")
        } finally {
            setLoading(false)
        }
    }

    const logout = async () => {
        setLoading(true)
        try {
            await fetch("/api/waha", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "logout" })
            })
            setDeviceInfo(null)
            setIsConnected(false)
            setSessionStatus("STOPPED")
            setQrLink(null)
        } catch (e: any) {
            setError(e.message || "Failed to logout")
        } finally {
            setLoading(false)
        }
    }

    // ==================== AI Functions ====================
    const loadAiConfig = async () => {
        try {
            const res = await fetch("/api/ai")
            const data = await res.json()
            setAiEnabled(data.enabled ?? true)
            setAiModel(data.model || "llama-3.1-8b-instant")
            setAiSystemPrompt(data.systemPrompt || "")
            setAiApiKeys(data.apiKeys || [])
        } catch (e) {
            console.error("Failed to load AI config", e)
        }
    }

    const saveAiConfig = async () => {
        setAiLoading(true)
        try {
            await fetch("/api/ai", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "update",
                    enabled: aiEnabled,
                    model: aiModel,
                    systemPrompt: aiSystemPrompt
                })
            })
            alert("AI settings saved!")
        } catch (e: any) {
            alert("Error: " + e.message)
        } finally {
            setAiLoading(false)
        }
    }

    const addApiKey = async () => {
        if (!newApiKey.startsWith("gsk_")) {
            alert("API key must start with 'gsk_'")
            return
        }
        setAiLoading(true)
        try {
            await fetch("/api/ai", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "addKey", key: newApiKey })
            })
            setNewApiKey("")
            loadAiConfig()
        } catch (e: any) {
            alert("Error: " + e.message)
        } finally {
            setAiLoading(false)
        }
    }

    const removeApiKey = async (index: number) => {
        if (!confirm("Remove this API key?")) return
        setAiLoading(true)
        try {
            await fetch("/api/ai", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "removeKey", index })
            })
            loadAiConfig()
        } catch (e: any) {
            alert("Error: " + e.message)
        } finally {
            setAiLoading(false)
        }
    }

    const testAi = async () => {
        if (!testMessage) return
        setAiLoading(true)
        setTestResponse("")
        try {
            const res = await fetch("/api/ai", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "test", message: testMessage })
            })
            const data = await res.json()
            if (data.error) {
                setTestResponse("Error: " + data.error)
            } else {
                setTestResponse(data.response)
            }
        } catch (e: any) {
            setTestResponse("Error: " + e.message)
        } finally {
            setAiLoading(false)
        }
    }

    // ==================== Admin Functions ====================
    const loadAdminConfig = async () => {
        try {
            const res = await fetch("/api/admin-config")
            const data = await res.json()
            if (data.adminNumbers) setAdminNumbers(data.adminNumbers)
            if (data.enabled !== undefined) setAdminEnabled(data.enabled)
        } catch (e) {
            console.error("Failed to load admin config")
        }
    }

    const addAdminNumber = async () => {
        if (!newAdminNumber) return
        try {
            const res = await fetch("/api/admin-config", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "add", phone: newAdminNumber })
            })
            const data = await res.json()
            if (data.config) {
                setAdminNumbers(data.config.adminNumbers)
                setNewAdminNumber("")
            }
        } catch (e) {
            console.error("Failed to add admin")
        }
    }

    const removeAdminNumber = async (phone: string) => {
        try {
            const res = await fetch("/api/admin-config", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "remove", phone })
            })
            const data = await res.json()
            if (data.config) setAdminNumbers(data.config.adminNumbers)
        } catch (e) {
            console.error("Failed to remove admin")
        }
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
                <p className="text-muted-foreground">Manage GOWA connection & AI settings.</p>
            </div>

            <Tabs defaultValue="device" className="space-y-4">
                <TabsList className="w-full flex overflow-x-auto">
                    <TabsTrigger value="device">Device & Connection</TabsTrigger>
                    <TabsTrigger value="ai">AI Settings</TabsTrigger>
                    <TabsTrigger value="admin">Admin Control</TabsTrigger>
                </TabsList>

                {/* ==================== Device Tab ==================== */}
                <TabsContent value="device" className="space-y-4">
                    {error && (
                        <Alert variant="destructive">
                            <AlertTitle>Error</AlertTitle>
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    {!isConnected ? (
                        <Card>
                            <CardHeader>
                                <CardTitle>Connect WhatsApp via GOWA</CardTitle>
                                <CardDescription>
                                    GOWA server should be running on port 3030.
                                    Click Start to get QR code.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="flex flex-col items-center justify-center p-6">
                                {sessionStatus === "STOPPED" && (
                                    <div className="text-center space-y-4">
                                        <Power className="h-16 w-16 text-muted-foreground mx-auto" />
                                        <p>Not connected to WhatsApp.</p>
                                        <Button onClick={startSession} disabled={loading}>
                                            {loading ? "Starting..." : "Start Session"}
                                        </Button>
                                        <p className="text-xs text-muted-foreground">
                                            Or open <a href="http://localhost:3030" target="_blank" className="underline">GOWA UI</a> directly
                                        </p>
                                    </div>
                                )}
                                {sessionStatus === "CONNECTING" && qrLink && (
                                    <div className="text-center space-y-4">
                                        <QrCode className="h-16 w-16 text-blue-500 mx-auto" />
                                        <p className="text-sm text-muted-foreground">
                                            Scan QR code to connect WhatsApp
                                        </p>
                                        <div className="flex flex-col gap-2">
                                            <Button asChild>
                                                <a href={qrLink} target="_blank" rel="noopener noreferrer">
                                                    <ExternalLink className="mr-2 h-4 w-4" />
                                                    Open QR Code
                                                </a>
                                            </Button>
                                            <Button asChild variant="outline">
                                                <a href="http://localhost:3030" target="_blank" rel="noopener noreferrer">
                                                    Open GOWA UI
                                                </a>
                                            </Button>
                                        </div>
                                        <Button variant="ghost" onClick={checkStatus}>
                                            <RefreshCw className="mr-2 h-4 w-4" /> Check Connection
                                        </Button>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ) : (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Smartphone className="h-5 w-5 text-green-500" />
                                    Connected
                                    <Badge variant="secondary">GOWA</Badge>
                                </CardTitle>
                                <CardDescription>Your WhatsApp is connected via GOWA.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {deviceInfo && (
                                    <div className="space-y-2">
                                        <p><strong>Name:</strong> {deviceInfo.name || "N/A"}</p>
                                        <p><strong>Device:</strong> {deviceInfo.device || "N/A"}</p>
                                    </div>
                                )}
                            </CardContent>
                            <CardFooter className="gap-2">
                                <Button variant="outline" onClick={reconnect} disabled={loading}>
                                    <RefreshCw className="mr-2 h-4 w-4" /> Reconnect
                                </Button>
                                <Button variant="destructive" onClick={logout} disabled={loading}>
                                    <LogOut className="mr-2 h-4 w-4" /> Logout
                                </Button>
                            </CardFooter>
                        </Card>
                    )}

                    {/* GOWA Server Info */}
                    <Card>
                        <CardHeader>
                            <CardTitle>GOWA Server</CardTitle>
                            <CardDescription>Server information and quick links.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between">
                                <span>GOWA API</span>
                                <code className="bg-muted px-2 py-1 rounded text-sm">http://localhost:3030</code>
                            </div>
                            <div className="flex items-center justify-between">
                                <span>Webhook</span>
                                <code className="bg-muted px-2 py-1 rounded text-sm">/api/webhook</code>
                            </div>
                            <Button asChild variant="outline" className="w-full">
                                <a href="http://localhost:3030" target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="mr-2 h-4 w-4" />
                                    Open GOWA Dashboard
                                </a>
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ==================== AI Settings Tab ==================== */}
                <TabsContent value="ai" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Bot className="h-5 w-5" />
                                Groq AI Configuration
                            </CardTitle>
                            <CardDescription>Configure AI-powered auto-reply using Groq.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Enable/Disable */}
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label>Enable AI Auto-Reply</Label>
                                    <p className="text-sm text-muted-foreground">When enabled, AI will respond if no keyword rules match.</p>
                                </div>
                                <Switch checked={aiEnabled} onCheckedChange={setAiEnabled} />
                            </div>

                            {/* Model Selection */}
                            <div className="space-y-2">
                                <Label>AI Model</Label>
                                <Select value={aiModel} onValueChange={setAiModel}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="llama-3.1-8b-instant">Llama 3.1 8B (Fast)</SelectItem>
                                        <SelectItem value="llama-3.1-70b-versatile">Llama 3.1 70B (Smart)</SelectItem>
                                        <SelectItem value="mixtral-8x7b-32768">Mixtral 8x7B</SelectItem>
                                        <SelectItem value="gemma2-9b-it">Gemma2 9B</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* System Prompt */}
                            <div className="space-y-2">
                                <Label>System Prompt</Label>
                                <Textarea
                                    value={aiSystemPrompt}
                                    onChange={(e) => setAiSystemPrompt(e.target.value)}
                                    placeholder="Instructions for the AI..."
                                    rows={5}
                                />
                                <p className="text-xs text-muted-foreground">This prompt defines the AI's personality and behavior.</p>
                            </div>

                            <Button onClick={saveAiConfig} disabled={aiLoading}>
                                {aiLoading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Save AI Settings
                            </Button>
                        </CardContent>
                    </Card>

                    {/* API Keys */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Key className="h-5 w-5" />
                                API Keys
                                <Badge variant="secondary">{aiApiKeys.length} keys</Badge>
                            </CardTitle>
                            <CardDescription>Manage Groq API keys with auto-rotation.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex gap-2">
                                <Input
                                    placeholder="gsk_..."
                                    value={newApiKey}
                                    onChange={(e) => setNewApiKey(e.target.value)}
                                />
                                <Button onClick={addApiKey} disabled={aiLoading || !newApiKey}>
                                    <Plus className="h-4 w-4" />
                                </Button>
                            </div>

                            <div className="space-y-2 max-h-48 overflow-auto">
                                {aiApiKeys.map((key, idx) => (
                                    <div key={idx} className="flex items-center justify-between bg-muted p-2 rounded text-sm">
                                        <code className="font-mono">{key}</code>
                                        <Button size="sm" variant="ghost" onClick={() => removeApiKey(idx)}>
                                            <Trash2 className="h-4 w-4 text-red-500" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Test AI */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Test AI Response</CardTitle>
                            <CardDescription>Send a test message to verify AI is working.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex gap-2">
                                <Input
                                    placeholder="Type a test message..."
                                    value={testMessage}
                                    onChange={(e) => setTestMessage(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && testAi()}
                                />
                                <Button onClick={testAi} disabled={aiLoading || !testMessage}>
                                    <Send className="h-4 w-4" />
                                </Button>
                            </div>
                            {testResponse && (
                                <div className="bg-muted p-4 rounded">
                                    <p className="text-sm font-medium mb-1">AI Response:</p>
                                    <p className="text-sm">{testResponse}</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Admin Tab */}
                <TabsContent value="admin" className="space-y-4 mt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Admin Numbers</CardTitle>
                            <CardDescription>
                                Phone numbers that can control the bot via WhatsApp commands like /broadcast, /status, /templates
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Add Admin Number */}
                            <div className="flex gap-2">
                                <Input
                                    placeholder="628123456789"
                                    value={newAdminNumber}
                                    onChange={(e) => setNewAdminNumber(e.target.value)}
                                />
                                <Button onClick={addAdminNumber} disabled={!newAdminNumber}>
                                    Add Admin
                                </Button>
                            </div>

                            {/* Admin List */}
                            {adminNumbers.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                    No admin numbers configured. Add a phone number above.
                                </p>
                            ) : (
                                <div className="space-y-2">
                                    {adminNumbers.map((phone, i) => (
                                        <div key={i} className="flex items-center justify-between bg-muted/50 p-2 rounded">
                                            <span className="font-mono text-sm">{phone}</span>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="text-red-500 hover:text-red-600"
                                                onClick={() => removeAdminNumber(phone)}
                                            >
                                                Remove
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <Alert>
                                <AlertTitle>Admin Commands</AlertTitle>
                                <AlertDescription className="text-xs space-y-1">
                                    <p>• <code>/status</code> - Check bot status</p>
                                    <p>• <code>/templates</code> - List saved group templates</p>
                                    <p>• <code>/broadcast templateName message</code> - Broadcast to template groups</p>
                                </AlertDescription>
                            </Alert>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
}
