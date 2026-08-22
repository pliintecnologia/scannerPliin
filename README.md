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

4. Acesse `http://localhost:3000`. O schema é aplicado automaticamente antes do servidor iniciar.

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

- Coloque um proxy reverso (Caddy, Traefik, Nginx ou load balancer) com HTTPS na frente da porta 3000.
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

Crie um Environment chamado `production` em **Settings > Environments** e
adicione estes secrets nele (ou em **Settings > Secrets and variables > Actions**):

- `VPS_HOST`: hostname ou IP da VPS;
- `VPS_USER`: usuário SSH com acesso ao Docker;
- `VPS_PORT`: porta SSH, normalmente `22` (opcional);
- `VPS_DEPLOY_PATH`: diretório absoluto, por exemplo `/opt/scanner-pliin`;
- `VPS_SSH_KEY`: chave privada dedicada ao deploy;
- `VPS_KNOWN_HOSTS`: linha da chave pública do host, obtida de uma fonte
  confiável (por exemplo, no console da VPS com `ssh-keyscan -H seu-host`).

Antes do primeiro deploy, instale Docker Engine com o plugin Compose na VPS,
adicione a chave pública correspondente ao `authorized_keys` do usuário e crie
`VPS_DEPLOY_PATH/.env` com os valores de `.env.example`. Esse `.env` permanece
somente na VPS e não é enviado nem sobrescrito pelo workflow. O usuário SSH
precisa executar `docker` sem prompt de senha.

Se o pacote GHCR for privado, mantenha a permissão `packages: write` do
workflow; o token efêmero do próprio job autentica a VPS a cada deploy.
