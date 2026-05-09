import { useState, useEffect } from 'react';
import Header from '../components/Header';
import { getClients } from '../api/db';
import { simulateCredit, createOperation, type SimulationResult } from '../api/credits';
import type { Client, OperationFrequency } from '../types';
import { Users, Receipt, Info, Lock } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

export default function CreateCredit() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState('');
  const [amount, setAmount] = useState('1000');
  const [rate, setRate] = useState('20');
  const [frequency, setFrequency] = useState<OperationFrequency>('mensal');
  const [installmentsCount, setInstallmentsCount] = useState('5');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [simulation, setSimulation] = useState<SimulationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const fetch = async () => {
      const all = await getClients();
      setClients(all.filter(c => c.status !== 'bloqueado'));
      const params = new URLSearchParams(location.search);
      const preClient = params.get('client');
      if (preClient) setClientId(preClient);
    };
    fetch();
  }, [location.search]);

  useEffect(() => {
    const num = parseFloat(amount);
    const rateN = parseFloat(rate);
    const instN = parseInt(installmentsCount, 10);
    if (num > 0 && rateN >= 0 && instN > 0) {
      setSimulation(simulateCredit({
        client_id: clientId || 'dummy',
        principal_amount: num,
        interest_rate: rateN,
        frequency,
        installments_count: instN,
        start_date: startDate
      }));
    } else {
      setSimulation(null);
    }
  }, [amount, rate, frequency, installmentsCount, startDate, clientId]);

  const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const handleRequestCreate = () => {
    if (!clientId || !simulation || loading) { alert('Selecione um cliente e verifique a simulação.'); return; }
    setShowPinModal(true);
  };

  const confirmCreate = async () => {
    const savedPin = localStorage.getItem('app_pin') || '9988';
    if (pinInput !== savedPin) {
      setError('PIN de Segurança incorreto!');
      return;
    }

    if (!clientId || !simulation) return;
    setLoading(true);
    try {
      const ok = await createOperation(simulation, {
        client_id: clientId,
        principal_amount: parseFloat(amount),
        interest_rate: parseFloat(rate),
        frequency,
        installments_count: parseInt(installmentsCount, 10),
        start_date: startDate
      });
      if (ok) {
        alert('Crédito liberado com sucesso!');
        navigate('/');
      } else {
        alert('Erro ao salvar operação.');
      }
    } catch (err) {
      console.error(err);
      alert('Erro de conexão ao salvar.');
    } finally {
      setLoading(false);
      setShowPinModal(false);
      setPinInput('');
    }
  };

  const selectedClient = clients.find(c => c.id === clientId);

  return (
    <div className="flex-col pb-24 h-full">
      <Header title="Liberar Crédito" showBack />
      
      <div className="page-content">
        <div className="page" style={{ gap: 20 }}>
          
          {/* CLIENTE */}
          <div className="card flex-col" style={{ gap: 14 }}>
            <div className="input-group">
              <label className="input-label">Selecione o Cliente</label>
              <div style={{ position: 'relative' }}>
                 <Users size={18} style={{ position: 'absolute', left: 14, top: 15, color: 'var(--color-text-muted)' }} />
                 <select className="input-field" style={{ paddingLeft: 44 }} value={clientId} onChange={e => setClientId(e.target.value)}>
                    <option value="">Buscar cliente...</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                 </select>
              </div>
            </div>
            {selectedClient && (
              <div style={{ background: 'var(--color-bg)', padding: '12px 16px', borderRadius: 16, display: 'flex', alignItems: 'center', gap: 10, border: '1px solid var(--color-border)' }}>
                 <div style={{ padding: '4px 10px', background: '#fff', borderRadius: 99, fontSize: 10, fontWeight: 900, color: 'var(--color-accent)' }}>{selectedClient.risk}</div>
                 <p style={{ fontSize: 13, fontWeight: 700 }}>Em aberto: <span style={{ color: 'var(--color-danger)' }}>{fmt(Number(selectedClient.total_open))}</span></p>
              </div>
            )}
          </div>

          {/* VALORES */}
          <div className="card flex-col" style={{ gap: 16 }}>
            <div className="input-group">
              <label className="input-label">Valor do Empréstimo</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 16, top: 14, fontSize: 18, fontWeight: 800, color: 'var(--color-accent)' }}>R$</span>
                <input type="number" className="input-field" style={{ paddingLeft: 48, fontSize: 24, fontWeight: 950, height: 60, color: 'var(--color-accent)' }} value={amount} onChange={e => setAmount(e.target.value)} />
              </div>
            </div>

            <div className="grid-2">
              <div className="input-group">
                <label className="input-label">Taxa juros (%)</label>
                <input type="number" className="input-field" value={rate} onChange={e => setRate(e.target.value)} />
              </div>
              <div className="input-group">
                <label className="input-label">Nº Parcelas</label>
                <input type="number" className="input-field" value={installmentsCount} onChange={e => setInstallmentsCount(e.target.value)} />
              </div>
            </div>

            <div className="grid-2">
              <div className="input-group">
                <label className="input-label">Frequência</label>
                <select className="input-field" value={frequency} onChange={e => setFrequency(e.target.value as OperationFrequency)}>
                   <option value="diaria">Diária</option>
                   <option value="semanal">Semanal</option>
                   <option value="quinzenal">Quinzenal</option>
                   <option value="mensal">Mensal</option>
                </select>
              </div>
              <div className="input-group">
                <label className="input-label">Primeiro Pagto.</label>
                <input type="date" className="input-field" value={startDate} onChange={e => setStartDate(e.target.value)} />
              </div>
            </div>
          </div>

          {/* SIMULAÇÃO */}
          {simulation && (
            <div className="card flex-col fade-in" style={{ gap: 20, background: 'var(--color-accent)', color: '#fff', border: 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                   <p style={{ fontSize: 10, fontWeight: 800, opacity: 0.7 }}>PARCELAS</p>
                   <p style={{ fontSize: 26, fontWeight: 950 }}>{simulation.installments.length}x de {fmt(simulation.installment_amount)}</p>
                </div>
                <Receipt size={32} opacity={0.3} />
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.2)' }}>
                 <div>
                   <p style={{ fontSize: 10, fontWeight: 800, opacity: 0.7 }}>VENCIMENTO FINAL</p>
                   <p style={{ fontSize: 14, fontWeight: 800 }}>{new Date(simulation.installments[simulation.installments.length - 1].due_date).toLocaleDateString('pt-BR')}</p>
                 </div>
                 <div style={{ textAlign: 'right' }}>
                   <p style={{ fontSize: 10, fontWeight: 800, opacity: 0.7 }}>TAXA TOTAL</p>
                   <p style={{ fontSize: 14, fontWeight: 800 }}>{fmt(simulation.total_interest)}</p>
                 </div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.1)', padding: '14px', borderRadius: 16, textAlign: 'center' }}>
                 <p style={{ fontSize: 12, fontWeight: 700 }}>Total a receber: <span style={{ fontSize: 16, fontWeight: 950 }}>{fmt(simulation.total_amount)}</span></p>
              </div>

              <button className="btn" style={{ background: '#fff', color: 'var(--color-accent)', width: '100%', height: 56, fontSize: 16 }} onClick={handleRequestCreate} disabled={!clientId || loading}>
                <Lock size={22} /> {loading ? 'Processando...' : 'Liberar Crédito Agora'}
              </button>
            </div>
          )}

          {!simulation && (
            <div style={{ padding: '20px', textAlign: 'center', opacity: 0.5 }}>
               <Info size={32} style={{ marginBottom: 10 }} />
               <p style={{ fontSize: 13, fontWeight: 600 }}>Preencha os valores para simular.</p>
            </div>
          )}

        </div>
      </div>

      {showPinModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
           <div className="card flex-col fade-in" style={{ maxWidth: 400, width: '90%', padding: '32px', gap: 24 }}>
              <div style={{ textAlign: 'center' }}>
                 <div style={{ width: 64, height: 64, borderRadius: 20, background: 'var(--color-accent-light)', color: 'var(--color-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                    <Lock size={32} />
                 </div>
                 <h2 style={{ fontSize: 22, fontWeight: 950 }}>Autorizar Liberação</h2>
                 <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 8 }}>Digite seu PIN de segurança para liberar o valor de {fmt(parseFloat(amount))} para {selectedClient?.name}.</p>
              </div>
              <input type="password" placeholder="PIN" value={pinInput} onChange={e => { setPinInput(e.target.value); setError(''); }} className="input-field" style={{ textAlign: 'center', fontSize: 24, letterSpacing: '10px', height: 64 }} />
              {error && <p style={{ color: 'var(--color-danger)', fontSize: 12, fontWeight: 800, textAlign: 'center' }}>{error}</p>}
              <div className="flex-col gap-3">
                 <button className="btn btn-primary w-full" onClick={confirmCreate}>{loading ? 'Aguarde...' : 'Confirmar Lançamento'}</button>
                 <button className="btn btn-secondary w-full" onClick={() => { setShowPinModal(false); setPinInput(''); setError(''); }}>Cancelar</button>
              </div>
           </div>
        </div>
      )}

    </div>
  );
}
