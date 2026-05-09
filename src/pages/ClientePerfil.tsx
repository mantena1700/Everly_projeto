import { useEffect, useState } from 'react';
import Header from '../components/Header';
import { getClients, getOperations, getInstallments, deleteOperation, deleteClient } from '../api/db';
import { quitacaoTotalContrato } from '../api/payments';
import type { Client, CreditOperation, Installment } from '../types';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  CheckCircle2, AlertTriangle,
  Phone, MessageCircle,
  DollarSign, Calendar, MapPin, Lock, Trash2, History, CreditCard, UserX, Send
} from 'lucide-react';

type TabType = 'resumo' | 'contratos' | 'contato';
type ModalAction = 'payoff' | 'delete' | 'deleteClient';

function instStyle(inst: Installment) {
  if (inst.status === 'paga') {
    return { bg: '#DCFCE7', color: '#16A34A', border: '1px solid #BBF7D0', icon: <DollarSign size={13} strokeWidth={3} /> };
  }
  if (inst.status === 'renegociada' || inst.status === 'cancelada') {
    return { bg: 'var(--color-bg)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)', icon: inst.number };
  }
  
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due   = new Date(inst.due_date); due.setHours(0, 0, 0, 0);
  const diff  = Math.ceil((due.getTime() - today.getTime()) / 86400000);

  if (diff < 0) {
    return { bg: '#FEE2E2', color: '#EF4444', border: '1px solid #FECACA', icon: inst.number };
  }
  if (diff === 0) {
    return { bg: 'var(--color-accent-light)', color: 'var(--color-accent)', border: '1.5px solid var(--color-accent)', icon: inst.number };
  }
  return { bg: '#fff', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border-strong)', icon: inst.number };
}

function isLateInst(inst: Installment): boolean {
  if (inst.status === 'paga' || inst.status === 'renegociada' || inst.status === 'cancelada') return false;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due   = new Date(inst.due_date); due.setHours(0, 0, 0, 0);
  return due < today;
}

const opStatusMeta: Record<string, { label: string; color: string; bg: string }> = {
  ativa:       { label: 'Ativa',        color: 'var(--color-accent)',   bg: 'var(--color-accent-light)' },
  pendente:    { label: 'Pendente',     color: '#D97706',               bg: '#FFFBEB' },
  atrasada:    { label: 'Atrasada',     color: '#EF4444',               bg: '#FEE2E2' },
  renegociada: { label: 'Repactuada',   color: '#D97706',               bg: '#FFFBEB' },
  quitada:     { label: 'Quitada',     color: '#16A34A',               bg: '#DCFCE7' },
  cancelada:   { label: 'Cancelada',   color: 'var(--color-text-muted)', bg: '#F1F5F9' },
};

