# Makna's Burguer

Cardápio e checkout da Makna's em Next.js, com carrinho, endereço no Google Maps, frete calculado pela rota real, pedidos persistidos em PostgreSQL e painel administrativo.

## Rodando localmente

Requisitos: Node.js 20.19 ou superior e um banco PostgreSQL.

```bash
npm install
cp .env.example .env.local
npm run db:deploy
npm run dev
```

A loja abre em `http://localhost:3000` e o painel em `http://localhost:3000/admin`.

## Configuração na Vercel

Cadastre as variáveis de `.env.example` em **Project Settings > Environment Variables**.

### Banco de pedidos

1. Crie ou conecte um PostgreSQL no projeto da Vercel.
2. Copie a conexão para `DATABASE_URL`.
3. Execute `npm run db:deploy` com essa variável disponível para criar as tabelas.

O painel lista os 100 pedidos mais recentes, atualiza automaticamente e permite mudar o status entre recebido, preparo, pronto, entrega, concluído e cancelado.

### Acesso ao painel

Gere o segredo da sessão:

```bash
openssl rand -base64 32
```

Use o resultado em `AUTH_SECRET`. Depois gere o hash da senha:

```bash
npm run admin:hash -- "uma-senha-forte"
```

Cadastre o resultado em `ADMIN_PASSWORD_HASH` e o e-mail desejado em `ADMIN_EMAIL`. Nunca cadastre a senha em texto puro.

### Google Maps e cálculo de entrega

No Google Cloud, habilite o faturamento e as APIs **Maps JavaScript API**, **Places API (New)** e **Routes API**. Use duas chaves diferentes:

- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`: chave do navegador, restrita aos domínios da loja e às APIs Maps JavaScript/Places.
- `GOOGLE_MAPS_SERVER_API_KEY`: chave privada, restrita à Routes API; nunca use o prefixo `NEXT_PUBLIC_` nela.

Informe também `STORE_LATITUDE` e `STORE_LONGITUDE`, que são a origem das rotas. A taxa é calculada assim:

```text
taxa base + (quilômetros além da franquia × preço por quilômetro)
```

Os valores são controlados por `DELIVERY_BASE_FEE`, `DELIVERY_INCLUDED_KM`, `DELIVERY_PRICE_PER_KM` e `DELIVERY_MAX_KM`.

Depois de alterar variáveis na Vercel, faça um novo deploy. O push para `main` dispara o deploy automático quando o repositório está conectado ao projeto.

## Verificações

```bash
npm run lint
npm run typecheck
npm run build
```
