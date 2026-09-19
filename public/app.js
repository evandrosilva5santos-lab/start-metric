/**
 * ADZ — Painel de Anúncios da Meta
 * Lógica do Cliente (SPA)
 */

// Estado Global da Aplicação
const state = {
  tokenAuth: sessionStorage.getItem('adz_dashboard_password') || '',
  contas: [],
  selectedAccountId: null,
  selectedRange: 'last_30d',
  dados: null,
  selectedCampaignId: null,
  campaignFilter: 'todas',
  creativeSort: 'spend',
  heatmapMetric: 'spend',
  privacyActive: false,
  chartInstance: null,
  detailChartInstance: null,
};

// ==========================================================================
// INICIALIZAÇÃO
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  setupNavigation();
  checkAuthAndLoad();
});

// Setup de Event Listeners
function setupEventListeners() {
  // Mobile drawer
  const mobileBtn = document.getElementById('mobileMenuBtn');
  const sidebar = document.getElementById('sidebar');
  if (mobileBtn && sidebar) {
    mobileBtn.addEventListener('click', () => {
      sidebar.classList.toggle('mobile-open');
    });
  }

  // Seletor de Contas
  const accSelect = document.getElementById('accountSelect');
  accSelect.addEventListener('change', (e) => {
    state.selectedAccountId = e.target.value;
    loadAccountData();
  });

  // Seletor de Período
  const rangeSelect = document.getElementById('dateRangeSelect');
  rangeSelect.addEventListener('change', (e) => {
    state.selectedRange = e.target.value;
    loadAccountData();
  });

  // Botão de Refresh
  document.getElementById('refreshBtn').addEventListener('click', () => {
    loadAccountData(true);
  });

  // Toggle de Privacidade (Modo Olho)
  document.getElementById('privacyToggleBtn').addEventListener('click', () => {
    state.privacyActive = !state.privacyActive;
    document.body.classList.toggle('privacy-active', state.privacyActive);
    showToast(state.privacyActive ? 'Modo privacidade ativado' : 'Valores visíveis');
  });

  // Busca Global (atalho ⌘K / Ctrl+K)
  window.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      document.getElementById('globalSearchInput')?.focus();
    }
  });

  document.getElementById('globalSearchInput')?.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    if (q) {
      // Se estiver buscando, abre a aba de campanhas
      switchTab('campanhas');
      const campSearch = document.getElementById('campaignSearchInput');
      if (campSearch) {
        campSearch.value = q;
        renderCampaignsList();
      }
    }
  });

  // Filtros de Campanhas (Pills)
  const pills = document.querySelectorAll('#campaignFilterPills .filter-pill');
  pills.forEach((p) => {
    p.addEventListener('click', () => {
      pills.forEach((el) => el.classList.remove('active'));
      p.classList.add('active');
      state.campaignFilter = p.dataset.filter;
      renderCampaignsList();
    });
  });

  // Busca de Campanhas
  document.getElementById('campaignSearchInput')?.addEventListener('input', () => {
    renderCampaignsList();
  });

  // Abas internas do detalhe da campanha
  const dtabs = document.querySelectorAll('.detail-tabs .dtab');
  dtabs.forEach((dt) => {
    dt.addEventListener('click', () => {
      dtabs.forEach((el) => el.classList.remove('active'));
      document.querySelectorAll('.dtab-pane').forEach((p) => p.classList.remove('active'));
      dt.classList.add('active');
      const targetPane = document.getElementById(`dtab-${dt.dataset.dtab}`);
      if (targetPane) targetPane.classList.add('active');
    });
  });

  // Botão de Toggle Situação (Ativar / Pausar Campanha na Meta)
  document.getElementById('btnToggleStatus')?.addEventListener('click', toggleCampaignStatus);

  // Botão Salvar Orçamento na Meta
  document.getElementById('btnSaveBudget')?.addEventListener('click', saveCampaignBudget);

  // Ordenação de Criativos
  document.getElementById('creativeSortSelect')?.addEventListener('change', (e) => {
    state.creativeSort = e.target.value;
    renderCreatives();
  });

  // Seletor de Métrica do Heatmap
  const hmBtns = document.querySelectorAll('.heatmap-metric-selector .hm-btn');
  hmBtns.forEach((b) => {
    b.addEventListener('click', () => {
      hmBtns.forEach((el) => el.classList.remove('active'));
      b.classList.add('active');
      state.heatmapMetric = b.dataset.hm;
      renderHeatmap();
    });
  });

  // Form de Autenticação / Senha
  const authForm = document.getElementById('authForm');
  authForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const pass = document.getElementById('authPasswordInput').value;
    const errorEl = document.getElementById('authErrorMsg');
    errorEl.textContent = '';

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pass }),
      });
      const data = await res.json();
      if (res.ok && data.authenticated) {
        state.tokenAuth = pass;
        sessionStorage.setItem('adz_dashboard_password', pass);
        document.getElementById('authModal').style.display = 'none';
        loadAccounts();
      } else {
        errorEl.textContent = data.error || 'Senha incorreta. Tente novamente.';
      }
    } catch {
      errorEl.textContent = 'Erro ao conectar ao servidor.';
    }
  });
}

