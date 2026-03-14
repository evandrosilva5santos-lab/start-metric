import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  DollarSign, 
  ArrowUpRight, 
  ArrowDownRight,
  Zap,
  LayoutDashboard,
  Target,
  Settings,
  HelpCircle,
  Bell,
  Search,
  User
} from "lucide-react";

export default function DashboardHome() {
  return (
    <div className="flex h-screen bg-[#09090b] text-[#fafafa]">
      {/* Sidebar Mockup */}
      <aside className="w-64 border-r border-[#27272a] p-6 hidden md:flex flex-col gap-8">
        <div className="flex items-center gap-2 px-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-[0_0_15px_rgba(99,102,241,0.5)]">
            <TrendingUp size={18} className="text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight">Start Metric</span>
        </div>

        <nav className="flex flex-col gap-2">
          <NavItem icon={<LayoutDashboard size={20} />} label="Dashboard" active />
          <NavItem icon={<Target size={20} />} label="Meta Ads" />
          <NavItem icon={<BarChart3 size={20} />} label="Relatórios" />
          <NavItem icon={<Users size={20} />} label="Leads" />
        </nav>

        <div className="mt-auto flex flex-col gap-2">
          <NavItem icon={<Settings size={20} />} label="Ajustes" />
          <NavItem icon={<HelpCircle size={20} />} label="Suporte" />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {/* Topbar */}
        <header className="h-16 border-b border-[#27272a] px-8 flex items-center justify-between sticky top-0 bg-[#09090b]/80 backdrop-blur-md z-10">
          <div className="relative w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#71717a]" size={16} />
            <input 
              type="text" 
              placeholder="Pesquisar por leads ou campanhas..." 
              className="w-full bg-[#18181b] border border-[#27272a] rounded-full py-1.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all font-light"
            />
          </div>

          <div className="flex items-center gap-4">
            <button className="relative p-2 rounded-full hover:bg-[#27272a] transition-colors">
              <Bell size={20} className="text-[#a1a1aa]" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-indigo-500 rounded-full border-2 border-[#09090b]"></span>
            </button>
            <div className="flex items-center gap-3 pl-4 border-l border-[#27272a]">
              <div className="w-8 h-8 rounded-full bg-[#27272a] flex items-center justify-center border border-[#3f3f46]">
                <User size={18} className="text-[#fafafa]" />
              </div>
              <div className="hidden sm:block text-right">
                <p className="text-sm font-medium leading-none">Evandro Santos</p>
                <p className="text-xs text-[#a1a1aa] mt-1">Admin Account</p>
              </div>
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="p-8 max-w-7xl mx-auto space-y-8">
          {/* Header Section */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-indigo-400">Visão Geral da Performance</p>
              <h1 className="text-4xl font-bold tracking-tight mt-1">Sua Conta Meta Ads</h1>
            </div>
            <div className="flex items-center gap-3">
              <div className="bg-[#18181b] border border-[#27272a] rounded-lg p-2 text-sm font-medium flex items-center gap-2 px-4 shadow-sm">
                <span>Últimos 7 dias</span>
                <ArrowDownRight size={14} className="text-[#a1a1aa]" />
              </div>
              <button className="bg-white text-[#09090b] text-sm font-bold px-6 py-2 rounded-lg hover:bg-white/90 transition-all shadow-lg active:scale-95">
                Exportar Dados
              </button>
            </div>
          </div>

          {/* KPI Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <KPICard 
              title="Gasto Total" 
              value="R$ 12.450,00" 
              trend="+12.5%" 
              trendUp={true} 
              icon={<DollarSign size={20} />} 
              color="indigo"
            />
            <KPICard 
              title="Leads Gerados" 
              value="842" 
              trend="+5.2%" 
              trendUp={true} 
              icon={<Users size={20} />} 
              color="blue"
            />
            <KPICard 
              title="ROAS Atual" 
              value="4.2x" 
              trend="-2.1%" 
              trendUp={false} 
              icon={<Zap size={20} />} 
              color="purple"
            />
            <KPICard 
              title="CPA Médio" 
              value="R$ 14,78" 
              trend="-8.3%" 
              trendUp={true} 
              icon={<Target size={20} />} 
              color="emerald"
            />
          </div>

          {/* Analytics Overview Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Chart Area Mockup */}
            <div className="lg:col-span-2 bg-[#18181b] border border-[#27272a] rounded-2xl p-6 shadow-xl overflow-hidden relative group">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-lg font-semibold tracking-tight uppercase text-indigo-400/80 text-[10px] tracking-widest">Tracking de Vendas vs Leads</h3>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5 text-xs text-[#a1a1aa]">
                    <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                    Leads
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-[#a1a1aa]">
                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                    Vendas
                  </div>
                </div>
              </div>
              
              <div className="h-[300px] flex items-end justify-between gap-3 relative">
                {/* Visual Placeholder for a graph */}
                {[...Array(12)].map((_, i) => (
                  <div key={i} className="flex-1 flex flex-col justify-end gap-1 items-center group/bar">
                    <div 
                      className="w-full bg-emerald-500/20 rounded-t-sm transition-all group-hover/bar:bg-emerald-500/40" 
                      style={{ height: `${Math.random() * 40 + 20}%` }}
                    ></div>
                    <div 
                      className="w-full bg-indigo-500/40 rounded-t-sm transition-all group-hover/bar:bg-indigo-500/60" 
                      style={{ height: `${Math.random() * 40 + 30}%` }}
                    ></div>
                  </div>
                ))}
              </div>
              
              <div className="absolute inset-0 bg-gradient-to-t from-[#18181b] via-transparent to-transparent opacity-50"></div>
            </div>

            {/* List area mockup */}
            <div className="bg-[#18181b] border border-[#27272a] rounded-2xl p-6 shadow-xl">
              <h3 className="text-lg font-semibold tracking-tight uppercase text-indigo-400/80 text-[10px] tracking-widest mb-6">Últimos Leads Qualificados</h3>
              <div className="space-y-4">
                <LeadItem name="Mariana Rocha" source="Meta Ads — Campanha Top" amount="R$ 1.250" status="Vendido" />
                <LeadItem name="João Fonseca" source="WhatsApp Hub" amount="R$ 497" status="Lead Frio" />
                <LeadItem name="Beatriz Silva" source="Instagram Story" amount="R$ 890" status="Negociação" />
                <LeadItem name="Ricardo Gomes" source="Google Search" amount="R$ 2.450" status="Vendido" />
                <LeadItem name="Carlos Oliveira" source="Facebook Video" amount="R$ 300" status="Lead Frio" />
              </div>
              <button className="w-full mt-6 py-2.5 text-xs font-semibold text-[#a1a1aa] hover:text-[#fafafa] transition-colors border border-dashed border-[#27272a] rounded-xl hover:bg-[#27272a]">
                Ver Todos os Leads
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function NavItem({ icon, label, active = false }: { icon: React.ReactNode, label: string, active?: boolean }) {
  return (
    <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-not-allowed transition-all ${
      active ? "bg-indigo-500/10 text-indigo-400 border-l-2 border-indigo-500" : "text-[#a1a1aa] hover:bg-[#18181b] hover:text-[#fafafa]"
    }`}>
      {icon}
      <span className="text-sm font-medium">{label}</span>
    </div>
  );
}

function KPICard({ title, value, trend, trendUp, icon, color }: any) {
  const colorMap: any = {
    indigo: "from-indigo-500/10 text-indigo-400",
    blue: "from-blue-500/10 text-blue-400",
    purple: "from-purple-500/10 text-purple-400",
    emerald: "from-emerald-500/10 text-emerald-400"
  };

  return (
    <div className="bg-[#18181b] border border-[#27272a] p-6 rounded-2xl shadow-xl hover:shadow-indigo-500/5 transition-all group overflow-hidden relative">
      <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${colorMap[color]} blur-3xl opacity-20 -mr-8 -mt-8`}></div>
      <div className="flex justify-between items-start mb-4 relative z-10">
        <div className={`p-2.5 rounded-xl bg-[#27272a] border border-[#3f3f46] text-[#fafafa] shadow-inner group-hover:scale-110 transition-transform`}>
          {icon}
        </div>
        <div className={`flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${
          trendUp ? "text-emerald-400 bg-emerald-500/10" : "text-rose-400 bg-rose-500/10"
        }`}>
          {trendUp ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
          {trend}
        </div>
      </div>
      <div className="relative z-10">
        <p className="text-xs text-[#a1a1aa] uppercase tracking-wider font-semibold">{title}</p>
        <p className="text-2xl font-bold mt-1 tracking-tight text-[#fafafa]">{value}</p>
      </div>
    </div>
  );
}

function LeadItem({ name, source, amount, status }: any) {
  const statusColors: any = {
    "Vendido": "bg-emerald-500",
    "Negociação": "bg-amber-500",
    "Lead Frio": "bg-slate-500"
  };

  return (
    <div className="flex items-center justify-between p-3 rounded-xl hover:bg-[#27272a]/50 transition-colors border border-transparent hover:border-[#27272a]">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#27272a] to-[#09090b] flex items-center justify-center text-[10px] font-bold border border-[#3f3f46]">
          {name.charAt(0)}
        </div>
        <div>
          <p className="text-sm font-medium leading-none mb-1">{name}</p>
          <p className="text-[10px] text-[#a1a1aa] uppercase tracking-tighter">{source}</p>
        </div>
      </div>
      <div className="text-right">
        <div className="flex items-center gap-2 justify-end">
          <span className={`w-1.5 h-1.5 rounded-full ${statusColors[status]}`}></span>
          <span className="text-[10px] font-semibold text-[#a1a1aa] uppercase tracking-wider">{status}</span>
        </div>
        <p className="text-xs font-bold mt-0.5">{amount}</p>
      </div>
    </div>
  );
}
