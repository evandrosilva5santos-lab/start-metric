# Master Ledger - Antigravity Memory

## Registro de Alterações e Decisões

### 2026-03-14: Correção de Estabilidade do Dashboard

#### 🗺️ Resumo
Identificado e corrigido um loop infinito nas renderizações do Dashboard de Campanhas causado pela lógica de busca inicial.

#### 🛠️ Alterações Realizadas
- **`useCampaignStore.ts`**: Adicionado flag `hasInitialFetch` ao estado global para controle preciso do primeiro carregamento, independente se o resultado for vazio ou não.
- **`useCampaignData.ts`**: Atualizado para depender de `hasInitialFetch` e `isLoading` no `useEffect`, garantindo que a busca só ocorra uma vez na inicialização ou conforme requisitado manualmente.
- **`campaigns.ts`**: Adicionado dado de mock (Campanha de Teste) para validação visual do dashboard e evitar que o estado inicial seja sempre vazio durante a fase de desenvolvimento.

#### 🧭 Trajetória Atual
O dashboard agora deve estar estável e carregando os dados corretamente. O próximo foco pode ser a integração real com a API da Meta ou melhorias na UI das tabelas de campanhas.

### 2026-09-19: Governança de IA e Grafo de Arquitetura

#### 🗺️ Resumo
- Integrado `claude-fable-5.md` no workspace e na governança de regras obrigatórias (`AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `.agents/rules/`).
- Mapeado grafo de conhecimento completo do projeto via `graphify` (375 nós, 335 arestas, 182 comunidades).

#### 🛠️ Artefatos Gerados
- `graphify-out/graph.json`: Grafo estrutural de dependências e nós centrais.
- `graphify-out/GRAPH_REPORT.md`: Relatório de subsistemas e god nodes (`supabase/server.ts`, `prismaNamespace.ts`, `ui/index.ts`).
- `graphify-out/graph.html`: Visualizador interativo de arquitetura.

---
*Gerado por Antigravity*
