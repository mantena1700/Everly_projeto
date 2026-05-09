import { getOperations, getInstallments, getPayments, getClients } from './db';
import type { Installment } from '../types';

export interface DashboardMetrics {
  // Pulso do Dia
  totalAReceberHoje: number;
  totalRecebidoHoje: number;
  totalAtraso: number;
  clientesParaCobrarHoje: number;
  clientesAtivos: number;
  vencemHoje: Installment[];
  atrasados: Installment[];

  // Carteira Global
  totalCapitalEmprestado: number;
  totalRetornoEsperado: number;
  lucroProjetado: number;

  // Projeções
  projecao7Dias: number;
  projecao30Dias: number;
  taxaInadimplencia: number;
  lucroRealizado: number;
  ticketMedio: number;

  // Ultra-Premium
  rankingFidelidade: { name: string, score: number }[];
  mixCarteira: { label: string, value: number, color: string }[];
  fluxoSemanal: { dia: string, valor: number }[];

  // NOVOS: cruzamento total
  totalClientes: number;
  totalContratosAtivos: number;
  totalContratosQuitados: number;
  totalContratosGeral: number;
  totalParcelasAbertas: number;
  totalParcelasAtrasadas: number;
  totalParcelasPagas: number;
  totalGlobalEmprestado: number;
  totalGlobalRecebido: number;
  totalGlobalAberto: number;
  parcelasVencemEssaSemana: number;
  valorVenceSemana: number;
  clientesInadimplentes: { name: string, phone: string, valor: number }[];
  maioresDevedores: { name: string, aberto: number }[];
  recebimentosMes: number;
  recebimentosSemana: number;
  contratosEsteMes: number;
}

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const isToday = (dateStr: string) => {
  const d = new Date(dateStr);
  const today = new Date();
  return d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear();
};

const isWithinDays = (dateStr: string, days: number) => {
  const d = new Date(dateStr);
  const target = new Date();
  target.setDate(target.getDate() + days);
  const now = new Date();
  return d > now && d <= target;
};

const isThisMonth = (dateStr: string) => {
  const d = new Date(dateStr);
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
};

const isThisWeek = (dateStr: string) => {
  const d = new Date(dateStr);
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0,0,0,0);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7);
  return d >= startOfWeek && d < endOfWeek;
};

