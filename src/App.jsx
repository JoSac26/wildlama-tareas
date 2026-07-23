import React, { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "./supabaseClient.js";
import Section from "./components/Section.jsx";
import WeeklyReviewModal from "./components/WeeklyReviewModal.jsx";
import TaskModal from "./components/TaskModal.jsx";
import AssignModal from "./components/AssignModal.jsx";
import SettingsModal from "./components/SettingsModal.jsx";

const DIA_HOY = new Date().getDay(); // 0=domingo ... 6=sábado

function esSemanalDeHoy(task) {
  return (task.days_of_week || []).includes(DIA_HOY);
}

function tareaReunionVisible() {
  // Siempre visible: nace en la reunión y se muestra de inmediato.
  // El plazo es solo un dato informativo de cuándo vence, no controla si se ve o no.
  return true;
}

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showNewTask, setShowNewTask] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [assigningTask, setAssigningTask] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showWeeklyReview, setShowWeeklyReview] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [tasksRes, teamRes] = await Promise.all([
      supabase.from("tasks").select("*").order("created_at", { ascending: true }),
      supabase.from("team_members").select("*").order("name", { ascending: true }),
    ]);
    if (tasksRes.error || teamRes.error) {
      setError((tasksRes.error || teamRes.error).message);
    } else {
      setTasks(tasksRes.data);
      setTeam(teamRes.data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAll();

    const channel = supabase
      .channel("realtime-tareas")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, loadAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "team_members" }, loadAll)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadAll]);

  const diarias = useMemo(() => tasks.filter((t) => t.type === "diaria"), [tasks]);
  const semanalesHoy = useMemo(
    () => tasks.filter((t) => t.type === "semanal" && esSemanalDeHoy(t)),
    [tasks]
  );
  const todasLasSemanales = useMemo(() => tasks.filter((t) => t.type === "semanal"), [tasks]);
  const reunion = useMemo(
    () => tasks.filter((t) => t.type === "fecha" && tareaReunionVisible(t)),
    [tasks]
  );

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
        </div>
        <div className="header-actions">
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
          />

          <Section
            id="semanales"
            title="🗓️ Semanales"
            subtitle="Solo se muestran el día que les toca"
            grouped={agrupar(semanalesHoy)}
            team={team}
            onCardClick={handleCardClick}
            onEditTask={setEditingTask}
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
        <SettingsModal team={team} onClose={() => setShowSettings(false)} onChanged={loadAll} />
      )}

      {showWeeklyReview && (
        <WeeklyReviewModal
          tasks={todasLasSemanales}
          team={team}
          onClose={() => setShowWeeklyReview(false)}
          onCardClick={handleCardClick}
          onEditTask={setEditingTask}
        />
      )}
    </div>
  );
}
