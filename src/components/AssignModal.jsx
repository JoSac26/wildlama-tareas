import React from "react";

function iniciales(nombre) {
  return nombre
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

export default function AssignModal({ task, team, onClose, onAssign }) {
  const activos = team.filter((m) => m.active);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>¿Quién toma esta tarea?</h2>
        <p className="hint" style={{ marginTop: -10 }}>{task.title}</p>

        {activos.length === 0 ? (
          <p className="hint">
            No hay nadie en el equipo todavía. Agrega personas en "Equipo y tareas".
          </p>
        ) : (
          <div className="name-list">
            {activos.map((m) => (
              <button key={m.id} className="name-option" onClick={() => onAssign(task, m.id)}>
                <span className="avatar" style={{ background: m.color || "var(--primary)" }}>
                  {iniciales(m.name)}
                </span>
                {m.name}
              </button>
            ))}
          </div>
        )}

        <div className="modal-actions">
          <span />
          <button className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
