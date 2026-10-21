# Telas do Start Metric — referência de design

Estes arquivos são **HTML e CSS de verdade**, não imagens. Abra qualquer um direto
no navegador (comece por `index.html`) e inspecione com o DevTools para ler o valor
exato de cor, raio, espaçamento e tamanho de fonte, em vez de estimar de um print.

Foram exportados do canvas de design. A fonte da verdade continua sendo o canvas —
quando ele mudar, esta pasta é reexportada.

## Como está organizado

São dez telas, cada uma nos três tamanhos: **notebook 1440 → tablet 834 → celular 390**.
`index.html` mostra isso como uma linha por tela, com a rota e o arquivo do app que
corresponde a ela.

Os três arquivos de uma linha são **a mesma rota** em larguras diferentes, não telas
separadas. Não crie componentes `*Mobile` nem `*Tablet`: é o mesmo componente com os
pontos de quebra abaixo.

| Tela | Rota | 1440 | 834 | 390 | Onde mexer em `apps/dashboard/src` |
| --- | --- | --- | --- | --- | --- |
| Entrada | `/auth` | `Entrada.html` | `Entrada-tablet.html` | `Entrada-celular.html` | `app/auth/AuthPageClient.tsx` |
| Visão geral | `/` | `Main.html` | `Main-tablet.html` | `Visao-geral-celular.html` | `components/dashboard/DashboardClient.tsx` |
| Campanhas | `/campaigns` | `Campanhas.html` | `Campanhas-tablet.html` | `Campanhas-celular.html` | `app/(dashboard)/campaigns/page.tsx` |
| Criativos | `/criativos` | `Criativos.html` | `Criativos-tablet.html` | `Criativos-celular.html` | `app/(dashboard)/criativos/page.tsx` |
| Diagnóstico | `/diagnostico` | `Diagnostico.html` | `Diagnostico-tablet.html` | `Diagnostico-celular.html` | **não existe ainda** |
| Horário | `/horario` | `Horario.html` | `Horario-tablet.html` | `Horario-celular.html` | **não existe ainda** |
| Garimpo · esteira | `/garimpo` | `Garimpo.html` | `Garimpo-tablet.html` | `Garimpo-celular.html` | **não existe ainda** |
| Garimpo · oferta | `/garimpo/[dominio]` | `Garimpo-oferta.html` | `Garimpo-oferta-tablet.html` | `Garimpo-oferta-celular.html` | **não existe ainda** |
| Performance | `/performance` | `Performance.html` | `Performance-tablet.html` | `Performance-celular.html` | `app/(dashboard)/performance/page.tsx` |
| Configurações | `/settings` | `Ajustes.html` | `Ajustes-tablet.html` | `Ajustes-celular.html` | `app/(dashboard)/settings/page.tsx` e `settings/meta/MetaAccountsClient.tsx` |

## Os três tamanhos, e o que muda entre eles

**Notebook · 1440.** Barra lateral de 236px com rótulo e descrição em cada item.
Grades de quatro e de três colunas. Cabeçalho em uma linha.

**Tablet · 834.** A barra lateral vira um trilho de 84px: sobra o ícone, sai o rótulo,
e o alvo de toque continua em 44px. As grades de quatro e de três colunas viram duas;
as de duas colunas empilham. O cabeçalho passa a quebrar linha em vez de espremer os
controles. O respiro lateral cai de 32px para 20px.

**Celular · 390.** Não há barra lateral: a navegação vira o menu do cabeçalho, com o
mesmo conteúdo. Tudo é uma coluna só. Tabela larga rola dentro do cartão, e a página
diz isso em uma linha embaixo dela. Campo de texto com 16px para o iOS não dar zoom.

O ponto de quebra de cima é 1024px e o de baixo é 768px.

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
- Alvo de toque de 44px no celular e no tablet.
- `text-muted` (`#656766`) reprova AA: só onde a informação também existe em outro lugar.
- Nenhum token, chave ou id de conta chega ao cliente.

## Uma observação sobre o mapa de calor

No canvas, as 168 células de `Horario` são geradas por laço. Nesta exportação elas
estão escritas por extenso para a página abrir sozinha no navegador. No app, gere
a matriz 7 × 24 no servidor e passe pronta para o componente.

## Como as alturas foram definidas

Cada artboard de tablet e os celulares novos foram renderizados em Chromium com
altura livre, e a altura medida foi gravada de volta no canvas. Nenhuma foi chutada.
Se você mudar o conteúdo, a altura do artboard precisa ser medida de novo.
