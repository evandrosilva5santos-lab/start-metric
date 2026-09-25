# Telas do Start Metric — referência de design

Estes arquivos são **HTML e CSS de verdade**, não imagens. Abra qualquer um direto
no navegador (comece por `index.html`) e inspecione com o DevTools para ler o valor
exato de cor, raio, espaçamento e tamanho de fonte, em vez de estimar de um print.

Foram exportados do canvas de design. A fonte da verdade continua sendo o canvas —
quando ele mudar, esta pasta é reexportada.

## O que abrir

`index.html` lista as dezesseis telas com a rota de cada uma.

## Mapa: tela → rota → arquivo que muda

| Arquivo | Rota | Onde mexer em `apps/dashboard/src` |
| --- | --- | --- |
| `Entrada.html` | `/auth` | `app/auth/AuthPageClient.tsx` |
| `Main.html` | `/` | `components/dashboard/DashboardClient.tsx` |
| `Campanhas.html` | `/campaigns` | `app/(dashboard)/campaigns/page.tsx` |
| `Criativos.html` | `/criativos` | `app/(dashboard)/criativos/page.tsx` |
| `Diagnostico.html` | `/diagnostico` | **não existe ainda** |
| `Horario.html` | `/horario` | **não existe ainda** |
| `Garimpo.html` | `/garimpo` | **não existe ainda** |
| `Garimpo-oferta.html` | `/garimpo/[domain]` | **não existe ainda** |
| `Performance.html` | `/performance` | `app/(dashboard)/performance/page.tsx` |
| `Ajustes.html` | `/settings` | `app/(dashboard)/settings/page.tsx` e `settings/meta/MetaAccountsClient.tsx` |

Os arquivos terminados em `-celular` são a **mesma rota** abaixo de 768px, não telas
separadas. Não crie componentes `*Mobile`.

## Tema

Tema ADZ: fundo chapado `#080a09`, uma única cor de destaque `#44d5a4`, sem vidro,
sem sombra, sem gradiente. Os tokens estão no bloco `:root` no topo de cada arquivo —
são os mesmos que já vivem em `apps/dashboard/src/app/globals.css`.

`project/components/bundle.css` é a folha do design system: as classes `sm-*`
(`sm-card`, `sm-kpi`, `sm-table`, `sm-badge`, `sm-btn`, `sm-insight`, `sm-heat`…)
são representações fiéis em HTML dos componentes React de `src/components/ui`.
Elas existem aqui só para a referência renderizar — **não copie esse CSS para o app**.
No app, o equivalente já existe como componente.

## Regras que não se quebram

- Ausência de dado é travessão, nunca zero. Zero é medido; travessão é ausência.
- Erro e bloqueio viram aviso com hora e próximo passo, nunca tela ou tabela vazia.
- Todo cartão de número termina com uma frase dizendo o que aquilo significa.
- Todo número usa `tabular-nums`. Número grande, rótulo pequeno.
- Nenhum estado se distingue só pela cor — sempre palavra, ícone ou filete junto.
- Alvo de toque de 44px no celular.
- `text-muted` (`#656766`) reprova AA: só onde a informação também existe em outro lugar.
- Nenhum token, chave ou id de conta chega ao cliente.

## Uma observação sobre o mapa de calor

No canvas, as 168 células de `Horario` são geradas por laço. Nesta exportação elas
estão escritas por extenso para a página abrir sozinha no navegador. No app, gere
a matriz 7 × 24 no servidor e passe pronta para o componente.
