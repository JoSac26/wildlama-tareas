import React, { useEffect, useMemo, useState, useCallback } from "react";
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
