import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/Header';
import { getDashboardMetrics, type DashboardMetrics } from '../api/dashboard';
import { getClients, getPayments } from '../api/db';
import type { Client, Payment } from '../types';
import { 
  Zap, Wallet, Activity, ArrowRightLeft, CheckCircle2, TrendingUp, Target, 
  PieChart, Star, Calendar, AlertTriangle, Users, FileText, ShieldAlert
} from 'lucide-react';

type DashboardTab = 'pulso' | 'carteira' | 'inteligencia';

export default function Dashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [recentPayments, setRecentPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<DashboardTab>('pulso');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [m, c, p] = await Promise.all([ getDashboardMetrics(), getClients(), getPayments() ]);
        setMetrics(m);
        setClients(c);
        setRecentPayments(p.slice(0, 8));
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    fetchData();
  }, []);

  const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  if (loading || !metrics) return (
    <div className="flex-col pb-24 h-full">
      <Header title="" />
      <div className="page" style={{ gap: 20 }}>
        <div className="skeleton" style={{ height: 180, borderRadius: 28 }} />
        <div className="skeleton" style={{ height: 100, borderRadius: 20 }} />
        <div className="skeleton" style={{ height: 100, borderRadius: 20 }} />
      </div>
    </div>
  );

  const inadimRate = metrics.taxaInadimplencia;

  return (
    <div className="flex-col pb-24 h-full">
      <Header title="SISTEMA DE GESTÃO" />

      <div style={{ padding: '8px 16px 4px' }}>
        <div className="tab-bar" style={{ background: 'rgba(0,0,0,0.05)', padding: 6 }}>
          {([['pulso', Zap, 'PULSO'], ['carteira', Wallet, 'CARTEIRA'], ['inteligencia', Activity, 'ANÁLISE']] as [DashboardTab, any, string][]).map(([t, Icon, l]) => (
            <button key={t} className={`tab-btn ${activeTab === t ? 'active' : ''}`} onClick={() => setActiveTab(t)}>
               <Icon size={14} style={{ marginRight: 6 }} /> {l}
            </button>
          ))}
        </div>
      </div>

      <div className="page-content">
        <div className="page" style={{ paddingTop: 8, gap: 20 }}>
          
          {/* ════════════════════════════════════════════════
              TAB: PULSO — Visão do dia a dia em tempo real
             ════════════════════════════════════════════════ */}
          {activeTab === 'pulso' && (
            <div className="flex-col fade-in" style={{ gap: 20 }}>
              
              {/* HERO: Volume Hoje */}
              <div className="hero-card shadow-glow">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                   <div>
                     <p style={{ fontSize: 10, fontWeight: 900, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '1px' }}>RECEBIDO HOJE</p>
                     <h1 style={{ fontSize: 40, fontWeight: 950, letterSpacing: '-2px' }}>{fmt(metrics.totalRecebidoHoje)}</h1>
                   </div>
                   <div style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.15)', borderRadius: 12, textAlign: 'center' }}>
                      <p style={{ fontSize: 9, fontWeight: 800 }}>META</p>
                      <p style={{ fontSize: 13, fontWeight: 950 }}>{fmt(metrics.totalAReceberHoje)}</p>
                   </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.15)' }}>
                  <div><p style={{ fontSize: 9, fontWeight: 850, opacity: 0.6 }}>COBRAR HOJE</p><p style={{ fontSize: 14, fontWeight: 950 }}>{metrics.clientesParaCobrarHoje} clientes</p></div>
                  <div style={{ textAlign: 'center' }}><p style={{ fontSize: 9, fontWeight: 850, opacity: 0.6 }}>SEMANA</p><p style={{ fontSize: 14, fontWeight: 950 }}>{fmt(metrics.recebimentosSemana)}</p></div>
                  <div style={{ textAlign: 'right' }}><p style={{ fontSize: 9, fontWeight: 850, opacity: 0.6 }}>STATUS</p><p style={{ fontSize: 12, fontWeight: 950 }}>{metrics.totalRecebidoHoje >= metrics.totalAReceberHoje ? '🎯 META OK' : '⚡ OPERANDO'}</p></div>
                </div>
              </div>

              {/* Mini KPIs rápidos */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                 <div className="stat-card" style={{ borderTop: '4px solid var(--color-accent)', padding: '16px 14px' }}>
                    <p style={{ fontSize: 22, fontWeight: 950, color: 'var(--color-accent)' }}>{metrics.totalContratosAtivos}</p>
                    <p className="input-label" style={{ fontSize: 9 }}>Contratos Ativos</p>
                 </div>
                 <div className="stat-card" style={{ borderTop: `4px solid ${metrics.totalParcelasAtrasadas > 0 ? 'var(--color-danger)' : 'var(--color-success)'}`, padding: '16px 14px' }}>
                    <p style={{ fontSize: 22, fontWeight: 950, color: metrics.totalParcelasAtrasadas > 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>{metrics.totalParcelasAtrasadas}</p>
                    <p className="input-label" style={{ fontSize: 9 }}>Em Atraso</p>
                 </div>
                 <div className="stat-card" style={{ borderTop: '4px solid var(--color-success)', padding: '16px 14px' }}>
                    <p style={{ fontSize: 22, fontWeight: 950, color: 'var(--color-success)' }}>{metrics.totalParcelasPagas}</p>
                    <p className="input-label" style={{ fontSize: 9 }}>Parc. Pagas</p>
                 </div>
              </div>

              {/* Alerta de Atraso */}
              {metrics.totalAtraso > 0 && (
                <div className="card" style={{ background: '#FEF2F2', border: '1.5px solid #FECACA', padding: '16px 20px', gap: 14 }}>
                   <div style={{ width: 40, height: 40, borderRadius: 12, background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <AlertTriangle size={20} color="#EF4444" />
                   </div>
                   <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: 900, fontSize: 14, color: '#991B1B' }}>Atenção: {fmt(metrics.totalAtraso)} em atraso</p>
                      <p style={{ fontSize: 11, color: '#B91C1C' }}>{metrics.totalParcelasAtrasadas} parcela(s) vencida(s) de {metrics.clientesInadimplentes.length} cliente(s)</p>
                   </div>
                </div>
              )}

              {/* Agenda da Semana */}
              <div className="card flex-col" style={{ gap: 14, padding: '20px' }}>
                 <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Calendar size={16} color="var(--color-accent)" />
                    <p style={{ fontWeight: 950, fontSize: 14 }}>Agenda da Semana</p>
                 </div>
                 <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: 80, gap: 6 }}>
                    {metrics.fluxoSemanal.map((f, i) => {
                       const maxVal = Math.max(...metrics.fluxoSemanal.map(x => x.valor), 1);
                       const h = Math.max(8, (f.valor / maxVal) * 70);
                       return (
                         <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                            <p style={{ fontSize: 8, fontWeight: 800, color: 'var(--color-text-muted)' }}>{f.valor > 0 ? fmt(f.valor) : '—'}</p>
                            <div style={{ width: '100%', height: h, background: i === 0 ? 'var(--color-accent)' : 'var(--color-accent-light)', borderRadius: 4 }} />
                            <p style={{ fontSize: 9, fontWeight: 950 }}>{f.dia}</p>
                         </div>
                       );
                    })}
                 </div>
                 <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 10, borderTop: '1px solid var(--color-border)' }}>
                    <div><p style={{ fontSize: 9, fontWeight: 800, color: 'var(--color-text-muted)' }}>PARCELAS ESSA SEMANA</p><p style={{ fontSize: 14, fontWeight: 950 }}>{metrics.parcelasVencemEssaSemana}</p></div>
                    <div style={{ textAlign: 'right' }}><p style={{ fontSize: 9, fontWeight: 800, color: 'var(--color-text-muted)' }}>PREVISÃO 7D</p><p style={{ fontSize: 14, fontWeight: 950, color: 'var(--color-success)' }}>{fmt(metrics.projecao7Dias)}</p></div>
                 </div>
              </div>

              {/* Entradas Recentes */}
              <div className="flex-col" style={{ gap: 12 }}>
                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                       <ArrowRightLeft size={16} color="var(--color-accent)" />
                       <p style={{ fontSize: 12, fontWeight: 950, textTransform: 'uppercase', letterSpacing: '1.5px' }}>Últimas Entradas</p>
                    </div>
                    <Link to="/relatorios" style={{ fontSize: 11, fontWeight: 900, color: 'var(--color-accent)' }}>Ver todos</Link>
                 </div>
                 <div className="flex-col" style={{ gap: 8 }}>
                    {recentPayments.length > 0 ? recentPayments.map(p => {
                       const client = clients.find(c => c.id === p.client_id);
                       return (
                         <div key={p.id} className="row-item" style={{ padding: '12px 16px', background: '#fff' }}>
                            <div className="avatar" style={{ width: 38, height: 38, background: p.type === 'quitacao' ? 'var(--color-success)' : 'var(--color-accent-light)', fontSize: 13 }}>
                               {p.type === 'quitacao' ? <CheckCircle2 size={14} color="#fff" /> : client?.name.charAt(0)}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                               <p style={{ fontWeight: 900, fontSize: 13 }}>{client?.name}</p>
                               <p style={{ fontSize: 9, color: 'var(--color-text-muted)' }}>{p.type === 'quitacao' ? 'QUITAÇÃO' : 'PAGAMENTO'} • {new Date(p.date).toLocaleDateString('pt-BR')}</p>
                            </div>
                            <p style={{ fontWeight: 950, color: 'var(--color-success)', fontSize: 14 }}>+{fmt(Number(p.amount))}</p>
                         </div>
                       );
                    }) : (
                      <div className="stat-card" style={{ padding: '30px', alignItems: 'center', background: 'transparent', border: '2px dashed var(--color-border)' }}>
                         <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-muted)' }}>Nenhuma entrada registrada.</p>
                      </div>
                    )}
                 </div>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════
              TAB: CARTEIRA — Patrimônio e clientes
             ════════════════════════════════════════════════ */}
          {activeTab === 'carteira' && (
            <div className="flex-col fade-in" style={{ gap: 20 }}>
               
               {/* Hero Patrimônio */}
               <div className="hero-card shadow-glow" style={{ background: 'var(--color-text-primary)' }}>
                  <p style={{ fontSize: 10, fontWeight: 900, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: 4 }}>PATRIMÔNIO EM CIRCULAÇÃO</p>
                  <h1 style={{ fontSize: 38, fontWeight: 950, letterSpacing: '-2px' }}>{fmt(metrics.totalCapitalEmprestado)}</h1>
                  <div style={{ marginTop: 20, padding: '14px', background: 'rgba(255,255,255,0.08)', borderRadius: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                     <div><p style={{ fontSize: 9, fontWeight: 800, opacity: 0.6 }}>RETORNO BRUTO</p><p style={{ fontSize: 15, fontWeight: 950, color: '#fff' }}>{fmt(metrics.totalRetornoEsperado)}</p></div>
                     <div style={{ textAlign: 'right' }}><p style={{ fontSize: 9, fontWeight: 800, opacity: 0.6 }}>SPREAD</p><p style={{ fontSize: 15, fontWeight: 950, color: '#10B981' }}>+{fmt(metrics.lucroProjetado)}</p></div>
                  </div>
               </div>

               {/* Números Globais */}
               <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div className="stat-card" style={{ padding: '16px', borderTop: '4px solid var(--color-accent)' }}>
                     <Users size={18} color="var(--color-accent)" />
                     <p style={{ fontSize: 22, fontWeight: 950 }}>{metrics.totalClientes}</p>
                     <p className="input-label" style={{ fontSize: 9 }}>Clientes Total</p>
                  </div>
                  <div className="stat-card" style={{ padding: '16px', borderTop: '4px solid var(--color-success)' }}>
                     <FileText size={18} color="var(--color-success)" />
                     <p style={{ fontSize: 22, fontWeight: 950 }}>{metrics.totalContratosGeral}</p>
                     <p className="input-label" style={{ fontSize: 9 }}>Contratos (Todos)</p>
                  </div>
               </div>
               <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  <div className="card flex-col" style={{ padding: '14px', alignItems: 'center', gap: 4 }}>
                     <p style={{ fontSize: 18, fontWeight: 950, color: 'var(--color-accent)' }}>{metrics.totalContratosAtivos}</p>
                     <p style={{ fontSize: 9, fontWeight: 800, color: 'var(--color-text-muted)' }}>ATIVOS</p>
                  </div>
                  <div className="card flex-col" style={{ padding: '14px', alignItems: 'center', gap: 4 }}>
                     <p style={{ fontSize: 18, fontWeight: 950, color: 'var(--color-success)' }}>{metrics.totalContratosQuitados}</p>
                     <p style={{ fontSize: 9, fontWeight: 800, color: 'var(--color-text-muted)' }}>QUITADOS</p>
                  </div>
                  <div className="card flex-col" style={{ padding: '14px', alignItems: 'center', gap: 4 }}>
                     <p style={{ fontSize: 18, fontWeight: 950 }}>{metrics.contratosEsteMes}</p>
                     <p style={{ fontSize: 9, fontWeight: 800, color: 'var(--color-text-muted)' }}>ESTE MÊS</p>
                  </div>
               </div>

               {/* Mix de Modalidades */}
               <div className="card flex-col" style={{ gap: 14, padding: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><PieChart size={16} color="var(--color-accent)" /><p style={{ fontWeight: 950, fontSize: 14 }}>Mix de Modalidades</p></div>
                  <div style={{ display: 'flex', height: 10, borderRadius: 99, overflow: 'hidden', background: 'var(--color-bg)' }}>
                     {metrics.mixCarteira.filter(m => m.value > 0).map((m, i) => (<div key={i} style={{ width: `${(m.value / Math.max(1, metrics.mixCarteira.reduce((a, x) => a + x.value, 0))) * 100}%`, background: m.color }} />))}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                     {metrics.mixCarteira.map((m, i) => (<div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ width: 8, height: 8, borderRadius: 2, background: m.color }} /><p style={{ fontSize: 11, fontWeight: 800 }}>{m.label}: {m.value}</p></div>))}
                  </div>
               </div>

               {/* Top Pagadores */}
               <div className="card flex-col" style={{ gap: 12, padding: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Star size={16} color="#F59E0B" fill="#F59E0B" /><p style={{ fontWeight: 950, fontSize: 14 }}>Top 5 Pagadores</p></div>
                  {metrics.rankingFidelidade.map((c, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--color-bg)', borderRadius: 14 }}>
                       <div style={{ width: 26, height: 26, borderRadius: 99, background: i === 0 ? '#F59E0B' : i === 1 ? '#94A3B8' : '#CBD5E1', color: '#fff', textAlign: 'center', fontSize: 11, lineHeight: '26px', fontWeight: 950 }}>{i + 1}</div>
                       <p style={{ flex: 1, fontWeight: 900, fontSize: 13 }}>{c.name}</p>
                       <p style={{ fontSize: 11, fontWeight: 800, color: 'var(--color-success)' }}>{c.score} pagtos</p>
                    </div>
                  ))}
               </div>

               {/* Maiores Devedores */}
               {metrics.maioresDevedores.length > 0 && (
               <div className="card flex-col" style={{ gap: 12, padding: '20px', border: '1.5px solid #FECACA' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><ShieldAlert size={16} color="#EF4444" /><p style={{ fontWeight: 950, fontSize: 14, color: '#991B1B' }}>Maiores Devedores</p></div>
                  {metrics.maioresDevedores.map((c, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#FEF2F2', borderRadius: 14 }}>
                       <div style={{ width: 26, height: 26, borderRadius: 99, background: '#EF4444', color: '#fff', textAlign: 'center', fontSize: 11, lineHeight: '26px', fontWeight: 950 }}>{i + 1}</div>
                       <p style={{ flex: 1, fontWeight: 900, fontSize: 13 }}>{c.name}</p>
                       <p style={{ fontSize: 12, fontWeight: 900, color: '#DC2626' }}>{fmt(c.aberto)}</p>
                    </div>
                  ))}
               </div>
               )}
            </div>
          )}

          {/* ════════════════════════════════════════════════
              TAB: ANÁLISE — Inteligência financeira
             ════════════════════════════════════════════════ */}
          {activeTab === 'inteligencia' && (
            <div className="flex-col fade-in" style={{ gap: 20 }}>
               
               {/* Lucro Realizado */}
               <div className="card flex-col" style={{ gap: 12, padding: '24px', background: '#fff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div>
                       <p style={{ fontSize: 10, fontWeight: 950, color: 'var(--color-text-muted)' }}>LUCRO REALIZADO TOTAL</p>
                       <h3 style={{ fontSize: 30, fontWeight: 950, marginTop: 4, color: metrics.lucroRealizado >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>{fmt(metrics.lucroRealizado)}</h3>
                    </div>
                    <Target size={36} color="var(--color-success)" opacity={0.2} />
                  </div>
                  <p style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>Recebi {fmt(metrics.totalGlobalRecebido)} - Emprestei {fmt(metrics.totalGlobalEmprestado)}</p>
               </div>

               {/* Recebimentos Mês vs Semana */}
               <div className="grid-2">
                  <div className="card flex-col" style={{ padding: '18px', gap: 6 }}>
                     <p style={{ fontSize: 9, fontWeight: 850, color: 'var(--color-text-muted)' }}>RECEBIDO ESTE MÊS</p>
                     <p style={{ fontSize: 20, fontWeight: 950, color: 'var(--color-success)' }}>{fmt(metrics.recebimentosMes)}</p>
                  </div>
                  <div className="card flex-col" style={{ padding: '18px', gap: 6 }}>
                     <p style={{ fontSize: 9, fontWeight: 850, color: 'var(--color-text-muted)' }}>RECEBIDO ESTA SEMANA</p>
                     <p style={{ fontSize: 20, fontWeight: 950, color: 'var(--color-accent)' }}>{fmt(metrics.recebimentosSemana)}</p>
                  </div>
               </div>

               {/* Projeções */}
               <div className="grid-2">
                  <div className="card flex-col" style={{ padding: '18px', gap: 6 }}><TrendingUp size={18} color="var(--color-success)" /><div><p style={{ fontSize: 9, fontWeight: 850 }}>PROJEÇÃO 30D</p><p style={{ fontSize: 16, fontWeight: 950 }}>{fmt(metrics.projecao30Dias)}</p></div></div>
                  <div className="card flex-col" style={{ padding: '18px', gap: 6 }}><Activity size={18} color="var(--color-accent)" /><div><p style={{ fontSize: 9, fontWeight: 850 }}>TICKET MÉDIO</p><p style={{ fontSize: 16, fontWeight: 950 }}>{fmt(metrics.ticketMedio)}</p></div></div>
               </div>

               {/* Saúde da Carteira */}
               <div className="card flex-col" style={{ gap: 16, padding: '20px' }}>
                  <p style={{ fontWeight: 950, fontSize: 14 }}>Saúde da Operação</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                     <div style={{ padding: '12px', background: 'var(--color-bg)', borderRadius: 14 }}>
                        <p style={{ fontSize: 9, fontWeight: 800, color: 'var(--color-text-muted)' }}>CAPITAL NA RUA</p>
                        <p style={{ fontSize: 15, fontWeight: 950 }}>{fmt(metrics.totalGlobalAberto)}</p>
                     </div>
                     <div style={{ padding: '12px', background: inadimRate > 30 ? '#FEF2F2' : '#F0FDF4', borderRadius: 14 }}>
                        <p style={{ fontSize: 9, fontWeight: 800, color: inadimRate > 30 ? '#DC2626' : '#059669' }}>INADIMPLÊNCIA</p>
                        <p style={{ fontSize: 15, fontWeight: 950, color: inadimRate > 30 ? '#DC2626' : '#059669' }}>{inadimRate.toFixed(1)}%</p>
                     </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                     <div style={{ padding: '12px', background: 'var(--color-bg)', borderRadius: 14 }}>
                        <p style={{ fontSize: 9, fontWeight: 800, color: 'var(--color-text-muted)' }}>PARCELAS ABERTAS</p>
                        <p style={{ fontSize: 15, fontWeight: 950 }}>{metrics.totalParcelasAbertas}</p>
                     </div>
                     <div style={{ padding: '12px', background: 'var(--color-bg)', borderRadius: 14 }}>
                        <p style={{ fontSize: 9, fontWeight: 800, color: 'var(--color-text-muted)' }}>PARCELAS PAGAS</p>
                        <p style={{ fontSize: 15, fontWeight: 950, color: 'var(--color-success)' }}>{metrics.totalParcelasPagas}</p>
                     </div>
                  </div>
               </div>

               {/* Clientes com Atraso */}
               {metrics.clientesInadimplentes.length > 0 && (
               <div className="card flex-col" style={{ gap: 12, padding: '20px', border: '1.5px solid #FECACA' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><AlertTriangle size={16} color="#EF4444" /><p style={{ fontWeight: 950, fontSize: 14, color: '#991B1B' }}>Clientes com Atraso</p></div>
                  {metrics.clientesInadimplentes.map((c, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#FEF2F2', borderRadius: 14 }}>
                       <p style={{ flex: 1, fontWeight: 900, fontSize: 13 }}>{c.name}</p>
                       <p style={{ fontSize: 12, fontWeight: 900, color: '#DC2626' }}>{fmt(c.valor)}</p>
                    </div>
                  ))}
               </div>
               )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
