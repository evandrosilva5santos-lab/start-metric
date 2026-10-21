# DESIGN.md — Design System Oficial do START METRIC

> **Fonte canônica desde 17/10/2026.** A infraestrutura visual do Metrifiquei é a referência oficial do START METRIC. A direção Dark Obsidian/Emerald e a direção Start Control azul permanecem apenas como histórico e não são normativas.

## 1. Princípios

- Interface SaaS B2B profissional, minimalista, calma e densa.
- Dados reais acima de decoração: nenhum mock, KPI ou status inventado.
- Apresentação não altera regras de negócio, APIs, autenticação, tenant, React Query ou Zustand.
- Ausência de dado é `—`; zero real continua sendo zero.
- Fórmulas financeiras e métricas calculadas permanecem no backend.
- Status sempre combina cor, texto e, quando útil, ícone.
- Um único nível de sombra; bordas e contraste definem a hierarquia restante.

## 2. Identidade visual Teal

### 2.1 Tema claro

```css
:root {
  --background: #ffffff;
  --foreground: #171717;
  --card: #ffffff;
  --card-foreground: #171717;
  --popover: #ffffff;
  --popover-foreground: #171717;
  --primary: #007d7c;
  --primary-hover: #006f6e;
  --primary-foreground: #ffffff;
  --secondary: #f5f5f5;
  --secondary-foreground: #171717;
  --muted: #f5f5f5;
  --muted-foreground: #666666;
  --accent: #e7f6f5;
  --accent-foreground: #006f6e;
  --destructive: #c1121f;
  --border: #e5e5e5;
  --input: #dedede;
  --ring: #007d7c;
  --sidebar: #fafafa;
  --sidebar-foreground: #171717;
  --sidebar-accent: #eeeeee;
  --sidebar-border: #e5e5e5;
  --success: #2f7d32;
  --warning: #9a6700;
}
```

`#007d7c` substitui o Teal claro `#008382` do protótipo quando usado com texto claro, garantindo margem WCAG AA para texto normal.

### 2.2 Tema escuro

```css
.dark {
  --background: #0a0a0a;
  --foreground: #fafafa;
  --card: #171717;
  --card-foreground: #fafafa;
  --popover: #171717;
  --popover-foreground: #fafafa;
  --primary: #50cdcb;
  --primary-hover: #69d8d6;
  --primary-foreground: #0a0a0a;
  --secondary: #262626;
  --secondary-foreground: #fafafa;
  --muted: #262626;
  --muted-foreground: #b0b0b0;
  --accent: #173d3c;
  --accent-foreground: #8ce3e1;
  --destructive: #ff7376;
  --border: #3c3c3c;
  --input: #3c3c3c;
  --ring: #50cdcb;
  --sidebar: #171717;
  --sidebar-foreground: #fafafa;
  --sidebar-accent: #262626;
  --sidebar-border: #3c3c3c;
  --success: #6ccf72;
  --warning: #efb323;
}
```

O tema segue a preferência do sistema no primeiro acesso e a escolha persistida depois disso. A aplicação do tema deve ocorrer antes da pintura para evitar flash e divergência de hidratação.

## 3. Tipografia

- **Inter:** toda a interface, títulos, botões, tabelas e textos.
- **JetBrains Mono:** IDs, slugs, códigos, timestamps técnicos, tokens mascarados e valores que precisam de alinhamento monoespaçado.
- Valores tabulares usam `font-variant-numeric: tabular-nums`.
- Escala base: 12 / 13 / 14 / 16 / 20 / 24 / 30 px.
- Peso 600 é reservado a títulos e destaques; texto de interface usa 400/500.

## 4. Layout e densidade

