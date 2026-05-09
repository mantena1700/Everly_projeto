import { getClients, saveOperation, saveInstallments, supabase } from './db';
import type { OperationFrequency, CreditOperation, Installment } from '../types';

export interface CreditSimulationParams {
  client_id: string;
  principal_amount: number;
  interest_rate: number;
  frequency: OperationFrequency;
  installments_count: number;
  start_date: string;
}

export interface SimulationResult {
  principal: number;
  total_interest: number;
  total_amount: number;
  installment_amount: number;
  installments: Array<{ number: number; due_date: string; amount: number }>;
}

export const simulateCredit = (params: CreditSimulationParams): SimulationResult => {
  const { principal_amount, interest_rate, frequency, installments_count, start_date } = params;
  const interest = principal_amount * (interest_rate / 100);
  const total_amount = principal_amount + interest;
  const installment_amount = total_amount / installments_count;
  const installments = [];
  const baseDate = new Date(start_date);
  
  for (let i = 1; i <= installments_count; i++) {
    const due_date = new Date(baseDate);
    if (frequency === 'diaria') due_date.setDate(baseDate.getDate() + i);
    else if (frequency === 'semanal') due_date.setDate(baseDate.getDate() + (i * 7));
    else if (frequency === 'quinzenal') due_date.setDate(baseDate.getDate() + (i * 15));
    else if (frequency === 'mensal') due_date.setMonth(baseDate.getMonth() + i);
    else due_date.setMonth(baseDate.getMonth() + i);
    
    installments.push({ number: i, due_date: due_date.toISOString(), amount: installment_amount });
  }

  return {
    principal: principal_amount,
    total_interest: interest,
    total_amount,
    installment_amount,
    installments
  };
};

export const createOperation = async (simulation: SimulationResult, params: CreditSimulationParams) => {
  const newOpData: Omit<CreditOperation, 'id' | 'created_at'> = {
    client_id: params.client_id,
    principal_amount: params.principal_amount,
    interest_rate: params.interest_rate,
    total_amount: simulation.total_amount,
    amount_paid: 0,
    frequency: params.frequency,
    installments_count: params.installments_count,
    start_date: params.start_date,
    status: 'ativa' as any
  };
  
  const newOp = await saveOperation(newOpData);
  if (!newOp) return null;

  const generatedInstallments: Omit<Installment, 'id'>[] = simulation.installments.map(simInst => ({
    operation_id: newOp.id,
    client_id: params.client_id,
    number: simInst.number,
    due_date: simInst.due_date,
    amount: simInst.amount,
    late_fee: 0,
    amount_paid: 0,
    status: 'pendente' as any
  }));
  
  await saveInstallments(generatedInstallments);

  const clients = await getClients();
  const client = clients.find(c => c.id === params.client_id);
  if (client) {
    await supabase.from('clients').update({
      total_borrowed: Number(client.total_borrowed) + params.principal_amount,
      total_open: Number(client.total_open) + simulation.total_amount
    }).eq('id', params.client_id);
  }
  
  return newOp;
};
