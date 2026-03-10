# Product Requirements Document (PRD)

## Etapa 1 — Visão Inicial do Produto
- Plataforma SaaS para agências, gestores de tráfego e e-commerces analisarem marketing digital.
- Integração profunda com Meta Marketing API, Google Ads API e Instagram Graph API.
- Gestão ativa de anúncios, análise de redes sociais e geração de relatórios automáticos.
- Disparo automático de relatórios via WhatsApp para clientes ou grupos da equipe.

## Etapa 2 — Definição do Tipo de Produto
**Tipo:** Marketing Intelligence SaaS + Automação

**O produto combina:**
- Analytics de anúncios (Paid Media)
- Social analytics (Orgânico)
- Gestão de clientes (multi-tenant)
- Automação de relatórios e mensagens (WhatsApp)

**Módulos Principais (Os 5 Pilares):**
1. Ads Manager
2. Social Hunter
3. Analytics Dashboard
4. Relatórios Automáticos
5. Automação WhatsApp

## Etapa 3 — Estrutura Principal do Sistema (Hierarquia B2B)
**Módulo 1 — Gestão de clientes**
Permite criar clientes, gerenciar contas e vincular plataformas com isolamento de dados por inquilino (tenant).

**Estrutura de Relação:**
- Usuário (Agência / Gestor)
  - Cliente A (Loja XPTO)
    - Meta Ads (ID da Conta)
    - Google Ads (ID da Conta)
    - Instagram (Perfil Vinculado)
  - Cliente B...

## Etapa 4 — Integração com Plataformas (Fontes de Dados)
O sistema conectará com APIs externas como Single Source of Truth para o motor do SaaS.

- **Meta Ads (Meta Marketing API):**
  - Listar campanhas, conjuntos e anúncios.
  - Editar (pausar/ativar) e alterar orçamento.
  - Puxar métricas de performance.
- **Google Ads (Google Ads API):**
  - Listar campanhas.
  - Puxar custo, conversões e performance.
- **Instagram (Instagram Graph API):**
  - Puxar contagem de seguidores e crescimento.
  - Listar posts e rastrear engajamento.

## Etapa 5 — Estrutura do Dashboard (Master View)
Painel principal de visualização da saúde do negócio / cliente.

- **KPIs Principais (Hero Metrics):**
  - Investimento Total (Spend)
  - Vendas (Revenue / Conversões)
  - ROAS (Retorno sobre Investimento)
  - CPA (Custo por Aquisição)
- **Gráficos e Visualizações:**
  - Linha do tempo: Gasto por dia.
  - Barras/Pizza: Vendas por campanha.
  - Qualitativo: Crescimento do Instagram.
- **Filtros Globais:**
  - Select de Cliente (Alterna o contexto do dashboard).
  - Conta de anúncios.
  - Período (Datepicker range).
  - Filtro por Campanha específica.

## Etapa 6 — Social Hunter
O módulo de inteligência social, espionagem orgânica e benchmark.

- **Análise do Próprio Instagram (Vinculado):**
  - Evolução de Seguidores ao longo do tempo.
  - Identificação de Posts com maior engajamento.
- **Monitoramento de Concorrentes (Radar):**
  - O usuário cadastra `@arrobas` dos concorrentes.
  - O sistema varre e analisa crescimento, taxas de engajamento e frequência de postagens desses perfis em relação ao perfil do cliente.

## Etapa 7 — Arquitetura Técnica Completa do Sistema

A arquitetura geral do sistema é desenhada para um **SaaS B2B corporativo e escalável**, com divisões em 6 camadas principais.

### Camada 1 — Frontend (Client-Side)
Responsável pela interface do usuário e experiências interativas (SPA/SSR).
- **Tecnologias:** React.js, Next.js, Tailwind CSS, Chart.js / Apache ECharts (para gráficos complexos).
- **Módulos que atende:** Dashboard analytics, Gestão de clientes (Tenant admin), Gestão de campanhas de Ads, Relatórios, Social Hunter e Configuração de Automações.

### Camada 2 — API Gateway
Centraliza, orquestra e protege todas as requisições que chegam ao backend.
- **Responsabilidades:** Autenticação (OAuth/JWT), Autorização, Roteamento reverso para microservices, e Rate Limiting (prevenção de abuso).

### Camada 3 — Serviços de Aplicação (Microservices)
O coração da regra de negócio, isolado por domínio para garantir escala independente.
- **Ads Service:** Gerencia integração ativa e ingestão de métricas/campanhas do Meta Ads e Google Ads.
- **Social Analytics Service:** Focado 100% no Instagram, calcula crescimento de seguidores e insights de posts (próprios e concorrência).
- **Reporting Service:** Consolida dados em PDFs ou templates dinâmicos, monta telas exportáveis e dashboards isolados.
- **Automation Service:** Módulo de execução cronografada; encarregado do envio automático (WhatsApp) e validação de agendamentos.
- **Client Management Service:** Gestão multi-tenant. Cuida das permissões de usuários, onboarding e hierarquias contas->clientes.

### Camada 4 — Data Processing Layer
Camada voltada a processamentos pesados (assíncronos), focada na ausência de bloqueios em chamadas síncronas de API.
- **Message Broker / Queue System:** RabbitMQ ou Apache Kafka para lidar com a orquestração enfileirada.
- **Workers Distribuídos:** Pedaços de software assíncronos que executam em fila.
  - *Funções:* Ingestão massiva de métricas Meta, rotina de scraping de concorrentes, montagem e envio assincrono por WhatsApp. (Ex: Worker que dispara a cada 30min para checar campanhas).

