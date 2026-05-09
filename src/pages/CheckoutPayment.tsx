import { useState, useEffect } from 'react';
import Header from '../components/Header';
import { getClients, getInstallments, getOperations } from '../api/db';
import { registerPayment, calcLateFee } from '../api/payments';
import type { Installment, Client, CreditOperation, PaymentType } from '../types';
import { CheckCircle2, AlertTriangle, User, DollarSign } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';

export default function CheckoutPayment() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [installment, setInstallment] = useState<Installment | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [operation, setOperation] = useState<CreditOperation | null>(null);
  const [amountPaid, setAmountPaid] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    const fetch = async () => {
      setLoading(true);
      try {
        const [insts, cls, ops] = await Promise.all([ getInstallments(), getClients(), getOperations() ]);
        const inst = insts.find(i => i.id === id);
        if (inst) {
          setInstallment(inst);
          const lateFee = calcLateFee(inst);
          const remaining = Number(inst.amount) + lateFee - Number(inst.amount_paid);
          setAmountPaid(remaining.toFixed(2));
          setClient(cls.find(c => c.id === inst.client_id) || null);
          setOperation(ops.find(o => o.id === inst.operation_id) || null);
        }
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    fetch();
  }, [id]);

  const handleCheckout = async () => {
    const paid = parseFloat(amountPaid) || 0;
    if (!paid || paid <= 0 || saving) { alert('Insira um valor válido.'); return; }
    if (!operation || !installment || !client) { alert('Dados incompletos.'); return; }
    
    setSaving(true);
    try {
      const lateFee = calcLateFee(installment);
      const totalToPay = Number(installment.amount) + lateFee - Number(installment.amount_paid);
      const isOverpay = paid > totalToPay + 0.01;
      const isPartial = paid < totalToPay - 0.01;
      const paymentType: PaymentType = isPartial ? 'parcial' : isOverpay ? 'maior' : 'exato';

      const ok = await registerPayment({
        installment_id: installment.id,
        operation_id: operation.id,
        client_id: client.id,
        payment_amount: paid,
        payment_type: paymentType,
        notes: '',
      });

      if (ok) {
        alert('Pagamento registrado com sucesso!');
        navigate('/cobrancas');
      } else {
        alert('Erro ao registrar.');
      }
    } catch (err) {
      console.error(err);
      alert('Erro de conexão.');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !installment || !client) {
    return (
      <div className="flex-col pb-24 h-full">
        <Header title="Recebimento" showBack />
        <div className="page"><div className="skeleton" style={{ height: 200, borderRadius: 24 }} /></div>
      </div>
    );
  }

  const lateFee  = calcLateFee(installment);
  const hasLateFee = lateFee > 0;
  const baseRemaining = Number(installment.amount) - Number(installment.amount_paid);
  const totalRemaining = Math.max(0, baseRemaining + lateFee);
  const currentPaid = parseFloat(amountPaid) || 0;
  const isPartial = currentPaid > 0 && currentPaid < totalRemaining - 0.01;

  const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  return (
    <div className="flex-col pb-24 h-full">
      <Header title="Confirmar Recebimento" showBack />
      
      <div className="page-content">
        <div className="page" style={{ gap: 20 }}>
          
          <div className="card" style={{ gap: 14, padding: '20px' }}>
            <div className="avatar" style={{ width: 52, height: 52 }}>
               <User size={24} />
            </div>
            <div style={{ flex: 1 }}>
               <p style={{ fontSize: 18, fontWeight: 900 }}>{client.name}</p>
               <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{installment.number}ª Parcela · {new Date(installment.due_date).toLocaleDateString()}</p>
            </div>
          </div>

          <div className="card flex-col" style={{ padding: '24px', textAlign: 'center', gap: 8, background: hasLateFee ? '#FFF1F2' : 'var(--color-bg)', border: hasLateFee ? '1.5px solid #FECACA' : '1.5px solid var(--color-border)' }}>
             <p style={{ fontSize: 11, fontWeight: 850, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>SALDO EM ABERTO</p>
             <p style={{ fontSize: 44, fontWeight: 950, color: hasLateFee ? 'var(--color-danger)' : 'var(--color-text-primary)', letterSpacing: '-1.5px' }}>{fmt(totalRemaining)}</p>
             {hasLateFee && (
               <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 12px', background: 'var(--color-danger)', color: '#fff', borderRadius: 99, fontSize: 11, fontWeight: 800 }}>
                 <AlertTriangle size={12} /> Inclui multa por atraso
               </div>
             )}
          </div>

          <div className="input-group">
             <label className="input-label">VALOR RECEBIDO AGORA</label>
             <div style={{ position: 'relative' }}>
                <DollarSign size={20} style={{ position: 'absolute', left: 16, top: 20, color: 'var(--color-accent)' }} />
                <input 
                  type="number" 
                  className="input-field" 
                  style={{ height: 64, paddingLeft: 48, fontSize: 26, fontWeight: 950, color: 'var(--color-accent)' }} 
                  value={amountPaid} 
                  onChange={e => setAmountPaid(e.target.value)} 
                  disabled={saving} 
                />
             </div>
          </div>

          {isPartial && (
            <div style={{ padding: '16px', background: '#FFFBEB', border: '1.5px solid #FEF3C7', borderRadius: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
               <AlertTriangle size={18} color="#D97706" />
               <p style={{ fontSize: 13, fontWeight: 700, color: '#92400E' }}>Recebimento parcial. Ficarão faltando {fmt(totalRemaining - currentPaid)} para este cliente.</p>
            </div>
          )}

          <div className="flex-col gap-3">
             <button className="btn btn-primary" style={{ height: 60, fontSize: 16 }} onClick={handleCheckout} disabled={currentPaid <= 0 || saving}>
                <CheckCircle2 size={22} /> {saving ? 'Registrando...' : 'Confirmar Pagamento'}
             </button>
             <button className="btn btn-secondary" onClick={() => navigate(-1)}>Cancelar</button>
          </div>

        </div>
      </div>
    </div>
  );
}
