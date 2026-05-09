import { Shield, ChevronLeft, Bell } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';

interface HeaderProps { title: string; showBack?: boolean; }

export default function Header({ title, showBack = false }: HeaderProps) {
  const navigate = useNavigate();

  return (
    <header className="top-header">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {showBack ? (
          <button
            onClick={() => navigate(-1)}
            style={{ width: 40, height: 40, borderRadius: 14, background: 'var(--color-surface)', border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--color-text-primary)', flexShrink: 0, boxShadow: 'var(--shadow-sm)' }}
          >
            <ChevronLeft size={22} />
          </button>
        ) : (
          <div style={{ width: 36, height: 36, borderRadius: 12, background: 'var(--color-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: 'var(--shadow-accent)' }}>
            <Shield size={20} color="#fff" />
          </div>
        )}
        <span style={{ fontSize: 18, fontWeight: 850, color: 'var(--color-text-primary)' }}>{title}</span>
      </div>

      <Link to="/configuracoes" style={{ textDecoration: 'none' }}>
        <button style={{ width: 40, height: 40, borderRadius: 14, background: 'var(--color-surface)', border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative', color: 'var(--color-text-secondary)', boxShadow: 'var(--shadow-sm)' }}>
          <Bell size={20} />
          <span style={{ position: 'absolute', top: 10, right: 10, width: 8, height: 8, background: 'var(--color-accent)', borderRadius: '50%', border: '2px solid #fff' }} />
        </button>
      </Link>
    </header>
  );
}
