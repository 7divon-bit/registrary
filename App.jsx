import { useState, useEffect, useRef } from "react";

// ─── STYLES ───────────────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800&family=IBM+Plex+Mono:wght@400;500&family=Barlow:wght@400;500;600&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg:       #0a0c0b;
    --surface:  #111613;
    --border:   #1e2620;
    --green:    #3dffa0;
    --green-dim:#1a7a4a;
    --amber:    #f5a623;
    --red:      #ff4f4f;
    --blue:     #4fc3f7;
    --text:     #d4e8dc;
    --muted:    #4a6356;
    --font-head:'Barlow Condensed', sans-serif;
    --font-body:'Barlow', sans-serif;
    --font-mono:'IBM Plex Mono', monospace;
  }

  body { background: var(--bg); color: var(--text); font-family: var(--font-body); }

  /* ── LAYOUT ── */
  .app { min-height: 100vh; display: flex; flex-direction: column; }

  .topbar {
    display: flex; align-items: center; gap: 12px;
    padding: 14px 28px; border-bottom: 1px solid var(--border);
    background: var(--surface);
    position: sticky; top: 0; z-index: 100;
  }
  .logo {
    font-family: var(--font-head); font-size: 22px; font-weight: 800;
    letter-spacing: 3px; color: var(--green); text-transform: uppercase;
  }
  .logo span { color: var(--muted); font-weight: 400; }
  .live-dot {
    width: 8px; height: 8px; border-radius: 50%; background: var(--green);
    animation: pulse 1.6s ease-in-out infinite;
  }
  @keyframes pulse {
    0%,100% { opacity: 1; box-shadow: 0 0 0 0 rgba(61,255,160,.6); }
    50%      { opacity: .6; box-shadow: 0 0 0 6px rgba(61,255,160,0); }
  }
  .topbar-right { margin-left: auto; display: flex; gap: 8px; }
  .tab-btn {
    font-family: var(--font-head); font-size: 13px; font-weight: 600;
    letter-spacing: 1.5px; text-transform: uppercase;
    padding: 6px 16px; border-radius: 3px; border: 1px solid var(--border);
    background: transparent; color: var(--muted); cursor: pointer;
    transition: all .15s;
  }
  .tab-btn:hover { color: var(--text); border-color: var(--muted); }
  .tab-btn.active { background: var(--green-dim); border-color: var(--green); color: var(--green); }

  .main { display: grid; grid-template-columns: 1fr 360px; flex: 1; }

  /* ── LEFT PANEL ── */
  .left { padding: 28px; overflow-y: auto; }

  /* ── RIGHT PANEL ── */
  .right {
    border-left: 1px solid var(--border);
    display: flex; flex-direction: column;
    overflow: hidden;
  }
  .panel-title {
    font-family: var(--font-head); font-size: 11px; font-weight: 700;
    letter-spacing: 2.5px; text-transform: uppercase; color: var(--muted);
    padding: 14px 20px; border-bottom: 1px solid var(--border);
    background: var(--surface);
  }

  /* ── STATS ROW ── */
  .stats-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 28px; }
  .stat-card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 4px; padding: 18px 20px;
    position: relative; overflow: hidden;
  }
  .stat-card::before {
    content: ''; position: absolute; left: 0; top: 0; bottom: 0;
    width: 3px; background: var(--green);
  }
  .stat-label {
    font-family: var(--font-head); font-size: 10px; font-weight: 700;
    letter-spacing: 2px; text-transform: uppercase; color: var(--muted);
    margin-bottom: 6px;
  }
  .stat-value {
    font-family: var(--font-mono); font-size: 28px; font-weight: 500;
    color: var(--green); line-height: 1;
  }
  .stat-sub { font-size: 11px; color: var(--muted); margin-top: 4px; }

  /* ── FORM CARD ── */
  .form-card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 4px; padding: 24px; margin-bottom: 28px;
  }
  .form-title {
    font-family: var(--font-head); font-size: 16px; font-weight: 700;
    letter-spacing: 1px; text-transform: uppercase; color: var(--text);
    margin-bottom: 18px; padding-bottom: 12px; border-bottom: 1px solid var(--border);
  }
  .form-grid { display: grid; grid-template-columns: 1fr 1fr 1fr auto; gap: 10px; align-items: end; }
  .field label {
    display: block; font-family: var(--font-head); font-size: 10px; font-weight: 700;
    letter-spacing: 2px; text-transform: uppercase; color: var(--muted); margin-bottom: 6px;
  }
  .field input {
    width: 100%; background: var(--bg); border: 1px solid var(--border);
    border-radius: 3px; padding: 9px 12px; color: var(--text);
    font-family: var(--font-mono); font-size: 13px;
    transition: border-color .15s; outline: none;
  }
  .field input:focus { border-color: var(--green); }
  .btn-primary {
    background: var(--green); color: var(--bg); border: none; border-radius: 3px;
    padding: 10px 20px; font-family: var(--font-head); font-size: 13px;
    font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase;
    cursor: pointer; white-space: nowrap;
    transition: opacity .15s, transform .1s;
  }
  .btn-primary:hover { opacity: .85; }
  .btn-primary:active { transform: scale(.97); }

  /* ── FREIGHT TABLE ── */
  .table-header {
    font-family: var(--font-head); font-size: 16px; font-weight: 700;
    letter-spacing: 1px; text-transform: uppercase; color: var(--text);
    margin-bottom: 14px; display: flex; align-items: center; gap: 10px;
  }
  .count-badge {
    font-family: var(--font-mono); font-size: 11px;
    background: var(--border); color: var(--muted);
    padding: 2px 8px; border-radius: 20px;
  }
  .freight-table { width: 100%; border-collapse: collapse; }
  .freight-table th {
    font-family: var(--font-head); font-size: 10px; font-weight: 700;
    letter-spacing: 2px; text-transform: uppercase; color: var(--muted);
    padding: 8px 12px; text-align: left;
    border-bottom: 1px solid var(--border);
  }
  .freight-table td {
    padding: 12px 12px; border-bottom: 1px solid var(--border);
    font-size: 13px; vertical-align: middle;
  }
  .freight-table tr:hover td { background: rgba(61,255,160,.03); }
  .freight-table .mono { font-family: var(--font-mono); font-size: 12px; }

  /* ── STATUS BADGE ── */
  .badge {
    font-family: var(--font-mono); font-size: 10px; font-weight: 500;
    letter-spacing: .5px; padding: 3px 8px; border-radius: 2px;
    display: inline-flex; align-items: center; gap: 5px;
    white-space: nowrap;
  }
  .badge::before { content: ''; width: 5px; height: 5px; border-radius: 50%; background: currentColor; }
  .badge.CREATED   { background: rgba(79,195,247,.1);  color: var(--blue); }
  .badge.ASSIGNED  { background: rgba(245,166,35,.1);  color: var(--amber); }
  .badge.IN_TRANSIT{ background: rgba(61,255,160,.1);  color: var(--green); }
  .badge.DELIVERED { background: rgba(61,255,160,.15); color: var(--green); }
  .badge.CANCELLED { background: rgba(255,79,79,.1);   color: var(--red); }

  /* ── ACTION BUTTONS ── */
  .action-group { display: flex; gap: 6px; }
  .btn-sm {
    font-family: var(--font-head); font-size: 10px; font-weight: 700;
    letter-spacing: 1px; text-transform: uppercase;
    padding: 4px 10px; border-radius: 2px; border: 1px solid;
    cursor: pointer; transition: all .15s; background: transparent;
  }
  .btn-sm.match  { border-color: var(--amber);  color: var(--amber); }
  .btn-sm.match:hover  { background: rgba(245,166,35,.15); }
  .btn-sm.transit{ border-color: var(--green);  color: var(--green); }
  .btn-sm.transit:hover{ background: rgba(61,255,160,.12); }
  .btn-sm.deliver{ border-color: var(--blue);   color: var(--blue); }
  .btn-sm.deliver:hover{ background: rgba(79,195,247,.12); }
  .btn-sm.cancel { border-color: var(--red);    color: var(--red); }
  .btn-sm.cancel:hover { background: rgba(255,79,79,.12); }
  .btn-sm:disabled { opacity: .25; cursor: not-allowed; }

  /* ── EVENT STREAM ── */
  .event-stream { flex: 1; overflow-y: auto; padding: 0; }
  .event-item {
    display: flex; align-items: flex-start; gap: 10px;
    padding: 11px 20px; border-bottom: 1px solid var(--border);
    animation: slideIn .2s ease-out;
  }
  @keyframes slideIn {
    from { opacity: 0; transform: translateX(10px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  .event-dot { width: 6px; height: 6px; border-radius: 50%; margin-top: 5px; flex-shrink: 0; }
  .event-type {
    font-family: var(--font-mono); font-size: 11px; font-weight: 500; color: var(--text);
  }
  .event-meta { font-family: var(--font-mono); font-size: 10px; color: var(--muted); margin-top: 2px; }
  .event-id   { font-family: var(--font-mono); font-size: 9px; color: var(--border); margin-top: 1px; }

  /* ── OPERATOR STATUS ── */
  .ops-section { padding: 16px 20px; border-bottom: 1px solid var(--border); }
  .ops-title {
    font-family: var(--font-head); font-size: 10px; font-weight: 700;
    letter-spacing: 2px; text-transform: uppercase; color: var(--muted); margin-bottom: 10px;
  }
  .op-row { display: flex; align-items: center; gap: 8px; margin-bottom: 7px; }
  .op-dot { width: 7px; height: 7px; border-radius: 50%; }
  .op-name { font-size: 13px; color: var(--text); flex: 1; }
  .op-badge {
    font-family: var(--font-mono); font-size: 9px; padding: 2px 7px;
    border-radius: 2px; background: rgba(61,255,160,.1); color: var(--green);
  }
  .op-badge.busy {
    background: rgba(245,166,35,.1); color: var(--amber);
  }

  /* ── EMPTY ── */
  .empty-state {
    padding: 48px; text-align: center; color: var(--muted);
    font-family: var(--font-mono); font-size: 12px;
  }

  /* ── TOAST ── */
  .toast-area { position: fixed; bottom: 24px; right: 24px; display: flex; flex-direction: column; gap: 8px; z-index: 999; }
  .toast {
    background: var(--surface); border: 1px solid var(--green-dim);
    border-left: 3px solid var(--green);
    padding: 12px 16px; border-radius: 4px;
    font-family: var(--font-mono); font-size: 12px; color: var(--green);
    animation: toastIn .25s ease-out;
    box-shadow: 0 4px 20px rgba(0,0,0,.5);
  }
  @keyframes toastIn {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  /* ── SCROLLBAR ── */
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }

  @media (max-width: 900px) {
    .main { grid-template-columns: 1fr; }
    .right { border-left: none; border-top: 1px solid var(--border); max-height: 320px; }
    .form-grid { grid-template-columns: 1fr 1fr; }
    .stats-row { grid-template-columns: 1fr 1fr; }
  }
`;

// ─── EVENT COLOR MAP ────────────────────────────────────────────────────────
const eventColor = {
  FRETE_CREATED:  '#4fc3f7',
  FRETE_ASSIGNED: '#f5a623',
  IN_TRANSIT:     '#3dffa0',
  DELIVERED:      '#3dffa0',
  CANCELLED:      '#ff4f4f',
};

// ─── STATUS FLOW ────────────────────────────────────────────────────────────
function getActions(frete) {
  if (frete.status === 'CREATED')    return ['match'];
  if (frete.status === 'ASSIGNED')   return ['transit', 'cancel'];
  if (frete.status === 'IN_TRANSIT') return ['deliver', 'cancel'];
  return [];
}

// ─── MAIN APP ────────────────────────────────────────────────────────────────
export default function MobiGreen() {
  const [fretes, setFretes]     = useState([]);
  const [events, setEvents]     = useState([]);
  const [operadores]            = useState([
    { id: 1, nome: 'João Silva', ativo: true },
    { id: 2, nome: 'Maria Oliveira', ativo: true },
  ]);
  const [form, setForm]         = useState({ origem: '', destino: '', valor: '' });
  const [toasts, setToasts]     = useState([]);
  const streamRef               = useRef(null);
  const nextId                  = useRef(1);

  function addEvent(type, payload) {
    const ev = {
      event_id:   Date.now().toString(36).toUpperCase(),
      event_type: type,
      timestamp:  new Date().toISOString(),
      payload,
    };
    setEvents(prev => [ev, ...prev]);
    return ev;
  }

  function toast(msg) {
    const id = Date.now();
    setToasts(p => [...p, { id, msg }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3000);
  }

  function criarFrete() {
    if (!form.origem || !form.destino || !form.valor) return toast('Preencha todos os campos');
    const frete = {
      id: nextId.current++,
      origem: form.origem.trim(),
      destino: form.destino.trim(),
      valor: parseFloat(form.valor),
      status: 'CREATED',
      operador: null,
      createdAt: new Date().toISOString(),
    };
    setFretes(p => [frete, ...p]);
    addEvent('FRETE_CREATED', frete);
    setForm({ origem: '', destino: '', valor: '' });
    toast(`Frete #${frete.id} criado com sucesso`);
  }

  function matchFrete(id) {
    const op = operadores.find(o => o.ativo);
    if (!op) return toast('Nenhum operador disponível');
    setFretes(p => p.map(f => {
      if (f.id !== id) return f;
      const updated = { ...f, operador: op, status: 'ASSIGNED' };
      addEvent('FRETE_ASSIGNED', updated);
      return updated;
    }));
    toast(`Operador ${op.nome} alocado`);
  }

  function updateStatus(id, status) {
    setFretes(p => p.map(f => {
      if (f.id !== id) return f;
      const updated = { ...f, status };
      addEvent(status, updated);
      return updated;
    }));
    toast(`Status → ${status}`);
  }

  // Scroll event stream to top on new event
  useEffect(() => {
    if (streamRef.current) streamRef.current.scrollTop = 0;
  }, [events.length]);

  const totalReceita = fretes.reduce((acc, f) => acc + f.valor, 0);
  const entregues    = fretes.filter(f => f.status === 'DELIVERED').length;

  return (
    <>
      <style>{css}</style>
      <div className="app">

        {/* TOPBAR */}
        <header className="topbar">
          <div className="live-dot" />
          <div className="logo">Mobi <span>·</span> Green</div>
          <div style={{ fontSize: 11, fontFamily: 'IBM Plex Mono', color: 'var(--muted)', marginLeft: 8 }}>
            MVP v0.1
          </div>
        </header>

        <div className="main">
          {/* LEFT */}
          <div className="left">

            {/* STATS */}
            <div className="stats-row">
              <div className="stat-card">
                <div className="stat-label">Fretes</div>
                <div className="stat-value">{String(fretes.length).padStart(2,'0')}</div>
                <div className="stat-sub">total criados</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Receita</div>
                <div className="stat-value" style={{ fontSize: 22 }}>
                  {totalReceita.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </div>
                <div className="stat-sub">valor acumulado</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Eventos</div>
                <div className="stat-value">{String(events.length).padStart(2,'0')}</div>
                <div className="stat-sub">{entregues} entregues</div>
              </div>
            </div>

            {/* FORM */}
            <div className="form-card">
              <div className="form-title">Novo Frete</div>
              <div className="form-grid">
                <div className="field">
                  <label>Origem</label>
                  <input
                    placeholder="ex: São Paulo"
                    value={form.origem}
                    onChange={e => setForm(p => ({ ...p, origem: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && criarFrete()}
                  />
                </div>
                <div className="field">
                  <label>Destino</label>
                  <input
                    placeholder="ex: Rio de Janeiro"
                    value={form.destino}
                    onChange={e => setForm(p => ({ ...p, destino: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && criarFrete()}
                  />
                </div>
                <div className="field">
                  <label>Valor (R$)</label>
                  <input
                    placeholder="ex: 1500"
                    type="number"
                    value={form.valor}
                    onChange={e => setForm(p => ({ ...p, valor: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && criarFrete()}
                  />
                </div>
                <button className="btn-primary" onClick={criarFrete}>+ Criar</button>
              </div>
            </div>

            {/* TABLE */}
            <div className="table-header">
              Fretes
              <span className="count-badge">{fretes.length}</span>
            </div>

            {fretes.length === 0 ? (
              <div className="empty-state">// nenhum frete registrado</div>
            ) : (
              <table className="freight-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Rota</th>
                    <th>Valor</th>
                    <th>Operador</th>
                    <th>Status</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {fretes.map(f => {
                    const actions = getActions(f);
                    return (
                      <tr key={f.id}>
                        <td className="mono" style={{ color: 'var(--muted)' }}>
                          {String(f.id).padStart(3, '0')}
                        </td>
                        <td>
                          <span style={{ color: 'var(--text)', fontWeight: 500 }}>{f.origem}</span>
                          <span style={{ color: 'var(--muted)', margin: '0 6px', fontSize: 11 }}>→</span>
                          <span style={{ color: 'var(--text)' }}>{f.destino}</span>
                        </td>
                        <td className="mono" style={{ color: 'var(--green)' }}>
                          {f.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                        <td style={{ fontSize: 12, color: f.operador ? 'var(--text)' : 'var(--muted)' }}>
                          {f.operador?.nome ?? '—'}
                        </td>
                        <td><span className={`badge ${f.status}`}>{f.status}</span></td>
                        <td>
                          <div className="action-group">
                            {actions.includes('match') && (
                              <button className="btn-sm match" onClick={() => matchFrete(f.id)}>Match</button>
                            )}
                            {actions.includes('transit') && (
                              <button className="btn-sm transit" onClick={() => updateStatus(f.id, 'IN_TRANSIT')}>Em rota</button>
                            )}
                            {actions.includes('deliver') && (
                              <button className="btn-sm deliver" onClick={() => updateStatus(f.id, 'DELIVERED')}>Entregar</button>
                            )}
                            {actions.includes('cancel') && (
                              <button className="btn-sm cancel" onClick={() => updateStatus(f.id, 'CANCELLED')}>Cancelar</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* RIGHT — EVENT STREAM */}
          <div className="right">
            <div className="ops-section">
              <div className="ops-title">Operadores</div>
              {operadores.map(op => {
                const busy = fretes.some(f => f.operador?.id === op.id && ['ASSIGNED','IN_TRANSIT'].includes(f.status));
                return (
                  <div className="op-row" key={op.id}>
                    <div className="op-dot" style={{ background: busy ? 'var(--amber)' : 'var(--green)' }} />
                    <span className="op-name">{op.nome}</span>
                    <span className={`op-badge${busy ? ' busy' : ''}`}>{busy ? 'EM ROTA' : 'LIVRE'}</span>
                  </div>
                );
              })}
            </div>

            <div className="panel-title">Event Stream</div>
            <div className="event-stream" ref={streamRef}>
              {events.length === 0 ? (
                <div className="empty-state">// aguardando eventos</div>
              ) : events.map(ev => (
                <div className="event-item" key={ev.event_id}>
                  <div className="event-dot" style={{ background: eventColor[ev.event_type] ?? 'var(--muted)' }} />
                  <div>
                    <div className="event-type">{ev.event_type}</div>
                    <div className="event-meta">
                      frete #{ev.payload.id} · {ev.payload.origem} → {ev.payload.destino}
                    </div>
                    <div className="event-id">
                      {new Date(ev.timestamp).toLocaleTimeString('pt-BR')} · {ev.event_id}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* TOASTS */}
      <div className="toast-area">
        {toasts.map(t => <div className="toast" key={t.id}>✓ {t.msg}</div>)}
      </div>
    </>
  );
}
