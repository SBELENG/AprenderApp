import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Leer archivo .env de forma manual y parsearlo
const envPath = path.resolve(process.cwd(), '.env');
if (!fs.existsSync(envPath)) {
  console.error("No se encontró el archivo .env en la raíz del proyecto.");
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split(/\r?\n/).forEach(line => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const key = trimmed.substring(0, eqIdx).trim();
      const val = trimmed.substring(eqIdx + 1).trim();
      env[key] = val;
    }
  }
});

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Faltan las credenciales de Supabase en el archivo .env (VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY)");
  process.exit(1);
}

console.log("Conectando a Supabase...");
console.log(`URL: ${supabaseUrl}`);
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function cleanDatabase() {
  try {
    console.log("\n--- INICIANDO LIMPIEZA DE DATOS DE PRUEBA DE NIÑOS ---");

    // 1. Reservas
    console.log("Limpiando tabla 'reservas' (turnos agendados)...");
    const { count: countRes, error: errRes } = await supabase
      .from('reservas')
      .delete({ count: 'exact' })
      .neq('id', '00000000-0000-0000-0000-000000000000'); // delete all
    if (errRes) console.error("Error al limpiar reservas:", errRes.message);
    else console.log(`✓ Reservas eliminadas: ${countRes}`);

    // 2. Asistencia
    console.log("Limpiando tabla 'asistencia' (registros diarios)...");
    const { count: countAsis, error: errAsis } = await supabase
      .from('asistencia')
      .delete({ count: 'exact' })
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (errAsis) console.error("Error al limpiar asistencia:", errAsis.message);
    else console.log(`✓ Asistencias eliminadas: ${countAsis}`);

    // 3. Jornales
    console.log("Limpiando tabla 'jornales' (jornadas de maestras)...");
    const { count: countJor, error: errJor } = await supabase
      .from('jornales')
      .delete({ count: 'exact' })
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (errJor) console.error("Error al limpiar jornales:", errJor.message);
    else console.log(`✓ Jornales eliminados: ${countJor}`);

    // 4. Transacciones
    console.log("Limpiando tabla 'transacciones' (pagos)...");
    const { count: countTrans, error: errTrans } = await supabase
      .from('transacciones')
      .delete({ count: 'exact' })
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (errTrans) console.error("Error al limpiar transacciones:", errTrans.message);
    else console.log(`✓ Transacciones eliminadas: ${countTrans}`);

    // 5. Alumnos (Eliminar de a uno para evitar timeouts)
    console.log("Limpiando tabla 'alumnos' (fichas de niños - fila por fila)...");
    const { data: alumnos, error: errFetchAlum } = await supabase
      .from('alumnos')
      .select('id');
      
    if (errFetchAlum) {
      console.error("Error al obtener alumnos:", errFetchAlum.message);
    } else if (alumnos && alumnos.length > 0) {
      let deletedAlumCount = 0;
      for (const alum of alumnos) {
        const { error: errDel } = await supabase
          .from('alumnos')
          .delete()
          .eq('id', alum.id);
        if (errDel) {
          console.error(`Error al eliminar alumno ${alum.id}:`, errDel.message);
        } else {
          deletedAlumCount++;
        }
      }
      console.log(`✓ Alumnos eliminados: ${deletedAlumCount} de ${alumnos.length}`);
    } else {
      console.log("✓ No hay alumnos para eliminar.");
    }

    // 6. Familias (Eliminar de a uno para evitar timeouts)
    console.log("Limpiando tabla 'familias' (registros familiares - fila por fila)...");
    const { data: familias, error: errFetchFam } = await supabase
      .from('familias')
      .select('id');
      
    if (errFetchFam) {
      console.error("Error al obtener familias:", errFetchFam.message);
    } else if (familias && familias.length > 0) {
      let deletedFamCount = 0;
      for (const fam of familias) {
        const { error: errDel } = await supabase
          .from('familias')
          .delete()
          .eq('id', fam.id);
        if (errDel) {
          console.error(`Error al eliminar familia ${fam.id}:`, errDel.message);
        } else {
          deletedFamCount++;
        }
      }
      console.log(`✓ Familias eliminadas: ${deletedFamCount} de ${familias.length}`);
    } else {
      console.log("✓ No hay familias para eliminar.");
    }

    console.log("\n=============================================");
    console.log("✓ ¡BASE DE DATOS LIMPIA Y LISTA PARA PRODUCCIÓN!");
    console.log("=============================================");
  } catch (error) {
    console.error("Ocurrió un error inesperado durante la limpieza:", error);
  }
}

cleanDatabase();
