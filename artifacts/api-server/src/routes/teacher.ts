import { createHash, timingSafeEqual } from "node:crypto";
import { Router, type IRouter } from "express";
import {
  GetTeacherSessionResponse,
  TeacherLoginBody,
  TeacherLoginResponse,
  TeacherLogoutResponse,
} from "@workspace/api-zod";
import {
  createTeacherToken,
  isTeacherAuthenticated,
  TEACHER_COOKIE_NAME,
  teacherCookieOptions,
} from "../lib/teacherAuth";

const router: IRouter = Router();
const attemptsByIp = new Map<string, { count: number; resetAt: number }>();
const ATTEMPT_LIMIT = 8;
const ATTEMPT_WINDOW_MS = 10 * 60 * 1000;

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const current = attemptsByIp.get(ip);
  if (!current || current.resetAt <= now) {
    attemptsByIp.set(ip, { count: 0, resetAt: now + ATTEMPT_WINDOW_MS });
    return false;
  }
  return current.count >= ATTEMPT_LIMIT;
}

function recordFailedAttempt(ip: string): void {
  const now = Date.now();
  const current = attemptsByIp.get(ip);
  if (!current || current.resetAt <= now) {
    attemptsByIp.set(ip, { count: 1, resetAt: now + ATTEMPT_WINDOW_MS });
    return;
  }
  current.count += 1;
}

function passwordsMatch(provided: string, expected: string): boolean {
  const providedHash = createHash("sha256").update(provided).digest();
  const expectedHash = createHash("sha256").update(expected).digest();
  return timingSafeEqual(providedHash, expectedHash);
}

router.post("/teacher/login", (req, res): void => {
  const parsed = TeacherLoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Saisissez le mot de passe professeur." });
    return;
  }

  const teacherPassword = process.env.TEACHER_PASSWORD;
  if (!teacherPassword) {
    req.log.error("TEACHER_PASSWORD is not configured");
    res.status(503).json({ error: "Connexion professeur indisponible." });
    return;
  }

  const ip = req.ip || req.socket.remoteAddress || "unknown";
  if (rateLimited(ip)) {
    res.status(429).json({
      error: "Trop de tentatives. Réessayez dans quelques minutes.",
    });
    return;
  }

  if (!passwordsMatch(parsed.data.password, teacherPassword)) {
    recordFailedAttempt(ip);
    res.status(401).json({ error: "Mot de passe incorrect." });
    return;
  }

  attemptsByIp.delete(ip);
  try {
    res.cookie(TEACHER_COOKIE_NAME, createTeacherToken(), teacherCookieOptions());
    res.json(TeacherLoginResponse.parse({ authenticated: true }));
  } catch (error) {
    req.log.error({ err: error }, "Unable to start teacher session");
    res.status(503).json({ error: "Connexion professeur indisponible." });
  }
});

router.get("/teacher/session", (req, res): void => {
  res.json(
    GetTeacherSessionResponse.parse({
      authenticated: isTeacherAuthenticated(req),
    }),
  );
});

router.post("/teacher/logout", (_req, res): void => {
  res.clearCookie(TEACHER_COOKIE_NAME, teacherCookieOptions());
  res.json(TeacherLogoutResponse.parse({ authenticated: false }));
});

export default router;