export const getDashboardMetrics = async (): Promise<DashboardMetrics> => {
  const [ops, insts, payments, clients] = await Promise.all([
    getOperations(),
    getInstallments(),
    getPayments(),
    getClients()
  ]);

  const activeOps = ops.filter(o => o.status === 'ativa' || o.status === 'atrasada');
  const openInsts = insts.filter(i => i.status !== 'paga' && i.status !== 'renegociada' && i.status !== 'cancelada');
  
  const todayInsts = openInsts.filter(i => isToday(i.due_date));
  const lateInsts = openInsts.filter(i => new Date(i.due_date) < new Date() && !isToday(i.due_date));
  const todayPayments = payments.filter(p => isToday(p.date));

  const p7 = openInsts.filter(i => isWithinDays(i.due_date, 7)).reduce((a, i) => a + (Number(i.amount) - Number(i.amount_paid)), 0);
  const p30 = openInsts.filter(i => isWithinDays(i.due_date, 30)).reduce((a, i) => a + (Number(i.amount) - Number(i.amount_paid)), 0);

  const saldoTotalDevedor = openInsts.reduce((a, i) => a + (Number(i.amount) - Number(i.amount_paid)), 0);
  const valAtraso = lateInsts.reduce((a, i) => a + (Number(i.amount) - Number(i.amount_paid)), 0);
  const taxaInadimplencia = saldoTotalDevedor > 0 ? (valAtraso / saldoTotalDevedor) * 100 : 0;

  // Mix de Carteira
  const mixMap = activeOps.reduce((acc: any, op) => {
    acc[op.frequency] = (acc[op.frequency] || 0) + 1;
    return acc;
  }, {});
  const mixCarteira = [
    { label: 'Diário', value: mixMap.diaria || 0, color: '#10B981' },
    { label: 'Semanal', value: mixMap.semanal || 0, color: '#3B82F6' },
    { label: 'Quinzenal', value: mixMap.quinzenal || 0, color: '#8B5CF6' },
    { label: 'Mensal', value: mixMap.mensal || 0, color: '#F59E0B' },
  ];

  // Ranking de Fidelidade
  const rankingFidelidade = clients
    .map(c => ({
      name: c.name,
      score: payments.filter(p => p.client_id === c.id).length,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  // Fluxo Semanal
  const fluxoSemanal = Array.from({ length: 7 }).map((_, idx) => {
    const d = new Date();
    d.setDate(d.getDate() + idx);
    const dateStr = d.toISOString().split('T')[0];
    const valor = openInsts
      .filter(i => i.due_date === dateStr)
      .reduce((a, i) => a + (Number(i.amount) - Number(i.amount_paid)), 0);
    return { dia: DIAS_SEMANA[d.getDay()], valor };
  });

  const totalGlobalRecebido = payments.reduce((a, p) => a + Number(p.amount), 0);
  const totalGlobalEmprestado = ops.reduce((a, o) => a + Number(o.principal_amount), 0);
  const lucroRealizado = totalGlobalRecebido - totalGlobalEmprestado;

  // Parcelas que vencem essa semana
  const weekInsts = openInsts.filter(i => isWithinDays(i.due_date, 7));

  // Clientes inadimplentes (com parcelas atrasadas)
  const inadimplentesMap = new Map<string, number>();
  lateInsts.forEach(i => {
    const prev = inadimplentesMap.get(i.client_id) || 0;
    inadimplentesMap.set(i.client_id, prev + (Number(i.amount) - Number(i.amount_paid)));
  });
  const clientesInadimplentes = Array.from(inadimplentesMap.entries())
    .map(([id, valor]) => {
      const c = clients.find(cl => cl.id === id);
      return { name: c?.name || '—', phone: c?.phone || '', valor };
    })
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 5);

  // Maiores devedores
  const maioresDevedores = clients
    .filter(c => Number(c.total_open) > 0)
    .map(c => ({ name: c.name, aberto: Number(c.total_open) }))
    .sort((a, b) => b.aberto - a.aberto)
    .slice(0, 5);

  return {
    totalAReceberHoje: todayInsts.reduce((a, i) => a + (Number(i.amount) - Number(i.amount_paid)), 0),
    totalRecebidoHoje: todayPayments.reduce((a, p) => a + Number(p.amount), 0),
    totalAtraso: valAtraso,
    clientesParaCobrarHoje: new Set(todayInsts.map(i => i.client_id)).size,
    clientesAtivos: new Set(activeOps.map(o => o.client_id)).size,
    totalCapitalEmprestado: activeOps.reduce((a, o) => a + Number(o.principal_amount), 0),
    totalRetornoEsperado: activeOps.reduce((a, o) => a + Number(o.total_amount), 0),
    lucroProjetado: activeOps.reduce((a, o) => a + (Number(o.total_amount) - Number(o.principal_amount)), 0),
    vencemHoje: todayInsts,
    atrasados: lateInsts,
    projecao7Dias: p7,
    projecao30Dias: p30,
    taxaInadimplencia,
    lucroRealizado,
    ticketMedio: activeOps.length > 0 ? activeOps.reduce((a, o) => a + Number(o.principal_amount), 0) / activeOps.length : 0,
    rankingFidelidade,
    mixCarteira,
    fluxoSemanal,
    // Novos dados
    totalClientes: clients.length,
    totalContratosAtivos: activeOps.length,
    totalContratosQuitados: ops.filter(o => o.status === 'quitada').length,
    totalContratosGeral: ops.length,
    totalParcelasAbertas: openInsts.length,
    totalParcelasAtrasadas: lateInsts.length,
    totalParcelasPagas: insts.filter(i => i.status === 'paga').length,
    totalGlobalEmprestado,
    totalGlobalRecebido,
    totalGlobalAberto: clients.reduce((a, c) => a + Number(c.total_open), 0),
    parcelasVencemEssaSemana: weekInsts.length,
    valorVenceSemana: weekInsts.reduce((a, i) => a + (Number(i.amount) - Number(i.amount_paid)), 0),
    clientesInadimplentes,
    maioresDevedores,
    recebimentosMes: payments.filter(p => isThisMonth(p.date)).reduce((a, p) => a + Number(p.amount), 0),
    recebimentosSemana: payments.filter(p => isThisWeek(p.date)).reduce((a, p) => a + Number(p.amount), 0),
    contratosEsteMes: ops.filter(o => isThisMonth(o.created_at)).length,
  };
};
