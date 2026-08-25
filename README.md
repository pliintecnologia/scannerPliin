# Scanner Pliin

Aplicação comercial multiusuário para auditorias de acessibilidade WCAG, com autenticação, histórico de consultas, PostgreSQL e execução isolada em Docker.

## Funcionalidades

- Cadastro com nome, cidade, empresa, e-mail, CPF e CNPJ opcional.
- Login com sessões revogáveis armazenadas no PostgreSQL.
- Senhas derivadas com `scrypt`; tokens de sessão armazenados apenas como SHA-256.
- CPF/CNPJ armazenados como HMAC e últimos quatro dígitos, nunca em texto puro.
- Histórico das últimas 100 auditorias por usuário, incluindo falhas.
- Isolamento organizacional por tenant com memberships e PostgreSQL Row-Level Security (`FORCE RLS`).
- Aplicação conectada com role limitada; a credencial administrativa existe apenas no migrator efêmero.
- Scanner existente com axe, Pa11y e Lighthouse.
- Bloqueio de destinos internos, portas não web e credenciais em URLs.
- Rate limit persistente para cadastro e login.
- Containers sem privilégios adicionais, health checks e banco em rede privada.

## Subir com Docker

1. Crie o arquivo de ambiente:

   ```bash
   cp .env.example .env
   ```

2. Troque `POSTGRES_PASSWORD`, `APP_DATABASE_PASSWORD` e `AUTH_SECRET` por valores aleatórios fortes. Não reutilize senhas. Para gerar segredos:

   ```bash
   openssl rand -base64 48
   ```

3. Construa e inicie:

   ```bash
   docker compose up -d --build
   ```

4. Acesse `http://localhost:3001`. O schema é aplicado automaticamente antes do servidor iniciar.

Para acompanhar a inicialização:

```bash
docker compose logs -f app
```

## Desenvolvimento local

Exige Node.js, Yarn, PostgreSQL e Chromium do Playwright.

```bash
yarn install
yarn playwright install chromium
cp .env.example .env.local
yarn db:migrate
yarn dev
```

Em `.env.local`, use uma `DATABASE_URL` completa, por exemplo:

```env
DATABASE_URL=postgresql://scanner:senha@localhost:5432/scanner_pliin
AUTH_SECRET=uma-chave-aleatoria-com-no-minimo-32-caracteres
```

## Produção pública

- Coloque um proxy reverso (Caddy, Traefik, Nginx ou load balancer) com HTTPS na frente da porta 3001.
- Os cookies são `Secure` em produção; publique sempre por HTTPS.
- Não exponha a porta 5432; o Compose publica somente a aplicação.
- Mantenha separadas as credenciais administrativa e `scanner_app`; nunca forneça `POSTGRES_PASSWORD` ao container da aplicação.
- Use um gerenciador de segredos em vez de versionar `.env`.
- Faça backups regulares do volume `postgres_data` e teste restaurações.
- Configure observabilidade, política de retenção e termos/LGPD antes de receber dados reais.
- Use criptografia de disco/volume e backups criptografados. HMAC de CPF/CNPJ protege os documentos, mas nome, cidade e e-mail continuam sendo dados pessoais no banco.
- Para múltiplas réplicas, use PostgreSQL gerenciado e limite a concorrência de Chromium por instância.

## Validação

```bash
yarn audit:types
yarn security:check
yarn build
docker compose config
```

## Modelo de segurança multi-tenant

- Cada conta criada gera um `tenant` e um vínculo `membership` com papel `owner`.
- A sessão associa usuário e tenant por chave estrangeira composta.
- Cada auditoria exige a mesma combinação válida de `tenant_id + user_id`.
- Toda consulta de auditoria abre uma transação e define `app.current_tenant` localmente.
- A política RLS do PostgreSQL bloqueia leitura e escrita de qualquer outro tenant, mesmo se um filtro for esquecido no código.
- SQL usa parâmetros posicionais; `yarn security:check` falha se detectar interpolação ou concatenação em chamadas SQL.
- HTML bruto, código corrigido e query strings de URLs não são persistidos no histórico.

RLS é defesa em profundidade, não substitui HTTPS, patches, backups criptografados, rotação de segredos, auditoria de acesso e testes de intrusão periódicos.

## CI/CD com GitHub Actions e VPS

