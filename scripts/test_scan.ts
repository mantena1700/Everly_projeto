import { readFileSync } from 'fs';
import { resolve } from 'path';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: resolve(process.cwd(), '.env') });
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const OPENAI_API_KEY = process.env.VITE_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testVercelDeployLogic() {
  const imagePath = resolve(process.cwd(), 'fotos/processadas/WhatsApp Image 2026-04-29 at 13.24.58.jpeg');
  const base64Image = readFileSync(imagePath).toString('base64');
  
  console.log("🚀 Iniciando Teste de Validação da IA (Modo Militar)...");

  const response = await openai.chat.completions.create({
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
  });

  const aiContent = response.choices[0].message.content;
  if (!aiContent) throw new Error("A IA não retornou conteúdo.");
  
  const data = JSON.parse(aiContent);
  console.log("\n📦 Resposta JSON Gerada pela IA:");
  console.log(JSON.stringify(data, null, 2));

  console.log("\n💉 Simulando injeção no Supabase (como o App faria)...");
  
  const targetName = `[SIMULAÇÃO IA] ${data.cliente}`;
  const { data: newClient, error: clientErr } = await supabase.from('clients').insert([{ 
    name: targetName, phone: '00000000000', status: 'ativo', risk: 'novo', 
    total_borrowed: 0, total_paid: 0, total_open: 0
  }]).select().single();

  if (clientErr) throw clientErr;
  
  const numParcelas = data.todas_as_parcelas ? data.todas_as_parcelas.length : 1;
  const valorEmprestimoTratado = parseFloat(data.valor_total_emprestimo) || 0;
  
  const { data: operation, error: opErr } = await supabase.from('operations').insert([{
    client_id: newClient.id, principal_amount: valorEmprestimoTratado, interest_rate: 0,
    total_amount: valorEmprestimoTratado, amount_paid: 0, frequency: data.frequencia || 'mensal',
    installments_count: numParcelas, start_date: new Date().toISOString(), status: 'ativa'
  }]).select().single();

  if (opErr) throw opErr;

  let totalPaidInThisCard = 0;
  for (const p of data.todas_as_parcelas) {
    const isPaid = p.status === 'paga';
    const valorParcelaOriginal = parseFloat(p.valor);
    const valorParcela = isNaN(valorParcelaOriginal) ? (valorEmprestimoTratado / numParcelas) : valorParcelaOriginal;
    
    const { data: installment } = await supabase.from('installments').insert([{
      operation_id: operation.id, client_id: newClient.id, number: p.numero,
      due_date: new Date(p.data_vencimento || new Date()).toISOString(),
      amount: valorParcela, late_fee: 0, amount_paid: isPaid ? valorParcela : 0,
      status: isPaid ? 'paga' : 'pendente'
    }]).select().single();

    if (isPaid && installment) {
      const { error: payErr } = await supabase.from('payments').insert([{
        operation_id: operation.id, installment_id: installment.id, client_id: newClient.id,
        amount: valorParcela, date: new Date(p.data_vencimento || new Date()).toISOString(),
        type: 'exato', notes: 'Baixa automática via App (Foto)'
      }]);
      if (!payErr) totalPaidInThisCard += valorParcela;
    }
  }

  // Verificar o que foi gravado
  console.log("\n🔍 Verificando Parcelas Gravadas no Banco:");
  const { data: insts } = await supabase.from('installments').select('*').eq('operation_id', operation.id).order('number');
  console.table(insts?.map(i => ({ Parcela: i.number, Status: i.status, Data_Vencimento: new Date(i.due_date).toLocaleDateString(), Valor: i.amount })));

  console.log("\n🧹 Apagando cliente de simulação...");
  await supabase.from('payments').delete().eq('client_id', newClient.id);
  await supabase.from('installments').delete().eq('client_id', newClient.id);
  await supabase.from('operations').delete().eq('client_id', newClient.id);
  await supabase.from('clients').delete().eq('id', newClient.id);
  
  console.log("✅ Limpeza concluída e teste finalizado com sucesso!");
}

testVercelDeployLogic();
