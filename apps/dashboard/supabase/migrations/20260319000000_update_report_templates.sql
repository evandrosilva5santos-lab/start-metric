-- Sprint 5: Atualizar tabela report_templates para suportar templates de relatório
-- Adiciona campos para message template com variáveis e lista de métricas

-- Adicionar colunas novas
ALTER TABLE public.report_templates
  ADD COLUMN IF NOT EXISTS message_template TEXT,
  ADD COLUMN IF NOT EXISTS metrics TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false;

-- Adicionar comentários
COMMENT ON COLUMN public.report_templates.message_template IS 'Template da mensagem com variáveis dinâmicas (ex: {{client_name}}, {{roas}})';
COMMENT ON COLUMN public.report_templates.metrics IS 'Lista de métricas incluídas no template';
COMMENT ON COLUMN public.report_templates.is_default IS 'Indica se este é um template padrão do sistema';

-- Criar índice para templates padrão
CREATE INDEX IF NOT EXISTS idx_report_templates_is_default ON public.report_templates(is_default)
  WHERE is_default = true;

-- Criar índice para busca por nome
CREATE INDEX IF NOT EXISTS idx_report_templates_name ON public.report_templates(name);
