import { redirect } from "next/navigation";
import { getCurrentUser } from "../../lib/auth";
import { AuthForm } from "../auth-form";
import { BrandLogo } from "../brand-logo";

export default async function RegisterPage() {
  if (await getCurrentUser()) redirect("/consultas");
  return <main className="authShell registerShell">
    <section className="authIntro"><BrandLogo href="/registro" /><p className="eyebrow">Análise simples. Resultados confiáveis.</p><h1>Comece sua jornada acessível.</h1><p>Crie sua conta para registrar auditorias e acompanhar a evolução dos seus sites.</p></section>
    <section className="authCard"><h2>Criar conta</h2><p>Seus documentos são protegidos e não são armazenados em texto puro.</p><AuthForm mode="register" /><p className="authSwitch">Já possui conta? <a href="/login">Entrar</a></p></section>
  </main>;
}