### Camada 5 — Data Storage (Persistência Múltipla)
Bancos de dados especializados pelo tipo de escrita/leitura.
- **Banco Principal (OLTP):** PostgreSQL. Armazena usuários, estrutura do multi-tenant (clientes, campanhas), dados relacionais rígidos e agendamentos.
- **Banco Analítico (OLAP):** ClickHouse ou Google BigQuery. Armazena métricas históricas de campanhas/dia e dados em grande volume para query rápida no dashboard.
- **Sistema de Cache/Mensageria In-memory:** Redis. Para fila rápida (BullMQ), session storage de tokens e cacheamento de painel de métricas.

### Camada 6 — Integration Layer (Third-party)
Adaptadores robustos lidando com backoff, throttling das APIs externas sob as credenciais dos clientes.
- Meta Marketing API
- Google Ads API
- Instagram Graph API
- API de disparo de mensageria nativa de WhatsApp (Cloud API ou Unofficial Type if applicable).

### Especificações Técnicas e Segurança (NFRs)
- **Frequência de Ingestão de Dados (Workers Sync):** Meta (30 min), Google Ads (1 h), Instagram (12 h).
- **Segurança:** O-Auth 2.0 Native para permissões no Meta/Google, encriptação total em tokens guardados em repouso e restritivo Access Control Lists por Cliente/Agência.
- **Infraestrutura / Cloud:** Container-first via Docker. Orquestrado via Kubernetes (K8s). Rodando em nuvens de Tier 1 (AWS ou GCP).
- **Monitoramento e Observabilidade:** Tracking com Prometheus, Dashboards operacionais de saúde Grafana, rastreio contínuo de exceções em produção com Sentry.

## Etapa 8 — Estrutura Completa do Banco de Dados

### 1. Estrutura Multi-Tenant (Base do Sistema)
O modelo estrutural de hierarquia é baseado em **Workspaces** (Agências) que possuem múltiplos **Clients**, os quais conectam múltiplas **Contas (Meta, Google, Instagram)**.

### 2. Tabelas de Usuários
- **Users**: `id`, `name`, `email`, `password_hash`, `role`, `created_at`, `updated_at`.
- **Workspaces**: `id`, `name`, `owner_user_id`, `plan_type`, `created_at`.
- **WorkspaceUsers**: `id`, `workspace_id`, `user_id`, `role`.

### 3. Estrutura de Clientes
- **Clients**: `id`, `workspace_id`, `name`, `company_name`, `industry`, `timezone`, `created_at`.

### 4. Contas de Anúncios
- **MetaAdAccounts**: `id`, `client_id`, `meta_account_id`, `account_name`, `currency`, `status`, `access_token`, `refresh_token`, `connected_at`.
- **GoogleAdsAccounts**: `id`, `client_id`, `google_account_id`, `account_name`, `currency`, `access_token`, `refresh_token`, `connected_at`.

### 5. Estrutura de Campanhas
- **Campaigns**: `id`, `account_id`, `platform`, `campaign_external_id`, `name`, `status`, `objective`, `budget`, `start_date`, `end_date`.
- **AdSets**: `id`, `campaign_id`, `external_id`, `name`, `budget`, `optimization_goal`, `status`.
- **Ads**: `id`, `adset_id`, `external_id`, `name`, `creative_id`, `status`.

### 6. Estrutura de Métricas
- **CampaignMetrics**: `id`, `campaign_id`, `date`, `impressions`, `clicks`, `spend`, `conversions`, `revenue`, `cpc`, `ctr`, `roas`.
- **AdMetrics**: `id`, `ad_id`, `date`, `impressions`, `clicks`, `spend`, `conversions`, `ctr`, `cpc`.

### 7. Estrutura Social Hunter
- **InstagramAccounts**: `id`, `client_id`, `instagram_id`, `username`, `followers`, `following`, `posts_count`, `connected_at`.
- **InstagramPosts**: `id`, `instagram_account_id`, `post_id`, `caption`, `media_type`, `like_count`, `comment_count`, `reach`, `impressions`, `engagement_rate`, `posted_at`.
- **InstagramFollowerHistory**: `id`, `instagram_account_id`, `date`, `followers_count`, `followers_gained`, `followers_lost`.

### 8. Concorrentes (Social Hunter)
- **CompetitorAccounts**: `id`, `client_id`, `instagram_username`, `followers`, `engagement_rate`, `tracked_since`.

### 9. Sistema de Relatórios
- **ReportTemplates**: `id`, `workspace_id`, `name`, `template_content`, `created_at`.
- **ReportSchedules**: `id`, `client_id`, `template_id`, `frequency`, `day_of_week`, `time`, `whatsapp_account_id`, `active`.

### 10. Integração WhatsApp
- **WhatsAppAccounts**: `id`, `workspace_id`, `phone_number`, `provider`, `status`, `connected_at`.
- **WhatsAppGroups**: `id`, `whatsapp_account_id`, `group_name`, `group_id`.
- **MessageLogs**: `id`, `whatsapp_account_id`, `client_id`, `template_id`, `message_content`, `status`, `sent_at`.

### 11. Logs e Auditoria
- **ActivityLogs**: `id`, `workspace_id`, `user_id`, `action`, `entity_type`, `entity_id`, `timestamp`.

## Etapa 9 — Sistema de Ingestão de Dados (Data Pipeline)

### Objetivo desta etapa
Definir **como o sistema vai coletar dados das plataformas externas** e transformar esses dados em métricas utilizáveis no dashboard e nos relatórios. (Meta Marketing API, Google Ads API, Instagram Graph API).

