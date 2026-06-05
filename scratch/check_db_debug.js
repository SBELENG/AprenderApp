import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    env[match[1]] = (match[2] || '').trim();
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data: familias } = await supabase.from('familias').select('id, telefono, email');
  console.log("--- FAMILIAS ---");
  console.log(familias);

  const { data: alumnos } = await supabase.from('alumnos').select('id, nombre, familia_id');
  console.log("\n--- ALUMNOS ---");
  console.log(alumnos);
}

run();
