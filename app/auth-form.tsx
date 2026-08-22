"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error || "Não foi possível continuar.");
      router.push("/consultas");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha inesperada.");
    } finally {
      setLoading(false);
    }
  }

  const register = mode === "register";
  return (
    <form className="authForm" onSubmit={submit}>
      {register ? <>
        <label>Nome completo<input name="name" autoComplete="name" required minLength={2} maxLength={120} /></label>
        <div className="authGrid">
          <label>Cidade<input name="city" autoComplete="address-level2" required maxLength={120} /></label>
          <label>Empresa<input name="company" autoComplete="organization" maxLength={160} /></label>
        </div>
        <div className="authGrid">
          <label>CPF<input name="cpf" inputMode="numeric" autoComplete="off" required placeholder="Somente números" /></label>
          <label>CNPJ (opcional)<input name="cnpj" inputMode="numeric" autoComplete="off" placeholder="Somente números" /></label>
        </div>
      </> : null}
      <label>E-mail<input name="email" type="email" autoComplete="email" required maxLength={254} /></label>
      <label>Senha<input name="password" type="password" autoComplete={register ? "new-password" : "current-password"} required minLength={register ? 10 : undefined} maxLength={128} /></label>
      {register ? <small>A senha deve ter pelo menos 10 caracteres, incluindo letras e números.</small> : null}
      {error ? <p className="alert" role="alert">{error}</p> : null}
      <button type="submit" disabled={loading}>{loading ? "Aguarde..." : register ? "Criar conta" : "Entrar"}</button>
    </form>
  );
}
