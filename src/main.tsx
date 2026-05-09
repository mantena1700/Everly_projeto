import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// No Supabase, a inicialização é feita no supabase.ts. 
// Cálculos de mora e migrações são feitos sob demanda ou via Database Functions.

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
