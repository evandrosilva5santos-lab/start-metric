# 🤖 MISSÃO CRÍTICA PARA CLAUDE CODE: SETUP DO BACKEND (NESTJS + PRISMA)

Você é um **Engenheiro Backend Sênior** que trabalha sob a supervisão do Arquiteto Antigravity. 
Sua regra número um é **Estabilidade Mínima**: não quebre o que está funcionando. Se não tiver certeza, pergunte ao usuário.

## 🎯 Objetivo da Missão
Inicializar o ORM Prisma no `apps/api` (NestJS), conectar ao Supabase do projeto, introspectar o banco de dados existente e configurar o construtor `PrismaService`.

## 📍 Contexto
- **Monorepo**: Usamos TurboRepo. O frontend fica em `apps/dashboard` (Next.js) e nossa API backend fica em `apps/api` (NestJS).
- **Banco de Dados**: PostgreSQL do Supabase. As chaves de acesso estão no arquivo `PLAN.md` e em `apps/dashboard/.env`.

---

## 🛠️ Passos de Execução Exatos

### Passo 1: Inicialização do Prisma ⭕ PENDENTE
1. Defina o diretório de trabalho obrigatoriamente para `apps/api`.
2. Rode `npx prisma init`. Isso criará a pasta `prisma/` e um arquivo `.env` dentro de `apps/api`.

### Passo 2: Configuração da URL de Banco de Dados ⭕ PENDENTE
1. No arquivo `.env` recém criado em `apps/api/`, configure o `DATABASE_URL` usando a URL do Supabase do projeto.
2. Atenção: Peça ao usuário a string de conexão exata do Supabase (`posgresql://postgres.XXXX:PASSWORD@aws-0-XXXX.pooler.supabase.com:6543/postgres`). Não invente senhas. Você precisa da versão "Transaction pooler" que o Supabase fornece.

### Passo 3: Engenharia Reversa (Introspection) ⭕ PENDENTE
1. Com a `DATABASE_URL` válida configurada no `.env` da API, execute `npx prisma db pull`.
2. Isso vai ler todas as tabelas criadas nas migrations (`campaigns`, `ad_accounts`, `daily_metrics`) e gerar o `schema.prisma`.
3. Em seguida, rode `npx prisma generate` para gerar os tipos do cliente (Prisma Client).

### Passo 4: O PrismaService do NestJS ⭕ PENDENTE
Crie o arquivo `apps/api/src/prisma.service.ts` com o código exato abaixo para habilitar o uso do DB em todo o backend:

```typescript
import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
  }
}
```

Registre o `PrismaService` como um Provider global (exporte-o no `app.module.ts`).

---

## ✅ Critérios de Sucesso (Fim da Missão)
Antes de finalizar e avisar o usuário que acabou, certifique-se de que:
1. `npx prisma generate` rodou sem erros dentro de `apps/api`.
2. O arquivo `schema.prisma` tem os models (`AdAccount`, `Campaign`, etc.).
3. O `npm run build` passa com sucesso em `apps/api`.

Ao terminar, diga ao usuário: *"O Motor de Banco de Dados do NestJS está online e o esquema foi sincronizado do Supabase. O Arquiteto Antigravity pode prosseguir com a inteligência do Tracking."*
