# RULES.md — Regras Invioláveis do Start Metric

> **Definição:** Este documento reúne as diretrizes obrigatórias que nenhum agente ou desenvolvedor pode violar sob nenhuma circunstância.

---

## 1. Regras de Código & Tipagem
1. **TypeScript Strict:** Proibido o uso de `any` explícito ou casts inseguros `as unknown as X`. Toda interface deve ser tipada em `@start-metric/types` ou schemas locais validados com **Zod**.
2. **Sem Placeholders:** Nenhum componente, função ou API pode conter mocks decorativos disfarçados de implementação final. Se algo não estiver concluído, deve utilizar o padrão canônico `<ComingSoonBadge />` ou lançar erro explícito (`Fail Loudly`).
3. **Cálculos Matemáticos no Backend:** Fórmulas de ROAS, CPA, Lucro Bruto e Lucro Líquido NUNCA devem ser calculadas diretamente no frontend; devem vir pré-computadas da API ou das views/tabelas agregadoras para evitar discrepâncias.

---

## 2. Regras de Banco de Dados & Segurança
1. **Multi-Tenancy Obrigatório:** Nenhuma query pode ser feita sem o filtro explícito de `organization_id` ou sem passar pela camada de `RLS` do Supabase.
2. **Proteção de Secrets:** Jamais expor `META_APP_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` ou senhas de instâncias para o client-side (navegador).
3. **Criptografia de Tokens:** Tokens da Meta e chaves de API externas devem ser armazenados criptografados com `AES-256`.
4. **Descoberta não Autoriza:** Contas vindas de integrações permanecem fora da operação até vínculo explícito com cliente ativo da mesma organização.
5. **Validação Server-Side:** Dashboard, relatórios, alertas e agregadores devem revalidar `organization_id`, `client_id`, conta ativa e cliente não arquivado; nunca confiar em IDs do navegador.
6. **Todas as Contas é Local ao Cliente:** Agregação “Todas as contas” nunca atravessa o limite do cliente selecionado.

---

## 3. Regras de Design & UX
1. **Fidelidade ao Design System:** Toda cor, tipografia, raio e espaçamento deve usar os tokens do Design System Metrifiquei Teal definido em `docs/DESIGN.md`. Dark Obsidian/Emerald e Start Control azul são apenas referências históricas.
2. **Responsividade Estrita:** Toda tela deve ser validada em **Desktop (1440px)**, **Tablet (834px)** e **Mobile (390px)**, sem overflow do viewport ou perda de função.
3. **Feedback Visual:** Toda ação assíncrona (sync, salvar, deletar) deve exibir feedback de carregamento (`loading state`) e confirmação (`toast` de sucesso ou erro).
4. **Acessibilidade:** Toda interface deve atender WCAG 2.2 AA, incluindo contraste, foco visível, labels, teclado, redução de movimento e zoom.
5. **Ausência não é zero:** `null`, `undefined` e ausência aparecem como `—`. Zero só pode ser exibido quando recebido como valor real.
6. **Sem Dados Decorativos:** Componentes importados da referência Metrifiquei devem usar rotas, permissões, planos, usuários e dados reais do START METRIC.

---

## 4. Regras de Operação de Agentes (Claude Code / Antigravity)
1. **Executar Uma Nano Task por Vez:** É proibido executar múltiplas nano tasks simultaneamente sem validação intermediária.
2. **Respeitar Arquivos Permitidos e Proibidos:** Se uma tarefa tentar modificar um arquivo fora da lista `ALLOWED FILES`, a execução deve ser imediatamente interrompida.
3. **Validação Obrigatória:** Toda tarefa de código só é considerada `DONE` com typecheck, lint e testes aplicáveis sem falhas. Alterações visuais também exigem Chrome QA nos breakpoints 1440, 834 e 390, nos temas claro e escuro.
