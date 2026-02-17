import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File | null;

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        // Ensure upload directory exists
        if (!existsSync(UPLOAD_DIR)) {
            await mkdir(UPLOAD_DIR, { recursive: true });
        }

        // Generate unique filename
        const timestamp = Date.now();
        let ext = path.extname(file.name) || ".bin";

        // Remap unsupported image extensions to GOWA-compatible ones
        const extRemap: Record<string, string> = {
            ".jfif": ".jpg",
            ".jpe": ".jpg",
            ".pjpeg": ".jpg",
            ".pjp": ".jpg",
        };
        ext = extRemap[ext.toLowerCase()] || ext;

        const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_").slice(0, 50);
        const filename = `${timestamp}-${safeName.replace(/\.[^.]+$/, "")}${ext}`;

        // Read file buffer and save
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const filePath = path.join(UPLOAD_DIR, filename);
        await writeFile(filePath, buffer);

        // Return the public URL
        const publicUrl = `/uploads/${filename}`;

        return NextResponse.json({
            success: true,
            filename,
            url: publicUrl,
            size: file.size,
            type: file.type
        });
    } catch (error: any) {
        console.error("Upload error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// GET - List uploaded files (for cleanup/management)
export async function GET(req: NextRequest) {
    try {
        const fs = await import("fs/promises");
        if (!existsSync(UPLOAD_DIR)) {
            return NextResponse.json([]);
        }
        const files = await fs.readdir(UPLOAD_DIR);
        return NextResponse.json(files.map(f => ({
            filename: f,
            url: `/uploads/${f}`
        })));
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
