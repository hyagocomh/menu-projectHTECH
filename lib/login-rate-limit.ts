import "server-only";

import { createHash } from "node:crypto";

type LoginAttempt = {
  attempts: number;
  resetAt: number;
  blockedUntil: number;
};

const WINDOW_MS = 15 * 60 * 1000;
const BLOCK_MS = 30 * 60 * 1000;
const MAX_ATTEMPTS = 5;

const globalForLoginRateLimit = globalThis as unknown as {
  maknasLoginAttempts?: Map<string, LoginAttempt>;
};

const attempts = globalForLoginRateLimit.maknasLoginAttempts ?? new Map<string, LoginAttempt>();

if (process.env.NODE_ENV !== "production") {
  globalForLoginRateLimit.maknasLoginAttempts = attempts;
}

function privateKey(identifier: string) {
  return createHash("sha256").update(identifier).digest("hex");
}

function pruneExpired(now: number) {
  if (attempts.size < 1_000) return;
  for (const [key, attempt] of attempts) {
    if (attempt.resetAt <= now && attempt.blockedUntil <= now) attempts.delete(key);
  }
}

export function consumeLoginAttempt(identifier: string) {
  const now = Date.now();
  const key = privateKey(identifier);
  pruneExpired(now);

  const current = attempts.get(key);
  if (current?.blockedUntil && current.blockedUntil > now) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((current.blockedUntil - now) / 1000),
    };
  }

  const active = current && current.resetAt > now
    ? current
    : { attempts: 0, resetAt: now + WINDOW_MS, blockedUntil: 0 };

  active.attempts += 1;
  if (active.attempts > MAX_ATTEMPTS) {
    active.blockedUntil = now + BLOCK_MS;
    attempts.set(key, active);
    return { allowed: false, retryAfterSeconds: BLOCK_MS / 1000 };
  }

  attempts.set(key, active);
  return { allowed: true, retryAfterSeconds: 0 };
}

export function clearLoginAttempts(identifier: string) {
  attempts.delete(privateKey(identifier));
}
