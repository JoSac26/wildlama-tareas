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

function textoConContraste(hex) {
  if (!hex) return null;
  const limpio = hex.replace("#", "");
  const r = parseInt(limpio.substring(0, 2), 16);
  const g = parseInt(limpio.substring(2, 4), 16);
  const b = parseInt(limpio.substring(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 150 ? "#20241d" : "#ffffff";
}

export default function TaskCard({ task, team, onClick, onEdit, onUnassign }) {
  const asignado = team.find((m) => m.id === task.assigned_to);
  const enCursoConColor = task.status === "en_curso" && asignado?.color;
  const textColor = enCursoConColor ? textoConContraste(asignado.color) : null;

  const cardStyle = enCursoConColor
    ? { background: asignado.color, borderColor: asignado.color, color: textColor }
    : undefined;

  const pillStyle = enCursoConColor
    ? {
        background: textColor === "#ffffff" ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.12)",
        color: textColor,
      }
    : undefined;

  return (
    <div className="task-card" style={cardStyle} onClick={onClick}>
      <p className="task-title" style={textColor ? { color: textColor } : undefined}>
        {task.title}
      </p>
      {task.type === "fecha" && task.reunion && (
        <p className="task-reunion" style={textColor ? { color: textColor, opacity: 0.85 } : undefined}>
          🤝 {task.reunion}
        </p>
      )}
      <div className="task-meta">
        <span className={`badge badge-${task.type}`} style={pillStyle}>
          {TYPE_LABEL[task.type]}
          {task.type === "semanal" && task.days_of_week?.length > 0
            ? ` · ${task.days_of_week.map((d) => DIAS_CORTOS[d]).join("/")}`
            : ""}
          {task.type === "fecha" && task.specific_date ? ` · Plazo ${task.specific_date}` : ""}
        </span>

        {asignado ? (
          <span className="assignee" style={textColor ? { color: textColor } : undefined}>
            <span
              className="avatar"
              style={
                enCursoConColor
                  ? { background: "#fff", color: asignado.color, border: `2px solid ${asignado.color}` }
                  : { background: asignado.color || "var(--primary)" }
              }
            >
              {iniciales(asignado.name)}
            </span>
            {asignado.name}
            {task.status !== "completada" && (
              <button
                className="unassign-x"
                title="Soltar tarea (vuelve a pendiente)"
                style={textColor ? { color: textColor } : undefined}
                onClick={(e) => {
                  e.stopPropagation();
                  onUnassign();
                }}
              >
                ✕
              </button>
            )}
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
