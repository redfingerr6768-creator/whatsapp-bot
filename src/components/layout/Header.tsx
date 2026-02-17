"use client"

import { Menu } from "lucide-react"
import { Button } from "@/components/ui/button"

interface HeaderProps {
    onMenuClick?: () => void
}

export function Header({ onMenuClick }: HeaderProps) {
    return (
        <header className="flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6">
            {/* Hamburger menu - mobile only */}
            <Button
                variant="ghost"
                size="sm"
                className="md:hidden -ml-1"
                onClick={onMenuClick}
            >
                <Menu className="h-5 w-5" />
            </Button>
            <div className="flex-1">
                <h1 className="text-lg font-semibold">Dashboard</h1>
            </div>
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
                    <span className="text-sm text-muted-foreground hidden sm:inline">System Online</span>
                </div>
            </div>
        </header>
    )
}
