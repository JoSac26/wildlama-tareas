import React from "react";

const TYPE_LABEL = {
  diaria: "Diaria",
  fecha: "Reunión",
  semanal: "Semanal",
};

const DIAS_CORTOS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function iniciales(nombre) {
  return nombre
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

export default function TaskCard({ task, team, onClick, onEdit }) {
  const asignado = team.find((m) => m.id === task.assigned_to);

  return (
    <div className="task-card" onClick={onClick}>
      <p className="task-title">{task.title}</p>
      {task.type === "fecha" && task.reunion && (
        <p className="task-reunion">🤝 {task.reunion}</p>
      )}
      <div className="task-meta">
        <span className={`badge badge-${task.type}`}>
          {TYPE_LABEL[task.type]}
          {task.type === "semanal" && task.days_of_week?.length > 0
            ? ` · ${task.days_of_week.map((d) => DIAS_CORTOS[d]).join("/")}`
            : ""}
          {task.type === "fecha" && task.specific_date ? ` · Plazo ${task.specific_date}` : ""}
        </span>

        {asignado ? (
          <span className="assignee">
            <span className="avatar">{iniciales(asignado.name)}</span>
            {asignado.name}
          </span>
        ) : (
          <button
            className="link-btn"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
          >
            editar
          </button>
        )}
      </div>
    </div>
  );
}
