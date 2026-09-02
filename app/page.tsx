import Link from "next/link";
import { ArrowDownToLine, ArrowRight, BarChart3, Check, FileText, Gauge, Menu, Play, ShieldCheck, Zap } from "lucide-react";
import { BrandLogo } from "./brand-logo";

// This page references build-scoped /_next assets. Rendering it dynamically
// prevents a reverse proxy from retaining prerendered HTML after a deployment
// has replaced those hashed CSS and JavaScript files.
export const dynamic = "force-dynamic";

const capabilities = [
  { icon: Zap, title: "Análise automatizada", text: "Escaneamento completo do seu site com tecnologia avançada e precisa." },
  { icon: BarChart3, title: "Relatórios inteligentes", text: "Relatórios claros e acionáveis com priorização por impacto." },
  { icon: ShieldCheck, title: "Conformidade WCAG 2.2", text: "Cobertura completa dos critérios do padrão internacional." },
  { icon: ArrowDownToLine, title: "Exportação fácil", text: "Exporte relatórios em PDF, HTML, CSV ou JSON e compartilhe com sua equipe." }
];

const navigation = [
  { href: "#recursos", label: "Recursos" },
  { href: "#como-funciona", label: "Como funciona" },
  { href: "#plano", label: "Planos" },
  { href: "#conteudo", label: "Blog" },
  { href: "#contato", label: "Contato" }
];

