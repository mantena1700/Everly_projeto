import { readFileSync, readdirSync, renameSync, existsSync, mkdirSync } from 'fs';
import { resolve, join } from 'path';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// ==========================================
// CONFIGURAÇÕES
// ==========================================
// Mude para 'false' quando quiser inserir nos seus clientes REAIS do sistema.
const MODO_TESTE = true; 
// ==========================================

dotenv.config({ path: resolve(process.cwd(), '.env') });
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!OPENAI_API_KEY || OPENAI_API_KEY.includes('sua_chave_da_openai_aqui')) {
  console.error("❌ Erro: OPENAI_API_KEY não foi configurada corretamente no arquivo .env");
  process.exit(1);
}

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
const supabase = createClient(SUPABASE_URL || '', SUPABASE_ANON_KEY || '');

function encodeImage(imagePath: string) {
  const imageBuffer = readFileSync(imagePath);
  return imageBuffer.toString('base64');
}

async function processCard(imagePath: string) {
  console.log(`\n📸 Lendo a imagem: ${imagePath}`);
  
  try {
    const base64Image = encodeImage(imagePath);

    console.log("🧠 Analisando caligrafia e montando o cronograma de parcelas com IA...");
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Você é um sistema financeiro lendo um cartão físico de cobrança.
              Extraia os dados e gere OBRIGATORIAMENTE a lista completa com TODAS as parcelas do empréstimo, incluindo as que ainda não foram pagas (em aberto).
              
              Retorne EXATAMENTE neste formato JSON:
              {
                "cliente": "Nome do Cliente",
                "valor_total_emprestimo": 1000.00,
                "frequencia": "mensal", 
                "todas_as_parcelas": [
                  {"numero": 1, "data_vencimento": "2023-10-01", "valor": 50.00, "status": "paga"},
                  {"numero": 2, "data_vencimento": "2023-11-01", "valor": 50.00, "status": "paga"},
                  {"numero": 3, "data_vencimento": "2023-12-01", "valor": 50.00, "status": "pendente"}
                ]
              }
              
              REGRAS CRÍTICAS:
              1. A array 'todas_as_parcelas' DEVE conter o número total de parcelas do cartão (ex: se o cartão vai até 20, retorne 20 objetos na array, de 1 a 20).
              2. Marque as parcelas que têm rubrica/assinatura/data de pagamento como "paga".
              3. Marque as parcelas vazias ou futuras como "pendente".
              4. Calcule ou deduza a "data_vencimento" para as parcelas pendentes seguindo o padrão da 'frequencia' (ex: somando +1 mês ou +1 semana da última parcela paga).
              5. Se o valor da parcela não estiver escrito, divida o valor total pelo número de parcelas.
              6. Retorne apenas o JSON puro, sem crases markdown.`
            },
            {
              type: "image_url",
              image_url: { url: `data:image/jpeg;base64,${base64Image}`, detail: "high" },
            },
          ],
        },
      ],
      response_format: { type: "json_object" },
    });

    const aiContent = response.choices[0].message.content;
    if (!aiContent) throw new Error("A IA não retornou conteúdo.");
    
    console.log("✅ Leitura e projeção de parcelas concluída!");
    return JSON.parse(aiContent);
  } catch (error) {
    console.error("❌ Erro ao processar a imagem com a IA:", error);
    return null;
  }
}

async function injectToDatabase(data: any) {
  if (!data || !data.cliente) return;

  const targetName = MODO_TESTE ? `[TESTE DO ROBÔ] ${data.cliente}` : data.cliente;
  console.log(`\n💾 Buscando cliente no banco de dados: ${targetName}`);

  // 1. Verificar se esse cliente já existe pelo nome (ignorando maiúsculas/minúsculas)
  let { data: clients } = await supabase
    .from('clients')
    .select('*')
    .ilike('name', `%${data.cliente}%`); // Procura parte do nome

  let clientId;
  let clientData;

  if (clients && clients.length > 0) {
    // Se achou, pega o primeiro que deu "match"
    clientId = clients[0].id;
    clientData = clients[0];
    console.log(`👤 Cliente JÁ EXISTENTE encontrado! Vinculando ao ID: ${clientId} (${clientData.name})`);
  } else {
    // Se não achou, cria um novo
    const { data: newClient, error: clientErr } = await supabase.from('clients').insert([{ 
      name: targetName, 
      phone: '00000000000', 
      status: 'ativo', 
      risk: 'novo', 
      total_borrowed: 0,
      total_paid: 0,
      total_open: 0
    }]).select().single();
      
    if (clientErr) throw clientErr;
    clientId = newClient.id;
    clientData = newClient;
    console.log(`👤 Cliente NOVO criado com sucesso: ${targetName}`);
  }

  const numParcelas = data.todas_as_parcelas ? data.todas_as_parcelas.length : 1;

  // 2. Criar a Operação de Crédito (O Empréstimo em si)
  console.log(`💼 Registrando empréstimo de R$ ${data.valor_total_emprestimo} em ${numParcelas}x...`);
  const { data: operation, error: opErr } = await supabase.from('operations').insert([{
    client_id: clientId,
    principal_amount: data.valor_total_emprestimo || 0,
    interest_rate: 0,
    total_amount: data.valor_total_emprestimo || 0,
    amount_paid: 0, // Será atualizado logo abaixo
    frequency: data.frequencia || 'mensal',
    installments_count: numParcelas,
    start_date: new Date().toISOString(),
    status: 'ativa'
  }]).select().single();

  if (opErr) throw opErr;
  console.log(`✔️ Operação de crédito criada! (ID: ${operation.id})`);

  // 3. Inserir TODAS as Parcelas (Pagas e Pendentes)
  if (data.todas_as_parcelas && data.todas_as_parcelas.length > 0) {
    let totalPaidInThisCard = 0;
    let pagasCount = 0;
    let pendentesCount = 0;

    for (const p of data.todas_as_parcelas) {
      const isPaid = p.status === 'paga';
      const valorParcela = p.valor || (data.valor_total_emprestimo / numParcelas);
      
      if (isPaid) pagasCount++; else pendentesCount++;

      // 3.1 Cria a Parcela
      const { data: installment, error: instErr } = await supabase.from('installments').insert([{
        operation_id: operation.id,
        client_id: clientId,
        number: p.numero,
        due_date: new Date(p.data_vencimento || new Date()).toISOString(),
        amount: valorParcela,
        late_fee: 0,
        amount_paid: isPaid ? valorParcela : 0,
        status: isPaid ? 'paga' : 'pendente'
      }]).select().single();

      if (instErr) {
        console.error(`Erro ao criar parcela ${p.numero}:`, instErr);
        continue;
      }

      // 3.2 Se for 'paga', cria também o registro financeiro (Payment)
      if (isPaid) {
        const { error: payErr } = await supabase.from('payments').insert([{
          operation_id: operation.id,
          installment_id: installment.id,
          client_id: clientId,
          amount: valorParcela,
          date: new Date(p.data_vencimento || new Date()).toISOString(),
          type: 'exato',
          notes: 'Baixa automática via OCR/IA'
        }]);

        if (!payErr) {
          totalPaidInThisCard += valorParcela;
        }
      }
    }

    console.log(`🧾 Foram inseridas ${pagasCount} parcelas PAGAS e ${pendentesCount} parcelas PENDENTES no sistema.`);

    // 4. Atualizar saldos consolidados
    const newOpPaid = totalPaidInThisCard;
    await supabase.from('operations').update({ amount_paid: newOpPaid }).eq('id', operation.id);
    
    const newTotalBorrowed = Number(clientData.total_borrowed || 0) + Number(data.valor_total_emprestimo);
    const newTotalPaid = Number(clientData.total_paid || 0) + totalPaidInThisCard;
    const newTotalOpen = newTotalBorrowed - newTotalPaid;

    await supabase.from('clients').update({ 
      total_borrowed: newTotalBorrowed,
      total_paid: newTotalPaid,
      total_open: newTotalOpen
    }).eq('id', clientId);

    console.log(`✅ Sucesso! R$ ${totalPaidInThisCard} abatidos. Saldo em aberto atualizado.`);
  }

  console.log(`\n🎉 OPERAÇÃO FINALIZADA PARA: ${targetName}`);
}

async function run() {
  const fotosDir = resolve(process.cwd(), 'fotos');
  const processadasDir = resolve(fotosDir, 'processadas');

  if (!existsSync(fotosDir)) mkdirSync(fotosDir);
  if (!existsSync(processadasDir)) mkdirSync(processadasDir);

  console.log("🔍 Procurando imagens na pasta 'fotos/'...");
  
  const files = readdirSync(fotosDir);
  const images = files.filter(f => f.toLowerCase().endsWith('.jpg') || f.toLowerCase().endsWith('.jpeg') || f.toLowerCase().endsWith('.png'));

  if (images.length === 0) {
    console.log("⚠️ Nenhuma imagem encontrada. Coloque as fotos na pasta 'fotos' e rode novamente.");
    return;
  }

  for (const image of images) {
    console.log(`\n=================================================`);
    const imagePath = join(fotosDir, image);
    const data = await processCard(imagePath);
    
    if (data) {
      await injectToDatabase(data);
      
      const newPath = join(processadasDir, image);
      renameSync(imagePath, newPath);
      console.log(`📁 Imagem movida para 'fotos/processadas/${image}'`);
    }
  }

  console.log(`\n✨ TODAS AS FOTOS FORAM PROCESSADAS COM SUCESSO!`);
}

run();