- Sidebar persistente no desktop, rail intermediário quando necessário e navegação móvel dedicada.
- Topbar sticky com contexto real, alertas, tema e usuário autenticado.
- Telas analíticas e tabelas podem usar largura total; não aplicar `max-width` global que comprima dados.
- Controles compactos no desktop; alvos de toque de pelo menos 44 × 44 px em 390 px.
- Raios: controle 6 px, botão 8 px, painel 12 px, drawer/modal 16 px.
- Espaçamento preferencial em múltiplos de 4 px.

## 5. Componentes canônicos

### Primitivos

Primitivos seguem shadcn/ui e Radix UI, adaptados aos imports, tipos e contratos do monorepo. Incluem Button, Badge, Card, Dialog/Sheet, Tabs, Table, Input, Select/Combobox, Tooltip, Dropdown Menu, Popover, Switch e Separator.

### Compartilhados

- `PageHeader`: título, descrição, breadcrumb/contexto e ações.
- `FilterBar`: busca e filtros controlados com labels acessíveis.
- `EntityDrawer`: edição lateral com foco contido, Escape e dirty-state.
- `EmptyState`: ausência real, explicação e ação opcional.
- `ResourceCard`: recurso ou integração real, sem dados demonstrativos.
- `PlanBadge`: entitlement/plano real, distinto de disponibilidade.
- `StatusPill`: union tipada; status desconhecido nunca vira `pending` silenciosamente.

## 6. Estados obrigatórios

Toda tela que depende de dados deve ter:

1. **Loading:** skeleton compatível com a geometria final; nunca KPI falso.
2. **Empty:** explica por que não há dados e oferece a próxima ação possível.
3. **Error:** mensagem acionável, contexto preservado e retry quando seguro.
4. **Success:** confirmação por toast/status sem bloquear a navegação.

Dados antigos podem permanecer visíveis durante refetch, acompanhados de hora e estado da atualização.

## 7. Responsividade

### 1440 px

- Sidebar expandida, topbar sem colisões e telas de dados em largura útil ampla.
- Tabelas densas, headers alinhados e overlays dentro do viewport.

### 834 px

- Sidebar em rail ou navegação compacta.
- Filtros podem quebrar linha sem sobreposição.
- Drawers respeitam o viewport e tabelas usam scroll interno controlado.

### 390 px

- Bottom navigation e drawer funcional.
- Nenhum overflow horizontal do viewport.
- Ações essenciais alcançáveis; controles com 44 × 44 px.
- Tabelas adaptam colunas ou exibem scroll interno sinalizado.

## 8. Acessibilidade WCAG 2.2 AA

- Contraste mínimo 4,5:1 para texto normal e 3:1 para texto grande/elementos essenciais.
- Foco sempre visível, ordem lógica e navegação integral por teclado.
- Dialogs e drawers contêm foco, fecham com Escape e devolvem foco ao gatilho.
- Ícones decorativos são ocultos da árvore; botões de ícone têm nome acessível.
- Inputs têm label; erros são associados e explicam como corrigir.
- Atualizações relevantes usam live regions.
- Movimento respeita `prefers-reduced-motion`.

## 9. Gráficos e valores

- Paleta de séries deve funcionar nos dois temas e não depender apenas de cor.
- Tooltips usam tokens de superfície e borda.
- Legendas e padrões diferenciam séries quando necessário.
- `null` e `undefined` aparecem como `—`; formatadores não usam coerção falsy para decidir ausência.
- Nenhum cálculo de ROAS, CPA, lucro ou projeção é refeito no componente.

## 10. Governança da migração

- A referência visual está em `/Users/evandro/Downloads/Projeto Metrifiquei/metrifiquei-app`.
- O comportamento existente do START METRIC prevalece sobre exemplos demonstrativos da referência.
- Componentes atuais só podem ser removidos depois de mapa de consumidores com zero usos.
- Aliases antigos podem existir temporariamente apontando para tokens Teal.
- Uma nano task visual por vez, com typecheck, lint, testes e Chrome QA proporcionais ao risco.
- Especificação detalhada: `docs/METRIFIQUEI_DESIGN_SYSTEM_MIGRATION.md`.
