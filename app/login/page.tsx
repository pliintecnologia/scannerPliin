import { redirect } from "next/navigation";
import { getCurrentUser } from "../../lib/auth";
import { AuthForm } from "../auth-form";
import { BrandLogo } from "../brand-logo";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/consultas");
  return <main className="authShell">
    <section className="authIntro"><BrandLogo href="/login" /><p className="eyebrow">Análise simples. Resultados confiáveis.</p><h1>Acessibilidade que vira ação.</h1><p>Analise seus sites, acompanhe resultados e mantenha o histórico da sua empresa em um só lugar.</p></section>
    <section className="authCard"><span className="authCardEyebrow">Área segura</span><h2>Bem-vindo de volta</h2><p>Acesse sua área de consultas e continue suas análises.</p><AuthForm mode="login" /><p className="authSwitch">Ainda não possui conta? <a href="/registro">Cadastre-se</a></p></section>
  </main>;
}
