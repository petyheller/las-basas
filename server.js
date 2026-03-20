const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });

app.use(express.static(path.join(__dirname, 'client/dist')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'client/dist/index.html')));

// ─── Game Logic ───────────────────────────────────────────────────────────────
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
  const max = 0 | (52 / n);
  const rs = [];
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

function calcScore(scoring, bid, got) {
  const d = Math.abs(got - bid);
  if (d !== 0) return -10 * d;
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
    return want
      ? ok.reduce((h, c) => beats(c, h, c.s, trump) ? c : h)
      : ok.reduce((l, c) => beats(l, c, l.s, trump) ? c : l);
  }
  const cur = trick.reduce((b, t) => beats(t.c, b.c, lead, trump) ? t : b);
  if (want) {
    const win = ok.filter(c => beats(c, cur.c, lead, trump));
    return win.length
      ? win.reduce((l, c) => beats(l, c, lead, trump) ? c : l)
      : ok.reduce((l, c) => beats(l, c, lead, trump) ? c : l);
  }
  const lose = ok.filter(c => !beats(c, cur.c, lead, trump));
  return lose.length
    ? lose.reduce((h, c) => beats(c, h, lead, trump) ? c : h)
    : ok.reduce((l, c) => beats(l, c, lead, trump) ? c : l);
}

function dealRound(rs, ri, dealer, n) {
  const cpp = rs[ri], deck = mkDeck();
  const hands = Array.from({ length: n }, (_, i) => deck.slice(i * cpp, (i + 1) * cpp));
  const max = 0 | (52 / n);
  let trump = null, tCard = null;
  if (cpp < max) { tCard = deck[cpp * n]; trump = tCard.s; }
  const fb = (dealer + 1) % n;
  return { hands, trump, tCard, bids: Array(n).fill(null), bp: fb, taken: Array(n).fill(0), trick: [], lp: fb, cp: fb, lead: null, rdSc: [] };
}

// ─── Room Management ──────────────────────────────────────────────────────────
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
      phase: room.phase,
      roomCode,
      players: room.players.map(p => ({ name: p.name, isBot: p.isBot, connected: !!p.socketId })),
      scoring: room.scoring,
      maxPlayers: room.maxPlayers,
      yourIndex: idx,
      isHost: player.socketId === room.host,
    };

    if (g) {
      payload.ri = g.ri;
      payload.rs = g.rs;
      payload.sc = g.sc;
      payload.history = g.history;
      payload.trump = g.trump;
      payload.tCard = g.tCard;
      payload.bids = g.bids;
      payload.bp = g.bp;
      payload.taken = g.taken;
      payload.trick = g.trick;
      payload.lead = g.lead;
      payload.rdSc = g.rdSc;
      payload.cp = g.cp;
      payload.lp = g.lp;
      payload.dealer = g.dealer;
      payload.n = room.players.length;
      payload.myHand = g.hands[idx] || [];
      payload.handCounts = g.hands.map(h => h.length);
      payload.msg = g.msg || '';
    }

    socket.emit('game_update', payload);
  });
}

function scheduleBots(roomCode) {
  // Cancel any pending bot timer for this room
  if (botTimers.has(roomCode)) {
    clearTimeout(botTimers.get(roomCode));
    botTimers.delete(roomCode);
  }

  const room = rooms.get(roomCode);
  if (!room || !room.gameState) return;
  const g = room.gameState;

  if (g.phase === 'bid' && g.bp >= 0) {
    const player = room.players[g.bp];
    if (player && player.isBot) {
      const t = setTimeout(() => {
        const r = rooms.get(roomCode);
        if (!r || !r.gameState) return;
        const gs = r.gameState;
        const takenSoFar = (gs.bids || []).reduce((s, b) => b != null ? s + b : s, 0);
        const filled = (gs.bids || []).filter(b => b != null).length;
        const isLast = filled === r.players.length - 1;
        const bid = aiBid(gs.hands[gs.bp], gs.trump, takenSoFar, gs.rs[gs.ri], isLast);
        handleBid(roomCode, gs.bp, bid);
      }, 600 + Math.random() * 400);
      botTimers.set(roomCode, t);
    }
  } else if (g.phase === 'play' && g.cp >= 0 && g.trick.length < room.players.length) {
    const player = room.players[g.cp];
    if (player && player.isBot) {
      const t = setTimeout(() => {
        const r = rooms.get(roomCode);
        if (!r || !r.gameState) return;
        const gs = r.gameState;
        const card = aiPlay(gs.hands[gs.cp], gs.trick, gs.lead, gs.trump, gs.bids[gs.cp], gs.taken[gs.cp]);
        if (card) handlePlay(roomCode, gs.cp, card.id);
      }, 700 + Math.random() * 500);
      botTimers.set(roomCode, t);
    }
  }
}

