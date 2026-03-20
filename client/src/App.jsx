import { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';

const isRed = s => s === '♥' || s === '♦';
const RV = {'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14};
const sortH = h => {
  const so = {'♠':0,'♥':1,'♦':2,'♣':3};
  return [...h].sort((a, b) => so[a.s] - so[b.s] || RV[b.r] - RV[a.r]);
};

function CardFace({ c, sel, ok, onClick, small, tiny }) {
  const r = isRed(c.s);
  const W = tiny ? 22 : small ? 34 : 58;
  const H = tiny ? 32 : small ? 50 : 82;
  return (
    <div onClick={onClick} style={{
      width: W, height: H, background: '#fff',
      border: `${tiny ? 1 : 2}px solid ${sel ? '#f59e0b' : '#d1d5db'}`, borderRadius: tiny ? 3 : 6,
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      padding: tiny ? '1px 2px' : '2px 4px', cursor: ok || sel ? 'pointer' : 'default',
      boxShadow: sel ? '0 0 0 3px #fbbf24, 0 4px 8px rgba(0,0,0,.3)' : '0 2px 4px rgba(0,0,0,.25)',
      transform: sel ? 'translateY(-14px)' : ok ? 'translateY(-4px)' : 'none',
      transition: 'all .12s', color: r ? '#dc2626' : '#111827',
      fontSize: tiny ? 8 : small ? 9 : 11, userSelect: 'none',
      opacity: !ok && !sel ? .6 : 1, flexShrink: 0,
    }}>
      <div><b style={{ display: 'block', lineHeight: 1.1 }}>{c.r}</b><span>{c.s}</span></div>
      {!tiny && <div style={{ textAlign: 'right' }}><span>{c.s}</span><b style={{ display: 'block', lineHeight: 1.1 }}>{c.r}</b></div>}
    </div>
  );
}
function CardBack({ small }) {
  return (
    <div style={{
      width: small ? 26 : 42, height: small ? 38 : 58,
      background: 'linear-gradient(135deg,#1e40af,#3b82f6)',
      border: '2px solid #93c5fd', borderRadius: 5, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'rgba(255,255,255,.12)', fontSize: small ? 9 : 12,
    }}>◆</div>
  );
}

function Scoreboard({ history, players, sc, scoring, onClose }) {
  const tdS = { padding: '5px 9px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,.07)', fontSize: 12 };
  const thS = { padding: '6px 9px', textAlign: 'center', fontSize: 11, color: '#86efac', fontWeight: 'normal', borderBottom: '1px solid rgba(255,255,255,.18)', position: 'sticky', top: 0, background: '#0f3d22' };
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.88)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 50, overflowY: 'auto', padding: '14px 8px' }}>
      <div style={{ background: '#14532d', border: '2px solid #4ade80', borderRadius: 14, width: '100%', maxWidth: 860 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 18px 10px', borderBottom: '1px solid rgba(255,255,255,.12)' }}>
          <div>
            <span style={{ fontSize: 17, fontWeight: 500 }}>📋 Pizarra</span>
            <span style={{ marginLeft: 10, fontSize: 11, background: scoring === 'fer' ? 'rgba(251,191,36,.2)' : 'rgba(74,222,128,.15)', border: `1px solid ${scoring === 'fer' ? '#fbbf24' : '#4ade80'}`, borderRadius: 20, padding: '2px 10px', color: scoring === 'fer' ? '#fbbf24' : '#4ade80' }}>
              {scoring === 'fer' ? 'A lo Fer' : 'A lo Pablo'}
            </span>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,.3)', color: '#fff', borderRadius: 6, padding: '4px 14px', cursor: 'pointer', fontSize: 13 }}>✕</button>
        </div>
        {history.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'rgba(255,255,255,.4)', fontSize: 13 }}>Todavía no se completó ninguna ronda.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
              <thead>
                <tr>
                  <th style={{ ...thS, textAlign: 'left', paddingLeft: 14 }}>Ronda</th>
                  <th style={thS}>Ctas</th>
                  <th style={thS}>Triunfo</th>
                  {players.map((p, i) => <th key={i} colSpan={3} style={{ ...thS, borderLeft: '1px solid rgba(255,255,255,.15)', color: i === 0 ? '#fbbf24' : '#86efac' }}>{p.name}</th>)}
                </tr>
                <tr style={{ background: 'rgba(0,0,0,.25)' }}>
                  <th style={thS} /><th style={thS} /><th style={thS} />
                  {players.map((_, i) => ['Ap', 'Bz', 'Pts'].map(l => <th key={i+l} style={{ ...thS, fontSize: 10, borderLeft: l === 'Ap' ? '1px solid rgba(255,255,255,.1)' : undefined }}>{l}</th>))}
                </tr>
              </thead>
              <tbody>
                {history.map((h, idx) => (
                  <tr key={idx} style={{ background: idx % 2 === 0 ? 'rgba(255,255,255,.04)' : 'transparent' }}>
                    <td style={{ ...tdS, textAlign: 'left', paddingLeft: 14, color: '#a3e4b8', fontWeight: 'bold' }}>{h.ri + 1}</td>
                    <td style={tdS}>{h.cpp}</td>
                    <td style={{ ...tdS, fontSize: 14, color: h.trump ? isRed(h.trump) ? '#f87171' : '#e2e8f0' : 'rgba(255,255,255,.3)' }}>{h.trump || '—'}</td>
                    {players.map((_, i) => [
                      <td key={i+'a'} style={{ ...tdS, borderLeft: '1px solid rgba(255,255,255,.07)' }}>{h.bids[i]}</td>,
                      <td key={i+'b'} style={tdS}>{h.taken[i]}</td>,
                      <td key={i+'p'} style={{ ...tdS, fontWeight: 'bold', color: h.bids[i] === h.taken[i] ? '#4ade80' : '#f87171' }}>{h.rdSc[i] >= 0 ? '+' : ''}{h.rdSc[i]}</td>,
                    ])}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: 'rgba(0,0,0,.35)', borderTop: '2px solid rgba(255,255,255,.25)' }}>
                  <td colSpan={3} style={{ ...tdS, textAlign: 'left', paddingLeft: 14, color: '#86efac', fontWeight: 'bold' }}>Total</td>
                  {players.map((_, i) => [
                    <td key={i+'a'} style={{ ...tdS, borderLeft: '1px solid rgba(255,255,255,.07)' }} />,
                    <td key={i+'b'} style={tdS} />,
                    <td key={i+'t'} style={{ ...tdS, fontWeight: 'bold', fontSize: 16, color: i === 0 ? '#fbbf24' : '#fff' }}>{sc[i]}</td>,
                  ])}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function TrickLog({ trickLog, players, onClose }) {
  const [page, setPage] = useState(trickLog.length - 1);
  const trick = trickLog[page];
  if (!trick) return null;
  const winner = players[trick.winner] || {};
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 16 }}>
      <div style={{ background: '#166534', border: '2px solid #4ade80', borderRadius: 14, width: '100%', maxWidth: 480, padding: '20px 18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <span style={{ fontSize: 16, fontWeight: 500 }}>🃏 Historial de bazas</span>
          <button onClick={onClose} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,.3)', color: '#fff', borderRadius: 6, padding: '3px 12px', cursor: 'pointer', fontSize: 13 }}>✕</button>
        </div>

        {/* Pagination */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, justifyContent: 'center' }}>
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
            style={{ background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.2)', color: '#fff', borderRadius: 6, padding: '4px 12px', cursor: page === 0 ? 'not-allowed' : 'pointer', opacity: page === 0 ? .4 : 1 }}>←</button>
          <span style={{ color: '#86efac', fontSize: 13 }}>Baza {page + 1} de {trickLog.length}</span>
          <button onClick={() => setPage(p => Math.min(trickLog.length - 1, p + 1))} disabled={page === trickLog.length - 1}
            style={{ background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.2)', color: '#fff', borderRadius: 6, padding: '4px 12px', cursor: page === trickLog.length - 1 ? 'not-allowed' : 'pointer', opacity: page === trickLog.length - 1 ? .4 : 1 }}>→</button>
        </div>

        {/* Cards played */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {trick.cards.map(({ p, c }) => {
            const isWinner = p === trick.winner;
            return (
              <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 12, background: isWinner ? 'rgba(74,222,128,.15)' : 'rgba(255,255,255,.04)', border: `1px solid ${isWinner ? 'rgba(74,222,128,.5)' : 'rgba(255,255,255,.1)'}`, borderRadius: 10, padding: '8px 14px' }}>
                <CardFace c={c} ok={false} small />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: isWinner ? 'bold' : 'normal', color: isWinner ? '#4ade80' : '#e2e8f0' }}>
                    {(players[p] || {}).name}
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)' }}>
                    {c.r}{c.s}
                    {p === trick.cards[0]?.p && <span style={{ marginLeft: 6, color: '#86efac' }}>abre</span>}
                  </div>
                </div>
                {isWinner && <span style={{ fontSize: 18 }}>🏆</span>}
              </div>
            );
          })}
        </div>

        <div style={{ textAlign: 'center', color: '#fbbf24', fontSize: 13 }}>
          Se llevó la baza: <b>{winner.name}</b>
        </div>
      </div>
    </div>
  );
}

