# SPRINT 0 — FUNDAÇÃO E PERFIL DO USUÁRIO

**Duração estimada:** 3–5 dias
**Prioridade:** 🔴 CRÍTICO — Fazer primeiro
**Dependências:** Nenhuma
**Responsável sugerido:** @dev + @data-engineer

---

## O que é este sprint?

Corrigir os blockers ativos que impedem uso real da plataforma (email não chega, login trava após cadastro) e construir o perfil completo do usuário com todos os campos necessários para operação real: CPF, telefone, país, idioma, fuso horário e avatar.

Sem este sprint, nenhum usuário consegue completar o cadastro e fazer login corretamente.

---

## Contexto atual

| Item | Status |
|------|--------|
| Auth signup/login | Funciona, mas email de confirmação não chega |
| Tabela `profiles` | Tem: name, phone, role. Falta: CPF, country, language, timezone, avatar |
| Página de perfil | Não existe |
| SMTP configurado | Não (Supabase usa serviço padrão com limite de 3 emails/hora) |
| Lint/Typecheck | Falhando no pacote reports e admin |

---

## Etapas de execução

### S0.1 — Configurar SMTP no Supabase
- Acessar Supabase Dashboard → Project Settings → Auth → SMTP Settings
- Configurar Resend (recomendado) ou SendGrid
- Variáveis: SMTP Host, Port, User, Password, Sender email
- Testar envio de email de confirmação
- **Verificar:** email de confirmação chega na caixa de entrada

### S0.2 — Migration: estender tabela `profiles`
- Adicionar colunas: `cpf`, `country`, `language`, `timezone`, `avatar_url`
- Criar trigger de `updated_at`
- Atualizar RLS para permitir SELECT e UPDATE apenas do próprio registro
- Criar índice em `org_id` se não existir

### S0.3 — API Route `/api/profile`
- `GET /api/profile` → retorna dados do usuário autenticado
- `PATCH /api/profile` → atualiza campos do perfil (Zod validation)
- Garantir que usuário só edita o próprio perfil

### S0.4 — UI: página `/settings/profile`
- Server Component wrapper + Client Component
- Formulário: nome completo, CPF (máscara), email (read-only), telefone, país, idioma, fuso horário, avatar
- Loading state, feedback de sucesso/erro
- Salvar via `supabase.from('profiles').update()`

### S0.5 — Header: link para perfil
- Clicar no nome do usuário no Header abre dropdown
- Link "Meu perfil" direciona para `/settings/profile`
- Exibir avatar ou iniciais do nome

### S0.6 — Fix lint/typecheck
- Resolver `no-explicit-any` no pacote reports
- Corrigir erros de tipo nas rotas admin
- Garantir `npm run lint` e `npm run typecheck` passam

---

## Critérios de aceite

- [ ] Usuário consegue criar conta e receber email de confirmação
- [ ] Usuário consegue fazer login após confirmar email
- [ ] Página `/settings/profile` existe e salva todos os campos
- [ ] Header mostra nome/avatar do usuário logado
- [ ] `npm run lint` passa sem erros
- [ ] `npm run typecheck` passa sem erros

---

## Arquivos que serão criados/modificados

| Arquivo | Ação |
|---------|------|
| `apps/dashboard/src/app/(dashboard)/settings/profile/page.tsx` | CRIAR |
| `apps/dashboard/src/app/(dashboard)/settings/profile/ProfileSettingsClient.tsx` | CRIAR |
| `apps/dashboard/src/app/api/profile/route.ts` | CRIAR |
| `apps/dashboard/src/components/layout/Header.tsx` | MODIFICAR |
| Migration SQL nova | CRIAR |

---

## Dependências técnicas

- Supabase Dashboard (SMTP config — manual pelo usuário)
- `@supabase/ssr` (já instalado)
- `zod` (já instalado)
- `framer-motion` (já instalado)
- `lucide-react` (já instalado)

---

---

# PROMPTS

---

## PROMPT ESQUELETO — Contexto geral para qualquer IA

```
Você está trabalhando em um SaaS de gestão de tráfego pago chamado Start Metric.

STACK:
- Frontend: Next.js 16, React 19, TypeScript, Tailwind CSS v4
- Auth/DB: Supabase (PostgreSQL com RLS)
- Estado: Zustand (client), TanStack Query (server)
- Animações: Framer Motion
- Ícones: Lucide React
- Validação: Zod

TEMA VISUAL:
- Background: bg-slate-950
- Cards/painéis: bg-slate-900/50 com border border-slate-800 rounded-2xl
- Accent: cyan-400
- Texto principal: text-white / text-slate-200
- Texto secundário: text-slate-400 / text-slate-500
- Labels: text-xs font-semibold text-slate-400 uppercase tracking-widest
- Inputs: px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/30
- Botão primário: bg-cyan-400 text-slate-950 font-bold rounded-xl
- Glassmorphism: bg-slate-900/50 backdrop-blur-sm border border-slate-800

AUTENTICAÇÃO:
- Supabase Auth (email/password)
- Sessão via cookies (@supabase/ssr)
- Client-side: createClient() de @/lib/supabase/client
- Server-side: createClient() de @/lib/supabase/server

BANCO DE DADOS — tabela profiles:
- id UUID (= auth.uid())
- org_id UUID FK organizations
- name TEXT
- phone TEXT
- role TEXT (owner | manager | analyst)
- created_at, updated_at TIMESTAMPTZ

TAREFA DESTE SPRINT:
Estender o perfil do usuário com: cpf, country, language, timezone, avatar_url.
Criar página de perfil em /settings/profile.
Configurar SMTP no Supabase para envio de emails de confirmação.

PADRÕES DO PROJETO:
- Sempre "use client" em componentes client
- Server Components fazem fetch inicial, passam via props
- API Routes em /app/api/**/route.ts
- Resposta padrão: { data, error }
- Nunca expor service role key no client
- Idioma: português brasileiro em todos os textos visíveis
```