// Navegação entre abas principais da Sidebar
function setupNavigation() {
  const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
  navItems.forEach((item) => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const tabName = item.dataset.tab;
      switchTab(tabName);
    });
  });

  // Suporte a hash URL
  window.addEventListener('hashchange', () => {
    const hash = window.location.hash.replace('#', '') || 'resumo';
    switchTab(hash, false);
  });

  const initialHash = window.location.hash.replace('#', '') || 'resumo';
  switchTab(initialHash, false);
}

function switchTab(tabName, updateHash = true) {
  const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
  const panes = document.querySelectorAll('.tab-pane');

  navItems.forEach((i) => i.classList.toggle('active', i.dataset.tab === tabName));
  panes.forEach((p) => p.classList.toggle('active', p.id === `tab-${tabName}`));

  if (updateHash) {
    history.replaceState(null, '', `#${tabName}`);
  }

  // Redesenhar gráficos ao abrir abas
  if (tabName === 'resumo') {
    renderDailyChart();
  } else if (tabName === 'campanhas' && state.selectedCampaignId) {
    renderDetailChart();
  }

  // Fechar sidebar mobile se aberta
  document.getElementById('sidebar')?.classList.remove('mobile-open');
}

// ==========================================================================
// FETCH HELPERS COM SUPORTE A SENHA
// ==========================================================================
async function apiFetch(url, options = {}) {
  const headers = {
    ...options.headers,
  };
  if (state.tokenAuth) {
    headers['x-dashboard-password'] = state.tokenAuth;
  }

  const res = await fetch(url, { ...options, headers });

  if (res.status === 401) {
    document.getElementById('authModal').style.display = 'flex';
    throw new Error('Autenticação necessária');
  }

  return res;
}

// Checagem de Senha e Carregamento Inicial
async function checkAuthAndLoad() {
  try {
    const res = await fetch('/api/auth');
    const data = await res.json();
    if (data.requiresPassword && !state.tokenAuth) {
      document.getElementById('authModal').style.display = 'flex';
    } else {
      loadAccounts();
    }
  } catch {
    loadAccounts();
  }
}

// ==========================================================================
// CARREGAR CONTAS DE ANÚNCIOS (/api/contas)
// ==========================================================================
async function loadAccounts() {
  try {
    const res = await apiFetch('/api/contas');
    const data = await res.json();

    if (data.error) {
      showNotice(`Aviso da Meta: ${data.error}`, 'warning');
      return;
    }

    state.contas = data.contas || [];
    const select = document.getElementById('accountSelect');
    select.innerHTML = '';

    if (state.contas.length === 0) {
      select.innerHTML = '<option value="">Nenhuma conta de anúncios encontrada</option>';
      return;
    }

    // Preencher select
    state.contas.forEach((acc) => {
      const opt = document.createElement('option');
      opt.value = acc.id;
      opt.textContent = `${acc.isActive ? '● ' : '○ '}${acc.name} (${acc.currency})`;
      select.appendChild(opt);
    });

    // Selecionar preferencialmente conta com gasto ou Megainvest
    let targetAcc = state.contas.find((c) => c.id === 'act_2233146500436756');
    if (!targetAcc) {
      targetAcc = state.contas.find((c) => c.isActive) || state.contas[0];
    }

    state.selectedAccountId = targetAcc.id;
    select.value = targetAcc.id;

    // Atualizar rodapé da sidebar
    const activeCount = state.contas.filter((c) => c.isActive).length;
    document.getElementById('metaStatusSubtitle').textContent = `${activeCount} contas ativas disponíveis`;

    // Carregar dados da conta selecionada
    loadAccountData();
  } catch (err) {
    console.error('Erro ao carregar contas:', err);
  }
}

