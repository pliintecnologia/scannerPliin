import Link from "next/link";
import { ArrowRight, BarChart3, Check, FileDown, Gauge, History, Layers3, Menu, SearchCheck, ShieldCheck } from "lucide-react";
import { BrandLogo } from "./brand-logo";

const capabilities = [
  { icon: SearchCheck, title: "Auditoria técnica", text: "Analise uma URL ou um arquivo HTML com verificações baseadas na WCAG 2.2." },
  { icon: Layers3, title: "Mais de uma página", text: "Configure a profundidade de navegação e analise até 10 páginas da mesma origem." },
  { icon: Gauge, title: "Três mecanismos", text: "Combine axe-core, Pa11y e Lighthouse conforme a necessidade de cada diagnóstico." },
  { icon: BarChart3, title: "Resultados claros", text: "Veja pontuação, severidade, critérios afetados, impacto e sugestões de correção." },
  { icon: History, title: "Histórico da conta", text: "Consulte auditorias anteriores em um ambiente autenticado e separado por organização." },
  { icon: FileDown, title: "Relatórios exportáveis", text: "Exporte os resultados em PDF, HTML, CSV ou JSON para compartilhar e trabalhar." }
];

const navigation = [
  { href: "#recursos", label: "Recursos" },
  { href: "#como-funciona", label: "Como funciona" },
  { href: "#plano", label: "Plano" }
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
          <span className="landingKicker">Auditoria de acessibilidade para a web</span>
          <h1 id="hero-title">Encontre barreiras. Entenda o impacto. Corrija com direção.</h1>
          <p>O Scanner Pliin transforma verificações automáticas de acessibilidade em um diagnóstico organizado, com critérios WCAG 2.2, prioridades e sugestões práticas.</p>
          <div className="landingCtas"><Link className="landingButton" href="/registro">Criar minha conta <ArrowRight aria-hidden="true" size={18} /></Link><a className="landingSecondary" href="#recursos">Conhecer os recursos</a></div>
          <p className="landingDisclaimer">Análises automáticas apoiam o trabalho técnico, mas não substituem avaliação humana especializada.</p>
        </div>
        <div className="landingPreview" aria-hidden="true">
          <div className="previewTop"><span>Visão geral da análise</span><span className="previewStatus">Concluída</span></div>
          <div className="previewScore"><strong>WCAG 2.2</strong><span>Diagnóstico por critérios e severidade</span></div>
          <div className="previewMetrics"><div><b>Crítica</b><i className="metricCritical" /></div><div><b>Alta</b><i className="metricHigh" /></div><div><b>Média</b><i className="metricMedium" /></div><div><b>Baixa</b><i className="metricLow" /></div></div>
          <div className="previewIssue"><span>Critério WCAG</span><strong>Impacto e recomendação de correção</strong><em>Detalhes técnicos</em></div><div className="previewIssue"><span>Perfil afetado</span><strong>Priorização visual dos problemas</strong><em>Severidade</em></div>
        </div>
      </section>

      <aside className="landingTrust" aria-label="Tecnologias de verificação disponíveis"><span>Verificações disponíveis</span><strong>axe-core</strong><strong>Pa11y</strong><strong>Lighthouse</strong><strong>WCAG 2.2</strong></aside>

      <section className="landingSection" id="recursos" aria-labelledby="recursos-title">
        <div className="landingSectionHead"><span className="landingKicker">Do diagnóstico à ação</span><h2 id="recursos-title">Informação técnica em uma leitura mais direta.</h2><p>O produto reúne execução, organização dos achados e exportação em um único fluxo.</p></div>
        <div className="capabilityGrid">{capabilities.map(({ icon: Icon, title, text }) => <article key={title}><span><Icon aria-hidden="true" size={22} /></span><h3>{title}</h3><p>{text}</p></article>)}</div>
      </section>

      <section className="landingSteps" id="como-funciona" aria-labelledby="passos-title">
        <div><span className="landingKicker">Como funciona</span><h2 id="passos-title">Uma rotina simples para investigar acessibilidade.</h2></div>
        <ol><li><b aria-hidden="true">01</b><div><h3>Informe o conteúdo</h3><p>Use a URL pública do site ou envie o HTML que deseja avaliar.</p></div></li><li><b aria-hidden="true">02</b><div><h3>Configure a análise</h3><p>Escolha profundidade, quantidade de páginas e verificadores complementares.</p></div></li><li><b aria-hidden="true">03</b><div><h3>Trabalhe os achados</h3><p>Consulte critérios, impacto, correções sugeridas e exporte o relatório.</p></div></li></ol>
      </section>

      <section className="landingSecurity" aria-labelledby="seguranca-title"><div className="securityIcon"><ShieldCheck aria-hidden="true" size={30} /></div><div><span className="landingKicker">Conta e histórico protegidos</span><h2 id="seguranca-title">Separação por organização desde o banco de dados.</h2><p>O Scanner Pliin usa sessões revogáveis, isolamento por tenant e Row-Level Security no PostgreSQL. CPF e CNPJ de cadastro são armazenados como HMAC e últimos quatro dígitos, não em texto puro.</p></div></section>

      <section className="landingPricing" id="plano" aria-labelledby="plano-title">
        <div className="landingSectionHead"><span className="landingKicker">Plano único</span><h2 id="plano-title">Todos os recursos, uma escolha simples.</h2></div>
        <article className="priceCard"><div><span>Premium</span><h3><span className="srOnly">Preço: </span>R$ 50 <small>/mês</small></h3><p>Uma assinatura recorrente para toda a organização.</p></div><ul><li><Check aria-hidden="true" size={18} /> Auditorias e histórico da organização</li><li><Check aria-hidden="true" size={18} /> axe-core, Pa11y e Lighthouse</li><li><Check aria-hidden="true" size={18} /> Análise de até 10 páginas</li><li><Check aria-hidden="true" size={18} /> Exportação em PDF, HTML, CSV e JSON</li><li><Check aria-hidden="true" size={18} /> Pagamento por cartão, PIX ou boleto</li></ul><Link className="landingButton" href="/registro">Criar conta <ArrowRight aria-hidden="true" size={18} /></Link></article>
      </section>

      <section className="landingFinal" aria-labelledby="final-title"><div><span className="landingKicker">Comece pelo que precisa de atenção</span><h2 id="final-title">Transforme sinais automáticos em um plano de correção.</h2></div><Link className="landingButton light" href="/registro">Começar agora <ArrowRight aria-hidden="true" size={18} /></Link></section>
      <footer className="landingFooter"><BrandLogo href="/" compact /><p>Scanner Pliin — análise de acessibilidade baseada em heurísticas da WCAG 2.2.</p><Link href="/app/login">Acessar o aplicativo</Link></footer>
    </main>
  );
}
