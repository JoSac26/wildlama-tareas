// Wild Lama · Canasta de Tareas
// Resetea las tareas "diarias" y las "semanales" que correspondan a medianoche
// hora de Chile. Se ejecuta cada hora vía GitHub Actions, pero solo actúa
// cuando en Chile es medianoche (esto evita problemas con el cambio de
// horario de verano/invierno).

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY como variables de entorno.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function horaYDiaEnChile() {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Santiago",
    hour: "numeric",
    hour12: false,
    weekday: "short",
  });
  const parts = formatter.formatToParts(new Date());
  const hour = Number(parts.find((p) => p.type === "hour").value);
  const weekdayStr = parts.find((p) => p.type === "weekday").value; // "Sun","Mon",...
  const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { hour, dayOfWeek: map[weekdayStr] };
}

async function main() {
  const { hour, dayOfWeek } = horaYDiaEnChile();

  if (hour !== 0) {
    console.log(`Son las ${hour}:00 en Chile, no es medianoche. No se hace nada.`);
    return;
  }

  console.log(`Medianoche en Chile (día de la semana ${dayOfWeek}). Reseteando tareas…`);

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
    return;
  }

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

main().catch((err) => {
  console.error("Error inesperado:", err);
  process.exit(1);
});
