import React, { useState } from 'react';
import Header from '../components/Header';
import { Save, X, User, Phone, MapPin, Tag, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { saveClient } from '../api/db';
import type { Client } from '../types';

export default function ClienteForm() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    house_number: '',
    notes: '',
    risk: 'novo' as Client['risk']
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    
    setLoading(true);
    try {
      const clientData: Omit<Client, 'id' | 'created_at'> = {
        ...formData,
        status: 'ativo',
        total_borrowed: 0,
        total_paid: 0,
        total_open: 0
      };
      
      const saved = await saveClient(clientData);
      if (saved) {
        navigate('/clientes');
      } else {
        alert('Erro ao salvar cliente na nuvem.');
      }
    } catch (err) {
      console.error(err);
      alert('Erro crítico ao salvar.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-col pb-24 h-full">
      <Header title="Novo Cliente" showBack={true} />
      
      <div className="page-content">
        <form onSubmit={handleSubmit} className="page">
          
          <div className="card flex-col" style={{ borderTop: '5px solid var(--color-accent)', padding: '24px', gap: 20 }}>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 900, marginBottom: 4 }}>Informações Pessoais</h2>
              <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 20 }}>Preencha os dados básicos para o cadastro.</p>
            </div>

            <div className="input-group">
              <label className="input-label">Nome Completo</label>
              <div style={{ position: 'relative' }}>
                <User size={18} style={{ position: 'absolute', left: 14, top: 15, color: 'var(--color-text-muted)' }} />
                <input type="text" className="input-field" style={{ paddingLeft: 44 }} placeholder="Nome do cliente" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required disabled={loading} />
              </div>
            </div>

            <div className="grid-2">
              <div className="input-group">
                <label className="input-label">WhatsApp</label>
                <div style={{ position: 'relative' }}>
                  <Phone size={18} style={{ position: 'absolute', left: 14, top: 15, color: 'var(--color-text-muted)' }} />
                  <input type="tel" className="input-field" style={{ paddingLeft: 44 }} placeholder="(00) 00000-0000" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} required disabled={loading} />
                </div>
              </div>
              <div className="input-group">
                <label className="input-label">Risco</label>
                <select className="input-field" value={formData.risk} onChange={e => setFormData({...formData, risk: e.target.value as Client['risk']})} disabled={loading}>
                  <option value="novo">Novo</option>
                  <option value="confiavel">Confiável</option>
                  <option value="atencao">Atenção</option>
                  <option value="risco">Alto Risco</option>
                </select>
              </div>
            </div>

            <div className="grid-2">
              <div className="input-group" style={{ gridColumn: 'span 2' }}>
                <label className="input-label">Endereço</label>
                <div style={{ position: 'relative' }}>
                  <MapPin size={18} style={{ position: 'absolute', left: 14, top: 15, color: 'var(--color-text-muted)' }} />
                  <input type="text" className="input-field" style={{ paddingLeft: 44 }} placeholder="Rua, Bairro..." value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} disabled={loading} />
                </div>
              </div>
              <div className="input-group" style={{ gridColumn: 'span 2' }}>
                 <label className="input-label">Nº Casa / Apto</label>
                 <div style={{ position: 'relative' }}>
                   <Tag size={18} style={{ position: 'absolute', left: 14, top: 15, color: 'var(--color-text-muted)' }} />
                   <input type="text" className="input-field" style={{ paddingLeft: 44 }} placeholder="Ex: 123 B" value={formData.house_number} onChange={e => setFormData({...formData, house_number: e.target.value})} required disabled={loading} />
                 </div>
              </div>
            </div>

            <div className="input-group">
              <label className="input-label">Observações</label>
              <div style={{ position: 'relative' }}>
                <FileText size={18} style={{ position: 'absolute', left: 14, top: 15, color: 'var(--color-text-muted)' }} />
                <textarea className="input-field" style={{ paddingLeft: 44, minHeight: 100, paddingTop: 14 }} placeholder="Alguma anotação importante?" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} disabled={loading} />
              </div>
            </div>
          </div>

          <div className="flex-col gap-3">
             <button type="submit" className="btn btn-primary" disabled={loading}>
               <Save size={20} /> {loading ? 'Cadastrando...' : 'Finalizar Cadastro'}
             </button>
             <button type="button" onClick={() => navigate(-1)} className="btn btn-secondary" disabled={loading}>
               <X size={20} /> Cancelar
             </button>
          </div>

        </form>
      </div>
    </div>
  );
}