export default function LandingPage() {
  return (
    <main className="landingPage">
      <a className="skipLink" href="#inicio">Pular para o conteúdo</a>
      <header className="landingHeader">
        <BrandLogo href="/" compact />
        <nav aria-label="Navegação principal">{navigation.map((item) => <a key={item.href} href={item.href}>{item.label}</a>)}</nav>
        <div className="landingHeaderActions"><Link className="landingTextLink" href="/app/login">Entrar</Link><Link className="landingButton small" href="/registro">Começar agora</Link></div>
        <details className="landingMobileMenu"><summary aria-label="Abrir menu"><Menu aria-hidden="true" size={22} /><span>Menu</span></summary><nav aria-label="Navegação móvel">{navigation.map((item) => <a key={item.href} href={item.href}>{item.label}</a>)}<Link href="/app/login">Entrar</Link></nav></details>
      </header>

      <section className="landingHero" id="inicio" aria-labelledby="hero-title">
        <div className="landingHeroCopy">
          <span className="landingHeroBadge">Auditoria de acessibilidade para a web</span>
          <h1 id="hero-title">Acessibilidade <em>sem barreiras.</em> Resultados que transformam.</h1>
          <p>Automatize verificações, priorize o que importa e alcance conformidade com WCAG 2.2 de forma simples, rápida e precisa.</p>
          <div className="landingCtas"><Link className="landingButton" href="/registro">Começar agora <ArrowRight aria-hidden="true" size={18} /></Link><a className="landingSecondary" href="#como-funciona"><span><Play aria-hidden="true" size={14} /></span> Ver como funciona</a></div>
          <ul className="landingHeroBenefits" aria-label="Benefícios"><li><Zap aria-hidden="true" size={17} /> 100% automatizado</li><li><FileText aria-hidden="true" size={17} /> Relatórios detalhados</li><li><ShieldCheck aria-hidden="true" size={17} /> Conformidade WCAG 2.2</li></ul>
        </div>
        <div className="landingPreview" aria-hidden="true">
          <div className="previewTop"><span>Visão geral da análise</span><span className="previewStatus">Concluída</span></div>
          <div className="previewScore"><strong>WCAG 2.2</strong><span>Diagnóstico por critérios e severidades</span></div>
          <div className="previewMetrics"><div><b>Crítica</b><i className="metricCritical" /></div><div><b>Alta</b><i className="metricHigh" /></div><div><b>Média</b><i className="metricMedium" /></div><div><b>Baixa</b><i className="metricLow" /></div></div>
          <div className="previewIssue"><span>Critério 1.4.3&nbsp;&nbsp; Contraste (Mínimo)</span><strong>12 problemas encontrados</strong><em>Ver detalhes</em></div><div className="previewIssue"><span>Critério 2.4.7&nbsp;&nbsp; Foco visível</span><strong>8 problemas encontrados</strong><em>Ver detalhes</em></div><div className="previewIssue"><span>Critério 3.1.1&nbsp;&nbsp; Idioma da página</span><strong>3 problemas encontrados</strong><em>Ver detalhes</em></div>
          <div className="previewAll">Ver todos os critérios analisados <ArrowRight size={14} /></div>
        </div>
      </section>

      <section className="landingSection" id="recursos" aria-labelledby="recursos-title">
        <div className="landingSectionHead"><span className="landingKicker">Recursos</span><h2 id="recursos-title">Tudo que você precisa para uma auditoria completa</h2></div>
        <div className="capabilityGrid">{capabilities.map(({ icon: Icon, title, text }) => <article key={title}><div className="capabilityTop"><span><Icon aria-hidden="true" size={23} /></span></div><h3>{title}</h3><p>{text}</p></article>)}</div>
      </section>

      <section className="landingSteps" id="como-funciona" aria-labelledby="passos-title">
        <div><span className="landingKicker">Como funciona</span><h2 id="passos-title">Uma rotina simples para investigar acessibilidade.</h2></div>
        <ol><li><b aria-hidden="true">01</b><div><h3>Informe o conteúdo</h3><p>Use a URL pública do site ou envie o HTML que deseja avaliar.</p></div></li><li><b aria-hidden="true">02</b><div><h3>Configure a análise</h3><p>Escolha profundidade, quantidade de páginas e verificadores complementares.</p></div></li><li><b aria-hidden="true">03</b><div><h3>Trabalhe os achados</h3><p>Consulte critérios, impacto, correções sugeridas e exporte o relatório.</p></div></li></ol>
      </section>

      <section className="landingSecurity" id="conteudo" aria-labelledby="seguranca-title"><div className="securityIcon"><ShieldCheck aria-hidden="true" size={30} /></div><div><span className="landingKicker">Conteúdo e segurança</span><h2 id="seguranca-title">Separação por organização desde o banco de dados.</h2><p>O Scanner Pliin usa sessões revogáveis, isolamento por tenant e Row-Level Security no PostgreSQL. CPF e CNPJ de cadastro são armazenados como HMAC e últimos quatro dígitos, não em texto puro.</p></div></section>

      <section className="landingPricing" id="plano" aria-labelledby="plano-title">
        <div className="landingSectionHead"><span className="landingKicker">Plano único</span><h2 id="plano-title">Todos os recursos, uma escolha simples.</h2></div>
        <article className="priceCard"><div><span>Premium</span><h3><span className="srOnly">Preço: </span>R$ 50 <small>/mês</small></h3><p>Uma assinatura recorrente para toda a organização.</p></div><ul><li><Check aria-hidden="true" size={18} /> Auditorias e histórico da organização</li><li><Check aria-hidden="true" size={18} /> axe-core, Pa11y e Lighthouse</li><li><Check aria-hidden="true" size={18} /> Análise de até 10 páginas</li><li><Check aria-hidden="true" size={18} /> Exportação em PDF, HTML, CSV e JSON</li><li><Check aria-hidden="true" size={18} /> Pagamento por cartão, PIX ou boleto</li></ul><Link className="landingButton" href="/registro">Criar conta <ArrowRight aria-hidden="true" size={18} /></Link></article>
      </section>

      <section className="landingFinal" aria-labelledby="final-title"><div><span className="landingKicker">Comece pelo que precisa de atenção</span><h2 id="final-title">Transforme sinais automáticos em um plano de correção.</h2></div><Link className="landingButton light" href="/registro">Começar agora <ArrowRight aria-hidden="true" size={18} /></Link></section>
      <footer className="landingFooter" id="contato"><BrandLogo href="/" compact /><p>Scanner Pliin — análise de acessibilidade baseada em heurísticas da WCAG 2.2.</p><Link href="/app/login">Acessar o aplicativo</Link></footer>
    </main>
  );
}
