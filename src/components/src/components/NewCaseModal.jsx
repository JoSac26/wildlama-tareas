import React, { useState } from "react";

export default function NewCaseModal({ team, onClose, onCreate }) {
  const [numeroPedido, setNumeroPedido] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [creadoPor, setCreadoPor] = useState(team[0]?.id || "");
  const [errorMsg, setErrorMsg] = useState(null);

  function guardar() {
    if (!numeroPedido.trim()) {
      setErrorMsg("Ponle el número de pedido.");
      return;
    }
    onCreate({
      numero_pedido: numeroPedido.trim(),
      descripcion: descripcion.trim() || null,
      creado_por: creadoPor || null,
    });
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>🎫 Nuevo caso pendiente</h2>

        <div className="field">
          <label>N° de pedido</label>
          <input
            type="text"
            value={numeroPedido}
            onChange={(e) => setNumeroPedido(e.target.value)}
            placeholder="Ej. #12345"
            autoFocus
          />
        </div>

        <div className="field">
          <label>¿Qué queda pendiente?</label>
          <textarea
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            rows={3}
            placeholder="Ej. Falta confirmar cambio de talla con la clienta"
          />
        </div>

        {team.length > 0 && (
          <div className="field">
            <label>¿Quién lo deja?</label>
            <select value={creadoPor} onChange={(e) => setCreadoPor(e.target.value)}>
              {team.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {errorMsg && <p className="hint" style={{ color: "#b23b3b" }}>{errorMsg}</p>}

        <div className="modal-actions">
          <span />
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-ghost" onClick={onClose}>
              Cancelar
            </button>
            <button className="btn btn-primary" onClick={guardar}>
              Guardar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
