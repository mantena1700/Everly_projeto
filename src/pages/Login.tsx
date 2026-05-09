import { useState } from 'react';
import { Shield, Lock, User } from 'lucide-react';

interface LoginProps { onLogin: () => void; }

export default function Login({ onLogin }: LoginProps) {
  const [user, setUser]         = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError(false);
    if (!user || !password) return;
    
    setLoading(true);
    setTimeout(() => {
      // Busca a senha atual do localStorage (que pode ter sido alterada nas configurações)
      const savedPass = localStorage.getItem('app_password') || 'cmd';
      const savedUser = localStorage.getItem('app_user') || 'administrador';

      if (user === savedUser && password === savedPass) {
        onLogin();
      } else {
        setError(true);
        setLoading(false);
      }
    }, 800);
  };

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '32px 24px', minHeight: '100vh',
      background: 'var(--color-bg)',
    }}>
      <div style={{ textAlign: 'center', marginBottom: 48 }}>
        <div style={{ width: 72, height: 72, borderRadius: 22, background: 'var(--color-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', boxShadow: 'var(--shadow-accent)' }}>
          <Shield size={34} color="#fff" />
        </div>
        <h1 style={{ fontSize: 30, fontWeight: 900, color: 'var(--color-text-primary)', letterSpacing: '-1px', marginBottom: 6 }}>Painel de Controle</h1>
        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', fontWeight: 500 }}>Acesso Restrito ao Administrador</p>
      </div>

      <form onSubmit={handleLogin} style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {error && (
          <div style={{ padding: '12px', background: 'rgba(239,68,68,0.1)', border: '1px solid #EF4444', borderRadius: 12, color: '#EF4444', fontSize: 13, textAlign: 'center', marginBottom: 8 }}>
            Usuário ou senha inválidos.
          </div>
        )}
        
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 8 }}>Identificação</label>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', top: '50%', left: 14, transform: 'translateY(-50%)', color: 'var(--color-text-muted)', display: 'flex' }}><User size={17} /></span>
            <input type="text" className="input-field" style={{ paddingLeft: 42 }} placeholder="Seu usuário" value={user} onChange={e => setUser(e.target.value)} required />
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 8 }}>Chave de Acesso</label>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', top: '50%', left: 14, transform: 'translateY(-50%)', color: 'var(--color-text-muted)', display: 'flex' }}><Lock size={17} /></span>
            <input type="password" className="input-field" style={{ paddingLeft: 42 }} placeholder="Sua senha" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
        </div>

        <button type="submit" className="btn btn-primary" style={{ height: 54, fontSize: 16, marginTop: 8, opacity: loading ? 0.7 : 1 }} disabled={loading}>
          {loading ? 'Autenticando...' : 'Entrar no Sistema'}
        </button>
      </form>

      <div style={{ position: 'absolute', bottom: 28, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Lock size={11} color="var(--color-text-muted)" />
        <p style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Criptografia de Ponta-a-Ponta Ativa</p>
      </div>
    </div>
  );
}