// ==========================================================================
// CARREGAR DADOS DA CONTA (/api/dados)
// ==========================================================================
async function loadAccountData(forceFresh = false) {
  if (!state.selectedAccountId) return;

  const overlay = document.getElementById('loadingOverlay');
  overlay.style.display = 'flex';
  document.getElementById('globalNotice').style.display = 'none';

  try {
    const freshParam = forceFresh ? '&fresh=true' : '';
    const res = await apiFetch(`/api/dados?account_id=${state.selectedAccountId}&range=${state.selectedRange}${freshParam}`);
    const data = await res.json();

    if (data.error) {
      showNotice(data.error, 'danger');
      overlay.style.display = 'none';
      return;
    }

    state.dados = data;

    // Atualizar Tag da Conta
    document.getElementById('currentAccountTag').textContent = `${data.conta.name} • ${data.conta.currency}`;

    // Aviso de Rate Limit se aplicável
    if (data.warning) {
      showNotice(data.warning, 'warning');
    }

    // Renderizar todas as telas
    renderOverview();
    renderCampaigns();
    renderCreatives();
    renderHeatmap();
    renderDiagnostics();

    // Atualizar timestamp de sync
    const syncText = document.getElementById('syncText');
    if (data.cached) {
      syncText.textContent = `cache (${data.cacheAgeSeconds || 0}s atrás)`;
    } else {
      syncText.textContent = 'atualizado agora';
    }

    showToast('Dados atualizados com sucesso!');
  } catch (err) {
    console.error('Erro ao carregar dados:', err);
  } finally {
    overlay.style.display = 'none';
  }
}

// ==========================================================================
// FORMATTERS & HELPERS
// ==========================================================================
function formatCurrency(val, currency = 'BRL') {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: currency,
  }).format(val || 0);
}

function formatNumber(val) {
  return new Intl.NumberFormat('pt-BR').format(val || 0);
}

function formatPercent(val) {
  const prefix = val > 0 ? '+' : '';
  return `${prefix}${val.toFixed(1)}%`;
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.display = 'block';
  setTimeout(() => {
    t.style.display = 'none';
  }, 3500);
}

function showNotice(msg, type = 'warning') {
  const n = document.getElementById('globalNotice');
  n.textContent = msg;
  n.className = `global-notice ${type}`;
  n.style.display = 'block';
}

// ==========================================================================
// ABA 1: VISÃO GERAL (RESUMO)
// ==========================================================================
function renderOverview() {
  const d = state.dados;
  if (!d) return;

  const { totais, variacoes, periodo } = d;
  const curr = d.conta.currency || 'BRL';

  // 1. Investido
  document.getElementById('kpiSpend').textContent = formatCurrency(totais.spend, curr);
  const varSpendEl = document.getElementById('varSpendBadge');
  varSpendEl.textContent = formatPercent(variacoes.spend);
  varSpendEl.className = `kpi-tag ${variacoes.spend > 0 ? '' : 'positive'}`;

  // 2. Resultados
  const resTitle = totais.primaryType === 'compras' ? 'Compras' : (totais.primaryType === 'mensagens' ? 'Mensagens' : 'Leads');
  document.getElementById('kpiResultsTitle').textContent = resTitle;
  document.getElementById('kpiResults').textContent = formatNumber(totais.results);
  const varResEl = document.getElementById('varResultsBadge');
  varResEl.textContent = formatPercent(variacoes.results);
  varResEl.className = `kpi-tag ${variacoes.results >= 0 ? 'positive' : 'negative'}`;

  // 3. Custo por Resultado
  document.getElementById('kpiCpr').textContent = totais.results > 0 ? formatCurrency(totais.cpr, curr) : '—';
  const varCprEl = document.getElementById('varCprBadge');
  varCprEl.textContent = formatPercent(variacoes.cpr);
  varCprEl.className = `kpi-tag ${variacoes.cpr <= 0 ? 'positive' : 'negative'}`;

  // 4. ROAS / Retorno
  const roasVal = totais.roas > 0 ? `${totais.roas.toFixed(2)}x` : '—';
  document.getElementById('kpiRoas').textContent = roasVal;
  const varRoasEl = document.getElementById('varRoasBadge');
  varRoasEl.textContent = formatPercent(variacoes.roas);
  varRoasEl.className = `kpi-tag ${variacoes.roas >= 0 ? 'positive' : 'negative'}`;

  // Métricas Secundárias
  document.getElementById('kpiCtr').textContent = `${totais.ctr.toFixed(2)}%`;
  document.getElementById('varCtr').textContent = `${formatPercent(variacoes.ctr)} vs anterior`;
  document.getElementById('kpiCpm').textContent = formatCurrency(totais.cpm, curr);
  document.getElementById('varCpm').textContent = `${formatPercent(variacoes.cpm)} vs anterior`;
  document.getElementById('kpiImpressions').textContent = formatNumber(totais.impressions);
  document.getElementById('kpiClicks').textContent = formatNumber(totais.clicks);

  // Gráfico Diário
  renderDailyChart();

  // Funil de Conversão
  renderFunnel();
}

