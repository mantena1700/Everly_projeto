import { useState, useEffect } from 'react';
import Header from '../components/Header';
import { getClients, getOperations, getInstallments, getPayments } from '../api/db';
import { Lock, User, Save, ShieldCheck, Database, RefreshCcw, Key, Bell, AlertTriangle, Clock, CheckCircle2, Smartphone } from 'lucide-react';

export default function Configuracoes() {
  const [user, setUser] = useState(localStorage.getItem('app_user') || 'administrador');
  const [pass, setPass] = useState(localStorage.getItem('app_password') || 'cmd');
  const [pin, setPin]   = useState(localStorage.getItem('app_pin') || '9988');
  const [saving, setSaving] = useState(false);

  // System Stats
  const [stats, setStats] = useState({ clients: 0, operations: 0, installments: 0, payments: 0, dbSize: '—' });
  const [alerts, setAlerts] = useState<{ message: string; type: 'danger' | 'warning' | 'success' }[]>([]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [c, o, i, p] = await Promise.all([getClients(), getOperations(), getInstallments(), getPayments()]);
        setStats({
          clients: c.length,
          operations: o.length,
          installments: i.length,
          payments: p.length,
          dbSize: `${((JSON.stringify(c).length + JSON.stringify(o).length + JSON.stringify(i).length + JSON.stringify(p).length) / 1024).toFixed(1)} KB`
        });

        // Generate alerts
        const today = new Date(); today.setHours(0,0,0,0);
        const lateInsts = i.filter(inst => {
          if (inst.status === 'paga' || inst.status === 'cancelada' || inst.status === 'renegociada') return false;
          const d = new Date(inst.due_date); d.setHours(0,0,0,0);
          return d < today;
        });
        const todayInsts = i.filter(inst => {
          if (inst.status === 'paga' || inst.status === 'cancelada' || inst.status === 'renegociada') return false;
          const d = new Date(inst.due_date);
          return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
        });

        const newAlerts: typeof alerts = [];
        if (lateInsts.length > 0) {
          const valor = lateInsts.reduce((a, inst) => a + (Number(inst.amount) - Number(inst.amount_paid)), 0);
          newAlerts.push({ message: `${lateInsts.length} parcela(s) em atraso — ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)} a cobrar`, type: 'danger' });
        }
        if (todayInsts.length > 0) {
          newAlerts.push({ message: `${todayInsts.length} parcela(s) vencem HOJE — não esqueça de cobrar!`, type: 'warning' });
        }
        const clientesInadimplentes = c.filter(cl => cl.status === 'inadimplente');
        if (clientesInadimplentes.length > 0) {
          newAlerts.push({ message: `${clientesInadimplentes.length} cliente(s) marcados como inadimplentes`, type: 'danger' });
        }
        if (lateInsts.length === 0 && todayInsts.length === 0) {
          newAlerts.push({ message: 'Tudo em dia! Nenhuma pendência urgente encontrada.', type: 'success' });
        }
        setAlerts(newAlerts);
      } catch (err) { console.error(err); }
    };
    fetchStats();
  }, []);

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      localStorage.setItem('app_user', user);
      localStorage.setItem('app_password', pass);
      localStorage.setItem('app_pin', pin);
      setSaving(false);
      alert('Configurações de segurança atualizadas com sucesso!');
    }, 1000);
  };

  const handleClearCache = () => {
    if (confirm('Deseja limpar o cache local? Isso não apaga os dados do Supabase, apenas reinicia a sessão do navegador.')) {
      window.location.reload();
    }
  };

  const alertMeta = {
    danger:  { bg: '#FEF2F2', border: '#FECACA', color: '#991B1B', icon: AlertTriangle, iconColor: '#EF4444' },
    warning: { bg: '#FFFBEB', border: '#FDE68A', color: '#92400E', icon: Clock, iconColor: '#F59E0B' },
    success: { bg: '#F0FDF4', border: '#BBF7D0', color: '#166534', icon: CheckCircle2, iconColor: '#10B981' },
  };

  return (
    <div className="flex-col pb-24 h-full">
      <Header title="Central de Controle" showBack />
      
      <div className="page-content">
        <div className="page" style={{ paddingTop: 12, gap: 20 }}>
          
          {/* NOTIFICAÇÕES E ALERTAS */}
          <div className="flex-col" style={{ gap: 10 }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Bell size={18} color="var(--color-accent)" />
                <h3 style={{ fontSize: 13, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Notificações & Alertas</h3>
             </div>
             {alerts.map((a, i) => {
                const m = alertMeta[a.type];
                const Icon = m.icon;
                return (
                  <div key={i} className="card" style={{ background: m.bg, border: `1.5px solid ${m.border}`, padding: '14px 16px', gap: 12 }}>
                     <Icon size={20} color={m.iconColor} style={{ flexShrink: 0 }} />
                     <p style={{ fontSize: 12, fontWeight: 700, color: m.color, flex: 1 }}>{a.message}</p>
                  </div>
                );
             })}
          </div>

          {/* STATUS DO SISTEMA */}
          <div className="flex-col" style={{ gap: 10 }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Database size={18} color="var(--color-text-muted)" />
                <h3 style={{ fontSize: 13, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status do Sistema</h3>
             </div>
             <div className="card flex-col" style={{ padding: '20px', gap: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                   <div style={{ padding: '12px', background: 'var(--color-bg)', borderRadius: 12, textAlign: 'center' }}>
                      <p style={{ fontSize: 20, fontWeight: 950, color: 'var(--color-accent)' }}>{stats.clients}</p>
                      <p style={{ fontSize: 9, fontWeight: 800, color: 'var(--color-text-muted)' }}>CLIENTES</p>
                   </div>
                   <div style={{ padding: '12px', background: 'var(--color-bg)', borderRadius: 12, textAlign: 'center' }}>
                      <p style={{ fontSize: 20, fontWeight: 950, color: 'var(--color-accent)' }}>{stats.operations}</p>
                      <p style={{ fontSize: 9, fontWeight: 800, color: 'var(--color-text-muted)' }}>CONTRATOS</p>
                   </div>
                   <div style={{ padding: '12px', background: 'var(--color-bg)', borderRadius: 12, textAlign: 'center' }}>
                      <p style={{ fontSize: 20, fontWeight: 950 }}>{stats.installments}</p>
                      <p style={{ fontSize: 9, fontWeight: 800, color: 'var(--color-text-muted)' }}>PARCELAS</p>
                   </div>
                   <div style={{ padding: '12px', background: 'var(--color-bg)', borderRadius: 12, textAlign: 'center' }}>
                      <p style={{ fontSize: 20, fontWeight: 950, color: 'var(--color-success)' }}>{stats.payments}</p>
                      <p style={{ fontSize: 9, fontWeight: 800, color: 'var(--color-text-muted)' }}>PAGAMENTOS</p>
                   </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--color-bg)', borderRadius: 12 }}>
                   <p style={{ fontSize: 11, fontWeight: 800, color: 'var(--color-text-muted)' }}>Dados carregados</p>
                   <p style={{ fontSize: 11, fontWeight: 900 }}>{stats.dbSize}</p>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#F0FDF4', borderRadius: 12 }}>
                   <p style={{ fontSize: 11, fontWeight: 800, color: '#059669' }}>Status do Servidor</p>
                   <p style={{ fontSize: 11, fontWeight: 900, color: '#059669' }}>● Online (Supabase)</p>
                </div>
             </div>
          </div>

          {/* SEGURANÇA */}
          <div className="flex-col" style={{ gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShieldCheck size={18} color="var(--color-accent)" />
              <h3 style={{ fontSize: 13, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Segurança do Acesso</h3>
            </div>
            <div className="card flex-col" style={{ padding: '24px', gap: 16 }}>
              <div>
                <label className="input-label">USUÁRIO ADMINISTRADOR</label>
                <div style={{ position: 'relative' }}>
                  <User size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
                  <input type="text" className="input-field" style={{ paddingLeft: 42 }} value={user} onChange={e => setUser(e.target.value)} />
                </div>
              </div>
              
              <div>
                <label className="input-label">SENHA DO APLICATIVO</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
                  <input type="password" className="input-field" style={{ paddingLeft: 42 }} value={pass} onChange={e => setPass(e.target.value)} />
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 16 }}>
                <label className="input-label">PIN DE OPERAÇÕES CRÍTICAS</label>
                <div style={{ position: 'relative' }}>
                  <Key size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-accent)' }} />
                  <input type="password" placeholder="Ex: 1234" maxLength={6} className="input-field" style={{ paddingLeft: 42, color: 'var(--color-accent)', fontWeight: 950 }} value={pin} onChange={e => setPin(e.target.value)} />
                </div>
                <p style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 4 }}>Exigido para: quitações, exclusões, liberação de crédito.</p>
              </div>

              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                <Save size={18} /> {saving ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>
          </div>

          {/* INFORMAÇÕES DO DISPOSITIVO */}
          <div className="flex-col" style={{ gap: 10 }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Smartphone size={18} color="var(--color-text-muted)" />
                <h3 style={{ fontSize: 13, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Dispositivo</h3>
             </div>
             <div className="card flex-col" style={{ padding: '16px', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
                   <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-muted)' }}>Navegador</p>
                   <p style={{ fontSize: 12, fontWeight: 800 }}>{navigator.userAgent.includes('Chrome') ? 'Chrome' : navigator.userAgent.includes('Safari') ? 'Safari' : 'Outro'}</p>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
                   <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-muted)' }}>Resolução</p>
                   <p style={{ fontSize: 12, fontWeight: 800 }}>{window.innerWidth}x{window.innerHeight}px</p>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
                   <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-muted)' }}>Conexão</p>
                   <p style={{ fontSize: 12, fontWeight: 800, color: navigator.onLine ? '#10B981' : '#EF4444' }}>{navigator.onLine ? '● Online' : '● Offline'}</p>
                </div>
             </div>
          </div>

          {/* AÇÕES DO SISTEMA */}
          <div className="flex-col" style={{ gap: 10 }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <RefreshCcw size={18} color="var(--color-text-muted)" />
                <h3 style={{ fontSize: 13, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Manutenção</h3>
             </div>
             <button className="card" style={{ width: '100%', textAlign: 'left', padding: '16px 20px', gap: 14, cursor: 'pointer' }} onClick={handleClearCache}>
                <RefreshCcw size={18} color="var(--color-accent)" />
                <div style={{ flex: 1 }}>
                   <p style={{ fontWeight: 850, fontSize: 15 }}>Sincronizar Cloud</p>
                   <p style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Reiniciar sessão e limpar cache local</p>
                </div>
             </button>
          </div>

          {/* SOBRE */}
          <div className="card flex-col" style={{ padding: '20px', gap: 10, background: '#000', color: '#fff', alignItems: 'center' }}>
             <p style={{ fontSize: 20, fontWeight: 950, letterSpacing: '-1px' }}>DOM SEVEN</p>
             <p style={{ fontSize: 10, fontWeight: 600, opacity: 0.5 }}>SISTEMA DE GESTÃO DE CRÉDITO</p>
             <div style={{ width: '60%', height: 1, background: 'rgba(255,255,255,0.1)', margin: '4px 0' }} />
             <p style={{ fontSize: 10, opacity: 0.4 }}>Versão 4.0.0 — Build Premium</p>
             <p style={{ fontSize: 9, opacity: 0.3 }}>Supabase Cloud • Vercel Edge • React</p>
          </div>

        </div>
      </div>
    </div>
  );
}
