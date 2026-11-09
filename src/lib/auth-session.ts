import type { NextRequest, NextResponse } from "next/server";

export const SESSION_COOKIE_NAME = "saktts_uid";

export function getSessionUserId(req?: NextRequest | null): string | null {
  if (!req) return null;
  const val = req.cookies.get(SESSION_COOKIE_NAME)?.value?.trim();
  return val || null;
}

export function setSessionUserCookie(res: NextResponse, userId: string): void {
  res.cookies.set(SESSION_COOKIE_NAME, userId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export function clearSessionUserCookie(res: NextResponse): void {
  res.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
