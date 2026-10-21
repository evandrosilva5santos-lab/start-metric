# CONTEXT.md — Contexto Estratégico e de Negócio

## 1. O Problema
Gestores de tráfego, agências e donos de e-commerce sofrem com dados fragmentados entre plataformas de mídia (Meta Ads, Google Ads) e plataformas de pagamento/e-commerce. O ROAS reportado pelo pixel frequentemente diverge do dinheiro que realmente entra no caixa devido a atrasos, perdas de cookies, discrepâncias de timezone e custos operacionais ocultos.

## 2. A Solução (Start Metric)
O **Start Metric** unifica a ingestão de dados de campanhas da Meta Graph API v21+ com o registro de vendas reais e custos operacionais, calculando com precisão matemática:
* **Lucro Líquido Real por Campanha**
* **ROAS Real (Revenue / Spend)**
* **CPA Real (Spend / Conversões Efetivadas)**
* **Índice de Fadiga de Criativos**
* **Mineração e Esteira de Ofertas de Mercado (Garimpo)**
* **Distribuição Automática de Relatórios via WhatsApp**

## 3. Personas & Casos de Uso
1. **Gestor de Performance / Mídia Paga:**
   - *Objetivo:* Saber em 3 segundos qual campanha está dando lucro líquido e qual está drenando orçamento para pausar imediatamente.
2. **Dono de E-commerce / Infoprodutor:**
   - *Objetivo:* Ter clareza do caixa diário sem precisar exportar e cruzar 5 planilhas manuais.
3. **Dono / Diretor de Agência:**
   - *Objetivo:* Gerenciar múltiplos clientes em um único painel multi-tenant com relatórios automatizados entregues no WhatsApp do cliente toda manhã.

## 4. Limites e Restrições de Escopo (MVP)
* **Em Escopo:** Meta Ads, Supabase PostgreSQL, Multi-tenant lógico, Dashboard Next.js, CAPI Server-side, WhatsApp Evolution API v2, Garimpo.
* **Fora de Escopo do MVP:** Google Ads, TikTok Ads, App Mobile Nativo (iOS/Android), IA geradora de vídeos de criativos.
