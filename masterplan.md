# Masterplan: Plataforma SaaS de Inteligência de Marketing

## Elevator Pitch (30 segundos)
Uma plataforma SaaS que permite a agências e gestores de tráfego centralizar, analisar e gerenciar campanhas de marketing digital em um único dashboard.
O sistema conecta contas de anúncios, monitora redes sociais, gera relatórios por cliente e permite automatizar envios de relatórios via WhatsApp, otimizando campanhas sem sair da plataforma.

## Problema
Gestores de marketing enfrentam vários problemas:
- Dados espalhados entre plataformas
- Dificuldade em analisar desempenho real
- Relatórios manuais para clientes
- Falta de visão consolidada das campanhas
- Esforço manual repetitivo para enviar fechamentos e métricas via WhatsApp para clientes

Hoje eles precisam alternar entre:
- Meta Ads Manager
- Google Ads
- Ferramentas de social media
- Planilhas de relatórios
- WhatsApp Web para copiar e colar dados

Isso gera perda de tempo, desgaste com clientes e decisões ruins.

## Missão
Criar uma plataforma que permita:
- Centralizar dados de marketing
- Analisar performance de campanhas
- Monitorar redes sociais
- Gerar relatórios automáticos
- Automatizar o envio de resultados por WhatsApp para clientes e equipes

## Público-Alvo
- **Agências de marketing:** Necessitam gerenciar múltiplos clientes e automatizar entregas de relatórios.
- **Gestores de tráfego:** Necessitam acompanhar campanhas e otimizar anúncios.
- **Donos de e-commerce:** Necessitam entender ROI de marketing.
- **Afiliados e infoprodutores:** Necessitam acompanhar desempenho de tráfego pago.

## Core Features (Grandes Módulos)
### 1. Gestão de anúncios (Ads Manager)
Permite visualizar campanhas, ativar ou pausar anúncios e editar orçamento (sem precisar abrir o Ads Manager).
### 2. Dashboard de performance
Mostra métricas como gasto em anúncios, conversões, ROAS e CPA.
### 3. Social Hunter
Monitoramento de Instagram (crescimento de seguidores, análise de posts, top conteúdos, monitoramento de concorrentes) via Instagram Graph API.
### 4. Relatórios Inteligentes
Permite gerar relatórios por cliente, campanha, plataforma e exportação em PDF/CSV/Imagens.
### 5. WhatsApp Automation & Reports (NOVO)
Automação completa de envio de relatórios via WhatsApp.
- Conexão de múltiplos números (via Twilio, Cloud API ou Evolution API/Baileys).
- Vínculo de número a Cliente específico (ou grupos da agência/cliente).
- Construtor de Templates dinâmicos de mensagens com variáveis (ex: {{roas}}, {{spend}}, {{sales}}).
- Agendamento de disparo automático (diário, semanal, quinzenal, mensal por dia/hora).
- Histórico de envios no dashboard (Módulo: Templates > Envios > Agendamentos > Histórico).
### 6. Sistema multi-cliente e multi-tenant
Estrutura hierárquica B2B: Usuário → Clientes → Contas de anúncios / WhatsApp vinculado.

## Tech Stack (Alto nível)
- **Frontend:** React, Next.js, Tailwind CSS
- **Backend:** Node.js, NestJS (Workers para disparo de cronjobs e automação)
- **Banco de dados:** PostgreSQL
- **Cache & Filas:** Redis + BullMQ (Para agendamento assíncrono do WhatsApp e bulk actions)
- **Infraestrutura:** AWS
- **Mensageria:** API Oficial WhatsApp Business ou framework de conexão (ex: Evolution API)

## Modelo de Dados (ERD simplificado atualizado)
- **Usuário:** id, nome, email
- **Cliente:** id, nome, empresa
- **ContaAds:** id, plataforma, account_id
- **Campanha:** id, campaign_id, nome, status
- **Métricas:** data, spend, clicks, conversions
- **WhatsApp_Account:** id, numero, status, usuario_id
- **WhatsApp_Group:** id, nome, numero, whatsapp_account_id
- **Template:** id, nome, conteudo, usuario_id
- **Schedule (Agendamentos):** id, cliente_id, template_id, whatsapp_account_id, frequencia, dia_semana, hora

## UI Design Principles (Inspirado em Steve Krug)
Interface simples e B2B Premium. Telas com visualização em "Cards" rápidos. Construtor de Templates de WhatsApp deve ser "Drag & Drop" ou uso de Checkboxes [ ☑ ROAS, ☑ CPA ]. Dark mode luxuoso e intuitivo.

## Roadmap
- **MVP (Fase 1):** Login, gestão de clientes, integração Meta, dashboard básico
- **V1 (Fase 2):** Gestão de campanhas (Pausar/Ativar), Social Hunter, WhatsApp Automation Engine (Templates e Disparo)
- **V2 (Fase 3):** Integração Google Ads, relatórios multi-canal robustos, inteligência de dados / alertas de IA (ex: "Sua campanha CPA estourou, pausei.")

## Futuras Expansões
- IA que escreve a análise no relatório do WhatsApp antes de enviar
- Previsão de ROAS
- Benchmarking de mercado
