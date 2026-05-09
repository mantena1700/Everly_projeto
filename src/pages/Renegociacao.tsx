import { useState, useEffect } from 'react';
import Header from '../components/Header';
import { getOperations, getClients } from '../api/db';
import { renegotiateOperation } from '../api/renegotiation';
import type { Client, CreditOperation, OperationFrequency } from '../types';
import { AlertTriangle, Save, RefreshCw, Info } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';

export default function Renegociacao() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [operation, setOperation] = useState<CreditOperation | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [rate, setRate] = useState('10');
  const [frequency, setFrequency] = useState<OperationFrequency>('mensal');
  const [installmentsCount, setInstallmentsCount] = useState('6');
  const [startDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!id) return;
    const fetch = async () => {
      setLoading(true);
      try {
        const [ops, cls] = await Promise.all([getOperations(), getClients()]);
        const op = ops.find(o => o.id === id);
        if (op) {
          setOperation(op);
          setClient(cls.find(c => c.id === op.client_id) || null);
        }
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    fetch();
  }, [id]);

  if (loading || !operation || !client) return (
    <div className="flex-col pb-24 h-full">
      <Header title="Repactuar" showBack />
      <div className="page"><div className="skeleton" style={{ height: 200, borderRadius: 24 }} /></div>
    </div>
  );

  const debtLeft = Number(operation.total_amount) - Number(operation.amount_paid);
  const estimatedNewTotal = debtLeft + (debtLeft * (parseFloat(rate) / 100));
  const estimatedInstallment = estimatedNewTotal / (parseInt(installmentsCount, 10) || 1);

  const handleConfirm = async () => {
    if (saving) return;
    if (window.confirm(`Deseja firmar este novo acordo de ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(debtLeft)}?`)) {
      setSaving(true);
      try {
        const ok = await renegotiateOperation(
          operation.id,
          parseFloat(rate) || 0,
          frequency,
          parseInt(installmentsCount, 10) || 1,
          startDate,
          notes
        );
        if (ok) {
          alert("Acordo firmado com sucesso!");
          navigate('/cobrancas');
        } else {
          alert("Erro ao salvar renegociação.");
        }
      } catch (e) {
        console.error(e);
        alert("Erro de conexão.");
      } finally {
        setSaving(false);
      }
    }
  };

  const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  return (
    <div className="flex-col pb-24 h-full">
      <Header title="Repactuar Dívida" showBack={true}/>
      
      <div className="page-content">
        <div className="page" style={{ gap: 20 }}>
          
          <div className="card" style={{ gap: 14, padding: '20px', background: '#FFFBEB', border: '1.5px solid #FEF3C7' }}>
             <div style={{ width: 44, height: 44, borderRadius: 12, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AlertTriangle color="#D97706" size={24} />
             </div>
             <div style={{ flex: 1 }}>
                <p style={{ fontSize: 11, fontWeight: 900, color: '#92400E', textTransform: 'uppercase' }}>SALDO ATUAL EM DÉBITO</p>
                <p style={{ fontSize: 24, fontWeight: 950, color: '#92400E' }}>{fmt(debtLeft)}</p>
             </div>
          </div>

          <div className="card flex-col" style={{ gap: 16 }}>
            <div>
               <h3 style={{ fontSize: 16, fontWeight: 900, marginBottom: 4 }}>Nova Proposta</h3>
               <p style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Defina os novos termos para o cliente.</p>
            </div>

            <div className="grid-2">
              <div className="input-group">
                <label className="input-label">Taxa Adicional (%)</label>
                <input type="number" className="input-field" value={rate} onChange={e => setRate(e.target.value)} disabled={saving} />
              </div>
              <div className="input-group">
                <label className="input-label">Qtd. Parcelas</label>
                <input type="number" className="input-field" value={installmentsCount} onChange={e => setInstallmentsCount(e.target.value)} disabled={saving} />
              </div>
            </div>

            <div className="input-group">
              <label className="input-label">Frequência de Cobrança</label>
              <select className="input-field" value={frequency} onChange={e => setFrequency(e.target.value as OperationFrequency)} disabled={saving}>
                 <option value="diaria">Diária</option>
                 <option value="semanal">Semanal</option>
                 <option value="quinzenal">Quinzenal</option>
                 <option value="mensal">Mensal</option>
              </select>
            </div>

            <div className="input-group">
              <label className="input-label">Motivo do Acordo</label>
              <textarea className="input-field" style={{ minHeight: 80 }} value={notes} onChange={e => setNotes(e.target.value)} disabled={saving} placeholder="Ex: Cliente em dificuldade financeira..." />
            </div>
          </div>

          <div className="card flex-col" style={{ gap: 10, background: 'var(--color-accent)', color: '#fff', border: 'none', textAlign: 'center', padding: '24px' }}>
             <RefreshCw size={24} style={{ margin: '0 auto 4px', opacity: 0.7 }} />
             <p style={{ fontSize: 11, fontWeight: 800, opacity: 0.8, textTransform: 'uppercase' }}>NOVA PARCELA PREVISTA</p>
             <p style={{ fontSize: 36, fontWeight: 950 }}>{fmt(estimatedInstallment)}</p>
             <p style={{ fontSize: 12, opacity: 0.7 }}>{installmentsCount} pagamentos de {fmt(estimatedInstallment)}</p>
          </div>

          <div className="flex-col gap-3">
             <button className="btn btn-primary" style={{ height: 60 }} onClick={handleConfirm} disabled={saving}>
               <Save size={20}/> {saving ? 'Processando...' : 'Formalizar Novo Acordo'}
             </button>
             <button className="btn btn-secondary" onClick={() => navigate(-1)}>Cancelar</button>
          </div>
          
          <div style={{ padding: '0 10px', display: 'flex', gap: 8, alignItems: 'flex-start', opacity: 0.6 }}>
             <Info size={14} style={{ marginTop: 2 }} />
             <p style={{ fontSize: 11, fontWeight: 600 }}>Esta ação cancelará as parcelas antigas e gerará um novo carnê para o cliente.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
