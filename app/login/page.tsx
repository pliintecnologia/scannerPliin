import { redirect } from "next/navigation";
import { getCurrentUser } from "../../lib/auth";
import { AuthForm } from "../auth-form";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/consultas");
  return <main className="authShell">
    <section className="authIntro"><p className="eyebrow">Scanner Pliin</p><h1>Acessibilidade que vira ação.</h1><p>Analise seus sites, acompanhe resultados e mantenha o histórico da sua empresa em um só lugar.</p></section>
    <section className="authCard"><h2>Entrar</h2><p>Acesse sua área de consultas.</p><AuthForm mode="login" /><p className="authSwitch">Ainda não possui conta? <a href="/registro">Cadastre-se</a></p></section>
  </main>;
}
