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
  LogOut
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

export function Sidebar() {
  const pathname = usePathname()

  return (
    <div className="flex h-full w-64 flex-col border-r bg-card text-card-foreground">
      <div className="flex h-16 items-center border-b px-6">
        <span className="text-xl font-bold tracking-tight text-primary">WA Broadcast</span>
      </div>
      <div className="flex-1 overflow-auto py-4">
        <nav className="grid gap-1 px-2">
          {sidebarItems.map((item, index) => (
            <Link key={index} href={item.href}>
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
}
