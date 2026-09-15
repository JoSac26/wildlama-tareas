import React, { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "./supabaseClient.js";
import Section from "./components/Section.jsx";
import WeeklyReviewModal from "./components/WeeklyReviewModal.jsx";
import TaskModal from "./components/TaskModal.jsx";
import AssignModal from "./components/AssignModal.jsx";
import SettingsModal from "./components/SettingsModal.jsx";
import ArrivalModal from "./components/ArrivalModal.jsx";

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

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [team, setTeam] = useState([]);
  const [arrivals, setArrivals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showNewTask, setShowNewTask] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [assigningTask, setAssigningTask] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showWeeklyReview, setShowWeeklyReview] = useState(false);
  const [showArrival, setShowArrival] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    const hoy = new Date().toISOString().slice(0, 10);
    const [tasksRes, teamRes, arrivalsRes] = await Promise.all([
      supabase.from("tasks").select("*").order("created_at", { ascending: true }),
      supabase.from("team_members").select("*").order("name", { ascending: true }),
      supabase
        .from("arrivals")
        .select("*")
        .eq("arrival_date", hoy)
        .order("arrived_at", { ascending: true }),
    ]);
    if (tasksRes.error || teamRes.error || arrivalsRes.error) {
      setError((tasksRes.error || teamRes.error || arrivalsRes.error).message);
    } else {
      setTasks(tasksRes.data);
      setTeam(teamRes.data);
      setArrivals(arrivalsRes.data);
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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadAll]);

  const diarias = useMemo(() => tasks.filter((t) => t.type === "diaria"), [tasks]);
  const semanalesHoy = useMemo(
    () => tasks.filter((t) => t.type === "semanal" && semanalVisibleEnTablero(t)),
    [tasks]
  );
  const todasLasSemanales = useMemo(() => tasks.filter((t) => t.type === "semanal"), [tasks]);
  const reunion = useMemo(
    () => tasks.filter((t) => t.type === "fecha" && tareaReunionVisible(t)),
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

    const prioridadesActivas =
      presentes.length >= 3
        ? ["alta", "media", "baja"]
        : presentes.length === 2
        ? ["alta", "media"]
        : ["alta"];

    const aperturaPendientes = aperturaTasks
      .filter((t) => t.status !== "completada" && prioridadesActivas.includes(t.prioridad))
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    if (aperturaPendientes.length === 0) return;

    const porCorregir = aperturaPendientes
      .map((task, i) => {
        const memberId = presentes[i % presentes.length].member_id;
        const yaEsta = task.assigned_to === memberId && task.status === "en_curso";
        return yaEsta ? null : { id: task.id, memberId };
      })
      .filter(Boolean);

    if (porCorregir.length === 0) return;

    porCorregir.forEach(({ id, memberId }) => {
      supabase
        .from("tasks")
        .update({ status: "en_curso", assigned_to: memberId, updated_at: new Date().toISOString() })
        .eq("id", id)
        .then(() => {});
    });
  }, [tasks, presentes]);

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
    </div>
  );
}
