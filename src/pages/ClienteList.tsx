import { useState, useEffect } from 'react';
import Header from '../components/Header';
import { Search, Plus, AlertCircle, ChevronRight, Users, TrendingUp } from 'lucide-react';
import { getClients, getOperations, getPayments, getInstallments } from '../api/db';
import type { Client } from '../types';
import { Link } from 'react-router-dom';

type FilterType = 'todos' | 'ativos' | 'limpos' | 'atrasados';

interface ClientEnriched extends Client {
  contratos: number;
  contratosAtivos: number;
  totalPagamentos: number;
  parcelasAtrasadas: number;
  ultimoPagamento: string | null;
}

export default function ClienteList() {
  const [clients, setClients] = useState<ClientEnriched[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<FilterType>('todos');

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const [cls, ops, pays, insts] = await Promise.all([
        getClients(), getOperations(), getPayments(), getInstallments()
      ]);

      const today = new Date(); today.setHours(0,0,0,0);

      const enriched: ClientEnriched[] = cls.map(c => {
        const clientOps = ops.filter(o => o.client_id === c.id);
        const clientPays = pays.filter(p => p.client_id === c.id);
        const clientInsts = insts.filter(i => {
          if (i.client_id !== c.id) return false;
          if (i.status === 'paga' || i.status === 'cancelada' || i.status === 'renegociada') return false;
          const due = new Date(i.due_date); due.setHours(0,0,0,0);
          return due < today;
        });

        const lastPay = clientPays.length > 0 ? clientPays[0].date : null;

        return {
          ...c,
          contratos: clientOps.length,
          contratosAtivos: clientOps.filter(o => o.status === 'ativa' || o.status === 'atrasada').length,
          totalPagamentos: clientPays.length,
          parcelasAtrasadas: clientInsts.length,
          ultimoPagamento: lastPay,
        };
      });

      setClients(enriched);
      setLoading(false);
    };
    fetch();
  }, []);

  const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  // Filtros
  let filtered = clients.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone.includes(searchTerm)
  );

  if (filter === 'ativos') filtered = filtered.filter(c => c.contratosAtivos > 0);
  else if (filter === 'limpos') filtered = filtered.filter(c => Number(c.total_open) === 0);
  else if (filter === 'atrasados') filtered = filtered.filter(c => c.parcelasAtrasadas > 0);

  // Resumo geral
  const totalClientes = clients.length;
  const totalComContrato = clients.filter(c => c.contratosAtivos > 0).length;
  const totalInadimplentes = clients.filter(c => c.parcelasAtrasadas > 0).length;
  const totalLimpos = clients.filter(c => Number(c.total_open) === 0).length;
  const totalAberto = clients.reduce((a, c) => a + Number(c.total_open), 0);

  const riskMeta: Record<string, { color: string; bg: string }> = {
    novo:       { color: '#0EA5E9', bg: '#F0F9FF' },
    confiavel:  { color: '#10B981', bg: '#F0FDF4' },
    atencao:    { color: '#F59E0B', bg: '#FFFBEB' },
    risco:      { color: '#EF4444', bg: '#FEF2F2' },
    bloqueado:  { color: '#64748B', bg: '#F1F5F9' },
  };

  if (loading) return (
    <div className="flex-col pb-24">
      <Header title="Clientes" />
      <div className="page" style={{ paddingTop: 16, gap: 14 }}>
        {[1,2,3,4,5].map(i => <div key={i} className="skeleton" style={{ height: 80, borderRadius: 20 }} />)}
      </div>
    </div>
  );

  return (
    <div className="flex-col pb-24">
      <Header title="Meus Clientes" />

      <div className="page-content">
        <div className="page" style={{ paddingTop: 12, gap: 16 }}>

          {/* RESUMO SUPERIOR */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
             <div className="card flex-col" style={{ padding: '16px', gap: 6, borderTop: '4px solid var(--color-accent)' }}>
                <Users size={18} color="var(--color-accent)" />
                <p style={{ fontSize: 26, fontWeight: 950 }}>{totalClientes}</p>
                <p style={{ fontSize: 9, fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Total Cadastrados</p>
             </div>
             <div className="card flex-col" style={{ padding: '16px', gap: 6, borderTop: '4px solid var(--color-success)' }}>
                <TrendingUp size={18} color="var(--color-success)" />
                <p style={{ fontSize: 18, fontWeight: 950, color: 'var(--color-success)' }}>{fmt(totalAberto)}</p>
                <p style={{ fontSize: 9, fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Saldo Total Aberto</p>
             </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
             <div className="card flex-col" style={{ padding: '12px', alignItems: 'center', gap: 4 }}>
                <p style={{ fontSize: 18, fontWeight: 950, color: 'var(--color-accent)' }}>{totalComContrato}</p>
                <p style={{ fontSize: 8, fontWeight: 800, color: 'var(--color-text-muted)' }}>COM CONTRATO</p>
             </div>
             <div className="card flex-col" style={{ padding: '12px', alignItems: 'center', gap: 4 }}>
                <p style={{ fontSize: 18, fontWeight: 950, color: totalInadimplentes > 0 ? '#EF4444' : 'var(--color-success)' }}>{totalInadimplentes}</p>
                <p style={{ fontSize: 8, fontWeight: 800, color: 'var(--color-text-muted)' }}>INADIMPLENTES</p>
             </div>
             <div className="card flex-col" style={{ padding: '12px', alignItems: 'center', gap: 4 }}>
                <p style={{ fontSize: 18, fontWeight: 950, color: 'var(--color-success)' }}>{totalLimpos}</p>
                <p style={{ fontSize: 8, fontWeight: 800, color: 'var(--color-text-muted)' }}>SEM DÉBITO</p>
             </div>
          </div>

          {/* BUSCA */}
          <div className="search-bar-container">
            <Search size={18} className="search-bar-icon" />
            <input
              className="search-bar-input input-field"
              type="text"
              placeholder="Buscar por nome ou telefone..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ paddingLeft: 48 }}
            />
          </div>

          {/* FILTROS */}
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }} className="scrollbar-hide">
             <button className={`filter-chip ${filter === 'todos' ? 'active' : ''}`} onClick={() => setFilter('todos')}>Todos ({totalClientes})</button>
             <button className={`filter-chip ${filter === 'ativos' ? 'active' : ''}`} onClick={() => setFilter('ativos')}>Ativos ({totalComContrato})</button>
             <button className={`filter-chip ${filter === 'limpos' ? 'active' : ''}`} onClick={() => setFilter('limpos')}>Quitados ({totalLimpos})</button>
             <button className={`filter-chip ${filter === 'atrasados' ? 'active' : ''}`} onClick={() => setFilter('atrasados')}>Atrasados ({totalInadimplentes})</button>
          </div>

          {/* CADASTRAR */}
          <Link to="/clientes/novo" style={{ textDecoration: 'none' }}>
            <button className="btn btn-primary" style={{ width: '100%' }}>
              <Plus size={18} /> Novo Cadastro
            </button>
          </Link>

          {/* LISTAGEM ENRIQUECIDA */}
          <div className="flex-col" style={{ gap: 10 }}>
            <p style={{ fontSize: 11, fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginLeft: 4 }}>
              {filtered.length} resultado(s)
            </p>
            
            {filtered.map(client => {
              const initials = client.name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();
              const hasLate = client.parcelasAtrasadas > 0;
              const risk = riskMeta[client.risk] || riskMeta.novo;

              return (
                <Link key={client.id} to={`/clientes/${client.id}`} style={{ textDecoration: 'none' }}>
                  <div className="card flex-col" style={{ gap: 12, padding: '16px 18px' }}>
                    {/* Linha 1: Avatar + Nome + Saldo */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div
                        className="avatar"
                        style={{
                          width: 48, height: 48,
                          background: hasLate ? '#FEE2E2' : 'var(--color-accent-light)',
                          color: hasLate ? '#EF4444' : 'var(--color-accent)',
                          fontWeight: 900, fontSize: 16, borderRadius: 16
                        }}
                      >
                        {initials}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <p style={{ fontWeight: 900, fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {client.name}
                          </p>
                          {hasLate && <AlertCircle size={14} color="#EF4444" />}
                        </div>
                        <p style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                          {client.phone}
                        </p>
                      </div>

                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <p style={{ fontSize: 15, fontWeight: 950, color: Number(client.total_open) > 0 ? 'var(--color-text-primary)' : 'var(--color-success)' }}>
                          {Number(client.total_open) > 0 ? fmt(Number(client.total_open)) : 'Limpo'}
                        </p>
                        <span style={{ fontSize: 9, fontWeight: 900, color: risk.color, background: risk.bg, padding: '2px 8px', borderRadius: 99, textTransform: 'uppercase' }}>
                          {client.risk}
                        </span>
                      </div>
                      <ChevronRight size={16} color="var(--color-border)" style={{ flexShrink: 0 }} />
                    </div>

                    {/* Linha 2: Mini KPIs do cliente */}
                    <div style={{ display: 'flex', gap: 8, paddingTop: 10, borderTop: '1px solid var(--color-border)' }}>
                       <div style={{ flex: 1, padding: '6px 10px', background: 'var(--color-bg)', borderRadius: 10, textAlign: 'center' }}>
                          <p style={{ fontSize: 14, fontWeight: 950 }}>{client.contratosAtivos}</p>
                          <p style={{ fontSize: 8, fontWeight: 800, color: 'var(--color-text-muted)' }}>ATIVOS</p>
                       </div>
                       <div style={{ flex: 1, padding: '6px 10px', background: 'var(--color-bg)', borderRadius: 10, textAlign: 'center' }}>
                          <p style={{ fontSize: 14, fontWeight: 950, color: 'var(--color-success)' }}>{client.totalPagamentos}</p>
                          <p style={{ fontSize: 8, fontWeight: 800, color: 'var(--color-text-muted)' }}>PAGTOS</p>
                       </div>
                       <div style={{ flex: 1, padding: '6px 10px', background: hasLate ? '#FEF2F2' : 'var(--color-bg)', borderRadius: 10, textAlign: 'center' }}>
                          <p style={{ fontSize: 14, fontWeight: 950, color: hasLate ? '#EF4444' : 'var(--color-success)' }}>{client.parcelasAtrasadas}</p>
                          <p style={{ fontSize: 8, fontWeight: 800, color: 'var(--color-text-muted)' }}>ATRASOS</p>
                       </div>
                       <div style={{ flex: 1.5, padding: '6px 10px', background: 'var(--color-bg)', borderRadius: 10, textAlign: 'center' }}>
                          <p style={{ fontSize: 10, fontWeight: 900, color: 'var(--color-text-secondary)' }}>{client.ultimoPagamento ? new Date(client.ultimoPagamento).toLocaleDateString('pt-BR') : '—'}</p>
                          <p style={{ fontSize: 8, fontWeight: 800, color: 'var(--color-text-muted)' }}>ÚLT. PAGTO</p>
                       </div>
                    </div>
                  </div>
                </Link>
              );
            })}

            {filtered.length === 0 && (
              <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                <Search size={32} color="var(--color-text-muted)" style={{ marginBottom: 12 }} />
                <p style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>Nenhum encontrado</p>
                <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Tente outro termo de busca</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
