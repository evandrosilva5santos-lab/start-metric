# Direção de design — Start Control no painel

> **HISTÓRICO — SUBSTITUÍDO EM 17/10/2026.** Esta direção azul não é mais normativa. O contrato visual vigente é o Metrifiquei Teal em `docs/DESIGN.md`. O conteúdo abaixo permanece preservado para rastreabilidade das decisões e regras de domínio.

> Decisão do usuário (16/10/2026): o design do Start Control substitui o tema ADZ em todo o painel.
> Fontes: Figma `WD0LDPkm43lSkkgV9YzMAs` (página Componentes) e `ANOTA TUDO/start-control/{design-system,prototipo}.html`.
> O Figma hoje só tem a página **Componentes**; as telas vêm do `prototipo.html`.

## 1. Direção

| | |
|---|---|
| **Trabalho da interface** | Saber, todo dia, o que está atrasado, em risco ou fora do combinado em cada cliente, e agir. |
| **Quem usa** | Gestor de contas e de tráfego, repetidas vezes por dia. Varre primeiro: estado (pill), cliente, prazo. |
| **Tom** | Operacional e calmo: denso, claro, sem decoração. Azul-marinho institucional. |
| **Detalhe memorável** | O selo bilateral **cliente × agência** (roxo `--client` × azul `--agency`): toda pendência diz de quem é a bola. Nenhuma outra ferramenta de tráfego mostra isso. |
| **Restrições** | Next 16 + Tailwind 4, componentes em `src/components/ui`; 1440 / 834 / 390; claro e escuro. |

## 2. Validação dos tokens

| Token | Uso | Contraste | Veredito |
|---|---|---|---|
| `--fg` `#1A2033` em branco | texto | ~16:1 | ok |
| `--fg-muted` `#5B6478` em branco | texto secundário | 5,9:1 | ok |
| `--fg-faint` `#8A93A6` em branco | rótulos | **3,1:1** | **reprova AA.** Só em texto que também existe em outro lugar (placeholder, eixo de gráfico). Rótulo de KPI usa `--fg-muted`. |
| `--blue-500` `#0093E0` em branco | destaque | **3,4:1** | **reprova para texto.** Só ícone, borda, gráfico. Link e texto usam `--primary`. |
| `--sidebar-muted` `#8F99B5` no `#1D274E` | títulos de grupo | 5,1:1 | ok |
| `--primary` `#054B8D` em branco | botão, link | ~9:1 | ok |

Outras correções:
- **Item de menu com 32px** no Figma: ok com mouse; no tablet e no celular sobe para **44px**.
- **Números:** confirmar no navegador se a Rubik tem `tnum`. Se não tiver, os números de KPI e tabela usam `font-variant-numeric: tabular-nums` com fallback para a fonte do sistema.
- **Sombra `--shadow-card`:** só no primeiro nível. Nunca cartão dentro de cartão.

### Regras do ADZ que continuam valendo
- Ausência de dado é travessão `—`, nunca zero. ("A linha para, não cai para zero", do próprio protótipo.)
- Nenhum estado só por cor: pill sempre com palavra.
- Erro vira aviso com hora e próximo passo, nunca tela vazia.
- Nenhum token, chave ou id de conta chega ao cliente.

## 3. Menu: rotas atuais → Start Control

| Grupo | Item | Rota | Hoje |
|---|---|---|---|
| Início | Visão Geral | `/` | existe (lê do banco) |
| Início | Alertas | `/alertas` | **nova** (hoje só sino no topo + config em Ajustes) |
| Clientes | Carteira | `/clients` | existe |
| Clientes | Cliente 360° | `/clients/[id]` | existe (parcial) |
| Execução | Relatórios | `/reports` | refazer |
| Crescimento | Performance | `/performance` com abas Campanhas · Criativos · Horário · Diagnóstico | as 4 telas existem; viram abas |
| Crescimento | Garimpo | `/garimpo` | existe; não está no menu do Start Control → **entra aqui** |
| Sistema | Integrações | `/settings/meta` + `/tracking` | existem |
| Sistema | Configurações & Auditoria | `/settings` | existe |

Módulos do Start Control ainda não construídos (Saúde, Operação, Calendário, Responsabilidades, Comercial, Conteúdo, Mentoria, Financeiro) **não aparecem no menu** até existirem. Link morto ensina o usuário a não clicar.

