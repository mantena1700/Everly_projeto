import { Home, Users, Wallet, BarChart3, LogOut, Camera } from 'lucide-react';
import { useLocation, Link } from 'react-router-dom';

const navItems = [
  { to: '/',           label: 'Início',    icon: Home },
  { to: '/clientes',   label: 'Clientes',  icon: Users },
  { to: '/scan',       label: 'Escanear',  icon: Camera },
  { to: '/cobrancas',  label: 'Cobranças', icon: Wallet },
  { to: '/relatorios', label: 'Relatórios',icon: BarChart3 },
];

interface BottomNavProps {
  onLogout: () => void;
}

export default function BottomNav({ onLogout }: BottomNavProps) {
  const { pathname } = useLocation();
  const isActive = (to: string) => to === '/' ? pathname === '/' : pathname.startsWith(to.split('?')[0]);

  return (
    <nav className="bottom-nav">
      {navItems.map(({ to, label, icon: Icon }) => {
        const active = isActive(to);
        return (
          <Link key={to} to={to} className={`nav-item ${active ? 'active' : ''}`}>
            <Icon size={22} strokeWidth={active ? 2.5 : 1.8} color={active ? 'var(--color-accent)' : 'var(--color-text-muted)'} />
            <span style={{ fontSize: 10, fontWeight: active ? 700 : 500, color: active ? 'var(--color-accent)' : 'var(--color-text-muted)' }}>{label}</span>
          </Link>
        );
      })}
      <button onClick={onLogout} className="nav-item" style={{ border: 'none', background: 'none' }}>
        <LogOut size={22} color="var(--color-danger)" />
        <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--color-danger)' }}>Sair</span>
      </button>
    </nav>
  );
}