function Chat({ messages, onSend, playerName }) {
  const [text, setText] = useState('');
  const bottomRef = useRef(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  const send = () => { if (!text.trim()) return; onSend(text.trim()); setText(''); };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 5, minHeight: 200 }}>
        {messages.length === 0 && <div style={{ color: 'rgba(255,255,255,.3)', fontSize: 12, textAlign: 'center', marginTop: 16 }}>Sin mensajes aún</div>}
        {messages.map((m, i) => (
          <div key={i} style={{ fontSize: 12, lineHeight: 1.4 }}>
            <span style={{ color: m.name === playerName ? '#fbbf24' : '#86efac', fontWeight: 'bold' }}>{m.name}: </span>
            <span style={{ color: '#e2e8f0' }}>{m.text}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div style={{ display: 'flex', gap: 6, padding: '6px 8px', borderTop: '1px solid rgba(255,255,255,.1)' }}>
        <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Mensaje..." maxLength={120}
          style={{ flex: 1, background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.2)', borderRadius: 6, padding: '6px 10px', color: '#fff', fontSize: 12, outline: 'none' }} />
        <button onClick={send} style={{ background: '#16a34a', border: 'none', borderRadius: 6, padding: '6px 12px', color: '#fff', cursor: 'pointer', fontSize: 12 }}>↑</button>
      </div>
    </div>
  );
}

export default function App() {
  const socketRef = useRef(null);
  const reconnectRef = useRef(null); // { code, name } if we need to reconnect
  const [screen, setScreen] = useState('home');
  const [name, setName] = useState(() => localStorage.getItem('basas_name') || '');
  const [joinCode, setJoinCode] = useState('');
  const [setupN, setSetupN] = useState(4);
  const [setupScoring, setSetupScoring] = useState('pablo');
  const [g, setG] = useState(null);
  const [sel, setSel] = useState(null);
  const [showBoard, setShowBoard] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showTrickLog, setShowTrickLog] = useState(false);
  const [error, setError] = useState('');
  const [unread, setUnread] = useState(0);
  const prevChatLen = useRef(0);
  const showChatRef = useRef(false);
  showChatRef.current = showChat;

  useEffect(() => {
    // Check for saved session on load
    const savedCode = localStorage.getItem('basas_room');
    const savedName = localStorage.getItem('basas_name');
    if (savedCode && savedName) {
      reconnectRef.current = { code: savedCode, name: savedName };
      setScreen('reconnecting');
    }

    const socket = io({ reconnectionAttempts: 15, reconnectionDelay: 1500 });
    socketRef.current = socket;

    socket.on('connect', () => {
      // Use ref so we always have fresh value, not stale closure
      if (reconnectRef.current) {
        socket.emit('reconnect_room', reconnectRef.current);
      }
    });

    socket.on('game_update', (data) => {
      setG(data);
      setError('');
      reconnectRef.current = null; // reconnect succeeded

      const chatLen = (data.chat || []).length;
      if (chatLen > prevChatLen.current && !showChatRef.current) {
        setUnread(u => u + (chatLen - prevChatLen.current));
      }
      prevChatLen.current = chatLen;

      if (data.phase === 'lobby') setScreen('lobby');
      else if (['bid', 'play', 'rend', 'gend'].includes(data.phase)) setScreen('game');
    });

    socket.on('error', ({ message }) => {
      setError(message);
      // If reconnect failed, clear saved session and go home
      if (reconnectRef.current) {
        reconnectRef.current = null;
        localStorage.removeItem('basas_room');
        setScreen('home');
      }
    });

    return () => socket.disconnect();
  }, []);

  const emit = (ev, data) => socketRef.current?.emit(ev, data);
  const saveName = n => { setName(n); localStorage.setItem('basas_name', n); };

  const createRoom = () => {
    if (!name.trim()) { setError('Ingresá tu nombre'); return; }
    saveName(name.trim());
    emit('create_room', { name: name.trim(), maxPlayers: setupN, scoring: setupScoring });
  };
  const joinRoom = () => {
    if (!name.trim()) { setError('Ingresá tu nombre'); return; }
    if (!joinCode.trim()) { setError('Ingresá el código de sala'); return; }
    saveName(name.trim());
    emit('join_room', { code: joinCode.trim().toUpperCase(), name: name.trim() });
  };

  useEffect(() => {
    if (g?.roomCode) localStorage.setItem('basas_room', g.roomCode);
  }, [g?.roomCode]);

  const humanBid = bid => {
    if (!g || g.bp !== g.yourIndex) return;
    const filled = (g.bids || []).filter(b => b != null).length;
    const isLast = filled === (g.n || 0) - 1;
    if (isLast) {
      const taken = (g.bids || []).reduce((s, b) => b != null ? s + b : s, 0);
      if (bid === (g.rs?.[g.ri] || 0) - taken) { setError(`⚠️ No podés apostar ${bid} — el total no puede cerrar la ronda`); return; }
    }
    setError('');
    emit('place_bid', { roomCode: g.roomCode, bid });
  };

  const humanPlay = card => {
    if (!g || g.cp !== g.yourIndex || (g.trick || []).length >= g.n) return;
    if (card !== sel) { setSel(card); return; }
    setSel(null);
    emit('play_card', { roomCode: g.roomCode, cardId: card.id });
  };

  const getOk = () => {
    if (!g || g.cp !== g.yourIndex || g.phase !== 'play' || (g.trick || []).length >= g.n) return new Set();
    const h = g.myHand || [];
    if (!g.lead || (g.trick || []).length === 0) return new Set(h);
    const hasSuit = h.some(c => c.s === g.lead);
    return new Set(hasSuit ? h.filter(c => c.s === g.lead) : h);
  };

  const openChat = () => { setShowChat(true); setUnread(0); };

  // ── Styles ──
  const gs = { background: '#14532d', minHeight: '100vh', padding: '10px 8px', fontFamily: 'system-ui,sans-serif', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 };
  const cardBox = { background: 'rgba(0,0,0,.2)', borderRadius: 12, padding: '18px 20px', marginBottom: 16, width: '100%', maxWidth: 480 };
  const inputSt = { width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,.25)', background: 'rgba(255,255,255,.08)', color: '#fff', fontSize: 15, outline: 'none' };
  const btnP = { background: '#16a34a', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 28px', fontSize: 15, fontWeight: 'bold', cursor: 'pointer' };
  const btnS = { background: 'rgba(255,255,255,.1)', color: '#fff', border: '1px solid rgba(255,255,255,.25)', borderRadius: 10, padding: '12px 24px', fontSize: 14, cursor: 'pointer' };
  const optBtn = (active, onClick, children) => (
    <button onClick={onClick} style={{ padding: '11px 18px', borderRadius: 10, border: `2px solid ${active ? '#4ade80' : 'rgba(255,255,255,.2)'}`, background: active ? 'rgba(22,163,74,.4)' : 'rgba(255,255,255,.05)', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: active ? 'bold' : 'normal' }}>
      {children}
    </button>
  );

  if (screen === 'reconnecting') return (
    <div style={{ ...gs, justifyContent: 'center', textAlign: 'center' }}>
      <div style={{ fontSize: 44 }}>🂡</div>
      <p style={{ color: '#86efac', fontSize: 15, marginBottom: 8 }}>Reconectando a la partida...</p>
      <p style={{ color: 'rgba(255,255,255,.4)', fontSize: 12, marginBottom: 20 }}>Sala: {localStorage.getItem('basas_room')}</p>
      <button onClick={() => { reconnectRef.current = null; localStorage.removeItem('basas_room'); setScreen('home'); }} style={{ ...btnS, fontSize: 13 }}>Cancelar y volver al inicio</button>
    </div>
  );

  if (screen === 'home') return (
    <div style={{ ...gs, justifyContent: 'center', textAlign: 'center' }}>
      <div style={{ fontSize: 52, lineHeight: 1 }}>🂡</div>
      <h1 style={{ fontSize: 34, margin: '8px 0 4px', fontWeight: 500 }}>Las Basas</h1>
      <p style={{ color: '#86efac', marginBottom: 28, fontSize: 14 }}>Jugá online con amigos o contra bots</p>
      <div style={cardBox}>
        <div style={{ color: '#86efac', fontSize: 13, marginBottom: 8, textAlign: 'left' }}>Tu nombre</div>
        <input style={inputSt} placeholder="Ej: Pablo" value={name} onChange={e => saveName(e.target.value)} onKeyDown={e => e.key === 'Enter' && name.trim() && setScreen('create')} />
      </div>
      {error && <div style={{ color: '#f87171', fontSize: 13, marginBottom: 8 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button onClick={() => { if (!name.trim()) { setError('Ingresá tu nombre'); return; } setError(''); setScreen('create'); }} style={btnP}>Crear sala</button>
        <button onClick={() => { if (!name.trim()) { setError('Ingresá tu nombre'); return; } setError(''); setScreen('join'); }} style={btnS}>Unirse a sala</button>
      </div>
    </div>
  );

  if (screen === 'create') return (
    <div style={{ ...gs, justifyContent: 'center', textAlign: 'center' }}>
      <h2 style={{ fontSize: 24, fontWeight: 500, marginBottom: 20 }}>Crear sala</h2>
      <div style={cardBox}>
        <div style={{ color: '#86efac', fontSize: 13, marginBottom: 8, textAlign: 'left' }}>Jugadores</div>
        <div style={{ display: 'flex', gap: 10 }}>{[4, 5].map(n => optBtn(setupN === n, () => setSetupN(n), `${n} jugadores`))}</div>
      </div>
      <div style={cardBox}>
        <div style={{ color: '#86efac', fontSize: 13, marginBottom: 8, textAlign: 'left' }}>Sistema de puntos</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {optBtn(setupScoring === 'pablo', () => setSetupScoring('pablo'), <span>A lo Pablo<br /><span style={{ fontSize: 11, fontWeight: 'normal', color: '#86efac' }}>Acertar: 10+ap²</span></span>)}
          {optBtn(setupScoring === 'fer', () => setSetupScoring('fer'), <span>A lo Fer<br /><span style={{ fontSize: 11, fontWeight: 'normal', color: '#86efac' }}>Acertar: 10×ap (0→5)</span></span>)}
        </div>
      </div>
      {error && <div style={{ color: '#f87171', fontSize: 13, marginBottom: 8 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 12 }}>
        <button onClick={() => setScreen('home')} style={btnS}>← Volver</button>
        <button onClick={createRoom} style={btnP}>Crear sala</button>
      </div>
    </div>
  );

  if (screen === 'join') return (
    <div style={{ ...gs, justifyContent: 'center', textAlign: 'center' }}>
      <h2 style={{ fontSize: 24, fontWeight: 500, marginBottom: 20 }}>Unirse a sala</h2>
      <div style={cardBox}>
        <div style={{ color: '#86efac', fontSize: 13, marginBottom: 8, textAlign: 'left' }}>Código de sala</div>
        <input style={{ ...inputSt, textTransform: 'uppercase', letterSpacing: 6, fontSize: 22, textAlign: 'center' }}
          placeholder="XXXX" maxLength={4} value={joinCode}
          onChange={e => setJoinCode(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === 'Enter' && joinRoom()} />
      </div>
      {error && <div style={{ color: '#f87171', fontSize: 13, marginBottom: 8 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 12 }}>
        <button onClick={() => setScreen('home')} style={btnS}>← Volver</button>
        <button onClick={joinRoom} style={btnP}>Unirse</button>
      </div>
    </div>
  );

  if (screen === 'lobby' && g) return (
    <div style={{ ...gs, justifyContent: 'center', textAlign: 'center' }}>
      <div style={{ fontSize: 44, lineHeight: 1 }}>🂡</div>
      <h2 style={{ fontSize: 24, fontWeight: 500, marginBottom: 4 }}>Sala de espera</h2>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
        <span style={{ color: '#86efac', fontSize: 14 }}>Código:</span>
        <span style={{ background: 'rgba(0,0,0,.3)', border: '2px solid #4ade80', borderRadius: 8, padding: '6px 18px', fontSize: 26, fontWeight: 'bold', letterSpacing: 6 }}>{g.roomCode}</span>
        <button onClick={() => navigator.clipboard?.writeText(g.roomCode)} style={{ ...btnS, padding: '6px 12px', fontSize: 12 }}>Copiar</button>
      </div>
      <div style={{ ...cardBox, textAlign: 'left' }}>
        <div style={{ color: '#86efac', fontSize: 13, marginBottom: 10 }}>Jugadores ({(g.players || []).length}/{g.maxPlayers})</div>
        {(g.players || []).map((p, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.connected || p.isBot ? '#4ade80' : '#6b7280' }} />
            <span style={{ flex: 1 }}>{p.name}</span>
            {p.isBot && <span style={{ fontSize: 11, background: 'rgba(251,191,36,.2)', border: '1px solid #fbbf24', borderRadius: 20, padding: '2px 8px', color: '#fbbf24' }}>Bot</span>}
            {i === 0 && !p.isBot && <span style={{ fontSize: 11, color: '#86efac' }}>Host</span>}
          </div>
        ))}
      </div>
      {error && <div style={{ color: '#f87171', fontSize: 13, marginBottom: 8 }}>{error}</div>}
      {g.isHost && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginTop: 8 }}>
          {(g.players || []).length < g.maxPlayers && <button onClick={() => emit('add_bot', { roomCode: g.roomCode })} style={btnS}>+ Bot</button>}
          {(g.players || []).some(p => p.isBot) && <button onClick={() => emit('remove_bot', { roomCode: g.roomCode })} style={{ ...btnS, color: '#f87171', borderColor: '#f87171' }}>− Bot</button>}
          <button onClick={() => emit('start_game', { roomCode: g.roomCode })} style={{ ...btnP, opacity: (g.players || []).length < 4 ? .5 : 1 }} disabled={(g.players || []).length < 4}>
            {(g.players || []).length < 4 ? `Faltan ${4 - (g.players || []).length}` : '¡Arrancar!'}
          </button>
        </div>
      )}
      {!g.isHost && <p style={{ color: 'rgba(255,255,255,.5)', fontSize: 13, marginTop: 8 }}>Esperando que el host arranque...</p>}
    </div>
  );

  if (screen === 'game' && g) {
    const ok = getOk();
    const cpp = g.rs?.[g.ri] || 0;
    const hand = sortH(g.myHand || []);
    const players = g.players || [];
    const myName = players[g.yourIndex]?.name || '';
    const chatMsgs = g.chat || [];
    const trickLog = g.trickLog || [];

    return (
      <div style={{ ...gs, position: 'relative' }}>
        {/* Top bar */}
        <div style={{ width: '100%', maxWidth: 860, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <b style={{ fontSize: 17 }}>🂡 Las Basas</b>
            <span style={{ fontSize: 11, background: g.scoring === 'fer' ? 'rgba(251,191,36,.2)' : 'rgba(74,222,128,.15)', border: `1px solid ${g.scoring === 'fer' ? '#fbbf24' : '#4ade80'}`, borderRadius: 20, padding: '2px 8px', color: g.scoring === 'fer' ? '#fbbf24' : '#4ade80' }}>
              {g.scoring === 'fer' ? 'A lo Fer' : 'A lo Pablo'}
            </span>
            <span style={{ color: '#86efac', fontSize: 12 }}>Ronda {(g.ri || 0) + 1}/{g.rs?.length || 0} — {cpp} carta{cpp !== 1 ? 's' : ''}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {g.tCard
              ? <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ fontSize: 11, color: '#86efac' }}>Triunfo:</span>
                  <CardFace c={g.tCard} small ok={false} />
                  <span style={{ fontSize: 18, color: isRed(g.trump) ? '#f87171' : '#e2e8f0' }}>{g.trump}</span>
                </div>
              : <span style={{ color: '#fbbf24', fontWeight: 'bold', fontSize: 12 }}>Sin triunfo</span>
            }
            <button onClick={() => setShowBoard(true)} style={{ background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.25)', color: '#fff', borderRadius: 8, padding: '5px 11px', cursor: 'pointer', fontSize: 12 }}>📋</button>
            <button onClick={openChat} style={{ position: 'relative', background: 'rgba(255,255,255,.1)', border: `1px solid ${unread > 0 ? '#fbbf24' : 'rgba(255,255,255,.25)'}`, color: unread > 0 ? '#fbbf24' : '#fff', borderRadius: 8, padding: '5px 11px', cursor: 'pointer', fontSize: 12 }}>
              💬{unread > 0 && <span style={{ marginLeft: 4, background: '#f59e0b', color: '#000', borderRadius: 10, padding: '0 5px', fontSize: 10, fontWeight: 'bold' }}>{unread}</span>}
            </button>
          </div>
        </div>

        {/* Main layout */}
        <div style={{ width: '100%', maxWidth: 860, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>

            {/* Score bar */}
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {players.map((p, i) => (
                <div key={i} style={{ flex: 1, minWidth: 75, textAlign: 'center', background: i === g.yourIndex ? 'rgba(22,163,74,.35)' : 'rgba(255,255,255,.06)', border: `1px solid ${i === g.yourIndex ? '#4ade80' : '#2d3748'}`, borderRadius: 8, padding: '5px 5px' }}>
                  <div style={{ fontSize: 10, color: p.isBot ? '#fbbf24' : '#86efac', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}{!p.connected && !p.isBot ? ' ✗' : ''}</div>
                  <div style={{ fontSize: 18, fontWeight: 'bold', lineHeight: 1.2 }}>{(g.sc || [])[i] || 0}</div>
                  {(g.bids || [])[i] != null && <div style={{ fontSize: 10, color: '#fbbf24' }}>Ap:{g.bids[i]} Bz:{(g.taken || [])[i] || 0}</div>}
                </div>
              ))}
            </div>

            {/* Other players */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
              {players.map((p, i) => {
                if (i === g.yourIndex) return null;
                const hl = (g.handCounts || [])[i] || 0;
                const active = (g.phase === 'play' && g.cp === i) || (g.phase === 'bid' && g.bp === i);
                return (
                  <div key={i} style={{ textAlign: 'center', opacity: active ? 1 : .6 }}>
                    <div style={{ fontSize: 10, color: active ? '#fbbf24' : '#86efac', marginBottom: 3, fontWeight: active ? 'bold' : 'normal' }}>
                      {p.name}{g.phase === 'bid' && g.bp === i ? ' ✏️' : g.phase === 'play' && g.cp === i ? ' 🎯' : ''}
                    </div>
                    <div style={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap', maxWidth: 160 }}>
                      {Array.from({ length: Math.min(hl, 10) }, (_, j) => <CardBack key={j} small />)}
                      {hl > 10 && <span style={{ alignSelf: 'center', fontSize: 10 }}>+{hl - 10}</span>}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Table */}
            <div style={{ background: 'rgba(0,0,0,.2)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 14, padding: 14, minHeight: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, flexWrap: 'wrap' }}>
              {(g.trick || []).length === 0
                ? <span style={{ color: 'rgba(255,255,255,.25)', fontSize: 13 }}>{g.phase === 'play' ? g.cp === g.yourIndex ? 'Tu turno — elegí una carta' : 'Esperando...' : 'Mesa vacía'}</span>
                : (g.trick || []).map(({ p, c }) => (
                    <div key={p} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 9, color: '#86efac', marginBottom: 3 }}>{(players[p] || {}).name}</div>
                      <CardFace c={c} ok={false} />
                    </div>
                  ))
              }
            </div>

            <div style={{ color: '#fbbf24', fontSize: 12, textAlign: 'center', minHeight: 16 }}>{g.msg || error || ''}</div>

            {/* Bid */}
            {g.phase === 'bid' && g.bp === g.yourIndex && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: '#86efac', fontSize: 13, marginBottom: 6 }}>¿Cuántas bazas vas a ganar?</div>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'center' }}>
                  {Array.from({ length: cpp + 1 }, (_, bid) => {
                    const filled = (g.bids || []).filter(b => b != null).length;
                    const isLast = filled === g.n - 1;
                    const taken = (g.bids || []).reduce((s, b) => b != null ? s + b : s, 0);
                    const banned = isLast && bid === cpp - taken;
                    return <button key={bid} onClick={() => humanBid(bid)} disabled={banned} style={{ width: 44, height: 44, borderRadius: 8, border: 'none', background: banned ? '#374151' : '#16a34a', color: banned ? '#4b5563' : '#fff', fontSize: 17, fontWeight: 'bold', cursor: banned ? 'not-allowed' : 'pointer' }}>{bid}</button>;
                  })}
                </div>
                {(g.bids || []).filter(b => b != null).length === g.n - 1 && <div style={{ fontSize: 10, color: 'rgba(255,255,255,.4)', marginTop: 5 }}>Sos el último en apostar</div>}
              </div>
            )}
            {g.phase === 'bid' && g.bp !== g.yourIndex && g.bp >= 0 && (
              <div style={{ color: '#86efac', fontSize: 12, textAlign: 'center' }}>{(players[g.bp] || {}).name} está apostando...</div>
            )}

            {/* Hand */}
            {g.phase !== 'rend' && g.phase !== 'gend' && (
              <div>
                <div style={{ fontSize: 11, color: '#86efac', textAlign: 'center', marginBottom: 5 }}>
                  Tu mano ({hand.length})
                  {(g.bids || [])[g.yourIndex] != null && ` — Apostaste ${g.bids[g.yourIndex]} — Ganaste ${(g.taken || [])[g.yourIndex] || 0}`}
                  {g.phase === 'play' && g.cp === g.yourIndex && ' — ¡Tu turno!'}
                  {sel && g.cp === g.yourIndex && ' — Clic de nuevo para confirmar'}
                </div>
                <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', justifyContent: 'center' }}>
                  {hand.map((c, i) => <CardFace key={c.id || i} c={c} sel={sel === c} ok={ok.has(c)} onClick={() => humanPlay(c)} />)}
                </div>
              </div>
            )}
          </div>

          {/* Chat sidebar */}
          {showChat && (
            <div style={{ width: 220, minHeight: 400, background: 'rgba(0,0,0,.25)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 12, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,.1)' }}>
                <span style={{ fontSize: 13, fontWeight: 500 }}>💬 Chat</span>
                <button onClick={() => setShowChat(false)} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,.5)', cursor: 'pointer', fontSize: 14 }}>✕</button>
              </div>
              <div style={{ flex: 1 }}>
                <Chat messages={chatMsgs} onSend={text => emit('chat_message', { roomCode: g.roomCode, text })} playerName={myName} />
              </div>
            </div>
          )}
        </div>

        {/* Round end modal */}
        {g.phase === 'rend' && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, overflowY: 'auto', padding: 16 }}>
            <div style={{ background: '#166534', border: '2px solid #4ade80', borderRadius: 16, padding: '24px 20px', minWidth: 320, textAlign: 'center', maxWidth: 460, width: '100%' }}>
              <div style={{ fontSize: 13, color: '#86efac', marginBottom: 4 }}>Ronda {(g.ri || 0) + 1} terminada</div>
              <h3 style={{ margin: '0 0 16px', fontSize: 22, fontWeight: 600 }}>Resultados</h3>

              {/* Per-player results */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                {players.map((p, i) => {
                  const hit = (g.bids || [])[i] === (g.taken || [])[i];
                  const pts = (g.rdSc || [])[i] || 0;
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, background: i === g.yourIndex ? 'rgba(255,255,255,.1)' : 'rgba(255,255,255,.04)', border: `1px solid ${hit ? 'rgba(74,222,128,.4)' : 'rgba(248,113,113,.25)'}`, borderRadius: 10, padding: '9px 14px' }}>
                      <div style={{ fontSize: 18 }}>{hit ? '✅' : '❌'}</div>
                      <div style={{ flex: 1, textAlign: 'left' }}>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{p.name}</div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,.45)' }}>Apostó {(g.bids || [])[i]} — Hizo {(g.taken || [])[i]}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 20, fontWeight: 'bold', color: pts >= 0 ? '#4ade80' : '#f87171' }}>{pts >= 0 ? '+' : ''}{pts}</div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,.45)' }}>Total: {(g.sc || [])[i] || 0}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                <button onClick={() => setShowBoard(true)} style={{ background: 'rgba(255,255,255,.1)', color: '#fff', border: '1px solid rgba(255,255,255,.25)', borderRadius: 8, padding: '9px 14px', fontSize: 13, cursor: 'pointer' }}>📋 Pizarra</button>
                {trickLog.length > 0 && (
                  <button onClick={() => setShowTrickLog(true)} style={{ background: 'rgba(255,255,255,.1)', color: '#fff', border: '1px solid rgba(255,255,255,.25)', borderRadius: 8, padding: '9px 14px', fontSize: 13, cursor: 'pointer' }}>🃏 Ver bazas</button>
                )}
                {g.isHost
                  ? <button onClick={() => emit('next_round', { roomCode: g.roomCode })} style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 14, cursor: 'pointer', fontWeight: 'bold' }}>
                      {(g.ri || 0) + 1 >= (g.rs?.length || 1) - 1 ? 'Resultado final →' : 'Siguiente ronda →'}
                    </button>
                  : <span style={{ color: 'rgba(255,255,255,.5)', fontSize: 13, alignSelf: 'center' }}>Esperando al host...</span>
                }
              </div>
            </div>
          </div>
        )}

        {/* Game end modal */}
        {g.phase === 'gend' && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
            <div style={{ background: '#166534', border: '2px solid #fbbf24', borderRadius: 14, padding: 28, minWidth: 300, textAlign: 'center', maxWidth: 380, width: '100%' }}>
              <div style={{ fontSize: 44, lineHeight: 1 }}>🏆</div>
              <h2 style={{ margin: '8px 0', fontSize: 24, fontWeight: 500 }}>¡Fin del juego!</h2>
              {(() => {
                const mx = Math.max(...(g.sc || [0]));
                const wi = (g.sc || []).findIndex(s => s === mx);
                return <p style={{ color: '#fbbf24', fontSize: 16, margin: '0 0 14px' }}>{wi === g.yourIndex ? '¡Ganaste!' : `Ganó ${(players[wi] || {}).name}`} con {mx} puntos</p>;
              })()}
              <table style={{ margin: '0 auto 16px', borderCollapse: 'collapse', width: '100%', fontSize: 14 }}>
                <tbody>
                  {[...(g.sc || []).map((s, i) => ({ i, s }))].sort((a, b) => b.s - a.s).map(({ i, s }, pos) => (
                    <tr key={i} style={{ background: i === g.yourIndex ? 'rgba(255,255,255,.1)' : undefined }}>
                      <td style={{ padding: '5px 12px', textAlign: 'left', color: pos === 0 ? '#fbbf24' : 'inherit' }}>{pos === 0 ? '🥇 ' : pos === 1 ? '🥈 ' : pos === 2 ? '🥉 ' : ''}{(players[i] || {}).name}</td>
                      <td style={{ padding: '5px 12px', fontWeight: 'bold', fontSize: 20, color: pos === 0 ? '#fbbf24' : 'inherit' }}>{s}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                <button onClick={() => setShowBoard(true)} style={{ background: 'rgba(255,255,255,.12)', color: '#fff', border: '1px solid rgba(255,255,255,.3)', borderRadius: 8, padding: '10px 16px', fontSize: 13, cursor: 'pointer' }}>📋 Pizarra</button>
                <button onClick={() => { localStorage.removeItem('basas_room'); window.location.reload(); }} style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 18px', fontSize: 13, cursor: 'pointer', fontWeight: 'bold' }}>Nueva partida</button>
              </div>
            </div>
          </div>
        )}

        {showBoard && <Scoreboard history={g.history || []} players={players} sc={g.sc || []} scoring={g.scoring} onClose={() => setShowBoard(false)} />}
        {showTrickLog && trickLog.length > 0 && <TrickLog trickLog={trickLog} players={players} onClose={() => setShowTrickLog(false)} />}
      </div>
    );
  }

  return <div style={{ ...gs, justifyContent: 'center' }}><div style={{ color: '#86efac' }}>Conectando...</div></div>;
}