### Arquitetura do Pipeline de Dados
O fluxo completo será orquestrado da seguinte forma:
`External APIs → Integration Service → Queue System → Workers → Data Processing → Database Storage → Analytics Dashboard`.

### 1. Integration Service
Responsável pela comunicação segura com as APIs: autenticar, solicitar dados, tratar erros e normalizar respostas (com módulos específicos para Meta, Google Ads e Instagram).

### 2. API Rate Limit Management
Implementação de um **Rate Limit Controller** entre a fila de requisições (`API Request Queue`) e as `External APIs` para monitorar limites estabelecidos por cada plataforma, organizar a distribuição das chamadas e evitar bloqueios.

### 3. Queue System
As requisições serão geridas de forma assíncrona por um sistema de filas usando **RabbitMQ** ou **Apache Kafka**. Ele distribuirá tarefas (jobs) como `UpdateCampaignMetrics`, `UpdateInstagramStats`, `GenerateReports` e `SendWhatsAppReport`.

### 4. Workers
Processos dedicados para consumo da fila e execução de tarefas assíncronas:
- **Ads Metrics Worker**: Processamento em background de métricas do tráfego.
- **Instagram Worker**: Update contínuo de base (seguidores/engajamento).
- **Reporting & WhatsApp Workers**: Para engine de relatórios programáveis e entregas externas via Zap.

### 5. Frequências de Atualização (Sync Tiers)
- **Meta Ads**: 30 minutos.
- **Google Ads**: 1 hora.
- **Instagram**: 12 horas.
- **Concorrentes (Social Hunter)**: 24 horas.

### 6. Normalização e Agregação de Dados
Conversão inteligente de chaves diversas (ex: `cost` e `spend`) para um DTO/estrutura padronizada (ex: `spend`), garantindo que a base possua a visão de dados com nomenclatura universal para os dashboards de negócio.

### 7. Processamento e KPIs
Cálculo de métricas derivadas (em camada de lógica de negócios ou pipeline):
- `CTR = clicks / impressions`
- `CPC = spend / clicks`
- `ROAS = revenue / spend`

Geração do histórico granulado temporal permitindo visão temporal customizada (últimos 7 dias, último mês).

### 8. Gestão da Integridade (Validation, Deduplication & Error Handling)
- Chaves compostas para deduplicação (ex: `campaign_id` + `date`).
- Rotinas de expurgo para anomalias negativas e recálculos no worker.
- Políticas ativas de retentativas programadas (backoff retries) e notificações críticas aos administradores ao detectar incidentes com as integrações/APIs de terceiros.

---

### Próxima etapa
Na **Etapa 10** vamos construir o **Ads Management System**. Esse módulo permitirá gerenciar campanhas de forma nativa pela plataforma, com features complexas como pausar anúncios, editar orçamentos e duplicar campanhas sem precisar abrir o Gerenciador de Anúncios.

## Etapa 10 — Sistema de Gestão de Anúncios (Ads Management System)

### Objetivo desta etapa
Permitir que o usuário **gerencie campanhas diretamente no seu sistema**, sem precisar acessar plataformas externas (Meta Marketing API e Google Ads API). O sistema deve permitir:
- Visualizar campanhas
- Editar campanhas
- Pausar anúncios
- Duplicar campanhas
- Alterar orçamento
- Alterar status de anúncios

### Estrutura do módulo Ads Manager
Esse módulo terá **4 níveis de gerenciamento**:
`Conta de anúncios → Campanhas → Conjuntos de anúncios → Anúncios`

#### 1. Gestão de Contas de Anúncios
Usuário poderá visualizar todas as contas conectadas.
- **Informações exibidas:** Nome da conta, moeda, status da conta, gasto diário, número de campanhas ativas.
- **Tabela exemplo:** `| Conta | Plataforma | Campanhas | Status |`

#### 2. Gestão de Campanhas
Ação macro sobre as campanhas ativas das contas.
- **Informações exibidas:** Nome da campanha, objetivo, orçamento, status, gasto total, ROAS.
- **Tabela exemplo:** `| Campanha | Plataforma | Gasto | Conversões | ROAS |`
- **Ações possíveis:** Pausar campanha, ativar campanha, duplicar campanha, editar orçamento.
  - *Sistema de Duplicação:* Permite replicar estrutura e testar variações (Copiar Campanha → Clonar adsets → Clonar anúncios).

#### 3. Gestão de Conjuntos de Anúncios (AdSets)
Controle sobre a camada de segmentação e públicos.
- **Informações exibidas:** Público alvo, orçamento, otimização, status.
- **Ações disponíveis:** Editar orçamento do conjunto, alterar público, pausar conjunto.

#### 4. Gestão de Anúncios
Controle de criativos individuais.
- **Informações exibidas:** Nome do anúncio, criativo, CTR, CPC, conversões.
- **Ações disponíveis:** Pausar anúncio, duplicar anúncio, editar criativo.

### Sistema de Edição e Sincronização
Quando o usuário executa uma alteração (ex: edita uma campanha), o fluxo é:
1. O sistema dispara `Update Campaign API Request` para o `Integration Service`.
2. O serviço aciona a `External API`.
3. A API confirma a alteração.
4. O sistema atualiza o respectivo registro no banco de dados.

### Gestão de Orçamento
Usuário poderá alterar *orçamento diário* e *orçamento total*. O sistema validará proativamente limites mínimos estipulados pela plataforma e o status atual da campanha para evitar requisições inválidas.

