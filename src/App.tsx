import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import BottomNav from './components/BottomNav';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import ClienteList from './pages/ClienteList';
import ClienteForm from './pages/ClienteForm';
import CreateCredit from './pages/CreateCredit';
import Cobrancas from './pages/Cobrancas';
import CheckoutPayment from './pages/CheckoutPayment';
import Inadimplentes from './pages/Inadimplentes';
import Renegociacao from './pages/Renegociacao';
import Relatorios from './pages/Relatorios';
import ClientePerfil from './pages/ClientePerfil';
import Configuracoes from './pages/Configuracoes';
import ScanCard from './pages/ScanCard';

function Layout({ children, onLogout }: { children: React.ReactNode, onLogout: () => void }) {
  return (
    <div className="app-container">
      <div className="page-content bg-base">
        {children}
      </div>
      <BottomNav onLogout={onLogout} />
    </div>
  );
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('login_auth') === 'true';
  });

  const login = () => {
    localStorage.setItem('login_auth', 'true');
    setIsAuthenticated(true);
  };

  const logout = () => {
    if (window.confirm("Deseja realmente sair do sistema?")) {
      localStorage.removeItem('login_auth');
      setIsAuthenticated(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="app-container">
        <Login onLogin={login} />
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout onLogout={logout}><Dashboard /></Layout>} />
        <Route path="/clientes" element={<Layout onLogout={logout}><ClienteList /></Layout>} />
        <Route path="/clientes/novo" element={<Layout onLogout={logout}><ClienteForm /></Layout>} />
        <Route path="/clientes/:id" element={<Layout onLogout={logout}><ClientePerfil /></Layout>} />
        <Route path="/creditos/novo" element={<Layout onLogout={logout}><CreateCredit /></Layout>} />
        <Route path="/cobrancas" element={<Layout onLogout={logout}><Cobrancas /></Layout>} />
        <Route path="/pagamentos/novo/:id" element={<Layout onLogout={logout}><CheckoutPayment /></Layout>} />
        <Route path="/inadimplentes" element={<Layout onLogout={logout}><Inadimplentes /></Layout>} />
        <Route path="/renegociar/:id" element={<Layout onLogout={logout}><Renegociacao /></Layout>} />
        <Route path="/relatorios" element={<Layout onLogout={logout}><Relatorios /></Layout>} />
        <Route path="/configuracoes" element={<Layout onLogout={logout}><Configuracoes /></Layout>} />
        <Route path="/scan" element={<Layout onLogout={logout}><ScanCard /></Layout>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
