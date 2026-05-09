import { supabase, getClients, getOperations, getInstallments, savePayment } from './db';
import type { Installment, Payment, CreditOperation, PaymentType } from '../types';

const LATE_FEE_RATE = 0.01; 

export const calcLateFee = (inst: Installment): number => {
  if (inst.status === 'paga' || inst.status === 'renegociada' || inst.status === 'cancelada') return 0;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due   = new Date(inst.due_date); due.setHours(0, 0, 0, 0);
  if (today <= due) return 0;
  const daysLate = Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
  const balance  = Number(inst.amount) - Number(inst.amount_paid);
  const fee      = balance * LATE_FEE_RATE * daysLate;
  return parseFloat(fee.toFixed(2));
};

export interface PaymentParams {
  installment_id: string;
  operation_id: string;
  client_id: string;
  payment_amount: number;
  payment_type: PaymentType;
  notes?: string;
  date?: string;
}

export const registerPayment = async (params: PaymentParams): Promise<Payment | null> => {
  const { payment_amount, installment_id, operation_id, client_id, payment_type, notes, date } = params;
  const TOLERANCE = 0.01;

  const [insts, ops, cls] = await Promise.all([
    getInstallments(),
    getOperations(),
    getClients()
  ]);

  const inst = insts.find(i => i.id === installment_id);
  const op = ops.find(o => o.id === operation_id);
  const client = cls.find(c => c.id === client_id);

  if (!inst || !op || !client) return null;

  const newPayment = await savePayment({
    operation_id,
    installment_id,
    client_id,
    amount: payment_amount,
    date: date || new Date().toISOString(),
    type: payment_type,
    notes,
  });

  if (!newPayment) return null;

  const newAmountPaidInst = Number(inst.amount_paid) + payment_amount;
  const late_fee = calcLateFee(inst);
  const totalDue = Number(inst.amount) + late_fee;
  
  let newStatus: Installment['status'] = 'pendente';
  if (newAmountPaidInst >= totalDue - TOLERANCE) newStatus = 'paga';
  else if (newAmountPaidInst > 0) newStatus = 'parcial';

  await supabase.from('installments').update({
    amount_paid: newAmountPaidInst,
    status: newStatus,
    late_fee: newStatus === 'paga' ? 0 : late_fee
  }).eq('id', installment_id);

  const newAmountPaidOp = Number(op.amount_paid) + payment_amount;
  let opStatus: CreditOperation['status'] = op.status;
  if (newAmountPaidOp >= Number(op.total_amount) - TOLERANCE) opStatus = 'quitada';

  await supabase.from('operations').update({
    amount_paid: newAmountPaidOp,
    status: opStatus
  }).eq('id', operation_id);

  await supabase.from('clients').update({
    total_paid: Number(client.total_paid) + payment_amount,
    total_open: Math.max(0, Number(client.total_open) - payment_amount)
  }).eq('id', client_id);

  return newPayment;
};

// NOVO: Quitação Total de Contrato
export const quitacaoTotalContrato = async (operation_id: string, client_id: string, payment_type: PaymentType): Promise<boolean> => {
  const allInsts = await getInstallments();
  const targetInsts = allInsts.filter(i => i.operation_id === operation_id && i.status !== 'paga');
  const ops = await getOperations();
  const op = ops.find(o => o.id === operation_id);
  const cls = await getClients();
  const client = cls.find(c => c.id === client_id);

  if (!op || !client) return false;

  const remainingValue = Number(op.total_amount) - Number(op.amount_paid);

  // 1. Criar registro de pagamento mestre
  await savePayment({
    operation_id,
    installment_id: targetInsts[0]?.id || '',
    client_id,
    amount: remainingValue,
    date: new Date().toISOString(),
    type: payment_type,
    notes: 'QUITAÇÃO ANTECIPADA TOTAL',
  });

  // 2. Atualizar todas as parcelas
  for (const inst of targetInsts) {
    await supabase.from('installments').update({
      amount_paid: Number(inst.amount),
      status: 'paga',
      late_fee: 0
    }).eq('id', inst.id);
  }

  // 3. Atualizar Operação
  await supabase.from('operations').update({
    amount_paid: Number(op.total_amount),
    status: 'quitada'
  }).eq('id', operation_id);

  // 4. Atualizar Cliente
  await supabase.from('clients').update({
    total_paid: Number(client.total_paid) + remainingValue,
    total_open: Math.max(0, Number(client.total_open) - remainingValue)
  }).eq('id', client_id);

  return true;
};
