# DESIGN.md — Start Metric Design System & UI Architecture

> **Fonte Canônica de Design do Start Metric.** Extraído e consolidado a partir de `Start Metric — telas do app.html`.
> Define o design system, tokens, paleta de cores, tipografia, glassmorphism, componentes e especificações de viewport (Desktop 1440px & Mobile 390px).

---

## 🎨 1. Design Tokens & Paleta de Cores (Dark Obsidian & Emerald Glow)

O Start Metric utiliza uma estética **Dark Obsidian de Alto Contraste** com toques sutis de **Glassmorphism** e acentos em **Emerald / Mint Glow** para métricas de ROI e lucro real.

```css
:root {
  /* Background & Superfícies */
  --background: #080a09;
  --foreground: #eaefee;
  --card: #0f1413;
  --card-foreground: #eaefee;
  --popover: #0b100e;
  --popover-foreground: #eaefee;
  --surface-1: #0f1413;
  --surface-2: #131816;
  --surface-border: #141917;

  /* Cores de Marca & ROI */
  --primary: #44d5a4;
  --primary-foreground: #04140e;
  --primary-dim: #0d251d;
  --primary-strong: #122a22;
  --primary-bright: #42e6af;
  --primary-glow: rgba(68, 213, 164, 0.15);

  /* Acento & ROI */
  --accent: #122a22;
  --accent-foreground: #44d5a4;
  --roi: #44d5a4;
  --roi-foreground: #04140e;
  --roi-dim: #122a22;
  --roi-glow: rgba(68, 213, 164, 0.20);

  /* Estados e Alertas */
  --warning: #e7ac49;
  --warning-dim: #2a2011;
  --destructive: #d27c75;
  --destructive-foreground: #ffffff;
  --danger: #d27c75;
  --danger-dim: #2a1615;

  /* Bordas & Inputs */
  --border: #1c1f1e;
  --input: #131816;
  --ring: #44d5a4;

  /* Tipografia & Hierarquia de Texto */
  --text-primary: #d6dbd9;
  --text-secondary: #9ba09e;
  --text-muted: #656766;
  --white-hairline: #141917;
  --white-hairline-strong: #1c1f1e;

  /* Séries de Gráficos (Data Viz) */
  --series-1: #44d5a4; /* Lucro / ROAS (Verde Esmeralda) */
  --series-2: #6298ec; /* Conversões / Volume (Azul Suave) */
  --series-3: #9d90ed; /* Cliques / Impressões (Roxo) */
  --series-4: #e7ac49; /* Gasto / Spend (Âmbar) */

  /* Tipografia */
  --font-body: "Space Grotesk", "Inter", "Segoe UI", sans-serif;
  --font-display: "Sora", "Space Grotesk", "Inter", sans-serif;
  --font-quote: Georgia, "Times New Roman", serif;

  /* Espaçamentos & Raios */
  --radius-sm: 0.5rem;
  --radius-md: 0.75rem;
  --radius-lg: 1rem;
  --radius-xl: 1.5rem;
  --radius-full: 9999px;

  /* Glassmorphism & Blurs */
  --blur-1: 14px;
  --blur-2: 18px;
  --blur-3: 24px;
  --glass-bg-a: rgba(15, 23, 42, 0.72);
  --glass-bg-b: rgba(15, 23, 42, 0.50);
}
```

---

## 📱 2. Mapeamento de Telas e Viewports

O design system contempla versões dedicadas para **Desktop (1440px)** e **Mobile (390px)**:

### 2.1. Visão Geral (`/performance` ou `/`)
* **Desktop (1440 × 1460px):**
  - Header com seletor de cliente/conta, filtro de intervalo de datas (`Hoje`, `Ontem`, `Últimos 7 dias`, `Mês atual`), botão de sync manual.
  - 4 KPI Cards principais: **Lucro Líquido Real**, **Gasto Total**, **ROAS Médio**, **CPA Médio**.
  - Gráfico de Linha Duplo: Spend vs. Lucro com tooltips interativos.
  - Tabela de Top Campanhas com micro-gráficos de tendência (*sparklines*).
