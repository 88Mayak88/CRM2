import { useState, useEffect, useRef } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, setDoc, deleteDoc, doc, orderBy, query } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDtaJluedup1Ojwmqg-WTyf9ySok58mlVE",
  authDomain: "crm-mayak.firebaseapp.com",
  projectId: "crm-mayak",
  storageBucket: "crm-mayak.firebasestorage.app",
  messagingSenderId: "395172759951",
  appId: "1:395172759951:web:8493ddea5b6ac54c13e3fa",
};
const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);
const COL = "events";

async function dbLoad() {
  const q = query(collection(db, COL), orderBy("date", "asc"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
async function dbUpsert(ev) { await setDoc(doc(db, COL, ev.id), ev); }
async function dbDelete(id) { await deleteDoc(doc(db, COL, id)); }

// ── helpers ──
const SOURCE_OPTIONS = ["Авито","Instagram","ВКонтакте","Сарафан","Telegram","TikTok","Другое"];
const MONTHS_RU    = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];
const MONTHS_SHORT = ["Янв","Фев","Мар","Апр","Май","Июн","Июл","Авг","Сен","Окт","Ноя","Дек"];
const DAYS_SHORT   = ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];

function formatPhone(val) {
  const d=val.replace(/\D/g,"").slice(0,11); if(!d) return "";
  let r="+7";
  if(d.length>1) r+=" ("+d.slice(1,4);
  if(d.length>=4) r+=") "+d.slice(4,7);
  if(d.length>=7) r+="-"+d.slice(7,9);
  if(d.length>=9) r+="-"+d.slice(9,11);
  return r;
}
function formatMoney(val) { const n=val.replace(/\D/g,""); return n?n.replace(/\B(?=(\d{3})+(?!\d))/g," "):""; }
function parseMoney(str)  { return parseInt((str||"").replace(/\s/g,""),10)||0; }
function remaining(ev)    { return parseMoney(ev.totalCost)-parseMoney(ev.paidCost); }
function profit(ev)       { return parseMoney(ev.totalCost)-parseMoney(ev.expenses); }
function formatDate(d)    { if(!d) return ""; const [y,m,day]=d.split("-"); return `${day}.${m}.${y}`; }
function fmt(n)           { return n.toLocaleString("ru"); }

const emptyEvent = () => ({ id:Date.now().toString(), title:"", date:"", prepayDate:"", source:"",
  clientName:"", clientPhone:"", totalCost:"", paidCost:"", expenses:"", notes:"",
  createdAt:new Date().toISOString(), archived:false });

const V = { LIST:"list", EVENT:"event", NOTES:"notes", FORM:"form", DASH:"dash", ARCHIVE:"archive", CLIENTS:"clients", CAL:"cal" };

// ── palette: "atelier" — deep ink + warm paper + a single brass accent ──
const C = {
  bg:      "#F7F6F3",   // warm paper
  bgAlt:   "#EFEDE7",   // slightly deeper paper
  surface: "#FFFFFF",
  ink:     "#17161A",   // near-black ink (cards / bars)
  inkSoft: "#2A2830",
  line:    "#E4E1DA",
  line2:   "#D3CFC5",
  text:    "#1C1B1F",
  textSub: "#7C7873",
  textMut: "#AEA9A0",
  brass:   "#B08343",   // warm brass accent — the one bold color
  brassSoft:"#F0E7D8",
  green:   "#3C7A57",
  greenBg: "#E7F0EA",
  red:     "#B23A32",
  redBg:   "#F6E4E2",
  amber:   "#A9722A",
  amberBg: "#F5EBDC",
};

// ── shared UI ──
function TopBar({ left, title, right, sub }) {
  return (
    <div style={s.topBar}>
      <div style={s.topSide}>{left||<div style={{width:40}}/>}</div>
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",flex:1,overflow:"hidden"}}>
        <div style={s.topTitle}>{title}</div>
        {sub&&<div style={s.topSubtitle}>{sub}</div>}
      </div>
      <div style={{...s.topSide,justifyContent:"flex-end"}}>{right||<div style={{width:40}}/>}</div>
    </div>
  );
}
function BackBtn({ onClick }) { return <button style={s.backBtn} className="press" onClick={onClick}>‹</button>; }
function Chip({ children, tone }) {
  const map = {
    default:{c:C.textSub,b:C.bgAlt},
    green:{c:C.green,b:C.greenBg},
    red:{c:C.red,b:C.redBg},
    brass:{c:C.brass,b:C.brassSoft},
  };
  const t = map[tone]||map.default;
  return <span style={{...s.chip,color:t.c,background:t.b}}>{children}</span>;
}
function Field({ label, children, hint }) {
  return (
    <div style={{marginBottom:18}}>
      <div style={s.fieldLabel}>{label}</div>
      {children}
      {hint&&<div style={{fontSize:11,color:C.textMut,marginTop:5}}>{hint}</div>}
    </div>
  );
}

// ── bottom nav ──
function TabBar({ view, onTab }) {
  const tabs=[
    {id:V.LIST,label:"Заказы",icon:IconList},
    {id:V.CAL,label:"Календарь",icon:IconCal},
    {id:V.CLIENTS,label:"Клиенты",icon:IconUsers},
    {id:V.DASH,label:"Аналитика",icon:IconChart},
    {id:V.ARCHIVE,label:"Архив",icon:IconArchive},
  ];
  return (
    <div style={s.tabBar}>
      {tabs.map(t=>{
        const on = view===t.id;
        return (
          <button key={t.id} style={s.tabBtn} className="press" onClick={()=>onTab(t.id)}>
            <t.icon color={on?C.ink:C.textMut}/>
            <span style={{fontSize:9.5,fontWeight:on?700:500,letterSpacing:0.2,marginTop:3,color:on?C.ink:C.textMut}}>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── minimal line icons ──
function IconList({color}){return(<svg width="21" height="21" viewBox="0 0 24 24" fill="none"><rect x="3.5" y="5" width="17" height="3" rx="1" stroke={color} strokeWidth="1.6"/><rect x="3.5" y="13" width="17" height="6" rx="1.5" stroke={color} strokeWidth="1.6"/></svg>);}
function IconCal({color}){return(<svg width="21" height="21" viewBox="0 0 24 24" fill="none"><rect x="4" y="5" width="16" height="15" rx="2" stroke={color} strokeWidth="1.6"/><path d="M4 9h16M8 3v3M16 3v3" stroke={color} strokeWidth="1.6" strokeLinecap="round"/></svg>);}
function IconUsers({color}){return(<svg width="21" height="21" viewBox="0 0 24 24" fill="none"><circle cx="9" cy="8" r="3.2" stroke={color} strokeWidth="1.6"/><path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" stroke={color} strokeWidth="1.6" strokeLinecap="round"/><path d="M16 14c2.5 0 4.5 2 4.5 5" stroke={color} strokeWidth="1.6" strokeLinecap="round"/><circle cx="17" cy="8" r="2.6" stroke={color} strokeWidth="1.6"/></svg>);}
function IconChart({color}){return(<svg width="21" height="21" viewBox="0 0 24 24" fill="none"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" stroke={color} strokeWidth="1.6" strokeLinecap="round"/></svg>);}
function IconArchive({color}){return(<svg width="21" height="21" viewBox="0 0 24 24" fill="none"><rect x="4" y="4" width="16" height="4" rx="1" stroke={color} strokeWidth="1.6"/><path d="M5.5 8v10a1 1 0 001 1h11a1 1 0 001-1V8" stroke={color} strokeWidth="1.6"/><path d="M10 12h4" stroke={color} strokeWidth="1.6" strokeLinecap="round"/></svg>);}
function IconEdit({color}){return(<svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M15 5l4 4M4 20l1-4L16 5l3 3L8 19l-4 1z" stroke={color} strokeWidth="1.6" strokeLinejoin="round"/></svg>);}
function IconArc({color}){return(<svg width="17" height="17" viewBox="0 0 24 24" fill="none"><rect x="4" y="4" width="16" height="4" rx="1" stroke={color} strokeWidth="1.6"/><path d="M5.5 8v10a1 1 0 001 1h11a1 1 0 001-1V8M10 12h4" stroke={color} strokeWidth="1.6"/></svg>);}
function IconUnarc({color}){return(<svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M4 8h16M6 8v11h12V8" stroke={color} strokeWidth="1.6"/><path d="M12 16v-5m0 0l-2 2m2-2l2 2" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>);}
function IconTrash({color}){return(<svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M5 7h14M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2M6 7l1 12a1 1 0 001 1h8a1 1 0 001-1l1-12" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>);}

// ── event card ──
function EventCard({ ev, onClick }) {
  const rem=remaining(ev);
  const paid = ev.totalCost && rem===0;
  return (
    <div style={s.card} className="card-press" onClick={onClick}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:10}}>
        <span style={s.cardTitle}>{ev.title||"Без названия"}</span>
        {ev.date&&<span style={s.cardDate}>{formatDate(ev.date)}</span>}
      </div>
      {ev.clientName&&<div style={s.cardSub}>{ev.clientName}</div>}
      <div style={s.cardChips}>
        {ev.source&&<Chip>{ev.source}</Chip>}
        {ev.totalCost&&<Chip tone="brass">{ev.totalCost} ₽</Chip>}
        {rem>0&&<Chip tone="red">Остаток {fmt(rem)} ₽</Chip>}
        {paid&&<Chip tone="green">Оплачено</Chip>}
      </div>
    </div>
  );
}

// ── analytics ──
function Stat({ label, value, tone, big }) {
  const vc = tone==="green"?C.green:tone==="red"?C.red:tone==="brass"?C.brass:C.text;
  return (
    <div style={{...s.statCard, ...(big?{gridColumn:"span 2"}:{})}}>
      <div style={s.statLabel}>{label}</div>
      <div style={{...s.statValue,color:vc,fontSize:big?26:19}}>{value}</div>
    </div>
  );
}

function Dashboard({ events }) {
  const all = events; // ВСЕ заказы
  const revenue = all.reduce((s,e)=>s+parseMoney(e.totalCost),0);
  const expenses= all.reduce((s,e)=>s+parseMoney(e.expenses),0);
  const prof    = revenue - expenses;
  const paid    = all.reduce((s,e)=>s+parseMoney(e.paidCost),0);
  const owed     = revenue - paid;
  const withPrice = all.filter(e=>parseMoney(e.totalCost)>0);
  const avg     = withPrice.length ? Math.round(revenue/withPrice.length) : 0;
  const margin  = revenue ? Math.round(prof/revenue*100) : 0;

  // by month (revenue + profit)
  const byMonth={};
  all.forEach(ev=>{
    if(!ev.date) return;
    const [y,m]=ev.date.split("-");
    const k=`${y}-${m}`;
    if(!byMonth[k]) byMonth[k]={key:k,label:`${MONTHS_SHORT[parseInt(m)-1]}`,year:y,rev:0,prof:0,count:0};
    byMonth[k].rev  += parseMoney(ev.totalCost);
    byMonth[k].prof += profit(ev);
    byMonth[k].count+= 1;
  });
  const months=Object.values(byMonth).sort((a,b)=>a.key.localeCompare(b.key));
  const maxRev=Math.max(...months.map(m=>m.rev),1);

  return (
    <div style={{flex:1,overflowY:"auto",padding:"18px 16px 28px"}}>
      {/* headline profit */}
      <div style={s.heroCard}>
        <div style={{fontSize:11,letterSpacing:1.5,color:"rgba(255,255,255,0.55)",fontWeight:600,textTransform:"uppercase"}}>Прибыль за всё время</div>
        <div style={{fontSize:38,fontWeight:800,color:"#fff",letterSpacing:-1,marginTop:6,lineHeight:1}}>{fmt(prof)} ₽</div>
        <div style={{display:"flex",gap:16,marginTop:16}}>
          <div>
            <div style={{fontSize:10,color:"rgba(255,255,255,0.5)",letterSpacing:0.5}}>ВЫРУЧКА</div>
            <div style={{fontSize:15,color:"#fff",fontWeight:700,marginTop:2}}>{fmt(revenue)} ₽</div>
          </div>
          <div>
            <div style={{fontSize:10,color:"rgba(255,255,255,0.5)",letterSpacing:0.5}}>РАСХОДЫ</div>
            <div style={{fontSize:15,color:"#fff",fontWeight:700,marginTop:2}}>{fmt(expenses)} ₽</div>
          </div>
          <div>
            <div style={{fontSize:10,color:"rgba(255,255,255,0.5)",letterSpacing:0.5}}>МАРЖА</div>
            <div style={{fontSize:15,color:C.brass,fontWeight:700,marginTop:2}}>{margin}%</div>
          </div>
        </div>
      </div>

      {/* stat grid */}
      <div style={s.statGrid}>
        <Stat label="Всего заказов" value={all.length}/>
        <Stat label="Средний чек" value={`${fmt(avg)} ₽`}/>
        <Stat label="Получено" value={`${fmt(paid)} ₽`} tone="green"/>
        <Stat label="Ждём оплату" value={`${fmt(owed)} ₽`} tone="red"/>
      </div>

      {/* plan/fact */}
      {revenue>0&&(
        <div style={s.panel}>
          <div style={s.panelTitle}>План / факт по оплатам</div>
          <div style={s.planBar}>
            <div style={{...s.planFill,width:`${Math.round(paid/revenue*100)}%`}}/>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",marginTop:8}}>
            <span style={{fontSize:12.5,color:C.green,fontWeight:700}}>Получено {fmt(paid)} ₽</span>
            <span style={{fontSize:12.5,color:C.textSub}}>из {fmt(revenue)} ₽</span>
          </div>
          <div style={{fontSize:11,color:C.textMut,marginTop:4}}>{Math.round(paid/revenue*100)}% плана закрыто · осталось собрать {fmt(owed)} ₽</div>
        </div>
      )}

      {/* dynamics by month */}
      {months.length>0&&(
        <div style={s.panel}>
          <div style={s.panelTitle}>Динамика по месяцам</div>
          <div style={{display:"flex",gap:5,alignItems:"flex-end",height:130,marginTop:6}}>
            {months.map((m,i)=>(
              <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:5,minWidth:0}}>
                <div style={{flex:1,width:"100%",display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
                  <div style={{width:"70%",maxWidth:26,height:`${Math.max(Math.round(m.rev/maxRev*100),3)}%`,background:C.bgAlt,position:"relative",borderRadius:"3px 3px 0 0",overflow:"hidden"}}>
                    <div style={{position:"absolute",bottom:0,left:0,right:0,height:`${m.rev?Math.round(m.prof/m.rev*100):0}%`,background:C.brass}}/>
                  </div>
                </div>
                <div style={{fontSize:9,color:C.textSub,fontWeight:600}}>{m.label}</div>
              </div>
            ))}
          </div>
          <div style={{display:"flex",alignItems:"center",gap:5,marginTop:12}}>
            <span style={{width:9,height:9,borderRadius:2,background:C.bgAlt,flexShrink:0}}/>
            <span style={{fontSize:11,color:C.textSub}}>Выручка</span>
            <span style={{width:9,height:9,borderRadius:2,background:C.brass,flexShrink:0,marginLeft:14}}/>
            <span style={{fontSize:11,color:C.textSub}}>Прибыль</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── clients ──
function Clients({ events }) {
  const [search,setSearch]=useState("");
  const map={};
  events.forEach(ev=>{
    if(!ev.clientName) return;
    const key=ev.clientPhone||ev.clientName;
    if(!map[key]) map[key]={name:ev.clientName,phone:ev.clientPhone,count:0,events:[]};
    map[key].count++; map[key].events.push(ev);
  });
  const clients=Object.values(map)
    .filter(c=>c.name.toLowerCase().includes(search.toLowerCase())||(c.phone||"").includes(search))
    .sort((a,b)=>a.name.localeCompare(b.name,"ru"));
  return (
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <div style={{padding:"12px 16px 14px"}}>
        <input style={s.search} className="fld" placeholder="Поиск по имени или телефону"
          value={search} onChange={e=>setSearch(e.target.value)}/>
      </div>
      <div style={{flex:1,overflowY:"auto"}}>
        {clients.length===0&&(
          <div style={s.empty}>
            <IconUsers color={C.textMut}/>
            <div style={{color:C.textSub,fontSize:13,textAlign:"center",marginTop:10}}>Клиенты появятся здесь<br/>после добавления заказов</div>
          </div>
        )}
        {clients.map((c,i)=>(
          <div key={i} style={s.card}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline"}}>
              <span style={s.cardTitle}>{c.name}</span>
              <span style={{fontSize:11,color:C.textMut,fontWeight:600}}>{c.count} {c.count===1?"заказ":"заказа"}</span>
            </div>
            {c.phone&&<a href={`tel:${c.phone}`} style={s.phoneLink}>{c.phone}</a>}
            <div style={s.cardChips}>
              {c.events.slice(0,3).map(ev=><Chip key={ev.id}>{ev.title||"Заказ"}</Chip>)}
              {c.events.length>3&&<Chip>+{c.events.length-3}</Chip>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── calendar ──
function Calendar({ events, onEventClick }) {
  const now=new Date();
  const [year,setYear]=useState(now.getFullYear());
  const [month,setMonth]=useState(now.getMonth());
  const [selected,setSelected]=useState(now.getDate());
  const prevMonth=()=>{ setSelected(null); if(month===0){setMonth(11);setYear(y=>y-1);}else setMonth(m=>m-1); };
  const nextMonth=()=>{ setSelected(null); if(month===11){setMonth(0);setYear(y=>y+1);}else setMonth(m=>m+1); };
  const firstDay=new Date(year,month,1);
  const lastDay=new Date(year,month+1,0);
  const startDow=(firstDay.getDay()+6)%7;
  const totalCells=Math.ceil((startDow+lastDay.getDate())/7)*7;
  const cells=Array.from({length:totalCells},(_,i)=>{ const d=i-startDow+1; return d>=1&&d<=lastDay.getDate()?d:null; });
  const evByDay={};
  events.forEach(ev=>{
    if(!ev.date) return;
    const [ey,em,ed]=ev.date.split("-");
    if(parseInt(ey)===year&&parseInt(em)-1===month){ const d=parseInt(ed); (evByDay[d]=evByDay[d]||[]).push(ev); }
  });
  const today=now.getFullYear()===year&&now.getMonth()===month?now.getDate():null;
  const selectedEvs=selected?(evByDay[selected]||[]):[];
  return (
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 20px 10px"}}>
        <button style={s.calNav} className="press" onClick={prevMonth}>‹</button>
        <span style={{fontSize:17,fontWeight:700,color:C.text,letterSpacing:-0.2}}>{MONTHS_RU[month]} {year}</span>
        <button style={s.calNav} className="press" onClick={nextMonth}>›</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",padding:"0 10px"}}>
        {DAYS_SHORT.map(d=><div key={d} style={{textAlign:"center",fontSize:11,fontWeight:600,color:C.textMut,padding:"6px 0"}}>{d}</div>)}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",padding:"2px 10px 10px",gap:2}}>
        {cells.map((d,i)=>{
          const has=d&&evByDay[d];
          const isToday=d===today;
          const isSel=d===selected;
          return (
            <div key={i} className={d?"press":""} onClick={()=>d&&setSelected(d)}
              style={{aspectRatio:"1",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:2,cursor:d?"pointer":"default",borderRadius:12,
                background:isSel?C.ink:isToday?C.brassSoft:"transparent"}}>
              {d&&<span style={{fontSize:14,fontWeight:isSel||isToday?700:400,color:isSel?"#fff":isToday?C.brass:C.text}}>{d}</span>}
              {has&&<div style={{width:5,height:5,borderRadius:"50%",background:isSel?C.brass:C.ink}}/>}
            </div>
          );
        })}
      </div>
      <div style={{flex:1,overflowY:"auto",borderTop:`1px solid ${C.line}`,marginTop:4}}>
        {selected&&selectedEvs.length===0&&<div style={{padding:"22px 16px",color:C.textMut,fontSize:13,textAlign:"center"}}>На {selected} {MONTHS_RU[month].toLowerCase()} заказов нет</div>}
        {!selected&&<div style={{padding:"22px 16px",color:C.textMut,fontSize:13,textAlign:"center"}}>Выбери день</div>}
        {selectedEvs.map(ev=><EventCard key={ev.id} ev={ev} onClick={()=>onEventClick(ev)}/>)}
      </div>
    </div>
  );
}

// ── notes editor ──
function NotesEditor({ event, onBack, onSave }) {
  const taRef=useRef(null), timerRef=useRef(null);
  const [val,setVal]=useState(event.notes||"");
  useEffect(()=>{ setTimeout(()=>{ if(taRef.current){ taRef.current.focus(); const l=taRef.current.value.length; taRef.current.setSelectionRange(l,l);}},80); },[]);
  const handleChange=(v)=>{ setVal(v); clearTimeout(timerRef.current); timerRef.current=setTimeout(()=>onSave(v),1500); };
  const handleKeyDown=(e)=>{
    if(e.key!=="Enter") return;
    const ta=taRef.current,pos=ta.selectionStart,text=ta.value;
    const ls=text.lastIndexOf("\n",pos-1)+1, cur=text.slice(ls,pos);
    const nm=cur.match(/^(\s*)(\d+)\.\s/), dm=cur.match(/^(\s*)-\s/);
    let prefix=null;
    if(nm){ if(cur.trim()===nm[2]+"."){e.preventDefault();const nv=text.slice(0,ls)+"\n"+text.slice(pos);handleChange(nv);setTimeout(()=>ta.setSelectionRange(ls+1,ls+1),0);return;} prefix=nm[1]+(parseInt(nm[2])+1)+". "; }
    else if(dm){ if(cur.trim()==="-"){e.preventDefault();const nv=text.slice(0,ls)+"\n"+text.slice(pos);handleChange(nv);setTimeout(()=>ta.setSelectionRange(ls+1,ls+1),0);return;} prefix=dm[1]+"- "; }
    if(prefix){ e.preventDefault(); const nv=text.slice(0,pos)+"\n"+prefix+text.slice(ta.selectionEnd); handleChange(nv); const np=pos+1+prefix.length; setTimeout(()=>ta.setSelectionRange(np,np),0); }
  };
  const autoResize=()=>{ const ta=taRef.current; if(!ta) return; ta.style.height="auto"; ta.style.height=ta.scrollHeight+"px"; };
  useEffect(()=>autoResize(),[val]);
  return (
    <div style={{display:"flex",flexDirection:"column",height:"100vh",width:"100%",background:C.surface,overflow:"hidden"}}>
      <style>{`.notesta{width:100%;border:none;outline:none;resize:none;overflow:hidden;font-family:'Fraunces',Georgia,serif;font-size:17px;line-height:1.75;color:#1C1B1F;background:transparent;padding:0;box-sizing:border-box;}.notesta::placeholder{color:#c9c4bb;}`}</style>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"6px 10px",flexShrink:0,minHeight:52,borderBottom:`1px solid ${C.line}`}}>
        <button style={s.backBtn} className="press" onClick={onBack}>‹</button>
        <span style={{fontSize:11,color:C.textMut,paddingRight:14}}>сохраняется автоматически</span>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"16px 22px 48px"}}>
        <div style={{fontSize:22,fontWeight:600,color:C.text,marginBottom:16,fontFamily:"'Fraunces',Georgia,serif"}}>{event.title}</div>
        <textarea ref={taRef} className="notesta" placeholder="Сценарий, тайминг, пожелания, детали…" value={val}
          onChange={e=>{handleChange(e.target.value);autoResize();}} onKeyDown={handleKeyDown}/>
      </div>
    </div>
  );
}

// ── main ──
function App() {
  const [events,setEvents]=useState([]);
  const [view,setView]=useState(V.LIST);
  const [activeId,setActiveId]=useState(null);
  const [draft,setDraft]=useState(null);
  const [del,setDel]=useState(false);
  const [arc,setArc]=useState(false);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState(null);
  const notesTimer=useRef(null);

  useEffect(()=>{ (async()=>{ try{ setEvents(await dbLoad()); }catch(e){ setError("Не удалось загрузить: "+e.message); }finally{ setLoading(false);} })(); },[]);

  const activeEvent=events.find(e=>e.id===activeId)||null;
  const activeEvents=[...events].filter(e=>!e.archived).sort((a,b)=>(a.date||"").localeCompare(b.date||""));
  const archivedEvents=[...events].filter(e=>e.archived).sort((a,b)=>(b.date||"").localeCompare(a.date||""));

  const openEvent=(ev)=>{ setActiveId(ev.id); setView(V.EVENT); };
  const openNew=()=>{ setDraft(emptyEvent()); setView(V.FORM); };
  const openEdit=()=>{ setDraft({...emptyEvent(),...activeEvent}); setView(V.FORM); };

  const saveForm=async()=>{
    if(!draft.title.trim()) return; setSaving(true);
    try{ await dbUpsert(draft);
      const exists=events.find(e=>e.id===draft.id);
      setEvents(exists?events.map(e=>e.id===draft.id?draft:e):[draft,...events]);
      setActiveId(draft.id); setView(V.EVENT); setDraft(null);
    }catch(e){ setError("Ошибка: "+e.message); }finally{ setSaving(false); }
  };
  const cancelForm=()=>{ setView(activeId?V.EVENT:V.LIST); setDraft(null); };
  const doDelete=async()=>{ try{ await dbDelete(activeId); setEvents(events.filter(e=>e.id!==activeId)); const wasArc=activeEvent?.archived; setActiveId(null); setDel(false); setView(wasArc?V.ARCHIVE:V.LIST);}catch(e){setError("Ошибка: "+e.message);} };
  const doArchive=async()=>{ if(!activeEvent) return; const u={...activeEvent,archived:!activeEvent.archived}; try{ await dbUpsert(u); setEvents(events.map(e=>e.id===activeId?u:e)); setArc(false); setView(u.archived?V.ARCHIVE:V.LIST);}catch(e){setError("Ошибка: "+e.message);} };
  const updateNotes=(val)=>{ const upd=events.map(e=>e.id===activeId?{...e,notes:val}:e); setEvents(upd); clearTimeout(notesTimer.current); notesTimer.current=setTimeout(async()=>{ const ev=upd.find(e=>e.id===activeId); if(ev){try{await dbUpsert(ev);}catch{}} },1500); };
  const setField=(f,v)=>setDraft(d=>({...d,[f]:v}));
  const onTab=(t)=>{ setActiveId(null); setDraft(null); setView(t); };

  if(loading) return (
    <div style={s.screen}><div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
      <div style={s.spinner}/><div style={{color:C.textMut,fontSize:13,marginTop:14}}>Загрузка…</div>
    </div></div>
  );

  const wordmark = <span style={{fontFamily:"'Fraunces',Georgia,serif",fontSize:19,fontWeight:600,letterSpacing:-0.3,color:C.text}}>Host<span style={{color:C.brass}}>.</span></span>;

  if(view===V.LIST) return (
    <div style={s.screen}>
      <TopBar title={wordmark} sub={`${activeEvents.length} активных`}
        right={<button style={s.addBtn} className="press" onClick={openNew}>＋</button>}/>
      {error&&<Err error={error} clear={()=>setError(null)}/>}
      <div style={{flex:1,overflowY:"auto"}}>
        {activeEvents.length===0&&<div style={s.empty}><IconList color={C.textMut}/><div style={{fontSize:15,color:C.text,fontWeight:600,marginTop:12}}>Пока нет заказов</div><div style={{color:C.textMut,fontSize:13,marginTop:4}}>Нажми ＋ чтобы добавить первый</div></div>}
        {activeEvents.map(ev=><EventCard key={ev.id} ev={ev} onClick={()=>openEvent(ev)}/>)}
      </div>
      <TabBar view={view} onTab={onTab}/>
    </div>
  );

  if(view===V.ARCHIVE) return (
    <div style={s.screen}>
      <TopBar title="Архив" sub={`${archivedEvents.length} завершённых`}/>
      {error&&<Err error={error} clear={()=>setError(null)}/>}
      <div style={{flex:1,overflowY:"auto"}}>
        {archivedEvents.length===0&&<div style={s.empty}><IconArchive color={C.textMut}/><div style={{color:C.textMut,fontSize:13,marginTop:12}}>Архив пуст</div></div>}
        {archivedEvents.map(ev=><EventCard key={ev.id} ev={ev} onClick={()=>openEvent(ev)}/>)}
      </div>
      <TabBar view={view} onTab={onTab}/>
    </div>
  );

  if(view===V.CLIENTS) return (
    <div style={s.screen}><TopBar title="Клиенты"/><Clients events={events}/><TabBar view={view} onTab={onTab}/></div>
  );
  if(view===V.CAL) return (
    <div style={s.screen}><TopBar title="Календарь"/><Calendar events={events} onEventClick={ev=>{setActiveId(ev.id);setView(V.EVENT);}}/><TabBar view={view} onTab={onTab}/></div>
  );
  if(view===V.DASH) return (
    <div style={s.screen}><TopBar title="Аналитика" sub="по всем заказам"/><Dashboard events={events}/><TabBar view={view} onTab={onTab}/></div>
  );

  if(view===V.EVENT&&activeEvent) {
    const rem=remaining(activeEvent), pr=profit(activeEvent), isArc=activeEvent.archived;
    return (
      <div style={s.screen}>
        <TopBar left={<BackBtn onClick={()=>setView(isArc?V.ARCHIVE:V.LIST)}/>} title={activeEvent.title}
          right={<div style={{display:"flex",gap:5}}>
            {!isArc&&<button style={s.iconBtn} className="press" onClick={openEdit}><IconEdit color={C.textSub}/></button>}
            <button style={s.iconBtn} className="press" onClick={()=>setArc(true)}>{isArc?<IconUnarc color={C.green}/>:<IconArc color={C.amber}/>}</button>
            <button style={s.iconBtn} className="press" onClick={()=>setDel(true)}><IconTrash color={C.red}/></button>
          </div>}/>
        {isArc&&<div style={s.arcBanner}>Заказ в архиве</div>}
        {error&&<Err error={error} clear={()=>setError(null)}/>}
        <div style={{flex:1,overflowY:"auto",padding:"16px 16px 24px"}}>
          <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
            {activeEvent.date&&<Chip tone="brass">{formatDate(activeEvent.date)}</Chip>}
            {activeEvent.source&&<Chip>{activeEvent.source}</Chip>}
          </div>

          {(activeEvent.clientName||activeEvent.clientPhone)&&(
            <div style={s.detailBlock}>
              {activeEvent.clientName&&<div style={s.detailRow}><span style={s.detailKey}>Заказчик</span><span style={s.detailVal}>{activeEvent.clientName}</span></div>}
              {activeEvent.clientPhone&&<div style={s.detailRow}><span style={s.detailKey}>Телефон</span><a href={`tel:${activeEvent.clientPhone}`} style={{...s.detailVal,color:C.brass,textDecoration:"none",fontWeight:700}}>{activeEvent.clientPhone}</a></div>}
              {activeEvent.prepayDate&&<div style={s.detailRow}><span style={s.detailKey}>Предоплата</span><span style={s.detailVal}>{formatDate(activeEvent.prepayDate)}</span></div>}
            </div>
          )}

          {activeEvent.totalCost&&(
            <div style={s.moneyBlock}>
              <div style={s.moneyRow}><span style={s.moneyKey}>Стоимость</span><span style={s.moneyVal}>{activeEvent.totalCost} ₽</span></div>
              {activeEvent.paidCost&&<div style={s.moneyRow}><span style={s.moneyKey}>Оплачено</span><span style={{...s.moneyVal,color:C.green}}>{activeEvent.paidCost} ₽</span></div>}
              <div style={s.moneyRow}><span style={s.moneyKey}>Остаток</span><span style={{...s.moneyVal,color:rem>0?C.red:C.green}}>{rem>0?`${fmt(rem)} ₽`:"оплачено"}</span></div>
              {activeEvent.expenses&&<div style={s.moneyRow}><span style={s.moneyKey}>Расходы</span><span style={{...s.moneyVal,color:C.textSub}}>{activeEvent.expenses} ₽</span></div>}
              {activeEvent.expenses&&<div style={{...s.moneyRow,borderTop:`1px solid ${C.line}`,paddingTop:10,marginTop:2}}><span style={{...s.moneyKey,fontWeight:700,color:C.text}}>Прибыль</span><span style={{...s.moneyVal,color:C.brass,fontWeight:800}}>{fmt(pr)} ₽</span></div>}
            </div>
          )}

          <div style={s.notesBtn} className="card-press" onClick={()=>setView(V.NOTES)}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontSize:13,fontWeight:700,color:C.text}}>Заметки к заказу</span>
              <span style={{color:C.brass,fontSize:20}}>›</span>
            </div>
            <div style={{fontSize:13,color:C.textSub,lineHeight:1.55,marginTop:6}}>
              {activeEvent.notes?activeEvent.notes.slice(0,120)+(activeEvent.notes.length>120?"…":""):<span style={{color:C.textMut}}>Открыть чистый лист для сценария</span>}
            </div>
          </div>
        </div>
        {arc&&<Sheet title={isArc?"Вернуть из архива?":"Отправить в архив?"} sub={isArc?"Заказ снова появится в активных.":"Заказ переместится в архив, но останется в аналитике."} cancel={()=>setArc(false)} confirm={doArchive} confirmLabel={isArc?"Вернуть":"В архив"} confirmColor={isArc?C.green:C.amber}/>}
        {del&&<Sheet title="Удалить заказ?" sub="Заказ и все заметки удалятся навсегда." cancel={()=>setDel(false)} confirm={doDelete} confirmLabel="Удалить" confirmColor={C.red}/>}
      </div>
    );
  }

  if(view===V.NOTES&&activeEvent) return <NotesEditor event={activeEvent} onBack={()=>setView(V.EVENT)} onSave={updateNotes}/>;

  if(view===V.FORM&&draft) {
    const rem=remaining(draft), pr=profit(draft);
    return (
      <div style={s.screen}>
        <TopBar left={<BackBtn onClick={cancelForm}/>} title={events.find(e=>e.id===draft.id)?"Редактировать":"Новый заказ"}
          right={<button style={{...s.saveBtn,opacity:draft.title.trim()&&!saving?1:0.35}} className="press" onClick={saveForm}>{saving?"…":"Готово"}</button>}/>
        {error&&<Err error={error} clear={()=>setError(null)}/>}
        <div style={{flex:1,overflowY:"auto",padding:"18px 16px 48px"}}>
          <Field label="Название"><input style={s.fld} className="fld" placeholder="Свадьба Ивановых" value={draft.title} autoFocus onChange={e=>setField("title",e.target.value)}/></Field>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <Field label="Дата события"><input type="date" style={s.fld} className="fld" value={draft.date} onChange={e=>setField("date",e.target.value)}/></Field>
            <Field label="Дата предоплаты"><input type="date" style={s.fld} className="fld" value={draft.prepayDate} onChange={e=>setField("prepayDate",e.target.value)}/></Field>
          </div>
          <Field label="Откуда заказ">
            <div style={{display:"flex",flexWrap:"wrap",gap:7}}>{SOURCE_OPTIONS.map(o=><button key={o} style={{...s.pick,...(draft.source===o?s.pickOn:{})}} className="press" onClick={()=>setField("source",draft.source===o?"":o)}>{o}</button>)}</div>
            <input style={{...s.fld,marginTop:9}} className="fld" placeholder="Свой вариант" value={SOURCE_OPTIONS.includes(draft.source)?"":draft.source} onChange={e=>setField("source",e.target.value)}/>
          </Field>
          <Field label="Имя заказчика"><input style={s.fld} className="fld" placeholder="Анна Иванова" value={draft.clientName} onChange={e=>setField("clientName",e.target.value)}/></Field>
          <Field label="Телефон"><input style={s.fld} className="fld" placeholder="+7 (___) ___-__-__" inputMode="tel" value={draft.clientPhone} onChange={e=>setField("clientPhone",formatPhone(e.target.value))}/></Field>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <Field label="Стоимость, ₽"><input style={s.fld} className="fld" placeholder="50 000" inputMode="numeric" value={draft.totalCost} onChange={e=>setField("totalCost",formatMoney(e.target.value))}/></Field>
            <Field label="Оплачено, ₽"><input style={s.fld} className="fld" placeholder="25 000" inputMode="numeric" value={draft.paidCost} onChange={e=>setField("paidCost",formatMoney(e.target.value))}/></Field>
          </div>
          <Field label="Расходы, ₽" hint="Аренда, реквизит, помощники — для расчёта прибыли"><input style={s.fld} className="fld" placeholder="10 000" inputMode="numeric" value={draft.expenses} onChange={e=>setField("expenses",formatMoney(e.target.value))}/></Field>
          {draft.totalCost&&(
            <div style={s.formSummary}>
              <div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:13,color:C.textSub}}>Остаток к оплате</span><span style={{fontSize:14,fontWeight:700,color:rem>0?C.red:C.green}}>{rem>0?`${fmt(rem)} ₽`:"оплачено"}</span></div>
              {draft.expenses&&<div style={{display:"flex",justifyContent:"space-between",marginTop:8}}><span style={{fontSize:13,color:C.textSub}}>Прибыль</span><span style={{fontSize:14,fontWeight:700,color:C.brass}}>{fmt(pr)} ₽</span></div>}
            </div>
          )}
        </div>
      </div>
    );
  }
  return null;
}

function Err({ error, clear }) { return <div style={s.err} onClick={clear}>{error} ✕</div>; }
function Sheet({ title, sub, cancel, confirm, confirmLabel, confirmColor }) {
  return (
    <div style={s.overlay} onClick={cancel}>
      <div style={s.sheet} onClick={e=>e.stopPropagation()}>
        <div style={{width:36,height:4,background:C.line2,borderRadius:2,margin:"0 auto 16px"}}/>
        <div style={{fontSize:18,fontWeight:700,color:C.text,marginBottom:6}}>{title}</div>
        <div style={{fontSize:13.5,color:C.textSub,lineHeight:1.5,marginBottom:18}}>{sub}</div>
        <div style={{display:"flex",gap:10}}>
          <button style={s.sheetGhost} className="press" onClick={cancel}>Отмена</button>
          <button style={{...s.sheetSolid,background:confirmColor}} className="press" onClick={confirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

// ── styles ──
const s = {
  screen:{display:"flex",flexDirection:"column",height:"100vh",width:"100%",background:C.bg,color:C.text,fontFamily:"'Inter',-apple-system,sans-serif",overflow:"hidden"},
  topBar:{display:"flex",alignItems:"center",padding:"0 12px",height:58,flexShrink:0,gap:8,background:C.bg,borderBottom:`1px solid ${C.line}`},
  topSide:{width:76,display:"flex",alignItems:"center",flexShrink:0},
  topTitle:{fontWeight:700,fontSize:16,color:C.text,letterSpacing:-0.2,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis",maxWidth:"100%"},
  topSubtitle:{fontSize:11,color:C.textMut,marginTop:1,fontWeight:500},
  backBtn:{background:"none",border:"none",color:C.text,fontSize:32,cursor:"pointer",lineHeight:1,padding:"0 6px 3px",fontWeight:300},
  addBtn:{width:38,height:38,background:C.ink,border:"none",color:"#fff",fontSize:20,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",borderRadius:12,lineHeight:1},
  iconBtn:{width:38,height:38,background:C.surface,border:`1px solid ${C.line}`,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",borderRadius:11},
  saveBtn:{background:C.ink,border:"none",color:"#fff",padding:"9px 18px",fontWeight:700,fontSize:13.5,fontFamily:"inherit",cursor:"pointer",borderRadius:11,whiteSpace:"nowrap"},
  tabBar:{display:"flex",background:C.surface,flexShrink:0,height:64,borderTop:`1px solid ${C.line}`,paddingBottom:"env(safe-area-inset-bottom)"},
  tabBtn:{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"none",border:"none",cursor:"pointer",gap:1,padding:"8px 0"},
  spinner:{width:30,height:30,border:`2.5px solid ${C.line}`,borderTopColor:C.ink,borderRadius:"50%",animation:"spin 0.7s linear infinite"},
  err:{background:C.redBg,color:C.red,fontSize:12.5,padding:"11px 16px",cursor:"pointer",flexShrink:0,fontWeight:500},
  arcBanner:{background:C.amberBg,color:C.amber,fontSize:12,padding:"9px 16px",flexShrink:0,fontWeight:700,letterSpacing:0.2},
  empty:{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"70px 40px",flex:1,textAlign:"center",opacity:0.9},
  card:{padding:"15px 16px",cursor:"pointer",background:C.surface,borderBottom:`1px solid ${C.line}`},
  cardTitle:{fontWeight:700,fontSize:15.5,color:C.text,letterSpacing:-0.2,flex:1,lineHeight:1.3},
  cardDate:{fontSize:12,color:C.textMut,whiteSpace:"nowrap",fontWeight:600},
  cardSub:{fontSize:12.5,color:C.textSub,marginTop:2,marginBottom:9},
  cardChips:{display:"flex",flexWrap:"wrap",gap:6,marginTop:2},
  chip:{fontSize:11,fontWeight:600,padding:"4px 9px",borderRadius:7,letterSpacing:0.1},
  phoneLink:{fontSize:14,color:C.brass,fontWeight:700,textDecoration:"none",display:"block",margin:"5px 0 9px"},
  search:{width:"100%",background:C.surface,border:`1px solid ${C.line}`,color:C.text,padding:"12px 15px",fontSize:14.5,fontFamily:"inherit",borderRadius:12,outline:"none",boxSizing:"border-box"},
  // detail
  detailBlock:{background:C.surface,border:`1px solid ${C.line}`,borderRadius:16,padding:"4px 16px",marginBottom:12},
  detailRow:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 0",borderBottom:`1px solid ${C.line}`},
  detailKey:{fontSize:13,color:C.textSub},
  detailVal:{fontSize:14,color:C.text,fontWeight:600,textAlign:"right"},
  moneyBlock:{background:C.surface,border:`1px solid ${C.line}`,borderRadius:16,padding:"14px 16px",marginBottom:12},
  moneyRow:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"5px 0"},
  moneyKey:{fontSize:13.5,color:C.textSub},
  moneyVal:{fontSize:15,color:C.text,fontWeight:700},
  notesBtn:{background:C.ink,borderRadius:16,padding:"16px",cursor:"pointer"},
  // form
  fld:{width:"100%",background:C.surface,border:`1px solid ${C.line2}`,color:C.text,padding:"12px 14px",fontSize:15,fontFamily:"inherit",borderRadius:12,outline:"none",boxSizing:"border-box"},
  fieldLabel:{fontSize:12,color:C.textSub,fontWeight:600,marginBottom:7,letterSpacing:0.1},
  pick:{background:C.surface,border:`1px solid ${C.line2}`,color:C.textSub,padding:"8px 13px",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit",borderRadius:9},
  pickOn:{background:C.ink,border:`1px solid ${C.ink}`,color:"#fff"},
  formSummary:{background:C.brassSoft,borderRadius:14,padding:"14px 16px",marginTop:6},
  // analytics
  heroCard:{background:C.ink,borderRadius:20,padding:"20px 20px 18px",marginBottom:14},
  statGrid:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14},
  statCard:{background:C.surface,border:`1px solid ${C.line}`,borderRadius:14,padding:"14px 15px"},
  statLabel:{fontSize:11,color:C.textSub,fontWeight:600,marginBottom:5},
  statValue:{fontWeight:800,letterSpacing:-0.4,lineHeight:1},
  panel:{background:C.surface,border:`1px solid ${C.line}`,borderRadius:16,padding:"16px",marginBottom:12},
  panelTitle:{fontSize:13,fontWeight:700,color:C.text,marginBottom:12,letterSpacing:-0.1},
  planBar:{height:12,background:C.bgAlt,borderRadius:6,overflow:"hidden"},
  planFill:{height:"100%",background:C.green,borderRadius:6,transition:"width 0.5s"},
  // calendar
  calNav:{background:C.surface,border:`1px solid ${C.line}`,width:36,height:36,borderRadius:10,fontSize:22,color:C.text,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:300,lineHeight:1},
  // sheet
  overlay:{position:"fixed",inset:0,background:"rgba(23,22,26,0.35)",display:"flex",alignItems:"flex-end",zIndex:200,backdropFilter:"blur(2px)"},
  sheet:{background:C.surface,borderRadius:"24px 24px 0 0",padding:"14px 18px calc(28px + env(safe-area-inset-bottom))",width:"100%",boxShadow:"0 -8px 40px rgba(0,0,0,0.16)"},
  sheetGhost:{flex:1,background:C.bgAlt,border:"none",color:C.text,padding:"14px",fontWeight:600,fontSize:14,fontFamily:"inherit",cursor:"pointer",borderRadius:12},
  sheetSolid:{flex:1,border:"none",color:"#fff",padding:"14px",fontWeight:700,fontSize:14,fontFamily:"inherit",cursor:"pointer",borderRadius:12},
};

export default function Root() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Fraunces:opsz,wght@9..144,500;9..144,600&display=swap');
        @keyframes spin{to{transform:rotate(360deg)}}
        *{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
        body{background:${C.bg}}
        ::-webkit-scrollbar{width:0;height:0}
        .press{transition:opacity .12s,transform .08s;cursor:pointer}
        .press:active{opacity:.6;transform:scale(.97)}
        .card-press{transition:background .12s}
        .card-press:active{background:${C.bgAlt} !important}
        .fld:focus{border-color:${C.ink} !important}
        input,textarea{font-size:16px}
        @media(min-width:400px){input,textarea{font-size:inherit}}
      `}</style>
      <App/>
    </>
  );
}
