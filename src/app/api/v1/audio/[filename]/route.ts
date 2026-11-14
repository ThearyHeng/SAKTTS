import fs from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { getAudioDir } from "@/lib/store";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ filename: string }> }
) {
  const { filename } = await context.params;
  const safeName = path.basename(filename);
  const filePath = path.join(getAudioDir(), safeName);

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "Audio file not found" }, { status: 404 });
  }

  const stat = fs.statSync(filePath);
  const ext = path.extname(safeName).toLowerCase();
  const isVideoWebm = ext === ".webm" && safeName.startsWith("sub-vid-");
  const contentType =
    ext === ".wav"
      ? "audio/wav"
      : ext === ".mp4"
      ? "video/mp4"
      : ext === ".mov"
      ? "video/quicktime"
      : ext === ".mkv"
      ? "video/x-matroska"
      : ext === ".webm"
      ? isVideoWebm
        ? "video/webm"
        : "audio/webm"
      : ext === ".ogg"
      ? "audio/ogg"
      : ext === ".m4a"
      ? "audio/mp4"
      : ext === ".flac"
      ? "audio/flac"
      : ext === ".vtt"
      ? "text/vtt; charset=utf-8"
      : ext === ".srt"
      ? "application/x-subrip; charset=utf-8"
      : "audio/mpeg";

  const range = req.headers.get("range");
  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = Math.max(0, parseInt(parts[0], 10) || 0);
    const requestedEnd = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
    const end = Math.min(stat.size - 1, Number.isFinite(requestedEnd) ? requestedEnd : stat.size - 1);
    if (start >= stat.size || start > end) {
      return new NextResponse(null, {
        status: 416,
        headers: {
          "Content-Range": `bytes */${stat.size}`,
          "Accept-Ranges": "bytes",
        },
      });
    }
    const chunkSize = end - start + 1;
    const buffer = Buffer.alloc(chunkSize);
    const fd = fs.openSync(filePath, "r");
    fs.readSync(fd, buffer, 0, chunkSize, start);
    fs.closeSync(fd);
    return new NextResponse(buffer, {
      status: 206,
      headers: {
        "Content-Range": `bytes ${start}-${end}/${stat.size}`,
        "Accept-Ranges": "bytes",
        "Content-Length": String(chunkSize),
        "Content-Type": contentType,
      },
    });
  }

  const data = fs.readFileSync(filePath);
  return new NextResponse(data, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(stat.size),
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