### Controle de Alterações, Performance e Segurança
- **Log de Ações (Audit):** Toda alteração passa por logging na tabela `ActivityLogs` (Usuário, Data, Campo alterado).
- **Batching e Filas:** Alterações em lote (bulk) são agrupadas e despachadas para filas de processamento em background (Workers) a fim de reduzir o tráfego em excesso às APIs nativas do Meta e Google.
- **Validação de Segurança:** Checks contínuos das permissões do usuário em cada Conta de Anúncios e validação de tokens ativos antes da persistência externa.

### Interface (UI) do Ads Manager
Haverá navegação estruturada no menu lateral `Ads Manager` com os submenus correspondentes a cada camada (`Contas`, `Campanhas`, `Conjuntos de anúncios` e `Anúncios`). Cada tela contará também com filtros dedicados (por cliente, conta de anúncio, campanha, e período).

---

### Próxima etapa
Na **Etapa 11** vamos construir um dos módulos mais estratégicos: **Sistema de Relatórios Inteligentes**. Esse módulo permitirá: gerar relatórios por cliente, combinar dados de múltiplas plataformas, criar dashboards personalizados, exportar relatórios e enviar relatórios automáticos via WhatsApp (conectando com o workflow de automação solicitado).

## Etapa 11 — Sistema de Relatórios Inteligentes

### Objetivo desta etapa
Criar um sistema capaz de **gerar relatórios completos de marketing**, **combinar dados de múltiplas plataformas** (Meta Marketing API, Google Ads API e Instagram Graph API), **enviar relatórios automaticamente**, e **personalizar métricas exibidas**. Esse é o módulo que tangibiliza o valor do serviço prestado para o cliente final da agência.

### Estrutura do Sistema de Relatórios
O módulo será dividido em **5 componentes principais**:

#### 1. Data Aggregation Engine
Esse componente coleta dados das várias fontes sincronizadas (via workers da Etapa 9) e cria **visões consolidadas**.
- **Exemplo de agregação:** `Meta Ads Spend` + `Google Ads Spend` = `Marketing Performance Report`.

**Métricas Suportadas:**
- *Métricas de anúncios:* Investimento total, impressões, cliques, CTR, CPC, conversões, ROAS.
- *Métricas sociais:* Seguidores, crescimento, engajamento, alcance.
- *Métricas agregadas:* Custo por conversão (blended), crescimento de seguidores, campanha com melhor desempenho.

#### 2. Report Builder
Ferramenta para criação de relatórios personalizados. O usuário poderá definir filtros e variáveis para gerar o relatório sob medida.
- **Filtros disponíveis:** Cliente, Plataformas, Período, Métricas.
- **Tipos de relatórios:**
  - *Relatório de campanhas:* Desempenho de anúncios (`| Campanha | Investimento | Conversões | ROAS |`).
  - *Relatório de social media:* Desempenho orgânico (`| Post | Likes | Comentários | Engajamento |`).
  - *Relatório consolidado:* Agrupa visão macro de anúncios e social em um documento unificado.

#### 3. Template Engine
O usuário poderá criar **templates reutilizáveis** para padronizar os relatórios enviados aos seus clientes.
- Sistema conta com **Preview** (visualização prévia com dados reais do cliente).
- **Exemplo de template markdown/texto:**
  ```text
  📊 Relatório de Performance
  Cliente: {{client_name}}
  Investimento total: {{spend}}
  Conversões: {{conversions}}
  ROAS: {{roas}}
  Campanha destaque: {{top_campaign}}
  ```
- **Variáveis dinâmicas de merge:** `client_name`, `spend`, `conversions`, `roas`, `top_campaign`, `follower_growth`, etc.

#### 4. Report Scheduler
Para automação da rotina da agência, permitindo o agendamento de disparos de relatórios.
- **Frequências de envio:** Diário, semanal, quinzenal e mensal.
- **Configurações granulares:**
  - Dia da semana ou Dia do mês.
  - Horário específico de envio.
  - Cliente e lista de contatos vinculados.

#### 5. Report Delivery System
O motor de distribuição final dos relatórios elaborados e agendados.
- **Métodos de envio suportados:**
  - WhatsApp (integração direta via WhatsApp Business Platform / módulo de automação).
  - Download manual.
  - Exportação em PDF (para relatórios profissionais enviados por email ou apresentações).
  - Dashboard interno interativo de visualização em tela.
- **Track & Trace:** Logs completos de entrega (`Data`, `Cliente`, `Tipo`, `Status`, `Destinatário`).

### Personalização por Cliente
Cada cliente cadastrado na agência pode possuir definições únicas, como templates próprios dedicados, a sua própria frequência de envio de KPIs, e o conjunto de métricas mapeada para suas metas específicas.

---

### Próxima etapa
Na **Etapa 12** vamos aprofundar o **Sistema de Automação WhatsApp**, incluindo: conexão de múltiplos números, descoberta de grupos, envio automático de mensagens, templates inteligentes e sistema de fallback para falhas de envio. Essa etapa vai transformar o produto em uma verdadeira **plataforma de automação de comunicação para agências**.

## Etapa 12 — Sistema de Automação WhatsApp

### Objetivo desta etapa
Permitir que a plataforma conecte **múltiplos números de WhatsApp**, vincule números a **clientes específicos**, descubra **grupos conectados ao número**, e envie **relatórios automaticamente** utilizando **templates personalizáveis** (com registro de histórico de envio). A integração será feita nativamente pela **WhatsApp Business Platform**.

### Estrutura do Sistema WhatsApp
O módulo terá **6 componentes principais**:

#### 1. WhatsApp Account Manager
Permite conectar **múltiplos números de WhatsApp** (ex: números da agência, de times internos, ou números próprios dos clientes).
- **Entidade Base:** `WhatsAppAccount` (id, workspace_id, phone_number, provider, status, connected_at).
- **Funcionalidades:** Conectar novo número, remover número e verificar status da conexão.

