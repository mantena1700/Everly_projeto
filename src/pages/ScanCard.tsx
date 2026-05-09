import React, { useState, useRef } from 'react';
import { Camera, Upload, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

// ==========================================
// CONFIGURAÇÕES DO APLICATIVO
// ==========================================
// Mude para false quando quiser rodar nos clientes reais
const MODO_TESTE = false;
// ==========================================

export default function ScanCard() {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'idle' | 'success' | 'error', message: string }>({ type: 'idle', message: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setImageFile(file);
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      setStatus({ type: 'idle', message: '' });
    }
  };

  const processImage = async () => {
    if (!imageFile || !imagePreview) return;
    
    setLoading(true);
    setStatus({ type: 'idle', message: 'Analisando caligrafia e marcações do cartão com IA...' });

    try {
      // 1. Enviar para a OpenAI
      const base64Image = imagePreview.split(',')[1]; // Pega apenas a base64 (remove o data:image/jpeg;base64,)
      
      const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error("Chave da OpenAI não encontrada (VITE_OPENAI_API_KEY).");
      }

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Você é um sistema financeiro lendo um cartão físico de cobrança. Extraia os dados e gere OBRIGATORIAMENTE a lista completa com TODAS as parcelas do empréstimo.
                  
                  Retorne EXATAMENTE neste formato JSON:
                  {
                    "cliente": "Nome do Cliente",
                    "valor_total_emprestimo": 1000.00,
                    "frequencia": "mensal", 
                    "todas_as_parcelas": [
                      {"numero": 1, "data_vencimento": "2023-10-01", "valor": 50.00, "status": "paga"},
                      {"numero": 2, "data_vencimento": "2023-11-01", "valor": 50.00, "status": "pendente"}
                    ]
                  }
                  
                  REGRAS CRÍTICAS DE PREENCHIMENTO:
                  1. O número de objetos na array 'todas_as_parcelas' DEVE ser EXATAMENTE IGUAL ao número total de parcelas do cartão. (ex: se o cartão é de 20x, a array terá 20 objetos de 1 a 20). NUNCA DEIXE DE FORA AS PARCELAS VAZIAS!
                  2. Para as parcelas assinadas/preenchidas na imagem, copie a data exata que está escrita e marque o status como "paga".
                  3. Para os quadrados/linhas VAZIOS, você DEVE gerar as parcelas correspondentes na array e marcá-las como "pendente".
                  4. CALCULE LOGICAMENTE a "data_vencimento" das parcelas pendentes: pegue a data da última parcela paga e some +1 semana (se semanal), +15 dias (se quinzenal) ou +1 mês (se mensal). NÃO CRIE DATAS ALEATÓRIAS!
                  5. O valor financeiro de cada parcela DEVE ser o mesmo valor das parcelas anteriores. Se não estiver claro, divida o valor total pelo número de parcelas.
                  6. IMPORTANTE: Valores financeiros (valor, valor_total_emprestimo) DEVEM ser do tipo Number (ex: 1500.50), sem aspas ou vírgulas!
                  7. Retorne apenas JSON puro, sem formatação markdown.`
                },
                { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}`, detail: "high" } }
              ]
            }
          ],
          response_format: { type: "json_object" }
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error(errorData);
        throw new Error("Erro na comunicação com a IA.");
      }

      const responseData = await response.json();
      const aiContent = responseData.choices[0].message.content;
      const data = JSON.parse(aiContent);

      setStatus({ type: 'idle', message: 'Dados extraídos! Injetando no banco de dados...' });

      await injectToDatabase(data);

      setStatus({ type: 'success', message: `Cartão de ${data.cliente} processado e injetado com sucesso!` });
      setImageFile(null);
      setImagePreview(null);
    } catch (err: any) {
      console.error(err);
      setStatus({ type: 'error', message: err.message || 'Ocorreu um erro ao processar a imagem.' });
    } finally {
      setLoading(false);
    }
  };

  const injectToDatabase = async (data: any) => {
    if (!data || !data.cliente) throw new Error("A IA não encontrou o nome do cliente no cartão.");

    const targetName = MODO_TESTE ? `[TESTE DO ROBÔ] ${data.cliente}` : data.cliente;
    
    // 1. Busca Cliente
    let { data: clients } = await supabase.from('clients').select('*').ilike('name', `%${data.cliente}%`);
    let clientId;
    let clientData;

    if (clients && clients.length > 0) {
      clientId = clients[0].id;
      clientData = clients[0];
    } else {
      const { data: newClient, error: clientErr } = await supabase.from('clients').insert([{ 
        name: targetName, phone: '00000000000', status: 'ativo', risk: 'novo', 
        total_borrowed: 0, total_paid: 0, total_open: 0
      }]).select().single();
        
      if (clientErr) throw clientErr;
      clientId = newClient.id;
      clientData = newClient;
    }

    const numParcelas = data.todas_as_parcelas ? data.todas_as_parcelas.length : 1;

    // 2. Cria Operação
    const valorEmprestimoTratado = parseFloat(data.valor_total_emprestimo) || 0;
    const { data: operation, error: opErr } = await supabase.from('operations').insert([{
      client_id: clientId,
      principal_amount: valorEmprestimoTratado,
      interest_rate: 0,
      total_amount: valorEmprestimoTratado,
      amount_paid: 0,
      frequency: data.frequencia || 'mensal',
      installments_count: numParcelas,
      start_date: new Date().toISOString(),
      status: 'ativa'
    }]).select().single();

    if (opErr) throw opErr;

    // 3. Insere Parcelas e Pagamentos
    if (data.todas_as_parcelas && data.todas_as_parcelas.length > 0) {
      let totalPaidInThisCard = 0;

      for (const p of data.todas_as_parcelas) {
        const isPaid = p.status === 'paga';
        const valorParcelaOriginal = parseFloat(p.valor);
        const valorParcela = isNaN(valorParcelaOriginal) ? (valorEmprestimoTratado / numParcelas) : valorParcelaOriginal;
        
        const { data: installment, error: instErr } = await supabase.from('installments').insert([{
          operation_id: operation.id, client_id: clientId, number: p.numero,
          due_date: new Date(p.data_vencimento || new Date()).toISOString(),
          amount: valorParcela, late_fee: 0, amount_paid: isPaid ? valorParcela : 0,
          status: isPaid ? 'paga' : 'pendente'
        }]).select().single();

        if (instErr) continue;

        if (isPaid) {
          const { error: payErr } = await supabase.from('payments').insert([{
            operation_id: operation.id, installment_id: installment.id, client_id: clientId,
            amount: valorParcela, date: new Date(p.data_vencimento || new Date()).toISOString(),
            type: 'exato', notes: 'Baixa automática via App (Foto)'
          }]);

          if (!payErr) totalPaidInThisCard += valorParcela;
        }
      }

      // 4. Atualiza Saldos
      await supabase.from('operations').update({ amount_paid: totalPaidInThisCard }).eq('id', operation.id);
      
      const newTotalBorrowed = Number(clientData.total_borrowed || 0) + valorEmprestimoTratado;
      const newTotalPaid = Number(clientData.total_paid || 0) + totalPaidInThisCard;
      
      await supabase.from('clients').update({ 
        total_borrowed: newTotalBorrowed, total_paid: newTotalPaid, total_open: newTotalBorrowed - newTotalPaid
      }).eq('id', clientId);
    }
  };

  return (
    <div className="page fade-in">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--color-text-primary)' }}>Escanear Cartão</h1>
        {MODO_TESTE && <div className="badge badge-warning" style={{ backgroundColor: '#FEF08A', color: '#854D0E' }}>MODO TESTE</div>}
      </div>

      <p style={{ color: 'var(--color-text-secondary)', fontSize: 14, marginBottom: 20 }}>
        Tire uma foto ou selecione a imagem do cartão físico do cliente. O robô irá ler a caligrafia e injetar os dados automaticamente.
      </p>

      {/* Upload Box */}
      {!imagePreview ? (
        <div 
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: '2px dashed var(--color-border)', borderRadius: 20, padding: '40px 20px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            backgroundColor: '#fff', cursor: 'pointer', transition: '0.2s', gap: 12
          }}
        >
          <div style={{ width: 64, height: 64, borderRadius: 20, background: 'var(--color-accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Camera size={32} color="var(--color-accent)" />
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontWeight: 700, fontSize: 16, color: 'var(--color-text-primary)' }}>Abrir Câmera / Galeria</p>
            <p style={{ fontWeight: 500, fontSize: 12, color: 'var(--color-text-muted)' }}>Toque aqui para capturar o cartão</p>
          </div>
          <input 
            type="file" ref={fileInputRef} onChange={handleFileSelect} 
            accept="image/*" capture="environment" style={{ display: 'none' }} 
          />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ position: 'relative', borderRadius: 20, overflow: 'hidden', border: '1px solid var(--color-border)', backgroundColor: '#fff', padding: 8 }}>
            <img src={imagePreview} alt="Preview" style={{ width: '100%', height: 300, objectFit: 'contain', borderRadius: 12 }} />
            {!loading && (
              <button 
                onClick={() => { setImageFile(null); setImagePreview(null); }}
                style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(0,0,0,0.5)', color: '#fff', border: 'none', borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                ✕
              </button>
            )}
          </div>

          {status.message && status.type !== 'idle' && (
            <div style={{ 
              padding: 16, borderRadius: 16, display: 'flex', alignItems: 'center', gap: 12,
              backgroundColor: status.type === 'success' ? '#DCFCE7' : '#FEE2E2',
              color: status.type === 'success' ? '#166534' : '#991B1B'
            }}>
              {status.type === 'success' ? <CheckCircle size={24} /> : <AlertCircle size={24} />}
              <p style={{ fontSize: 14, fontWeight: 600 }}>{status.message}</p>
            </div>
          )}

          {status.type === 'idle' && status.message && (
             <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
               <Loader2 size={18} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
               {status.message}
               <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
             </div>
          )}

          <button 
            className="btn btn-primary" 
            onClick={processImage} 
            disabled={loading}
            style={{ width: '100%', opacity: loading ? 0.7 : 1, marginTop: 8 }}
          >
            {loading ? 'Processando Cartão...' : 'Extrair e Salvar no Banco'}
            {!loading && <Upload size={20} />}
          </button>
        </div>
      )}
    </div>
  );
}
