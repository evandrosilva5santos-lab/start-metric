# PRD - SaaS de Tracking, Gestão de Campanhas e Dashboard de Performance

## 1. Resumo Executivo

**Nome provisório:** Antigravity Ads Intelligence  
**Tipo:** SaaS B2B (web + mobile)  
**Missão:** Permitir que gestores de tráfego, e-commerces e agências identifiquem com precisão quais campanhas geram lucro real, não apenas métricas de plataforma.

### Resultado de negócio esperado
- Aumentar a previsibilidade de investimento em mídia paga.
- Reduzir decisões com base em dados incompletos de pixel.
- Entregar visão unificada de receita, custo e lucro por campanha.

### Problema principal
Ferramentas atuais fragmentam dados entre plataformas e-commerce/pagamento e mídia, gerando:
- atribuição inconsistente;
- baixa confiança nas métricas;
- dificuldade de análise multi-canal;
- ausência de lucro líquido por campanha.

---

## 2. Objetivos do Produto

### Objetivos primários
- Conectar contas de anúncios e fontes de venda em poucos minutos.
- Rastrear eventos e vendas com identificadores confiáveis.
- Atribuir vendas a campanhas por modelo configurável.
- Exibir performance e lucro real por cliente, canal e campanha.

### Objetivos secundários
- Alertar quedas de performance em tempo quase real.
- Sugerir otimizações via IA (fase posterior).
- Fornecer mobilidade para monitoramento rápido no app mobile.

### Não objetivos (MVP)
- Substituir plataformas de compra de mídia (Meta/Google/TikTok).
- Criar editor avançado de criativos.
- Automatizar compra de mídia via API em larga escala.

---

## 3. Personas e Jobs To Be Done

### Persona A: Gestor de Tráfego
**JTBD:** "Quero saber rapidamente quais campanhas estão gerando lucro para escalar o que funciona."  
**Dores:** discrepância de pixel, excesso de planilhas, demora na análise.

### Persona B: Dono de E-commerce
**JTBD:** "Quero entender custo por venda e lucro por campanha para proteger margem."  
**Dores:** foco excessivo em ROAS bruto, sem considerar custos reais.

### Persona C: Agência de Marketing
**JTBD:** "Quero gerenciar vários clientes com padronização e velocidade de diagnóstico."  
**Dores:** operação manual, baixa escalabilidade operacional, relatórios lentos.

---

## 4. Escopo Funcional (MVP + Expansão)

### 4.1 Integrações com Plataformas de Ads
### MVP
- Conexão OAuth/token com:
  - Meta Ads
  - Google Ads
  - TikTok Ads
- Sincronização de:
  - contas
  - campanhas
  - conjuntos de anúncios/ad groups
  - anúncios
  - métricas (impressões, cliques, custo, conversões reportadas)

### Critérios de aceite
- Usuário conecta ao menos 1 conta de mídia em < 10 min.
- Sistema sincroniza dados históricos configuráveis (ex.: últimos 30 dias).
- Atualização incremental programada (ex.: a cada 15 min para métricas críticas).

### 4.2 Sistema de Tracking
### MVP
- Captura de UTMs e click IDs em primeira navegação.
- Persistência de identificadores em cookie first-party + backend.
- Endpoint de eventos para registrar:
  - page_view
  - add_to_cart
  - checkout_start
  - purchase
- Parâmetros mínimos por evento:
  - `campaign_id`
  - `adset_id` / `ad_group_id`
  - `ad_id`
  - `utm_source`
  - `utm_campaign`
  - `utm_content`
  - `gclid`, `fbclid`, `ttclid` (quando disponível)

### Critérios de aceite
- Evento `purchase` chega com deduplicação (`event_id`) e timestamp UTC.
- Taxa de perda de evento dentro do SLO definido.
- Logs auditáveis por cliente para depuração de tracking.

### 4.3 Sistema de Atribuição
### MVP
- Modelos configuráveis por cliente:
  - last click
  - first click
  - linear
- Janela de atribuição configurável (ex.: 1, 7, 28 dias).
- Reprocessamento histórico quando modelo mudar.

### Critérios de aceite
- Toda venda atribuída gera trilha com regra aplicada.
- Mudança de modelo não perde histórico bruto; apenas recalcula camada analítica.

### 4.4 Dashboard Inteligente
### MVP
- Visão geral por cliente e período:
  - investimento
  - faturamento atribuído
  - lucro bruto e líquido
  - ROAS
  - CPA
  - taxa de conversão
- Gráficos:
  - vendas por campanha
  - custo por dia
  - conversões por canal
- Filtros por:
  - cliente
  - conta
  - canal
  - campanha
  - período

### Critérios de aceite
- Latência de carregamento do dashboard dentro do SLO.
- Fórmulas consistentes entre cards, tabelas e exportações.

