import { NextRequest, NextResponse } from "next/server";
import { put, list, del } from "@vercel/blob";

/**
 * GET /api/library — List all saved generations
 * POST /api/library — Save a new generation
 * DELETE /api/library?url=... — Delete a generation
 */

export async function GET() {
  // 如果没有配置 Vercel Blob token，返回空列表
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ items: [] });
  }
  
  try {
    const { blobs } = await list({ prefix: "generations/" });

    const items = blobs.map((blob) => ({
      url: blob.url,
      pathname: blob.pathname,
      createdAt: blob.uploadedAt.toISOString(),
      size: blob.size,
    }));

    // Sort newest first
    items.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return NextResponse.json({ items });
  } catch (error) {
    console.error("Library list error:", error);
    return NextResponse.json({ items: [], error: "Failed to list library" });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { lottie_json, prompt, mode, duration_sec, gpu_cost_usd } = body;

    if (!lottie_json) {
      return NextResponse.json(
        { error: "No animation data" },
        { status: 400 }
      );
    }

    // Store both the Lottie JSON and metadata
    const metadata = {
      prompt: prompt || "",
      mode: mode || "text",
      duration_sec: duration_sec || 0,
      gpu_cost_usd: gpu_cost_usd || 0,
      layers: lottie_json.layers?.length || 0,
      width: lottie_json.w || 512,
      height: lottie_json.h || 512,
    };

    const timestamp = Date.now();
    const slug = (prompt || "animation")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 40);

    const blob = await put(
      `generations/${timestamp}-${slug}.json`,
      JSON.stringify({ lottie_json, metadata }),
      {
        access: "public",
        contentType: "application/json",
      }
    );

    return NextResponse.json({
      url: blob.url,
      pathname: blob.pathname,
    });
  } catch (error) {
    console.error("Library save error:", error);
    return NextResponse.json(
      { error: "Failed to save animation" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const url = request.nextUrl.searchParams.get("url");
    if (!url) {
      return NextResponse.json({ error: "No URL provided" }, { status: 400 });
    }

    await del(url);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Library delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete" },
      { status: 500 }
    );
  }
}
