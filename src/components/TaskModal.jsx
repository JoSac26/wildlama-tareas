import React, { useState } from "react";
import { supabase } from "../supabaseClient.js";

const DIAS = [
  { value: 1, label: "Lun" },
  { value: 2, label: "Mar" },
  { value: 3, label: "Mié" },
  { value: 4, label: "Jue" },
  { value: 5, label: "Vie" },
  { value: 6, label: "Sáb" },
  { value: 0, label: "Dom" },
];

export default function TaskModal({ initial, onClose, onSaved, onDelete }) {
  const [title, setTitle] = useState(initial?.title || "");
  const [type, setType] = useState(initial?.type || "diaria");
  const [specificDate, setSpecificDate] = useState(initial?.specific_date || "");
  const [reunionNombre, setReunionNombre] = useState(initial?.reunion || "");
  const [daysOfWeek, setDaysOfWeek] = useState(initial?.days_of_week || []);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  function toggleDay(d) {
    setDaysOfWeek((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  }

  async function handleSave() {
    if (!title.trim()) {
      setErrorMsg("Ponle un título a la tarea.");
      return;
    }
    if (type === "fecha" && !specificDate) {
      setErrorMsg("Elige un plazo para esta tarea.");
      return;
    }
    if (type === "fecha" && !reunionNombre.trim()) {
      setErrorMsg("Cuéntanos en qué reunión nació esta tarea.");
      return;
    }
    if (type === "semanal" && daysOfWeek.length === 0) {
      setErrorMsg("Elige al menos un día de la semana.");
      return;
    }

    setSaving(true);
    setErrorMsg(null);

    const payload = {
      title: title.trim(),
      type,
      specific_date: type === "fecha" ? specificDate : null,
      reunion: type === "fecha" ? reunionNombre.trim() : null,
      days_of_week: type === "semanal" ? daysOfWeek : null,
    };

    const result = initial
      ? await supabase.from("tasks").update(payload).eq("id", initial.id)
      : await supabase.from("tasks").insert(payload);

    setSaving(false);

    if (result.error) {
      setErrorMsg(result.error.message);
    } else {
      onSaved();
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{initial ? "Editar tarea" : "Nueva tarea"}</h2>

        <div className="field">
          <label>Título</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ej. Revisar tickets sin responder"
            autoFocus
          />
        </div>

        <div className="field">
          <label>Tipo</label>
          <div className="type-options">
            <button
              className={`type-chip ${type === "diaria" ? "selected" : ""}`}
              onClick={() => setType("diaria")}
            >
              Diaria
            </button>
            <button
              className={`type-chip ${type === "semanal" ? "selected" : ""}`}
              onClick={() => setType("semanal")}
            >
              Semanal
            </button>
            <button
              className={`type-chip ${type === "fecha" ? "selected" : ""}`}
              onClick={() => setType("fecha")}
            >
              Nacida en reunión
            </button>
          </div>
        </div>

        {type === "diaria" && (
          <p className="hint">Se resetea sola todos los días a medianoche.</p>
        )}

        {type === "semanal" && (
          <div className="field">
            <label>¿Qué días?</label>
            <div className="days-grid">
              {DIAS.map((d) => (
                <button
                  key={d.value}
                  className={`day-chip ${daysOfWeek.includes(d.value) ? "selected" : ""}`}
                  onClick={() => toggleDay(d.value)}
                >
                  {d.label}
                </button>
              ))}
            </div>
            <p className="hint">Se resetea sola a medianoche, el día que le toque.</p>
          </div>
        )}

        {type === "fecha" && (
          <div className="field">
            <label>¿En qué reunión nació esta tarea?</label>
            <input
              type="text"
              value={reunionNombre}
              onChange={(e) => setReunionNombre(e.target.value)}
              placeholder="Ej. Reunión semanal SAC"
            />
          </div>
        )}

        {type === "fecha" && (
          <div className="field">
            <label>Plazo para completarla</label>
            <input
              type="date"
              value={specificDate}
              onChange={(e) => setSpecificDate(e.target.value)}
            />
            <p className="hint">Tarea única, no se resetea. Queda visible desde hoy hasta que se complete.</p>
          </div>
        )}

        {errorMsg && <p className="hint" style={{ color: "#b23b3b" }}>{errorMsg}</p>}

        <div className="modal-actions">
          {onDelete ? (
            <button className="link-btn" onClick={onDelete} style={{ color: "#b23b3b" }}>
              Eliminar tarea
            </button>
          ) : (
            <span />
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-ghost" onClick={onClose}>
              Cancelar
            </button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
