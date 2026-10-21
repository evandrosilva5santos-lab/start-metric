# DECISIONS.md — Registro de Decisões de Arquitetura (ADRs)

| ID | Data | Categoria | Contexto | Decisão | Rationale | Status |
|---|---|---|---|---|---|---|
| **ADR-001** | 07/03/2026 | Arquitetura | Estrutura do projeto para suporte a tráfego e background workers | Adotar Monorepo com Turborepo (Next.js Dashboard + NestJS API + Pacotes compartilhados) | Permite compartilhar tipagens e regras de negócio de métricas sem duplicação de código | `ACTIVE` |
| **ADR-002** | 07/03/2026 | Banco de Dados | Escolha da engine de persistência e segurança multi-tenant | PostgreSQL no Supabase com Row Level Security (RLS) por `organization_id` | Garante isolamento absoluto de dados entre clientes e agências a nível de engine | `ACTIVE` |
| **ADR-003** | 10/03/2026 | Atribuição | Desacoplamento da ingestão de anúncios e registro de conversões | Motor de atribuição assíncrono Last-Click cruzando UTMs e Meta CAPI | Evita que falhas na API de mídia interrompam o registro de vendas reais | `ACTIVE` |
| **ADR-004** | 15/03/2026 | Autenticação | Acesso rápido para gestores com segurança | Híbrido: Supabase Auth (JWT) + Master Gate via cookie criptografado `PAINEL_SENHA` | Permite login instantâneo com senha única do painel sem fricção de confirmação de e-mail no setup inicial | `ACTIVE` |
| **ADR-005** | 20/03/2026 | Meta Graph API | Versão da Graph API para suporte a CAPI e Insights | Graph API v21+ com Test Event Code e deduplicação por `event_id` | Conformidade com as políticas de privacidade da Meta e máxima taxa de correspondência de eventos | `ACTIVE` |
| **ADR-006** | 25/03/2026 | Segurança | Armazenamento de Access Tokens de longa duração da Meta | Criptografia simétrica AES-256 via extensão `pgcrypto` no PostgreSQL | Proteção contra vazamento de tokens em caso de dumps acidentais do banco | `ACTIVE` |
| **ADR-007** | 17/10/2026 | Design System | Documentação e código divergiam entre Dark Obsidian/Emerald, Start Control azul e Metrifiquei | Adotar Metrifiquei Teal como contrato visual canônico, com Inter, JetBrains Mono, temas claro/escuro e componentes shadcn/Radix adaptados | Unifica a identidade sem substituir rotas, sessão, tenant, APIs, stores ou componentes de domínio; migração por compatibilidade reduz regressões | `ACTIVE` |
| **ADR-008** | 17/10/2026 | Autorização de Contas | A descoberta Meta estava sendo usada como lista operacional e podia misturar contas não atendidas | Separar inventário descoberto de autorização pela Carteira; somente conta vinculada, ativa e com cliente ativo da mesma organização entra na operação | Impede vazamento entre clientes, relatórios incorretos e seleção de contas apenas disponíveis no Business Manager | `ACTIVE` |

## ADR-008 — Regra operacional

- Integrações descobrem e atualizam inventário com `client_id = null` por padrão.
- A Carteira é a única fonte de autorização e de reatribuição.
- Servidor valida elegibilidade em todas as fronteiras; filtro de frontend é apenas UX.
- Arquivar cliente preserva vínculo/histórico e retira a conta da operação.
- “Todas as contas” é um conjunto restrito ao cliente selecionado.

## ADR-007 — Notas de transição

- `docs/DESIGN.md` é a fonte normativa.
- `design/DIRECAO_START_CONTROL.md` e o antigo conteúdo Dark Obsidian/Emerald são históricos.
- O shell funcional do START METRIC será preservado; exemplos de dados e rotas do Metrifiquei não serão copiados.
- Aliases visuais antigos permanecem temporariamente mapeados para os novos tokens até que todos os consumidores sejam migrados.
- Componentes só podem ser removidos depois de um mapa de consumidores comprovar zero usos.