export default function ClientePerfil() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [client, setClient]           = useState<Client | null>(null);
  const [operations, setOperations]   = useState<CreditOperation[]>([]);
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [tab, setTab]                 = useState<TabType>('resumo');
  const [loading, setLoading]         = useState(true);
  
  const [actionModal, setActionModal] = useState<{ opId: string, open: boolean, type: ModalAction }>({ opId: '', open: false, type: 'payoff' });
  const [pinInput, setPinInput]       = useState('');
  const [error, setError]             = useState('');

  const fetchClientData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [cls, opsRaw, instsRaw] = await Promise.all([ getClients(), getOperations(id), getInstallments() ]);
      const cl = cls.find(c => c.id === id);
      if (cl) setClient(cl);
      setOperations(opsRaw);
      const opIds = new Set(opsRaw.map(o => o.id));
      setInstallments(instsRaw.filter(i => opIds.has(i.operation_id)).sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime()));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchClientData(); }, [id]);

  const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
  const instsByOp = (opId: string) => installments.filter(i => i.operation_id === opId).sort((a, b) => a.number - b.number);

  const generateExtractURL = (op: CreditOperation) => {
    if (!client) return '#';
    const insts = instsByOp(op.id);
    const paidInsts = insts.filter(i => i.status === 'paga').length;
    
    let text = `*RESUMO DO CONTRATO*\n\n`;
    text += `👤 *Cliente:* ${client.name}\n`;
    text += `📅 *Data:* ${new Date(op.created_at).toLocaleDateString('pt-BR')}\n`;
    text += `💰 *Valor Total:* ${fmt(Number(op.total_amount))}\n`;
    text += `💸 *Em Aberto:* ${fmt(Number(op.total_amount) - Number(op.amount_paid))}\n`;
    text += `📊 *Progresso:* ${paidInsts}/${insts.length} pagas\n\n`;
    
    text += `*DETALHAMENTO DE PARCELAS:*\n`;
    insts.forEach(i => {
       const statusIcon = i.status === 'paga' ? '✅' : (isLateInst(i) ? '❌' : (i.status === 'pendente' ? '⏳' : '🔄'));
       text += `[${statusIcon}] Parc ${i.number}: ${fmt(Number(i.amount))} - Venc: ${new Date(i.due_date).toLocaleDateString('pt-BR')}\n`;
    });
    
    const phone = client.phone.replace(/\D/g, '');
    return `https://wa.me/55${phone}?text=${encodeURIComponent(text)}`;
  };

  const handleActionConfirm = async () => {
    const savedPin = localStorage.getItem('app_pin') || '9988';
    if (pinInput !== savedPin) {
      setError('PIN de Segurança incorreto!');
      return;
    }
    if (!id) return;

    try {
      setLoading(true);
      let ok = false;
      if (actionModal.type === 'payoff') {
        ok = await quitacaoTotalContrato(actionModal.opId, id, 'quitacao' as any);
      } else if (actionModal.type === 'delete') {
        ok = await deleteOperation(actionModal.opId, id);
      } else if (actionModal.type === 'deleteClient') {
        ok = await deleteClient(id);
      }

      if (ok) {
        if (actionModal.type === 'deleteClient') {
          alert('Cliente excluído com sucesso.');
          navigate('/clientes');
          return;
        }
        setActionModal({ opId: '', open: false, type: 'payoff' });
        setPinInput('');
        fetchClientData();
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  if (loading || !client) return (
    <div className="flex-col pb-24 h-full">
      <Header title="Perfil" showBack />
      <div className="page"><div className="skeleton" style={{ height: 200, borderRadius: 28 }} /></div>
    </div>
  );

  const activeOps = operations.filter(o => o.status === 'ativa' || o.status === 'atrasada');
  const pastOps = operations.filter(o => o.status === 'quitada' || o.status === 'cancelada' || o.status === 'renegociada');
  const lateCount = installments.filter(isLateInst).length;
  const paidCount = installments.filter(i => i.status === 'paga').length;

  return (
    <div className="flex-col pb-24 h-full">
      <Header title="Perfil do Cliente" showBack />

      <div className="page-content">
        <div style={{ padding: '16px 16px 0' }}>
          <div className="hero-card shadow-glow" style={{ padding: '24px' }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
                <div className="avatar" style={{ width: 60, height: 60, background: 'rgba(255,255,255,0.2)', color: '#fff', fontSize: 24 }}>
                  {client.name.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                   <h2 style={{ fontSize: 22, fontWeight: 950, letterSpacing: '-0.5px' }}>{client.name}</h2>
                   <p style={{ fontSize: 13, opacity: 0.8 }}>{client.phone}</p>
                </div>
                <div style={{ background: '#fff', color: 'var(--color-accent)', padding: '4px 12px', borderRadius: 99, fontSize: 11, fontWeight: 950 }}>{client.risk.toUpperCase()}</div>
             </div>

             <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, background: 'rgba(255,255,255,0.1)', padding: '12px', borderRadius: 16 }}>
                <div style={{ textAlign: 'center' }}><p style={{ fontSize: 9, opacity: 0.7, fontWeight: 800 }}>BORROWED</p><p style={{ fontSize: 13, fontWeight: 950 }}>{fmt(Number(client.total_borrowed))}</p></div>
                <div style={{ textAlign: 'center', borderLeft: '1px solid rgba(255,255,255,0.1)', borderRight: '1px solid rgba(255,255,255,0.1)' }}><p style={{ fontSize: 9, opacity: 0.7, fontWeight: 800 }}>PAID</p><p style={{ fontSize: 13, fontWeight: 950 }}>{fmt(Number(client.total_paid))}</p></div>
                <div style={{ textAlign: 'center' }}><p style={{ fontSize: 9, opacity: 0.7, fontWeight: 800 }}>OPEN</p><p style={{ fontSize: 13, fontWeight: 950, color: '#FECACA' }}>{fmt(Number(client.total_open))}</p></div>
             </div>
          </div>
        </div>

        <div style={{ padding: '16px 16px 0' }}>
           <div className="tab-bar">
             {([['resumo', 'Pulso'], ['contratos', 'Carnê'], ['contato', 'Cadastro']] as [TabType, string][]).map(([k, l]) => (
               <button key={k} className={`tab-btn ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{l}</button>
             ))}
           </div>
        </div>

        <div className="page" style={{ paddingTop: 16 }}>
          {tab === 'resumo' && (
            <div className="flex-col fade-in" style={{ gap: 20 }}>
               {/* Resumo/Pulso items ... */}
               <div className="grid-2">
                  <div className="stat-card" style={{ borderTop: '4px solid var(--color-success)' }}><CheckCircle2 size={18} color="var(--color-success)" /><p style={{ fontSize: 24, fontWeight: 950 }}>{paidCount}</p><p className="input-label">Pagas</p></div>
                  <div className="stat-card" style={{ borderTop: `4px solid ${lateCount > 0 ? 'var(--color-danger)' : 'var(--color-border)'}` }}><AlertTriangle size={18} color={lateCount > 0 ? 'var(--color-danger)' : 'var(--color-text-muted)'} /><p style={{ fontSize: 24, fontWeight: 950, color: lateCount > 0 ? 'var(--color-danger)' : 'inherit' }}>{lateCount}</p><p className="input-label">Em Atraso</p></div>
               </div>
               {activeOps.length > 0 ? activeOps.map(op => (
                 <div key={op.id} className="card flex-col" style={{ gap: 16, padding: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                       <div><p className="input-label">Em aberto</p><p style={{ fontSize: 24, fontWeight: 950 }}>{fmt(Number(op.total_amount) - Number(op.amount_paid))}</p></div>
                       <div style={{ display: 'flex', gap: 8 }}>
                          <a href={generateExtractURL(op)} target="_blank" rel="noreferrer" style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--color-accent-light)', color: 'var(--color-accent)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Send size={16} /></a>
                          <button onClick={() => setActionModal({ opId: op.id, open: true, type: 'delete' })} style={{ width: 36, height: 36, borderRadius: 10, background: '#FEE2E2', color: '#EF4444', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Trash2 size={18} /></button>
                       </div>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                       {instsByOp(op.id).map(inst => {
                          const s = instStyle(inst);
                          return (
                            <Link key={inst.id} to={inst.status !== 'paga' ? `/pagamentos/novo/${inst.id}` : '#'} style={{ width: 44, height: 44, borderRadius: 12, background: s.bg, color: s.color, border: s.border, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 900 }}>{s.icon}</Link>
                          );
                       })}
                    </div>
                    <button className="btn btn-secondary w-full" style={{ gap: 8 }} onClick={() => setActionModal({ opId: op.id, open: true, type: 'payoff' })}><CheckCircle2 size={16} /> Quitar Contrato Inteiro</button>
                 </div>
               )) : (
                 <div className="card flex-col" style={{ padding: '40px', alignItems: 'center', border: '2px dashed var(--color-border)' }}>
                    <CreditCard size={32} color="var(--color-accent)" opacity={0.5} style={{ marginBottom: 8 }} />
                    <p style={{ fontWeight: 800, color: 'var(--color-text-secondary)' }}>Nenhum contrato ativo no momento.</p>
                 </div>
               )}

               <Link to={`/creditos/novo?client=${id}`} style={{ textDecoration: 'none' }}>
                  <button className="btn btn-primary w-full" style={{ height: 56, fontSize: 16 }}>Liberar Novo Crédito</button>
               </Link>
               {pastOps.length > 0 && (
                 <div className="flex-col" style={{ gap: 12 }}><div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><History size={16} /><p style={{ fontSize: 11, fontWeight: 950 }}>HISTÓRICO</p></div>
                   {pastOps.map(op => (
                     <div key={op.id} className="row-item" style={{ padding: '16px' }}>
                        <div style={{ flex: 1 }}><p style={{ fontWeight: 900 }}>{fmt(Number(op.total_amount))}</p><p style={{ fontSize: 10 }}>Finalizado em {new Date(op.created_at).toLocaleDateString()}</p></div>
                        <div className="badge" style={{ background: opStatusMeta[op.status]?.bg, color: opStatusMeta[op.status]?.color }}>{opStatusMeta[op.status]?.label}</div>
                     </div>
                   ))}
                 </div>
               )}
            </div>
          )}

          {tab === 'contratos' && (
            <div className="flex-col fade-in" style={{ gap: 16 }}>
               {operations.map(op => (
                 <div key={op.id} className="card flex-col" style={{ gap: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                       <div><p className="input-label">CONTRATO {new Date(op.created_at).toLocaleDateString()}</p><p style={{ fontSize: 20, fontWeight: 950 }}>{fmt(Number(op.total_amount))}</p></div>
                       <div style={{ display: 'flex', gap: 8 }}>
                          <a href={generateExtractURL(op)} target="_blank" rel="noreferrer" style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--color-accent-light)', color: 'var(--color-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Send size={14} /></a>
                          <div className="badge" style={{ background: opStatusMeta[op.status]?.bg, color: opStatusMeta[op.status]?.color }}>{opStatusMeta[op.status]?.label}</div>
                       </div>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{instsByOp(op.id).map(inst => { const st = instStyle(inst); return (<div key={inst.id} style={{ width: 34, height: 34, borderRadius: 8, background: st.bg, color: st.color, border: st.border, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900 }}>{st.icon}</div>); })}</div>
                 </div>
               ))}
            </div>
          )}

          {tab === 'contato' && (
            <div className="flex-col fade-in" style={{ gap: 16 }}>
               <div className="card flex-col" style={{ padding: 0, overflow: 'hidden' }}>
                  <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)', display: 'flex', gap: 12 }}><MapPin size={20} color="var(--color-text-muted)" /><div><p className="input-label">Endereço</p><p style={{ fontWeight: 800 }}>{client.address || 'Não informado'}</p></div></div>
                  <div style={{ padding: '16px 20px', display: 'flex', gap: 12 }}><Calendar size={20} color="var(--color-text-muted)" /><div><p className="input-label">Desde</p><p style={{ fontWeight: 800 }}>{new Date(client.created_at).toLocaleDateString()}</p></div></div>
               </div>
               <div className="grid-2">
                  <a href={`tel:${client.phone}`} className="btn btn-secondary"><Phone size={18} /> Ligar</a>
                  <a href={`https://wa.me/55${client.phone.replace(/\D/g,'')}`} className="btn btn-secondary" style={{ color: '#16A34A' }}><MessageCircle size={18} /> WhatsApp</a>
               </div>

               <div style={{ marginTop: 24, padding: '16px', border: '1.5px dashed #FECACA', borderRadius: 20, background: '#FFF5F5' }}>
                  <p style={{ fontSize: 13, fontWeight: 850, color: '#EF4444', textAlign: 'center', marginBottom: 12 }}>Área de Risco</p>
                  <button className="btn w-full" style={{ background: '#EF4444', color: '#fff', border: 'none' }} onClick={() => setActionModal({ opId: '', open: true, type: 'deleteClient' })}>
                     <UserX size={20} /> Excluir Cadastro do Cliente
                  </button>
                  <p style={{ fontSize: 10, color: '#F87171', textAlign: 'center', marginTop: 10, fontWeight: 600 }}>Cuidado! Esta ação apaga todos os contratos e pagamentos deste cliente.</p>
               </div>
            </div>
          )}
        </div>
      </div>

      {actionModal.open && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
           <div className="card flex-col fade-in" style={{ maxWidth: 400, width: '90%', padding: '32px', gap: 24 }}>
              <div style={{ textAlign: 'center' }}>
                 <div style={{ width: 64, height: 64, borderRadius: 20, background: actionModal.type.startsWith('delete') ? '#FEE2E2' : 'var(--color-accent-light)', color: actionModal.type.startsWith('delete') ? '#EF4444' : 'var(--color-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                    <Lock size={32} />
                 </div>
                 <h2 style={{ fontSize: 22, fontWeight: 950 }}>Confirmar com PIN</h2>
                 <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 8 }}>Digite seu PIN de segurança para autorizar esta ação crítica.</p>
              </div>
              <input type="password" placeholder="PIN" value={pinInput} onChange={e => { setPinInput(e.target.value); setError(''); }} className="input-field" style={{ textAlign: 'center', fontSize: 24, letterSpacing: '10px', height: 64 }} />
              {error && <p style={{ color: 'var(--color-danger)', fontSize: 12, fontWeight: 800, textAlign: 'center' }}>{error}</p>}
              <div className="flex-col gap-3">
                 <button className="btn w-full" style={{ background: actionModal.type.startsWith('delete') ? '#EF4444' : 'var(--color-accent)', color: '#fff', border: 'none' }} onClick={handleActionConfirm}>Confirmar Ação</button>
                 <button className="btn btn-secondary w-full" onClick={() => { setActionModal({ opId: '', open: false, type: 'payoff' }); setPinInput(''); }}>Cancelar</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