#### 2. Client WhatsApp Mapping
Vinculação de números a clientes para envios direcionados.
- **Estrutura:** Um `Client` pode possuir uma ou mais `WhatsAppAccount` vinculadas, estabelecendo por qual número o relatório de um cliente será faturado/enviado.

#### 3. Group Discovery System
Um sistema que entra em ação assim que o número é conectado: tenta listar contatos e **grupos**. Isso permite direcionar o envio para clientes individuais, grupos de equipe, ou grupos da empresa-alvo.
- **Entidade Base:** `WhatsAppGroups` (id, whatsapp_account_id, group_id, group_name, created_at).

#### 4. Message Template Engine
Permite aos usuários criar **templates personalizados** para montar os relatórios enviados via mensageria.
- **Inclusão de Variáveis:** Variáveis que serão preenchidas pelas agregações (`{{client_name}}`, `{{spend}}`, `{{conversions}}`, `{{roas}}`, `{{top_campaign}}`, `{{follower_growth}}` etc).
- **Preview:** Possibilidade de gerar preview da mensagem renderizada antes de submeter templates para uso em massa.

#### 5. Message Delivery Engine
O componente que orquestra a execução de mensagens automáticas.
- **Fluxo de Dados:** Template ➔ Data Aggregation ➔ Message Rendering ➔ API do WhatsApp ➔ Confirmação de Envio (Message Sent).
- **Sistema de Controle & Status:** O sistema registrará mensagem, ID do destinatário e status real do envio (`pending`, `sent`, `failed`, `retrying`).
- **Sistema de Retry Ativo:** No caso de falha de timeout ou de resposta da API do WhatsApp, o sistema registrará o erro, tentará enviar novamente em background, e finalmente notificará o usuário se falhar em definitivo.
- **Histórico & Logs:** O usuário pode auditar quais mensagens foram disparadas via tabela rastreável (Data, Cliente, Status, Número).

#### 6. Automation Scheduler
Responsável pelo pipeline de envios agendados de forma assíncrona.
- **Frequências Dinâmicas:** Relatórios diários, semanais, quinzenais ou mensais.
- **Configurações Possíveis:** Escolha do cliente/grupo, número do remetente, template utilizado e qual data exata (ex.: dia do mês, frequência, hora, etc).
- **Sistema de Execução Background (Workers):** Dispara periodicamente e resolve o loop `CheckSchedules` ➔ `GenerateReport` ➔ `RenderTemplate` ➔ `SendWhatsAppMessage`.

### Segurança
O sistema validará assiduamente:
- A permissão do usuário de mexer em certa automação.
- O token/status ativo do número conectado.
- O limite de mensagens em cota permitida para evitar span/blocking.

---

### Próxima etapa
Na **Etapa 13** vamos construir o **Sistema Social Hunter completo**, incluindo: monitoramento profundo de Instagram, análise de posts, crescimento de seguidores, insights de conteúdo, análise de concorrentes e ranking de posts virais. Esse módulo vai transformar sua plataforma em **uma ferramenta avançada de inteligência social**.

## Etapa 13 — Sistema Social Hunter (Inteligência de Instagram)

### Objetivo desta etapa
Criar um módulo capaz de **monitorar contas de Instagram** de clientes, analisar o **desempenho de posts**, acompanhar o **crescimento de seguidores**, gerar **insights de conteúdo**, monitorar **concorrentes** e descobrir **posts virais**. A integração será feita via **Instagram Graph API** e **Meta Marketing API**.

### Estrutura do módulo Social Hunter
O sistema será dividido em **6 componentes principais**:

#### 1. Instagram Account Connector
Permite conectar contas de Instagram do cliente. A conta deve ser **Business ou Creator** e vinculada a uma página do Facebook.
- **Fluxo:** Usuário conecta conta ➔ OAuth Meta ➔ Permissões aprovadas ➔ Conta conectada.
- **Entidade Base:** `InstagramAccount` (id, client_id, instagram_id, username, followers_count, following_count, posts_count, connected_at).

#### 2. Profile Analytics Engine
Analisa o desempenho geral do perfil.
- **Métricas:** Seguidores totais, ganhos, perdidos, crescimento semanal e mensal.
- **Gráficos:** "Followers Growth Over Time" (para identificar picos, quedas e campanhas de crescimento).

#### 3. Post Performance Analyzer
Analisa cada postagem publicada.
- **Métricas por post:** Likes, comentários, alcance, impressões, salvamentos, compartilhamentos.
- **Cálculo de Engajamento:** `Engagement Rate = (likes + comments) / followers`
- **Entidade Base:** `InstagramPosts` (id, instagram_account_id, post_id, media_type, caption, likes, comments, reach, impressions, engagement_rate, posted_at).

#### 4. Ranking de posts
Gera rankings automáticos baseados nos posts (Top 10 por engajamento, alcance e comentários) e possui filtros de tempo (últimos 7, 30 e 90 dias).

#### 5. Follower Growth Tracker
Sistema que monitora crescimento diário.
- **Entidade Base:** `InstagramFollowerHistory` (id, instagram_account_id, date, followers_count, followers_gained, followers_lost).
- **Gráficos:** Crescimento diário, mensal e ganho vs perda de seguidores.

#### 6. Competitor Monitoring System
Usuário pode adicionar listas de concorrentes (como `@marca1`, `@marca2`).
- **Informações Coletadas:** Seguidores, número de posts, engajamento médio e crescimento estimado.
- **Tabela Comparativa:** Perfil, Seguidores, Engajamento, Posts.
- **Entidade Base:** `CompetitorAccounts` (id, client_id, instagram_username, followers, engagement_rate, tracked_since).

