import "server-only";

import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

export const ADMIN_COOKIE = "maknas-admin-session";
const TOKEN_ISSUER = "maknas-burguer";
const TOKEN_AUDIENCE = "maknas-admin";

function authSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) return null;
  return new TextEncoder().encode(secret);
}

export function isAdminConfigured() {
  return Boolean(
    authSecret() && process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD_HASH,
  );
}

export async function createAdminToken() {
  const secret = authSecret();
  if (!secret) throw new Error("AUTH_SECRET não configurado");

  return new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(TOKEN_ISSUER)
    .setAudience(TOKEN_AUDIENCE)
    .setSubject("admin")
    .setJti(crypto.randomUUID())
    .setIssuedAt()
    .setExpirationTime("4h")
    .sign(secret);
}

export async function verifyAdminToken(token?: string) {
  const secret = authSecret();
  if (!secret || !token) return false;

  try {
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ["HS256"],
      issuer: TOKEN_ISSUER,
      audience: TOKEN_AUDIENCE,
    });
    return payload.role === "admin" && payload.sub === "admin";
  } catch {
    return false;
  }
}

export async function isAdminAuthenticated() {
  const cookieStore = await cookies();
  return verifyAdminToken(cookieStore.get(ADMIN_COOKIE)?.value);
}
