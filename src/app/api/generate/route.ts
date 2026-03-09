/**
 * @fileoverview API route for Lottie animation generation.
 * Supports multiple backends: Modal GPU, HuggingFace Space, and local Gradio server.
 * @module api/generate
 */

import { NextRequest, NextResponse } from "next/server";

/** Modal GPU deployment URL for Lottie generation */
const MODAL_URL =
  "https://nkjain92--omnilottie-omnilottieservice-generate.modal.run";

/** HuggingFace Space identifier for OmniLottie */
const HF_SPACE = "OmniLottie/OmniLottie";

/** Local Gradio server URL (configured via environment variable) */
const LOCAL_URL = process.env.LOCAL_GRADIO_URL || "";

/** Gemini API key for image description */
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

/** Gemini model for image description */
const GEMINI_MODEL = "gemini-3.1-flash-lite-preview";

/** Modal GPU scaledown window in milliseconds (5 minutes) */
const MODAL_SCALEDOWN_MS = 5 * 60 * 1000;

/** Timestamp of last Modal GPU request (in-memory, resets on server restart) */
let lastModalRequestTime = 0;

/**
 * POST /api/generate — Generate a Lottie animation.
 * 
 * Supports three generation modes:
 * - "text": Text-to-animation generation
 * - "image-text": Image-to-animation with optional text description
 * - "video": Video-to-animation generation
 * 
 * Supports three backends:
 * - "modal": Self-hosted Modal GPU deployment (default)
 * - "huggingface": OmniLottie HuggingFace Space (free, quota-limited)
 * - "local": Local Gradio server for GPU generation
 * 
 * @param request - The incoming Next.js request with FormData
 * @returns JSON response with lottie_json or error
 * 
 * @example
 * // Request (FormData)
 * mode: "text"
 * prompt: "A bouncing ball"
 * backend: "modal"
 * temperature: 0.9
 * top_p: 0.25
 * top_k: 5
 * maxlen: 5556
 * 
 * // Response
 * {
 *   "lottie_json": { ... },
 *   "duration_sec": 45,
 *   "gpu_cost_usd": 0.0138
 * }
 */
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
    } else if (backend === "local") {
      if (!LOCAL_URL) {
        return NextResponse.json(
          { error: "Local backend is not configured" },
          { status: 503 }
        );
      }
      return await generateViaLocal(
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

/**
 * Describes an image using Google Gemini API.
 * Generates a concise description suitable for Lottie animation generation.
 * 
 * @param image - The image file to describe
 * @returns A description string, or null if description fails
 */
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

/**
 * Generates a Lottie animation using the Modal GPU backend.
 * Converts images/videos to base64 and sends to the Modal deployment.
 * 
 * @param mode - Generation mode ("text", "image-text", or "video")
 * @param prompt - Text prompt for generation
 * @param image - Image file for image-text mode
 * @param video - Video file for video mode
 * @param temperature - Sampling temperature
 * @param top_p - Nucleus sampling threshold
 * @param top_k - Top-k sampling limit
 * @param max_tokens - Maximum token length
 * @returns JSON response with lottie_json and timing/cost info
 */
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

/**
 * Generates a Lottie animation using the HuggingFace Space backend.
 * Uses the Gradio client to communicate with the OmniLottie Space.
 * 
 * @param mode - Generation mode ("text", "image-text", or "video")
 * @param prompt - Text prompt for generation
 * @param image - Image file for image-text mode
 * @param video - Video file for video mode
 * @param temperature - Sampling temperature
 * @param top_p - Nucleus sampling threshold
 * @param top_k - Top-k sampling limit
 * @param maxlen - Maximum token length
 * @returns JSON response with lottie_json or error
 */
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

/**
 * Generates a Lottie animation using a local Gradio server.
 * Extracts JSON from iframe HTML response for security (avoids file system access).
 * 
 * @param mode - Generation mode ("text", "image-text", or "video")
 * @param prompt - Text prompt for generation
 * @param image - Image file for image-text mode
 * @param video - Video file for video mode
 * @param temperature - Sampling temperature
 * @param top_p - Nucleus sampling threshold
 * @param top_k - Top-k sampling limit
 * @param maxlen - Maximum token length
 * @returns JSON response with lottie_json or error
 */
async function generateViaLocal(
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
  const client = await Client.connect(LOCAL_URL);

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

  // Gradio returns { type: "data", data: [...] }
  const gradioResult = result as unknown as { data: unknown[] };
  const dataArray = gradioResult.data as unknown[];
  
  const iframeHtml = dataArray?.[0] as string | undefined;
  const statusMsg = dataArray?.[1] as string | undefined;

  if (
    statusMsg &&
    (statusMsg.includes("Error") || statusMsg.includes("error"))
  ) {
    return NextResponse.json({ error: statusMsg }, { status: 500 });
  }

  // Extract JSON from iframe HTML (secure method, no direct file system access)
  if (iframeHtml) {
    // Extract base64 content from <iframe src="data:text/html;base64,...">
    const iframeMatch = iframeHtml.match(/src="data:text\/html;base64,([A-Za-z0-9+/=]+)"/);
    if (iframeMatch) {
      const htmlStr = Buffer.from(iframeMatch[1], "base64").toString("utf-8");
      
      // Extract JSON from JSON.parse('...') in the HTML
      const parseStart = htmlStr.indexOf("JSON.parse('");
      if (parseStart !== -1) {
        const jsonStart = parseStart + "JSON.parse('".length;
        // Find the matching closing brace
        let depth = 0;
        let jsonEnd = jsonStart;
        let inString = false;
        let escape = false;
        
        for (let i = jsonStart; i < htmlStr.length; i++) {
          const char = htmlStr[i];
          
          if (escape) {
            escape = false;
            continue;
          }
          
          if (char === '\\') {
            escape = true;
            continue;
          }
          
          if (char === '"' && !inString) {
            inString = true;
          } else if (char === '"' && inString) {
            inString = false;
          } else if (!inString) {
            if (char === '{') depth++;
            else if (char === '}') {
              depth--;
              if (depth === 0) {
                jsonEnd = i + 1;
                break;
              }
            }
          }
        }
        
        const jsonStr = htmlStr.substring(jsonStart, jsonEnd);
        try {
          const lottieJson = JSON.parse(jsonStr);
          console.log("✅ Successfully extracted JSON from HTML");
          return NextResponse.json({ lottie_json: lottieJson });
        } catch (e) {
          console.error("Failed to parse JSON from HTML:", e);
        }
      }
    }
  }

  return NextResponse.json(
    { error: "Failed to extract Lottie JSON from response" },
    { status: 500 }
  );
}

/**
 * GET /api/generate — Check Modal GPU status.
 * Returns whether the GPU is currently active (warm) or inactive (cold).
 * Uses in-memory tracking based on last request time.
 * 
 * @returns JSON response with status ("active" or "inactive")
 * 
 * @example
 * // Response
 * { "status": "active" }
 */
export async function GET() {
  const elapsed = Date.now() - lastModalRequestTime;
  const status = lastModalRequestTime > 0 && elapsed < MODAL_SCALEDOWN_MS
    ? "active"
    : "inactive";
  return NextResponse.json({ status });
}