#### 7. Content Insights Engine
Sistema que analisa padrões de conteúdo para gerar insights valiosos.
- **Métricas Analisadas:** Melhor horário para postar, formato com mais engajamento (Reels, Carrossel, Imagem) e frequência ideal.
- **Exemplo de Insight:** "Reels geram 42% mais alcance" ou "Carrosséis geram mais salvamentos".

#### 8. Alertas Automáticos
Detecção de eventos importantes baseada no monitoramento (ex: crescimento repentino, queda de engajamento, post viral).

### Interface do Social Hunter
Um menu dedicado dentro do sistema agruparia as análises:
- **Social Hunter:**
  - Overview
  - Posts
  - Growth
  - Competitors
  - Insights

---

### Próxima etapa
Na **Etapa 14** vamos aprofundar o **Sistema Multi-Cliente (Multi-Tenant SaaS)**. Essa etapa vai definir como múltiplas agências usam a plataforma, como separar dados de clientes, controle de permissões, hierarquia de usuários, e os planos e monetização do SaaS. Essa etapa é essencial para **transformar o produto em uma plataforma SaaS escalável para milhares de clientes**.

## Etapa 14 — Arquitetura Multi-Tenant (Sistema Multi-Cliente)

### Objetivo desta etapa
Permitir que a plataforma suporte:
* múltiplas **agências**
* múltiplos **clientes por agência**
* múltiplas **contas de anúncios por cliente**
* múltiplos **usuários por agência**

Tudo mantendo **isolamento total de dados**.

### Estrutura de Hierarquia do Sistema
A estrutura principal será:
```
Platform
   ↓
Workspace (Agência)
   ↓
Clients
   ↓
Accounts (Ads / Social / WhatsApp)
```

#### 1. Workspace (Agência)
Workspace representa **uma agência ou organização que usa o sistema**.
Cada workspace possui: usuários, clientes, integrações, relatórios.

**Estrutura de dados:**
`Workspace` (id, name, owner_user_id, plan_type, status, created_at)

#### 2. Usuários dentro do Workspace
Cada workspace pode ter vários usuários. Exemplo: agência com administrador, gestor de tráfego, analista, e cliente.

**Estrutura de dados:**
`WorkspaceUsers` (id, workspace_id, user_id, role, status)

#### 3. Sistema de permissões
O sistema terá **controle de acesso baseado em papéis (RBAC)**.
- **Admin:** gerencia usuários, clientes, integra contas.
- **Manager:** edita campanhas, gera relatórios.
- **Analyst:** visualiza métricas, gera relatórios.
- **Client:** ver relatórios, dashboard limitado.

#### 4. Estrutura de clientes
Cada agência pode ter **múltiplos clientes** (empresa, e-commerce, infoprodutor).

**Estrutura de dados:**
`Clients` (id, workspace_id, name, company_name, industry, timezone, created_at)

#### 5. Vinculação de plataformas por cliente
Cada cliente pode ter: contas de anúncios, contas sociais, números WhatsApp.
```
Client
   ├ Meta Ads
   ├ Google Ads
   ├ Instagram
   └ WhatsApp
```

#### 6. Controle de acesso por cliente
Usuários podem ter acesso apenas a clientes específicos (ex: Gestor A vê Loja X e Y, Gestor B vê Loja Z).

**Estrutura de dados:**
`ClientAccess` (id, user_id, client_id, role)

#### 7. Sistema de isolamento de dados
Cada consulta ao banco sempre inclui `workspace_id`. Isso garante segurança multi-tenant e que agências não vejam dados de terceiros.

#### 8. Sistema de planos (SaaS monetização)
Workspaces terão planos diferentes.
- **Starter:** até 5 clientes, 1 número WhatsApp.
- **Pro:** até 20 clientes, 3 números WhatsApp.
- **Agency:** clientes ilimitados, múltiplos números.

#### 9. Limites por plano
Exemplos de limitadores de contas de anúncios:
- **Starter:** 10 contas de anúncios.
- **Pro:** 50 contas de anúncios.
- **Agency:** ilimitado.

#### 10. Sistema de billing
A plataforma terá assinaturas mensais, upgrade/downgrade de plano.
- **Integrações possíveis:** Stripe, Mercado Pago.

#### 11. Auditoria de atividades
Todas as ações serão registradas (edição de campanha, criação de relatório, envio WhatsApp).

**Estrutura de dados:**
`ActivityLogs` (id, workspace_id, user_id, action, entity_type, entity_id, timestamp)

---

### Próxima etapa
Na **Etapa 15** vamos construir o **Sistema de Dashboard Inteligente**, incluindo: visualizações de dados avançadas, gráficos interativos, filtros dinâmicos, comparação entre plataformas e análise de campanhas em tempo real. Esse módulo será **a interface principal que os usuários verão todos os dias**.

---

## Etapa 15 — Dashboard Inteligente (Marketing Intelligence Dashboard)

### Objetivo desta etapa
Criar um dashboard que permita ao usuário:
* visualizar performance de campanhas
* analisar métricas rapidamente
* comparar plataformas de anúncios
* identificar campanhas vencedoras
* monitorar crescimento social

O dashboard será alimentado por dados de:
* Meta Marketing API
* Google Ads API
* Instagram Graph API

### Estrutura geral do Dashboard
O dashboard será dividido em **6 áreas principais**:
1. KPI Overview
2. Campaign Performance
3. Platform Comparison
4. Trend Analysis
5. Social Media Overview
6. Custom Reports