O workflow `.github/workflows/ci-deploy.yml` valida tipos e SQL, gera o build,
publica uma imagem no GitHub Container Registry (GHCR) e faz deploy por SSH na
VPS quando houver push na branch `main`. Pull requests executam apenas as
validações e o build.

Crie um Environment chamado `production` em **Settings > Environments**.
Cadastre em **Environment variables**:

- `VPS_HOST`: hostname ou IP da VPS;
- `VPS_USER`: usuário SSH com acesso ao Docker;
- `VPS_PORT`: porta SSH, normalmente `22` (opcional);
- `VPS_DEPLOY_PATH`: diretório absoluto, por exemplo `/opt/scanner-pliin`;
- `VPS_KNOWN_HOSTS`: linha da chave pública do host, obtida de uma fonte
  confiável (por exemplo, no console da VPS com `ssh-keyscan -H seu-host`). Salve
  a saída completa, no formato `host tipo-da-chave chave`, e não somente o
  fingerprint exibido por `ssh-keygen -l`.

Cadastre separadamente em **Environment secrets**:

- `VPS_PASSWORD`: senha SSH do usuário de deploy. Nunca salve essa senha em
  Environment variables, arquivos versionados ou logs;
- `ASAAS_ENVIRONMENT`: use obrigatoriamente `production` neste Environment;
- `ASAAS_API_KEY`: chave de produção nova do Asaas, no formato original. O
  workflow faz o escape necessário para o Docker Compose;
- `ASAAS_WEBHOOK_TOKEN`: token exclusivo com pelo menos 32 caracteres.

Antes do primeiro deploy, instale Docker Engine com o plugin Compose na VPS,
habilite autenticação SSH por senha para o usuário de deploy e crie
`VPS_DEPLOY_PATH/.env` com os valores de `.env.example`. Esse `.env` permanece
somente na VPS e não é enviado nem sobrescrito pelo workflow. O usuário SSH
precisa executar `docker` sem um segundo prompt de senha.

Se o pacote GHCR for privado, mantenha a permissão `packages: write` do
workflow; o token efêmero do próprio job autentica a VPS a cada deploy.

## Pagamentos Asaas

O plano Premium custa R$ 50,00 por mês e libera todo o tenant. Configure primeiro
o sandbox com `ASAAS_ENVIRONMENT=sandbox`, `ASAAS_API_KEY`,
`ASAAS_WEBHOOK_TOKEN` (32 ou mais caracteres) e, opcionalmente,
`BILLING_COMPANY_NAME`. `ASAAS_BASE_URL` serve apenas como sobrescrita controlada.
Em arquivos `.env` lidos pelo Docker Compose, duplique cada `$` existente na chave
Asaas (`$` vira `$$`) para impedir interpolação e corrupção da credencial.
Ao executar o Next.js diretamente com `npm run dev`, use `\$` no lugar de cada
`$`. Não reutilize o mesmo formato de escape entre os dois modos de execução.

No painel Asaas, cadastre manualmente o webhook público
`https://seu-dominio/api/webhooks/asaas` e selecione `PAYMENT_CONFIRMED`,
`PAYMENT_RECEIVED`, `PAYMENT_OVERDUE`, `PAYMENT_REFUNDED`,
`SUBSCRIPTION_UPDATED`, `SUBSCRIPTION_INACTIVATED` e `SUBSCRIPTION_DELETED`.
Use o mesmo token de `ASAAS_WEBHOOK_TOKEN`.

Em **Integrações > Chaves de API** no Asaas de produção, autorize o IP público
fixo de saída da VPS. O IP do container (`172.x.x.x`) é interno e não deve ser
cadastrado. Um retorno `403` com código `not_allowed_ip` confirma que a chave foi
aceita, mas o IP público que chegou ao Asaas ainda não está autorizado.

Cupons são cadastrados somente pelo usuário administrativo do PostgreSQL:

```sql
INSERT INTO benefit_coupons (code, name, starts_at, ends_at)
VALUES ('CORTESIA2026', 'Cortesia de homologação', NOW(), NOW() + INTERVAL '30 days');
```

Normalize códigos em maiúsculas. Valide cartão, PIX, boleto e reentrega de webhook
no sandbox antes de usar `ASAAS_ENVIRONMENT=production`. Nunca reutilize a API key
como token do webhook nem coloque credenciais reais em arquivos versionados.