function handleBid(roomCode, playerIdx, bid) {
  const room = rooms.get(roomCode);
  if (!room || !room.gameState) return;
  const g = room.gameState;
  if (g.phase !== 'bid' || g.bp !== playerIdx) return;

  // Validate forbidden bid for last bidder
  const filled = g.bids.filter(b => b != null).length;
  const isLast = filled === room.players.length - 1;
  if (isLast) {
    const takenSoFar = g.bids.reduce((s, b) => b != null ? s + b : s, 0);
    if (bid === g.rs[g.ri] - takenSoFar) return; // forbidden
  }

  g.bids[playerIdx] = bid;
  if (g.bids.every(b => b != null)) {
    g.phase = 'play';
    g.bp = -1;
    g.cp = g.lp;
    g.msg = '';
  } else {
    g.bp = (playerIdx + 1) % room.players.length;
  }

  broadcastRoom(roomCode);
  scheduleBots(roomCode);
}

function handlePlay(roomCode, playerIdx, cardId) {
  const room = rooms.get(roomCode);
  if (!room || !room.gameState) return;
  const g = room.gameState;
  if (g.phase !== 'play' || g.cp !== playerIdx) return;
  if (g.trick.length >= room.players.length) return;

  const hand = g.hands[playerIdx];
  const card = hand.find(c => c.id === cardId);
  if (!card) return;

  // Validate follow suit
  const lead = g.trick.length === 0 ? card.s : g.lead;
  if (g.trick.length > 0 && g.lead) {
    const hasSuit = hand.some(c => c.s === g.lead);
    if (hasSuit && card.s !== g.lead) {
      g.msg = `Tenés ${g.lead} — debés seguir el palo`;
      broadcastRoom(roomCode);
      return;
    }
  }

  g.hands[playerIdx] = hand.filter(c => c.id !== cardId);
  g.trick.push({ p: playerIdx, c: card });
  g.lead = lead;
  g.cp = (playerIdx + 1) % room.players.length;
  g.msg = '';

  broadcastRoom(roomCode);

  // Auto-resolve trick when all players have played
  if (g.trick.length === room.players.length) {
    setTimeout(() => {
      resolveTrick(roomCode);
    }, 1100);
  } else {
    scheduleBots(roomCode);
  }
}

function resolveTrick(roomCode) {
  const room = rooms.get(roomCode);
  if (!room || !room.gameState) return;
  const g = room.gameState;

  const w = trickWin(g.trick, g.lead, g.trump);
  g.taken[w]++;
  g.trick = [];
  g.lead = null;

  // Check if round is over
  if (g.hands.every(h => h.length === 0)) {
    const rdSc = g.taken.map((got, i) => calcScore(room.scoring, g.bids[i], got));
    g.rdSc = rdSc;
    g.sc = g.sc.map((s, i) => s + rdSc[i]);
    g.history.push({
      ri: g.ri, cpp: g.rs[g.ri], trump: g.trump,
      bids: [...g.bids], taken: [...g.taken], rdSc, totals: [...g.sc]
    });
    g.phase = 'rend';
    broadcastRoom(roomCode);
  } else {
    g.lp = w;
    g.cp = w;
    broadcastRoom(roomCode);
    scheduleBots(roomCode);
  }
}

function handleNextRound(roomCode) {
  const room = rooms.get(roomCode);
  if (!room || !room.gameState) return;
  const g = room.gameState;

  const ri = g.ri + 1;
  if (ri >= g.rs.length) {
    g.phase = 'gend';
    broadcastRoom(roomCode);
    return;
  }

  const dealer = (g.dealer + 1) % room.players.length;
  const deal = dealRound(g.rs, ri, dealer, room.players.length);
  Object.assign(g, deal, { ri, dealer, phase: 'bid', msg: '' });

  broadcastRoom(roomCode);
  scheduleBots(roomCode);
}