## 4. Relatórios: geração (Metrifiquei) + entrega (Start Control)

```
Modelo (editor com variáveis) ─► Gerado ─► Enviado ─► Recebido ─► Aprovado
          Metrifiquei              └──────── esteira do Start Control ────────┘
```

- **Lista "Devidos e atrasados no período"**: cliente, tipo, período, devido em, estado (pill). Atrasado = devido < hoje e não enviado.
- **Detalhe do relatório**: esteira de 4 passos (quem e quando em cada um) + texto gerado com **Copiar** + **Registrar envio** (canal, data, nota/comprovante).
- **Editor** (tela cheia): partes ilimitadas, `/` insere variável, preview ao lado, variáveis sem dado listadas antes de gerar.
- Regras: gerar ≠ enviar ≠ receber ≠ aprovar. Copiar o texto não marca como enviado.
- Sem WhatsApp: "Registrar envio" é manual. Quando o WhatsApp entrar, ele preenche o mesmo passo sozinho.

## 5. Alertas: triagem

- Filtros: estado (Abertos · Reconhecidos · Resolvidos), severidade, destinatário.
- Tabela: alerta, cliente, regra, desde, destinatário, estado.
- Painel lateral: evidência (valor atual × limite, período) + texto do template + **Reconhecer** / **Resolver com nota**.
- Regras: alerta não é diagnóstico. Dedupe por regra + cliente + período. Resolvido não volta sem fato novo.

## 6. Plano visual (frontend-design)

**Cor** — `--sidebar` `#1D274E` (moldura), `--primary` `#054B8D` (ação), `--bg-subtle` `#F5F7FA` (fundo da área de trabalho), `--surface` `#FFFFFF` (painéis), `--fg` `#1A2033` (texto), `--client` `#6D4ED8` (selo do cliente). Semânticas `--success/--warning/--danger` com `*-tint` só em pills e avisos.

**Tipo** — Poppins 600 só em título de página e número de KPI; Rubik 400/500 em todo o resto. Escala: 12 / 13 / 14 (corpo) / 16 / 20 / 28. Números sempre `tabular-nums`.

**Layout** — Moldura fixa (sidebar 232px + topo 53px) e área de trabalho alinhada à esquerda, sem largura máxima nas telas de tabela. A estrutura principal são tabelas e listas; cartão só na faixa de KPIs.

```
┌──────────┬───────────────────────────────────────────────┐
│ Start    │ Título            [Cliente ⌘K] [Período] 🔍 🔔 │
│ Control  ├───────────────────────────────────────────────┤
│          │ filtros: [Estado] [Severidade] [Destinatário] │
│ Início   │ ┌───────────────────────────────────────────┐ │
│  Visão   │ │ tabela densa · pill de estado à direita   │ │
│  Alertas │ │                                           │ │
│ Clientes │ └───────────────────────────────────────────┘ │
│ ...      │                     painel lateral ▶ evidência│
└──────────┴───────────────────────────────────────────────┘
```

**Princípios**
- Revisado contra os padrões genéricos: o ADZ (preto + um verde-ácido) era um deles; o risco agora é o "kit de cartões". Por isso: cartão só no primeiro nível, raio por hierarquia (4 controle · 6 botão/pill · 10 painel), sombra só em painel.
- Rótulos de grupo da sidebar em caixa normal ("Início", não "INÍCIO"), peso 500, cor `--sidebar-muted`.
- A ousadia fica num lugar só: o selo bilateral cliente × agência. O resto é quieto.
- Movimento só em resposta a ação (abrir painel lateral, confirmar envio), respeitando `prefers-reduced-motion`.

## 7. Ajustes no schema antes de aplicar a migration

A migration `20261016000100_reports_notifications.sql` ainda não foi aplicada; ajustar agora custa nada.

- `report_runs.status`: `queued · generated · sent · received · approved · failed · skipped`, com `sent_at`, `received_at`, `approved_at`, `sent_by`, `delivery_note`.
- `reports`: periodicidade continua em `frequency`; quando o módulo de contratos existir, passa a vir de lá.
- `alerts`: `severity` (`critical · warning · info`), `assigned_to`, `acknowledged_at`, `resolved_at`, `resolution_note`; `status` passa a `open · acknowledged · resolved` (mapear `unread` → `open`, `read` → `acknowledged`).
