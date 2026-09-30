import React, { useState } from "react";
import NewCaseModal from "./NewCaseModal.jsx";

function iniciales(nombre) {
  return nombre
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

function CaseBubble({ caso, team, comentarios, onAddComment, onResolve }) {
  const [texto, setTexto] = useState("");
  const [autorId, setAutorId] = useState(team[0]?.id || "");
  const creador = team.find((m) => m.id === caso.creado_por);

  function enviar() {
    if (!texto.trim() || !autorId) return;
    onAddComment(caso.id, autorId, texto.trim());
    setTexto("");
  }

  return (
    <div className="case-bubble">
      <div className="case-bubble-header">
        <div>
          <p className="case-bubble-title">{caso.numero_pedido}</p>
          {caso.descripcion && <p className="case-bubble-desc">{caso.descripcion}</p>}
        </div>
        <button className="icon-btn" title="Marcar resuelto" onClick={() => onResolve(caso.id)}>
          ✓
        </button>
      </div>
      {creador && (
        <p className="hint" style={{ margin: "2px 0 8px" }}>
          Dejado por {creador.name}
        </p>
      )}

      {comentarios.length > 0 && (
        <div className="case-comments">
          {comentarios.map((c) => {
            const autor = team.find((m) => m.id === c.autor);
            const cuando = new Date(c.created_at).toLocaleString("es-CL", {
              day: "2-digit",
              month: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            });
            return (
              <div key={c.id} className="case-comment-row">
                <span className="case-comment-meta">
                  {autor?.name || "?"} · {cuando}
                </span>
                <span>{c.texto}</span>
              </div>
            );
          })}
        </div>
      )}

      {team.length > 0 && (
        <div className="case-comment-form">
          <select value={autorId} onChange={(e) => setAutorId(e.target.value)}>
            {team.map((m) => (
              <option key={m.id} value={m.id}>
                {iniciales(m.name)}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Agregar comentario…"
            onKeyDown={(e) => e.key === "Enter" && enviar()}
          />
          <button className="btn btn-ghost btn-small" onClick={enviar}>
            Enviar
          </button>
        </div>
      )}
    </div>
  );
}

export default function CasesFloating({ team, casos, comentarios, onCreateCase, onAddComment, onResolve }) {
  const [open, setOpen] = useState(false);
  const [showNew, setShowNew] = useState(false);

  return (
    <>
      <button className="floating-cases-btn" onClick={() => setOpen((o) => !o)}>
        🎫
        {casos.length > 0 && <span className="floating-cases-badge">{casos.length}</span>}
      </button>

      {open && (
        <div className="floating-cases-panel">
          <div className="floating-cases-header">
            <h3>🎫 Casos pendientes</h3>
            <button className="icon-btn" onClick={() => setOpen(false)}>
              ✕
            </button>
          </div>

          <div style={{ padding: "0 14px 10px" }}>
            <button className="btn btn-primary btn-small" onClick={() => setShowNew(true)}>
              + Nuevo caso
            </button>
          </div>

          <div className="floating-cases-list">
            {casos.length === 0 && (
              <p className="hint" style={{ padding: "0 0 10px" }}>
                No hay casos pendientes 🎉
              </p>
            )}
            {casos.map((caso) => (
              <CaseBubble
                key={caso.id}
                caso={caso}
                team={team}
                comentarios={comentarios.filter((c) => c.caso_id === caso.id)}
                onAddComment={onAddComment}
                onResolve={onResolve}
              />
            ))}
          </div>
        </div>
      )}

      {showNew && (
        <NewCaseModal
          team={team}
          onClose={() => setShowNew(false)}
          onCreate={(data) => {
            onCreateCase(data);
            setShowNew(false);
          }}
        />
      )}
    </>
  );
}
