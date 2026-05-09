import { useState, useEffect } from 'react';
import Header from '../components/Header';
import { getClients, getOperations, getInstallments } from '../api/db';
import type { Client, CreditOperation } from '../types';
import { AlertTriangle, Phone, MessageCircle, RotateCcw, TrendingDown } from 'lucide-react';
import { Link } from 'react-router-dom';

interface LateProfile {
  client: Client;
  totalLate: number;
  daysLate: number;
  operationsAffected: CreditOperation[];
}

export default function Inadimplentes() {
  const [lateProfiles, setLateProfiles] = useState<LateProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const [clients, operations, installments] = await Promise.all([ getClients(), getOperations(), getInstallments() ]);
        const today = new Date(); today.setHours(0,0,0,0);
        const list: LateProfile[] = [];

        clients.forEach(c => {
          const insts = installments.filter(i => i.client_id === c.id && i.status !== 'paga' && i.status !== 'renegociada' && i.status !== 'cancelada');
          let tLate = 0; let minDate = new Date(); let hasLate = false;
          const affectedOps = new Set<CreditOperation>();

          insts.forEach(i => {
            const d = new Date(i.due_date); d.setHours(0,0,0,0);
            if (d < today) {
              hasLate = true; tLate += Number(i.amount) - Number(i.amount_paid);
              if (d < minDate) minDate = d;
              const op = operations.find(o => o.id === i.operation_id);
              if (op) affectedOps.add(op);
            }
          });

          if (hasLate) {
            const days = Math.ceil(Math.abs(today.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24));
            list.push({ client: c, totalLate: tLate, daysLate: days, operationsAffected: Array.from(affectedOps) });
          }
        });

        list.sort((a, b) => b.daysLate - a.daysLate);
        setLateProfiles(list);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    fetch();
  }, []);

  const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  if (loading) return (
    <div className="flex-col pb-24 h-full">
      <Header title="Atrasados" showBack />
      <div className="page"><div className="skeleton" style={{ height: 200, borderRadius: 24 }} /></div>
    </div>
  );

  return (
    <div className="flex-col pb-24 h-full">
      <Header title="Lista de Inadimplentes" showBack />

      <div className="page-content">
        <div className="page" style={{ gap: 16 }}>
          {lateProfiles.length > 0 && (
            <div style={{ background: '#FEE2E2', padding: '16px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 12, border: '1.5px solid #FECACA' }}>
              <TrendingDown size={28} color="#EF4444" />
              <div>
                <p style={{ fontSize: 13, fontWeight: 900, color: '#991B1B' }}>Alerta de Inadimplência</p>
                <p style={{ fontSize: 12, color: '#B91C1C', fontWeight: 600 }}>Você possui {lateProfiles.length} clientes com pagamentos vencidos.</p>
              </div>
            </div>
          )}

          <div className="flex-col" style={{ gap: 12 }}>
            {lateProfiles.length > 0 ? lateProfiles.map(p => (
              <div key={p.client.id} className="card flex-col" style={{ gap: 0, padding: 0 }}>
                <div style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 950, fontSize: 18, color: 'var(--color-text-primary)' }}>{p.client.name}</p>
                    <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>{p.client.phone} · {p.client.address || 'Sem endereço'}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p className="badge badge-danger" style={{ marginBottom: 4 }}>{p.daysLate} dias de atraso</p>
                  </div>
                </div>

                <div style={{ background: 'var(--color-bg)', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--color-border)', borderBottom: '1px solid var(--color-border)' }}>
                  <div>
                    <p className="input-label">VENCIDO</p>
                    <p style={{ fontSize: 20, fontWeight: 950, color: 'var(--color-danger)' }}>{fmt(p.totalLate)}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p className="input-label">SALDO TOTAL</p>
                    <p style={{ fontSize: 14, fontWeight: 850 }}>{fmt(Number(p.client.total_open))}</p>
                  </div>
                </div>

                <div style={{ padding: '12px', display: 'flex', gap: 8 }}>
                  <a href={`tel:${p.client.phone}`} className="btn btn-secondary" style={{ flex: 1, height: 44, fontSize: 13 }}><Phone size={16} /></a>
                  <a href={`https://wa.me/55${p.client.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="btn btn-secondary" style={{ flex: 1, height: 44, fontSize: 13, color: '#16A34A' }}><MessageCircle size={16} /></a>
                  {p.operationsAffected.length > 0 && (
                    <Link to={`/renegociar/${p.operationsAffected[0].id}`} style={{ flex: 2 }}>
                       <button className="btn btn-ghost" style={{ width: '100%', height: 44, fontSize: 13 }}><RotateCcw size={16} /> Renegociar</button>
                    </Link>
                  )}
                </div>
              </div>
            )) : (
              <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                <AlertTriangle size={48} color="var(--color-text-muted)" style={{ marginBottom: 16, opacity: 0.3 }} />
                <p style={{ fontWeight: 800, fontSize: 18 }}>Tudo em ordem!</p>
                <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Não há inadimplentes no momento.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
