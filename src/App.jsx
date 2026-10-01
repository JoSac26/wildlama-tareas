import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { supabase } from "./supabaseClient.js";
import Section from "./components/Section.jsx";
import WeeklyReviewModal from "./components/WeeklyReviewModal.jsx";
import TaskModal from "./components/TaskModal.jsx";
import AssignModal from "./components/AssignModal.jsx";
import SettingsModal from "./components/SettingsModal.jsx";
import ArrivalModal from "./components/ArrivalModal.jsx";
import CasesFloating from "./components/CasesFloating.jsx";

const DIA_HOY = new Date().getDay(); // 0=domingo ... 6=sábado

function esSemanalDeHoy(task) {
  return (task.days_of_week || []).includes(DIA_HOY);
}

function semanalVisibleEnTablero(task) {
  // Se muestra el día que le toca, y sigue apareciendo sola en el tablero
  // principal los días siguientes si no se completó — hasta que alguien
  // la termine, ahí recién "duerme" hasta su próximo día programado.
  return esSemanalDeHoy(task) || task.status !== "completada";
}

function tareaReunionVisible() {
  // Siempre visible: nace en la reunión y se muestra de inmediato.
  // El plazo es solo un dato informativo de cuándo vence, no controla si se ve o no.
  return true;
}

function dentroDeHorario(task) {
  // Si no tiene hora de inicio, siempre está "dentro" (elegible).
  // Una vez que llega su hora de inicio, queda elegible el resto del día
  // (no se bloquea sola de nuevo al pasar la hora de fin) — así no se
  // queda sin hacer si nadie estaba disponible justo en esa ventana.
  // La hora de fin queda solo como referencia visual de cuándo "debería"
  // estar lista.
  if (!task.hora_inicio) return true;
  const ahora = new Date();
  const minutosAhora = ahora.getHours() * 60 + ahora.getMinutes();
  const [hIni, mIni] = task.hora_inicio.split(":").map(Number);
  const minutosIni = hIni * 60 + mIni;
  return minutosAhora >= minutosIni;
}

