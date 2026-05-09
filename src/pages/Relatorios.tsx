import { useState, useEffect } from 'react';
import Header from '../components/Header';
import { getClients, getPayments, getOperations, getInstallments, exportCompleteDatabase } from '../api/db';
import type { Payment, Client, CreditOperation, Installment } from '../types';
import { Filter, Printer, Database } from 'lucide-react';

export default function Relatorios() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [operations, setOperations] = useState<CreditOperation[]>([]);
  const [installments, setInstallments] = useState<Installment[]>([]);
  
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const [p, c, o, i] = await Promise.all([ getPayments(), getClients(), getOperations(), getInstallments() ]);
        setPayments(p);
        setClients(c);
        setOperations(o);
        setInstallments(i);
        const today = new Date();
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        setStartDate(firstDay.toISOString().split('T')[0]);
        setEndDate(today.toISOString().split('T')[0]);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    fetch();
  }, []);

  const preset = (days: number) => {
    const today = new Date();
    const past = new Date(); past.setDate(today.getDate() - days);
    setStartDate(past.toISOString().split('T')[0]);
    setEndDate(today.toISOString().split('T')[0]);
  };

  const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
  const fmtDate = (s: string) => new Date(s).toLocaleDateString('pt-BR');
  const pct = (a: number, b: number) => b === 0 ? '0%' : ((a / b) * 100).toFixed(1) + '%';

  // ─── FILTROS DE PERÍODO ─────────────────────────────────────
  const sDate = new Date(startDate); sDate.setHours(0,0,0,0);
  const eDate = new Date(endDate); eDate.setHours(23,59,59,999);

  const filteredPayments = payments.filter(p => {
    const d = new Date(p.date); return d >= sDate && d <= eDate;
  });
  const filteredOperations = operations.filter(o => {
    const d = new Date(o.created_at); return d >= sDate && d <= eDate;
  });

  // ─── KPIs DO PERÍODO ────────────────────────────────────────
  const totalRecebidoPeriodo = filteredPayments.reduce((a, p) => a + Number(p.amount), 0);
  const totalEmprestadoPeriodo = filteredOperations.reduce((a, o) => a + Number(o.principal_amount), 0);
  const lucroBrutoPeriodo = filteredOperations.reduce((a, o) => a + (Number(o.total_amount) - Number(o.principal_amount)), 0);
  const quitacoesPeriodo = filteredPayments.filter(p => p.type === 'quitacao');
  const totalQuitadoPeriodo = quitacoesPeriodo.reduce((a, p) => a + Number(p.amount), 0);
  const pagamentosNormaisPeriodo = filteredPayments.filter(p => p.type !== 'quitacao');
  const totalNormalPeriodo = pagamentosNormaisPeriodo.reduce((a, p) => a + Number(p.amount), 0);
  const ticketMedioPeriodo = filteredPayments.length > 0 ? totalRecebidoPeriodo / filteredPayments.length : 0;

  // ─── KPIs GLOBAIS ───────────────────────────────────────────
  const totalGlobalEmprestado = operations.reduce((a, o) => a + Number(o.principal_amount), 0);
  const totalGlobalRetorno = operations.reduce((a, o) => a + Number(o.total_amount), 0);
  const totalGlobalRecebido = payments.reduce((a, p) => a + Number(p.amount), 0);
  const totalGlobalAberto = clients.reduce((a, c) => a + Number(c.total_open), 0);
  const lucroRealizadoGlobal = totalGlobalRecebido - totalGlobalEmprestado;
  const contratosAtivos = operations.filter(o => o.status === 'ativa' || o.status === 'atrasada').length;
  const contratosQuitados = operations.filter(o => o.status === 'quitada').length;
  
  // ─── INADIMPLÊNCIA ──────────────────────────────────────────
  const today = new Date(); today.setHours(0,0,0,0);
  const parcelasAtrasadas = installments.filter(i => {
    if (i.status === 'paga' || i.status === 'cancelada' || i.status === 'renegociada') return false;
    const due = new Date(i.due_date); due.setHours(0,0,0,0);
    return due < today;
  });
  const valorTotalAtrasado = parcelasAtrasadas.reduce((a, i) => a + (Number(i.amount) - Number(i.amount_paid)), 0);
  const totalParcelasAbertas = installments.filter(i => i.status === 'pendente' || i.status === 'parcial' || i.status === 'atrasada').length;
  const taxaInadimplencia = totalParcelasAbertas > 0 ? ((parcelasAtrasadas.length / totalParcelasAbertas) * 100).toFixed(1) : '0.0';

  // ─── RANKING DE CLIENTES ────────────────────────────────────
  const clientRanking = clients.map(c => {
    const clientOps = operations.filter(o => o.client_id === c.id);
    const clientPays = payments.filter(p => p.client_id === c.id);
    const totalMovimentado = clientOps.reduce((a, o) => a + Number(o.total_amount), 0);
    const totalPago = clientPays.reduce((a, p) => a + Number(p.amount), 0);
    const atrasadas = parcelasAtrasadas.filter(i => i.client_id === c.id).length;
    return { ...c, totalMovimentado, totalPago, contratos: clientOps.length, atrasadas };
  }).sort((a, b) => b.totalMovimentado - a.totalMovimentado);

  // ─── DETALHAMENTO POR CONTRATO ──────────────────────────────
  const detailedContracts = filteredOperations.map(op => {
    const cl = clients.find(c => c.id === op.client_id);
    const insts = installments.filter(i => i.operation_id === op.id);
    const pagas = insts.filter(i => i.status === 'paga').length;
    const atrasadas = insts.filter(i => {
      if (i.status === 'paga' || i.status === 'cancelada') return false;
      const d = new Date(i.due_date); d.setHours(0,0,0,0);
      return d < today;
    }).length;
    return { op, clientName: cl?.name || '—', total: insts.length, pagas, atrasadas };
  });

  const handlePrintPDF = () => { window.print(); };

  if (loading) return (
    <div className="flex-col pb-24 h-full"><Header title="Central de Relatórios" showBack /><div className="page"><div className="skeleton" style={{ height: 300, borderRadius: 28 }} /></div></div>
  );

  // ─── ESTILOS REUTILIZÁVEIS DO PDF ──────────────────────────
  const S = {
    section: { marginBottom: '30px' } as React.CSSProperties,
    sectionTitle: { fontSize: '16px', fontWeight: 900, borderBottom: '2px solid #000', paddingBottom: '6px', marginBottom: '16px', textTransform: 'uppercase' as const, letterSpacing: '1px' } as React.CSSProperties,
    kpiGrid3: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '24px' } as React.CSSProperties,
    kpiGrid4: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' } as React.CSSProperties,
    kpiGrid2: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px', marginBottom: '24px' } as React.CSSProperties,
    kpiBox: { border: '1.5px solid #222', padding: '14px', borderRadius: '8px' } as React.CSSProperties,
    kpiBoxDark: { background: '#111', color: '#fff', padding: '14px', borderRadius: '8px' } as React.CSSProperties,
    kpiBoxGreen: { border: '1.5px solid #10B981', background: '#F0FDF4', padding: '14px', borderRadius: '8px' } as React.CSSProperties,
    kpiBoxRed: { border: '1.5px solid #EF4444', background: '#FEF2F2', padding: '14px', borderRadius: '8px' } as React.CSSProperties,
    kpiLabel: { fontSize: '9px', fontWeight: 800, color: '#777', marginBottom: '2px', textTransform: 'uppercase' as const, letterSpacing: '0.5px' } as React.CSSProperties,
    kpiValue: { fontSize: '22px', fontWeight: 900 } as React.CSSProperties,
    kpiValueSm: { fontSize: '16px', fontWeight: 900 } as React.CSSProperties,
    th: { padding: '10px 6px', fontSize: '10px', fontWeight: 900, borderBottom: '2px solid #000', textAlign: 'left' as const, textTransform: 'uppercase' as const, letterSpacing: '0.5px' } as React.CSSProperties,
    td: { padding: '8px 6px', fontSize: '11px', borderBottom: '1px solid #eee' } as React.CSSProperties,
    tdBold: { padding: '8px 6px', fontSize: '11px', fontWeight: 800, borderBottom: '1px solid #eee' } as React.CSSProperties,
    tdRight: { padding: '8px 6px', fontSize: '11px', fontWeight: 900, textAlign: 'right' as const, borderBottom: '1px solid #eee' } as React.CSSProperties,
  };

  return (
    <div className="flex-col pb-24 h-full">
      <Header title="Relatórios & Exportação" showBack />

      <div className="page-content">
        
        {/* ══════════════════════════════════════════════════════
            TELA DO APLICATIVO (NO PRINT)
           ══════════════════════════════════════════════════════ */}
        <div className="page no-print" style={{ gap: 16, paddingBottom: 60 }}>
          
          {/* FILTROS */}
          <div className="card flex-col" style={{ gap: 14, padding: '20px', background: 'var(--color-bg)' }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Filter size={18} color="var(--color-accent)" />
                <p style={{ fontWeight: 950, fontSize: 16 }}>Período de Análise</p>
             </div>
             <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }} className="scrollbar-hide">
                <button className="filter-chip" onClick={() => preset(7)}>Semana</button>
                <button className="filter-chip" onClick={() => preset(15)}>Quinzena</button>
                <button className="filter-chip" onClick={() => preset(30)}>Mensal</button>
                <button className="filter-chip" onClick={() => preset(365)}>Anual</button>
             </div>
             <div className="grid-2">
                <div className="input-group">
                   <label className="input-label">De:</label>
                   <input type="date" className="input-field" value={startDate} onChange={e => setStartDate(e.target.value)} />
                </div>
                <div className="input-group">
                   <label className="input-label">Até:</label>
                   <input type="date" className="input-field" value={endDate} onChange={e => setEndDate(e.target.value)} />
                </div>
             </div>
          </div>

          {/* KPIs DO PERÍODO */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
             <div className="card flex-col" style={{ padding: '16px', gap: 6, borderTop: '4px solid var(--color-accent)' }}>
                <p style={{ fontSize: 9, fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Capital Liberado</p>
                <p style={{ fontSize: 20, fontWeight: 950 }}>{fmt(totalEmprestadoPeriodo)}</p>
                <p style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{filteredOperations.length} contrato(s)</p>
             </div>
             <div className="card flex-col" style={{ padding: '16px', gap: 6, borderTop: '4px solid var(--color-success)' }}>
                <p style={{ fontSize: 9, fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Volume Recebido</p>
                <p style={{ fontSize: 20, fontWeight: 950, color: 'var(--color-success)' }}>{fmt(totalRecebidoPeriodo)}</p>
                <p style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{filteredPayments.length} entrada(s)</p>
             </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
             <div className="card flex-col" style={{ padding: '12px', alignItems: 'center', gap: 4 }}>
                <p style={{ fontSize: 14, fontWeight: 950, color: '#047857' }}>+{fmt(lucroBrutoPeriodo)}</p>
                <p style={{ fontSize: 8, fontWeight: 800, color: 'var(--color-text-muted)' }}>SPREAD</p>
             </div>
             <div className="card flex-col" style={{ padding: '12px', alignItems: 'center', gap: 4 }}>
                <p style={{ fontSize: 14, fontWeight: 950 }}>{fmt(ticketMedioPeriodo)}</p>
                <p style={{ fontSize: 8, fontWeight: 800, color: 'var(--color-text-muted)' }}>TICKET MÉDIO</p>
             </div>
             <div className="card flex-col" style={{ padding: '12px', alignItems: 'center', gap: 4 }}>
                <p style={{ fontSize: 14, fontWeight: 950, color: totalRecebidoPeriodo - totalEmprestadoPeriodo >= 0 ? '#047857' : '#DC2626' }}>{fmt(totalRecebidoPeriodo - totalEmprestadoPeriodo)}</p>
                <p style={{ fontSize: 8, fontWeight: 800, color: 'var(--color-text-muted)' }}>FLUXO LÍQ.</p>
             </div>
          </div>

          {/* BREAKDOWN: Pagamentos vs Quitações */}
          <div className="card flex-col" style={{ padding: '18px', gap: 14 }}>
             <p style={{ fontWeight: 950, fontSize: 14 }}>Composição dos Recebimentos</p>
             <div style={{ display: 'flex', height: 10, borderRadius: 99, overflow: 'hidden', background: '#E2E8F0' }}>
                {totalRecebidoPeriodo > 0 && <>
                  <div style={{ width: `${(totalNormalPeriodo / totalRecebidoPeriodo) * 100}%`, background: 'var(--color-accent)' }} />
                  <div style={{ width: `${(totalQuitadoPeriodo / totalRecebidoPeriodo) * 100}%`, background: '#10B981' }} />
                </>}
             </div>
             <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px', background: 'var(--color-accent-light)', borderRadius: 12 }}>
                   <div style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--color-accent)' }} />
                   <div>
                      <p style={{ fontSize: 13, fontWeight: 950 }}>{fmt(totalNormalPeriodo)}</p>
                      <p style={{ fontSize: 9, color: 'var(--color-text-muted)' }}>{pagamentosNormaisPeriodo.length} pagtos normais</p>
                   </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px', background: '#F0FDF4', borderRadius: 12 }}>
                   <div style={{ width: 8, height: 8, borderRadius: 2, background: '#10B981' }} />
                   <div>
                      <p style={{ fontSize: 13, fontWeight: 950, color: '#047857' }}>{fmt(totalQuitadoPeriodo)}</p>
                      <p style={{ fontSize: 9, color: 'var(--color-text-muted)' }}>{quitacoesPeriodo.length} quitação(ões)</p>
                   </div>
                </div>
             </div>
          </div>

          {/* SAÚDE GLOBAL */}
          <div className="card flex-col" style={{ padding: '18px', gap: 14 }}>
             <p style={{ fontWeight: 950, fontSize: 14 }}>Saúde Global da Carteira</p>
             <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={{ padding: '12px', background: 'var(--color-bg)', borderRadius: 12 }}>
                   <p style={{ fontSize: 9, fontWeight: 800, color: 'var(--color-text-muted)' }}>CAPITAL ALOCADO</p>
                   <p style={{ fontSize: 15, fontWeight: 950 }}>{fmt(totalGlobalEmprestado)}</p>
                </div>
                <div style={{ padding: '12px', background: 'var(--color-bg)', borderRadius: 12 }}>
                   <p style={{ fontSize: 9, fontWeight: 800, color: 'var(--color-text-muted)' }}>RETORNO ESPERADO</p>
                   <p style={{ fontSize: 15, fontWeight: 950 }}>{fmt(totalGlobalRetorno)}</p>
                </div>
                <div style={{ padding: '12px', background: '#F0FDF4', borderRadius: 12 }}>
                   <p style={{ fontSize: 9, fontWeight: 800, color: '#059669' }}>JÁ RECEBIDO</p>
                   <p style={{ fontSize: 15, fontWeight: 950, color: '#047857' }}>{fmt(totalGlobalRecebido)}</p>
                </div>
                <div style={{ padding: '12px', background: totalGlobalAberto > 0 ? '#FEF2F2' : '#F0FDF4', borderRadius: 12 }}>
                   <p style={{ fontSize: 9, fontWeight: 800, color: totalGlobalAberto > 0 ? '#DC2626' : '#059669' }}>SALDO DEVEDOR</p>
                   <p style={{ fontSize: 15, fontWeight: 950, color: totalGlobalAberto > 0 ? '#991B1B' : '#047857' }}>{fmt(totalGlobalAberto)}</p>
                </div>
             </div>
             <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                <div style={{ textAlign: 'center', padding: '8px', background: 'var(--color-bg)', borderRadius: 10 }}>
                   <p style={{ fontSize: 16, fontWeight: 950, color: 'var(--color-accent)' }}>{contratosAtivos}</p>
                   <p style={{ fontSize: 8, fontWeight: 800, color: 'var(--color-text-muted)' }}>ATIVOS</p>
                </div>
                <div style={{ textAlign: 'center', padding: '8px', background: 'var(--color-bg)', borderRadius: 10 }}>
                   <p style={{ fontSize: 16, fontWeight: 950, color: 'var(--color-success)' }}>{contratosQuitados}</p>
                   <p style={{ fontSize: 8, fontWeight: 800, color: 'var(--color-text-muted)' }}>QUITADOS</p>
                </div>
                <div style={{ textAlign: 'center', padding: '8px', background: Number(taxaInadimplencia) > 30 ? '#FEF2F2' : '#F0FDF4', borderRadius: 10 }}>
                   <p style={{ fontSize: 16, fontWeight: 950, color: Number(taxaInadimplencia) > 30 ? '#DC2626' : '#059669' }}>{taxaInadimplencia}%</p>
                   <p style={{ fontSize: 8, fontWeight: 800, color: 'var(--color-text-muted)' }}>INADIMPL.</p>
                </div>
             </div>
          </div>

          {/* TOP 3 CLIENTES */}
          {clientRanking.length > 0 && (
          <div className="card flex-col" style={{ padding: '18px', gap: 12 }}>
             <p style={{ fontWeight: 950, fontSize: 14 }}>Top Clientes por Volume</p>
             {clientRanking.slice(0, 3).map((c, i) => (
               <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--color-bg)', borderRadius: 14 }}>
                  <div style={{ width: 26, height: 26, borderRadius: 99, background: i === 0 ? '#F59E0B' : '#CBD5E1', color: '#fff', textAlign: 'center', fontSize: 11, lineHeight: '26px', fontWeight: 950 }}>{i + 1}</div>
                  <p style={{ flex: 1, fontWeight: 900, fontSize: 13 }}>{c.name}</p>
                  <div style={{ textAlign: 'right' }}>
                     <p style={{ fontSize: 12, fontWeight: 950 }}>{fmt(c.totalMovimentado)}</p>
                     <p style={{ fontSize: 9, color: c.atrasadas > 0 ? '#DC2626' : 'var(--color-text-muted)' }}>{c.atrasadas > 0 ? `${c.atrasadas} atraso(s)` : `${c.contratos} contrato(s)`}</p>
                  </div>
               </div>
             ))}
          </div>
          )}

          {/* ÚLTIMAS ENTRADAS (inline) */}
          {filteredPayments.length > 0 && (
          <div className="card flex-col" style={{ padding: '18px', gap: 10 }}>
             <p style={{ fontWeight: 950, fontSize: 14 }}>Últimas Entradas do Período</p>
             {filteredPayments.slice(0, 5).map(p => {
                const cl = clients.find(c => c.id === p.client_id);
                return (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: p.type === 'quitacao' ? '#F0FDF4' : 'var(--color-bg)', borderRadius: 12 }}>
                     <div style={{ width: 32, height: 32, borderRadius: 10, background: p.type === 'quitacao' ? '#10B981' : 'var(--color-accent-light)', color: p.type === 'quitacao' ? '#fff' : 'var(--color-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 12 }}>{cl?.name.charAt(0)}</div>
                     <div style={{ flex: 1 }}>
                        <p style={{ fontWeight: 800, fontSize: 12 }}>{cl?.name}</p>
                        <p style={{ fontSize: 9, color: 'var(--color-text-muted)' }}>{fmtDate(p.date)} • {p.type === 'quitacao' ? 'QUITAÇÃO' : p.type.toUpperCase()}</p>
                     </div>
                     <p style={{ fontSize: 13, fontWeight: 950, color: '#059669' }}>+{fmt(Number(p.amount))}</p>
                  </div>
                );
             })}
          </div>
          )}

          {/* EXPORTAÇÃO */}
          <div className="flex-col gap-3">
             <button className="btn w-full" style={{ background: '#000', color: '#fff', height: 64, gap: 12, boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5)' }} onClick={handlePrintPDF}>
                <Printer size={22} />
                <div style={{ textAlign: 'left' }}>
                  <p style={{ fontSize: 15, fontWeight: 900 }}>Gerar PDF Executivo (Master)</p>
                  <p style={{ fontSize: 10, fontWeight: 500, opacity: 0.7 }}>Relatório completo com todos os dados cruzados</p>
                </div>
             </button>

             <button className="btn btn-secondary w-full" style={{ height: 56 }} onClick={() => exportCompleteDatabase()}>
                <Database size={18} /> Exportar Base Completa (CSV + JSON)
             </button>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════
            PDF PREMIUM MASTER — RELATÓRIO EXECUTIVO COMPLETO
           ══════════════════════════════════════════════════════ */}
        <div id="pdf-report-container" className="print-only">
           
           {/* ── CABEÇALHO ─────────────────────────────────── */}
           <div style={{ borderBottom: '4px solid #000', paddingBottom: '16px', marginBottom: '28px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <div>
                 <h1 style={{ fontSize: '28px', fontWeight: 900, margin: 0, letterSpacing: '-1px' }}>RELATÓRIO FINANCEIRO EXECUTIVO</h1>
                 <p style={{ fontSize: '11px', color: '#777', marginTop: '4px', fontWeight: 600 }}>SISTEMA DE GESTÃO DE CRÉDITO — RELATÓRIO CONSOLIDADO</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                 <p style={{ fontSize: '10px', fontWeight: 700, color: '#777' }}>PERÍODO ANALISADO</p>
                 <p style={{ fontSize: '16px', fontWeight: 900 }}>{fmtDate(startDate)} — {fmtDate(endDate)}</p>
                 <p style={{ fontSize: '9px', color: '#aaa', marginTop: '4px' }}>Gerado em {new Date().toLocaleString('pt-BR')}</p>
              </div>
           </div>

           {/* ── 1. INDICADORES DO PERÍODO ─────────────────── */}
           <div style={S.section}>
              <h2 style={S.sectionTitle}>1. Indicadores de Desempenho — Período Selecionado</h2>
              <div style={S.kpiGrid3}>
                 <div style={S.kpiBox}>
                    <p style={S.kpiLabel}>Capital Liberado (Saída)</p>
                    <p style={S.kpiValue}>{fmt(totalEmprestadoPeriodo)}</p>
                    <p style={{ fontSize: '9px', color: '#aaa', marginTop: '4px' }}>{filteredOperations.length} contrato(s) no período</p>
                 </div>
                 <div style={S.kpiBoxDark}>
                    <p style={{ ...S.kpiLabel, color: '#888' }}>Volume Recebido (Entrada)</p>
                    <p style={S.kpiValue}>{fmt(totalRecebidoPeriodo)}</p>
                    <p style={{ fontSize: '9px', color: '#666', marginTop: '4px' }}>{filteredPayments.length} recebimento(s)</p>
                 </div>
                 <div style={S.kpiBoxGreen}>
                    <p style={{ ...S.kpiLabel, color: '#059669' }}>Spread Projetado (Lucro Bruto)</p>
                    <p style={{ ...S.kpiValue, color: '#047857' }}>+{fmt(lucroBrutoPeriodo)}</p>
                 </div>
              </div>
              <div style={S.kpiGrid4}>
                 <div style={S.kpiBox}>
                    <p style={S.kpiLabel}>Pagamentos Avulsos</p>
                    <p style={S.kpiValueSm}>{fmt(totalNormalPeriodo)}</p>
                    <p style={{ fontSize: '9px', color: '#aaa' }}>{pagamentosNormaisPeriodo.length} ops</p>
                 </div>
                 <div style={S.kpiBox}>
                    <p style={S.kpiLabel}>Quitações no Período</p>
                    <p style={{ ...S.kpiValueSm, color: '#059669' }}>{fmt(totalQuitadoPeriodo)}</p>
                    <p style={{ fontSize: '9px', color: '#aaa' }}>{quitacoesPeriodo.length} quitação(ões)</p>
                 </div>
                 <div style={S.kpiBox}>
                    <p style={S.kpiLabel}>Ticket Médio</p>
                    <p style={S.kpiValueSm}>{fmt(ticketMedioPeriodo)}</p>
                 </div>
                 <div style={S.kpiBox}>
                    <p style={S.kpiLabel}>Fluxo Líquido</p>
                    <p style={{ ...S.kpiValueSm, color: totalRecebidoPeriodo - totalEmprestadoPeriodo >= 0 ? '#047857' : '#DC2626' }}>
                       {totalRecebidoPeriodo - totalEmprestadoPeriodo >= 0 ? '+' : ''}{fmt(totalRecebidoPeriodo - totalEmprestadoPeriodo)}
                    </p>
                 </div>
              </div>
           </div>

           {/* ── 2. SAÚDE GLOBAL DA CARTEIRA ──────────────── */}
           <div style={S.section}>
              <h2 style={S.sectionTitle}>2. Saúde Global da Carteira (Posição Atual)</h2>
              <div style={S.kpiGrid4}>
                 <div style={S.kpiBox}>
                    <p style={S.kpiLabel}>Capital Total Alocado</p>
                    <p style={S.kpiValueSm}>{fmt(totalGlobalEmprestado)}</p>
                 </div>
                 <div style={S.kpiBox}>
                    <p style={S.kpiLabel}>Retorno Esperado Bruto</p>
                    <p style={S.kpiValueSm}>{fmt(totalGlobalRetorno)}</p>
                 </div>
                 <div style={S.kpiBoxGreen}>
                    <p style={{ ...S.kpiLabel, color: '#059669' }}>Total Já Recebido</p>
                    <p style={{ ...S.kpiValueSm, color: '#047857' }}>{fmt(totalGlobalRecebido)}</p>
                 </div>
                 <div style={S.kpiBoxRed}>
                    <p style={{ ...S.kpiLabel, color: '#DC2626' }}>Saldo Devedor Aberto</p>
                    <p style={{ ...S.kpiValueSm, color: '#991B1B' }}>{fmt(totalGlobalAberto)}</p>
                 </div>
              </div>
              <div style={S.kpiGrid4}>
                 <div style={S.kpiBox}>
                    <p style={S.kpiLabel}>Total de Clientes</p>
                    <p style={S.kpiValueSm}>{clients.length}</p>
                 </div>
                 <div style={S.kpiBox}>
                    <p style={S.kpiLabel}>Contratos Ativos</p>
                    <p style={S.kpiValueSm}>{contratosAtivos}</p>
                 </div>
                 <div style={S.kpiBox}>
                    <p style={S.kpiLabel}>Contratos Quitados</p>
                    <p style={{ ...S.kpiValueSm, color: '#059669' }}>{contratosQuitados}</p>
                 </div>
                 <div style={{ ...S.kpiBox, border: lucroRealizadoGlobal >= 0 ? '1.5px solid #10B981' : '1.5px solid #EF4444' }}>
                    <p style={S.kpiLabel}>Lucro Realizado</p>
                    <p style={{ ...S.kpiValueSm, color: lucroRealizadoGlobal >= 0 ? '#047857' : '#DC2626' }}>{lucroRealizadoGlobal >= 0 ? '+' : ''}{fmt(lucroRealizadoGlobal)}</p>
                 </div>
              </div>
           </div>

           {/* ── 3. ANÁLISE DE INADIMPLÊNCIA ──────────────── */}
           <div style={S.section}>
              <h2 style={S.sectionTitle}>3. Análise de Inadimplência e Risco</h2>
              <div style={S.kpiGrid3}>
                 <div style={S.kpiBoxRed}>
                    <p style={{ ...S.kpiLabel, color: '#DC2626' }}>Parcelas em Atraso</p>
                    <p style={{ ...S.kpiValue, color: '#991B1B' }}>{parcelasAtrasadas.length}</p>
                 </div>
                 <div style={S.kpiBoxRed}>
                    <p style={{ ...S.kpiLabel, color: '#DC2626' }}>Valor Total em Atraso</p>
                    <p style={{ ...S.kpiValue, color: '#991B1B' }}>{fmt(valorTotalAtrasado)}</p>
                 </div>
                 <div style={{ ...S.kpiBox, background: Number(taxaInadimplencia) > 30 ? '#FEF2F2' : '#F0FDF4' }}>
                    <p style={S.kpiLabel}>Taxa de Inadimplência</p>
                    <p style={{ ...S.kpiValue, color: Number(taxaInadimplencia) > 30 ? '#DC2626' : '#047857' }}>{taxaInadimplencia}%</p>
                    <p style={{ fontSize: '9px', color: '#aaa' }}>{parcelasAtrasadas.length} / {totalParcelasAbertas} parcelas abertas</p>
                 </div>
              </div>
           </div>

           <div className="page-break" />

           {/* ── 4. RANKING POR CLIENTE ───────────────────── */}
           <div style={S.section}>
              <h2 style={S.sectionTitle}>4. Ranking de Clientes — Visão Completa</h2>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                 <thead>
                    <tr>
                       <th style={S.th}>#</th>
                       <th style={S.th}>Cliente</th>
                       <th style={S.th}>Risco</th>
                       <th style={S.th}>Contratos</th>
                       <th style={{ ...S.th, textAlign: 'right' }}>Total Movimentado</th>
                       <th style={{ ...S.th, textAlign: 'right' }}>Já Pagou</th>
                       <th style={{ ...S.th, textAlign: 'right' }}>Em Aberto</th>
                       <th style={S.th}>Atrasos</th>
                    </tr>
                 </thead>
                 <tbody>
                    {clientRanking.map((c, i) => (
                      <tr key={c.id} style={{ background: i % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                         <td style={S.tdBold}>{i + 1}</td>
                         <td style={S.tdBold}>{c.name}</td>
                         <td style={S.td}>{c.risk.toUpperCase()}</td>
                         <td style={S.td}>{c.contratos}</td>
                         <td style={S.tdRight}>{fmt(c.totalMovimentado)}</td>
                         <td style={{ ...S.tdRight, color: '#059669' }}>{fmt(c.totalPago)}</td>
                         <td style={{ ...S.tdRight, color: Number(c.total_open) > 0 ? '#DC2626' : '#059669' }}>{fmt(Number(c.total_open))}</td>
                         <td style={{ ...S.tdBold, color: c.atrasadas > 0 ? '#DC2626' : '#059669' }}>{c.atrasadas > 0 ? `${c.atrasadas} ⚠` : '✓'}</td>
                      </tr>
                    ))}
                 </tbody>
                 <tfoot>
                    <tr style={{ borderTop: '2px solid #000' }}>
                       <td colSpan={4} style={{ ...S.tdBold, fontSize: '10px' }}>TOTAL ({clients.length} clientes)</td>
                       <td style={{ ...S.tdRight, fontWeight: 900 }}>{fmt(clientRanking.reduce((a, c) => a + c.totalMovimentado, 0))}</td>
                       <td style={{ ...S.tdRight, fontWeight: 900, color: '#059669' }}>{fmt(clientRanking.reduce((a, c) => a + c.totalPago, 0))}</td>
                       <td style={{ ...S.tdRight, fontWeight: 900, color: '#DC2626' }}>{fmt(totalGlobalAberto)}</td>
                       <td style={{ ...S.tdBold, color: '#DC2626' }}>{parcelasAtrasadas.length}</td>
                    </tr>
                 </tfoot>
              </table>
           </div>

           {/* ── 5. CONTRATOS GERADOS NO PERÍODO ─────────── */}
           {detailedContracts.length > 0 && (
           <div style={S.section}>
              <h2 style={S.sectionTitle}>5. Contratos Gerados no Período</h2>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                 <thead>
                    <tr>
                       <th style={S.th}>Data</th>
                       <th style={S.th}>Cliente</th>
                       <th style={S.th}>Frequência</th>
                       <th style={{ ...S.th, textAlign: 'right' }}>Capital</th>
                       <th style={{ ...S.th, textAlign: 'right' }}>Total c/ Juros</th>
                       <th style={S.th}>Parcelas</th>
                       <th style={S.th}>Status</th>
                    </tr>
                 </thead>
                 <tbody>
                    {detailedContracts.map(({ op, clientName, total, pagas, atrasadas }) => (
                      <tr key={op.id}>
                         <td style={S.td}>{fmtDate(op.created_at)}</td>
                         <td style={S.tdBold}>{clientName}</td>
                         <td style={S.td}>{op.frequency.toUpperCase()}</td>
                         <td style={S.tdRight}>{fmt(Number(op.principal_amount))}</td>
                         <td style={S.tdRight}>{fmt(Number(op.total_amount))}</td>
                         <td style={S.td}>{pagas}/{total} pagas {atrasadas > 0 ? `(${atrasadas} atraso)` : ''}</td>
                         <td style={{ ...S.tdBold, color: op.status === 'quitada' ? '#059669' : op.status === 'atrasada' ? '#DC2626' : '#000' }}>{op.status.toUpperCase()}</td>
                      </tr>
                    ))}
                 </tbody>
              </table>
           </div>
           )}

           <div className="page-break" />

           {/* ── 6. EXTRATO DE RECEBIMENTOS ───────────────── */}
           <div style={S.section}>
              <h2 style={S.sectionTitle}>6. Extrato Analítico de Recebimentos</h2>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                 <thead>
                    <tr>
                       <th style={S.th}>Data</th>
                       <th style={S.th}>Cliente</th>
                       <th style={S.th}>Tipo</th>
                       <th style={S.th}>Obs</th>
                       <th style={{ ...S.th, textAlign: 'right' }}>Valor</th>
                    </tr>
                 </thead>
                 <tbody>
                    {filteredPayments.map(p => {
                       const c = clients.find(cl => cl.id === p.client_id);
                       return (
                         <tr key={p.id} style={{ background: p.type === 'quitacao' ? '#F0FDF4' : 'transparent' }}>
                            <td style={S.td}>{fmtDate(p.date)}</td>
                            <td style={S.tdBold}>{c?.name || '—'}</td>
                            <td style={{ ...S.td, fontWeight: 700, color: p.type === 'quitacao' ? '#059669' : '#333' }}>
                               {p.type === 'quitacao' ? '★ QUITAÇÃO' : p.type === 'antecipacao' ? 'ANTECIPAÇÃO' : p.type.toUpperCase()}
                            </td>
                            <td style={{ ...S.td, color: '#888', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.notes || '—'}</td>
                            <td style={{ ...S.tdRight, color: '#059669' }}>{fmt(Number(p.amount))}</td>
                         </tr>
                       );
                    })}
                    {filteredPayments.length === 0 && (
                      <tr><td colSpan={5} style={{ padding: '20px', textAlign: 'center', color: '#888', fontSize: '12px' }}>Nenhum recebimento registrado no período selecionado.</td></tr>
                    )}
                 </tbody>
                 {filteredPayments.length > 0 && (
                 <tfoot>
                    <tr style={{ borderTop: '2px solid #000' }}>
                       <td colSpan={4} style={{ ...S.tdBold, fontSize: '12px' }}>TOTAL DO PERÍODO</td>
                       <td style={{ ...S.tdRight, fontSize: '14px', fontWeight: 900, color: '#047857' }}>{fmt(totalRecebidoPeriodo)}</td>
                    </tr>
                 </tfoot>
                 )}
              </table>
           </div>

           {/* ── 7. RESUMO EXECUTIVO FINAL ────────────────── */}
           <div style={{ background: '#F8FAFC', border: '1px solid #ddd', borderRadius: '8px', padding: '20px', marginTop: '20px', marginBottom: '40px' }}>
              <h3 style={{ fontSize: '13px', fontWeight: 900, marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>Resumo Executivo</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '11px' }}>
                 <p>▸ Clientes cadastrados: <strong>{clients.length}</strong></p>
                 <p>▸ Contratos ativos: <strong>{contratosAtivos}</strong></p>
                 <p>▸ Contratos quitados: <strong>{contratosQuitados}</strong></p>
                 <p>▸ Total de operações: <strong>{operations.length}</strong></p>
                 <p>▸ Taxa de recebimento: <strong>{pct(totalGlobalRecebido, totalGlobalRetorno)}</strong></p>
                 <p>▸ Taxa de inadimplência: <strong style={{ color: Number(taxaInadimplencia) > 30 ? '#DC2626' : '#059669' }}>{taxaInadimplencia}%</strong></p>
                 <p>▸ Maior devedor: <strong>{clientRanking.sort((a,b) => Number(b.total_open) - Number(a.total_open))[0]?.name || '—'}</strong> ({fmt(Number(clientRanking.sort((a,b) => Number(b.total_open) - Number(a.total_open))[0]?.total_open || 0))})</p>
                 <p>▸ Melhor pagador: <strong>{clientRanking.sort((a,b) => b.totalPago - a.totalPago)[0]?.name || '—'}</strong> ({fmt(clientRanking.sort((a,b) => b.totalPago - a.totalPago)[0]?.totalPago || 0)})</p>
              </div>
           </div>

           {/* ── ASSINATURA ───────────────────────────────── */}
           <div style={{ borderTop: '1px solid #ccc', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#999' }}>
              <p>Documento gerado eletronicamente — {new Date().toLocaleString('pt-BR')}</p>
              <p>CONFIDENCIAL — USO INTERNO</p>
           </div>
        </div>
      </div>
    </div>
  );
}
