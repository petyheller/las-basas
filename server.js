const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });

const distPath = path.join(__dirname, 'client', 'dist');
app.use(express.static(distPath));
app.get('*', (req, res) => {
  const idx = path.join(distPath, 'index.html');
  res.sendFile(idx, err => {
    if (err) res.status(200).send('<h1>Las Basas - Server running OK</h1>');
  });
});

const SUITS = ['♠','♥','♦','♣'];
const RANKS = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
const RV = {'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14};

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = 0 | Math.random() * (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function mkDeck() {
  return shuffle(SUITS.flatMap(s => RANKS.map(r => ({ s, r, id: s + r + Math.random().toString(36).slice(2) }))));
}
function mkRounds(n) {
  const max = 0 | (52 / n), rs = [];
  for (let i = 1; i < max; i++) rs.push(i);
  for (let i = 0; i < n; i++) rs.push(max);
  return rs;
}
function beats(a, b, lead, trump) {
  if (!a || !b) return false;
  const at = trump && a.s === trump, bt = trump && b.s === trump;
  if (at && !bt) return true; if (!at && bt) return false;
  const al = a.s === lead, bl = b.s === lead;
  if (al && !bl) return true; if (!al && bl) return false;
  return RV[a.r] > RV[b.r];
}
function trickWin(trick, lead, trump) {
  let w = 0;
  for (let i = 1; i < trick.length; i++)
    if (beats(trick[i].c, trick[w].c, lead, trump)) w = i;
  return trick[w].p;
}
function calcScore(scoring, bid, got, trump) {
  const d = Math.abs(got - bid);
  if (d !== 0) return (!trump && bid === 0) ? -20 * d : -10 * d;
  // No-trump round: bid 0 and hit = 50pts (both systems)
  if (!trump && bid === 0) return 50;
  if (scoring === 'fer') return bid === 0 ? 5 : 10 * bid;
  return 10 + bid * bid;
}
function aiBid(hand, trump, takenSoFar, total, isLast) {
  let e = hand.reduce((s, c) => {
    if (c.r === 'A') return s + .85;
    if (c.r === 'K') return s + .55;
    if (c.r === 'Q') return s + .3;
    if (trump && c.s === trump && RV[c.r] >= 10) return s + .25;
    if (trump && c.s === trump) return s + .1;
    return s;
  }, 0);
  let b = Math.max(0, Math.min(Math.round(e), total));
  if (isLast) {
    const forbidden = total - takenSoFar;
    if (b === forbidden) b = b > 0 ? b - 1 : Math.min(b + 1, total);
    b = Math.max(0, Math.min(b, total));
  }
  return b;
}
function aiPlay(hand, trick, lead, trump, bid, won) {
  if (!hand.length) return null;
  const want = won < bid;
  const suited = lead ? hand.filter(c => c.s === lead) : [];
  const ok = suited.length ? suited : hand;
  if (!trick.length) {
    return want ? ok.reduce((h, c) => beats(c, h, c.s, trump) ? c : h)
                : ok.reduce((l, c) => beats(l, c, l.s, trump) ? c : l);
  }
  const cur = trick.reduce((b, t) => beats(t.c, b.c, lead, trump) ? t : b);
  if (want) {
    const win = ok.filter(c => beats(c, cur.c, lead, trump));
    return win.length ? win.reduce((l, c) => beats(l, c, lead, trump) ? c : l)
                     : ok.reduce((l, c) => beats(l, c, lead, trump) ? c : l);
  }
  const lose = ok.filter(c => !beats(c, cur.c, lead, trump));
  return lose.length ? lose.reduce((h, c) => beats(c, h, lead, trump) ? c : h)
                     : ok.reduce((l, c) => beats(l, c, lead, trump) ? c : l);
}
function dealRound(rs, ri, dealer, n) {
  const cpp = rs[ri], deck = mkDeck();
  const hands = Array.from({ length: n }, (_, i) => deck.slice(i * cpp, (i + 1) * cpp));
  const max = 0 | (52 / n);
  let trump = null, tCard = null;
  if (cpp < max) { tCard = deck[cpp * n]; trump = tCard.s; }
  const fb = (dealer + 1) % n;
  return { hands, trump, tCard, bids: Array(n).fill(null), bp: fb, taken: Array(n).fill(0), trick: [], lp: fb, cp: fb, lead: null, rdSc: [], trickLog: [] };
}

const rooms = new Map();
const botTimers = new Map();

function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do { code = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join(''); }
  while (rooms.has(code));
  return code;
}

function broadcastRoom(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return;
  const g = room.gameState;
  room.players.forEach((player, idx) => {
    if (!player.socketId) return;
    const socket = io.sockets.sockets.get(player.socketId);
    if (!socket) return;
    const payload = {
      phase: g ? g.phase : room.phase,
      roomCode,
      players: room.players.map(p => ({ name: p.name, isBot: p.isBot, connected: !!p.socketId })),
      scoring: room.scoring,
      maxPlayers: room.maxPlayers,
      yourIndex: idx,
      isHost: player.socketId === room.host,
      chat: room.chat || [],
    };
    if (g) {
      payload.ri = g.ri; payload.rs = g.rs; payload.sc = g.sc;
      payload.history = g.history; payload.trump = g.trump; payload.tCard = g.tCard;
      payload.bids = g.bids; payload.bp = g.bp; payload.taken = g.taken;
      payload.trick = g.trick; payload.lead = g.lead; payload.rdSc = g.rdSc; payload.trickLog = g.trickLog || []; payload.lastTrick = g.lastTrick || null;
      payload.cp = g.cp; payload.lp = g.lp; payload.dealer = g.dealer;
      payload.n = room.players.length;
      payload.myHand = g.hands[idx] || [];
      payload.handCounts = g.hands.map(h => h.length);
      payload.msg = g.msg || '';
    }
    socket.emit('game_update', payload);
  });
}

function scheduleBots(roomCode) {
  if (botTimers.has(roomCode)) { clearTimeout(botTimers.get(roomCode)); botTimers.delete(roomCode); }
  const room = rooms.get(roomCode);
  if (!room || !room.gameState) return;
  const g = room.gameState;
  if (g.phase === 'bid' && g.bp >= 0) {
    const player = room.players[g.bp];
    if (player && player.isBot) {
      const t = setTimeout(() => {
        const r = rooms.get(roomCode); if (!r || !r.gameState) return;
        const gs = r.gameState;
        const takenSoFar = (gs.bids || []).reduce((s, b) => b != null ? s + b : s, 0);
        const filled = (gs.bids || []).filter(b => b != null).length;
        const isLast = filled === r.players.length - 1;
        handleBid(roomCode, gs.bp, aiBid(gs.hands[gs.bp], gs.trump, takenSoFar, gs.rs[gs.ri], isLast));
      }, 600 + Math.random() * 400);
      botTimers.set(roomCode, t);
    }
  } else if (g.phase === 'play' && g.cp >= 0 && g.trick.length < room.players.length) {
    const player = room.players[g.cp];
    if (player && player.isBot) {
      const t = setTimeout(() => {
        const r = rooms.get(roomCode); if (!r || !r.gameState) return;
        const gs = r.gameState;
        const card = aiPlay(gs.hands[gs.cp], gs.trick, gs.lead, gs.trump, gs.bids[gs.cp], gs.taken[gs.cp]);
        if (card) handlePlay(roomCode, gs.cp, card.id);
      }, 700 + Math.random() * 500);
      botTimers.set(roomCode, t);
    }
  }
}

function handleBid(roomCode, playerIdx, bid) {
  const room = rooms.get(roomCode); if (!room || !room.gameState) return;
  const g = room.gameState;
  if (g.phase !== 'bid' || g.bp !== playerIdx) return;
  const filled = g.bids.filter(b => b != null).length;
  const isLast = filled === room.players.length - 1;
  if (isLast) {
    const takenSoFar = g.bids.reduce((s, b) => b != null ? s + b : s, 0);
    if (bid === g.rs[g.ri] - takenSoFar) return;
  }
  g.bids[playerIdx] = bid;
  if (g.bids.every(b => b != null)) { g.phase = 'play'; g.bp = -1; g.cp = g.lp; g.msg = ''; }
  else { g.bp = (playerIdx + 1) % room.players.length; }
  broadcastRoom(roomCode);
  scheduleBots(roomCode);
}

function handlePlay(roomCode, playerIdx, cardId) {
  const room = rooms.get(roomCode); if (!room || !room.gameState) return;
  const g = room.gameState;
  if (g.phase !== 'play' || g.cp !== playerIdx || g.trick.length >= room.players.length) return;
  const hand = g.hands[playerIdx];
  const card = hand.find(c => c.id === cardId); if (!card) return;
  const lead = g.trick.length === 0 ? card.s : g.lead;
  if (g.trick.length > 0 && g.lead) {
    const hasSuit = hand.some(c => c.s === g.lead);
    if (hasSuit && card.s !== g.lead) { g.msg = `Tenés ${g.lead} — debés seguir el palo`; broadcastRoom(roomCode); return; }
  }
  g.hands[playerIdx] = hand.filter(c => c.id !== cardId);
  g.trick.push({ p: playerIdx, c: card });
  g.lead = lead;
  g.cp = (playerIdx + 1) % room.players.length;
  g.msg = '';
  broadcastRoom(roomCode);
  if (g.trick.length === room.players.length) {
    setTimeout(() => resolveTrick(roomCode), 1100);
  } else {
    scheduleBots(roomCode);
  }
}

function resolveTrick(roomCode) {
  const room = rooms.get(roomCode); if (!room || !room.gameState) return;
  const g = room.gameState;
  const w = trickWin(g.trick, g.lead, g.trump);
  g.taken[w]++;
  if (!g.trickLog) g.trickLog = [];
  const completedTrick = { cards: g.trick.map(t => ({ p: t.p, c: t.c })), winner: w, lead: g.lead };
  g.trickLog.push(completedTrick);
  g.lastTrick = completedTrick;
  g.trick = []; g.lead = null;
  if (g.hands.every(h => h.length === 0)) {
    const rdSc = g.taken.map((got, i) => calcScore(room.scoring, g.bids[i], got, g.trump));
    g.rdSc = rdSc;
    g.sc = g.sc.map((s, i) => s + rdSc[i]);
    g.history.push({ ri: g.ri, cpp: g.rs[g.ri], trump: g.trump, bids: [...g.bids], taken: [...g.taken], rdSc, totals: [...g.sc] });
    g.phase = 'rend';
    g.rendReadyCount = 0;
    broadcastRoom(roomCode);
  } else {
    g.lp = w; g.cp = w;
    broadcastRoom(roomCode);
    scheduleBots(roomCode);
  }
}

function handleNextRound(roomCode) {
  const room = rooms.get(roomCode); if (!room || !room.gameState) return;
  const g = room.gameState;
  const ri = g.ri + 1;
  if (ri >= g.rs.length) { g.phase = 'gend'; broadcastRoom(roomCode); return; }
  const dealer = (g.dealer + 1) % room.players.length;
  const deal = dealRound(g.rs, ri, dealer, room.players.length);
  Object.assign(g, deal, { ri, dealer, phase: 'bid', msg: '', lastTrick: null });
  broadcastRoom(roomCode);
  scheduleBots(roomCode);
}

io.on('connection', (socket) => {

  socket.on('create_room', ({ name, maxPlayers, scoring }) => {
    const code = genCode();
    const room = {
      code, phase: 'lobby', host: socket.id,
      maxPlayers: maxPlayers || 4, scoring: scoring || 'pablo',
      gameState: null, chat: [],
      players: [{ id: socket.id, socketId: socket.id, name: name || 'Jugador 1', isBot: false }],
    };
    rooms.set(code, room);
    socket.join(code);
    socket.roomCode = code;
    broadcastRoom(code);
  });

  socket.on('join_room', ({ code, name }) => {
    const upper = code.toUpperCase();
    const room = rooms.get(upper);
    if (!room) { socket.emit('error', { message: 'Sala no encontrada. Revisá el código.' }); return; }
    if (room.phase !== 'lobby') { socket.emit('error', { message: 'La partida ya empezó.' }); return; }
    if (room.players.filter(p => !p.isBot).length >= room.maxPlayers) { socket.emit('error', { message: 'La sala está llena.' }); return; }
    room.players.push({ id: socket.id, socketId: socket.id, name: name || `Jugador ${room.players.length + 1}`, isBot: false });
    socket.join(upper); socket.roomCode = upper;
    broadcastRoom(upper);
  });

  // Reconnect to an in-progress game
  socket.on('reconnect_room', ({ code, name }) => {
    const upper = code.toUpperCase();
    const room = rooms.get(upper);
    if (!room) { socket.emit('error', { message: 'Sala no encontrada o expirada.' }); return; }
    // Find disconnected player with same name
    const player = room.players.find(p => !p.isBot && !p.socketId && p.name === name);
    if (!player) {
      // Try to find by name even if connected (tab reload)
      const existing = room.players.find(p => !p.isBot && p.name === name);
      if (existing) {
        existing.socketId = socket.id;
        socket.join(upper); socket.roomCode = upper;
        broadcastRoom(upper);
      } else {
        socket.emit('error', { message: 'No se encontró tu lugar en esta sala.' });
      }
      return;
    }
    player.socketId = socket.id;
    socket.join(upper); socket.roomCode = upper;
    broadcastRoom(upper);
    scheduleBots(upper);
  });

  socket.on('add_bot', ({ roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room || room.phase !== 'lobby' || room.host !== socket.id || room.players.length >= room.maxPlayers) return;
    const botNames = ['Bot Alfa', 'Bot Beta', 'Bot Gamma', 'Bot Delta'];
    room.players.push({ id: null, socketId: null, name: botNames[room.players.length % botNames.length], isBot: true });
    broadcastRoom(roomCode);
  });

  socket.on('remove_bot', ({ roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room || room.phase !== 'lobby' || room.host !== socket.id) return;
    for (let i = room.players.length - 1; i >= 0; i--) {
      if (room.players[i].isBot) { room.players.splice(i, 1); break; }
    }
    broadcastRoom(roomCode);
  });

  socket.on('start_game', ({ roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room || room.phase !== 'lobby' || room.host !== socket.id) return;
    if (room.players.length < 4) { socket.emit('error', { message: 'Necesitás al menos 4 jugadores.' }); return; }
    const n = room.players.length;
    const rs = mkRounds(n);
    room.gameState = { ...dealRound(rs, 0, 0, n), rs, ri: 0, dealer: 0, sc: Array(n).fill(0), history: [], phase: 'bid', msg: '' };
    room.phase = 'game';
    broadcastRoom(roomCode);
    scheduleBots(roomCode);
  });

  socket.on('place_bid', ({ roomCode, bid }) => {
    const room = rooms.get(roomCode); if (!room) return;
    const idx = room.players.findIndex(p => p.socketId === socket.id);
    if (idx >= 0) handleBid(roomCode, idx, bid);
  });

  socket.on('play_card', ({ roomCode, cardId }) => {
    const room = rooms.get(roomCode); if (!room) return;
    const idx = room.players.findIndex(p => p.socketId === socket.id);
    if (idx >= 0) handlePlay(roomCode, idx, cardId);
  });

  socket.on('next_round', ({ roomCode }) => {
    handleNextRound(roomCode);
  });

  socket.on('chat_message', ({ roomCode, text }) => {
    const room = rooms.get(roomCode); if (!room) return;
    const player = room.players.find(p => p.socketId === socket.id);
    if (!player || !text || !text.trim()) return;
    const msg = { name: player.name, text: text.trim().slice(0, 120), ts: Date.now() };
    if (!room.chat) room.chat = [];
    room.chat.push(msg);
    if (room.chat.length > 100) room.chat.shift();
    broadcastRoom(roomCode);
  });

  socket.on('disconnect', () => {
    const roomCode = socket.roomCode; if (!roomCode) return;
    const room = rooms.get(roomCode); if (!room) return;
    const player = room.players.find(p => p.socketId === socket.id);
    if (player) { player.socketId = null; }
    // Transfer host if the host disconnected
    if (room.host === socket.id) {
      const newHost = room.players.find(p => p.socketId && !p.isBot);
      if (newHost) room.host = newHost.socketId;
    }
    broadcastRoom(roomCode);
    if (room.players.every(p => !p.socketId || p.isBot)) {
      if (botTimers.has(roomCode)) clearTimeout(botTimers.get(roomCode));
      // Give 10 minutes for reconnection before cleaning up
      setTimeout(() => {
        const r = rooms.get(roomCode);
        if (r && r.players.every(p => !p.socketId || p.isBot)) {
          botTimers.delete(roomCode);
          rooms.delete(roomCode);
        }
      }, 10 * 60 * 1000);
    }
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, '0.0.0.0', () => console.log(`🂡 Las Basas server running on port ${PORT}`));
