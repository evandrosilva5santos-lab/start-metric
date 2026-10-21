-- ============================================================================
-- SCRIPT DE MIGRAÇÃO: PREFIXO OBRIGATÓRIO startmetric_*
-- ============================================================================
-- Este script renomeia as tabelas para o namespace do Start Metric e cria
-- VIEWS de compatibilidade retroativa para garantir zero quebra no sistema.

-- 1. Renomear tabelas caso existam com nome antigo
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'clients') THEN
        ALTER TABLE public.clients RENAME TO startmetric_clients;
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ad_accounts') THEN
        ALTER TABLE public.ad_accounts RENAME TO startmetric_ad_accounts;
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'campaigns') THEN
        ALTER TABLE public.campaigns RENAME TO startmetric_campaigns;
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ad_metrics_daily') THEN
        ALTER TABLE public.ad_metrics_daily RENAME TO startmetric_ad_metrics_daily;
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'sales_orders') THEN
        ALTER TABLE public.sales_orders RENAME TO startmetric_orders;
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'conversions') THEN
        ALTER TABLE public.conversions RENAME TO startmetric_conversions;
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'garimpo_offers') THEN
        ALTER TABLE public.garimpo_offers RENAME TO startmetric_garimpo_offers;
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'alert_rules') THEN
        ALTER TABLE public.alert_rules RENAME TO startmetric_alert_rules;
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'meta_connections') THEN
        ALTER TABLE public.meta_connections RENAME TO startmetric_connections;
    END IF;
END $$;

-- 2. Criar Views de compatibilidade retroativa
CREATE OR REPLACE VIEW public.clients AS SELECT * FROM public.startmetric_clients;
CREATE OR REPLACE VIEW public.ad_accounts AS SELECT * FROM public.startmetric_ad_accounts;
CREATE OR REPLACE VIEW public.campaigns AS SELECT * FROM public.startmetric_campaigns;
CREATE OR REPLACE VIEW public.ad_metrics_daily AS SELECT * FROM public.startmetric_ad_metrics_daily;
CREATE OR REPLACE VIEW public.sales_orders AS SELECT * FROM public.startmetric_orders;
CREATE OR REPLACE VIEW public.conversions AS SELECT * FROM public.startmetric_conversions;
CREATE OR REPLACE VIEW public.garimpo_offers AS SELECT * FROM public.startmetric_garimpo_offers;
CREATE OR REPLACE VIEW public.alert_rules AS SELECT * FROM public.startmetric_alert_rules;
CREATE OR REPLACE VIEW public.meta_connections AS SELECT * FROM public.startmetric_connections;
