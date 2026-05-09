export type ClientStatus = 'ativo' | 'em_atencao' | 'inadimplente' | 'bloqueado' | 'quitado';
export type ClientRisk = 'novo' | 'confiavel' | 'atencao' | 'risco' | 'bloqueado';

export interface Client {
  id: string;
  name: string;
  phone: string;
  phone_secondary?: string;
  address?: string;
  house_number?: string;
  status: ClientStatus;
  risk: ClientRisk;
  total_borrowed: number;
  total_paid: number;
  total_open: number;
  notes?: string;
  created_at: string;
}

export type OperationFrequency = 'diaria' | 'semanal' | 'quinzenal' | 'mensal' | 'personalizada';
export type OperationStatus = 'ativa' | 'pendente' | 'atrasada' | 'renegociada' | 'quitada' | 'cancelada';

export interface CreditOperation {
  id: string;
  client_id: string;
  principal_amount: number;
  interest_rate: number; // Percentual
  total_amount: number; // principal + interest
  amount_paid: number; // Track progress
  frequency: OperationFrequency;
  installments_count: number;
  start_date: string;
  status: OperationStatus;
  notes?: string;
  created_at: string;
}

export type InstallmentStatus = 'pendente' | 'paga' | 'parcial' | 'atrasada' | 'renegociada' | 'cancelada';

export interface Installment {
  id: string;
  operation_id: string;
  client_id: string;
  number: number;
  due_date: string;
  amount: number;              // Valor original da parcela
  late_fee: number;           // Juros de mora acumulados (1%/dia)
  amount_paid: number;
  status: InstallmentStatus;
}

export type PaymentType = 'exato' | 'parcial' | 'maior' | 'quitacao' | 'antecipacao';

export interface Payment {
  id: string;
  operation_id: string;
  installment_id?: string;
  client_id: string;          // Needed for reports
  amount: number;
  date: string;
  type: PaymentType;
  notes?: string;
}
