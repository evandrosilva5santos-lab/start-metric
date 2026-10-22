# Google Ads Intelligence — plano

## Objetivo
Transformar "Visão Google" numa central de análise: onde a verba vai, o que converte, o que desperdiça e o que ajustar. Dados reais da API (v26), buscados ao vivo e guardados em cache curto. Nada é alterado na conta sozinho.

## Decisões (confirmadas pelo dono em 2026-10-22)
- Ao vivo da API, sem tabelas novas nesta rodada. Cache em dois níveis: no navegador (react-query, 5 min) e cabeçalho `Cache-Control: private, max-age=300`; cache em memória do servidor só como reforço, porque no Vercel ele não é confiável. Se a cota apertar, a saída é um cron diário guardando totais do período.
- Abas em `/google-ads?tab=`: Visão geral · Palavras-chave · Termos de busca · Dispositivo · Localidade · Perfil · Visibilidade · Insights.
- Estados distintos: `Não disponível` (API não entrega / sem permissão), `Não aplicável` (tipo de campanha não tem a métrica) e `0` (valor real).
- Insights só sugerem; cada um traz evidência, período, gasto envolvido, impacto com premissa explícita e confiança (baixa com poucos cliques/conversões).
- Fora: funil/CRM (Start CRM), landing pages/GA4, YouTube/Display como áreas próprias (só se a conta tiver campanhas do tipo — conferir antes).

## Tarefas (uma por vez; TDD; typecheck + lint + npm test + Chrome a cada uma)
- [ ] **G1 Base**: `src/lib/google-ads/insights-core.ts` (puro): tipos de linha, `ordenar`, `buscar`, `toCsv`, `valorOuEstado` (indisponível/não aplicável/zero), derivadas (CTR, CPC, CPA, taxa de conversão). → Verify: testes do módulo.
- [ ] **G2 API genérica**: `gaql.ts` ganha queries (keywords completas, search_term_view, device, geo, gender, age) + mapeadores; `service.ts` `fetchInsights(kind, filtros)` com cache TTL; rota `GET /api/google-ads/insights?kind&from&to&accountId&campaignId` (zod, sessão, org). → Verify: testes dos mapeadores; chamada real no Chrome com a conta do Go English.
- [ ] **G3 UI base**: abas por URL; `InsightsTable` (ordenar, buscar, paginar, CSV no navegador, estados carregando/erro/vazio/indisponível); filtros de campanha/período/comparação reaproveitando os da tela. → Verify: Chrome, desktop e celular.
- [ ] **G4 Palavras-chave + Termos de busca**: tabelas com todos os campos pedidos; marcar "gasta sem converter" e "candidato a negativar" (só marcação). → Verify: números batem com o Google (amostra).
- [ ] **G5 Dispositivo, Localidade, Perfil**: comparativos com gasto, conversões e CPA; localidade com nome (consulta `geo_target_constant`), tabela + barras (mapa só se couber sem lib nova). → Verify: soma por segmento = total da conta.
- [ ] **G6 Visibilidade**: parcela de impressões, perdas por orçamento/classificação, topo e topo absoluto, lidos do banco (já sincronizados); `Não aplicável` para tipos sem Search. → Verify: bate com a variável dos relatórios.
- [ ] **G7 Insights e Oportunidades**: `insights-rules.ts` puro (palavra gasta sem converter, termo a negativar, dispositivo/local com CPA alto, orçamento limitado, melhor perfil) com limiares de confiança. → Verify: testes dos limiares (poucos cliques → baixa confiança, nunca "pausar").
- [ ] **G8 Verificação final**: revisão de código + segurança por agentes; Chrome em cada aba; corrigir o que achar; deploy.

## Ajustes da revisão (arquitetura + segurança)
- **Isolamento**: a rota recebe só o `accountId` (uuid do banco) e o resolve para o customer id com `org_id` da sessão e `platform='google'`. Nunca aceita customer id vindo do cliente. Ids validados por regex (`^\d{10}$`, `^\d{1,20}$`), datas com `from <= to <= hoje`.
- **Erros**: mensagens fixas por `err.kind` (429 cota, 403 sem acesso, 502 demais); detalhe só no log do servidor.
- **Privacidade**: termos de busca não são gravados; só os N maiores por custo (`LIMIT`); e-mail e telefone mascarados na tela e no CSV (`maskPii` no núcleo).
- **CSV**: um só `toCsv` (já protegido contra fórmula) para todo texto vindo do Google; limite de linhas.
- **Termos de busca**: `search_term_view` só traz Pesquisa/Shopping; PMax não aparece e o Google oculta termos raros → aviso fixo na aba ("a soma dos termos não fecha com o total da campanha").
- **Demografia**: só Pesquisa, Display e Vídeo; "Indeterminado" com rótulo próprio; aviso de que PMax não entrega demografia.
- **Localidade**: `geographic_view` com seletor "Presença | Interesse" (nunca somar os dois); nomes em lote via `geo_target_constant` (ids numéricos validados); nomes podem vir em inglês.
- **Visibilidade**: consulta ao vivo no nível da campanha **sem** `segments.date` (parcela de impressões não se soma nem se tira média por dia). Índice de qualidade e parcelas só em Pesquisa; as demais mostram `Não aplicável`.
- **Moeda**: cada consulta é de uma conta só; nunca somar contas de moedas diferentes.
- **UI**: um componente por aba, carregado sob demanda, com falha isolada (uma aba quebrada não derruba as outras).
- **Fora do MVP**: insights de termos da PMax, horário/dia da semana, recomendações por IA. Rate limit forte por org fica anotado (precisa de armazenamento compartilhado); no MVP vale o cache.

## Pronto quando
- Cada aba mostra dados reais de uma conta e os números batem com a tela do Google.
- Ordenar, buscar e exportar funcionam em todas as tabelas.
- Typecheck, lint e testes verdes; produção validada no Chrome.
