/**
 * Auto Broadcast API Route
 * Manages auto broadcast configuration from dashboard
 */

import { NextRequest, NextResponse } from "next/server";
import {
    getAutoBroadcastConfig,
    getAutoBroadcastStatus,
    startAutoBroadcast,
    stopAutoBroadcast,
} from "@/lib/autoBroadcast";

/**
 * GET /api/auto-broadcast
 * Returns current auto broadcast config and status
 */
export async function GET() {
    try {
        const status = getAutoBroadcastStatus();
        return NextResponse.json({
            success: true,
            data: {
                config: status.config,
                isRunning: status.isRunning,
                isExecuting: status.isExecuting,
                nextIn: status.nextIn,
            },
        });
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

/**
 * POST /api/auto-broadcast
 * Start, stop, or update auto broadcast
 * Body: { action: "start" | "stop", templateNames?: string[], minInterval?: number, maxInterval?: number }
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { action, templateNames, minInterval, maxInterval } = body;

        if (action === "start") {
            if (!templateNames || !Array.isArray(templateNames) || templateNames.length === 0) {
                return NextResponse.json(
                    { success: false, error: "templateNames required" },
                    { status: 400 }
                );
            }

            const config = startAutoBroadcast(
                templateNames,
                minInterval || 60,
                maxInterval || 80,
                "dashboard"
            );

            return NextResponse.json({ success: true, data: config });
        }

        if (action === "stop") {
            const config = stopAutoBroadcast();
            return NextResponse.json({ success: true, data: config });
        }

        return NextResponse.json(
            { success: false, error: 'Invalid action. Use "start" or "stop".' },
            { status: 400 }
        );
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
