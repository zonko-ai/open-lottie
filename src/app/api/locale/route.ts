/**
 * @fileoverview API route for managing user locale preference.
 * Handles POST requests to set the user's preferred language via cookie.
 * @module api/locale
 */

import { NextRequest, NextResponse } from "next/server";
import { locales, type Locale } from "@/i18n/config";

/**
 * POST handler for setting user locale preference.
 * Validates the locale and sets a long-lived cookie.
 * 
 * @param request - The incoming Next.js request object
 * @returns JSON response with success status or error
 * 
 * @example
 * // Request body
 * { "locale": "zh-CN" }
 * 
 * // Success response
 * { "success": true }
 * 
 * // Error response (invalid locale)
 * { "error": "Invalid locale" }
 */
export async function POST(request: NextRequest) {
  const { locale } = await request.json();
  
  if (!locales.includes(locale as Locale)) {
    return NextResponse.json({ error: "Invalid locale" }, { status: 400 });
  }
  
  const response = NextResponse.json({ success: true });
  response.cookies.set("locale", locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 year
    sameSite: "lax"
  });
  
  return response;
}
