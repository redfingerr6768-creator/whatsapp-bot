"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { RefreshCw, Users, UsersRound, MessageSquare, Smartphone, Activity, Clock, HardDrive } from "lucide-react"

interface SystemStats {
    groups: number;
    contacts: number;
    chats: number;
    sessionStatus: string;
    me?: any;
    serverTime?: string;
}

export default function AnalyticsPage() {
    const [stats, setStats] = useState<SystemStats>({
        groups: 0,
        contacts: 0,
        chats: 0,
        sessionStatus: "STOPPED"
    })
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchStats()
    }, [])

    const fetchStats = async () => {
        setLoading(true)
        try {
            const sessionRes = await fetch("/api/waha?action=sessions")
            const sessionData = await sessionRes.json()
            const sessions = Array.isArray(sessionData) ? sessionData : []
            const defaultSession = sessions.find((s: any) => s.name === "default")

            let newStats: SystemStats = {
                groups: 0,
                contacts: 0,
                chats: 0,
                sessionStatus: defaultSession?.status || "STOPPED",
                serverTime: new Date().toISOString()
            }

            if (defaultSession?.status === "WORKING") {
                try {
                    const groupsRes = await fetch("/api/groups?action=count")
                    const groupsData = await groupsRes.json()
                    newStats.groups = groupsData.count || 0
                } catch (e) { }

                try {
                    const chatsRes = await fetch("/api/chats?action=list&limit=500")
                    const chatsData = await chatsRes.json()
                    newStats.chats = Array.isArray(chatsData) ? chatsData.length : 0
                } catch (e) { }

                try {
                    const contactsRes = await fetch("/api/contacts?action=list")
                    const contactsData = await contactsRes.json()
                    newStats.contacts = Array.isArray(contactsData) ? contactsData.filter((c: any) => !c.isGroup && !c.isMe).length : 0
                } catch (e) { }

                try {
                    const meRes = await fetch("/api/waha?action=me")
                    const meData = await meRes.json()
                    if (!meData.error) newStats.me = meData
                } catch (e) { }
            }

            setStats(newStats)
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    const isConnected = stats.sessionStatus === "WORKING"

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Analytics</h2>
                    <p className="text-muted-foreground">System statistics and health overview</p>
                </div>
                <Button onClick={fetchStats} disabled={loading}>
                    <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            <Tabs defaultValue="overview" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="system">System Health</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Groups</CardTitle>
                                <UsersRound className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{stats.groups}</div>
                                <p className="text-xs text-muted-foreground">Total WhatsApp groups</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Contacts</CardTitle>
                                <Users className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{stats.contacts}</div>
                                <p className="text-xs text-muted-foreground">Total saved contacts</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Chats</CardTitle>
                                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{stats.chats}</div>
                                <p className="text-xs text-muted-foreground">Active conversations</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Status</CardTitle>
                                <Activity className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{isConnected ? "Online" : "Offline"}</div>
                                <p className="text-xs text-muted-foreground">WhatsApp connection</p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Account Info */}
                    {stats.me && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Connected Account</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                                        <Smartphone className="h-8 w-8 text-primary" />
                                    </div>
                                    <div>
                                        <p className="text-lg font-semibold">{stats.me.pushname || "WhatsApp User"}</p>
                                        <p className="text-sm text-muted-foreground">
                                            +{stats.me.wid?.user || stats.me.wid}
                                        </p>
                                        <Badge variant="default" className="mt-2">Connected</Badge>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>

                <TabsContent value="system" className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Smartphone className="h-5 w-5" />
                                    WAHA Engine
                                </CardTitle>
                                <CardDescription>WhatsApp HTTP API status</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="flex justify-between">
                                    <span className="text-sm text-muted-foreground">Server URL</span>
                                    <span className="text-sm font-mono">localhost:8080</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-muted-foreground">Session</span>
                                    <span className="text-sm font-mono">default</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-muted-foreground">Status</span>
                                    <Badge variant={isConnected ? "default" : "secondary"}>
                                        {stats.sessionStatus}
                                    </Badge>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Clock className="h-5 w-5" />
                                    Server Time
                                </CardTitle>
                                <CardDescription>Last data refresh</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="flex justify-between">
                                    <span className="text-sm text-muted-foreground">Last Refresh</span>
                                    <span className="text-sm">
                                        {stats.serverTime ? new Date(stats.serverTime).toLocaleString() : "-"}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-muted-foreground">Auto Refresh</span>
                                    <span className="text-sm">Disabled</span>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="md:col-span-2">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <HardDrive className="h-5 w-5" />
                                    Features Status
                                </CardTitle>
                                <CardDescription>Current feature availability</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="grid gap-2 md:grid-cols-3">
                                    {[
                                        { name: "Groups Management", status: true },
                                        { name: "Broadcast Messaging", status: true },
                                        { name: "Live Chat", status: true },
                                        { name: "Contacts", status: true },
                                        { name: "Phone Number Check", status: true },
                                        { name: "Session Management", status: true },
                                    ].map((feature, i) => (
                                        <div key={i} className="flex items-center justify-between p-2 rounded bg-muted/50">
                                            <span className="text-sm">{feature.name}</span>
                                            <Badge variant={feature.status ? "default" : "secondary"}>
                                                {feature.status ? "Active" : "Disabled"}
                                            </Badge>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    )
}
