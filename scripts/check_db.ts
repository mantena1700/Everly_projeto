import { resolve } from 'path';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: resolve(process.cwd(), '.env') });
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function deleteJairo() {
  console.log("Buscando clientes com 'Jairo' no nome...");
  
  const { data: clients } = await supabase.from('clients').select('id, name').ilike('name', '%Jairo%');
  
  if (clients && clients.length > 0) {
    for (const c of clients) {
      console.log(`Deletando: ${c.name} (${c.id})`);
      await supabase.from('payments').delete().eq('client_id', c.id);
      await supabase.from('installments').delete().eq('client_id', c.id);
      await supabase.from('operations').delete().eq('client_id', c.id);
      await supabase.from('clients').delete().eq('id', c.id);
    }
    console.log("Jairo deletado com sucesso do banco de dados!");
  } else {
    console.log("Nenhum cliente com nome 'Jairo' foi encontrado.");
  }
}

deleteJairo();
