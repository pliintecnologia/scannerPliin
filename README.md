# Scanner Pliin

Projeto web em Next.js para auditoria de acessibilidade WCAG 2.2.

## O que entrega
- Upload de HTML e análise por URL
- Score geral 0-100
- Notas WCAG A, AA e AAA
- Diagnóstico por perfil de usuário
- Lista de problemas, impacto e correção sugerida
- Exportação em JSON, CSV, HTML e PDF
- Renderização com JavaScript via Playwright
- Crawl multi-página na mesma origem
- Integração opcional com axe-core, pa11y e Lighthouse
- Histórico temporário da sessão no navegador

## Rodar
```bash
npm install
npm run dev
```

## Deploy na Vercel
```bash
npm install -g vercel
vercel
```
Ou use o script:
```bash
npm run deploy
```

## Playwright na Vercel
- Em producao o projeto usa `playwright-core` com `@sparticuz/chromium`, compativel com funcoes serverless da Vercel.
- O `vercel.json` define `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` para evitar download desnecessario do browser no build.
- Localmente o projeto continua usando `playwright`, entao `npm install` baixa o Chromium para desenvolvimento.
- Depois de atualizar as dependencias, rode `npm install` antes do proximo deploy.

## Escopo atual
- Sem login
- Sem banco de dados
- Processamento temporario
- PDF gerado pelo backend
- Proteção básica contra URLs privadas e uploads grandes
