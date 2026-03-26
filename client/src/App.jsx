import { useEffect, useState, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';

const isRed = s => s === '♥' || s === '♦';
const suitColor = s => ({ '♠':'#1e293b', '♥':'#dc2626', '♦':'#2563eb', '♣':'#16a34a' }[s]||'#111827');
const RV = {'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14};
const HIGH = new Set(['A','K','Q','J']);
const sortH = h => {
  const so = {'♠':0,'♥':1,'♦':2,'♣':3};
  return [...h].sort((a,b) => so[a.s]-so[b.s] || RV[b.r]-RV[a.r]);
};

// Timer helpers
const bidTimeLimit = cpp => cpp <= 8 ? 60 : cpp <= 11 ? 120 : 180;
const playTimeLimit = cpp => cpp <= 5 ? 20 : 20 + (cpp - 5) * 5;

// ─── Card components ──────────────────────────────────────────────────────────
function CardFace({ c, sel, ok, onClick, size='md' }) {
  const dims = { sm:[34,50,9,6], md:[52,74,10,6], lg:[58,82,11,6], xs:[22,32,8,3] };
  const [W,H,fs,pad] = dims[size]||dims.md;
  return (
    <div onClick={onClick} style={{
      width:W, height:H, background:'#fff',
      border:`2px solid ${sel?'#f59e0b':'#d1d5db'}`, borderRadius:5,
      display:'flex', flexDirection:'column', justifyContent:'space-between',
      padding:pad, cursor:ok||sel?'pointer':'default',
      boxShadow:sel?'0 0 0 3px #fbbf24,0 4px 8px rgba(0,0,0,.3)':'0 2px 4px rgba(0,0,0,.25)',
      transform:sel?'translateY(-14px)':ok?'translateY(-5px)':'none',
      transition:'all .12s',
      fontSize:fs, userSelect:'none', opacity:!ok&&!sel?.55:1, flexShrink:0, color:suitColor(c.s),
    }}>
      <div><b style={{display:'block',lineHeight:1.1}}>{c.r}</b><span>{c.s}</span></div>
      {size!=='xs'&&<div style={{textAlign:'right'}}><span>{c.s}</span><b style={{display:'block',lineHeight:1.1}}>{c.r}</b></div>}
    </div>
  );
}
function CardBack({ size='sm' }) {
  const dims = { sm:[26,38,9], md:[42,58,12], xs:[18,26,8] };
  const [W,H,fs] = dims[size]||dims.sm;
  return (
    <div style={{width:W,height:H,background:'linear-gradient(135deg,#1e40af,#3b82f6)',border:'2px solid #93c5fd',borderRadius:5,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',color:'rgba(255,255,255,.12)',fontSize:fs}}>◆</div>
  );
}

// ─── Countdown timer display ──────────────────────────────────────────────────
function Countdown({ seconds, total }) {
  const pct = seconds / total;
  const color = pct > 0.5 ? '#4ade80' : pct > 0.25 ? '#fbbf24' : '#f87171';
  return (
    <div style={{display:'flex',alignItems:'center',gap:6}}>
      <div style={{width:32,height:32,position:'relative',flexShrink:0}}>
        <svg width={32} height={32} style={{transform:'rotate(-90deg)'}}>
          <circle cx={16} cy={16} r={13} fill='none' stroke='rgba(255,255,255,.1)' strokeWidth={3}/>
          <circle cx={16} cy={16} r={13} fill='none' stroke={color} strokeWidth={3}
            strokeDasharray={`${2*Math.PI*13}`}
            strokeDashoffset={`${2*Math.PI*13*(1-pct)}`}
            style={{transition:'stroke-dashoffset .9s linear,stroke .3s'}}/>
        </svg>
        <span style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:'bold',color}}>{seconds}</span>
      </div>
    </div>
  );
}

// ─── Table positions ──────────────────────────────────────────────────────────
const POSITIONS = {
  4: [
    { seat:{x:50,y:94}, card:{x:50,y:66} },
    { seat:{x:94,y:50}, card:{x:69,y:50} },
    { seat:{x:50,y:6},  card:{x:50,y:34} },
    { seat:{x:6,y:50},  card:{x:31,y:50} },
  ],
  5: [
    { seat:{x:50,y:94},  card:{x:50,y:67} },
    { seat:{x:88,y:72},  card:{x:65,y:61} },
    { seat:{x:88,y:22},  card:{x:65,y:39} },
    { seat:{x:12,y:22},  card:{x:35,y:39} },
    { seat:{x:12,y:72},  card:{x:35,y:61} },
  ],
};

function PlayerSeat({ player, bid, taken, score, active, bidding, isYou, pos }) {
  return (
    <div style={{position:'absolute',left:`${pos.seat.x}%`,top:`${pos.seat.y}%`,transform:'translate(-50%,-50%)',zIndex:2,pointerEvents:'none',minWidth:90}}>
      <div style={{background:isYou?'rgba(22,163,74,.45)':active?'rgba(251,191,36,.2)':'rgba(0,0,0,.45)',border:`1.5px solid ${isYou?'#4ade80':active?'#fbbf24':'rgba(255,255,255,.15)'}`,borderRadius:10,padding:'5px 9px',textAlign:'center',backdropFilter:'blur(4px)'}}>
        <div style={{fontSize:11,fontWeight:'bold',color:isYou?'#4ade80':active?'#fbbf24':'#e2e8f0',whiteSpace:'nowrap',overflow:'hidden',maxWidth:90,textOverflow:'ellipsis'}}>
          {player.name}{!player.connected&&!player.isBot?' ✗':''}
          {player.isBot&&<span style={{marginLeft:4,fontSize:9,color:'#fbbf24',background:'rgba(251,191,36,.15)',borderRadius:8,padding:'1px 4px'}}>bot</span>}
        </div>
        <div style={{fontSize:13,fontWeight:'bold',color:'#fff',lineHeight:1.2}}>{score}</div>
        {bid!=null&&<div style={{fontSize:10,color:'#fbbf24'}}>Ap:{bid} Bz:{taken||0}</div>}
        {bidding&&<div style={{fontSize:10,color:'#fbbf24'}}>apostando...</div>}
      </div>
    </div>
  );
}

function TableCard({ c, pos }) {
  return (
    <div style={{position:'absolute',left:`${pos.card.x}%`,top:`${pos.card.y}%`,transform:'translate(-50%,-50%)',zIndex:3,transition:'all .25s'}}>
      <CardFace c={c} ok={false} size='md'/>
    </div>
  );
}

// ─── Bid summary ──────────────────────────────────────────────────────────────
function BidSummary({ bids, cpp }) {
  const filled = bids.filter(b => b != null);
  if (filled.length === 0) return null;
  const total = filled.reduce((s,b) => s+b, 0);
  const diff = total - cpp;
  if (diff === 0) return <span style={{color:'#fbbf24',fontSize:12}}>⚠ Cerrado exacto</span>;
  if (diff > 0) return <span style={{color:'#f87171',fontSize:12}}>+{diff} que todos quieren</span>;
  return <span style={{color:'#4ade80',fontSize:12}}>{Math.abs(diff)} que nadie quiere</span>;
}

// ─── Easter egg toast ─────────────────────────────────────────────────────────
function Toast({ msg, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 4000); return () => clearTimeout(t); }, []);
  return (
    <div style={{position:'fixed',top:80,left:'50%',transform:'translateX(-50%)',zIndex:100,background:'rgba(0,0,0,.85)',border:'2px solid #fbbf24',borderRadius:12,padding:'12px 24px',color:'#fbbf24',fontSize:15,fontWeight:'bold',textAlign:'center',maxWidth:320,boxShadow:'0 4px 20px rgba(0,0,0,.5)'}}>
      {msg}
    </div>
  );
}