// ─── Socket Handlers ──────────────────────────────────────────────────────────
io.on('connection', (socket) => {

  socket.on('create_room', ({ name, maxPlayers, scoring }) => {
    const code = genCode();
    const room = {
      code,
      phase: 'lobby',
      host: socket.id,
      maxPlayers: maxPlayers || 4,
      scoring: scoring || 'pablo',
      gameState: null,
      players: [{ id: socket.id, socketId: socket.id, name: name || 'Jugador 1', isBot: false }],
    };
    rooms.set(code, room);
    socket.join(code);
    socket.roomCode = code;
    socket.playerIdx = 0;
    broadcastRoom(code);
  });

  socket.on('join_room', ({ code, name }) => {
    const room = rooms.get(code.toUpperCase());
    if (!room) { socket.emit('error', { message: 'Sala no encontrada. Revisá el código.' }); return; }
    if (room.phase !== 'lobby') { socket.emit('error', { message: 'La partida ya empezó.' }); return; }
    if (room.players.filter(p => !p.isBot).length >= room.maxPlayers) { socket.emit('error', { message: 'La sala está llena.' }); return; }

    const idx = room.players.length;
    room.players.push({ id: socket.id, socketId: socket.id, name: name || `Jugador ${idx + 1}`, isBot: false });
    socket.join(code.toUpperCase());
    socket.roomCode = code.toUpperCase();
    socket.playerIdx = idx;
    broadcastRoom(code.toUpperCase());
  });

  socket.on('add_bot', ({ roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room || room.phase !== 'lobby') return;
    if (room.host !== socket.id) return;
    if (room.players.length >= room.maxPlayers) return;
    const botIdx = room.players.length;
    const botNames = ['Bot Alfa', 'Bot Beta', 'Bot Gamma', 'Bot Delta'];
    room.players.push({ id: null, socketId: null, name: botNames[botIdx % botNames.length], isBot: true });
    broadcastRoom(roomCode);
  });

  socket.on('remove_bot', ({ roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room || room.phase !== 'lobby') return;
    if (room.host !== socket.id) return;
    const lastBot = [...room.players].reverse().find(p => p.isBot);
    if (lastBot) room.players.splice(room.players.lastIndexOf(lastBot), 1);
    broadcastRoom(roomCode);
  });

  socket.on('start_game', ({ roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room || room.phase !== 'lobby') return;
    if (room.host !== socket.id) return;
    if (room.players.length < 4) { socket.emit('error', { message: 'Necesitás al menos 4 jugadores para empezar.' }); return; }

    const n = room.players.length;
    const rs = mkRounds(n);
    const deal = dealRound(rs, 0, 0, n);
    room.gameState = {
      ...deal,
      rs, ri: 0, dealer: 0,
      sc: Array(n).fill(0),
      history: [],
      phase: 'bid',
      msg: '',
    };
    room.phase = 'game';
    broadcastRoom(roomCode);
    scheduleBots(roomCode);
  });

  socket.on('place_bid', ({ roomCode, bid }) => {
    const room = rooms.get(roomCode);
    if (!room) return;
    const idx = room.players.findIndex(p => p.socketId === socket.id);
    if (idx < 0) return;
    handleBid(roomCode, idx, bid);
  });

  socket.on('play_card', ({ roomCode, cardId }) => {
    const room = rooms.get(roomCode);
    if (!room) return;
    const idx = room.players.findIndex(p => p.socketId === socket.id);
    if (idx < 0) return;
    handlePlay(roomCode, idx, cardId);
  });

  socket.on('next_round', ({ roomCode }) => {
    handleNextRound(roomCode);
  });

  socket.on('disconnect', () => {
    const roomCode = socket.roomCode;
    if (!roomCode) return;
    const room = rooms.get(roomCode);
    if (!room) return;
    const player = room.players.find(p => p.socketId === socket.id);
    if (player) {
      player.socketId = null; // Mark as disconnected but keep in game
      broadcastRoom(roomCode);
    }
    // Clean up empty rooms
    if (room.players.every(p => !p.socketId)) {
      if (botTimers.has(roomCode)) clearTimeout(botTimers.get(roomCode));
      rooms.delete(roomCode);
    }
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => console.log(`🂡 Las Basas server running on port ${PORT}`));