// Gráfico Diário usando Canvas Nativo
function renderDailyChart() {
  const d = state.dados;
  if (!d || !d.serieDiaria || d.serieDiaria.length === 0) return;

  const canvas = document.getElementById('dailyChart');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  const width = rect.width;
  const height = rect.height;
  ctx.clearRect(0, 0, width, height);

  const series = d.serieDiaria;
  const maxSpend = Math.max(...series.map((s) => s.spend), 1);
  const padding = { top: 20, right: 20, bottom: 30, left: 50 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  // Linhas de Grade
  ctx.strokeStyle = '#1e2823';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = padding.top + (chartH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();

    // Rótulo Eixo Y
    const val = maxSpend * (1 - i / 4);
    ctx.fillStyle = '#6b7280';
    ctx.font = '10px "Plus Jakarta Sans"';
    ctx.textAlign = 'right';
    ctx.fillText(`R$ ${Math.round(val)}`, padding.left - 8, y + 3);
  }

  // Desenhar Área e Linha de Gasto (Verde Neon)
  const stepX = chartW / Math.max(series.length - 1, 1);
  const points = series.map((s, idx) => {
    const x = padding.left + idx * stepX;
    const y = padding.top + chartH - (s.spend / maxSpend) * chartH;
    return { x, y, spend: s.spend, label: s.label };
  });

  // Gradiente da Área
  const grad = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartH);
  grad.addColorStop(0, 'rgba(0, 230, 118, 0.25)');
  grad.addColorStop(1, 'rgba(0, 230, 118, 0.0)');

  ctx.beginPath();
  ctx.moveTo(points[0].x, padding.top + chartH);
  points.forEach((p) => ctx.lineTo(p.x, p.y));
  ctx.lineTo(points[points.length - 1].x, padding.top + chartH);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Linha Superior
  ctx.beginPath();
  points.forEach((p, idx) => {
    if (idx === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
  ctx.strokeStyle = '#00e676';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Pontos e Rótulos Eixo X
  const labelInterval = Math.ceil(series.length / 8);
  points.forEach((p, idx) => {
    // Ponto
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#00e676';
    ctx.fill();

    // Rótulo X
    if (idx % labelInterval === 0 || idx === series.length - 1) {
      ctx.fillStyle = '#9ca3af';
      ctx.font = '10px "Plus Jakarta Sans"';
      ctx.textAlign = 'center';
      ctx.fillText(p.label, p.x, height - 10);
    }
  });
}

// Renderizar Funil de Conversão
function renderFunnel() {
  const f = state.dados?.funil;
  if (!f) return;

  const container = document.getElementById('funnelStages');
  container.innerHTML = '';

  f.etapas.forEach((etapa, idx) => {
    const card = document.createElement('div');
    card.className = 'stage-card';

    card.innerHTML = `
      <div class="stage-name">${idx + 1}. ${etapa.nome}</div>
      <div class="stage-val sensitive">${formatNumber(etapa.valor)}</div>
      <div class="stage-rates">
        <span>Passagem:</span>
        <span class="rate-badge">${etapa.pctAnterior.toFixed(1)}%</span>
      </div>
    `;
    container.appendChild(card);
  });

  // Gargalo
  document.getElementById('bottleneckEtapa').textContent = f.gargalo.etapa;
  document.getElementById('bottleneckText').textContent = f.gargalo.explicacao;
}

// ==========================================================================
// ABA 2: CAMPANHAS (SPLIT VIEW IDÊNTICO À IMAGEM)
// ==========================================================================
function renderCampaigns() {
  const d = state.dados;
  if (!d) return;

  const campaigns = d.campanhas || [];

  // Contadores
  document.getElementById('campaignsCountBadge').textContent = campaigns.length;
  document.getElementById('countAll').textContent = campaigns.length;
  document.getElementById('countActive').textContent = campaigns.filter((c) => c.situacao === 'ATIVA').length;
  document.getElementById('countPaused').textContent = campaigns.filter((c) => c.situacao === 'PAUSADA').length;
  document.getElementById('countAlert').textContent = campaigns.filter((c) => c.situacao === 'SEM_ENTREGA' || (c.results === 0 && c.spend > 100)).length;

  renderCampaignsList();

  // Selecionar primeira campanha se nenhuma selecionada
  if (!state.selectedCampaignId && campaigns.length > 0) {
    selectCampaign(campaigns[0].id);
  } else if (state.selectedCampaignId) {
    selectCampaign(state.selectedCampaignId);
  }
}

function renderCampaignsList() {
  const container = document.getElementById('campaignsList');
  if (!container || !state.dados) return;

  container.innerHTML = '';
  const query = document.getElementById('campaignSearchInput')?.value.toLowerCase() || '';

  let filtered = state.dados.campanhas || [];

  // Filtro por Pill
  if (state.campaignFilter === 'ativas') {
    filtered = filtered.filter((c) => c.situacao === 'ATIVA');
  } else if (state.campaignFilter === 'pausadas') {
    filtered = filtered.filter((c) => c.situacao === 'PAUSADA');
  } else if (state.campaignFilter === 'atencao') {
    filtered = filtered.filter((c) => c.situacao === 'SEM_ENTREGA' || (c.results === 0 && c.spend > 100));
  }

  // Filtro por Busca
  if (query) {
    filtered = filtered.filter((c) => c.name.toLowerCase().includes(query) || (c.objective || '').toLowerCase().includes(query));
  }

  if (filtered.length === 0) {
    container.innerHTML = '<div style="padding: 2rem; text-align: center; color: var(--text-dim);">Nenhuma campanha encontrada com este filtro.</div>';
    return;
  }

  filtered.forEach((camp) => {
    const item = document.createElement('div');
    item.className = `camp-row-item ${camp.id === state.selectedCampaignId ? 'selected' : ''}`;
    item.onclick = () => selectCampaign(camp.id);

    const budgetStr = camp.daily_budget ? `R$ ${camp.daily_budget.toFixed(2)}/dia` : 'Sem limite';
    const statusClass = camp.situacao.toLowerCase();

    item.innerHTML = `
      <div class="camp-item-left">
        <div class="camp-item-name" title="${camp.name}">${camp.name}</div>
        <div class="camp-item-sub">
          <span>${camp.objective ? camp.objective.replace('OUTCOME_', '') : 'Campanha'}</span>
          <span>•</span>
          <span class="sensitive">${budgetStr}</span>
        </div>
      </div>
      <div class="camp-item-right">
        <span class="status-badge ${statusClass}">${camp.situacaoLabel}</span>
      </div>
    `;
    container.appendChild(item);
  });
}

function selectCampaign(campaignId) {
  state.selectedCampaignId = campaignId;

  // Atualizar seleção visual na lista
  const rows = document.querySelectorAll('.camp-row-item');
  rows.forEach((r) => r.classList.remove('selected'));

  const camp = state.dados?.campanhas?.find((c) => c.id === campaignId);
  if (!camp) return;

  // Esconder placeholder e exibir conteúdo
  document.getElementById('detailPlaceholder').style.display = 'none';
  const content = document.getElementById('detailContent');
  content.style.display = 'flex';
  content.style.flexDirection = 'column';

  // Cabeçalho
  document.getElementById('detCampaignName').textContent = camp.name;
  document.getElementById('detCampaignSub').textContent = `${camp.objective ? camp.objective.replace('OUTCOME_', '') : 'Vendas'} · ${state.dados.conta.name}`;

  // Status Badge & Botão Toggle
  const isAtiva = camp.status === 'ACTIVE' || camp.effective_status === 'ACTIVE';
  const statusBadge = document.getElementById('detStatusBadge');
  const statusText = document.getElementById('detStatusText');
  const toggleBtn = document.getElementById('btnToggleStatus');

  statusBadge.className = `status-indicator ${isAtiva ? 'active' : 'paused'}`;
  statusText.textContent = isAtiva ? 'Ativa' : 'Pausada';
  toggleBtn.textContent = isAtiva ? 'Pausar Campanha' : 'Ativar Campanha';
  toggleBtn.className = isAtiva ? 'btn btn-outline btn-sm' : 'btn btn-primary btn-sm';

  // Orçamento
  document.getElementById('detBudgetType').textContent = camp.budgetType;
  const budgetInput = document.getElementById('detBudgetInput');
  budgetInput.value = camp.daily_budget ? camp.daily_budget.toFixed(2) : '0.00';

  // 4 KPIs da Campanha
  const curr = state.dados.conta.currency || 'BRL';
  document.getElementById('detSpend').textContent = formatCurrency(camp.spend, curr);
  document.getElementById('detResultsTitle').textContent = camp.objective?.includes('LEAD') ? 'Leads' : 'Resultados';
  document.getElementById('detResults').textContent = formatNumber(camp.results);
  document.getElementById('detCpr').textContent = camp.results > 0 ? formatCurrency(camp.cpr, curr) : '—';
  document.getElementById('detCtr').textContent = `${camp.ctr.toFixed(2)}%`;

  // Gráfico do Detalhe
  renderDetailChart();

  // Lista de Conjuntos (Adsets)
  const adsetsList = document.getElementById('detAdsetsList');
  adsetsList.innerHTML = '';
  if (camp.adsets && camp.adsets.length > 0) {
    camp.adsets.forEach((a) => {
      const row = document.createElement('div');
      row.className = 'entity-row';
      const bStr = a.daily_budget ? `R$ ${a.daily_budget.toFixed(2)}/dia` : 'CBO';
      row.innerHTML = `
        <div>
          <div class="entity-name">${a.name}</div>
          <div class="entity-sub">Fase: ${a.learning_stage} • Otimização: ${a.optimization_goal || 'Padrão'}</div>
        </div>
        <div style="text-align: right;">
          <span class="status-badge ${a.status === 'ACTIVE' ? 'ativa' : 'pausada'}">${a.status === 'ACTIVE' ? 'Ativo' : 'Pausado'}</span>
          <div class="entity-sub sensitive" style="margin-top: 4px;">${bStr}</div>
        </div>
      `;
      adsetsList.appendChild(row);
    });
  } else {
    adsetsList.innerHTML = '<div style="padding: 1rem; color: var(--text-dim);">Nenhum conjunto retornado para esta campanha.</div>';
  }

  // Lista de Anúncios (Ads)
  const adsList = document.getElementById('detAdsList');
  adsList.innerHTML = '';
  if (camp.ads && camp.ads.length > 0) {
    camp.ads.forEach((ad) => {
      const row = document.createElement('div');
      row.className = 'entity-row';
      row.innerHTML = `
        <div>
          <div class="entity-name">${ad.name}</div>
          <div class="entity-sub">${ad.creative?.title || 'Anúncio padrão'}</div>
        </div>
        <div>
          <span class="status-badge ${ad.status === 'ACTIVE' ? 'ativa' : 'pausada'}">${ad.status === 'ACTIVE' ? 'Ativo' : 'Pausado'}</span>
        </div>
      `;
      adsList.appendChild(row);
    });
  } else {
    adsList.innerHTML = '<div style="padding: 1rem; color: var(--text-dim);">Nenhum anúncio listado nesta campanha.</div>';
  }

  // Destacar linha na lista
  renderCampaignsList();
}

// Alternar Situação da Campanha (ACTIVE / PAUSED) na Meta
async function toggleCampaignStatus() {
  const camp = state.dados?.campanhas?.find((c) => c.id === state.selectedCampaignId);
  if (!camp) return;

  const currentStatus = camp.status || 'PAUSED';
  const newStatus = currentStatus === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';

  const toggleBtn = document.getElementById('btnToggleStatus');
  toggleBtn.disabled = true;
  toggleBtn.textContent = 'Salvando na Meta...';

  try {
    const res = await apiFetch('/api/campanha', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: camp.id,
        type: 'campaign',
        status: newStatus,
      }),
    });

    const data = await res.json();
    if (res.ok && data.success) {
      camp.status = newStatus;
      camp.effective_status = newStatus;
      camp.situacao = newStatus === 'ACTIVE' ? (camp.spend > 0 ? 'ATIVA' : 'SEM_ENTREGA') : 'PAUSADA';
      camp.situacaoLabel = newStatus === 'ACTIVE' ? 'Ativa' : 'Pausada';

      selectCampaign(camp.id);
      showToast(`Campanha ${newStatus === 'ACTIVE' ? 'ATIVADA' : 'PAUSADA'} com sucesso na Meta!`);
    } else {
      showToast(`Erro ao alterar: ${data.error || 'Falha na Meta'}`);
    }
  } catch (err) {
    showToast('Erro de conexão ao atualizar status.');
  } finally {
    toggleBtn.disabled = false;
  }
}

