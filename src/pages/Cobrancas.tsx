import { useState, useEffect } from 'react';
import Header from '../components/Header';
import { getClients, getInstallments, getPayments } from '../api/db';
import type { Installment, Client } from '../types';
import { Search, ChevronRight, Phone, Calendar, AlertTriangle, Clock, CheckCircle2, ArrowRight, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';

type FilterType = 'hoje' | 'atrasadas' | 'amanha' | 'semana' | 'todas';

interface ClientGroup {
  client: Client;
  installments: InstEnriched[];
  totalPending: number;
  maxDelayDays: number;
  status: 'atrasado' | 'vence_hoje' | 'vence_amanha' | 'vence_semana' | 'pendente';
  proximoVencimento: string | null;
  totalPagamentos: number;
}

interface InstEnriched extends Installment {
  delayDays: number;
  instStatus: 'atrasado' | 'vence_hoje' | 'vence_amanha' | 'vence_semana' | 'pendente';
}

export default function Cobrancas() {
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('hoje');
  const [totalPagamentosMap, setTotalPagamentosMap] = useState<Record<string, number>>({});

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const [c, i, p] = await Promise.all([getClients(), getInstallments(), getPayments()]);
        setClients(c);
        setInstallments(i.filter(inst => inst.status !== 'paga' && inst.status !== 'renegociada' && inst.status !== 'cancelada'));
        
        // Contar pagamentos por cliente
        const pMap: Record<string, number> = {};
        p.forEach(pay => { pMap[pay.client_id] = (pMap[pay.client_id] || 0) + 1; });
        setTotalPagamentosMap(pMap);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    fetch();
  }, []);

  const today = new Date(); today.setHours(0,0,0,0);

  const getInstStatus = (dueDate: string): InstEnriched['instStatus'] => {
    const date = new Date(dueDate); date.setHours(0,0,0,0);
    const diffDays = Math.ceil((date.getTime() - today.getTime()) / 86400000);
    if (diffDays < 0) return 'atrasado';
    if (diffDays === 0) return 'vence_hoje';
    if (diffDays === 1) return 'vence_amanha';
    if (diffDays <= 7) return 'vence_semana';
    return 'pendente';
  };

  const getDelayDays = (dueDate: string): number => {
    const d = new Date(dueDate); d.setHours(0,0,0,0);
    return Math.max(0, Math.floor((today.getTime() - d.getTime()) / 86400000));
  };

  const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
  const fmtDate = (s: string) => new Date(s).toLocaleDateString('pt-BR');

  // Enriquecer e agrupar por cliente
  const groups: ClientGroup[] = [];
  const clientIds = new Set(installments.map(i => i.client_id));
  
  clientIds.forEach(cid => {
    const client = clients.find(c => c.id === cid);
    if (!client) return;
    
    const clientInsts: InstEnriched[] = installments
      .filter(i => i.client_id === cid)
      .map(i => ({ ...i, delayDays: getDelayDays(i.due_date), instStatus: getInstStatus(i.due_date) }))
      .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

    const statuses = clientInsts.map(i => i.instStatus);
    let finalStatus: ClientGroup['status'] = 'pendente';
    if (statuses.includes('atrasado')) finalStatus = 'atrasado';
    else if (statuses.includes('vence_hoje')) finalStatus = 'vence_hoje';
    else if (statuses.includes('vence_amanha')) finalStatus = 'vence_amanha';
    else if (statuses.includes('vence_semana')) finalStatus = 'vence_semana';

    if (activeFilter === 'atrasadas' && finalStatus !== 'atrasado') return;
    if (activeFilter === 'hoje' && finalStatus !== 'vence_hoje' && finalStatus !== 'atrasado') return;
    if (activeFilter === 'amanha' && finalStatus !== 'vence_amanha') return;
    if (activeFilter === 'semana' && !['vence_hoje', 'vence_amanha', 'vence_semana', 'atrasado'].includes(finalStatus)) return;
    if (searchTerm && !client.name.toLowerCase().includes(searchTerm.toLowerCase()) && !client.phone.includes(searchTerm)) return;

    const proximo = clientInsts.find(i => i.instStatus !== 'atrasado');

    groups.push({
      client,
      installments: clientInsts,
      totalPending: clientInsts.reduce((a, i) => a + (Number(i.amount) - Number(i.amount_paid)), 0),
      maxDelayDays: Math.max(0, ...clientInsts.map(i => i.delayDays)),
      status: finalStatus,
      proximoVencimento: proximo ? proximo.due_date : clientInsts[0]?.due_date || null,
      totalPagamentos: totalPagamentosMap[cid] || 0,
    });
  });

  // Ordenar: atrasados primeiro, depois por valor
  const statusOrder: Record<string, number> = { atrasado: 0, vence_hoje: 1, vence_amanha: 2, vence_semana: 3, pendente: 4 };
  const sortedGroups = groups.sort((a, b) => {
    const diff = statusOrder[a.status] - statusOrder[b.status];
    return diff !== 0 ? diff : b.totalPending - a.totalPending;
  });

  // Resumo
  const allOpenInsts = installments;
  const atrasadasCount = allOpenInsts.filter(i => getInstStatus(i.due_date) === 'atrasado').length;
  const hojeCount = allOpenInsts.filter(i => getInstStatus(i.due_date) === 'vence_hoje').length;
  const amanhaCount = allOpenInsts.filter(i => getInstStatus(i.due_date) === 'vence_amanha').length;
  const semanaCount = allOpenInsts.filter(i => ['vence_hoje', 'vence_amanha', 'vence_semana'].includes(getInstStatus(i.due_date))).length;

  const valorAtrasado = allOpenInsts.filter(i => getInstStatus(i.due_date) === 'atrasado').reduce((a, i) => a + (Number(i.amount) - Number(i.amount_paid)), 0);
  const valorHoje = allOpenInsts.filter(i => getInstStatus(i.due_date) === 'vence_hoje').reduce((a, i) => a + (Number(i.amount) - Number(i.amount_paid)), 0);
  const valorSemana = allOpenInsts.filter(i => ['vence_hoje', 'vence_amanha', 'vence_semana'].includes(getInstStatus(i.due_date))).reduce((a, i) => a + (Number(i.amount) - Number(i.amount_paid)), 0);

  const statusMeta: Record<string, { label: string; color: string; bg: string; icon: any }> = {
    atrasado:     { label: 'ATRASADO',    color: '#DC2626', bg: '#FEE2E2', icon: AlertTriangle },
    vence_hoje:   { label: 'VENCE HOJE',  color: '#F59E0B', bg: '#FEF3C7', icon: Zap },
    vence_amanha: { label: 'AMANHÃ',      color: '#3B82F6', bg: '#DBEAFE', icon: Clock },
    vence_semana: { label: 'ESTA SEMANA', color: '#8B5CF6', bg: '#EDE9FE', icon: Calendar },
    pendente:     { label: 'PENDENTE',    color: '#64748B', bg: '#F1F5F9', icon: Clock },
  };

  if (loading) return (
    <div className="flex-col pb-24">
      <Header title="Cobranças" />
      <div className="page" style={{ gap: 14 }}>
        <div className="skeleton" style={{ height: 100, borderRadius: 20 }} />
        <div className="skeleton" style={{ height: 100, borderRadius: 20 }} />
        <div className="skeleton" style={{ height: 100, borderRadius: 20 }} />
      </div>
    </div>
  );

  return (
    <div className="flex-col pb-24">
      <Header title="Central de Cobranças" />

      <div className="page-content">
        <div className="page" style={{ paddingTop: 8, gap: 16 }}>

          {/* PAINEL DE URGÊNCIA */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
             <div className="card flex-col" style={{ padding: '16px', gap: 6, borderTop: '4px solid #EF4444' }}>
                <AlertTriangle size={18} color="#EF4444" />
                <p style={{ fontSize: 22, fontWeight: 950, color: '#DC2626' }}>{fmt(valorAtrasado)}</p>
                <p style={{ fontSize: 9, fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>{atrasadasCount} parcelas atrasadas</p>
             </div>
             <div className="card flex-col" style={{ padding: '16px', gap: 6, borderTop: '4px solid #F59E0B' }}>
                <Zap size={18} color="#F59E0B" />
                <p style={{ fontSize: 22, fontWeight: 950, color: '#D97706' }}>{fmt(valorHoje)}</p>
                <p style={{ fontSize: 9, fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>{hojeCount} vencem hoje</p>
             </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
             <div className="card flex-col" style={{ padding: '12px', alignItems: 'center', gap: 4 }}>
                <p style={{ fontSize: 16, fontWeight: 950, color: '#3B82F6' }}>{amanhaCount}</p>
                <p style={{ fontSize: 8, fontWeight: 800, color: 'var(--color-text-muted)' }}>AMANHÃ</p>
             </div>
             <div className="card flex-col" style={{ padding: '12px', alignItems: 'center', gap: 4 }}>
                <p style={{ fontSize: 16, fontWeight: 950, color: '#8B5CF6' }}>{semanaCount}</p>
                <p style={{ fontSize: 8, fontWeight: 800, color: 'var(--color-text-muted)' }}>ESTA SEMANA</p>
             </div>
             <div className="card flex-col" style={{ padding: '12px', alignItems: 'center', gap: 4 }}>
                <p style={{ fontSize: 14, fontWeight: 950, color: 'var(--color-success)' }}>{fmt(valorSemana)}</p>
                <p style={{ fontSize: 8, fontWeight: 800, color: 'var(--color-text-muted)' }}>TOTAL SEMANA</p>
             </div>
          </div>

          {/* BUSCA + FILTROS */}
          <div className="search-bar-container">
            <Search size={18} className="search-bar-icon" />
            <input 
              type="text" 
              placeholder="Buscar cliente ou telefone..." 
              className="input-field"
              value={searchTerm}
              style={{ height: 48, borderRadius: 14, paddingLeft: 48 }}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }} className="scrollbar-hide">
            <button onClick={() => setActiveFilter('hoje')} className={`filter-chip ${activeFilter === 'hoje' ? 'active' : ''}`}>Hoje + Atraso ({hojeCount + atrasadasCount})</button>
            <button onClick={() => setActiveFilter('atrasadas')} className={`filter-chip ${activeFilter === 'atrasadas' ? 'active' : ''}`}>Só Atrasos ({atrasadasCount})</button>
            <button onClick={() => setActiveFilter('amanha')} className={`filter-chip ${activeFilter === 'amanha' ? 'active' : ''}`}>Amanhã ({amanhaCount})</button>
            <button onClick={() => setActiveFilter('semana')} className={`filter-chip ${activeFilter === 'semana' ? 'active' : ''}`}>Semana ({semanaCount})</button>
            <button onClick={() => setActiveFilter('todas')} className={`filter-chip ${activeFilter === 'todas' ? 'active' : ''}`}>Todas</button>
          </div>

          {/* LISTAGEM */}
          <div className="flex-col" style={{ gap: 12 }}>
            <p style={{ fontSize: 11, fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginLeft: 4 }}>
              {sortedGroups.length} cliente(s) • {sortedGroups.reduce((a, g) => a + g.installments.length, 0)} parcela(s)
            </p>

            {sortedGroups.map(group => {
              const meta = statusMeta[group.status];

              return (
                <div key={group.client.id} className="card flex-col" style={{ gap: 0, padding: 0, overflow: 'hidden' }}>
                  
                  {/* Cabeçalho do Card */}
                  <div style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ 
                      width: 48, height: 48, borderRadius: 14, background: meta.bg,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, 
                      color: meta.color, fontSize: 16, flexShrink: 0
                    }}>
                      {group.client.name.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h4 style={{ fontSize: 15, fontWeight: 900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{group.client.name}</h4>
                      <p style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{group.client.phone} • {group.totalPagamentos} pagto(s) feitos</p>
                    </div>
                    <div style={{ flexShrink: 0, textAlign: 'right' }}>
                       <p style={{ fontSize: 16, fontWeight: 950, color: meta.color }}>{fmt(group.totalPending)}</p>
                       <span style={{ fontSize: 8, fontWeight: 900, color: meta.color, background: meta.bg, padding: '2px 8px', borderRadius: 99 }}>
                          {group.status === 'atrasado' ? `${group.maxDelayDays}D ATRASO` : meta.label}
                       </span>
                    </div>
                  </div>

                  {/* Detalhamento de Parcelas */}
                  <div style={{ padding: '0 18px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {group.installments.slice(0, 5).map(inst => {
                      const iMeta = statusMeta[inst.instStatus];
                      const restante = Number(inst.amount) - Number(inst.amount_paid);
                      const pago = Number(inst.amount_paid);
                      const percent = Number(inst.amount) > 0 ? (pago / Number(inst.amount)) * 100 : 0;
                      return (
                        <Link key={inst.id} to={inst.status !== 'paga' ? `/pagamentos/novo/${inst.id}` : '#'} style={{ textDecoration: 'none' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: iMeta.bg, borderRadius: 12, border: `1px solid ${iMeta.color}22` }}>
                             <div style={{ width: 28, height: 28, borderRadius: 8, background: iMeta.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 950, flexShrink: 0 }}>
                                {inst.number}
                             </div>
                             <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                   <p style={{ fontSize: 12, fontWeight: 800 }}>{fmtDate(inst.due_date)}</p>
                                   <p style={{ fontSize: 13, fontWeight: 950, color: iMeta.color }}>{fmt(restante)}</p>
                                </div>
                                {/* Barra de progresso */}
                                <div style={{ height: 4, borderRadius: 2, background: '#E2E8F0', marginTop: 6, overflow: 'hidden' }}>
                                   <div style={{ height: '100%', width: `${percent}%`, background: percent >= 100 ? '#10B981' : iMeta.color, borderRadius: 2, transition: 'width 0.3s' }} />
                                </div>
                                {pago > 0 && <p style={{ fontSize: 9, color: '#888', marginTop: 2 }}>Já pago: {fmt(pago)} ({percent.toFixed(0)}%)</p>}
                             </div>
                             <ArrowRight size={14} color={iMeta.color} style={{ flexShrink: 0 }} />
                          </div>
                        </Link>
                      );
                    })}
                    {group.installments.length > 5 && (
                      <p style={{ fontSize: 10, fontWeight: 800, color: 'var(--color-text-muted)', textAlign: 'center', padding: 4 }}>+{group.installments.length - 5} parcela(s) não exibida(s)</p>
                    )}
                  </div>

                  {/* Footer com Ações */}
                  <div style={{ padding: '12px 18px', borderTop: '1px solid var(--color-border)', display: 'flex', gap: 8, background: 'var(--color-bg)' }}>
                     <a 
                       href={`https://wa.me/55${group.client.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá ${group.client.name.split(' ')[0]}, tudo bem? Passando para lembrar da sua parcela no valor de ${fmt(group.installments[0] ? Number(group.installments[0].amount) - Number(group.installments[0].amount_paid) : 0)} com vencimento em ${group.installments[0] ? fmtDate(group.installments[0].due_date) : '—'}. Qualquer dúvida estou à disposição!`)}`} 
                       target="_blank" rel="noreferrer"
                       className="btn" 
                       style={{ flex: 1, height: 42, borderRadius: 12, background: '#25D366', color: '#fff', fontSize: 12, gap: 6 }}
                     >
                       <Phone size={14} /> Cobrar via WhatsApp
                     </a>
                     <Link to={`/clientes/${group.client.id}`} className="btn btn-secondary" style={{ height: 42, padding: '0 16px', borderRadius: 12, fontSize: 12, gap: 6 }}>
                       Perfil <ChevronRight size={14} />
                     </Link>
                  </div>
                </div>
              );
            })}

            {sortedGroups.length === 0 && (
              <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                <CheckCircle2 size={40} color="var(--color-success)" style={{ marginBottom: 12 }} />
                <p style={{ fontWeight: 800, fontSize: 16, color: 'var(--color-text-primary)' }}>Tudo em dia!</p>
                <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 4 }}>Nenhuma cobrança pendente para este filtro.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
