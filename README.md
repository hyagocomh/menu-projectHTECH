# Makna's Burguer

Cardápio e checkout da Makna's em Next.js, com carrinho, endereço no Geoapify, frete calculado pela rota real, pedidos persistidos em PostgreSQL e painel administrativo.

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

O painel lista os 100 pedidos mais recentes, atualiza automaticamente e permite mudar o status entre recebido, preparo, pronto, entrega, concluído e cancelado. A seção **Ponto do estabelecimento** permite buscar o endereço, mover o marcador e salvar a origem usada no cálculo das entregas.

### Acesso ao painel

Gere o segredo da sessão:

```bash
openssl rand -base64 32
```

Use o resultado em `AUTH_SECRET`. Depois gere o hash da senha:

```bash
npm run admin:hash -- "uma-senha-forte"
```

Cadastre o resultado em `ADMIN_PASSWORD_HASH` e o usuário desejado em `ADMIN_USERNAME`. Nunca cadastre a senha em texto puro. A sessão expira após quatro horas e o login bloqueia tentativas repetidas.

### Geoapify e cálculo de entrega

Crie um projeto no [Geoapify MyProjects](https://myprojects.geoapify.com/) e use duas chaves com restrições diferentes:

- `NEXT_PUBLIC_GEOAPIFY_MAP_KEY`: usada apenas pelos **Map Tiles** no navegador. Restrinja por origem e HTTP referrer aos domínios da loja.
- `GEOAPIFY_API_KEY`: segredo usado no servidor por **Address Autocomplete**, **Geocoding** e **Routing API**. Nunca use o prefixo `NEXT_PUBLIC_` nela.

O checkout usa Leaflet, mapa `dark-matter-brown`, sugestões limitadas ao Brasil, preenchimento automático ao escolher um endereço e geocodificação reversa ao clicar, arrastar o marcador ou usar a localização do aparelho. O CEP não faz parte do formulário.

O ponto inicial cadastrado é **Rua São Jorge, 20 — Barro Duro, Maceió-AL**. As variáveis `STORE_LATITUDE` e `STORE_LONGITUDE` funcionam como reserva enquanto o banco não está disponível; depois da migração, o endereço pode ser ajustado diretamente em `/admin`. A taxa é calculada assim:

```text
taxa base + (quilômetros além da franquia × preço por quilômetro)
```

Os valores são controlados por `DELIVERY_BASE_FEE`, `DELIVERY_INCLUDED_KM`, `DELIVERY_PRICE_PER_KM` e `DELIVERY_MAX_KM`.
O modo padrão é `scooter`; altere `DELIVERY_ROUTING_MODE` para `drive` ou `motorcycle` se necessário.

Depois de alterar variáveis na Vercel, faça um novo deploy. O push para `main` dispara o deploy automático quando o repositório está conectado ao projeto.

## Verificações

```bash
npm run lint
npm run typecheck
npm run build
```