// Salvar Orçamento Diário na Meta
async function saveCampaignBudget() {
  const camp = state.dados?.campanhas?.find((c) => c.id === state.selectedCampaignId);
  if (!camp) return;

  const budgetInput = document.getElementById('detBudgetInput');
  const newBudget = parseFloat(budgetInput.value);

  if (isNaN(newBudget) || newBudget <= 0) {
    showToast('Informe um valor de orçamento válido.');
    return;
  }

  const saveBtn = document.getElementById('btnSaveBudget');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Gravando...';

  try {
    const res = await apiFetch('/api/campanha', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: camp.id,
        type: 'campaign',
        daily_budget: newBudget,
      }),
    });

    const data = await res.json();
    if (res.ok && data.success) {
      camp.daily_budget = newBudget;
      showToast(`Orçamento diário alterado para R$ ${newBudget.toFixed(2)} na Meta!`);
    } else {
      showToast(`Erro ao salvar orçamento: ${data.error || 'Falha na Meta'}`);
    }
  } catch (err) {
    showToast('Erro de conexão ao salvar orçamento.');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Salvar na Meta';
  }
}

// Gráfico do Detalhe da Campanha (Curva de Gasto)
function renderDetailChart() {
  const canvas = document.getElementById('detailDailyChart');
  if (!canvas || !state.dados?.serieDiaria) return;

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  const width = rect.width;
  const height = rect.height;
  ctx.clearRect(0, 0, width, height);

  // Proporção de gasto da campanha contra série geral
  const series = state.dados.serieDiaria;
  const maxVal = Math.max(...series.map((s) => s.spend), 1);

  const stepX = width / Math.max(series.length - 1, 1);
  const points = series.map((s, idx) => ({
    x: idx * stepX,
    y: height - 10 - (s.spend / maxVal) * (height - 30),
  }));

  // Área verde esmeralda neon
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, 'rgba(0, 230, 118, 0.3)');
  grad.addColorStop(1, 'rgba(0, 230, 118, 0.0)');

  ctx.beginPath();
  ctx.moveTo(points[0].x, height);
  points.forEach((p) => ctx.lineTo(p.x, p.y));
  ctx.lineTo(points[points.length - 1].x, height);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.beginPath();
  points.forEach((p, idx) => {
    if (idx === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
  ctx.strokeStyle = '#00e676';
  ctx.lineWidth = 2;
  ctx.stroke();
}

// ==========================================================================
// ABA 3: CRIATIVOS COM HOOK RATE E RETENÇÃO DE VÍDEO
// ==========================================================================
function renderCreatives() {
  const container = document.getElementById('creativesGrid');
  if (!container || !state.dados) return;

  container.innerHTML = '';
  let criativos = [...(state.dados.criativos || [])];

  if (criativos.length === 0) {
    container.innerHTML = '<div style="padding: 2rem; color: var(--text-dim);">Nenhum anúncio com gasto registrado no período.</div>';
    return;
  }

  // Ordenação
  const sort = state.creativeSort;
  criativos.sort((a, b) => {
    if (sort === 'results') return b.results - a.results;
    if (sort === 'cpr') return (a.cpr || 9999) - (b.cpr || 9999);
    if (sort === 'ctr') return b.ctr - a.ctr;
    if (sort === 'hook') return b.hookRate - a.hookRate;
    return b.spend - a.spend;
  });

  const curr = state.dados.conta.currency || 'BRL';

  criativos.forEach((c) => {
    const card = document.createElement('div');
    card.className = 'creative-card';

    // Badge
    let badgeHtml = '';
    if (c.results > 15 && c.cpr < state.dados.totais.cpr) {
      badgeHtml = '<span class="creative-badge-tag winner">★ Campeão</span>';
    } else if (c.spend > 150 && c.ctr < 0.6) {
      badgeHtml = '<span class="creative-badge-tag fatigue">▲ Cansado</span>';
    }

    // Preview
    const previewHtml = c.thumbnail
      ? `<img src="${c.thumbnail}" class="creative-img" alt="${c.name}" onerror="this.style.display='none'">`
      : `<div class="creative-img-fallback">Prévia não disponível</div>`;

    // Métricas de Vídeo
    let videoBoxHtml = '';
    if (c.isVideo) {
      videoBoxHtml = `
        <div class="video-retention-box">
          <div>
            <div class="retention-row">
              <span>Gancho 3 seg (Hook Rate)</span>
              <span class="rate-badge">${c.hookRate.toFixed(1)}%</span>
            </div>
            <div class="retention-bar-bg">
              <div class="retention-bar-fill" style="width: ${Math.min(c.hookRate, 100)}%;"></div>
            </div>
          </div>
          <div>
            <div class="retention-row">
              <span>Retenção até o Fim (100%)</span>
              <span class="rate-badge">${c.retentionRate.toFixed(1)}%</span>
            </div>
            <div class="retention-bar-bg">
              <div class="retention-bar-fill" style="width: ${Math.min(c.retentionRate, 100)}%;"></div>
            </div>
          </div>
        </div>
      `;
    }

    card.innerHTML = `
      <div class="creative-preview-box">
        ${previewHtml}
        ${badgeHtml}
      </div>
      <div class="creative-body">
        <div class="creative-name" title="${c.name}">${c.name}</div>
        <div class="creative-camp-name">${c.campaign_name || 'Campanha'}</div>
        
        <div class="creative-stats-grid">
          <div>
            <div class="cstat-label">Gasto</div>
            <div class="cstat-val sensitive">${formatCurrency(c.spend, curr)}</div>
          </div>
          <div>
            <div class="cstat-label">Resultados</div>
            <div class="cstat-val sensitive">${c.results}</div>
          </div>
          <div>
            <div class="cstat-label">CTR Link</div>
            <div class="cstat-val">${c.ctr.toFixed(2)}%</div>
          </div>
        </div>

        ${videoBoxHtml}
      </div>
    `;

    container.appendChild(card);
  });
}

// ==========================================================================
// ABA 4: MAPA DE CALOR HORÁRIO (7x24)
// ==========================================================================
function renderHeatmap() {
  const container = document.getElementById('heatmapGrid');
  if (!container || !state.dados) return;

  container.innerHTML = '';
  const hm = state.dados.heatmap || [];
  const metric = state.heatmapMetric;

  // Descobrir valor máximo para a escala
  let maxVal = 0;
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      const val = hm[d]?.[h]?.[metric] || 0;
      if (val > maxVal) maxVal = val;
    }
  }
  if (maxVal === 0) maxVal = 1;

  // Cabeçalho das Horas (00h a 23h)
  const emptyCorner = document.createElement('div');
  emptyCorner.className = 'hm-header-cell';
  emptyCorner.textContent = 'Dia / Hora';
  container.appendChild(emptyCorner);

  for (let h = 0; h < 24; h++) {
    const hCell = document.createElement('div');
    hCell.className = 'hm-header-cell';
    hCell.textContent = `${h}h`;
    container.appendChild(hCell);
  }

  // Linhas dos Dias da Semana
  const dias = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

  dias.forEach((dia, dayIdx) => {
    // Rótulo do Dia
    const dayLabel = document.createElement('div');
    dayLabel.className = 'hm-day-label';
    dayLabel.textContent = dia;
    container.appendChild(dayLabel);

    // 24 Células de Horas
    for (let h = 0; h < 24; h++) {
      const cellData = hm[dayIdx]?.[h] || { spend: 0, clicks: 0, leads: 0 };
      const val = cellData[metric] || 0;
      const intensity = val / maxVal;

      const cell = document.createElement('div');
      cell.className = 'hm-cell';

      // Cor verde com opacidade baseada na intensidade
      if (val > 0) {
        cell.style.backgroundColor = `rgba(0, 230, 118, ${Math.max(0.12, intensity * 0.9)})`;
        cell.style.color = intensity > 0.4 ? '#000' : '#fff';
        if (intensity > 0.7) {
          cell.style.boxShadow = '0 0 8px rgba(0, 230, 118, 0.4)';
        }
      } else {
        cell.style.backgroundColor = 'rgba(255, 255, 255, 0.02)';
        cell.style.color = '#4b5563';
      }

      let displayVal = '';
      if (metric === 'spend' && val > 0) displayVal = Math.round(val);
      else if (val > 0) displayVal = val;

      cell.textContent = displayVal;
      cell.title = `${dia}, ${h}:00h — Gasto: R$ ${cellData.spend.toFixed(2)} | Cliques: ${cellData.clicks} | Leads: ${cellData.leads}`;

      container.appendChild(cell);
    }
  });
}

