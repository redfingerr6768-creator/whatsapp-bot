export function Header() {
    return (
        <header className="flex h-16 items-center gap-4 border-b bg-background px-6">
            <div className="flex-1">
                <h1 className="text-lg font-semibold">Dashboard</h1>
            </div>
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
                    <span className="text-sm text-muted-foreground">System Online</span>
                </div>
            </div>
        </header>
    )
}
