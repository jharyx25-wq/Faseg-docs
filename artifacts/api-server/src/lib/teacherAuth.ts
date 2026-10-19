import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

export const TEACHER_COOKIE_NAME = "faseg_teacher_session";
export const TEACHER_SESSION_TTL_MS = 12 * 60 * 60 * 1000;

function sessionSecret(): string | undefined {
  return process.env.SESSION_SECRET;
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createTeacherToken(): string {
  const secret = sessionSecret();
  if (!secret) {
    throw new Error("SESSION_SECRET is not configured");
  }

  const payload = Buffer.from(
    JSON.stringify({
      expiresAt: Date.now() + TEACHER_SESSION_TTL_MS,
      nonce: randomBytes(16).toString("base64url"),
    }),
  ).toString("base64url");

  return `${payload}.${sign(payload, secret)}`;
}

export function isTeacherAuthenticated(req: Request): boolean {
  const secret = sessionSecret();
  const token = req.cookies?.[TEACHER_COOKIE_NAME];
  if (!secret || typeof token !== "string") {
    return false;
  }

  const [payload, providedSignature, extra] = token.split(".");
  if (!payload || !providedSignature || extra !== undefined) {
    return false;
  }

  const expected = Buffer.from(sign(payload, secret), "base64url");
  const provided = Buffer.from(providedSignature, "base64url");
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
    return false;
  }

  try {
    const claims: unknown = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    );
    return (
      typeof claims === "object" &&
      claims !== null &&
      "expiresAt" in claims &&
      typeof claims.expiresAt === "number" &&
      claims.expiresAt > Date.now()
    );
  } catch {
    return false;
  }
}

export function requireTeacher(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!isTeacherAuthenticated(req)) {
    res.status(401).json({ error: "Authentification professeur requise." });
    return;
  }
  next();
}

export function teacherCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/api",
    maxAge: TEACHER_SESSION_TTL_MS,
  };
}
