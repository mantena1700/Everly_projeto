import { supabase, getOperations, getClients, saveOperation, saveInstallments } from './db';
import type { OperationFrequency, CreditOperation, Installment } from '../types';
import { simulateCredit } from './credits';

export const renegotiateOperation = async (
  operationId: string, 
  newRate: number, 
  newFrequency: OperationFrequency, 
  newInstallmentsCount: number,
  startDate: string,
  notes: string = ''
) => {
  const [ops, cls] = await Promise.all([
    getOperations(),
    getClients()
  ]);

  const oldOp = ops.find(o => o.id === operationId);
  if (!oldOp) throw new Error("Operação não encontrada");
  
  const principalLeftToPay = Number(oldOp.total_amount) - Number(oldOp.amount_paid);

  await supabase.from('operations').update({
    status: 'renegociada',
    notes: (oldOp.notes || '') + `\n[Renegociado em ${new Date().toLocaleDateString()}] -> Nova Base: ${principalLeftToPay}`
  }).eq('id', operationId);

  await supabase.from('installments').update({
    status: 'renegociada'
  }).eq('operation_id', operationId).neq('status', 'paga');

  const simulation = simulateCredit({
    client_id: oldOp.client_id,
    principal_amount: principalLeftToPay,
    interest_rate: newRate,
    frequency: newFrequency,
    installments_count: newInstallmentsCount,
    start_date: startDate
  });

  const newOpData: Omit<CreditOperation, 'id' | 'created_at'> = {
    client_id: oldOp.client_id,
    principal_amount: principalLeftToPay,
    interest_rate: newRate,
    total_amount: simulation.total_amount,
    amount_paid: 0,
    frequency: newFrequency,
    installments_count: newInstallmentsCount,
    start_date: startDate,
    status: 'ativa' as any,
    notes: `Renegociação originada da Operação [${oldOp.id}].\n${notes}`
  };

  const newOp = await saveOperation(newOpData);
  if (!newOp) return null;

  const generatedInstallments: Omit<Installment, 'id'>[] = simulation.installments.map(simInst => ({
    operation_id: newOp.id,
    client_id: oldOp.client_id,
    number: simInst.number,
    due_date: simInst.due_date,
    amount: simInst.amount,
    amount_paid: 0,
    late_fee: 0,
    status: 'pendente' as any
  }));

  await saveInstallments(generatedInstallments);

  const client = cls.find(c => c.id === oldOp.client_id);
  if (client) {
    await supabase.from('clients').update({
      total_open: Number(client.total_open) - principalLeftToPay + simulation.total_amount,
      risk: 'atencao'
    }).eq('id', oldOp.client_id);
  }

  return newOp;
};
