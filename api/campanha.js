/**
 * api/campanha.js
 * Permite editar a situação (ACTIVE / PAUSED) e o orçamento diário
 * de campanhas e conjuntos de anúncios diretamente na Graph API da Meta.
 */

import { logCampaignActionInBackground } from './supabase-sync.js';

export default async function handler(req, res) {
  // CORS: same-origin apenas — o painel é servido pelo mesmo servidor.

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido. Use POST.' });
  }

  const token = process.env.META_TOKEN || process.env.META_SYSTEM_TOKEN || process.env.META_USER_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'META_TOKEN não configurado no .env' });
  }

  const { id, type = 'campaign', status, daily_budget } = req.body || {};

  if (!id) {
    return res.status(400).json({ error: 'Parâmetro "id" da campanha ou conjunto é obrigatório.' });
  }

  const GRAPH_VERSION = process.env.META_GRAPH_API_VERSION || 'v21.0';
  const BASE_URL = `https://graph.facebook.com/${GRAPH_VERSION}`;

  try {
    const params = new URLSearchParams();
    params.append('access_token', token);

    let changedAny = false;

    if (status && (status === 'ACTIVE' || status === 'PAUSED')) {
      params.append('status', status);
      changedAny = true;
    }

    if (daily_budget !== undefined && daily_budget !== null) {
      const budgetNum = parseFloat(daily_budget);
      if (!isNaN(budgetNum) && budgetNum > 0) {
        // Meta espera o orçamento em centavos (ex: R$ 50,00 -> 5000)
        const budgetInCents = Math.round(budgetNum * 100);
        params.append('daily_budget', String(budgetInCents));
        changedAny = true;
      }
    }

    if (!changedAny) {
      return res.status(400).json({ error: 'Nenhum campo válido enviado para atualização (status ou daily_budget).' });
    }

    const updateRes = await fetch(`${BASE_URL}/${id}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const updateData = await updateRes.json();

    if (updateData.error) {
      return res.status(400).json({
        error: `Erro ao atualizar na Meta (${updateData.error.code}): ${updateData.error.message}`,
        details: updateData.error,
      });
    }

    // Registrar ação no Supabase em background para auditoria
    if (status) {
      logCampaignActionInBackground(id, status, { daily_budget, type });
    }

    return res.status(200).json({
      success: true,
      id,
      type,
      updated: {
        status: status || undefined,
        daily_budget: daily_budget !== undefined ? parseFloat(daily_budget) : undefined,
      },
      message: 'Atualizado com sucesso na Meta!',
    });
  } catch (err) {
    return res.status(500).json({
      error: 'Erro interno no servidor ao comunicar com a Meta: ' + err.message,
    });
  }
}