#### 1. KPI Overview
A primeira área do dashboard mostra **indicadores principais do marketing**.

**Métricas principais:**
* investimento total
* conversões
* ROAS
* custo por conversão
* receita gerada

Esses cards mostram **visão rápida do desempenho**.

#### 2. Campaign Performance
Mostra desempenho das campanhas através de uma tabela detalhada.

| Campanha | Plataforma | Investimento | Conversões | ROAS |

**Funcionalidades (Usuário pode):**
* ordenar por ROAS
* filtrar por plataforma
* filtrar por cliente

#### 3. Platform Comparison
Comparação de performance entre plataformas de anúncios (ex: Meta Ads vs Google Ads).

| Plataforma | Investimento | Conversões | ROAS |

#### 4. Trend Analysis
Mostra tendências ao longo do tempo através de gráficos:
* Investimento por dia (Spend Over Time)
* Conversões por dia (Conversions Over Time)
* ROAS ao longo do tempo (ROAS Trend)

#### 5. Social Media Overview
Integra dados do **Social Hunter**.

**Métricas exibidas:**
* seguidores totais
* crescimento de seguidores (Gráfico: Followers Growth)
* engajamento médio
* posts mais performáticos

#### 6. Custom Reports
Usuário pode criar dashboards personalizados.

**Funcionalidades:**
* adicionar widgets
* escolher métricas
* salvar dashboards

**Widgets disponíveis:**
* gráfico de linhas
* gráfico de barras
* tabela de campanhas
* ranking de posts

### Sistema de Filtros do Dashboard
Filtros são essenciais para análise. Usuário pode filtrar por:
* cliente
* conta de anúncios
* plataforma
* campanha
* período (Ex: Últimos 30 dias)

### Atualização e Performance
- **Streaming/Real-time:** O dashboard deve atualizar automaticamente. Atualização recomendada de dados de anúncios a cada 30 min, e dados sociais a cada 12h.
- **Cache (Redis):** Para evitar consultas pesadas, métricas consolidadas são armazenadas em Redis e consultas frequentes usam cache.

### Exportação de Dados
Usuário pode exportar relatórios nos formatos:
* CSV
* Excel
* PDF

### Menu Principal de Navegação da Plataforma
```text
- Dashboard
- Ads Manager
- Social Hunter
- Relatórios
- Automação WhatsApp
- Clientes
- Integrações
- Configurações
```

---

## Etapa 16 — Sistema de Notificações da Plataforma

### Objetivo desta etapa
Criar um sistema capaz de **notificar usuários sobre eventos importantes da plataforma**.
Notificações ajudam usuários a:
* acompanhar campanhas
* saber quando relatórios foram enviados
* receber alertas de performance
* monitorar erros de integração

### Tipos de notificações
O sistema terá **3 tipos principais**.

#### Notificações dentro da plataforma
Exibidas no dashboard.
Exemplos:
* relatório enviado
* nova integração conectada
* campanha pausada

#### Notificações por WhatsApp
Utilizam a integração com:
* WhatsApp Business Platform

Exemplos:
* relatório semanal enviado
* alerta de queda de ROAS

#### Notificações por email
Utilizadas para eventos importantes.
Exemplos:
* nova conta conectada
* erro de integração
* alerta de segurança

### Estrutura do sistema de notificações
O sistema terá **4 componentes**.
1. Notification Event System
2. Notification Queue
3. Notification Processor
4. Delivery Channels

#### 1. Notification Event System
Sempre que um evento ocorre, ele gera uma notificação.
Exemplos de eventos:
```text
campaign_paused
report_sent
integration_failed
new_client_created
```

**Estrutura de dados (Notifications):**
```text
id
workspace_id
user_id
type
title
message
status
created_at
```

#### 2. Notification Queue
Eventos são enviados para uma fila.
Tecnologias recomendadas:
* RabbitMQ
* Kafka

**Fluxo:**
```text
Event -> Notification Queue -> Processor
```

#### 3. Notification Processor
Workers processam notificações e decidem:
* quem receberá
* qual canal usar

#### 4. Delivery Channels
Notificações podem ser enviadas via:
* dashboard
* email
* WhatsApp

### Configurações de notificação
Usuários podem escolher receber notificações sobre:
* relatórios enviados
* campanhas com baixo desempenho
* erros de integração
* crescimento de seguidores

### Centro de notificações
No dashboard haverá um ícone de notificações: `🔔 Notificações`
Usuário pode:
* marcar como lida
* arquivar
* filtrar por tipo

---

## Etapa 17 — Segurança da Plataforma

### Objetivo desta etapa
Garantir que:
* dados de clientes sejam protegidos
* contas não sejam comprometidas
* integrações externas sejam seguras

### Camadas de segurança
O sistema terá **5 camadas de segurança**:
1. Autenticação
2. Autorização
3. Proteção de dados
4. Proteção de infraestrutura
5. Auditoria

#### 1. Autenticação
Sistema de login seguro.
Métodos suportados:
* email e senha
* login social
* autenticação multifator (MFA)

**Autenticação multifator (2FA):**
Opções de ativação via aplicativo autenticador ou SMS.

#### 2. Autorização
Controle baseado em papéis (RBAC).
Sistema já definido na etapa multi-tenant.
Roles:
* admin
* manager
* analyst
* client

#### 3. Proteção de dados
Todos os dados sensíveis devem ser criptografados.
Exemplos: tokens de API, senhas, credenciais externas.
* **Criptografia:** Dados armazenados com AES-256.
* **Senhas:** Armazenadas com bcrypt.

