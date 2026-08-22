"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Building2, Eye, EyeOff, IdCard, LockKeyhole, Mail, MapPin, UserRound } from "lucide-react";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

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
        <label><span className="authLabel"><UserRound size={16}/> Nome completo</span><input name="name" autoComplete="name" required minLength={2} maxLength={120} placeholder="Como podemos chamar você?" /></label>
        <div className="authGrid">
          <label><span className="authLabel"><MapPin size={16}/> Cidade</span><input name="city" autoComplete="address-level2" required maxLength={120} /></label>
          <label><span className="authLabel"><Building2 size={16}/> Empresa</span><input name="company" autoComplete="organization" maxLength={160} /></label>
        </div>
        <div className="authGrid">
          <label><span className="authLabel"><IdCard size={16}/> CPF</span><input name="cpf" inputMode="numeric" autoComplete="off" required placeholder="Somente números" /></label>
          <label><span className="authLabel"><IdCard size={16}/> CNPJ (opcional)</span><input name="cnpj" inputMode="numeric" autoComplete="off" placeholder="Somente números" /></label>
        </div>
      </> : null}
      <label><span className="authLabel"><Mail size={16}/> E-mail</span><input name="email" type="email" autoComplete="email" required maxLength={254} placeholder="voce@empresa.com.br" /></label>
      <label><span className="authLabel"><LockKeyhole size={16}/> Senha</span><span className="passwordField"><input name="password" type={showPassword ? "text" : "password"} autoComplete={register ? "new-password" : "current-password"} required minLength={register ? 6 : undefined} maxLength={128} placeholder="Digite sua senha" /><button type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}>{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button></span></label>
      {register ? <small>A senha deve ter pelo menos 6 caracteres, incluindo letras e números.</small> : null}
      {error ? <p className="alert" role="alert">{error}</p> : null}
      <button type="submit" disabled={loading}>{loading ? "Aguarde..." : register ? "Criar conta" : "Entrar"}</button>
    </form>
  );
}
