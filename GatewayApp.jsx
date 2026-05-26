import { useState, useRef, useEffect, useCallback } from "react";
import {
  Play, Pause, RotateCcw, Brain, Zap, Sparkles, Volume2, VolumeX,
  ChevronRight, Wind, Clock, Flame, History, SkipForward, Square,
} from "lucide-react";

/* ============================================================================
   CONSTANTS
   ============================================================================ */
const ACCENT  = "#22d3ee";
const ACCENT2 = "#818cf8";
const GRAD    = "linear-gradient(135deg, #22d3ee 0%, #818cf8 100%)";
const TOTAL   = 30 * 60; // 1800s

const STAGES = [
  { id:"box",     name:"The Box",    duration:8*60, color:"#818cf8", glow:"rgba(129,140,248,0.45)", icon:"◻", label:"Clear the field",      instruction:"Visualize a heavy, sealed box. Place every thought, every worry from today inside it. Lock it shut." },
  { id:"saber",   name:"The Saber",  duration:8*60, color:"#22d3ee", glow:"rgba(34,211,238,0.45)",  icon:"⟁", label:"Build your energy",     instruction:"A point of light expands into a glowing saber. Feel it rotate around your body, shifting electric blue to radiant green." },
  { id:"pattern", name:"Patterning", duration:8*60, color:"#fbbf24", glow:"rgba(251,191,36,0.45)",  icon:"◎", label:"Project your intent",   instruction:"See yourself right now achieving exactly what you want. Flood the scene with full emotion. Then release it completely." },
  { id:"float",   name:"Free Float", duration:6*60, color:"#a78bfa", glow:"rgba(167,139,250,0.45)", icon:"∿", label:"Surrender to the field", instruction:"Release all control. Drift inside the 4Hz. Let the synchronization do its work." },
];

// Breathing phases: Inhale 4s, Hold 4s, Exhale 6s, Hold 2s = 16s/cycle
const BREATH_CYCLE = 16;
const BREATH_PHASES = [
  { name:"Inhale",  start:0,  end:4,  color:ACCENT,   targetScale:1.55 },
  { name:"Hold",    start:4,  end:8,  color:"#fbbf24", targetScale:1.55 },
  { name:"Exhale",  start:8,  end:14, color:ACCENT2,   targetScale:1.0  },
  { name:"Hold",    start:14, end:16, color:"#475569", targetScale:1.0  },
];
const BREATH_DURATION = 2 * 60; // 2 min

function getBreathPhase(sec) {
  const t = sec % BREATH_CYCLE;
  const phase = BREATH_PHASES.find(p => t >= p.start && t < p.end) || BREATH_PHASES[0];
  const localT = (t - phase.start) / (phase.end - phase.start);
  const prev = BREATH_PHASES[(BREATH_PHASES.indexOf(phase) - 1 + 4) % 4];
  const fromScale = prev.targetScale;
  const toScale = phase.targetScale;
  const scale = fromScale + (toScale - fromScale) * easeInOut(localT);
  return { phase, scale, localT };
}

function easeInOut(t) { return t < 0.5 ? 2*t*t : -1+(4-2*t)*t; }

function getStageIndex(e) {
  let acc = 0;
  for (let i = 0; i < STAGES.length; i++) { acc += STAGES[i].duration; if (e < acc) return i; }
  return STAGES.length - 1;
}

function getStageElapsed(e) {
  let acc = 0;
  for (let i = 0; i < STAGES.length; i++) {
    if (e < acc + STAGES[i].duration) return e - acc;
    acc += STAGES[i].duration;
  }
  return STAGES[STAGES.length-1].duration;
}

const fmt = (s) => `${String(Math.floor(s/60)).padStart(2,"0")}:${String(Math.floor(s%60)).padStart(2,"0")}`;
const fmtDate = (iso) => { const d=new Date(iso); return d.toLocaleDateString("en-US",{month:"short",day:"numeric"}); };
const toRGBA = (hex, a) => { const h=hex.replace("#",""); return `rgba(${parseInt(h.slice(0,2),16)},${parseInt(h.slice(2,4),16)},${parseInt(h.slice(4,6),16)},${a})`; };
const todayKey = () => new Date().toISOString().slice(0,10);

/* ============================================================================
   CANVAS RENDERERS
   ============================================================================ */