// ─── GameTable ────────────────────────────────────────────────────────────────
function GameTable({ g, players, onBid, onPlay, sel, setSel, error, toast, setToast }) {
  const n = players.length;
  const you = g.yourIndex;
  const cpp = g.rs?.[g.ri] || 0;
  const positions = POSITIONS[n] || POSITIONS[4];
  const relPos = pi => (pi - you + n) % n;

  // Timer state
  const [bidSecs, setBidSecs] = useState(null);
  const [playSecs, setPlaySecs] = useState(null);
  const bidTimerRef = useRef(null);
  const playTimerRef = useRef(null);

  // Bid timer
  useEffect(() => {
    if (bidTimerRef.current) clearInterval(bidTimerRef.current);
    if (g.phase === 'bid' && g.bp === you) {
      const limit = bidTimeLimit(cpp);
      setBidSecs(limit);
      bidTimerRef.current = setInterval(() => {
        setBidSecs(s => {
          if (s <= 1) {
            clearInterval(bidTimerRef.current);
            onBid(2); // default bid
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    } else {
      setBidSecs(null);
    }
    return () => clearInterval(bidTimerRef.current);
  }, [g.phase, g.bp, g.ri]);

  // Play timer
  useEffect(() => {
    if (playTimerRef.current) clearInterval(playTimerRef.current);
    if (g.phase === 'play' && g.cp === you && (g.trick||[]).length < n) {
      const limit = playTimeLimit(cpp);
      setPlaySecs(limit);
      playTimerRef.current = setInterval(() => {
        setPlaySecs(s => {
          if (s <= 1) {
            clearInterval(playTimerRef.current);
            // Auto-play: pick first valid card
            const h = g.myHand || [];
            const hasSuit = g.lead ? h.some(c => c.s === g.lead) : false;
            const valid = hasSuit ? h.filter(c => c.s === g.lead) : h;
            if (valid.length) onPlay(valid[0].id);
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    } else {
      setPlaySecs(null);
    }
    return () => clearInterval(playTimerRef.current);
  }, [g.phase, g.cp, (g.trick||[]).length, g.ri]);

  // Easter egg: panchueliando — only on 1st or 2nd card of the round (round >= 10)
  const prevTrickLen = useRef(0);
  useEffect(() => {
    const trickLen = (g.trick||[]).length;
    const totalPlayedInRound = (g.trickLog||[]).length * n + trickLen;
    if (trickLen > prevTrickLen.current && totalPlayedInRound <= 2 && cpp >= 10 && g.phase === 'play') {
      const totalBids = (g.bids||[]).reduce((s,b) => b!=null?s+b:s, 0);
      const nadieQuiere = totalBids < cpp;
      if (nadieQuiere) {
        const lastPlay = g.trick[g.trick.length - 1];
        const c = lastPlay.c;
        const isHighTrump = g.trump && c.s === g.trump && RV[c.r] >= 10;
        const isHigh = HIGH.has(c.r) || isHighTrump;
        if (isHigh) {
          const playerName = (players[lastPlay.p]||{}).name;
          setToast(`${playerName} está panchueliando 🤌`);
        }
      }
    }
    prevTrickLen.current = trickLen;
  }, [(g.trick||[]).length]);

  const ok = (() => {
    if (!g || g.cp !== you || g.phase !== 'play' || (g.trick||[]).length >= n) return new Set();
    const h = g.myHand || [];
    if (!g.lead||(g.trick||[]).length===0) return new Set(h);
    const hasSuit = h.some(c => c.s === g.lead);
    return new Set(hasSuit ? h.filter(c => c.s === g.lead) : h);
  })();

  const hand = sortH(g.myHand || []);

  // Easter egg: Orzon on hand 1
  const isOrzon = players.some(p => p.name.toLowerCase() === 'orzon');

  const trickMap = {};
  (g.trick||[]).forEach(({p,c}) => { trickMap[p] = c; });

  const humanPlay = card => {
    if (g.cp !== you || (g.trick||[]).length >= n) return;
    if (card !== sel) { setSel(card); return; }
    setSel(null);
    onPlay(card.id);
  };

  const handleBid = bid => {
    if (isOrzon && cpp === 1 && bid === 2) {
      setToast('entendiste gabito 😂');
    }
    onBid(bid);
  };

  return (
    <div style={{display:'flex',flexDirection:'column',gap:8,width:'100%',maxWidth:700}}>

      {/* Trump card + bid summary bar */}
      <div style={{display:'flex',alignItems:'center',gap:10,background:'rgba(0,0,0,.2)',borderRadius:10,padding:'6px 12px',flexWrap:'wrap'}}>
        {g.tCard ? (
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <span style={{fontSize:11,color:'rgba(255,255,255,.4)'}}>Triunfo:</span>
            <div style={{filter:'drop-shadow(0 2px 5px rgba(0,0,0,.5))'}}>
              <CardFace c={g.tCard} ok={false} size='sm'/>
            </div>
          </div>
        ) : (
          <span style={{fontSize:12,color:'rgba(255,255,255,.35)'}}>Sin triunfo</span>
        )}
        <div style={{flex:1,textAlign:'right'}}>
          <BidSummary bids={g.bids||[]} cpp={cpp}/>
        </div>
      </div>

      {/* Table */}
      <div style={{position:'relative',width:'100%',paddingBottom:'62%',borderRadius:24,overflow:'visible'}}>
        <div style={{position:'absolute',inset:0,background:'radial-gradient(ellipse at center,#1a6b3a 60%,#0f4a28 100%)',borderRadius:24,border:'3px solid #0a3018',boxShadow:'0 0 0 6px #0a2010,inset 0 0 60px rgba(0,0,0,.4)'}}/>
        <div style={{position:'absolute',left:'20%',right:'20%',top:'18%',bottom:'18%',borderRadius:'50%',border:'1px solid rgba(255,255,255,.06)',pointerEvents:'none'}}/>

        {/* Current trick cards */}
        {Object.entries(trickMap).map(([p,c]) => (
          <TableCard key={'t'+p} c={c} pos={positions[relPos(parseInt(p))]}/>
        ))}

        {/* Player seats */}
        {players.map((pl,pi) => {
          const rp = relPos(pi);
          const active = (g.phase==='play'&&g.cp===pi)||(g.phase==='bid'&&g.bp===pi);
          return (
            <PlayerSeat key={pi} player={pl} bid={(g.bids||[])[pi]} taken={(g.taken||[])[pi]}
              score={(g.sc||[])[pi]||0} active={active} bidding={g.phase==='bid'&&g.bp===pi&&pi!==you}
              isYou={pi===you} pos={positions[rp]}/>
          );
        })}

        {/* Other players card backs */}
        {players.map((pl,pi) => {
          if (pi===you) return null;
          const rp = relPos(pi);
          const pos = positions[rp];
          const hl = (g.handCounts||[])[pi]||0;
          if (!hl) return null;
          const isH = pos.seat.x > 30 && pos.seat.x < 70;
          return (
            <div key={'h'+pi} style={{position:'absolute',left:`${pos.seat.x}%`,top:`${pos.seat.y}%`,transform:`translate(-50%,${isH?(pos.seat.y<30?'60%':'-160%'):'-50%'})`,display:'flex',gap:isH?1:0,flexDirection:isH?'row':'column',zIndex:1,pointerEvents:'none'}}>
              {Array.from({length:Math.min(hl,8)},(_,j)=>(
                <div key={j} style={{marginTop:isH?0:j===0?0:-28,marginLeft:isH?j===0?0:-14:0}}>
                  <CardBack size='xs'/>
                </div>
              ))}
              {hl>8&&<span style={{alignSelf:'center',fontSize:9,color:'rgba(255,255,255,.5)',marginLeft:4}}>+{hl-8}</span>}
            </div>
          );
        })}
      </div>

      {/* Bid phase */}
      {g.phase==='bid'&&g.bp===you&&(
        <div style={{textAlign:'center'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:10,marginBottom:6}}>
            <span style={{color:'#86efac',fontSize:13}}>¿Cuántas bazas vas a ganar?</span>
            {bidSecs!=null&&<Countdown seconds={bidSecs} total={bidTimeLimit(cpp)}/>}
          </div>
          <div style={{display:'flex',gap:5,flexWrap:'wrap',justifyContent:'center'}}>
            {Array.from({length: isOrzon&&cpp===1 ? cpp+2 : cpp+1},(_,bid)=>{
              const filled=(g.bids||[]).filter(b=>b!=null).length;
              const isLast=filled===n-1;
              const taken=(g.bids||[]).reduce((s,b)=>b!=null?s+b:s,0);
              const banned=isLast&&bid===cpp-taken;
              const isEaster=isOrzon&&cpp===1&&bid===2;
              return (
                <button key={bid} onClick={()=>handleBid(bid)} disabled={banned} style={{
                  width:44,height:44,borderRadius:8,border:isEaster?'2px solid #fbbf24':'none',
                  background:banned?'#374151':isEaster?'rgba(251,191,36,.2)':'#16a34a',
                  color:banned?'#4b5563':isEaster?'#fbbf24':'#fff',
                  fontSize:17,fontWeight:'bold',cursor:banned?'not-allowed':'pointer'
                }}>{bid}</button>
              );
            })}
          </div>
          {(g.bids||[]).filter(b=>b!=null).length===n-1&&<div style={{fontSize:10,color:'rgba(255,255,255,.4)',marginTop:5}}>Sos el último en apostar</div>}
        </div>
      )}
      {g.phase==='bid'&&g.bp!==you&&g.bp>=0&&(
        <div style={{color:'#86efac',fontSize:12,textAlign:'center'}}>{(players[g.bp]||{}).name} está apostando...</div>
      )}

      {/* Play timer */}
      {g.phase==='play'&&g.cp===you&&playSecs!=null&&(
        <div style={{display:'flex',justifyContent:'center',alignItems:'center',gap:8}}>
          <span style={{fontSize:12,color:'rgba(255,255,255,.5)'}}>Tiempo para jugar:</span>
          <Countdown seconds={playSecs} total={playTimeLimit(cpp)}/>
        </div>
      )}

      {/* Message */}
      <div style={{color:'#fbbf24',fontSize:12,textAlign:'center',minHeight:16}}>{g.msg||error||''}</div>

      {/* Your hand */}
      {g.phase!=='rend'&&g.phase!=='gend'&&(
        <div>
          <div style={{fontSize:11,color:'#86efac',textAlign:'center',marginBottom:6}}>
            Tu mano ({hand.length})
            {(g.bids||[])[you]!=null&&` — Apostaste ${g.bids[you]} — Ganaste ${(g.taken||[])[you]||0}`}
            {g.phase==='play'&&g.cp===you&&' — ¡Tu turno!'}
            {sel&&g.cp===you&&' — Clic de nuevo para confirmar'}
          </div>
          <div style={{display:'flex',gap:4,flexWrap:'wrap',justifyContent:'center'}}>
            {hand.map((c,i)=>(
              <CardFace key={c.id||i} c={c} sel={sel===c} ok={ok.has(c)} size='md' onClick={()=>humanPlay(c)}/>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Scoreboard ───────────────────────────────────────────────────────────────
function Scoreboard({ history, players, sc, scoring, onClose }) {
  const tdS={padding:'5px 9px',textAlign:'center',borderBottom:'1px solid rgba(255,255,255,.07)',fontSize:12};
  const thS={padding:'6px 9px',textAlign:'center',fontSize:11,color:'#86efac',fontWeight:'normal',borderBottom:'1px solid rgba(255,255,255,.18)',position:'sticky',top:0,background:'#0f3d22'};
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.88)',display:'flex',alignItems:'flex-start',justifyContent:'center',zIndex:50,overflowY:'auto',padding:'14px 8px'}}>
      <div style={{background:'#14532d',border:'2px solid #4ade80',borderRadius:14,width:'100%',maxWidth:860}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'13px 18px 10px',borderBottom:'1px solid rgba(255,255,255,.12)'}}>
          <div>
            <span style={{fontSize:17,fontWeight:500}}>📋 Pizarra</span>
            <span style={{marginLeft:10,fontSize:11,background:scoring==='fer'?'rgba(251,191,36,.2)':'rgba(74,222,128,.15)',border:`1px solid ${scoring==='fer'?'#fbbf24':'#4ade80'}`,borderRadius:20,padding:'2px 10px',color:scoring==='fer'?'#fbbf24':'#4ade80'}}>
              {scoring==='fer'?'A lo Fer':'A lo Pablo'}
            </span>
          </div>
          <button onClick={onClose} style={{background:'transparent',border:'1px solid rgba(255,255,255,.3)',color:'#fff',borderRadius:6,padding:'4px 14px',cursor:'pointer',fontSize:13}}>✕</button>
        </div>
        {history.length===0?(
          <div style={{padding:32,textAlign:'center',color:'rgba(255,255,255,.4)',fontSize:13}}>Todavía no se completó ninguna ronda.</div>
        ):(
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',minWidth:480}}>
              <thead>
                <tr>
                  <th style={{...thS,textAlign:'left',paddingLeft:14}}>Ronda</th>
                  <th style={thS}>Ctas</th>
                  <th style={thS}>Triunfo</th>
                  {players.map((p,i)=><th key={i} colSpan={3} style={{...thS,borderLeft:'1px solid rgba(255,255,255,.15)',color:i===0?'#fbbf24':'#86efac'}}>{p.name}</th>)}
                </tr>
                <tr style={{background:'rgba(0,0,0,.25)'}}>
                  <th style={thS}/><th style={thS}/><th style={thS}/>
                  {players.map((_,i)=>['Ap','Bz','Pts'].map(l=><th key={i+l} style={{...thS,fontSize:10,borderLeft:l==='Ap'?'1px solid rgba(255,255,255,.1)':undefined}}>{l}</th>))}
                </tr>
              </thead>
              <tbody>
                {history.map((h,idx)=>(
                  <tr key={idx} style={{background:idx%2===0?'rgba(255,255,255,.04)':'transparent'}}>
                    <td style={{...tdS,textAlign:'left',paddingLeft:14,color:'#a3e4b8',fontWeight:'bold'}}>{h.ri+1}</td>
                    <td style={tdS}>{h.cpp}</td>
                    <td style={{...tdS,fontSize:14,color:h.trump?isRed(h.trump)?'#f87171':'#e2e8f0':'rgba(255,255,255,.3)'}}>{h.trump||'—'}</td>
                    {players.map((_,i)=>[
                      <td key={i+'a'} style={{...tdS,borderLeft:'1px solid rgba(255,255,255,.07)'}}>{h.bids[i]}</td>,
                      <td key={i+'b'} style={tdS}>{h.taken[i]}</td>,
                      <td key={i+'p'} style={{...tdS,fontWeight:'bold',color:h.bids[i]===h.taken[i]?'#4ade80':'#f87171'}}>{h.rdSc[i]>=0?'+':''}{h.rdSc[i]}</td>,
                    ])}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{background:'rgba(0,0,0,.35)',borderTop:'2px solid rgba(255,255,255,.25)'}}>
                  <td colSpan={3} style={{...tdS,textAlign:'left',paddingLeft:14,color:'#86efac',fontWeight:'bold'}}>Total</td>
                  {players.map((_,i)=>[
                    <td key={i+'a'} style={{...tdS,borderLeft:'1px solid rgba(255,255,255,.07)'}}/>,
                    <td key={i+'b'} style={tdS}/>,
                    <td key={i+'t'} style={{...tdS,fontWeight:'bold',fontSize:16,color:i===0?'#fbbf24':'#fff'}}>{sc[i]}</td>,
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

function TrickLog({ trickLog, players, onClose, onlyLast=false }) {
  const [page,setPage]=useState(trickLog.length-1);
  const trick=trickLog[page];
  if(!trick) return null;
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.88)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:60,padding:16}}>
      <div style={{background:'#166534',border:'2px solid #4ade80',borderRadius:14,width:'100%',maxWidth:440,padding:'20px 18px'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
          <span style={{fontSize:16,fontWeight:500}}>🃏 Historial de bazas</span>
          <button onClick={onClose} style={{background:'transparent',border:'1px solid rgba(255,255,255,.3)',color:'#fff',borderRadius:6,padding:'3px 12px',cursor:'pointer',fontSize:13}}>✕</button>
        </div>
        {!onlyLast && (
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:16,justifyContent:'center'}}>
            <button onClick={()=>setPage(p=>Math.max(0,p-1))} disabled={page===0} style={{background:'rgba(255,255,255,.1)',border:'1px solid rgba(255,255,255,.2)',color:'#fff',borderRadius:6,padding:'4px 12px',cursor:page===0?'not-allowed':'pointer',opacity:page===0?.4:1}}>←</button>
            <span style={{color:'#86efac',fontSize:13}}>Baza {page+1} de {trickLog.length}</span>
            <button onClick={()=>setPage(p=>Math.min(trickLog.length-1,p+1))} disabled={page===trickLog.length-1} style={{background:'rgba(255,255,255,.1)',border:'1px solid rgba(255,255,255,.2)',color:'#fff',borderRadius:6,padding:'4px 12px',cursor:page===trickLog.length-1?'not-allowed':'pointer',opacity:page===trickLog.length-1?.4:1}}>→</button>
          </div>
        )}
        {onlyLast && (
          <div style={{textAlign:'center',marginBottom:16}}>
            <span style={{color:'#86efac',fontSize:13}}>Última baza jugada</span>
          </div>
        )}
        <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:14}}>
          {trick.cards.map(({p,c})=>{
            const isW=p===trick.winner;
            return (
              <div key={p} style={{display:'flex',alignItems:'center',gap:12,background:isW?'rgba(74,222,128,.15)':'rgba(255,255,255,.04)',border:`1px solid ${isW?'rgba(74,222,128,.5)':'rgba(255,255,255,.1)'}`,borderRadius:10,padding:'8px 14px'}}>
                <CardFace c={c} ok={false} size='sm'/>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:isW?'bold':'normal',color:isW?'#4ade80':'#e2e8f0'}}>{(players[p]||{}).name}</div>
                  <div style={{fontSize:11,color:'rgba(255,255,255,.4)'}}>{p===trick.cards[0]?.p&&'abre la baza'}</div>
                </div>
                {isW&&<span style={{fontSize:18}}>🏆</span>}
              </div>
            );
          })}
        </div>
        <div style={{textAlign:'center',color:'#fbbf24',fontSize:13}}>Se llevó la baza: <b>{(players[trick.winner]||{}).name}</b></div>
      </div>
    </div>
  );
}

function Chat({ messages, onSend, playerName }) {
  const [text,setText]=useState('');
  const bottomRef=useRef(null);
  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:'smooth'})},[messages]);
  const send=()=>{if(!text.trim())return;onSend(text.trim());setText('');};
  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%'}}>
      <div style={{flex:1,overflowY:'auto',padding:'8px 10px',display:'flex',flexDirection:'column',gap:5,minHeight:180}}>
        {messages.length===0&&<div style={{color:'rgba(255,255,255,.3)',fontSize:12,textAlign:'center',marginTop:16}}>Sin mensajes aún</div>}
        {messages.map((m,i)=>(
          <div key={i} style={{fontSize:12,lineHeight:1.4}}>
            <span style={{color:m.name===playerName?'#fbbf24':'#86efac',fontWeight:'bold'}}>{m.name}: </span>
            <span style={{color:'#e2e8f0'}}>{m.text}</span>
          </div>
        ))}
        <div ref={bottomRef}/>
      </div>
      <div style={{display:'flex',gap:6,padding:'6px 8px',borderTop:'1px solid rgba(255,255,255,.1)'}}>
        <input value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>e.key==='Enter'&&send()} placeholder="Mensaje..." maxLength={120}
          style={{flex:1,background:'rgba(255,255,255,.08)',border:'1px solid rgba(255,255,255,.2)',borderRadius:6,padding:'6px 10px',color:'#fff',fontSize:12,outline:'none'}}/>
        <button onClick={send} style={{background:'#16a34a',border:'none',borderRadius:6,padding:'6px 12px',color:'#fff',cursor:'pointer',fontSize:12}}>↑</button>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const socketRef=useRef(null);
  const reconnectRef=useRef(null);
  const [screen,setScreen]=useState('home');
  const [name,setName]=useState(()=>localStorage.getItem('basas_name')||'');
  const [joinCode,setJoinCode]=useState('');
  const [setupN,setSetupN]=useState(4);
  const [setupScoring,setSetupScoring]=useState('pablo');
  const [setupStakes,setSetupStakes]=useState({type:'none',description:''});
  const [g,setG]=useState(null);
  const [sel,setSel]=useState(null);
  const [showBoard,setShowBoard]=useState(false);
  const [showChat,setShowChat]=useState(false);
  const [showTrickLog,setShowTrickLog]=useState(false);
  const [toast,setToast]=useState(null);
  const [error,setError]=useState('');
  const [unread,setUnread]=useState(0);
  const prevChatLen=useRef(0);
  const showChatRef=useRef(false);
  showChatRef.current=showChat;

  useEffect(()=>{
    const savedCode=localStorage.getItem('basas_room');
    const savedName=localStorage.getItem('basas_name');
    if(savedCode&&savedName){reconnectRef.current={code:savedCode,name:savedName};setScreen('reconnecting');}
    const socket=io({reconnectionAttempts:15,reconnectionDelay:1500});
    socketRef.current=socket;
    socket.on('connect',()=>{
      if(reconnectRef.current) {
        socket.emit('reconnect_room',reconnectRef.current);
      }
    });
    socket.on('reconnect',()=>{
      // Socket.io auto-reconnect after drop — re-sync with server
      const savedCode=localStorage.getItem('basas_room');
      const savedName=localStorage.getItem('basas_name');
      if(savedCode&&savedName) {
        socket.emit('reconnect_room',{code:savedCode,name:savedName});
      }
    });
    socket.on('game_update',data=>{
      setG(data);setError('');reconnectRef.current=null;
      const chatLen=(data.chat||[]).length;
      if(chatLen>prevChatLen.current&&!showChatRef.current) setUnread(u=>u+(chatLen-prevChatLen.current));
      prevChatLen.current=chatLen;
      if(data.phase==='lobby') setScreen('lobby');
      else if(['bid','play','rend','gend'].includes(data.phase)) setScreen('game');
    });
    socket.on('error',({message})=>{
      setError(message);
      if(reconnectRef.current){reconnectRef.current=null;localStorage.removeItem('basas_room');setScreen('home');}
    });
    return ()=>socket.disconnect();
  },[]);

  const emit=(ev,data)=>socketRef.current?.emit(ev,data);
  const saveName=n=>{setName(n);localStorage.setItem('basas_name',n);};
  useEffect(()=>{if(g?.roomCode) localStorage.setItem('basas_room',g.roomCode);},[g?.roomCode]);

  const handleBid=useCallback(bid=>{
    if(!g||g.bp!==g.yourIndex) return;
    const filled=(g.bids||[]).filter(b=>b!=null).length;
    const isLast=filled===(g.n||0)-1;
    if(isLast){
      const taken=(g.bids||[]).reduce((s,b)=>b!=null?s+b:s,0);
      if(bid===(g.rs?.[g.ri]||0)-taken){setError(`⚠️ No podés apostar ${bid} — el total no puede cerrar`);return;}
    }
    setError('');emit('place_bid',{roomCode:g.roomCode,bid});
  },[g]);

  const handlePlay=useCallback(cardId=>{
    if(!g) return;
    emit('play_card',{roomCode:g.roomCode,cardId});
  },[g]);

  const leaveRoom = () => {
    if (!g?.roomCode) return;
    emit('leave_room', { roomCode: g.roomCode });
    localStorage.removeItem('basas_room');
    setG(null);
    setScreen('home');
  };

  const gs={background:'#0f2418',minHeight:'100vh',padding:'8px',fontFamily:'system-ui,sans-serif',color:'#fff',display:'flex',flexDirection:'column',alignItems:'center',gap:8};
  const cardBox={background:'rgba(0,0,0,.25)',borderRadius:12,padding:'16px 18px',marginBottom:14,width:'100%',maxWidth:460};
  const inputSt={width:'100%',padding:'10px 14px',borderRadius:8,border:'1px solid rgba(255,255,255,.25)',background:'rgba(255,255,255,.08)',color:'#fff',fontSize:15,outline:'none'};
  const btnP={background:'#16a34a',color:'#fff',border:'none',borderRadius:10,padding:'12px 28px',fontSize:15,fontWeight:'bold',cursor:'pointer'};
  const btnS={background:'rgba(255,255,255,.1)',color:'#fff',border:'1px solid rgba(255,255,255,.25)',borderRadius:10,padding:'12px 24px',fontSize:14,cursor:'pointer'};
  const optBtn=(active,onClick,children)=>(
    <button onClick={onClick} style={{padding:'11px 18px',borderRadius:10,border:`2px solid ${active?'#4ade80':'rgba(255,255,255,.2)'}`,background:active?'rgba(22,163,74,.4)':'rgba(255,255,255,.05)',color:'#fff',cursor:'pointer',fontSize:13,fontWeight:active?'bold':'normal'}}>{children}</button>
  );

  if(screen==='reconnecting') return (
    <div style={{...gs,justifyContent:'center',textAlign:'center'}}>
      <div style={{fontSize:44}}>🂡</div>
      <p style={{color:'#86efac',fontSize:15,marginBottom:8}}>Reconectando a la partida...</p>
      <p style={{color:'rgba(255,255,255,.4)',fontSize:12,marginBottom:20}}>Sala: {localStorage.getItem('basas_room')}</p>
      <button onClick={()=>{reconnectRef.current=null;localStorage.removeItem('basas_room');setScreen('home');}} style={{...btnS,fontSize:13}}>Cancelar</button>
    </div>
  );

  if(screen==='home') return (
    <div style={{...gs,justifyContent:'center',textAlign:'center'}}>
      <div style={{fontSize:52,lineHeight:1}}>🂡</div>
      <h1 style={{fontSize:34,margin:'8px 0 4px',fontWeight:500}}>Las Basas</h1>
      <p style={{color:'#86efac',marginBottom:28,fontSize:14}}>Jugá online con amigos o contra bots</p>
      <div style={cardBox}>
        <div style={{color:'#86efac',fontSize:13,marginBottom:8,textAlign:'left'}}>Tu nombre</div>
        <input style={inputSt} placeholder="Ej: Pablo" value={name} onChange={e=>saveName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&name.trim()&&setScreen('create')}/>
      </div>
      {error&&<div style={{color:'#f87171',fontSize:13,marginBottom:8}}>{error}</div>}
      <div style={{display:'flex',gap:12,flexWrap:'wrap',justifyContent:'center'}}>
        <button onClick={()=>{if(!name.trim()){setError('Ingresá tu nombre');return;}setError('');setScreen('create');}} style={btnP}>Crear sala</button>
        <button onClick={()=>{if(!name.trim()){setError('Ingresá tu nombre');return;}setError('');setScreen('join');}} style={btnS}>Unirse a sala</button>
      </div>
    </div>
  );

  if(screen==='create') return (
    <div style={{...gs,justifyContent:'center',textAlign:'center'}}>
      <h2 style={{fontSize:24,fontWeight:500,marginBottom:20}}>Crear sala</h2>
      <div style={cardBox}>
        <div style={{color:'#86efac',fontSize:13,marginBottom:8,textAlign:'left'}}>Jugadores</div>
        <div style={{display:'flex',gap:10}}>{[4,5].map(n=>optBtn(setupN===n,()=>setSetupN(n),`${n} jugadores`))}</div>
      </div>
      <div style={cardBox}>
        <div style={{color:'#86efac',fontSize:13,marginBottom:8,textAlign:'left'}}>Sistema de puntos</div>
        <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
          {optBtn(setupScoring==='pablo',()=>setSetupScoring('pablo'),<span>A lo Pablo<br/><span style={{fontSize:11,fontWeight:'normal',color:'#86efac'}}>Acertar: 10+ap²</span></span>)}
          {optBtn(setupScoring==='fer',()=>setSetupScoring('fer'),<span>A lo Fer<br/><span style={{fontSize:11,fontWeight:'normal',color:'#86efac'}}>Acertar: 10×ap (0→5)</span></span>)}
        </div>
      </div>
      <div style={cardBox}>
        <div style={{color:'#86efac',fontSize:13,marginBottom:8,textAlign:'left'}}>¿Se juega por algo?</div>
        <div style={{display:'flex',gap:8,marginBottom:10,flexWrap:'wrap'}}>
          {[{v:'none',label:'Sin apuesta'},{v:'prenda',label:'🎭 Prenda al perdedor'},{v:'premio',label:'🏆 Premio al ganador'}].map(({v,label})=>optBtn(setupStakes.type===v,()=>setSetupStakes({type:v,description:''}),label))}
        </div>
        {setupStakes.type!=='none'&&(
          <input
            style={{...inputSt,fontSize:13,marginTop:4}}
            placeholder={setupStakes.type==='prenda'?'Ej: el que pierde paga las pizzas...':'Ej: el ganador elige la próxima actividad...'}
            value={setupStakes.description}
            onChange={e=>setSetupStakes(s=>({...s,description:e.target.value.slice(0,120)}))}
          />
        )}
      </div>
      {error&&<div style={{color:'#f87171',fontSize:13,marginBottom:8}}>{error}</div>}
      <div style={{display:'flex',gap:12}}>
        <button onClick={()=>setScreen('home')} style={btnS}>← Volver</button>
        <button onClick={()=>{if(!name.trim()){setError('Ingresá tu nombre');return;}saveName(name.trim());emit('create_room',{name:name.trim(),maxPlayers:setupN,scoring:setupScoring,stakes:setupStakes});}} style={btnP}>Crear sala</button>
      </div>
    </div>
  );

  if(screen==='join') return (
    <div style={{...gs,justifyContent:'center',textAlign:'center'}}>
      <h2 style={{fontSize:24,fontWeight:500,marginBottom:20}}>Unirse a sala</h2>
      <div style={cardBox}>
        <div style={{color:'#86efac',fontSize:13,marginBottom:8,textAlign:'left'}}>Código de sala</div>
        <input style={{...inputSt,textTransform:'uppercase',letterSpacing:6,fontSize:22,textAlign:'center'}} placeholder="XXXX" maxLength={4} value={joinCode} onChange={e=>setJoinCode(e.target.value.toUpperCase())} onKeyDown={e=>e.key==='Enter'&&(()=>{if(!name.trim()){setError('Ingresá tu nombre');return;}saveName(name.trim());emit('join_room',{code:joinCode.trim().toUpperCase(),name:name.trim()});})()}/>
      </div>
      {error&&<div style={{color:'#f87171',fontSize:13,marginBottom:8}}>{error}</div>}
      <div style={{display:'flex',gap:12}}>
        <button onClick={()=>setScreen('home')} style={btnS}>← Volver</button>
        <button onClick={()=>{if(!name.trim()){setError('Ingresá tu nombre');return;}saveName(name.trim());emit('join_room',{code:joinCode.trim().toUpperCase(),name:name.trim()});}} style={btnP}>Unirse</button>
      </div>
    </div>
  );

  if(screen==='lobby'&&g) return (
    <div style={{...gs,justifyContent:'center',textAlign:'center'}}>
      <div style={{fontSize:44,lineHeight:1}}>🂡</div>
      <h2 style={{fontSize:24,fontWeight:500,marginBottom:4}}>Sala de espera</h2>
      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:20}}>
        <span style={{color:'#86efac',fontSize:14}}>Código:</span>
        <span style={{background:'rgba(0,0,0,.3)',border:'2px solid #4ade80',borderRadius:8,padding:'6px 18px',fontSize:26,fontWeight:'bold',letterSpacing:6}}>{g.roomCode}</span>
        <button onClick={()=>navigator.clipboard?.writeText(g.roomCode)} style={{...btnS,padding:'6px 12px',fontSize:12}}>Copiar</button>
      </div>
      {/* Stakes panel */}
      {g.stakes&&g.stakes.type!=='none'&&(
        <div style={{...cardBox,textAlign:'left',borderColor:g.stakes.type==='prenda'?'rgba(168,85,247,.4)':'rgba(251,191,36,.4)',border:'1.5px solid'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
            <span style={{fontSize:13,color:g.stakes.type==='prenda'?'#c084fc':'#fbbf24',fontWeight:'bold'}}>
              {g.stakes.type==='prenda'?'🎭 Prenda al perdedor':'🏆 Premio al ganador'}
            </span>
            {g.isHost&&(
              <button onClick={()=>emit('update_stakes',{roomCode:g.roomCode,stakes:{type:'none',description:''}})} style={{background:'transparent',border:'none',color:'rgba(255,255,255,.4)',cursor:'pointer',fontSize:12}}>✕ Quitar</button>
            )}
          </div>
          {g.stakes.description&&<p style={{fontSize:12,color:'rgba(255,255,255,.7)',margin:'0 0 8px',fontStyle:'italic'}}>"{g.stakes.description}"</p>}
          {/* Host can edit description */}
          {g.isHost&&(
            <input style={{...inputSt,fontSize:12,marginBottom:8}}
              placeholder="Descripción (opcional)"
              value={g.stakes.description||''}
              onChange={e=>emit('update_stakes',{roomCode:g.roomCode,stakes:{...g.stakes,description:e.target.value.slice(0,120)}})}
            />
          )}
          {/* Confirmations */}
          <div style={{fontSize:11,color:'rgba(255,255,255,.5)',marginBottom:4}}>Confirmaciones:</div>
          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
            {(g.players||[]).filter(p=>!p.isBot).map((p,i)=>{
              const confirmed=(g.confirmations||{})[p.name];
              const isMe=p.name===(g.players||[])[g.yourIndex]?.name;
              return (
                <span key={i} style={{fontSize:11,padding:'3px 10px',borderRadius:20,background:confirmed?'rgba(74,222,128,.2)':'rgba(255,255,255,.06)',border:`1px solid ${confirmed?'#4ade80':'rgba(255,255,255,.2)'}`,color:confirmed?'#4ade80':'rgba(255,255,255,.5)'}}>
                  {confirmed?'✓ ':''}{p.name}
                </span>
              );
            })}
          </div>
          {/* Confirm button for non-confirmed players */}
          {!(g.confirmations||{})[(g.players||[])[g.yourIndex]?.name]&&(
            <button onClick={()=>emit('confirm_stakes',{roomCode:g.roomCode})} style={{marginTop:10,background:'#16a34a',color:'#fff',border:'none',borderRadius:8,padding:'8px 20px',fontSize:13,cursor:'pointer',fontWeight:'bold',width:'100%'}}>
              ✓ Confirmo la apuesta
            </button>
          )}
        </div>
      )}
      {/* Host can add stakes if none */}
      {g.isHost&&(!g.stakes||g.stakes.type==='none')&&(
        <div style={{display:'flex',gap:8,flexWrap:'wrap',justifyContent:'center',marginBottom:8}}>
          <button onClick={()=>emit('update_stakes',{roomCode:g.roomCode,stakes:{type:'prenda',description:''}})} style={{...btnS,fontSize:12,padding:'8px 14px'}}>🎭 Agregar prenda</button>
          <button onClick={()=>emit('update_stakes',{roomCode:g.roomCode,stakes:{type:'premio',description:''}})} style={{...btnS,fontSize:12,padding:'8px 14px'}}>🏆 Agregar premio</button>
        </div>
      )}

      <div style={{...cardBox,textAlign:'left'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
          <div style={{color:'#86efac',fontSize:13}}>Jugadores ({(g.players||[]).length}/{g.maxPlayers})</div>
          <button onClick={leaveRoom} style={{background:'rgba(248,113,113,.15)',border:'1px solid #f87171',color:'#f87171',borderRadius:6,padding:'3px 10px',cursor:'pointer',fontSize:12}}>Salir</button>
        </div>
        {(g.players||[]).map((p,i)=>(
          <div key={i} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 0',borderBottom:'1px solid rgba(255,255,255,.08)'}}>
            <div style={{width:8,height:8,borderRadius:'50%',background:p.connected||p.isBot?'#4ade80':'#6b7280'}}/>
            <span style={{flex:1}}>{p.name}</span>
            {p.isBot&&<span style={{fontSize:11,background:'rgba(251,191,36,.2)',border:'1px solid #fbbf24',borderRadius:20,padding:'2px 8px',color:'#fbbf24'}}>Bot</span>}
            {i===0&&!p.isBot&&<span style={{fontSize:11,color:'#86efac'}}>Host</span>}
          </div>
        ))}
      </div>
      {error&&<div style={{color:'#f87171',fontSize:13,marginBottom:8}}>{error}</div>}
      {g.isHost&&(
        <div style={{display:'flex',gap:10,flexWrap:'wrap',justifyContent:'center',marginTop:8}}>
          {(g.players||[]).length<g.maxPlayers&&<button onClick={()=>emit('add_bot',{roomCode:g.roomCode})} style={btnS}>+ Bot</button>}
          {(g.players||[]).some(p=>p.isBot)&&<button onClick={()=>emit('remove_bot',{roomCode:g.roomCode})} style={{...btnS,color:'#f87171',borderColor:'#f87171'}}>− Bot</button>}
          <button onClick={()=>emit('start_game',{roomCode:g.roomCode})} style={{...btnP,opacity:(g.players||[]).length<4?.5:1}} disabled={(g.players||[]).length<4}>
            {(g.players||[]).length<4?`Faltan ${4-(g.players||[]).length}`:'¡Arrancar!'}
          </button>
        </div>
      )}
      {!g.isHost&&<p style={{color:'rgba(255,255,255,.5)',fontSize:13,marginTop:8}}>Esperando que el host arranque...</p>}
    </div>
  );

  if(screen==='game'&&g){
    const players=g.players||[];
    const myName=players[g.yourIndex]?.name||'';
    const trickLog=g.trickLog||[];
    return (
      <div style={{...gs,position:'relative'}}>
        {toast&&<Toast msg={toast} onDone={()=>setToast(null)}/>}

        {/* Top bar */}
        <div style={{width:'100%',maxWidth:760,display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:6}}>
          <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
            <b style={{fontSize:16}}>🂡 Las Basas</b>
            <span style={{fontSize:11,background:g.scoring==='fer'?'rgba(251,191,36,.2)':'rgba(74,222,128,.15)',border:`1px solid ${g.scoring==='fer'?'#fbbf24':'#4ade80'}`,borderRadius:20,padding:'2px 8px',color:g.scoring==='fer'?'#fbbf24':'#4ade80'}}>
              {g.scoring==='fer'?'A lo Fer':'A lo Pablo'}
            </span>
            <span style={{color:'#86efac',fontSize:12}}>Ronda {(g.ri||0)+1}/{g.rs?.length||0} — {g.rs?.[g.ri]||0} carta{g.rs?.[g.ri]!==1?'s':''}</span>
            {g.stakes&&g.stakes.type!=='none'&&(
              <span title={g.stakes.description||''} style={{fontSize:11,background:g.stakes.type==='prenda'?'rgba(168,85,247,.2)':'rgba(251,191,36,.2)',border:`1px solid ${g.stakes.type==='prenda'?'#c084fc':'#fbbf24'}`,borderRadius:20,padding:'2px 8px',color:g.stakes.type==='prenda'?'#c084fc':'#fbbf24',cursor:'default'}}>
                {g.stakes.type==='prenda'?'🎭':'🏆'} {g.stakes.description?`"${g.stakes.description.slice(0,20)}${g.stakes.description.length>20?'...':''}"`:g.stakes.type==='prenda'?'Prenda':'Premio'}
              </span>
            )}
          </div>
          <div style={{display:'flex',gap:6}}>
            <button onClick={()=>setShowBoard(true)} style={{background:'rgba(255,255,255,.1)',border:'1px solid rgba(255,255,255,.2)',color:'#fff',borderRadius:8,padding:'5px 11px',cursor:'pointer',fontSize:12}}>📋</button>
            {trickLog.length>0&&<button onClick={()=>setShowTrickLog(true)} style={{background:'rgba(255,255,255,.1)',border:'1px solid rgba(255,255,255,.2)',color:'#fff',borderRadius:8,padding:'5px 11px',cursor:'pointer',fontSize:12}}>🃏</button>}
            <button onClick={leaveRoom} style={{background:'rgba(248,113,113,.1)',border:'1px solid rgba(248,113,113,.4)',color:'#f87171',borderRadius:8,padding:'5px 10px',cursor:'pointer',fontSize:12}}>✕ Salir</button>
            <button onClick={()=>{setShowChat(true);setUnread(0);}} style={{background:'rgba(255,255,255,.1)',border:`1px solid ${unread>0?'#fbbf24':'rgba(255,255,255,.2)'}`,color:unread>0?'#fbbf24':'#fff',borderRadius:8,padding:'5px 11px',cursor:'pointer',fontSize:12}}>
              💬{unread>0&&<span style={{marginLeft:3,background:'#f59e0b',color:'#000',borderRadius:10,padding:'0 4px',fontSize:10,fontWeight:'bold'}}>{unread}</span>}
            </button>
          </div>
        </div>

        {/* Game + chat */}
        <div style={{width:'100%',maxWidth:760,display:'flex',gap:10,alignItems:'flex-start'}}>
          <GameTable g={g} players={players} onBid={handleBid} onPlay={handlePlay} sel={sel} setSel={setSel} error={error} toast={toast} setToast={setToast}/>
          {showChat&&(
            <div style={{width:210,minHeight:380,background:'rgba(0,0,0,.3)',border:'1px solid rgba(255,255,255,.12)',borderRadius:12,display:'flex',flexDirection:'column',flexShrink:0}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 12px',borderBottom:'1px solid rgba(255,255,255,.1)'}}>
                <span style={{fontSize:13,fontWeight:500}}>💬 Chat</span>
                <button onClick={()=>setShowChat(false)} style={{background:'transparent',border:'none',color:'rgba(255,255,255,.5)',cursor:'pointer',fontSize:14}}>✕</button>
              </div>
              <div style={{flex:1}}><Chat messages={g.chat||[]} onSend={text=>emit('chat_message',{roomCode:g.roomCode,text})} playerName={myName}/></div>
            </div>
          )}
        </div>

        {/* Round end */}
        {g.phase==='rend'&&(
          <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.82)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:10,overflowY:'auto',padding:16}}>
            <div style={{background:'#166534',border:'2px solid #4ade80',borderRadius:16,padding:'24px 20px',minWidth:320,textAlign:'center',maxWidth:460,width:'100%'}}>
              <div style={{fontSize:13,color:'#86efac',marginBottom:4}}>Ronda {(g.ri||0)+1} terminada</div>
              <h3 style={{margin:'0 0 16px',fontSize:22,fontWeight:600}}>Resultados</h3>
              <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:16}}>
                {players.map((p,i)=>{
                  const hit=(g.bids||[])[i]===(g.taken||[])[i];
                  const pts=(g.rdSc||[])[i]||0;
                  return (
                    <div key={i} style={{display:'flex',alignItems:'center',gap:10,background:i===g.yourIndex?'rgba(255,255,255,.1)':'rgba(255,255,255,.04)',border:`1px solid ${hit?'rgba(74,222,128,.4)':'rgba(248,113,113,.25)'}`,borderRadius:10,padding:'9px 14px'}}>
                      <div style={{fontSize:18}}>{hit?'✅':'❌'}</div>
                      <div style={{flex:1,textAlign:'left'}}>
                        <div style={{fontSize:13,fontWeight:500}}>{p.name}</div>
                        <div style={{fontSize:11,color:'rgba(255,255,255,.45)'}}>Apostó {(g.bids||[])[i]} — Hizo {(g.taken||[])[i]}</div>
                      </div>
                      <div style={{textAlign:'right'}}>
                        <div style={{fontSize:20,fontWeight:'bold',color:pts>=0?'#4ade80':'#f87171'}}>{pts>=0?'+':''}{pts}</div>
                        <div style={{fontSize:11,color:'rgba(255,255,255,.45)'}}>Total: {(g.sc||[])[i]||0}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{display:'flex',gap:8,justifyContent:'center',flexWrap:'wrap'}}>
                <button onClick={()=>setShowBoard(true)} style={{background:'rgba(255,255,255,.1)',color:'#fff',border:'1px solid rgba(255,255,255,.25)',borderRadius:8,padding:'9px 14px',fontSize:13,cursor:'pointer'}}>📋 Pizarra</button>
                {trickLog.length>0&&<button onClick={()=>setShowTrickLog(true)} style={{background:'rgba(255,255,255,.1)',color:'#fff',border:'1px solid rgba(255,255,255,.25)',borderRadius:8,padding:'9px 14px',fontSize:13,cursor:'pointer'}}>🃏 Ver bazas</button>}
                {g.isHost
                  ?<button onClick={()=>emit('next_round',{roomCode:g.roomCode})} style={{background:'#16a34a',color:'#fff',border:'none',borderRadius:8,padding:'9px 20px',fontSize:14,cursor:'pointer',fontWeight:'bold'}}>
                    {(g.ri||0)+1>=(g.rs?.length||1)-1?'Resultado final →':'Siguiente ronda →'}
                  </button>
                  :<span style={{color:'rgba(255,255,255,.5)',fontSize:13,alignSelf:'center'}}>Esperando al host...</span>
                }
              </div>
            </div>
          </div>
        )}

        {/* Game end */}
        {g.phase==='gend'&&(
          <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.8)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:10}}>
            <div style={{background:'#166534',border:'2px solid #fbbf24',borderRadius:14,padding:28,minWidth:300,textAlign:'center',maxWidth:380,width:'100%'}}>
              <div style={{fontSize:44,lineHeight:1}}>🏆</div>
              <h2 style={{margin:'8px 0',fontSize:24,fontWeight:500}}>¡Fin del juego!</h2>
              {(()=>{const mx=Math.max(...(g.sc||[0]));const wi=(g.sc||[]).findIndex(s=>s===mx);return <p style={{color:'#fbbf24',fontSize:16,margin:'0 0 14px'}}>{wi===g.yourIndex?'¡Ganaste!':`Ganó ${(players[wi]||{}).name}`} con {mx} puntos</p>;})()}
              <table style={{margin:'0 auto 16px',borderCollapse:'collapse',width:'100%',fontSize:14}}>
                <tbody>
                  {[...(g.sc||[]).map((s,i)=>({i,s}))].sort((a,b)=>b.s-a.s).map(({i,s},pos)=>(
                    <tr key={i} style={{background:i===g.yourIndex?'rgba(255,255,255,.1)':undefined}}>
                      <td style={{padding:'5px 12px',textAlign:'left',color:pos===0?'#fbbf24':'inherit'}}>{pos===0?'🥇 ':pos===1?'🥈 ':pos===2?'🥉 ':''}{(players[i]||{}).name}</td>
                      <td style={{padding:'5px 12px',fontWeight:'bold',fontSize:20,color:pos===0?'#fbbf24':'inherit'}}>{s}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{display:'flex',gap:10,justifyContent:'center',flexWrap:'wrap'}}>
                <button onClick={()=>setShowBoard(true)} style={{background:'rgba(255,255,255,.12)',color:'#fff',border:'1px solid rgba(255,255,255,.3)',borderRadius:8,padding:'10px 16px',fontSize:13,cursor:'pointer'}}>📋 Pizarra</button>
                <button onClick={()=>{localStorage.removeItem('basas_room');window.location.reload();}} style={{background:'#16a34a',color:'#fff',border:'none',borderRadius:8,padding:'10px 18px',fontSize:13,cursor:'pointer',fontWeight:'bold'}}>Nueva partida</button>
              </div>
            </div>
          </div>
        )}

        {showBoard&&<Scoreboard history={g.history||[]} players={players} sc={g.sc||[]} scoring={g.scoring} onClose={()=>setShowBoard(false)}/>}
        {showTrickLog&&trickLog.length>0&&<TrickLog trickLog={trickLog} players={players} onClose={()=>setShowTrickLog(false)} onlyLast={g.phase==='play'}/>}
      </div>
    );
  }

  return <div style={{...gs,justifyContent:'center'}}><div style={{color:'#86efac'}}>Conectando...</div></div>;
}
