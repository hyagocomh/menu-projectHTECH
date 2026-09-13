"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function AdminLogin({ configured }: { configured: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Não foi possível entrar.");
      router.replace("/admin");
      router.refresh();
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Não foi possível entrar.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="admin-login-page">
      <section className="login-card">
        <Image src="/img/logo-maknas.png" width={130} height={130} priority alt="Makna's Burguer" />
        <span className="admin-eyebrow">Área restrita</span>
        <h1>Painel de pedidos</h1>
        <p>Entre para acompanhar o preparo e atualizar cada pedido.</p>
        {!configured && (
          <div className="admin-config-warning">
            <i className="fas fa-tools" />
            <span>Configure <b>AUTH_SECRET</b>, <b>ADMIN_EMAIL</b> e <b>ADMIN_PASSWORD_HASH</b> na Vercel.</span>
          </div>
        )}
        <form onSubmit={submit}>
          <label className="field">E-mail
            <input className="form-control" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label className="field">Senha
            <input className="form-control" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          {error && <p className="login-error"><i className="fas fa-exclamation-circle" /> {error}</p>}
          <button className="btn btn-yellow" type="submit" disabled={loading || !configured}>{loading ? "Entrando..." : "Entrar no painel"}</button>
        </form>
        <Link className="back-store" href="/"><i className="fas fa-arrow-left" /> Voltar para a loja</Link>
      </section>
    </main>
  );
}
