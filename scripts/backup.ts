import { writeFileSync } from 'fs';
import { resolve } from 'path';
import dotenv from 'dotenv';

// Carregar variáveis
dotenv.config({ path: resolve(process.cwd(), '.env') });
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function runBackup() {
  console.log("Iniciando backup completo dos dados do Supabase...");
  
  try {
    const { data: clients } = await supabase.from('clients').select('*');
    const { data: operations } = await supabase.from('operations').select('*');
    const { data: installments } = await supabase.from('installments').select('*');
    const { data: payments } = await supabase.from('payments').select('*');
    
    const backupData = {
      date: new Date().toISOString(),
      clients: clients || [],
      operations: operations || [],
      installments: installments || [],
      payments: payments || []
    };
    
    writeFileSync('backup_completo.json', JSON.stringify(backupData, null, 2));
    console.log("✅ Backup salvo com sucesso no arquivo 'backup_completo.json'. Seus dados estão seguros!");
  } catch (error) {
    console.error("❌ Erro ao fazer backup:", error);
  }
}

runBackup();
