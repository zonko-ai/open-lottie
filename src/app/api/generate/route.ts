import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/generate
 *
 * Supports two backends:
 *   1. "modal" (default) — Self-hosted Modal GPU deployment
 *   2. "huggingface" — OmniLottie HuggingFace Space (free, quota-limited)
 */

const MODAL_URL =
  "https://nkjain92--omnilottie-omnilottieservice-generate.modal.run";
const HF_SPACE = "OmniLottie/OmniLottie";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_MODEL = "gemini-2.5-flash-lite";

// Track when Modal GPU was last used (in-memory, resets on server restart)
// Modal scaledown_window is 300s, so GPU stays warm ~5min after last request
const MODAL_SCALEDOWN_MS = 5 * 60 * 1000;
let lastModalRequestTime = 0;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const mode = formData.get("mode") as string;
    const prompt = formData.get("prompt") as string | null;
    let image = formData.get("image") as File | null;
    const imageUrl = formData.get("image_url") as string | null;
    const video = formData.get("video") as File | null;
    const backend = (formData.get("backend") as string) || "modal";

    const temperature =
      parseFloat(formData.get("temperature") as string) || 0.9;
    const top_p = parseFloat(formData.get("top_p") as string) || 0.25;
    const top_k = parseInt(formData.get("top_k") as string) || 5;
    const maxlen = parseInt(formData.get("maxlen") as string) || 5556;

    // If image URL provided, download it as a File
    if (mode === "image-text" && !image && imageUrl?.trim()) {
      try {
        const imgRes = await fetch(imageUrl.trim(), {
          headers: { "Accept": "image/*" },
          redirect: "follow",
        });
        if (!imgRes.ok) {
          return NextResponse.json(
            { error: `Failed to fetch image from URL (${imgRes.status})` },
            { status: 400 }
          );
        }
        const contentType = imgRes.headers.get("content-type") || "";
        if (!contentType.startsWith("image/")) {
          return NextResponse.json(
            { error: "URL does not point to an image. Please use a direct image URL (ending in .png, .jpg, etc.), not a sharing page link." },
            { status: 400 }
          );
        }
        const blob = await imgRes.blob();
        const ext = contentType.split("/")[1]?.split(";")[0] || "png";
        image = new File([blob], `image.${ext}`, { type: contentType });
      } catch {
        return NextResponse.json(
          { error: "Failed to fetch image from URL. Make sure it's a direct link to an image." },
          { status: 400 }
        );
      }
    }

    // Input validation
    if (mode === "text" && !prompt?.trim()) {
      return NextResponse.json(
        { error: "Please provide a text description" },
        { status: 400 }
      );
    }
    if (mode === "image-text" && !image) {
      return NextResponse.json(
        { error: "Please upload an image or paste an image URL" },
        { status: 400 }
      );
    }
    if (mode === "video" && !video) {
      return NextResponse.json(
        { error: "Please upload a video" },
        { status: 400 }
      );
    }
    if (!["text", "image-text", "video"].includes(mode)) {
      return NextResponse.json(
        { error: `Unknown mode: ${mode}` },
        { status: 400 }
      );
    }

    // If image-text mode with image but no prompt, use Gemini to describe the image
    let finalPrompt = prompt;
    if (mode === "image-text" && image && !prompt?.trim()) {
      const description = await describeImageWithGemini(image);
      if (description) {
        finalPrompt = description;
      }
    }

    if (backend === "modal") {
      return await generateViaModal(
        mode,
        finalPrompt,
        image,
        video,
        temperature,
        top_p,
        top_k,
        maxlen
      );
    } else {
      return await generateViaHuggingFace(
        mode,
        finalPrompt,
        image,
        video,
        temperature,
        top_p,
        top_k,
        maxlen
      );
    }
  } catch (error) {
    console.error("Generation error:", error);
    let message = "Unknown error";
    if (error instanceof Error) {
      message = error.message;
    } else if (typeof error === "object" && error !== null) {
      const errObj = error as Record<string, unknown>;
      if (errObj.title) {
        message = String(errObj.title);
        if (errObj.message) message += `: ${errObj.message}`;
      } else {
        message = JSON.stringify(error);
      }
    } else {
      message = String(error);
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// --- Gemini image description ---

async function describeImageWithGemini(image: File): Promise<string | null> {
  if (!GEMINI_API_KEY) {
    console.warn("GEMINI_API_KEY not set, skipping image description");
    return null;
  }

  try {
    const buffer = await image.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    const mimeType = image.type || "image/png";

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: "Describe this image in one concise sentence for animating it as a Lottie vector animation. Focus on the key visual elements, their colors, shapes, and what motion or animation would suit them. Be specific and actionable. Example: 'A red heart shape that could pulse and grow with a beating animation' or 'A blue rocket with orange flames that could launch upward with a trail effect'.",
                },
                {
                  inlineData: { mimeType, data: base64 },
                },
              ],
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      console.error("Gemini API error:", response.status, await response.text());
      return null;
    }

    const data = await response.json();
    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
    if (text) {
      console.log("Gemini image description:", text);
    }
    return text;
  } catch (error) {
    console.error("Gemini description error:", error);
    return null;
  }
}

