"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RefreshCw, Users, UsersRound, MessageSquare, CheckCircle, XCircle, Smartphone } from "lucide-react"

interface Stats {
    groups: number;
    contacts: number;
    chats: number;
    sessionStatus: string;
    sessionName?: string;
    me?: any;
}

export default function DashboardPage() {
    const [stats, setStats] = useState<Stats>({
        groups: 0,
        contacts: 0,
        chats: 0,
        sessionStatus: "STOPPED"
    })
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        fetchStats()
    }, [])

    const fetchStats = async () => {
        setLoading(true)
        setError(null)

        try {
            // Fetch session status
            const sessionRes = await fetch("/api/waha?action=sessions")
            const sessionData = await sessionRes.json()
            const sessions = Array.isArray(sessionData) ? sessionData : []
            const defaultSession = sessions.find((s: any) => s.name === "default")

            let newStats: Stats = {
                groups: 0,
                contacts: 0,
                chats: 0,
                sessionStatus: defaultSession?.status || "STOPPED",
                sessionName: defaultSession?.name
            }

            // Only fetch other data if connected
            if (defaultSession?.status === "WORKING") {
                // Groups count
                try {
                    const groupsRes = await fetch("/api/groups?action=count")
                    const groupsData = await groupsRes.json()
                    newStats.groups = groupsData.count || 0
                } catch (e) { }

                // Chats count
                try {
                    const chatsRes = await fetch("/api/chats?action=list&limit=500")
                    const chatsData = await chatsRes.json()
                    newStats.chats = Array.isArray(chatsData) ? chatsData.length : 0
                } catch (e) { }

                // Contacts count
                try {
                    const contactsRes = await fetch("/api/contacts?action=list")
                    const contactsData = await contactsRes.json()
                    newStats.contacts = Array.isArray(contactsData) ? contactsData.filter((c: any) => !c.isGroup && !c.isMe).length : 0
                } catch (e) { }

                // Get me info
                try {
                    const meRes = await fetch("/api/waha?action=me")
                    const meData = await meRes.json()
                    if (!meData.error) newStats.me = meData
                } catch (e) { }
            }

            setStats(newStats)
        } catch (e: any) {
            setError(e.message)
        } finally {
            setLoading(false)
        }
    }

    const isConnected = stats.sessionStatus === "WORKING"

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
                    <p className="text-muted-foreground">Welcome to your WhatsApp Broadcast Tool</p>
                </div>
                <Button onClick={fetchStats} disabled={loading}>
                    <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            {/* Connection Status */}
            <Card className={isConnected
                ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900"
                : "bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-900"
            }>
                <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center">
                        <Smartphone className="mr-2 h-5 w-5" />
                        WhatsApp Status
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            {isConnected ? (
                                <CheckCircle className="h-8 w-8 text-green-500" />
                            ) : (
                                <XCircle className="h-8 w-8 text-yellow-500" />
                            )}
                            <div>
                                <p className="font-semibold">
                                    {isConnected ? "Connected" : stats.sessionStatus}
                                </p>
                                {stats.me && (
                                    <p className="text-sm text-muted-foreground">
                                        {stats.me.pushname} • {stats.me.wid?.user || stats.me.wid}
                                    </p>
                                )}
                                {!isConnected && (
                                    <p className="text-sm text-muted-foreground">
                                        Go to Settings to connect your WhatsApp
                                    </p>
                                )}
                            </div>
                        </div>
                        <Badge variant={isConnected ? "default" : "secondary"}>
                            {stats.sessionStatus}
                        </Badge>
                    </div>
                </CardContent>
            </Card>

            {/* Stats Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Groups</CardTitle>
                        <UsersRound className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.groups}</div>
                        <p className="text-xs text-muted-foreground">WhatsApp groups</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Contacts</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.contacts}</div>
                        <p className="text-xs text-muted-foreground">Saved contacts</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active Chats</CardTitle>
                        <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.chats}</div>
                        <p className="text-xs text-muted-foreground">Recent conversations</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Session</CardTitle>
                        <Smartphone className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {isConnected ? "Online" : "Offline"}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {stats.sessionName || "default"} session
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Quick Actions */}
            <Card>
                <CardHeader>
                    <CardTitle>Quick Actions</CardTitle>
                    <CardDescription>Common tasks you can do</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <Button variant="outline" className="h-20 flex-col" asChild>
                            <a href="/dashboard/broadcast">
                                <MessageSquare className="h-6 w-6 mb-2" />
                                New Broadcast
                            </a>
                        </Button>
                        <Button variant="outline" className="h-20 flex-col" asChild>
                            <a href="/dashboard/groups">
                                <UsersRound className="h-6 w-6 mb-2" />
                                View Groups
                            </a>
                        </Button>
                        <Button variant="outline" className="h-20 flex-col" asChild>
                            <a href="/dashboard/chat">
                                <MessageSquare className="h-6 w-6 mb-2" />
                                Live Chat
                            </a>
                        </Button>
                        <Button variant="outline" className="h-20 flex-col" asChild>
                            <a href="/dashboard/settings">
                                <Smartphone className="h-6 w-6 mb-2" />
                                Settings
                            </a>
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {error && (
                <Card className="border-red-200">
                    <CardContent className="pt-4 text-red-600 text-sm">
                        ⚠️ Error: {error}
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
