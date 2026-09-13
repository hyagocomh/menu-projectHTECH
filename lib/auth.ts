import "server-only";

import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

export const ADMIN_COOKIE = "maknas-admin-session";

function authSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 24) return null;
  return new TextEncoder().encode(secret);
}

export function isAdminConfigured() {
  return Boolean(
    authSecret() && process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD_HASH,
  );
}

export async function createAdminToken() {
  const secret = authSecret();
  if (!secret) throw new Error("AUTH_SECRET não configurado");

  return new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(secret);
}

export async function verifyAdminToken(token?: string) {
  const secret = authSecret();
  if (!secret || !token) return false;

  try {
    const { payload } = await jwtVerify(token, secret);
    return payload.role === "admin";
  } catch {
    return false;
  }
}

export async function isAdminAuthenticated() {
  const cookieStore = await cookies();
  return verifyAdminToken(cookieStore.get(ADMIN_COOKIE)?.value);
}
