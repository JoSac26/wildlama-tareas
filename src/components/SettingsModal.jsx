import React, { useState } from "react";
import { supabase } from "../supabaseClient.js";

export default function SettingsModal({ team, onClose, onChanged }) {
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  async function addMember() {
    if (!newName.trim()) return;
    setSaving(true);
    await supabase.from("team_members").insert({ name: newName.trim() });
    setNewName("");
    setSaving(false);
    onChanged();
  }

  async function removeMember(id) {
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
          <div style={{ display: "flex", gap: 8 }}>
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
