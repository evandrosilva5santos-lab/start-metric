# Task: Scaffold da Arquitetura (Next.js + NestJS)

## Objetivo
Inicializar o monorepo do SaaS, contemplando o frontend (Next.js App Router) e o backend (NestJS) com fundações para PostgreSQL e Redis, preparados para suportar os 3 módulos: Ads Analytics, Sales Tracking e Social Hunter.

## Fases de Implementação

- [ ] **1. Estrutura do Workspace**
  - Criar pasta `/apps` ou inicializar um monorepo (Turborepo ou similar, se aplicável, senão pastas separadas).
  - Configurar dependências globais.

- [ ] **2. Frontend (Next.js)**
  - `npx create-next-app@latest frontend --typescript --tailwind --eslint --app --use-npm --src-dir`
  - Instalar shadcn/ui e Lucide React para o Dashboard.
  - Criar a estrutura inicial da Sidebar com o link "Social Hunter" em destaque.

- [ ] **3. Backend (NestJS)**
  - `npx @nestjs/cli new backend --package-manager npm`
  - Instalar Prisma ORM (`npm i prisma --save-dev`, `npx prisma init`).
  - Instalar integrações Redis/BullMQ para os workers em background (sincronização da API Meta e Instagram).

- [ ] **4. Modelagem Inicial do Banco (Prisma)**
  - Schema simplificado para Usuários, Clientes, Contas de Ads e Instagram, Campanhas e Métricas.

## Status
Aguardando autorização para iniciar o processo de scaffold.
