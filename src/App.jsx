import React, { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "./supabaseClient.js";
import Board from "./components/Board.jsx";
import TaskModal from "./components/TaskModal.jsx";
import AssignModal from "./components/AssignModal.jsx";
import SettingsModal from "./components/SettingsModal.jsx";

const DIA_HOY = new Date().getDay(); // 0=domingo ... 6=sábado

function tareaAplicaHoy(task) {
  if (task.type === "diaria") return true;
  if (task.type === "semanal") return (task.days_of_week || []).includes(DIA_HOY);
  if (task.type === "fecha") {
    const hoy = new Date().toISOString().slice(0, 10);
    // se muestra el día indicado, y sigue visible si quedó pendiente de días anteriores
    return !task.specific_date || task.specific_date <= hoy;
  }
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

  const visibleTasks = useMemo(() => tasks.filter(tareaAplicaHoy), [tasks]);

  const grouped = useMemo(
    () => ({
      pendiente: visibleTasks.filter((t) => t.status === "pendiente"),
      en_curso: visibleTasks.filter((t) => t.status === "en_curso"),
      completada: visibleTasks.filter((t) => t.status === "completada"),
    }),
    [visibleTasks]
  );

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
        <Board
          grouped={grouped}
          team={team}
          onCardClick={handleCardClick}
          onEditTask={setEditingTask}
        />
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
    </div>
  );
}