// Reequilibra la carga de tareas de apertura entre los presentes: mueve
// grupos del más cargado al menos cargado hasta que la diferencia sea de
// a lo más 1, y reparte los grupos sin dueño a quien tenga menos. Se usa
// solo una vez, justo cuando llega alguien nuevo — el resto del tiempo el
// reparto es "pegajoso" y no se toca.
function rebalancearCarga(grupos, presentes) {
  const presentesIds = presentes.map((p) => p.member_id);
  const cargaPorPersona = new Map(presentesIds.map((id) => [id, 0]));
  const duenoDeGrupo = new Map();

  grupos.forEach((tareasGrupo, clave) => {
    const conDueno = tareasGrupo.find(
      (t) => t.status === "en_curso" && t.assigned_to && presentesIds.includes(t.assigned_to)
    );
    const dueno = conDueno ? conDueno.assigned_to : null;
    duenoDeGrupo.set(clave, dueno);
    if (dueno) cargaPorPersona.set(dueno, (cargaPorPersona.get(dueno) || 0) + tareasGrupo.length);
  });

  const cambios = new Map();
  let vueltas = 0;
  while (vueltas < 50) {
    vueltas++;
    const entradas = [...cargaPorPersona.entries()];
    const masCargado = entradas.reduce((a, b) => (b[1] > a[1] ? b : a));
    const menosCargado = entradas.reduce((a, b) => (b[1] < a[1] ? b : a));
    if (masCargado[1] - menosCargado[1] <= 1) break;

    let grupoAMover = null;
    for (const [clave, dueno] of duenoDeGrupo.entries()) {
      if (dueno === masCargado[0] && !cambios.has(clave)) {
        grupoAMover = clave;
        break;
      }
    }
    if (!grupoAMover) break;

    const tamano = grupos.get(grupoAMover).length;
    cargaPorPersona.set(masCargado[0], masCargado[1] - tamano);
    cargaPorPersona.set(menosCargado[0], menosCargado[1] + tamano);
    duenoDeGrupo.set(grupoAMover, menosCargado[0]);
    cambios.set(grupoAMover, menosCargado[0]);
  }

  grupos.forEach((tareasGrupo, clave) => {
    if (duenoDeGrupo.get(clave) === null) {
      const entradas = [...cargaPorPersona.entries()];
      const menosCargado = entradas.reduce((a, b) => (b[1] < a[1] ? b : a));
      cargaPorPersona.set(menosCargado[0], menosCargado[1] + tareasGrupo.length);
      cambios.set(clave, menosCargado[0]);
    }
  });

  const updates = [];
  cambios.forEach((nuevoDueno, clave) => {
    grupos.get(clave).forEach((t) => {
      const yaEsta = t.status === "en_curso" && t.assigned_to === nuevoDueno;
      if (!yaEsta) updates.push({ id: t.id, memberId: nuevoDueno });
    });
  });
  return updates;
}

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [team, setTeam] = useState([]);
  const [arrivals, setArrivals] = useState([]);
  const [casos, setCasos] = useState([]);
  const [comentarios, setComentarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showNewTask, setShowNewTask] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [assigningTask, setAssigningTask] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showWeeklyReview, setShowWeeklyReview] = useState(false);
  const [showArrival, setShowArrival] = useState(false);
  const [tick, setTick] = useState(0);
  const prevPresentesRef = useRef(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    const hoy = new Date().toISOString().slice(0, 10);
    const [tasksRes, teamRes, arrivalsRes, casosRes, comentariosRes] = await Promise.all([
      supabase.from("tasks").select("*").order("created_at", { ascending: true }),
      supabase.from("team_members").select("*").order("name", { ascending: true }),
      supabase
        .from("arrivals")
        .select("*")
        .eq("arrival_date", hoy)
        .order("arrived_at", { ascending: true }),
      supabase
        .from("casos_pendientes")
        .select("*")
        .eq("resuelto", false)
        .order("created_at", { ascending: false }),
      supabase.from("caso_comentarios").select("*").order("created_at", { ascending: true }),
    ]);
    if (tasksRes.error || teamRes.error || arrivalsRes.error || casosRes.error || comentariosRes.error) {
      setError(
        (tasksRes.error || teamRes.error || arrivalsRes.error || casosRes.error || comentariosRes.error)
          .message
      );
    } else {
      setTasks(tasksRes.data);
      setTeam(teamRes.data);
      setArrivals(arrivalsRes.data);
      setCasos(casosRes.data);
      setComentarios(comentariosRes.data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAll();

    const channel = supabase
      .channel("realtime-tareas")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, loadAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "team_members" }, loadAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "arrivals" }, loadAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "casos_pendientes" }, loadAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "caso_comentarios" }, loadAll)
      .subscribe();

    const intervalo = setInterval(() => setTick((t) => t + 1), 60 * 1000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(intervalo);
    };
  }, [loadAll]);

  const diarias = useMemo(() => tasks.filter((t) => t.type === "diaria"), [tasks]);
  const semanalesHoy = useMemo(
    () => tasks.filter((t) => t.type === "semanal" && semanalVisibleEnTablero(t)),
    [tasks]
  );
  const todasLasSemanales = useMemo(() => tasks.filter((t) => t.type === "semanal"), [tasks]);
  const reunion = useMemo(
    () => tasks.filter((t) => t.type === "fecha" && !t.archivado && tareaReunionVisible(t)),
    [tasks]
  );

  const presentes = useMemo(
    () => arrivals.filter((a) => !a.left_at && !a.paused_at),
    [arrivals]
  );

  // Reparto automático de tareas de apertura: cada vez que cambian las
  // tareas o quién está presente (llegó y no se ha ido), se recalcula
  // quién debería tener cada tarea (round-robin entre los presentes) y se
  // corrige sola cualquier diferencia. Así, cuando alguien marca su salida,
  // sus tareas de canal se reasignan solas a quien siga presente — nunca
  // quedan abandonadas.
  //
  // Además, no se reparten todas las tareas de apertura de una — se van
  // sumando tandas según cuánta gente hay: con 1 persona presente, solo se
  // reparten las de prioridad Alta. Con 2 personas, se suman las de
  // prioridad Media. Con 3 o más, se suman también las de prioridad Baja.
  //
  // Y si no queda nadie presente, cualquier tarea de apertura que haya
  // quedado "en curso" (con alguien que ya se fue) vuelve sola a pendiente,
  // sin dueño — no se queda pegada a alguien que ya no está.
  useEffect(() => {
    const aperturaTasks = tasks.filter((t) => t.type === "diaria" && t.es_apertura);

    if (presentes.length === 0) {
      prevPresentesRef.current = new Set();
      const porLiberar = aperturaTasks.filter(
        (t) => t.status === "en_curso" && t.assigned_to !== null
      );
      porLiberar.forEach((t) => {
        supabase
          .from("tasks")
          .update({ status: "pendiente", assigned_to: null, updated_at: new Date().toISOString() })
          .eq("id", t.id)
          .then(() => {});
      });
      return;
    }

    const presentesIds = new Set(presentes.map((p) => p.member_id));

    // ¿Llegó alguien nuevo respecto a la última vez que corrió esto?
    let hayRecienLlegado = false;
    if (prevPresentesRef.current) {
      presentesIds.forEach((id) => {
        if (!prevPresentesRef.current.has(id)) hayRecienLlegado = true;
      });
    }
    prevPresentesRef.current = presentesIds;

    const prioridadesActivas =
      presentes.length >= 3
        ? ["alta", "media", "baja"]
        : presentes.length === 2
        ? ["alta", "media"]
        : ["alta"];

    // Las que sí corresponden repartir con la gente presente ahora mismo,
    // y que además están dentro de su rango horario (si tienen uno).
    const aperturaPendientes = aperturaTasks
      .filter(
        (t) =>
          t.status !== "completada" &&
          prioridadesActivas.includes(t.prioridad) &&
          dentroDeHorario(t)
      )
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    // Las que quedaron asignadas de antes pero ya no les toca — por
    // prioridad, por horario, o porque quien las tenía ya no está presente
    // — se sueltan, vuelven a pendiente sin dueño (sin desaparecer).
    const yaNoCorresponden = aperturaTasks.filter(
      (t) =>
        t.status === "en_curso" &&
        t.assigned_to !== null &&
        (!prioridadesActivas.includes(t.prioridad) ||
          !dentroDeHorario(t) ||
          !presentesIds.has(t.assigned_to))
    );
    yaNoCorresponden.forEach((t) => {
      supabase
        .from("tasks")
        .update({ status: "pendiente", assigned_to: null, updated_at: new Date().toISOString() })
        .eq("id", t.id)
        .then(() => {});
    });

    if (aperturaPendientes.length === 0) return;

    // Agrupamos por "grupo" — las tareas con el mismo grupo siempre viajan
    // juntas a la misma persona. Las que no tienen grupo son su propio
    // grupo de una sola tarea.
    const grupos = new Map();
    aperturaPendientes.forEach((t) => {
      const clave = t.grupo || `__sola_${t.id}`;
      if (!grupos.has(clave)) grupos.set(clave, []);
      grupos.get(clave).push(t);
    });

    let porCorregir = [];

    if (hayRecienLlegado) {
      // Alguien nuevo acaba de llegar: reequilibramos la carga una sola
      // vez, moviendo grupos del más cargado al menos cargado. Después de
      // esto, vuelve a quedar "pegajoso" hasta la próxima llegada.
      porCorregir = rebalancearCarga(grupos, presentes);
    } else {
      // Reparto "pegajoso": si un grupo ya tiene dueño presente (alguna de
      // sus tareas ya está en_curso con alguien que sigue presente), se
      // completa con ese mismo dueño y no se toca a nadie más. Solo los
      // grupos totalmente libres se reparten a quien tenga menos carga.
      const cargaPorPersona = new Map(presentes.map((p) => [p.member_id, 0]));
      const gruposLibres = [];

      grupos.forEach((tareasGrupo) => {
        const conDueno = tareasGrupo.find(
          (t) => t.status === "en_curso" && t.assigned_to && presentes.some((p) => p.member_id === t.assigned_to)
        );
        if (conDueno) {
          const dueno = conDueno.assigned_to;
          cargaPorPersona.set(dueno, (cargaPorPersona.get(dueno) || 0) + tareasGrupo.length);
          tareasGrupo.forEach((t) => {
            const yaEsta = t.status === "en_curso" && t.assigned_to === dueno;
            if (!yaEsta) porCorregir.push({ id: t.id, memberId: dueno });
          });
        } else {
          gruposLibres.push(tareasGrupo);
        }
      });

      gruposLibres.forEach((tareasGrupo) => {
        let elegido = presentes[0].member_id;
        let minCarga = Infinity;
        presentes.forEach((p) => {
          const carga = cargaPorPersona.get(p.member_id) || 0;
          if (carga < minCarga) {
            minCarga = carga;
            elegido = p.member_id;
          }
        });
        tareasGrupo.forEach((t) => porCorregir.push({ id: t.id, memberId: elegido }));
        cargaPorPersona.set(elegido, (cargaPorPersona.get(elegido) || 0) + tareasGrupo.length);
      });
    }

    if (porCorregir.length === 0) return;

    porCorregir.forEach(({ id, memberId }) => {
      supabase
        .from("tasks")
        .update({ status: "en_curso", assigned_to: memberId, updated_at: new Date().toISOString() })
        .eq("id", id)
        .then(() => {});
    });
  }, [tasks, presentes, tick]);

  async function handleMarkArrival(memberId) {
    const hoy = new Date().toISOString().slice(0, 10);
    await supabase
      .from("arrivals")
      .upsert(
        { member_id: memberId, arrival_date: hoy, arrived_at: new Date().toISOString() },
        { onConflict: "member_id,arrival_date", ignoreDuplicates: true }
      );
    setShowArrival(false);
  }

  async function handleMarkDeparture(memberId) {
    const hoy = new Date().toISOString().slice(0, 10);
    await supabase
      .from("arrivals")
      .update({ left_at: new Date().toISOString() })
      .eq("member_id", memberId)
      .eq("arrival_date", hoy);
    setShowArrival(false);
  }

  async function handleReturnToWork(memberId) {
    const hoy = new Date().toISOString().slice(0, 10);
    await supabase
      .from("arrivals")
      .update({ left_at: null, paused_at: null })
      .eq("member_id", memberId)
      .eq("arrival_date", hoy);
  }

  async function handleTogglePause(memberId, pausar) {
    const hoy = new Date().toISOString().slice(0, 10);
    await supabase
      .from("arrivals")
      .update({ paused_at: pausar ? new Date().toISOString() : null })
      .eq("member_id", memberId)
      .eq("arrival_date", hoy);
  }

  function agrupar(lista) {
    return {
      pendiente: lista.filter((t) => t.status === "pendiente"),
      en_curso: lista.filter((t) => t.status === "en_curso"),
      completada: lista.filter((t) => t.status === "completada"),
    };
  }

  async function handleAssign(task, memberId) {
    await supabase
      .from("tasks")
      .update({ status: "en_curso", assigned_to: memberId, updated_at: new Date().toISOString() })
      .eq("id", task.id);
    setAssigningTask(null);
  }

  async function handleComplete(task) {
    await supabase
      .from("tasks")
      .update({ status: "completada", updated_at: new Date().toISOString() })
      .eq("id", task.id);
  }

  async function handleReabrir(task) {
    await supabase
      .from("tasks")
      .update({ status: "en_curso", updated_at: new Date().toISOString() })
      .eq("id", task.id);
  }

  async function handleUnassign(task) {
    await supabase
      .from("tasks")
      .update({ status: "pendiente", assigned_to: null, updated_at: new Date().toISOString() })
      .eq("id", task.id);
  }

  async function handleDeleteTask(taskId) {
    await supabase.from("tasks").delete().eq("id", taskId);
  }

  async function handleArchiveTask(taskId) {
    await supabase.from("tasks").update({ archivado: true }).eq("id", taskId);
  }

  async function handleCreateCase(data) {
    await supabase.from("casos_pendientes").insert(data);
  }

  async function handleAddComment(casoId, autorId, texto) {
    await supabase.from("caso_comentarios").insert({ caso_id: casoId, autor: autorId, texto });
  }

  async function handleResolveCase(casoId) {
    await supabase
      .from("casos_pendientes")
      .update({ resuelto: true, resuelto_at: new Date().toISOString() })
      .eq("id", casoId);
  }

  function handleCardClick(task) {
    if (task.status === "pendiente") {
      setAssigningTask(task);
    } else if (task.status === "en_curso") {
      handleComplete(task);
    } else {
      handleReabrir(task);
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1>🧺 Canasta de Tareas</h1>
          <p>Equipo Customer Experience · Wild Lama</p>
          {arrivals.length > 0 && (
            <p className="arrivals-today">
              📍{" "}
              {arrivals
                .map((a) => {
                  const m = team.find((tm) => tm.id === a.member_id);
                  if (!m) return null;
                  const hora = new Date(a.arrived_at).toLocaleTimeString("es-CL", {
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  if (a.left_at) return `${m.name} (se fue)`;
                  if (a.paused_at) return `${m.name} (pausado)`;
                  return `${m.name} (${hora})`;
                })
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
        </div>
        <div className="header-actions">
          <button className="btn btn-ghost" onClick={() => setShowArrival(true)}>
            📍 Llegada / salida
          </button>
          <button className="btn btn-ghost" onClick={() => setShowSettings(true)}>
            Equipo y tareas
          </button>
          <button className="btn btn-primary" onClick={() => setShowNewTask(true)}>
            + Nueva tarea
          </button>
        </div>
      </header>

      {loading && <div className="status-loading">Cargando tareas…</div>}
      {error && <div className="status-error">No se pudo cargar: {error}</div>}

      {!loading && !error && (
        <>
          <Section
            id="diarias"
            title="☀️ Diarias"
            subtitle="Se resetean solas cada noche"
            grouped={agrupar(diarias)}
            team={team}
            onCardClick={handleCardClick}
            onEditTask={setEditingTask}
            onUnassign={handleUnassign}
          />

          <Section
            id="semanales"
            title="🗓️ Semanales"
            subtitle="Aparecen su día, y siguen pendientes hasta completarse"
            grouped={agrupar(semanalesHoy)}
            team={team}
            onCardClick={handleCardClick}
            onEditTask={setEditingTask}
            onUnassign={handleUnassign}
            headerAction={
              <button className="link-btn-section" onClick={() => setShowWeeklyReview(true)}>
                Ver todas las semanales
              </button>
            }
          />

          <Section
            id="reunion"
            title="🤝 Tareas nacidas en reunión"
            subtitle="Con reunión de origen y plazo"
            grouped={agrupar(reunion)}
            team={team}
            onCardClick={handleCardClick}
            onEditTask={setEditingTask}
            onUnassign={handleUnassign}
          />
        </>
      )}

      {(showNewTask || editingTask) && (
        <TaskModal
          initial={editingTask}
          onClose={() => {
            setShowNewTask(false);
            setEditingTask(null);
          }}
          onSaved={() => {
            setShowNewTask(false);
            setEditingTask(null);
            loadAll();
          }}
          onDelete={
            editingTask
              ? () => handleDeleteTask(editingTask.id).then(() => {
                  setEditingTask(null);
                  loadAll();
                })
              : null
          }
          onArchive={
            editingTask
              ? () => handleArchiveTask(editingTask.id).then(() => {
                  setEditingTask(null);
                  loadAll();
                })
              : null
          }
        />
      )}

      {assigningTask && (
        <AssignModal
          task={assigningTask}
          team={team}
          onClose={() => setAssigningTask(null)}
          onAssign={handleAssign}
        />
      )}

      {showSettings && (
        <SettingsModal
          team={team}
          tasks={tasks}
          onClose={() => setShowSettings(false)}
          onChanged={loadAll}
        />
      )}

      {showWeeklyReview && (
        <WeeklyReviewModal
          tasks={todasLasSemanales}
          team={team}
          onClose={() => setShowWeeklyReview(false)}
          onCardClick={handleCardClick}
          onEditTask={setEditingTask}
          onUnassign={handleUnassign}
        />
      )}

      {showArrival && (
        <ArrivalModal
          team={team}
          arrivals={arrivals}
          onClose={() => setShowArrival(false)}
          onArrive={handleMarkArrival}
          onDepart={handleMarkDeparture}
          onTogglePause={handleTogglePause}
          onReturn={handleReturnToWork}
        />
      )}

      <CasesFloating
        team={team}
        casos={casos}
        comentarios={comentarios}
        onCreateCase={handleCreateCase}
        onAddComment={handleAddComment}
        onResolve={handleResolveCase}
      />
    </div>
  );
}
