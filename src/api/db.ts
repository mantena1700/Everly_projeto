import { supabase as supabaseClient } from '../lib/supabase';
export const supabase = supabaseClient;
import type { Client, CreditOperation, Installment, Payment } from '../types';

export const getClients = async (): Promise<Client[]> => {
  const { data, error } = await supabase.from('clients').select('*').order('name', { ascending: true });
  if (error) { console.error(error); return []; }
  return data || [];
};

export const getOperations = async (clientId?: string): Promise<CreditOperation[]> => {
  let query = supabase.from('operations').select('*').order('created_at', { ascending: false });
  if (clientId) query = query.eq('client_id', clientId);
  const { data, error } = await query;
  if (error) { console.error(error); return []; }
  return data || [];
};

export const getInstallments = async (operationId?: string): Promise<Installment[]> => {
  let query = supabase.from('installments').select('*').order('due_date', { ascending: true });
  if (operationId) query = query.eq('operation_id', operationId);
  const { data, error } = await query;
  if (error) { console.error(error); return []; }
  return data || [];
};

export const getPayments = async (clientId?: string): Promise<Payment[]> => {
  let query = supabase.from('payments').select('*').order('date', { ascending: false });
  if (clientId) query = query.eq('client_id', clientId);
  const { data, error } = await query;
  if (error) { console.error(error); return []; }
  return data || [];
};

export const saveClient = async (client: Omit<Client, 'id' | 'created_at'>) => {
  const { data, error } = await supabase.from('clients').insert([client]).select();
  if (error) { console.error(error); return null; }
  return data ? data[0] : null;
};

export const saveOperation = async (op: Omit<CreditOperation, 'id' | 'created_at'>) => {
  const { data, error } = await supabase.from('operations').insert([op]).select();
  if (error) { console.error(error); return null; }
  return data ? data[0] : null;
};

export const saveInstallments = async (insts: Omit<Installment, 'id'>[]) => {
  const { data, error } = await supabase.from('installments').insert(insts).select();
  if (error) { console.error(error); return null; }
  return data;
};

export const savePayment = async (p: Omit<Payment, 'id'>) => {
  const { data, error } = await supabase.from('payments').insert([p]).select();
  if (error) { console.error(error); return null; }
  return data ? data[0] : null;
};

export const deleteOperation = async (operationId: string, clientId: string): Promise<boolean> => {
   try {
     const { data: op } = await supabase.from('operations').select('*').eq('id', operationId).single();
     if (!op) return false;

     await supabase.from('payments').delete().eq('operation_id', operationId);
     await supabase.from('installments').delete().eq('operation_id', operationId);
     const { error: delOpError } = await supabase.from('operations').delete().eq('id', operationId);
     if (delOpError) throw delOpError;

     const { data: remainingOps } = await supabase.from('operations').select('*').eq('client_id', clientId);
     
     const totalBorrowed = remainingOps?.reduce((a, o) => a + Number(o.principal_amount), 0) || 0;
     const totalReturnExpected = remainingOps?.filter(o => o.status !== 'cancelada').reduce((a, o) => a + Number(o.total_amount), 0) || 0;
     const totalPaid = remainingOps?.reduce((a, o) => a + Number(o.amount_paid), 0) || 0;

     await supabase.from('clients').update({
       total_borrowed: totalBorrowed,
       total_paid: totalPaid,
       total_open: Math.max(0, totalReturnExpected - totalPaid)
     }).eq('id', clientId);

     return true;
   } catch (err) {
     console.error("Erro ao deletar operação:", err);
     return false;
   }
};

export const deleteClient = async (clientId: string): Promise<boolean> => {
  try {
    await supabase.from('payments').delete().eq('client_id', clientId);
    await supabase.from('installments').delete().eq('client_id', clientId);
    await supabase.from('operations').delete().eq('client_id', clientId);
    const { error } = await supabase.from('clients').delete().eq('id', clientId);
    if (error) throw error;
    return true;
  } catch (err) {
    console.error("Erro ao deletar cliente:", err);
    return false;
  }
};

function downloadBlob(blob: Blob, fileName: string) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

export const exportCompleteDatabase = async () => {
  try {
    const [clients, operations, payments] = await Promise.all([
      getClients(),
      getOperations(),
      getPayments()
    ]);

    // CSV DE PAGAMENTOS (O que os usuários costumam querer abrir no Excel)
    let csv = "Data,Cliente,Valor,Tipo,Obs\n";
    payments.forEach(p => {
      const c = clients.find(cl => cl.id === p.client_id);
      const date = new Date(p.date).toLocaleDateString();
      csv += `${date},"${c?.name || 'N/A'}",${p.amount},${p.type},"${p.notes || ''}"\n`;
    });

    const csvBlob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(csvBlob, `relatorio_recebimentos_${new Date().toISOString().split('T')[0]}.csv`);

    // JSON COMPLETO (Para backup técnico)
    const jsonData = JSON.stringify({ clients, operations, payments, exported_at: new Date().toISOString() }, null, 2);
    const jsonBlob = new Blob([jsonData], { type: 'application/json' });
    downloadBlob(jsonBlob, `backup_sistema_completo.json`);
    
    return true;
  } catch (err) {
    console.error("Erro ao exportar:", err);
    return false;
  }
};

export const importDatabase = () => {
  console.log("Importação manual desativada na API cloud.");
  return false; 
};
