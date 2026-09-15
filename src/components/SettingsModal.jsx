import React, { useState } from "react";
import { supabase } from "../supabaseClient.js";

const PALETA = [
  "#E63946", "#F3722C", "#F9A825", "#43A047",
  "#00897B", "#1E88E5", "#3949AB", "#8E24AA",
  "#D81B60", "#6D4C41",
];

const PRIORIDADES = [
  { value: "alta", label: "🔴 Alta" },
  { value: "media", label: "🟡 Media" },
  { value: "baja", label: "🟢 Baja" },
];

export default function SettingsModal({ team, tasks, onClose, onChanged }) {
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PALETA[0]);
  const [saving, setSaving] = useState(false);

  const canalRotativo = (tasks || []).filter((t) => t.type === "diaria" && t.es_apertura);

  async function cambiarPrioridad(taskId, prioridad) {
    await supabase.from("tasks").update({ prioridad }).eq("id", taskId);
    onChanged();
  }

  async function quitarDeRotacion(taskId) {
    await supabase
      .from("tasks")
      .update({ es_apertura: false, prioridad: null, hora_inicio: null, hora_fin: null })
      .eq("id", taskId);
    onChanged();
  }

  async function addMember() {
    if (!newName.trim()) return;
    setSaving(true);
    await supabase.from("team_members").insert({ name: newName.trim(), color: newColor });
    setNewName("");
    setNewColor(PALETA[Math.floor(Math.random() * PALETA.length)]);
    setSaving(false);
    onChanged();
  }

  async function removeMember(id) {
    // Antes de eliminar a la persona, sus tareas asignadas vuelven a Pendiente
    // (para que nunca quede una tarea "en curso" sin nadie asignado).
    await supabase
      .from("tasks")
      .update({ status: "pendiente", assigned_to: null, updated_at: new Date().toISOString() })
      .eq("assigned_to", id);
    await supabase.from("team_members").delete().eq("id", id);
    onChanged();
  }

  async function toggleActive(member) {
    await supabase.from("team_members").update({ active: !member.active }).eq("id", member.id);
    onChanged();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Equipo</h2>
        <p className="hint" style={{ marginTop: -10 }}>
          Agrega o quita personas de la lista para asignar tareas.
        </p>

        {team.map((m) => (
          <div className="team-row" key={m.id}>
            <span className="member-swatch" style={{ background: m.color || "#999" }} />
            <input type="text" value={m.name} disabled style={{ opacity: m.active ? 1 : 0.5 }} />
            <button className="link-btn" onClick={() => toggleActive(m)}>
              {m.active ? "pausar" : "activar"}
            </button>
            <button className="icon-btn" onClick={() => removeMember(m.id)} title="Eliminar">
              ✕
            </button>
          </div>
        ))}

        <div className="field" style={{ marginTop: 18 }}>
          <label>Agregar persona</label>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nombre y apellido"
              onKeyDown={(e) => e.key === "Enter" && addMember()}
            />
            <button className="btn btn-primary" onClick={addMember} disabled={saving}>
              Agregar
            </button>
          </div>
          <label style={{ fontSize: 12.5 }}>Elige un color para identificarte</label>
          <div className="color-swatches">
            {PALETA.map((c) => (
              <button
                key={c}
                className={`color-swatch ${newColor === c ? "selected" : ""}`}
                style={{ background: c }}
                onClick={() => setNewColor(c)}
                title={c}
              />
            ))}
          </div>
        </div>

        <div className="field" style={{ marginTop: 24 }}>
          <label>🔄 Canal rotativo (prioridad)</label>
          <p className="hint" style={{ marginTop: -4 }}>
            Estas tareas se reparten solas entre quienes están presentes. Ajusta su prioridad o
            sácalas de la rotación aquí, sin entrar a editarlas una por una.
          </p>
          {canalRotativo.length === 0 && (
            <p className="hint">
              Ninguna todavía — marca una tarea diaria como "principal de apertura" al crearla.
            </p>
          )}
          {canalRotativo.map((t) => (
            <div className="priority-row" key={t.id}>
              <span className="priority-row-title">{t.title}</span>
              <div className="type-options" style={{ marginTop: 6 }}>
                {PRIORIDADES.map((p) => (
                  <button
                    key={p.value}
                    className={`type-chip ${t.prioridad === p.value ? "selected" : ""}`}
                    onClick={() => cambiarPrioridad(t.id, p.value)}
                  >
                    {p.label}
                  </button>
                ))}
                <button className="link-btn" onClick={() => quitarDeRotacion(t.id)}>
                  quitar de rotación
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="modal-actions">
          <span />
          <button className="btn btn-ghost" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