// ==========================================================================
// ABA 5: DIAGNÓSTICO E ALERTAS EM PORTUGUÊS
// ==========================================================================
function renderDiagnostics() {
  const container = document.getElementById('diagnosticsList');
  if (!container || !state.dados) return;

  container.innerHTML = '';
  const avisos = state.dados.avisos || [];

  const badge = document.getElementById('diagAlertCountBadge');
  if (avisos.length > 0) {
    badge.textContent = avisos.length;
    badge.style.display = 'inline-block';
  } else {
    badge.style.display = 'none';
  }

  if (avisos.length === 0) {
    container.innerHTML = `
      <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 2rem; text-align: center;">
        <div style="font-size: 1.5rem; margin-bottom: 0.5rem; color: var(--primary-neon);">✓</div>
        <div style="font-size: 1.1rem; font-weight: 700; color: #fff;">Nenhum problema crítico detectado</div>
        <div style="color: var(--text-dim); font-size: 0.85rem; margin-top: 0.25rem;">Sua conta de anúncios está rodando de forma saudável no período selecionado.</div>
      </div>
    `;
    return;
  }

  avisos.forEach((aviso) => {
    const card = document.createElement('div');
    card.className = `diag-card ${aviso.tipo}`;

    let iconSvg = '';
    if (aviso.tipo === 'alerta') {
      iconSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"></polygon><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
    } else if (aviso.tipo === 'atencao') {
      iconSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;
    } else {
      iconSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    }

    card.innerHTML = `
      <div class="diag-icon-box">${iconSvg}</div>
      <div class="diag-content">
        <div class="diag-title">${aviso.titulo}</div>
        <div class="diag-desc">${aviso.descricao}</div>
        <div class="diag-action-box">
          <strong>Ação Recomendada:</strong> ${aviso.acao}
        </div>
      </div>
    `;

    container.appendChild(card);
  });
}
