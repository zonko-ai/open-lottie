/**
 * @fileoverview Library API routes for managing saved Lottie animations.
 * Provides CRUD operations for the animation library using Vercel Blob storage.
 * @module api/library
 */

import { NextRequest, NextResponse } from "next/server";
import { put, list, del } from "@vercel/blob";

/**
 * GET /api/library — List all saved generations.
 * Returns an array of saved animation metadata sorted by creation date (newest first).
 * 
 * @returns JSON response with items array or empty array if not configured
 * 
 * @example
 * // Response
 * {
 *   "items": [
 *     {
 *       "url": "https://...",
 *       "pathname": "generations/123-animation.json",
 *       "createdAt": "2026-03-09T12:00:00.000Z",
 *       "size": 12345
 *     }
 *   ]
 * }
 */
export async function GET() {
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

    items.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return NextResponse.json({ items });
  } catch (error) {
    console.error("Library list error:", error);
    return NextResponse.json({ items: [] });
  }
}

/**
 * POST /api/library — Save a new generation.
 * Stores the Lottie JSON and metadata to Vercel Blob storage.
 * 
 * @param request - The incoming Next.js request object
 * @returns JSON response with the saved blob URL and pathname
 * 
 * @example
 * // Request body
 * {
 *   "lottie_json": { ... },
 *   "prompt": "A bouncing ball",
 *   "mode": "text",
 *   "duration_sec": 45,
 *   "gpu_cost_usd": 0.0123
 * }
 * 
 * // Response
 * {
 *   "url": "https://...",
 *   "pathname": "generations/1234567890-a-bouncing-ball.json"
 * }
 */
export async function POST(request: NextRequest) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: "Library feature is not configured" },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const { lottie_json, prompt, mode, duration_sec, gpu_cost_usd } = body;

    if (!lottie_json) {
      return NextResponse.json(
        { error: "No animation data" },
        { status: 400 }
      );
    }

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

/**
 * DELETE /api/library?url=... — Delete a generation.
 * Removes the specified animation from Vercel Blob storage.
 * 
 * @param request - The incoming Next.js request object with URL parameter
 * @returns JSON response with success status
 * 
 * @example
 * // Request
 * DELETE /api/library?url=https://blob.vercel-storage.com/...
 * 
 * // Response
 * { "ok": true }
 */
export async function DELETE(request: NextRequest) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: "Library feature is not configured" },
      { status: 503 }
    );
  }
  
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
