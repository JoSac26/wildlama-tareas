import React from "react";

function iniciales(nombre) {
  return nombre
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

export default function ArrivalModal({ team, arrivals, onClose, onArrive, onDepart, onTogglePause, onReturn }) {
  const activos = team.filter((m) => m.active);
  const llegadaPorMiembro = new Map(arrivals.map((a) => [a.member_id, a]));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>📍 Llegada, pausa y salida</h2>
        <p className="hint" style={{ marginTop: -10 }}>
          Las tareas de canal (WhatsApp, correo, etc.) se reparten solas entre quienes están
          presentes y no pausados.
        </p>

        {activos.length === 0 ? (
          <p className="hint">No hay nadie en el equipo todavía.</p>
        ) : (
          <div className="name-list">
            {activos.map((m) => {
              const llegada = llegadaPorMiembro.get(m.id);
              const seFue = llegada && llegada.left_at;
              const pausado = llegada && !llegada.left_at && llegada.paused_at;
              const activo = llegada && !llegada.left_at && !llegada.paused_at;
              const noHaLlegado = !llegada;

              return (
                <div key={m.id} className="arrival-row">
                  <span className="avatar" style={{ background: m.color || "var(--primary)" }}>
                    {iniciales(m.name)}
                  </span>
                  <span className="arrival-row-name">{m.name}</span>

                  {noHaLlegado && (
                    <button className="btn btn-ghost btn-small" onClick={() => onArrive(m.id)}>
                      Marcar llegada
                    </button>
                  )}

                  {activo && (
                    <>
                      <button
                        className="btn btn-ghost btn-small"
                        onClick={() => onTogglePause(m.id, true)}
                      >
                        ⏸ Pausar
                      </button>
                      <button className="btn btn-ghost btn-small" onClick={() => onDepart(m.id)}>
                        🚪 Salida
                      </button>
                    </>
                  )}

                  {pausado && (
                    <>
                      <span className="hint" style={{ margin: 0 }}>en pausa</span>
                      <button
                        className="btn btn-ghost btn-small"
                        onClick={() => onTogglePause(m.id, false)}
                      >
                        ▶️ Reanudar
                      </button>
                      <button className="btn btn-ghost btn-small" onClick={() => onDepart(m.id)}>
                        🚪 Salida
                      </button>
                    </>
                  )}

                  {seFue && (
                    <>
                      <span className="hint" style={{ margin: 0 }}>ya se fue hoy</span>
                      <button className="btn btn-ghost btn-small" onClick={() => onReturn(m.id)}>
                        ↩️ Volver a entrar
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
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
