"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  LayoutDashboard,
  Users,
  UsersRound,
  Megaphone,
  Bot,
  Settings,
  MessageSquare,
  BarChart3,
  LogOut,
  X
} from "lucide-react"

const sidebarItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
  { icon: Users, label: "Contacts", href: "/dashboard/contacts" },
  { icon: UsersRound, label: "Groups", href: "/dashboard/groups" },
  { icon: Megaphone, label: "Broadcast", href: "/dashboard/broadcast" },
  { icon: Bot, label: "Automation", href: "/dashboard/automation" },
  { icon: MessageSquare, label: "Live Chat", href: "/dashboard/chat" },
  { icon: BarChart3, label: "Analytics", href: "/dashboard/analytics" },
  { icon: Settings, label: "Settings", href: "/dashboard/settings" },
]

interface SidebarProps {
  isOpen?: boolean
  onClose?: () => void
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname()

  const sidebarContent = (
    <div className="flex h-full w-64 flex-col border-r bg-card text-card-foreground">
      <div className="flex h-16 items-center justify-between border-b px-6">
        <span className="text-xl font-bold tracking-tight text-primary">WA Broadcast</span>
        {/* Close button visible only on mobile */}
        <Button
          variant="ghost"
          size="sm"
          className="md:hidden -mr-2"
          onClick={onClose}
        >
          <X className="h-5 w-5" />
        </Button>
      </div>
      <div className="flex-1 overflow-auto py-4">
        <nav className="grid gap-1 px-2">
          {sidebarItems.map((item, index) => (
            <Link key={index} href={item.href} onClick={onClose}>
              <span
                className={cn(
                  "group flex items-center rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground",
                  pathname === item.href ? "bg-accent text-accent-foreground" : "text-muted-foreground"
                )}
              >
                <item.icon className="mr-2 h-4 w-4" />
                <span>{item.label}</span>
              </span>
            </Link>
          ))}
        </nav>
      </div>
      <div className="border-t p-4">
        <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-destructive">
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </Button>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop sidebar - always visible */}
      <div className="hidden md:flex">
        {sidebarContent}
      </div>

      {/* Mobile sidebar - overlay drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={onClose}
          />
          {/* Drawer */}
          <div className="relative h-full w-64 animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  )
}
