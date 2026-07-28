// Wild Lama · Canasta de Tareas
// Resetea las tareas "diarias" y las "semanales" que correspondan, una vez
// por día (hora de Chile). Se ejecuta cada hora vía GitHub Actions, pero en
// vez de depender de "cachar" la hora exacta de medianoche (poco confiable,
// porque GitHub a veces atrasa o se salta ejecuciones programadas), el
// script recuerda qué día reseteó por última vez y actúa en cuanto detecta
// que cambió el día calendario en Chile — sin importar a qué hora corra.

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY como variables de entorno.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function fechaYDiaEnChile() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });
  const parts = formatter.formatToParts(new Date());
  const get = (type) => parts.find((p) => p.type === type).value;
  const fecha = `${get("year")}-${get("month")}-${get("day")}`; // YYYY-MM-DD
  const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const dayOfWeek = map[get("weekday")];
  return { fecha, dayOfWeek };
}

async function main() {
  const { fecha, dayOfWeek } = fechaYDiaEnChile();

  const { data: estado, error: errEstado } = await supabase
    .from("app_state")
    .select("last_reset_date")
    .eq("id", 1)
    .single();

  if (errEstado) {
    console.error("Error leyendo app_state:", errEstado.message);
    process.exit(1);
  }

  if (estado.last_reset_date === fecha) {
    console.log(`Ya se reseteó hoy (${fecha}, hora Chile). No se hace nada.`);
    return;
  }

  console.log(`Nuevo día detectado en Chile: ${fecha} (día de la semana ${dayOfWeek}). Reseteando…`);

  // 1) Tareas diarias: siempre se resetean
  const { data: diarias, error: errDiarias } = await supabase
    .from("tasks")
    .update({ status: "pendiente", assigned_to: null, updated_at: new Date().toISOString() })
    .eq("type", "diaria")
    .select("id");

  if (errDiarias) {
    console.error("Error reseteando tareas diarias:", errDiarias.message);
  } else {
    console.log(`Tareas diarias reseteadas: ${diarias.length}`);
  }

  // 2) Tareas semanales: solo las que tengan hoy en su lista de días
  //    Y que ya estén "completada" — si quedaron pendientes o en curso,
  //    se dejan intactas para que sigan visibles hasta que alguien las termine.
  const { data: semanales, error: errSemanales } = await supabase
    .from("tasks")
    .select("id, days_of_week, status")
    .eq("type", "semanal");

  if (errSemanales) {
    console.error("Error leyendo tareas semanales:", errSemanales.message);
  } else {
    const idsHoy = semanales
      .filter((t) => (t.days_of_week || []).includes(dayOfWeek) && t.status === "completada")
      .map((t) => t.id);

    if (idsHoy.length > 0) {
      const { error: errUpdate } = await supabase
        .from("tasks")
        .update({ status: "pendiente", assigned_to: null, updated_at: new Date().toISOString() })
        .in("id", idsHoy);

      if (errUpdate) {
        console.error("Error reseteando tareas semanales:", errUpdate.message);
      } else {
        console.log(`Tareas semanales reseteadas: ${idsHoy.length}`);
      }
    } else {
      console.log("Ninguna tarea semanal corresponde a hoy.");
    }
  }

  // 3) Guardamos la fecha para no volver a resetear hoy de nuevo
  const { error: errGuardar } = await supabase
    .from("app_state")
    .update({ last_reset_date: fecha })
    .eq("id", 1);

  if (errGuardar) {
    console.error("Error guardando la fecha de reseteo:", errGuardar.message);
    process.exit(1);
  }

  console.log(`Listo. Próximo reseteo cuando cambie el día (después de ${fecha}).`);
}

main().catch((err) => {
  console.error("Error inesperado:", err);
  process.exit(1);
});