function drawBg(ctx, t, W, H) {
  ctx.fillStyle = "#03020c"; ctx.fillRect(0,0,W,H);
  for (let i=0; i<90; i++) {
    const s=i*997.31, x=((Math.sin(s*0.1)*0.5+0.5))*W, y=((Math.sin(s*0.23)*0.5+0.5))*H;
    const tw=0.1+0.2*Math.sin(t*1.3+s), sz=0.4+0.5*((i%3)/3);
    ctx.beginPath(); ctx.arc(x,y,sz,0,Math.PI*2); ctx.fillStyle=`rgba(255,255,255,${tw})`; ctx.fill();
  }
}
function drawBox(ctx,t,W,H) {
  const cx=W/2,cy=H/2,S=Math.min(W,H)*0.2,ay=t*0.38,ax=0.32;
  const proj=(x,y,z)=>{let rx=x*Math.cos(ay)+z*Math.sin(ay),rz=-x*Math.sin(ay)+z*Math.cos(ay),ry=y*Math.cos(ax)-rz*Math.sin(ax);return[cx+rx*S,cy+ry*S];};
  const v=[proj(-1,-1,-1),proj(1,-1,-1),proj(1,1,-1),proj(-1,1,-1),proj(-1,-1,1),proj(1,-1,1),proj(1,1,1),proj(-1,1,1)];
  const edges=[[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];
  const pulse=0.55+0.45*Math.sin(t*4*Math.PI*2);
  ctx.save(); ctx.shadowColor="#818cf8"; ctx.shadowBlur=18*pulse;
  ctx.strokeStyle=`rgba(129,140,248,${0.55+0.35*pulse})`; ctx.lineWidth=1.5;
  edges.forEach(([a,b])=>{ctx.beginPath();ctx.moveTo(v[a][0],v[a][1]);ctx.lineTo(v[b][0],v[b][1]);ctx.stroke();});
  ctx.restore();
  for(let i=0;i<18;i++){const sd=i*137.5,pct=((t*0.12+i*0.055)%1),th=sd*2.618,r=S*2.2*(1-pct),px=cx+r*Math.cos(th),py=cy+r*Math.sin(th)*0.6;ctx.beginPath();ctx.arc(px,py,1.5,0,Math.PI*2);ctx.fillStyle=`rgba(167,140,255,${pct*0.5})`;ctx.fill();}
}
function drawSaber(ctx,t,W,H) {
  const cx=W/2,cy=H/2,orbitR=Math.min(W,H)*0.08,ang=t*0.7,sx=cx+orbitR*Math.sin(ang),sy=cy-orbitR*Math.cos(ang)*0.4,sH=Math.min(W,H)*0.28;
  const cp=(Math.sin(t*0.4)+1)/2,cr=Math.round(34*(1-cp)+10*cp),cg=Math.round(211*(1-cp)+180*cp),cb=Math.round(238*(1-cp)+80*cp),sc=`rgb(${cr},${cg},${cb})`;
  for(let i=0;i<4;i++){const ph=((t*4+i*0.25)%1),rr=ph*Math.min(W,H)*0.38;ctx.beginPath();ctx.arc(cx,cy,rr,0,Math.PI*2);ctx.strokeStyle=`rgba(${cr},${cg},${cb},${(1-ph)*0.22})`;ctx.lineWidth=1.2;ctx.stroke();}
  for(let i=5;i>=1;i--){ctx.beginPath();ctx.ellipse(sx,sy,3+i*5,sH/2+i*3,0,0,Math.PI*2);ctx.fillStyle=`rgba(${cr},${cg},${cb},${0.03*i})`;ctx.fill();}
  ctx.save();ctx.shadowColor=sc;ctx.shadowBlur=22;ctx.beginPath();ctx.ellipse(sx,sy,2.5,sH/2,0,0,Math.PI*2);ctx.fillStyle="rgba(255,255,255,0.92)";ctx.fill();ctx.restore();
  for(let i=1;i<=8;i++){const ta=ang-i*0.09,tx=cx+orbitR*Math.sin(ta),ty=cy-orbitR*Math.cos(ta)*0.4;ctx.beginPath();ctx.ellipse(tx,ty,1.5,sH*0.3,0,0,Math.PI*2);ctx.fillStyle=`rgba(${cr},${cg},${cb},${0.1*(1-i/9)})`;ctx.fill();}
}
function drawPatterning(ctx,t,W,H) {
  const cx=W/2,cy=H/2,maxR=Math.min(W,H)*0.42;
  for(let i=0;i<5;i++){const ph=((t*0.45+i*0.2)%1),rr=ph*maxR;ctx.beginPath();ctx.arc(cx,cy,rr,0,Math.PI*2);ctx.strokeStyle=`rgba(251,191,36,${(1-ph)*0.45})`;ctx.lineWidth=1.8;ctx.stroke();if(rr>15){ctx.beginPath();ctx.arc(cx,cy,rr*0.65,0,Math.PI*2);ctx.strokeStyle=`rgba(251,191,36,${(1-ph)*0.2})`;ctx.lineWidth=1;ctx.stroke();}}
  const og=ctx.createRadialGradient(cx,cy,0,cx,cy,maxR*0.6);og.addColorStop(0,"rgba(251,191,36,0.06)");og.addColorStop(1,"rgba(251,191,36,0)");ctx.fillStyle=og;ctx.fillRect(0,0,W,H);
  const cp=0.55+0.45*Math.sin(t*4*Math.PI*2);ctx.save();ctx.shadowColor="#fbbf24";ctx.shadowBlur=28*cp;ctx.beginPath();ctx.arc(cx,cy,7*cp,0,Math.PI*2);ctx.fillStyle=`rgba(251,191,36,${0.85*cp})`;ctx.fill();ctx.restore();
}
function drawFloat(ctx,t,W,H) {
  for(let i=0;i<160;i++){const s=i*137.5,bx=(Math.sin(s*0.1+0.3)*0.5+0.5),by=(Math.sin(s*0.23+0.7)*0.5+0.5),dx=Math.sin(t*0.04+s)*0.008,dy=Math.cos(t*0.03+s)*0.008,x=((bx+dx+1)%1)*W,y=((by+dy+1)%1)*H,tw=0.1+0.3*Math.sin(t*0.6+s*0.5),sz=0.4+1.2*((i%4)/4);ctx.beginPath();ctx.arc(x,y,sz,0,Math.PI*2);ctx.fillStyle=`rgba(255,255,255,${tw})`;ctx.fill();}
  [{x:0.3,y:0.35,c:"129,140,248"},{x:0.7,y:0.6,c:"34,211,238"},{x:0.5,y:0.25,c:"167,139,250"},{x:0.2,y:0.7,c:"52,211,153"}].forEach(({x,y,c})=>{const a=0.018+0.008*Math.sin(t*0.09+x*8),gr=ctx.createRadialGradient(x*W,y*H,0,x*W,y*H,W*0.28);gr.addColorStop(0,`rgba(${c},${a})`);gr.addColorStop(1,`rgba(${c},0)`);ctx.fillStyle=gr;ctx.fillRect(0,0,W,H);});
}

/* ============================================================================
   GLASS BUTTON
   ============================================================================ */
function GlassButton({children,onClick,color=ACCENT,variant="ghost",size="md",disabled,style}) {
  const [hover,setHover]=useState(false),[press,setPress]=useState(false);
  const pad=size==="lg"?"16px 34px":size==="sm"?"7px 14px":"11px 22px";
  const fs=size==="lg"?15:size==="sm"?11:13;
  const bg=variant==="primary"?(hover?`linear-gradient(135deg,${toRGBA(color,0.30)} 0%,${toRGBA(color,0.13)} 100%)`:`linear-gradient(135deg,${toRGBA(color,0.22)} 0%,${toRGBA(color,0.08)} 100%)`):(hover?"linear-gradient(135deg,rgba(255,255,255,0.13) 0%,rgba(255,255,255,0.05) 100%)":"linear-gradient(135deg,rgba(255,255,255,0.07) 0%,rgba(255,255,255,0.02) 100%)");
  return(
    <button onClick={onClick} disabled={disabled} onMouseEnter={()=>!disabled&&setHover(true)} onMouseLeave={()=>{setHover(false);setPress(false);}} onMouseDown={()=>!disabled&&setPress(true)} onMouseUp={()=>setPress(false)} className="liquid-rim"
      style={{padding:pad,fontSize:fs,fontWeight:600,fontFamily:"inherit",background:bg,border:`1px solid ${variant==="primary"?toRGBA(color,hover?0.6:0.4):`rgba(255,255,255,${hover?0.2:0.12})`}`,color:variant==="primary"?color:"#e2e8f0",borderRadius:16,cursor:disabled?"not-allowed":"pointer",opacity:disabled?0.4:1,display:"inline-flex",alignItems:"center",justifyContent:"center",gap:8,transition:"all 0.22s cubic-bezier(0.4,0,0.2,1)",backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",boxShadow:hover?`inset 0 1px 0 rgba(255,255,255,0.18),0 12px 36px ${variant==="primary"?toRGBA(color,0.28):"rgba(0,0,0,0.3)"}`:  "inset 0 1px 0 rgba(255,255,255,0.1),0 4px 16px rgba(0,0,0,0.25)",transform:press?"scale(0.96)":hover&&!disabled?"translateY(-2px)":"translateY(0)",whiteSpace:"nowrap",letterSpacing:0.2,...style}}>
      {children}
    </button>
  );
}

/* ============================================================================
   MAIN APP
   ============================================================================ */
export default function GatewayApp() {
  // phase: idle | breath | active | paused | done
  const [phase,   setPhase]   = useState("idle");
  const [elapsed, setElapsed] = useState(0);
  const [breathSec, setBreathSec] = useState(0);
  const [volume,  setVolume]  = useState(0.2);
  const [muted,   setMuted]   = useState(false);
  const [quality, setQuality] = useState(0);
  const [note,    setNote]    = useState("");
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  const canvasRef  = useRef(null);
  const audioRef   = useRef(null);
  const timerRef   = useRef(null);
  const breathRef  = useRef(null);
  const startRef   = useRef(null);

  /* ── Storage ────────────────────────────────────────────────────────────── */
  useEffect(() => {
    (async()=>{
      try {
        const r = await window.storage?.get("gateway:v2").catch(()=>null);
        if(r?.value){const d=JSON.parse(r.value);if(d.history)setHistory(d.history);if(d.volume)setVolume(d.volume);}
      } catch(e){}
    })();
  },[]);

  const persist = useCallback((h, v)=>{
    try{window.storage?.set("gateway:v2",JSON.stringify({history:h,volume:v})).catch(()=>{});}catch(e){}
  },[]);

  /* ── Canvas loop ────────────────────────────────────────────────────────── */
  useEffect(()=>{
    const canvas=canvasRef.current; if(!canvas)return;
    let id;
    const loop=(ts)=>{
      const t=ts/1000,W=canvas.width,H=canvas.height,ctx=canvas.getContext("2d");
      drawBg(ctx,t,W,H);
      if(phase==="active"||phase==="paused"||phase==="done"){
        const si=getStageIndex(elapsed);
        if(si===0)drawBox(ctx,t,W,H); else if(si===1)drawSaber(ctx,t,W,H);
        else if(si===2)drawPatterning(ctx,t,W,H); else drawFloat(ctx,t,W,H);
      } else {
        drawSaber(ctx,t*0.4,W,H);
      }
      id=requestAnimationFrame(loop);
    };
    id=requestAnimationFrame(loop);
    return()=>cancelAnimationFrame(id);
  },[phase,elapsed]);

  /* ── Audio ──────────────────────────────────────────────────────────────── */
  const createAudio = useCallback((vol)=>{
    try{
      const ctx=new(window.AudioContext||window.webkitAudioContext)();
      const gain=ctx.createGain(); gain.gain.value=0;
      const oscL=ctx.createOscillator(),oscR=ctx.createOscillator();
      oscL.type="sine";oscL.frequency.value=170;oscR.type="sine";oscR.frequency.value=174;
      const pL=ctx.createStereoPanner(),pR=ctx.createStereoPanner();
      pL.pan.value=-1;pR.pan.value=1;
      oscL.connect(pL);pL.connect(gain);oscR.connect(pR);pR.connect(gain);gain.connect(ctx.destination);
      oscL.start();oscR.start();
      gain.gain.setValueAtTime(0,ctx.currentTime);
      gain.gain.linearRampToValueAtTime(vol,ctx.currentTime+2.5);
      audioRef.current={
        ctx,gain,oscL,oscR,
        pause:()=>{gain.gain.cancelScheduledValues(ctx.currentTime);gain.gain.setValueAtTime(gain.gain.value,ctx.currentTime);gain.gain.linearRampToValueAtTime(0,ctx.currentTime+0.6);},
        resume:(v)=>{ctx.resume().catch(()=>{});gain.gain.cancelScheduledValues(ctx.currentTime);gain.gain.setValueAtTime(gain.gain.value,ctx.currentTime);gain.gain.linearRampToValueAtTime(v||0.2,ctx.currentTime+1.5);},
        setVol:(v)=>{gain.gain.cancelScheduledValues(ctx.currentTime);gain.gain.setValueAtTime(gain.gain.value,ctx.currentTime);gain.gain.linearRampToValueAtTime(v,ctx.currentTime+0.5);},
        stop:()=>{gain.gain.linearRampToValueAtTime(0,ctx.currentTime+1.5);setTimeout(()=>{try{oscL.stop();oscR.stop();ctx.close();}catch(e){}},1600);},
      };
    }catch(e){}
  },[]);

  /* ── Breathwork ─────────────────────────────────────────────────────────── */
  const startBreathwork = useCallback(()=>{
    setBreathSec(0); setPhase("breath");
    breathRef.current=setInterval(()=>{
      setBreathSec(s=>{
        if(s>=BREATH_DURATION-1){clearInterval(breathRef.current);launchSession();return 0;}
        return s+1;
      });
    },1000);
  },[]);

  const skipBreath = useCallback(()=>{
    clearInterval(breathRef.current); setBreathSec(0); launchSession();
  },[]);

  /* ── Session ────────────────────────────────────────────────────────────── */
  const launchSession = useCallback(()=>{
    createAudio(volume);
    setPhase("active"); startRef.current=Date.now()-elapsed*1000;
    timerRef.current=setInterval(()=>{
      const e=Math.floor((Date.now()-startRef.current)/1000);
      setElapsed(e);
      if(e>=TOTAL){clearInterval(timerRef.current);audioRef.current?.stop();setPhase("done");}
    },400);
  },[volume,elapsed,createAudio]);

  const pauseSession = useCallback(()=>{
    clearInterval(timerRef.current);
    audioRef.current?.pause();
    setPhase("paused");
  },[]);

  const resumeSession = useCallback(()=>{
    startRef.current=Date.now()-elapsed*1000;
    audioRef.current?.resume(muted?0:volume);
    setPhase("active");
    timerRef.current=setInterval(()=>{
      const e=Math.floor((Date.now()-startRef.current)/1000);
      setElapsed(e);
      if(e>=TOTAL){clearInterval(timerRef.current);audioRef.current?.stop();setPhase("done");}
    },400);
  },[elapsed,volume,muted]);

  const resetSession = useCallback(()=>{
    clearInterval(timerRef.current);clearInterval(breathRef.current);
    audioRef.current?.stop();audioRef.current=null;
    setPhase("idle");setElapsed(0);setBreathSec(0);
  },[]);

  const toggleMute = useCallback(()=>{
    setMuted(m=>{
      const next=!m;
      audioRef.current?.setVol(next?0:volume);
      return next;
    });
  },[volume]);

  const handleVolumeChange = useCallback((v)=>{
    setVolume(v);
    if(!muted) audioRef.current?.setVol(v);
    persist(history,v);
  },[muted,history,persist]);

  /* ── Save session ───────────────────────────────────────────────────────── */
  const saveSession = useCallback(()=>{
    const entry={date:todayKey(),quality,note,duration:elapsed};
    const h=[entry,...history].slice(0,30);
    setHistory(h); persist(h,volume);
    resetSession(); setQuality(0); setNote("");
  },[quality,note,elapsed,history,volume,persist,resetSession]);

  /* ── Derived ────────────────────────────────────────────────────────────── */
  const stageIdx    = getStageIndex(elapsed);
  const stage       = STAGES[stageIdx];
  const timeLeft    = Math.max(0,TOTAL-elapsed);
  const stagePct    = getStageElapsed(elapsed)/stage.duration;
  const totalPct    = elapsed/TOTAL;
  const { phase:bp, scale:breathScale } = getBreathPhase(breathSec);
  const streak      = (()=>{ let s=0,d=new Date(); d.setHours(0,0,0,0); while(history.some(h=>h.date===d.toISOString().slice(0,10))){s++;d.setDate(d.getDate()-1);} return s; })();

  /* ============================================================================
     RENDER
     ============================================================================ */
  return(
    <div style={{minHeight:"100vh",background:"#03020c",color:"#f1f5f9",fontFamily:"'Sora',sans-serif",display:"flex",flexDirection:"column",alignItems:"center",overflow:"hidden",position:"relative"}}>
      <link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
      <div style={{position:"fixed",inset:0,pointerEvents:"none",background:`radial-gradient(ellipse 60% 45% at 50% -5%,rgba(34,211,238,0.08) 0%,transparent 55%),radial-gradient(ellipse 50% 40% at 90% 100%,rgba(129,140,248,0.09) 0%,transparent 55%)`}}/>
      <canvas ref={canvasRef} width={600} height={600} style={{position:"fixed",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:"min(600px,100vw)",height:"min(600px,100vw)",opacity:phase==="active"||phase==="paused"?0.95:0.45,transition:"opacity 1.5s",pointerEvents:"none",zIndex:0}}/>

      {/* ── IDLE ─────────────────────────────────────────────────────────── */}
      {phase==="idle"&&(
        <div style={{position:"relative",zIndex:1,width:"100%",maxWidth:520,padding:"36px 22px 48px",display:"flex",flexDirection:"column",alignItems:"center",animation:"fadeUp 0.6s ease"}}>
          <div style={{width:54,height:54,borderRadius:15,background:GRAD,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:`0 0 28px ${ACCENT}45,inset 0 1px 0 rgba(255,255,255,0.2)`,marginBottom:16}}>
            <Brain size={25} color="#fff"/>
          </div>
          <h1 style={{margin:"0 0 5px",fontSize:36,fontWeight:800,letterSpacing:"-1.5px",background:GRAD,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>GATEWAY</h1>
          <p style={{margin:"0 0 28px",fontSize:12,color:"#64748b",fontWeight:500,letterSpacing:2.5,textTransform:"uppercase"}}>Hemispheric Synchronization · 30 min</p>

          {/* Stats */}
          {history.length>0&&(
            <div style={{display:"flex",gap:10,marginBottom:24,width:"100%",justifyContent:"center"}}>
              {[{label:"Sessions",value:history.length,icon:Zap,color:ACCENT},{label:"Streak",value:`${streak}d`,icon:Flame,color:"#fbbf24"}].map(s=>(
                <div key={s.label} className="liquid-rim" style={{flex:1,maxWidth:110,padding:"11px 14px",background:"linear-gradient(135deg,rgba(255,255,255,0.05) 0%,rgba(255,255,255,0.01) 100%)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:14,backdropFilter:"blur(20px)",textAlign:"center"}}>
                  <s.icon size={13} color={s.color} style={{display:"block",margin:"0 auto 4px"}}/>
                  <p style={{margin:0,fontSize:18,fontWeight:800,color:"#f1f5f9",letterSpacing:"-0.5px"}}>{s.value}</p>
                  <p style={{margin:"2px 0 0",fontSize:10,color:"#64748b",fontWeight:500}}>{s.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Stage list */}
          <div style={{width:"100%",display:"flex",flexDirection:"column",gap:7,marginBottom:24}}>
            {STAGES.map((s,i)=>(
              <div key={s.id} className="liquid-rim" style={{display:"flex",alignItems:"center",gap:13,padding:"12px 15px",background:"linear-gradient(135deg,rgba(255,255,255,0.04) 0%,rgba(255,255,255,0.01) 100%)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:13,backdropFilter:"blur(20px)"}}>
                <div style={{width:34,height:34,borderRadius:9,background:toRGBA(s.color,0.14),border:`1px solid ${toRGBA(s.color,0.28)}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  <span style={{color:s.color,fontSize:15,fontWeight:700}}>{s.icon}</span>
                </div>
                <div style={{flex:1}}>
                  <p style={{margin:0,fontSize:13,fontWeight:700,color:"#f1f5f9"}}>{s.name}</p>
                  <p style={{margin:"1px 0 0",fontSize:11,color:"#64748b"}}>{s.label}</p>
                </div>
                <span style={{fontSize:11,color:"#475569",fontWeight:500}}>{s.duration/60} min</span>
              </div>
            ))}
          </div>

          {/* Volume */}
          <div className="liquid-rim" style={{width:"100%",padding:"14px 16px",background:"linear-gradient(135deg,rgba(255,255,255,0.04) 0%,rgba(255,255,255,0.01) 100%)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:13,backdropFilter:"blur(20px)",marginBottom:24}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
              <div style={{display:"flex",alignItems:"center",gap:7}}>
                <Volume2 size={13} color="#64748b"/>
                <span style={{fontSize:12,color:"#64748b",fontWeight:500}}>Volume</span>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:11,color:Math.abs(volume-0.2)<0.02?ACCENT:"#64748b",fontWeight:600,transition:"color 0.3s"}}>{Math.abs(volume-0.2)<0.02?"✓ Recommended":""}</span>
                <span style={{fontSize:12,color:"#94a3b8",fontWeight:600}}>{Math.round(volume*100)}%</span>
              </div>
            </div>
            <div style={{position:"relative",height:4,background:"rgba(255,255,255,0.08)",borderRadius:99,cursor:"pointer"}}>
              <div style={{width:`${(volume/0.4)*100}%`,height:"100%",background:GRAD,borderRadius:99,transition:"width 0.1s"}}/>
              {/* 20% marker */}
              <div style={{position:"absolute",left:"50%",top:-3,width:2,height:10,background:toRGBA(ACCENT,0.5),borderRadius:99}}/>
              <input type="range" min={2} max={40} value={Math.round(volume*100)} onChange={e=>handleVolumeChange(Number(e.target.value)/100)}
                style={{position:"absolute",inset:0,opacity:0,cursor:"pointer",width:"100%",height:"100%",margin:0}}/>
            </div>
            <p style={{margin:"6px 0 0",fontSize:10,color:"#334155"}}>20% recommended · keep low for optimal synchronization</p>
          </div>

          {/* Start buttons */}
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:12,width:"100%"}}>
            <div style={{position:"relative"}}>
              <div style={{position:"absolute",inset:-18,borderRadius:999,border:`1px solid ${toRGBA(ACCENT,0.25)}`,animation:"hz4 0.25s ease-in-out infinite",pointerEvents:"none"}}/>
              <div style={{position:"absolute",inset:-9,borderRadius:999,border:`1px solid ${toRGBA(ACCENT,0.15)}`,animation:"hz4 0.25s ease-in-out infinite 0.08s",pointerEvents:"none"}}/>
              <GlassButton variant="primary" color={ACCENT} size="lg" onClick={startBreathwork}
                style={{paddingLeft:44,paddingRight:44,fontSize:16,borderRadius:999,boxShadow:`0 0 32px ${toRGBA(ACCENT,0.3)},inset 0 1px 0 rgba(255,255,255,0.2)`}}>
                <Wind size={17}/> Breathwork + Session
              </GlassButton>
            </div>
            <GlassButton onClick={()=>{setElapsed(0);launchSession();}} style={{borderRadius:999,fontSize:12}}>
              <SkipForward size={13}/> Skip breathwork
            </GlassButton>
          </div>

          {/* History toggle */}
          {history.length>0&&(
            <div style={{marginTop:24,width:"100%"}}>
              <button onClick={()=>setShowHistory(h=>!h)} style={{width:"100%",background:"none",border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 0",fontFamily:"inherit"}}>
                <span style={{fontSize:12,color:"#64748b",fontWeight:600,display:"flex",alignItems:"center",gap:6}}><History size={13}/>Session History</span>
                <span style={{fontSize:11,color:"#475569",transform:showHistory?"rotate(90deg)":"rotate(0)",transition:"transform 0.2s",display:"inline-block"}}>›</span>
              </button>
              {showHistory&&(
                <div style={{display:"flex",flexDirection:"column",gap:6,marginTop:8,animation:"fadeUp 0.3s ease"}}>
                  {history.slice(0,7).map((s,i)=>(
                    <div key={i} className="liquid-rim" style={{padding:"10px 14px",background:"linear-gradient(135deg,rgba(255,255,255,0.03) 0%,rgba(255,255,255,0.01) 100%)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:11,backdropFilter:"blur(20px)"}}>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                        <span style={{fontSize:12,color:"#94a3b8",fontWeight:500}}>{fmtDate(s.date)}</span>
                        <div style={{display:"flex",gap:3}}>
                          {[1,2,3,4,5].map(n=><Zap key={n} size={11} color={n<=s.quality?"#fbbf24":"#1e293b"} fill={n<=s.quality?"#fbbf24":"none"}/>)}
                        </div>
                      </div>
                      {s.note&&<p style={{margin:"4px 0 0",fontSize:11,color:"#64748b",lineHeight:1.5}}>{s.note}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <p style={{marginTop:20,fontSize:10,color:"#1e293b",textAlign:"center",lineHeight:1.7}}>170 Hz left · 174 Hz right · 4 Hz binaural beat<br/>Use headphones at low volume</p>
        </div>
      )}

      {/* ── BREATHWORK ───────────────────────────────────────────────────── */}
      {phase==="breath"&&(
        <div style={{position:"relative",zIndex:1,maxWidth:420,width:"100%",padding:"40px 24px",display:"flex",flexDirection:"column",alignItems:"center",gap:28,animation:"fadeUp 0.5s ease"}}>
          <div>
            <h2 style={{margin:"0 0 4px",fontSize:22,fontWeight:800,textAlign:"center",letterSpacing:"-0.5px"}}>Box Breathing</h2>
            <p style={{margin:0,fontSize:13,color:"#64748b",textAlign:"center"}}>Activate the vagus nerve · lower cortisol · prepare for Focus 10</p>
          </div>

          {/* Breathing circle */}
          <div style={{position:"relative",width:200,height:200,display:"flex",alignItems:"center",justifyContent:"center"}}>
            {/* Outer glow */}
            <div style={{position:"absolute",inset:0,borderRadius:"50%",background:`radial-gradient(circle,${toRGBA(bp.color,0.06)} 0%,transparent 70%)`,transform:`scale(${breathScale*1.3})`,transition:"transform 0.3s ease,background 0.5s"}}/>
            {/* Ring */}
            <div style={{position:"absolute",inset:0,borderRadius:"50%",border:`2px solid ${toRGBA(bp.color,0.4)}`,transform:`scale(${breathScale})`,transition:"transform 0.3s ease, border-color 0.5s",boxShadow:`0 0 20px ${toRGBA(bp.color,0.3)}`}}/>
            {/* Inner */}
            <div style={{width:80,height:80,borderRadius:"50%",background:`radial-gradient(circle,${toRGBA(bp.color,0.25)},transparent)`,border:`1px solid ${toRGBA(bp.color,0.4)}`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",transform:`scale(${0.8+breathScale*0.2})`,transition:"transform 0.3s ease,background 0.5s"}}>
              <span style={{fontSize:13,fontWeight:700,color:bp.color,transition:"color 0.5s"}}>{bp.name}</span>
            </div>
          </div>

          {/* Timer + cycles */}
          <div style={{textAlign:"center"}}>
            <p style={{margin:"0 0 4px",fontSize:40,fontWeight:800,color:"#f1f5f9",letterSpacing:"-1px",fontVariantNumeric:"tabular-nums"}}>{fmt(BREATH_DURATION-breathSec)}</p>
            <p style={{margin:0,fontSize:11,color:"#475569",letterSpacing:1}}>REMAINING</p>
          </div>

          {/* Phase guide */}
          <div className="liquid-rim" style={{width:"100%",display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6,padding:"12px",background:"linear-gradient(135deg,rgba(255,255,255,0.04) 0%,rgba(255,255,255,0.01) 100%)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:13,backdropFilter:"blur(20px)"}}>
            {[{l:"Inhale",t:"4s",c:ACCENT},{l:"Hold",t:"4s",c:"#fbbf24"},{l:"Exhale",t:"6s",c:ACCENT2},{l:"Hold",t:"2s",c:"#475569"}].map((p,i)=>(
              <div key={i} style={{textAlign:"center",padding:"6px 4px",borderRadius:8,background:BREATH_PHASES[i]===bp?toRGBA(p.c,0.12):"transparent",border:`1px solid ${BREATH_PHASES[i]===bp?toRGBA(p.c,0.3):"transparent"}`,transition:"all 0.3s"}}>
                <p style={{margin:"0 0 2px",fontSize:10,fontWeight:700,color:BREATH_PHASES[i]===bp?p.c:"#475569"}}>{p.l}</p>
                <p style={{margin:0,fontSize:11,fontWeight:700,color:BREATH_PHASES[i]===bp?p.c:"#334155"}}>{p.t}</p>
              </div>
            ))}
          </div>

          <GlassButton onClick={skipBreath} style={{borderRadius:999,fontSize:12}}>
            <SkipForward size={13}/> Skip to session
          </GlassButton>
        </div>
      )}

      {/* ── ACTIVE / PAUSED ──────────────────────────────────────────────── */}
      {(phase==="active"||phase==="paused")&&(
        <div style={{position:"relative",zIndex:1,width:"100%",maxWidth:520,padding:"24px 22px",display:"flex",flexDirection:"column",alignItems:"center",minHeight:"100vh",animation:"fadeUp 0.5s ease"}}>

          {/* Top bar */}
          <div style={{width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:0}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              {phase==="active"
                ?<><div style={{width:7,height:7,borderRadius:"50%",background:ACCENT,animation:"pulse 1s infinite",boxShadow:`0 0 8px ${ACCENT}`}}/><span style={{fontSize:11,color:"#64748b",fontWeight:500,letterSpacing:1}}>LIVE · 170Hz / 174Hz</span></>
                :<><div style={{width:7,height:7,borderRadius:"50%",background:"#fbbf24"}}/><span style={{fontSize:11,color:"#fbbf24",fontWeight:600,letterSpacing:1}}>PAUSED</span></>
              }
            </div>
            <div style={{display:"flex",gap:7}}>
              <GlassButton size="sm" onClick={toggleMute}>
                {muted?<VolumeX size={13} color="#f87171"/>:<Volume2 size={13}/>}
              </GlassButton>
              <GlassButton size="sm" variant="primary" color="#f87171" onClick={resetSession}>
                <RotateCcw size={12}/> Reset
              </GlassButton>
            </div>
          </div>

          {/* Main visual area */}
          <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",width:"100%",gap:24,paddingTop:16,paddingBottom:16}}>

            {/* Timer orb */}
            <div style={{position:"relative",width:250,height:250}}>
              <div style={{position:"absolute",inset:-16,borderRadius:"50%",border:`1px solid ${toRGBA(stage.color,phase==="paused"?0.15:0.35)}`,animation:phase==="active"?"hz4 0.25s ease-in-out infinite":"none",pointerEvents:"none"}}/>
              <div style={{position:"absolute",inset:-7,borderRadius:"50%",border:`1px solid ${toRGBA(stage.color,phase==="paused"?0.1:0.2)}`,animation:phase==="active"?"hz4 0.25s ease-in-out infinite 0.06s":"none",pointerEvents:"none"}}/>
              <div style={{position:"absolute",inset:0,borderRadius:"50%",background:toRGBA(stage.color,0.05),backdropFilter:"blur(4px)",border:`1px solid ${toRGBA(stage.color,0.15)}`}}/>
              <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:6}}>
                <span style={{fontSize:50,fontWeight:800,color:"#fff",letterSpacing:"-2px",fontVariantNumeric:"tabular-nums",lineHeight:1,textShadow:`0 0 30px ${stage.color}`,opacity:phase==="paused"?0.5:1,transition:"opacity 0.3s"}}>
                  {fmt(timeLeft)}
                </span>
                <span style={{fontSize:10,color:stage.color,fontWeight:600,letterSpacing:2,textTransform:"uppercase",opacity:phase==="paused"?0.5:1}}>{stage.name}</span>
              </div>
            </div>

            {/* Play/Pause FAB */}
            <div style={{position:"relative"}}>
              {phase==="paused"&&<div style={{position:"absolute",inset:-14,borderRadius:999,border:`1px solid ${toRGBA(ACCENT,0.3)}`,animation:"hz4 0.25s ease-in-out infinite",pointerEvents:"none"}}/>}
              <GlassButton variant="primary" color={phase==="paused"?ACCENT:"#818cf8"} size="lg"
                onClick={phase==="active"?pauseSession:resumeSession}
                style={{borderRadius:999,paddingLeft:40,paddingRight:40,fontSize:15,boxShadow:phase==="paused"?`0 0 28px ${toRGBA(ACCENT,0.3)},inset 0 1px 0 rgba(255,255,255,0.2)`:undefined}}>
                {phase==="active"?<><Pause size={18}/> Pause</>:<><Play size={18} fill={ACCENT}/> Resume</>}
              </GlassButton>
            </div>

            {/* Stage instruction */}
            <div className="liquid-rim" style={{maxWidth:360,width:"100%",background:"linear-gradient(135deg,rgba(255,255,255,0.04) 0%,rgba(255,255,255,0.01) 100%)",border:`1px solid ${toRGBA(stage.color,0.18)}`,borderRadius:15,padding:"14px 17px",backdropFilter:"blur(20px)",textAlign:"center"}}>
              <p style={{margin:0,fontSize:12.5,color:"#94a3b8",lineHeight:1.7}}>{stage.instruction}</p>
            </div>

            {/* Overall progress bar */}
            <div style={{width:"100%",maxWidth:360}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                <span style={{fontSize:10,color:"#475569",fontWeight:500,letterSpacing:0.5}}>SESSION PROGRESS</span>
                <span style={{fontSize:10,color:"#475569",fontWeight:600}}>{Math.round(totalPct*100)}%</span>
              </div>
              <div style={{height:4,background:"rgba(255,255,255,0.07)",borderRadius:99,overflow:"hidden"}}>
                <div style={{width:`${totalPct*100}%`,height:"100%",background:GRAD,borderRadius:99,transition:"width 0.4s"}}/>
              </div>
            </div>

            {/* Stage dots */}
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              {STAGES.map((s,i)=>(
                <div key={s.id} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:5}}>
                  <div style={{width:i===stageIdx?28:7,height:7,borderRadius:99,background:i<stageIdx?toRGBA(s.color,0.6):i===stageIdx?s.color:"rgba(255,255,255,0.1)",transition:"all 0.5s",boxShadow:i===stageIdx?`0 0 10px ${s.color}`:"none"}}/>
                  {i===stageIdx&&<div style={{width:28,height:2,borderRadius:99,background:"rgba(255,255,255,0.06)"}}><div style={{width:`${stagePct*100}%`,height:"100%",background:s.color,borderRadius:99,transition:"width 0.4s"}}/></div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── DONE ─────────────────────────────────────────────────────────── */}
      {phase==="done"&&(
        <div style={{position:"relative",zIndex:1,maxWidth:460,width:"100%",padding:"44px 22px",display:"flex",flexDirection:"column",alignItems:"center",gap:22,animation:"fadeUp 0.6s ease"}}>
          <div style={{width:60,height:60,borderRadius:18,background:`linear-gradient(135deg,${toRGBA(ACCENT,0.2)},${toRGBA(ACCENT2,0.2)})`,border:`1px solid ${toRGBA(ACCENT,0.4)}`,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:`0 0 30px ${toRGBA(ACCENT,0.25)}`}}>
            <Sparkles size={26} color={ACCENT}/>
          </div>

          <div style={{textAlign:"center"}}>
            <h2 style={{margin:"0 0 8px",fontSize:26,fontWeight:800,letterSpacing:"-0.8px",background:GRAD,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>Session Complete</h2>
            <p style={{margin:0,fontSize:13,color:"#64748b",lineHeight:1.7}}>Your brain is synchronized.<br/>Cognitive clarity is now at peak.</p>
          </div>

          {/* Stats */}
          <div className="liquid-rim" style={{width:"100%",display:"grid",gridTemplateColumns:"1fr 1fr 1fr",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:16,overflow:"hidden",backdropFilter:"blur(20px)"}}>
            {[{l:"Duration",v:"30:00",c:ACCENT},{l:"Total",v:history.length+1,c:"#34d399"},{l:"Streak",v:`${streak+1}d`,c:"#fbbf24"}].map((s,i)=>(
              <div key={s.l} style={{padding:"16px 10px",textAlign:"center",borderRight:i<2?"1px solid rgba(255,255,255,0.06)":"none"}}>
                <p style={{margin:"0 0 3px",fontSize:20,fontWeight:800,color:s.c,letterSpacing:"-0.5px"}}>{s.v}</p>
                <p style={{margin:0,fontSize:10,color:"#475569",fontWeight:500}}>{s.l}</p>
              </div>
            ))}
          </div>

          {/* Quality rating */}
          <div className="liquid-rim" style={{width:"100%",padding:"16px",background:"linear-gradient(135deg,rgba(255,255,255,0.04) 0%,rgba(255,255,255,0.01) 100%)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:16,backdropFilter:"blur(20px)"}}>
            <p style={{margin:"0 0 12px",fontSize:12,color:"#64748b",fontWeight:500}}>How was your cognitive clarity post-session?</p>
            <div style={{display:"flex",gap:10,marginBottom:14}}>
              {[1,2,3,4,5].map(n=>(
                <button key={n} onClick={()=>setQuality(n)}
                  style={{flex:1,padding:"10px 4px",background:n<=quality?toRGBA("#fbbf24",0.15):"rgba(255,255,255,0.03)",border:`1px solid ${n<=quality?"rgba(251,191,36,0.4)":"rgba(255,255,255,0.07)"}`,borderRadius:10,cursor:"pointer",transition:"all 0.2s",display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                  <Zap size={16} color={n<=quality?"#fbbf24":"#334155"} fill={n<=quality?"#fbbf24":"none"}/>
                  <span style={{fontSize:9,color:n<=quality?"#fbbf24":"#334155",fontWeight:600}}>{n===1?"Low":n===5?"Peak":""}</span>
                </button>
              ))}
            </div>
            <textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Optional note... (how did you feel? what appeared?)"
              style={{width:"100%",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:10,padding:"10px 12px",color:"#e2e8f0",fontSize:12,fontFamily:"inherit",resize:"none",height:64,outline:"none",lineHeight:1.6}}/>
          </div>

          <div style={{display:"flex",gap:10,width:"100%"}}>
            <GlassButton onClick={()=>{setPhase("idle");setElapsed(0);setQuality(0);setNote("");}} style={{flex:1,justifyContent:"center",borderRadius:12}}>
              Skip
            </GlassButton>
            <GlassButton variant="primary" color={ACCENT} onClick={saveSession} style={{flex:2,justifyContent:"center",borderRadius:12}}>
              <Zap size={14}/> Save & Finish
            </GlassButton>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeUp{from{opacity:0;transform:translateY(20px);}to{opacity:1;transform:translateY(0);}}
        @keyframes pulse{0%,100%{opacity:1;}50%{opacity:0.4;}}
        @keyframes hz4{0%,100%{opacity:0.15;transform:scale(1.0);}50%{opacity:0.55;transform:scale(1.04);}}
        *{box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
        body{margin:0;}
        ::-webkit-scrollbar{width:4px;}
        ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.12);border-radius:4px;}
        .liquid-rim{position:relative;}
        .liquid-rim::before{content:"";position:absolute;inset:0;padding:1.2px;border-radius:inherit;background:linear-gradient(180deg,rgba(255,255,255,0.48) 0%,rgba(255,255,255,0.13) 22%,transparent 45%,transparent 55%,rgba(255,255,255,0.13) 78%,rgba(255,255,255,0.42) 100%);-webkit-mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0);-webkit-mask-composite:xor;mask-composite:exclude;pointer-events:none;}
        button{touch-action:manipulation;}
        input[type=range]{-webkit-appearance:none;appearance:none;}
        textarea::placeholder{color:#334155;}
      `}</style>
    </div>
  );
}
