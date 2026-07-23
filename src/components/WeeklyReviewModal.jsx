import React from "react";
import TaskCard from "./TaskCard.jsx";

export default function WeeklyReviewModal({ tasks, team, onClose, onCardClick, onEditTask, onUnassign }) {
  const pendientesOEnCurso = tasks.filter((t) => t.status !== "completada");
  const completadas = tasks.filter((t) => t.status === "completada");

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <h2>🗓️ Todas las tareas semanales</h2>
        <p className="hint" style={{ marginTop: -10 }}>
          Incluye las de días que no son hoy — útil para revisar si algo quedó atrasado.
        </p>

        <p className="review-subheading">Por hacer o en curso ({pendientesOEnCurso.length})</p>
        {pendientesOEnCurso.length === 0 && (
          <p className="hint">Nada atrasado, todo al día 🎉</p>
        )}
        {pendientesOEnCurso.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            team={team}
            onClick={() => onCardClick(task)}
            onEdit={() => onEditTask(task)}
            onUnassign={() => onUnassign(task)}
          />
        ))}

        {completadas.length > 0 && (
          <>
            <p className="review-subheading">Completadas ({completadas.length})</p>
            {completadas.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                team={team}
                onClick={() => onCardClick(task)}
                onEdit={() => onEditTask(task)}
                onUnassign={() => onUnassign(task)}
              />
            ))}
          </>
        )}

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