* **Mobile (390 × 1760px):**
  - Layout em coluna única com scroll vertical suave, navegação inferior compacta (Bottom Navigation) e cards de métricas em grade 2x2.

### 2.2. Campanhas (`/campaigns`)
* **Desktop (1440 × 1200px):**
  - Filtro por status (`Todas`, `Ativas`, `Pausadas`, `Com Alerta`).
  - Tabela expandível hierárquica (Campanha > Conjunto > Anúncio).
  - Ações rápidas inline: Toggle de ativação, edição de orçamento diário, visualização de anomalias de CPA.
* **Mobile (390 × 1500px):**
  - Lista de cards de campanhas com badge de status, spend acumulado, ROAS e botão de pausa de emergência.

### 2.3. Criativos & Fatigue Index (`/criativos`)
* **Desktop (1440 × 1240px):**
  - Galeria visual em grade (4 colunas) com preview de mídia, título, badge de formato (Vídeo 9:16, Feed 1:1).
  - Métricas de engajamento: **Hook Rate (3s)**, **Hold Rate (100%)**, **CTR de Saída** e **Índice de Fadiga** (Verde = Escalar, Amarelo = Atenção, Vermelho = Saturado).
* **Mobile (390 × 1560px):**
  - Grade 2 colunas com thumbnail compacta e métricas prioritárias no rodapé do card.

### 2.4. Relatórios · Performance (`/reports`)
* **Desktop (1440 × 1120px):**
  - Painel de geração e exportação de relatórios (PDF, CSV e WhatsApp).
  - Agendador de disparos com seleção de horário, periodicidade e número do cliente.
* **Mobile (390 × 1420px):**
  - Visualização resumida do último relatório e botão de disparo imediato via WhatsApp.

### 2.5. Configurações · Integrações (`/settings`)
* **Desktop (1440 × 1220px):**
  - Cards de conexão: Meta Ads API, Evolution WhatsApp API, Webhooks CAPI e Stripe/Shopify.
  - Indicador de status de saúde da conexão (Verde Conectado, Vermelho Expirado com botão de reconexão em 1 clique).
* **Mobile (390 × 1340px):**
  - Visualização vertical com switches de ativação e leitura de QR Code do WhatsApp direto na câmera/tela.

### 2.6. Garimpo · Esteira de Ofertas (`/garimpo`)
* **Desktop (1440 × 1400px):**
  - Esteira em Kanban / Grade de Ofertas Mineradas: *Ideação*, *Em Teste*, *Validada*, *Escalada*.
  - Modal de **Oferta Aberta (1440 × 1400px)**: Análise detalhada de copy, ângulo de venda, criativo embedado, link da Landing Page e notas estratégicas.
* **Mobile (390 × 1600px):**
  - Visualização em cards verticais com tags de nicho (`Emagrecimento`, `Financeiro`, `SaaS`) e botão de abrir link direto.

---

## 🧩 3. Padrões de Componentes UI

1. **KPI Card:**
   - Fundo `var(--card)` com borda sutil `1px solid var(--border)`.
   - Hover com transição de 150ms elevando o brilho da borda (`var(--primary)` com opacidade 30%).
   - Indicador de tendência percentual (+12.4% em verde ou -5.2% em vermelho).
2. **Glass Header & Sidebar:**
   - `backdrop-filter: blur(16px)` com background `rgba(8, 10, 9, 0.85)`.
   - Links com estado ativo destacado com gradiente sutil `var(--primary-strong)` e linha lateral esquerda verde.
3. **Empty States & Skeletons:**
   - Shimmer animado em gradiente linear (`#131816` -> `#1c221f` -> `#131816`).
   - Ilustrações em SVG monocromático com textos explicativos e botão de ação primária com glow.
4. **Roadmap / Em Breve:**
   - Badge comemorativo com micro-ícone `Sparkles` ou `Clock`, opacidade reduzida (`opacity-65`) e tooltip não-bloqueante.
