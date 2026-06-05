const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://tclolsurmvrielsqxucw.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRjbG9sc3VybXZyaWVsc3F4dWN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5NDc0MTcsImV4cCI6MjA5NDUyMzQxN30.jYE7P7cTvjCAyZTe9WC4su9r5FR-YlusM2otUWReQ2g';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const insertData = {
    alumno_nombre: "mochilín Prueba",
    fecha: "2026-06-05",
    horario: "18:00 hs"
  };

  const { data: inserted, error: insErr } = await supabase
    .from('reservas')
    .insert([insertData])
    .select();

  if (insErr) {
    console.error('Error inserting:', insErr);
  } else {
    console.log('Successfully inserted reservation:', inserted);
  }
}

run();
