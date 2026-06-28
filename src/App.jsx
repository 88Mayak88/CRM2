import { useState, useEffect, useRef } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, setDoc, deleteDoc, doc, orderBy, query } from "firebase/firestore";

// ── Firebase config ───────────────────────────────────────
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
  const q   = query(collection(db, COL), orderBy("date", "asc"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
async function dbUpsert(ev) {
  await setDoc(doc(db, COL, ev.id), ev);
}
async function dbDelete(id) {
  await deleteDoc(doc(db, COL, id));
}

// ── helpers ───────────────────────────────────────────────
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
function formatDate(d)    { if(!d) return ""; const [y,m,day]=d.split("-"); return `${day}.${m}.${y}`; }
function fmt(n)           { return n.toLocaleString("ru"); }

const emptyEvent = () => ({ id:Date.now().toString(), title:"", date:"", source:"",
  clientName:"", clientPhone:"", totalCost:"", paidCost:"", notes:"",
  createdAt:new Date().toISOString(), archived:false });

const V = { LIST:"list", EVENT:"event", NOTES:"notes", FORM:"form",
            DASH:"dash", ARCHIVE:"archive", CLIENTS:"clients", CAL:"cal" };

const C = {
  bg:"#F5F3EF", surface:"#FFFFFF", border:"#E8E4DE", border2:"#D6D0C8",
  accent:"#1A1A1A", text:"#1A1A1A", textSub:"#888077", textMuted:"#B5AFA6",
  green:"#2D7D4F", greenBg:"#EAF5EE", red:"#C0392B", redBg:"#FDECEA",
  tagBg:"#EEEBE5", tagText:"#7A7268", orange:"#C05621", orangeBg:"#FEF3E8",
};

function Screen({ children }) { return <div style={s.screen}>{children}</div>; }
function TopBar({ left, title, titleStyle, right }) {
  return (
    <div style={s.topBar}>
      <div style={s.topSide}>{left||<div style={{width:44}}/>}</div>
      <div style={{...s.topTitle,...titleStyle}}>{title}</div>
      <div style={{...s.topSide,justifyContent:"flex-end"}}>{right||<div style={{width:44}}/>}</div>
    </div>
  );
}
function BackBtn({ onClick }) { return <button style={s.backBtn} onClick={onClick}>‹</button>; }
function Tag({ children, color=C.tagText, bg=C.tagBg }) {
  return <span style={{...s.tag,color,background:bg}}>{children}</span>;
}
function InfoCard({ label, value, accent, children }) {
  const ex=accent==="red"?{borderColor:"#F5C6C2",background:C.redBg}:accent==="green"?{borderColor:"#A8D9BB",background:C.greenBg}:{};
  const vc=accent==="red"?C.red:accent==="green"?C.green:C.text;
  return (
    <div style={{...s.infoCard,...ex}}>
      <span style={s.infoLabel}>{label}</span>
      {children||<span style={{...s.infoVal,color:vc}}>{value}</span>}
    </div>
  );
}
function Field({ label, children }) {
  return <div style={{marginBottom:20}}><div style={s.fieldLabel}>{label}</div>{children}</div>;
}
function TabBar({ view, onTab }) {
  const tabs=[
    {id:V.LIST,icon:"📋",label:"Заказы"},
    {id:V.CAL,icon:"📅",label:"Календарь"},
    {id:V.CLIENTS,icon:"👥",label:"Клиенты"},
    {id:V.DASH,icon:"📊",label:"Итоги"},
    {id:V.ARCHIVE,icon:"🗂",label:"Архив"},
  ];
  return (
    <div style={s.tabBar}>
      {tabs.map(t=>(
        <button key={t.id} style={{...s.tabBtn,...(view===t.id?s.tabActive:{})}} onClick={()=>onTab(t.id)}>
          <span style={{fontSize:18}}>{t.icon}</span>
          <span style={{fontSize:9,fontWeight:700,letterSpacing:0.3,marginTop:1,color:view===t.id?C.accent:C.textMuted}}>{t.label}</span>
        </button>
      ))}
    </div>
  );
}
function EventCard({ ev, onClick }) {
  const rem=remaining(ev);
  return (
    <div style={s.card} className="tap-card" onClick={onClick}>
      <div style={s.cardRow}>
        <span style={s.cardTitle}>{ev.title||"Без названия"}</span>
        {ev.date&&<span style={s.cardDate}>{formatDate(ev.date)}</span>}
      </div>
      {ev.clientName&&<div style={s.cardSub}>{ev.clientName}</div>}
      <div style={s.cardTags}>
        {ev.source&&<Tag>{ev.source}</Tag>}
        {ev.totalCost&&<Tag color={C.green} bg={C.greenBg}>{ev.totalCost} ₽</Tag>}
        {rem>0&&<Tag color={C.red} bg={C.redBg}>−{fmt(rem)} ₽</Tag>}
        {rem===0&&ev.totalCost&&<Tag color={C.green} bg={C.greenBg}>✓ Оплачено</Tag>}
      </div>
    </div>
  );
}
function Dashboard({ events }) {
  const active=events.filter(e=>!e.archived);
  const total=active.reduce((s,e)=>s+parseMoney(e.totalCost),0);
  const paid=active.reduce((s,e)=>s+parseMoney(e.paidCost),0);
  const rem=total-paid;
  const byMonth={};
  active.forEach(ev=>{
    if(!ev.date) return;
    const [y,m]=ev.date.split("-");
    const k=`${y}-${m}`;
    if(!byMonth[k]) byMonth[k]={label:`${MONTHS_SHORT[parseInt(m)-1]} ${y}`,total:0,paid:0,count:0};
    byMonth[k].total+=parseMoney(ev.totalCost);
    byMonth[k].paid+=parseMoney(ev.paidCost);
    byMonth[k].count+=1;
  });
  const months=Object.values(byMonth).slice(-6);
  const maxVal=Math.max(...months.map(m=>m.total),1);
  const bySource={};
  active.forEach(ev=>{ const src=ev.source||"Другое"; bySource[src]=(bySource[src]||0)+1; });
  const sources=Object.entries(bySource).sort((a,b)=>b[1]-a[1]);
  return (
    <div style={{flex:1,overflowY:"auto",padding:"16px 16px 24px"}}>
      <div style={s.kpiGrid}>
        <div style={s.kpiCard}><div style={s.kpiLabel}>Заказов</div><div style={s.kpiValue}>{active.length}</div></div>
        <div style={s.kpiCard}><div style={s.kpiLabel}>Общая сумма</div><div style={s.kpiValue}>{fmt(total)} ₽</div></div>
        <div style={{...s.kpiCard,borderColor:"#A8D9BB",background:C.greenBg}}>
          <div style={s.kpiLabel}>Получено</div><div style={{...s.kpiValue,color:C.green}}>{fmt(paid)} ₽</div>
        </div>
        <div style={{...s.kpiCard,borderColor:"#F5C6C2",background:C.redBg}}>
          <div style={s.kpiLabel}>Остаток</div><div style={{...s.kpiValue,color:C.red}}>{fmt(rem)} ₽</div>
        </div>
      </div>
      {total>0&&(
        <div style={s.section}>
          <div style={s.sectionTitle}>Оплачено</div>
          <div style={s.progressWrap}><div style={{...s.progressBar,width:`${Math.round(paid/total*100)}%`}}/></div>
          <div style={{display:"flex",justifyContent:"space-between",marginTop:6}}>
            <span style={{fontSize:12,color:C.green,fontWeight:700}}>{Math.round(paid/total*100)}%</span>
            <span style={{fontSize:12,color:C.textMuted}}>{fmt(total)} ₽ всего</span>
          </div>
        </div>
      )}
      {months.length>0&&(
        <div style={s.section}>
          <div style={s.sectionTitle}>По месяцам</div>
          <div style={s.chartWrap}>
            {months.map((m,i)=>(
              <div key={i} style={s.chartCol}>
                <div style={s.chartBarWrap}>
                  <div style={s.chartBarBg}>
                    <div style={{...s.chartBarFill,height:`${Math.round(m.total/maxVal*100)}%`}}/>
                    <div style={{...s.chartBarPaid,height:`${Math.round(m.paid/maxVal*100)}%`}}/>
                  </div>
                </div>
                <div style={s.chartLabel}>{m.label}</div>
                <div style={s.chartCount}>{m.count} зак.</div>
              </div>
            ))}
          </div>
          <div style={s.chartLegend}>
            <span style={{...s.legendDot,background:C.border2}}/><span style={s.legendText}>Сумма</span>
            <span style={{...s.legendDot,background:C.green,marginLeft:12}}/><span style={s.legendText}>Оплачено</span>
          </div>
        </div>
      )}
      {sources.length>0&&(
        <div style={s.section}>
          <div style={s.sectionTitle}>Источники</div>
          {sources.map(([src,cnt])=>(
            <div key={src} style={s.sourceRow}>
              <span style={s.sourceName}>{src}</span>
              <div style={s.sourceBarWrap}><div style={{...s.sourceBarFill,width:`${Math.round(cnt/active.length*100)}%`}}/></div>
              <span style={s.sourceCnt}>{cnt}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
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
    .filter(c=>c.name.toLowerCase().includes(search.toLowerCase())||c.phone?.includes(search))
    .sort((a,b)=>a.name.localeCompare(b.name,"ru"));
  return (
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <div style={{padding:"12px 16px",borderBottom:`1px solid ${C.border}`}}>
        <input style={{...s.input,fontSize:14}} className="crm-input"
          placeholder="🔍 Поиск по имени или телефону..."
          value={search} onChange={e=>setSearch(e.target.value)}/>
      </div>
      <div style={{flex:1,overflowY:"auto"}}>
        {clients.length===0&&(
          <div style={s.emptyState}><div style={{fontSize:44}}>👥</div>
            <div style={{color:C.textMuted,fontSize:13,textAlign:"center"}}>Клиенты появятся автоматически<br/>когда добавишь мероприятия</div>
          </div>
        )}
        {clients.map((c,i)=>(
          <div key={i} style={s.card}>
            <div style={s.cardRow}>
              <span style={s.cardTitle}>{c.name}</span>
              <span style={{...s.tag,color:C.textSub,background:C.tagBg}}>{c.count} зак.</span>
            </div>
            {c.phone&&<a href={`tel:${c.phone}`} style={{fontSize:14,color:C.accent,fontWeight:600,textDecoration:"none",display:"block",marginBottom:6}}>{c.phone}</a>}
            <div style={s.cardTags}>
              {c.events.slice(0,3).map(ev=><Tag key={ev.id}>{ev.title||"Без названия"}</Tag>)}
              {c.events.length>3&&<Tag>+{c.events.length-3}</Tag>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
function Calendar({ events, onEventClick }) {
  const now=new Date();
  const [year,setYear]=useState(now.getFullYear());
  const [month,setMonth]=useState(now.getMonth());
  const [selected,setSelected]=useState(null);
  const active=events.filter(e=>!e.archived);
  const prevMonth=()=>{ if(month===0){setMonth(11);setYear(y=>y-1);}else setMonth(m=>m-1); };
  const nextMonth=()=>{ if(month===11){setMonth(0);setYear(y=>y+1);}else setMonth(m=>m+1); };
  const firstDay=new Date(year,month,1);
  const lastDay=new Date(year,month+1,0);
  const startDow=(firstDay.getDay()+6)%7;
  const totalCells=Math.ceil((startDow+lastDay.getDate())/7)*7;
  const cells=Array.from({length:totalCells},(_,i)=>{ const d=i-startDow+1; return d>=1&&d<=lastDay.getDate()?d:null; });
  const evByDay={};
  active.forEach(ev=>{
    if(!ev.date) return;
    const [ey,em,ed]=ev.date.split("-");
    if(parseInt(ey)===year&&parseInt(em)-1===month){
      const d=parseInt(ed);
      if(!evByDay[d]) evByDay[d]=[];
      evByDay[d].push(ev);
    }
  });
  const today=now.getFullYear()===year&&now.getMonth()===month?now.getDate():null;
  const selectedEvs=selected?(evByDay[selected]||[]):[];
  return (
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 16px",borderBottom:`1px solid ${C.border}`}}>
        <button style={s.calNavBtn} onClick={prevMonth}>‹</button>
        <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,letterSpacing:2,color:C.accent}}>{MONTHS_RU[month]} {year}</span>
        <button style={s.calNavBtn} onClick={nextMonth}>›</button>
      </div>
      <div style={s.calDayHeaders}>{DAYS_SHORT.map(d=><div key={d} style={s.calDayHeader}>{d}</div>)}</div>
      <div style={s.calGrid}>
        {cells.map((d,i)=>{
          const hasEv=d&&evByDay[d]&&evByDay[d].length>0;
          const isToday=d&&d===today;
          const isSel=d&&d===selected;
          return (
            <div key={i} style={{...s.calCell,...(isToday?{background:C.accent,borderRadius:20}:{}),...(isSel&&!isToday?{background:C.tagBg,borderRadius:20}:{}),...(d?{cursor:"pointer"}:{opacity:0})}}
              onClick={()=>d&&setSelected(d===selected?null:d)}>
              {d&&<span style={{fontSize:14,fontWeight:isToday?700:400,color:isToday?"#fff":C.text}}>{d}</span>}
              {hasEv&&<div style={{...s.calDot,background:isToday?"#fff":C.green}}/>}
            </div>
          );
        })}
      </div>
      <div style={{flex:1,overflowY:"auto",borderTop:`1px solid ${C.border}`}}>
        {selected&&selectedEvs.length===0&&<div style={{padding:"20px 16px",color:C.textMuted,fontSize:13,textAlign:"center"}}>Нет мероприятий {selected}.{String(month+1).padStart(2,"0")}</div>}
        {!selected&&<div style={{padding:"20px 16px",color:C.textMuted,fontSize:13,textAlign:"center"}}>Нажми на день чтобы увидеть мероприятия</div>}
        {selectedEvs.map(ev=><EventCard key={ev.id} ev={ev} onClick={()=>onEventClick(ev)}/>)}
      </div>
    </div>
  );
}
function NotesEditor({ event, onBack, onSave }) {
  const taRef=useRef(null);
  const timerRef=useRef(null);
  const [val,setVal]=useState(event.notes||"");
  useEffect(()=>{ setTimeout(()=>{ if(taRef.current){ taRef.current.focus(); const l=taRef.current.value.length; taRef.current.setSelectionRange(l,l); }},80); },[]);
  const handleChange=(v)=>{ setVal(v); clearTimeout(timerRef.current); timerRef.current=setTimeout(()=>onSave(v),1500); };
  const handleKeyDown=(e)=>{
    if(e.key!=="Enter") return;
    const ta=taRef.current,pos=ta.selectionStart,text=ta.value;
    const lineStart=text.lastIndexOf("\n",pos-1)+1;
    const curLine=text.slice(lineStart,pos);
    const numMatch=curLine.match(/^(\s*)(\d+)\.\s/);
    const dashMatch=curLine.match(/^(\s*)-\s/);
    let prefix=null;
    if(numMatch){
      if(curLine.trim()===numMatch[2]+"."){e.preventDefault();const nv=text.slice(0,lineStart)+"\n"+text.slice(pos);handleChange(nv);setTimeout(()=>ta.setSelectionRange(lineStart+1,lineStart+1),0);return;}
      prefix=numMatch[1]+(parseInt(numMatch[2])+1)+". ";
    } else if(dashMatch){
      if(curLine.trim()==="-"){e.preventDefault();const nv=text.slice(0,lineStart)+"\n"+text.slice(pos);handleChange(nv);setTimeout(()=>ta.setSelectionRange(lineStart+1,lineStart+1),0);return;}
      prefix=dashMatch[1]+"- ";
    }
    if(prefix){e.preventDefault();const nv=text.slice(0,pos)+"\n"+prefix+text.slice(ta.selectionEnd);handleChange(nv);const np=pos+1+prefix.length;setTimeout(()=>ta.setSelectionRange(np,np),0);}
  };
  const autoResize=()=>{ const ta=taRef.current; if(!ta) return; ta.style.height="auto"; ta.style.height=ta.scrollHeight+"px"; };
  useEffect(()=>autoResize(),[val]);
  return (
    <div style={sn.screen}>
      <style>{`.nb{background:none;border:none;cursor:pointer;padding:8px 12px;color:#555;font-size:28px;line-height:1;font-weight:300;}.nb:active{opacity:0.4;}.nt{width:100%;border:none;outline:none;resize:none;overflow:hidden;font-family:'Google Sans',Roboto,sans-serif;font-size:16px;line-height:1.85;color:#202124;background:transparent;padding:0;box-sizing:border-box;}.nt::placeholder{color:#bdbdbd;}`}</style>
      <div style={sn.topBar}><button className="nb" onClick={onBack}>‹</button><span style={sn.saveHint}>авто-сохранение</span></div>
      <div style={sn.scroll}>
        <div style={sn.titleText}>{event.title}</div>
        <textarea ref={taRef} className="nt" placeholder="Начни писать..." value={val}
          onChange={e=>{handleChange(e.target.value);autoResize();}} onKeyDown={handleKeyDown}/>
      </div>
    </div>
  );
}

function App() {
  const [events,setEvents]=useState([]);
  const [view,setView]=useState(V.LIST);
  const [activeId,setActiveId]=useState(null);
  const [draft,setDraft]=useState(null);
  const [deleteConfirm,setDeleteConfirm]=useState(false);
  const [archiveConfirm,setArchiveConfirm]=useState(false);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState(null);
  const notesTimer=useRef(null);

  useEffect(()=>{
    (async()=>{
      try { setEvents(await dbLoad()); }
      catch(e){ setError("Не удалось загрузить: "+e.message); }
      finally { setLoading(false); }
    })();
  },[]);

  const activeEvent=events.find(e=>e.id===activeId)||null;
  const activeEvents=[...events].filter(e=>!e.archived).sort((a,b)=>(a.date||"").localeCompare(b.date||""));
  const archivedEvents=[...events].filter(e=>e.archived).sort((a,b)=>(b.date||"").localeCompare(a.date||""));

  const openEvent=(ev)=>{ setActiveId(ev.id); setView(V.EVENT); };
  const openNew=()=>{ setDraft(emptyEvent()); setView(V.FORM); };
  const openEdit=()=>{ setDraft({...activeEvent}); setView(V.FORM); };

  const saveForm=async()=>{
    if(!draft.title.trim()) return;
    setSaving(true);
    try {
      await dbUpsert(draft);
      const exists=events.find(e=>e.id===draft.id);
      const upd=exists?events.map(e=>e.id===draft.id?draft:e):[draft,...events];
      setEvents(upd); setActiveId(draft.id); setView(V.EVENT); setDraft(null);
    } catch(e){ setError("Ошибка: "+e.message); }
    finally{ setSaving(false); }
  };

  const cancelForm=()=>{ setView(activeId?V.EVENT:V.LIST); setDraft(null); };

  const doDelete=async()=>{
    try {
      await dbDelete(activeId);
      setEvents(events.filter(e=>e.id!==activeId));
      setActiveId(null); setDeleteConfirm(false);
      setView(activeEvent?.archived?V.ARCHIVE:V.LIST);
    } catch(e){ setError("Ошибка: "+e.message); }
  };

  const doArchive=async()=>{
    if(!activeEvent) return;
    const updated={...activeEvent,archived:!activeEvent.archived};
    try {
      await dbUpsert(updated);
      setEvents(events.map(e=>e.id===activeId?updated:e));
      setArchiveConfirm(false);
      setView(updated.archived?V.ARCHIVE:V.LIST);
    } catch(e){ setError("Ошибка: "+e.message); }
  };

  const updateNotes=(val)=>{
    const upd=events.map(e=>e.id===activeId?{...e,notes:val}:e);
    setEvents(upd);
    clearTimeout(notesTimer.current);
    notesTimer.current=setTimeout(async()=>{
      const ev=upd.find(e=>e.id===activeId);
      if(ev){ try{ await dbUpsert(ev); }catch{} }
    },1500);
  };

  const setField=(f,v)=>setDraft(d=>({...d,[f]:v}));
  const onTab=(t)=>{ setActiveId(null); setDraft(null); setView(t); };
  const TAB_VIEWS=[V.LIST,V.CAL,V.CLIENTS,V.DASH,V.ARCHIVE];
  const showTab=TAB_VIEWS.includes(view);

  if(loading) return <Screen><div style={s.loadingWrap}><div style={s.spinner}/><div style={{color:C.textMuted,fontSize:13,marginTop:12}}>Загружаем данные...</div></div></Screen>;

  if(view===V.LIST) return (
    <Screen>
      <TopBar title="HOST CRM" titleStyle={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,letterSpacing:3,color:C.accent}}
        right={<button style={s.addBtn} className="add-btn" onClick={openNew}>+</button>}/>
      {error&&<div style={s.errorBanner} onClick={()=>setError(null)}>{error} ✕</div>}
      <div style={{flex:1,overflowY:"auto"}}>
        {activeEvents.length===0&&<div style={s.emptyState}><div style={{fontSize:52}}>🎤</div><div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,color:C.textMuted,letterSpacing:2}}>Нет мероприятий</div><div style={{color:C.textMuted,fontSize:13}}>Нажми «+» чтобы добавить</div></div>}
        {activeEvents.map(ev=><EventCard key={ev.id} ev={ev} onClick={()=>openEvent(ev)}/>)}
      </div>
      <TabBar view={view} onTab={onTab}/>
    </Screen>
  );

  if(view===V.ARCHIVE) return (
    <Screen>
      <TopBar title="АРХИВ" titleStyle={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,letterSpacing:3,color:C.accent}}/>
      {error&&<div style={s.errorBanner} onClick={()=>setError(null)}>{error} ✕</div>}
      <div style={{flex:1,overflowY:"auto"}}>
        {archivedEvents.length===0&&<div style={s.emptyState}><div style={{fontSize:52}}>🗂</div><div style={{color:C.textMuted,fontSize:13}}>Архив пуст</div></div>}
        {archivedEvents.map(ev=><EventCard key={ev.id} ev={ev} onClick={()=>openEvent(ev)}/>)}
      </div>
      <TabBar view={view} onTab={onTab}/>
    </Screen>
  );

  if(view===V.CLIENTS) return (
    <Screen>
      <TopBar title="КЛИЕНТЫ" titleStyle={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,letterSpacing:3,color:C.accent}}/>
      <Clients events={events}/>
      <TabBar view={view} onTab={onTab}/>
    </Screen>
  );

  if(view===V.CAL) return (
    <Screen>
      <TopBar title="КАЛЕНДАРЬ" titleStyle={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,letterSpacing:3,color:C.accent}}/>
      <Calendar events={events} onEventClick={ev=>{ setActiveId(ev.id); setView(V.EVENT); }}/>
      <TabBar view={view} onTab={onTab}/>
    </Screen>
  );

  if(view===V.DASH) return (
    <Screen>
      <TopBar title="ИТОГИ" titleStyle={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,letterSpacing:3,color:C.accent}}/>
      <Dashboard events={events}/>
      <TabBar view={view} onTab={onTab}/>
    </Screen>
  );

  if(view===V.EVENT&&activeEvent) {
    const rem=remaining(activeEvent);
    const isArchived=activeEvent.archived;
    return (
      <Screen>
        <TopBar
          left={<BackBtn onClick={()=>setView(isArchived?V.ARCHIVE:V.LIST)}/>}
          title={activeEvent.title}
          right={<div style={{display:"flex",gap:6}}>
            {!isArchived&&<button style={s.iconBtn} className="icon-btn" onClick={openEdit}>✏️</button>}
            <button style={{...s.iconBtn,borderColor:isArchived?"#A8D9BB":"#FFD9A0"}} className="icon-btn" onClick={()=>setArchiveConfirm(true)}>{isArchived?"📤":"🗂"}</button>
            <button style={{...s.iconBtn,borderColor:"#F5C6C2"}} className="icon-btn-del" onClick={()=>setDeleteConfirm(true)}>🗑</button>
          </div>}
        />
        {isArchived&&<div style={s.archiveBanner}>🗂 В архиве</div>}
        {error&&<div style={s.errorBanner} onClick={()=>setError(null)}>{error} ✕</div>}
        <div style={{flex:1,overflowY:"auto"}}>
          {activeEvent.date&&<div style={s.eventDate}>{formatDate(activeEvent.date)}</div>}
          <div style={s.infoGrid}>
            {activeEvent.source&&<InfoCard label="Источник" value={activeEvent.source}/>}
            {activeEvent.clientName&&<InfoCard label="Заказчик" value={activeEvent.clientName}/>}
            {activeEvent.clientPhone&&<InfoCard label="Телефон"><a href={`tel:${activeEvent.clientPhone}`} style={{color:C.accent,fontWeight:700,fontSize:14,textDecoration:"none"}}>{activeEvent.clientPhone}</a></InfoCard>}
            {activeEvent.totalCost&&<InfoCard label="Стоимость" value={activeEvent.totalCost+" ₽"}/>}
            {activeEvent.totalCost&&<InfoCard label="Остаток" accent={rem>0?"red":"green"} value={rem>0?fmt(rem)+" ₽":"✓ Оплачено"}/>}
          </div>
          <div style={s.notesBlock} className="tap-card" onClick={()=>setView(V.NOTES)}>
            <div style={s.notesBlockLabel}>📝 Заметки</div>
            <div style={s.notesBlockText}>{activeEvent.notes?activeEvent.notes.slice(0,140)+(activeEvent.notes.length>140?"…":""):<span style={{color:C.textMuted}}>Нажми чтобы добавить заметки...</span>}</div>
          </div>
        </div>
        {archiveConfirm&&<div style={s.overlay} onClick={()=>setArchiveConfirm(false)}><div style={s.confirmBox} onClick={e=>e.stopPropagation()}><div style={s.confirmTitle}>{isArchived?"Восстановить?":"В архив?"}</div><div style={s.confirmSub}>{isArchived?"Мероприятие вернётся в активные.":"Мероприятие переместится в архив."}</div><div style={{display:"flex",gap:8}}><button style={s.btnGhost} onClick={()=>setArchiveConfirm(false)}>Отмена</button><button style={{...s.btnSolid,background:isArchived?C.green:C.orange,flex:1}} onClick={doArchive}>{isArchived?"Восстановить":"Архивировать"}</button></div></div></div>}
        {deleteConfirm&&<div style={s.overlay} onClick={()=>setDeleteConfirm(false)}><div style={s.confirmBox} onClick={e=>e.stopPropagation()}><div style={s.confirmTitle}>Удалить мероприятие?</div><div style={s.confirmSub}>Данные будут удалены навсегда.</div><div style={{display:"flex",gap:8}}><button style={s.btnGhost} onClick={()=>setDeleteConfirm(false)}>Отмена</button><button style={{...s.btnSolid,background:C.red,flex:1}} onClick={doDelete}>Удалить</button></div></div></div>}
      </Screen>
    );
  }

  if(view===V.NOTES&&activeEvent) return <NotesEditor event={activeEvent} onBack={()=>setView(V.EVENT)} onSave={updateNotes}/>;

  if(view===V.FORM&&draft) {
    const rem=remaining(draft);
    return (
      <Screen>
        <TopBar left={<BackBtn onClick={cancelForm}/>} title={events.find(e=>e.id===draft.id)?"Редактировать":"Новое"}
          right={<button style={{...s.btnSolid,opacity:draft.title.trim()&&!saving?1:0.4}} onClick={saveForm}>{saving?"...":"Сохранить"}</button>}/>
        {error&&<div style={s.errorBanner} onClick={()=>setError(null)}>{error} ✕</div>}
        <div style={{flex:1,overflowY:"auto",padding:"16px 16px 48px"}}>
          <Field label="Название *"><input style={s.input} className="crm-input" placeholder="Свадьба Ивановых" value={draft.title} autoFocus onChange={e=>setField("title",e.target.value)}/></Field>
          <Field label="Дата мероприятия"><input type="date" style={s.input} className="crm-input" value={draft.date} onChange={e=>setField("date",e.target.value)}/></Field>
          <Field label="Откуда заказ">
            <div style={s.sourceWrap}>{SOURCE_OPTIONS.map(opt=><button key={opt} style={{...s.sourceChip,...(draft.source===opt?s.sourceChipActive:{})}} onClick={()=>setField("source",draft.source===opt?"":opt)}>{opt}</button>)}</div>
            <input style={{...s.input,marginTop:8}} className="crm-input" placeholder="Или напиши свой вариант..." value={SOURCE_OPTIONS.includes(draft.source)?"":draft.source} onChange={e=>setField("source",e.target.value)}/>
          </Field>
          <Field label="Имя заказчика"><input style={s.input} className="crm-input" placeholder="Анна Иванова" value={draft.clientName} onChange={e=>setField("clientName",e.target.value)}/></Field>
          <Field label="Номер заказчика"><input style={s.input} className="crm-input" placeholder="+7 (___) ___-__-__" inputMode="tel" value={draft.clientPhone} onChange={e=>setField("clientPhone",formatPhone(e.target.value))}/></Field>
          <Field label="Стоимость заказа, ₽"><input style={s.input} className="crm-input" placeholder="50 000" inputMode="numeric" value={draft.totalCost} onChange={e=>setField("totalCost",formatMoney(e.target.value))}/></Field>
          <Field label="Оплачено, ₽"><input style={s.input} className="crm-input" placeholder="25 000" inputMode="numeric" value={draft.paidCost} onChange={e=>setField("paidCost",formatMoney(e.target.value))}/></Field>
          {draft.totalCost&&<div style={s.remainBanner}><span style={{color:C.textSub,fontSize:13}}>Остаток: </span><span style={{color:rem>0?C.red:C.green,fontWeight:800,fontSize:15}}>{rem>0?`${fmt(rem)} ₽`:"Полностью оплачено ✓"}</span></div>}
        </div>
      </Screen>
    );
  }
  return null;
}

const s = {
  screen:{display:"flex",flexDirection:"column",height:"100vh",width:"100%",background:C.bg,color:C.text,fontFamily:"'Montserrat',sans-serif",overflow:"hidden"},
  topBar:{display:"flex",alignItems:"center",padding:"0 12px",height:56,borderBottom:`1px solid ${C.border}`,background:C.surface,flexShrink:0,gap:8,boxShadow:"0 1px 0 rgba(0,0,0,0.04)"},
  topSide:{width:80,display:"flex",alignItems:"center",flexShrink:0},
  topTitle:{flex:1,textAlign:"center",fontWeight:700,fontSize:15,color:C.text,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"},
  backBtn:{background:"none",border:"none",color:C.accent,fontSize:34,cursor:"pointer",lineHeight:1,padding:"0 4px 2px",fontWeight:300},
  addBtn:{width:36,height:36,background:C.accent,border:"none",color:"#fff",fontSize:22,fontWeight:900,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",borderRadius:0,lineHeight:1},
  iconBtn:{background:"none",border:`1px solid ${C.border2}`,color:C.textSub,width:36,height:36,fontSize:15,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",borderRadius:0},
  tabBar:{display:"flex",borderTop:`1px solid ${C.border}`,background:C.surface,flexShrink:0,height:58},
  tabBtn:{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"none",border:"none",cursor:"pointer",gap:2,opacity:0.45,padding:"4px 0"},
  tabActive:{opacity:1},
  loadingWrap:{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"},
  spinner:{width:32,height:32,border:`3px solid ${C.border}`,borderTop:`3px solid ${C.accent}`,borderRadius:"50%",animation:"spin 0.8s linear infinite"},
  errorBanner:{background:C.redBg,color:C.red,fontSize:12,padding:"10px 16px",borderBottom:`1px solid #F5C6C2`,cursor:"pointer",flexShrink:0},
  archiveBanner:{background:C.orangeBg,color:C.orange,fontSize:12,padding:"8px 16px",borderBottom:`1px solid #FDDCB5`,flexShrink:0,fontWeight:700},
  emptyState:{display:"flex",flexDirection:"column",alignItems:"center",gap:12,padding:60,textAlign:"center"},
  card:{padding:"14px 16px",borderBottom:`1px solid ${C.border}`,cursor:"pointer",background:C.surface},
  cardRow:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,marginBottom:3},
  cardTitle:{fontWeight:700,fontSize:15,color:C.text,flex:1},
  cardDate:{fontSize:12,color:C.textMuted,whiteSpace:"nowrap",marginTop:2},
  cardSub:{fontSize:12,color:C.textSub,marginBottom:8},
  cardTags:{display:"flex",flexWrap:"wrap",gap:6},
  tag:{fontSize:11,fontWeight:700,padding:"3px 8px",letterSpacing:0.3},
  eventDate:{padding:"10px 16px 0",fontSize:12,color:C.textMuted},
  infoGrid:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,padding:"10px 16px"},
  infoCard:{background:C.surface,border:`1px solid ${C.border}`,padding:"10px 12px",display:"flex",flexDirection:"column",gap:4},
  infoLabel:{fontSize:9,color:C.textMuted,fontWeight:700,letterSpacing:1,textTransform:"uppercase"},
  infoVal:{fontSize:14,fontWeight:700,wordBreak:"break-word"},
  notesBlock:{margin:"0 16px 16px",border:`1px solid ${C.border}`,borderLeft:`3px solid ${C.accent}`,background:C.surface,padding:"12px 14px",cursor:"pointer"},
  notesBlockLabel:{fontSize:11,color:C.accent,fontWeight:700,letterSpacing:1,marginBottom:8},
  notesBlockText:{fontSize:13,color:C.textSub,lineHeight:1.6},
  input:{width:"100%",background:C.surface,border:`1px solid ${C.border2}`,color:C.text,padding:"12px 14px",fontSize:15,fontFamily:"'Montserrat',sans-serif",borderRadius:0,outline:"none",boxSizing:"border-box"},
  fieldLabel:{fontSize:10,color:C.textSub,fontWeight:700,letterSpacing:1,textTransform:"uppercase",marginBottom:8},
  sourceWrap:{display:"flex",flexWrap:"wrap",gap:8},
  sourceChip:{background:C.surface,border:`1px solid ${C.border2}`,color:C.textSub,padding:"8px 14px",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",borderRadius:0},
  sourceChipActive:{background:C.accent,border:`1px solid ${C.accent}`,color:"#fff"},
  remainBanner:{background:C.surface,border:`1px solid ${C.border}`,padding:"12px 16px",display:"flex",gap:8,alignItems:"center"},
  btnSolid:{background:C.accent,border:"none",color:"#fff",padding:"8px 14px",fontWeight:800,fontSize:13,fontFamily:"'Montserrat',sans-serif",cursor:"pointer",borderRadius:0,whiteSpace:"nowrap"},
  btnGhost:{background:"none",border:`1px solid ${C.border2}`,color:C.textSub,padding:"12px 20px",fontWeight:600,fontSize:13,fontFamily:"'Montserrat',sans-serif",cursor:"pointer",borderRadius:0,flex:1},
  overlay:{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",display:"flex",alignItems:"flex-end",zIndex:200},
  confirmBox:{background:C.surface,borderTop:`1px solid ${C.border}`,padding:"24px 16px 36px",width:"100%",display:"flex",flexDirection:"column",gap:12,boxShadow:"0 -4px 24px rgba(0,0,0,0.1)"},
  confirmTitle:{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,color:C.red,letterSpacing:1},
  confirmSub:{fontSize:13,color:C.textSub},
  kpiGrid:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:16},
  kpiCard:{background:C.surface,border:`1px solid ${C.border}`,padding:"14px",display:"flex",flexDirection:"column",gap:4},
  kpiLabel:{fontSize:10,color:C.textMuted,fontWeight:700,letterSpacing:1,textTransform:"uppercase"},
  kpiValue:{fontSize:18,fontWeight:800,color:C.text,lineHeight:1.2},
  section:{background:C.surface,border:`1px solid ${C.border}`,padding:"14px",marginBottom:12},
  sectionTitle:{fontSize:11,color:C.textMuted,fontWeight:700,letterSpacing:1,textTransform:"uppercase",marginBottom:12},
  progressWrap:{height:10,background:C.border,overflow:"hidden"},
  progressBar:{height:"100%",background:C.green,transition:"width 0.4s"},
  chartWrap:{display:"flex",gap:6,alignItems:"flex-end",height:100},
  chartCol:{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4},
  chartBarWrap:{flex:1,width:"100%",display:"flex",alignItems:"flex-end"},
  chartBarBg:{width:"100%",height:80,background:C.bg,position:"relative",display:"flex",alignItems:"flex-end"},
  chartBarFill:{position:"absolute",bottom:0,left:0,right:0,background:C.border2,transition:"height 0.4s"},
  chartBarPaid:{position:"absolute",bottom:0,left:0,right:0,background:C.green,transition:"height 0.4s"},
  chartLabel:{fontSize:9,color:C.textMuted,fontWeight:700,textAlign:"center",whiteSpace:"nowrap"},
  chartCount:{fontSize:9,color:C.textMuted,textAlign:"center"},
  chartLegend:{display:"flex",alignItems:"center",marginTop:10,gap:4},
  legendDot:{width:8,height:8,borderRadius:"50%",flexShrink:0},
  legendText:{fontSize:11,color:C.textMuted},
  sourceRow:{display:"flex",alignItems:"center",gap:8,marginBottom:8},
  sourceName:{fontSize:12,fontWeight:700,color:C.text,width:80,flexShrink:0},
  sourceBarWrap:{flex:1,height:6,background:C.bg,overflow:"hidden"},
  sourceBarFill:{height:"100%",background:C.accent,transition:"width 0.4s"},
  sourceCnt:{fontSize:12,color:C.textMuted,fontWeight:700,width:20,textAlign:"right"},
  calNavBtn:{background:"none",border:"none",fontSize:26,color:C.accent,cursor:"pointer",padding:"0 8px",fontWeight:300},
  calDayHeaders:{display:"grid",gridTemplateColumns:"repeat(7,1fr)",padding:"0 8px"},
  calDayHeader:{textAlign:"center",fontSize:11,fontWeight:700,color:C.textMuted,padding:"4px 0"},
  calGrid:{display:"grid",gridTemplateColumns:"repeat(7,1fr)",padding:"4px 8px 8px",gap:"2px 0"},
  calCell:{display:"flex",flexDirection:"column",alignItems:"center",padding:"4px 2px",minHeight:40,justifyContent:"center",gap:3},
  calDot:{width:5,height:5,borderRadius:"50%"},
};
const sn={
  screen:{display:"flex",flexDirection:"column",height:"100vh",width:"100%",background:"#fff",fontFamily:"'Google Sans',Roboto,sans-serif",overflow:"hidden"},
  topBar:{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"4px 8px",borderBottom:"1px solid #f1f3f4",flexShrink:0,minHeight:52},
  saveHint:{fontSize:11,color:"#bdbdbd",paddingRight:12},
  scroll:{flex:1,overflowY:"auto",padding:"12px 20px 40px"},
  titleText:{fontSize:22,fontWeight:500,color:"#202124",marginBottom:16,lineHeight:1.3},
};

export default function Root() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Montserrat:wght@400;600;700;800&display=swap');
        @keyframes spin{to{transform:rotate(360deg);}}
        *{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent;}
        body{background:${C.bg};}
        ::-webkit-scrollbar{width:3px;}
        ::-webkit-scrollbar-thumb{background:${C.border2};}
        .tap-card:active{background:${C.bg}!important;}
        .add-btn:active{background:#333!important;}
        .icon-btn:active{background:${C.bg}!important;}
        .icon-btn-del:active{background:${C.redBg}!important;}
        .crm-input:focus{border-color:${C.accent}!important;}
      `}</style>
      <App/>
    </>
  );
}
