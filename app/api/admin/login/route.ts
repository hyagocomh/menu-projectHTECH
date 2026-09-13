import bcrypt from "bcryptjs";
import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { ADMIN_COOKIE, createAdminToken, isAdminConfigured } from "@/lib/auth";
import { clearLoginAttempts, consumeLoginAttempt } from "@/lib/login-rate-limit";

function normalizeUsername(value: string) {
  return value.normalize("NFKC").trim().toLocaleLowerCase("pt-BR");
}

function safeEqual(left: string, right: string) {
  const leftDigest = createHash("sha256").update(left).digest();
  const rightDigest = createHash("sha256").update(right).digest();
  return timingSafeEqual(leftDigest, rightDigest);
}

function noStore(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 4_096) {
    return noStore(NextResponse.json({ error: "Requisição inválida." }, { status: 413 }));
  }

  if (!isAdminConfigured()) {
    return noStore(NextResponse.json(
      { error: "Defina as variáveis de acesso do painel na Vercel." },
      { status: 503 },
    ));
  }

  const body = (await request.json().catch(() => null)) as {
    username?: string;
    password?: string;
  } | null;
  const username = normalizeUsername(body?.username?.slice(0, 100) ?? "");
  const password = body?.password?.slice(0, 100) ?? "";
  const expectedUsername = normalizeUsername(process.env.ADMIN_USERNAME ?? "");
  const passwordHash = process.env.ADMIN_PASSWORD_HASH ?? "";
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "unknown";
  const rateLimitKey = `${clientIp}:${username}`;
  const rateLimit = consumeLoginAttempt(rateLimitKey);

  if (!rateLimit.allowed) {
    const response = NextResponse.json(
      { error: "Muitas tentativas. Aguarde antes de tentar novamente." },
      { status: 429 },
    );
    response.headers.set("Retry-After", String(rateLimit.retryAfterSeconds));
    return noStore(response);
  }

  const usernameMatches = safeEqual(username, expectedUsername);
  const passwordMatches = password.length > 0 && await bcrypt.compare(password, passwordHash);

  if (!expectedUsername || !usernameMatches || !passwordMatches) {
    await new Promise((resolve) => setTimeout(resolve, randomInt(350, 651)));
    return noStore(NextResponse.json({ error: "Usuário ou senha incorretos." }, { status: 401 }));
  }

  clearLoginAttempts(rateLimitKey);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE, await createAdminToken(), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 4,
    path: "/",
  });
  return noStore(response);
}