// --- Modal backend ---

async function generateViaModal(
  mode: string,
  prompt: string | null,
  image: File | null,
  video: File | null,
  temperature: number,
  top_p: number,
  top_k: number,
  max_tokens: number
) {
  const startTime = Date.now();
  const body: Record<string, unknown> = {
    mode,
    prompt: prompt || "",
    temperature,
    top_p,
    top_k,
    max_tokens,
    use_sampling: true,
  };

  // For image/video modes, convert to base64
  if (mode === "image-text" && image) {
    const buffer = await image.arrayBuffer();
    body.image_base64 = Buffer.from(buffer).toString("base64");
  }
  if (mode === "video" && video) {
    const buffer = await video.arrayBuffer();
    body.video_base64 = Buffer.from(buffer).toString("base64");
  }

  const response = await fetch(MODAL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    return NextResponse.json(
      { error: `Modal backend error (${response.status}): ${text}` },
      { status: 502 }
    );
  }

  const data = await response.json();

  if (data.error) {
    return NextResponse.json({ error: data.error }, { status: 500 });
  }

  const durationSec = (Date.now() - startTime) / 1000;
  const gpuCost = durationSec * 0.000306; // A10G: $0.000306/sec

  lastModalRequestTime = Date.now();
  return NextResponse.json({
    lottie_json: data.lottie_json,
    duration_sec: Math.round(durationSec),
    gpu_cost_usd: Math.round(gpuCost * 10000) / 10000,
  });
}

// --- HuggingFace Space backend ---

async function generateViaHuggingFace(
  mode: string,
  prompt: string | null,
  image: File | null,
  video: File | null,
  temperature: number,
  top_p: number,
  top_k: number,
  maxlen: number
) {
  const { Client } = await import("@gradio/client");
  const client = await Client.connect(HF_SPACE);

  let result;

  if (mode === "text") {
    result = await client.predict("/process_text_to_lottie", {
      text_prompt: prompt,
      max_tokens: maxlen,
      use_sampling: true,
      temperature,
      top_p,
      top_k,
    });
  } else if (mode === "image-text") {
    const imageBuffer = await image!.arrayBuffer();
    const imageBlob = new Blob([imageBuffer], { type: image!.type });
    result = await client.predict("/process_image_to_lottie", {
      image_file: imageBlob,
      text_description: prompt || "",
      max_tokens: maxlen,
      use_sampling: true,
      temperature,
      top_p,
      top_k,
    });
  } else {
    const videoBuffer = await video!.arrayBuffer();
    const videoBlob = new Blob([videoBuffer], { type: video!.type });
    result = await client.predict("/process_video_to_lottie", {
      video: videoBlob,
      max_tokens: maxlen,
      use_sampling: true,
      temperature,
      top_p,
      top_k,
    });
  }

  const data = result.data as unknown[];
  const fileInfo = data[2] as { url?: string; path?: string } | null;

  if (fileInfo && fileInfo.url) {
    const jsonResponse = await fetch(fileInfo.url);
    if (jsonResponse.ok) {
      const lottieJson = await jsonResponse.json();
      return NextResponse.json({ lottie_json: lottieJson });
    }
  }

  const htmlPreview = data[0] as string;
  const statusMsg = data[1] as string;

  if (
    statusMsg &&
    (statusMsg.includes("Error") || statusMsg.includes("error"))
  ) {
    return NextResponse.json({ error: statusMsg }, { status: 500 });
  }

  if (htmlPreview) {
    const base64Match = htmlPreview.match(
      /data:application\/json;base64,([^"']+)/
    );
    if (base64Match) {
      const jsonStr = Buffer.from(base64Match[1], "base64").toString("utf-8");
      const lottieJson = JSON.parse(jsonStr);
      return NextResponse.json({ lottie_json: lottieJson });
    }
  }

  return NextResponse.json(
    { error: "Failed to extract Lottie JSON from response" },
    { status: 500 }
  );
}

// --- GPU status endpoint (no external calls — purely local tracking) ---

export async function GET() {
  const elapsed = Date.now() - lastModalRequestTime;
  const status = lastModalRequestTime > 0 && elapsed < MODAL_SCALEDOWN_MS
    ? "active"
    : "inactive";
  return NextResponse.json({ status });
}