---

## PROMPT FRONTEND — ProfileSettingsClient

```
Você é um engenheiro frontend sênior especialista em React e Next.js.

Crie o componente `ProfileSettingsClient.tsx` para a página de perfil do usuário em um SaaS de gestão de tráfego pago.

LOCALIZAÇÃO: apps/dashboard/src/app/(dashboard)/settings/profile/ProfileSettingsClient.tsx

REQUISITOS DO COMPONENTE:
- Diretiva "use client" no topo
- Buscar dados atuais do perfil via GET /api/profile no useEffect
- Formulário com os campos abaixo
- Salvar via PATCH /api/profile
- Loading state no botão (Loader2 animado)
- Toast de sucesso (bg-emerald-500/10 text-emerald-400) e erro (bg-red-500/10 text-red-400)

CAMPOS DO FORMULÁRIO:
1. Avatar: círculo com foto ou iniciais do nome. Botão de upload (aceita jpg/png/webp, max 2MB). Upload para Supabase Storage bucket "avatars".
2. Nome completo: input texto, required
3. E-mail: input texto, read-only (vem do Supabase auth, não editável aqui)
4. CPF: input com máscara 000.000.000-00, validar formato
5. Telefone: input tel, placeholder "(11) 99999-9999"
6. País: select com opções principais (Brasil, Portugal, Angola, Moçambique, EUA, outros)
7. Idioma: select [{ value: "pt-BR", label: "Português (Brasil)" }, { value: "en-US", label: "English (US)" }, { value: "es", label: "Español" }]
8. Fuso Horário: select com timezones brasileiros principais + UTC:
   ["America/Sao_Paulo", "America/Manaus", "America/Belem", "America/Fortaleza", "America/Recife", "America/Noronha", "America/Rio_Branco", "America/Boa_Vista", "UTC"]
9. Notas internas: textarea opcional

VALIDAÇÃO (Zod):
- nome: min 2 chars
- cpf: regex /^\d{3}\.\d{3}\.\d{3}-\d{2}$/
- telefone: opcional, se preenchido min 10 chars
- language: enum dos valores válidos
- timezone: enum dos valores válidos

DESIGN:
- Layout: max-w-2xl mx-auto, espaçamento generoso
- Seções separadas por cards (Avatar | Dados Pessoais | Localização)
- Cada card: bg-slate-900/50 border border-slate-800 rounded-2xl p-6
- Título da seção: text-sm font-semibold text-slate-300 mb-4
- Labels: text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5
- Inputs: w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 text-sm focus:outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/30 transition-all duration-200
- Input read-only: adicionar opacity-50 cursor-not-allowed
- Botão Salvar: w-full mt-6 py-3.5 rounded-xl bg-cyan-400 text-slate-950 font-bold text-sm
- Framer Motion: entrada com initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}

TYPESCRIPT:
- Interface ProfileFormData com todos os campos
- Sem `any`
- Import do supabase client: import { createClient } from "@/lib/supabase/client"

IDIOMA: todos os textos visíveis em português brasileiro.
```

---

## PROMPT BACKEND — Migration + API Route

```
Você é um engenheiro backend sênior especialista em PostgreSQL, Supabase e Next.js.

Implemente o backend para o módulo de perfil de usuário.

PARTE 1 — MIGRATION SQL

Crie uma migration SQL para o Supabase PostgreSQL:

-- Adicionar colunas em profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cpf TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'BR',
  ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'pt-BR',
  ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/Sao_Paulo',
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Constraint única no CPF (quando preenchido)
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_cpf
  ON public.profiles(cpf)
  WHERE cpf IS NOT NULL;

-- Trigger para updated_at (criar função se não existir)
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger em profiles (se não existir)
DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- RLS: usuário só vê/edita o próprio perfil
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Índice em org_id
CREATE INDEX IF NOT EXISTS idx_profiles_org_id ON public.profiles(org_id);


PARTE 2 — API ROUTE

Crie o arquivo: apps/dashboard/src/app/api/profile/route.ts

Requisitos:
- GET /api/profile
  - Buscar perfil do usuário autenticado (auth.uid())
  - JOIN com auth.users para pegar o email
  - Retornar: { data: { id, name, email, phone, cpf, country, language, timezone, avatar_url, role, org_id } }

- PATCH /api/profile
  - Body (Zod schema): { name?, phone?, cpf?, country?, language?, timezone?, avatar_url? }
  - Validar CPF se fornecido: regex /^\d{3}\.\d{3}\.\d{3}-\d{2}$/
  - Atualizar apenas campos fornecidos (partial update)
  - Garantir que usuário só edita o próprio registro (where id = auth.uid())
  - Retornar: { data: perfil_atualizado }

PADRÕES:
- Usar createClient() de @/lib/supabase/server
- Resposta de erro: { error: "mensagem", status: 400|401|500 }
- Resposta de sucesso: { data: ... }
- Tratar: usuário não autenticado (401), dados inválidos (400), erro DB (500)
- TypeScript strict, sem `any`
- Não expor service role key
```
