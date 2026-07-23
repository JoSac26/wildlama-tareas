import React, { useState } from "react";
import { supabase } from "../supabaseClient.js";

const PALETA = [
  "#E63946", "#F3722C", "#F9A825", "#43A047",
  "#00897B", "#1E88E5", "#3949AB", "#8E24AA",
  "#D81B60", "#6D4C41",
];

export default function SettingsModal({ team, onClose, onChanged }) {
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PALETA[0]);
  const [saving, setSaving] = useState(false);

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
