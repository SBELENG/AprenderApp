import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://tclolsurmvrielsqxucw.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRjbG9sc3VybXZyaWVsc3F4dWN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5NDc0MTcsImV4cCI6MjA5NDUyMzQxN30.jYE7P7cTvjCAyZTe9WC4su9r5FR-YlusM2otUWReQ2g';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  const { data, error } = await supabase.from('alumnos').select('*').limit(1);
  if (error) {
    console.error("Error fetching", error);
    return;
  }
  
  if (data.length > 0) {
    console.log("Columns:", Object.keys(data[0]));
  } else {
    console.log("No data");
  }
}

main();