#### 4. Proteção de infraestrutura
Medidas importantes:
* firewall de aplicações (WAF)
* proteção contra ataques DDoS
* monitoramento de tráfego

**Infraestrutura recomendada:** AWS + Cloudflare.

#### 5. Auditoria de segurança
Todas as ações críticas são registradas (Audit Logs).
Exemplos:
* login
* alteração de campanhas
* conexão de APIs

---

## Etapa 18 — Segurança de APIs e Integrações

### Objetivo desta etapa
Garantir segurança nas integrações com:
* Meta Marketing API
* Google Ads API

### Segurança das APIs internas
Todas as APIs da plataforma terão:
* autenticação JWT
* rate limiting
* validação de requisições

**Rate Limiting:**
Limita requisições para evitar abuso (Exemplo: `100 requisições por minuto por usuário`).

**API Gateway:**
Todas as requisições passam por um gateway.
Funções principais: autenticação, controle de tráfego, logging.

### Proteção contra ataques
O sistema deve proteger contra:
* SQL injection
* XSS
* CSRF

### Tokens de integração
Tokens das APIs externas serão:
* criptografados no banco de dados
* rotacionados periodicamente

---

## Etapa 19 — Sistema de Alertas Inteligentes

### Objetivo desta etapa
Detectar automaticamente **problemas ou oportunidades nas campanhas**.

### Tipos de alertas
Sistema detecta eventos como:
* **Queda de performance:** `ROAS caiu 30% nas últimas 24h`
* **Aumento de custo:** `CPC aumentou acima do normal`
* **Campanhas pausadas:** `Campanha foi pausada automaticamente`
* **Crescimento social:** `Conta ganhou 1000 seguidores hoje`

### Estrutura do sistema
O sistema terá **3 componentes principais**:
1. Metrics Monitoring Engine
2. Alert Rules Engine
3. Alert Delivery System

#### 1. Metrics Monitoring Engine
Monitora continuamente métricas do sistema. Exemplo: ROAS, CPC, CTR, conversões.

#### 2. Alert Rules Engine
Sistema de regras define quando gerar alertas.
*Exemplo de regra:* `if ROAS drops > 30% -> trigger alert`

#### 3. Alert Delivery
Alertas podem ser enviados via:
* dashboard
* email
* WhatsApp

### Configuração de alertas
Usuário pode definir:
* métricas monitoradas
* limites e thresholds
* canais de alerta

---

## Etapa 20 — Arquitetura de Microserviços da Plataforma

### Objetivo desta etapa
Definir a estrutura técnica final para garantir que o sistema seja **escalável, resiliente e de alta performance**.
Abandonamos o modelo monolítico para adotar uma **Arquitetura Orientada a Eventos (EDA)**.

### Desenho da Malha de Microserviços
O sistema será composto por **7 microserviços principais**, cada um com sua responsabilidade e banco de dados isolado (Database per Service).

#### 1. API Gateway Service (Nginx/Kong)
*   **Função:** Ponto único de entrada para todas as requisições do frontend.
*   **Responsabilidade:** Roteamento, Rate Limiting centralizado e Terminação SSL.

#### 2. Auth & IAM Service (Node.js + Supabase Auth)
*   **Função:** Gerenciar identidades, sessões e permissões (RBAC).
*   **Responsabilidade:** Login, MFA, Registro de usuários e validação de permissões de Workspace.

#### 3. Integration & Collector Service (Node.js/Go)
*   **Função:** O "cérebro" das conexões externas.
*   **Responsabilidade:** Gerenciar tokens da Meta/Google, executar Webhooks e rodar CRONs de coleta de métricas.
*   **Prioridade:** Otimizado para Meta Graph API (Ads/Instagram).

#### 4. Insights & Metrics Service (Go/Python)
*   **Função:** Processamento pesado de dados.
*   **Responsabilidade:** Cálculo de ROAS, CTR, CPC, cruzamento de dados de Ads com CRM e geração de relatórios.
*   **Banco de Dados:** TimescaleDB (para séries temporais).

#### 5. Notification & Alerting Service (Node.js)
*   **Função:** Motor de entrega de mensagens.
*   **Responsabilidade:** Envio de notificações Push, Emails (SendGrid) e WhatsApp (API Business).

#### 6. White-Label & Client Portal Service (Next.js)
*   **Função:** Backend específico para o portal do cliente.
*   **Responsabilidade:** Customização de domínios (CNAME), temas visuais e acesso seguro para clientes finais.

#### 7. Scheduler Service (Redis/BullMQ)
*   **Função:** Orquestração de tarefas agendadas.
*   **Responsabilidade:** Garantir que todos os relatórios programados sejam disparados no horário correto.

### Comunicação entre Serviços
Para evitar acoplamento, utilizaremos **Mensageria Assíncrona**.
*   **Tecnologia:** RabbitMQ ou Redis Streams.
*   **Fluxo:** `Integration Service` coleta dados -> publica evento `metrics.collected` -> `Insights Service` processa -> publica `report.ready` -> `Notification Service` avisa o usuário.

### Estratégia de Deploy (CI/CD)
*   **Infraestrutura:** Docker + Kubernetes (EKS/GKE) ou AWS ECS.
*   **Monitoramento:** Grafana + Prometheus para métricas de infra; Sentry para erros de aplicação.

---

### Conclusão do PRD
Com estas 20 etapas, temos a visão completa de uma plataforma SaaS de elite, pronta para dominar o mercado de tráfego pago e gestão de criativos. 
O próximo passo é a **Fase de Implementação**, começando pela fundação do projeto conforme definido no Master Ledger.

---
**PRD Consolidado e Finalizado.** 💎