### 4.5 Gestão Multi-Cliente
### MVP
- Estrutura hierárquica:
  - Organização (agência/e-commerce)
  - Cliente
  - Conta Ads
  - Campanhas
- Controle de acesso por papel:
  - owner
  - manager
  - analyst
  - viewer

### Critérios de aceite
- Isolamento lógico de dados por cliente (multi-tenant seguro).
- Permissões impedem visualização indevida entre clientes.

### 4.6 Integrações de Vendas
### MVP
- Conectores para:
  - Shopify
  - WooCommerce
  - Stripe
  - Hotmart (fase pós-MVP se necessário)
- Ingestão de pedidos, valor, descontos, frete, status e reembolsos.

### Critérios de aceite
- Pedido sincronizado com status e valor líquido.
- Reembolso impacta métricas de lucro automaticamente.

### 4.7 Mobile App
### MVP Mobile (lean)
- Autenticação.
- Dashboard resumido com principais KPIs.
- Alertas de anomalia (queda de ROAS, aumento de CPA, gasto sem venda).

---

## 5. Requisitos Não Funcionais (NFR)

### Performance
- API p95 < 500ms para consultas agregadas comuns.
- Dashboard inicial p95 < 2.5s em dataset padrão.

### Disponibilidade
- SLA inicial: 99.5% (MVP), meta futura 99.9%.

### Escalabilidade
- Arquitetura preparada para crescimento de tenants e volume de eventos.
- Jobs assíncronos para ingestão e processamento de alto volume.

### Segurança
- Criptografia em trânsito (TLS) e em repouso.
- Segredos em cofre (AWS Secrets Manager ou equivalente).
- RBAC obrigatório em todas rotas sensíveis.
- Auditoria de ações críticas.

### Privacidade e Compliance
- LGPD: base legal, consentimento e retenção de dados configurável.
- Exportação e exclusão de dados por solicitação do cliente.

### Observabilidade
- Logs estruturados.
- Métricas de ingestão, processamento e qualidade de dados.
- Alertas operacionais para falhas de sincronização.

---

## 6. Arquitetura Técnica (Proposta)

### Frontend
- Web: Next.js + React + TypeScript.
- Mobile: React Native (ou Flutter em avaliação).

### Backend
- API e domínio: NestJS (modular monolith).
- Processamento assíncrono: filas com Redis + workers.

### Dados
- PostgreSQL (OLTP, dados transacionais e analíticos agregados).
- Redis (cache, filas, locks distribuídos).

### Infra
- AWS com Docker:
  - API/Workers em ECS ou Kubernetes (conforme estágio).
  - Banco gerenciado (RDS PostgreSQL).
  - Armazenamento de logs/eventos em S3.

### Princípios arquiteturais
- Começar com modular monolith para reduzir complexidade operacional.
- Separar claramente:
  - camada de ingestão
  - camada de atribuição
  - camada analítica
- Evoluir para serviços separados apenas com gatilhos de escala reais.

---

## 7. Modelo de Dados (Alto Nível)

### Entidades principais
- `organizations`
- `users`
- `organization_users`
- `clients`
- `ad_accounts`
- `campaigns`
- `ad_groups`
- `ads`
- `tracking_sessions`
- `events`
- `orders`
- `order_items`
- `attributions`
- `daily_metrics`

### Relacionamentos-chave
- Uma organização possui múltiplos clientes.
- Um cliente possui múltiplas contas de ads e fontes de venda.
- Um pedido pode ter múltiplos eventos associados.
- Uma venda pode gerar múltiplos créditos de atribuição (ex.: linear).

### Índices críticos
- `events(client_id, occurred_at)`
- `events(event_type, occurred_at)`
- `orders(client_id, created_at)`
- `attributions(order_id, model, window_days)`
- `daily_metrics(client_id, date, channel, campaign_id)`

---

## 8. Regras de Métricas e Fórmulas

- `ROAS = revenue_attributed / ad_spend`
- `CPA = ad_spend / attributed_conversions`
- `Lucro Bruto = revenue_attributed - ad_spend`
- `Lucro Líquido = revenue_attributed - ad_spend - fees - refunds - taxes(optional)`
- `ROI = lucro_liquido / ad_spend`

### Padronizações
- Todas as métricas devem considerar timezone configurável por cliente.
- Cálculo oficial centralizado no backend para evitar divergência no frontend.

---

## 9. Fluxos Críticos

### 9.1 Fluxo de Tracking e Atribuição
1. Usuário clica em anúncio com parâmetros (UTM/click ID).  
2. Frontend captura e persiste identificadores da sessão.  
3. Eventos de navegação/compra são enviados para API de tracking.  
4. Venda entra via integração e-commerce/pagamento.  
5. Motor de atribuição aplica modelo ativo do cliente.  
6. Dashboard consolida métricas e lucro.

