import React from "react";
import TaskCard from "./TaskCard.jsx";

const COLUMNS = [
  { key: "pendiente", label: "Pendiente" },
  { key: "en_curso", label: "En curso" },
  { key: "completada", label: "Completada" },
];

export default function Section({ id, title, subtitle, grouped, team, onCardClick, onEditTask, headerAction }) {
  const total = grouped.pendiente.length + grouped.en_curso.length + grouped.completada.length;

  return (
    <section className={`task-section section-${id}`}>
      <div className="section-header">
        <div>
          <h2>{title}</h2>
          <p className="section-subtitle">{subtitle}</p>
        </div>
        <div className="section-header-right">
          {headerAction}
          <span className="section-total">{total} tareas</span>
        </div>
      </div>

      <div className="board">
        {COLUMNS.map((col) => (
          <div className="column" key={col.key}>
            <div className="column-header">
              <span className={`dot dot-${col.key}`} />
              <span className="column-title">{col.label}</span>
              <span className="column-count">{grouped[col.key].length}</span>
            </div>

            {grouped[col.key].length === 0 && (
              <div className="empty-column">
                {col.key === "pendiente" ? "Sin tareas por tomar 🎉" : "Nada por aquí todavía"}
              </div>
            )}

            {grouped[col.key].map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                team={team}
                onClick={() => onCardClick(task)}
                onEdit={() => onEditTask(task)}
              />
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