### 9.2 Fluxo de Sincronização Ads
1. Usuário conecta conta via OAuth/token.  
2. Sistema executa backfill inicial.  
3. Jobs recorrentes atualizam métricas e entidades.  
4. Erros de API geram retry + alerta operacional.

---

## 10. KPIs do Produto

### KPIs de negócio
- MRR
- churn de clientes
- NPS

### KPIs de uso
- usuários ativos (DAU/WAU/MAU)
- clientes com ao menos 1 integração ativa
- tempo médio até primeiro insight útil

### KPIs de qualidade de dados
- taxa de vendas atribuídas
- taxa de perda de eventos
- latência de atualização das métricas
- taxa de divergência entre fonte e dashboard

---

## 11. Roadmap

### Fase 1 - Fundação (4-6 semanas)
- Autenticação, organização, usuários e RBAC.
- Cadastro de clientes e estrutura multi-tenant.
- Integração inicial com Meta Ads.
- Base do pipeline de ingestão.

### Fase 2 - Tracking e Vendas (4-6 semanas)
- SDK/script de tracking com UTMs e click IDs.
- Endpoint de eventos + deduplicação.
- Integrações Shopify, WooCommerce e Stripe.
- Modelo de atribuição last click.

### Fase 3 - Dashboard e Inteligência (4-6 semanas)
- Dashboard principal com filtros e gráficos.
- Modelos first click e linear.
- Alertas automáticos de performance.
- Exportação de relatórios.

### Fase 4 - Escala e Diferenciais (6-10 semanas)
- Multi-cliente avançado para agências.
- Integrações adicionais (TikTok completo, Hotmart).
- IA para previsão de ROAS e sugestões.
- App mobile com push notifications.

---

## 12. Diferenciais Competitivos

- Visão de lucro real por campanha, não apenas faturamento/ROAS bruto.
- Atribuição configurável com rastreabilidade de regra aplicada.
- Alertas proativos com foco em perda de eficiência.
- Camada de IA para recomendação de alocação de orçamento (fase avançada).

---

## 13. Riscos e Mitigações

- **Mudanças de API de plataformas de ads**  
  Mitigação: camadas de integração isoladas + monitoramento de versões.

- **Restrições de privacidade/cookies**  
  Mitigação: abordagem server-side + first-party tracking + consent mode.

- **Divergência entre fontes e relatórios**  
  Mitigação: reconciliador diário, trilhas de auditoria e transparência de fórmula.

- **Complexidade prematura de arquitetura**  
  Mitigação: modular monolith no início e extração progressiva por gatilhos objetivos.

---

## 14. Critérios de Pronto (Definition of Done do Produto)

- Usuário conecta conta ads e fonte de venda sem suporte técnico.
- Sistema atribui vendas por ao menos um modelo com auditoria de decisão.
- Dashboard exibe lucro por campanha com consistência validada.
- Alertas essenciais funcionando no web e mobile (ou web push no MVP).
- Segurança mínima e requisitos LGPD implementados para operação comercial.

---

## 15. ADRs Iniciais (Resumo)

### ADR-001: Arquitetura modular monolith com NestJS
- **Decisão:** iniciar com monolito modular.
- **Motivo:** menor complexidade operacional no MVP, manutenção mais rápida.
- **Revisitar quando:** equipe > 10 devs ou domínios exigirem escalabilidade independente.

### ADR-002: PostgreSQL como banco primário
- **Decisão:** PostgreSQL para dados transacionais e agregados principais.
- **Motivo:** consistência ACID, queries analíticas com bom custo-benefício.

### ADR-003: Motor de atribuição desacoplado
- **Decisão:** separar cálculo de atribuição da camada de ingestão.
- **Motivo:** permitir reprocessamento histórico sem reingestão de eventos.

### ADR-004: Tracking híbrido (client + server)
- **Decisão:** combinar captura client-side com envio server-side.
- **Motivo:** reduzir perda de dados e dependência de browser/pixel.

### ADR-005: Multi-tenant lógico com RBAC
- **Decisão:** isolamento por `organization_id`/`client_id` em todas entidades.
- **Motivo:** suportar agências com segurança e governança.

---

## 16. Backlog Inicial (Epics)

- Epic 1: Onboarding e autenticação.
- Epic 2: Conectores de Ads (Meta, Google, TikTok).
- Epic 3: Tracking e gestão de eventos.
- Epic 4: Conectores de venda e reconciliação de pedidos.
- Epic 5: Motor de atribuição e reprocessamento.
- Epic 6: Dashboard de performance e lucro.
- Epic 7: Alertas e notificações.
- Epic 8: Administração multi-cliente e permissões.
- Epic 9: Mobile companion app.
