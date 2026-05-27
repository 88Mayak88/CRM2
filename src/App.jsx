import { useState, useEffect, useRef, useCallback } from "react";

// ── Supabase config ───────────────────────────────────────
const SB_URL = "https://ouufkogrixukhsccbhxe.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91dWZrb2dyaXh1a2hzY2NiaHhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3MzQzODYsImV4cCI6MjA5NDMxMDM4Nn0.rFvGAUkJd6qr4HpkYzWGONd8LrspTfCdxSUcUQ3C9y8";
const HEADERS = { "Content-Type": "application/json", "apikey": SB_KEY, "Authorization": `Bearer ${SB_KEY}` };

function rowToEvent(r) {
  return { id: r.id, title: r.title||"", date: r.date||"", source: r.source||"",
    clientName: r.client_name||"", clientPhone: r.client_phone||"",
    totalCost: r.total_cost||"", paidCost: r.paid_cost||"",
    notes: r.notes||"", createdAt: r.created_at||"" };
}
function eventToRow(e) {
  return { id: e.id, title: e.title, date: e.date, source: e.source,
    client_name: e.clientName, client_phone: e.clientPhone,
    total_cost: e.totalCost, paid_cost: e.paidCost,
    notes: e.notes, created_at: e.createdAt };
}
async function dbLoad() {
  const res = await fetch(`${SB_URL}/rest/v1/events?order=date.asc`, { headers: HEADERS });
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()).map(rowToEvent);
}
async function dbUpsert(ev) {
  const res = await fetch(`${SB_URL}/rest/v1/events`, {
    method: "POST", headers: { ...HEADERS, "Prefer": "resolution=merge-duplicates" },
    body: JSON.stringify(eventToRow(ev)) });
  if (!res.ok) throw new Error(await res.text());
}
async function dbDelete(id) {
  const res = await fetch(`${SB_URL}/rest/v1/events?id=eq.${id}`, { method: "DELETE", headers: HEADERS });
  if (!res.ok) throw new Error(await res.text());
}

// ── helpers ───────────────────────────────────────────────
const SOURCE_OPTIONS = ["Авито", "Instagram", "ВКонтакте", "Сарафан", "Telegram", "TikTok", "Другое"];
const MONTHS_RU = ["Янв","Фев","Мар","Апр","Май","Июн","Июл","Авг","Сен","Окт","Ноя","Дек"];

function formatPhone(val) {
  const d = val.replace(/\D/g,"").slice(0,11); if (!d) return "";
  let r = "+7";
  if (d.length>1) r+=" ("+d.slice(1,4);
  if (d.length>=4) r+=") "+d.slice(4,7);
  if (d.length>=7) r+="-"+d.slice(7,9);
  if (d.length>=9) r+="-"+d.slice(9,11);
  return r;
}
function formatMoney(val) { const n=val.replace(/\D/g,""); return n?n.replace(/\B(?=(\d{3})+(?!\d))/g," "):""; }
function parseMoney(str)  { return parseInt((str||"").replace(/\s/g,""),10)||0; }
function remaining(ev)    { return parseMoney(ev.totalCost)-parseMoney(ev.paidCost); }
function formatDate(d)    { if(!d) return ""; const [y,m,day]=d.split("-"); return `${day}.${m}.${y}`; }
function fmt(n)           { return n.toLocaleString("ru"); }

const emptyEvent = () => ({ id: Date.now().toString(), title:"", date:"", source:"",
  clientName:"", clientPhone:"", totalCost:"", paidCost:"", notes:"", createdAt: new Date().toISOString() });

const VIEW_LIST="list", VIEW_EVENT="event", VIEW_NOTES="notes", VIEW_FORM="form", VIEW_DASH="dash";

// ── palette ───────────────────────────────────────────────
const C = {
  bg:"#F5F3EF", surface:"#FFFFFF", border:"#E8E4DE", border2:"#D6D0C8",
  accent:"#1A1A1A", accentBtn:"#1A1A1A", text:"#1A1A1A",
  textSub:"#888077", textMuted:"#B5AFA6",
  green:"#2D7D4F", greenBg:"#EAF5EE",
  red:"#C0392B", redBg:"#FDECEA",
  tagBg:"#EEEBE5", tagText:"#7A7268", topBar:"#FFFFFF",
};

// ── components ────────────────────────────────────────────
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
  const ex = accent==="red"?{borderColor:"#F5C6C2",background:C.redBg}:accent==="green"?{borderColor:"#A8D9BB",background:C.greenBg}:{};
  const vc = accent==="red"?C.red:accent==="green"?C.green:C.text;
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

// ── Bottom Tab Bar ────────────────────────────────────────
function TabBar({ view, onTab }) {
  const tabs = [
    { id: VIEW_LIST, icon: "📋", label: "Заказы" },
    { id: VIEW_DASH, icon: "📊", label: "Итоги" },
  ];
  return (
    <div style={s.tabBar}>
      {tabs.map(t => (
        <button key={t.id} style={{...s.tabBtn,...(view===t.id?s.tabBtnActive:{})}} onClick={()=>onTab(t.id)}>
          <span style={{fontSize:20}}>{t.icon}</span>
          <span style={{fontSize:10,fontWeight:700,letterSpacing:0.5,marginTop:2,color:view===t.id?C.accent:C.textMuted}}>{t.label}</span>
        </button>
      ))}
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────
function Dashboard({ events }) {
  const total       = events.reduce((s,e)=>s+parseMoney(e.totalCost),0);
  const paid        = events.reduce((s,e)=>s+parseMoney(e.paidCost),0);
  const rem         = total - paid;
  const count       = events.length;

  // group by month
  const byMonth = {};
  events.forEach(ev => {
    if (!ev.date) return;
    const [y,m] = ev.date.split("-");
    const key = `${y}-${m}`;
    if (!byMonth[key]) byMonth[key] = { label: `${MONTHS_RU[parseInt(m)-1]} ${y}`, total:0, paid:0, count:0 };
    byMonth[key].total += parseMoney(ev.totalCost);
    byMonth[key].paid  += parseMoney(ev.paidCost);
    byMonth[key].count += 1;
  });
  const months = Object.values(byMonth).slice(-6); // last 6 months
  const maxVal = Math.max(...months.map(m=>m.total), 1);

  // by source
  const bySource = {};
  events.forEach(ev => {
    const src = ev.source || "Другое";
    bySource[src] = (bySource[src]||0)+1;
  });
  const sources = Object.entries(bySource).sort((a,b)=>b[1]-a[1]);

  return (
    <div style={{flex:1,overflowY:"auto",padding:"16px 16px 24px"}}>

      {/* KPI cards */}
      <div style={s.kpiGrid}>
        <div style={s.kpiCard}>
          <div style={s.kpiLabel}>Всего заказов</div>
          <div style={s.kpiValue}>{count}</div>
        </div>
        <div style={s.kpiCard}>
          <div style={s.kpiLabel}>Общая сумма</div>
          <div style={s.kpiValue}>{fmt(total)} ₽</div>
        </div>
        <div style={{...s.kpiCard,borderColor:"#A8D9BB",background:C.greenBg}}>
          <div style={s.kpiLabel}>Получено</div>
          <div style={{...s.kpiValue,color:C.green}}>{fmt(paid)} ₽</div>
        </div>
        <div style={{...s.kpiCard,borderColor:"#F5C6C2",background:C.redBg}}>
          <div style={s.kpiLabel}>Остаток</div>
          <div style={{...s.kpiValue,color:C.red}}>{fmt(rem)} ₽</div>
        </div>
      </div>

      {/* Progress bar paid/total */}
      {total > 0 && (
        <div style={s.section}>
          <div style={s.sectionTitle}>Оплачено</div>
          <div style={s.progressWrap}>
            <div style={{...s.progressBar,width:`${Math.round(paid/total*100)}%`}}/>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",marginTop:6}}>
            <span style={{fontSize:12,color:C.green,fontWeight:700}}>{Math.round(paid/total*100)}% оплачено</span>
            <span style={{fontSize:12,color:C.textMuted}}>{fmt(total)} ₽ всего</span>
          </div>
        </div>
      )}

      {/* Bar chart by month */}
      {months.length > 0 && (
        <div style={s.section}>
          <div style={s.sectionTitle}>По месяцам</div>
          <div style={s.chartWrap}>
            {months.map((m,i) => (
              <div key={i} style={s.chartCol}>
                <div style={s.chartBarWrap}>
                  <div style={{...s.chartBarBg}}>
                    <div style={{...s.chartBarFill, height:`${Math.round(m.total/maxVal*100)}%`}}/>
                    <div style={{...s.chartBarPaid, height:`${Math.round(m.paid/maxVal*100)}%`}}/>
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

      {/* Sources */}
      {sources.length > 0 && (
        <div style={s.section}>
          <div style={s.sectionTitle}>Источники заказов</div>
          {sources.map(([src,cnt]) => (
            <div key={src} style={s.sourceRow}>
              <span style={s.sourceName}>{src}</span>
              <div style={s.sourceBarWrap}>
                <div style={{...s.sourceBarFill,width:`${Math.round(cnt/count*100)}%`}}/>
              </div>
              <span style={s.sourceCnt}>{cnt}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


// ── NotesEditor (Google Keep style) ──────────────────────
function NotesEditor({ event, onBack, onSave }) {
  const taRef = useRef(null);
  const timerRef = useRef(null);
  const [val, setVal] = useState(event.notes || "");

  useEffect(() => {
    setTimeout(() => { if(taRef.current) { taRef.current.focus(); const l=taRef.current.value.length; taRef.current.setSelectionRange(l,l); } }, 80);
  }, []);

  // debounced save
  const handleChange = (newVal) => {
    setVal(newVal);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onSave(newVal), 1500);
  };

  // smart Enter key: continue list prefixes
  const handleKeyDown = (e) => {
    if (e.key !== "Enter") return;
    const ta = taRef.current;
    const pos = ta.selectionStart;
    const text = ta.value;
    const lineStart = text.lastIndexOf("\n", pos - 1) + 1;
    const currentLine = text.slice(lineStart, pos);

    // detect prefix: "- ", "1. ", "2. " etc
    const numMatch  = currentLine.match(/^(\s*)(\d+)\.\s/);
    const dashMatch = currentLine.match(/^(\s*)-\s/);

    let prefix = null;
    if (numMatch) {
      const indent = numMatch[1];
      const num = parseInt(numMatch[2]) + 1;
      // if line is only the prefix (empty item), remove it
      if (currentLine.trim() === numMatch[2] + ".") {
        e.preventDefault();
        const before = text.slice(0, lineStart);
        const after  = text.slice(pos);
        const newVal = before + "\n" + after;
        handleChange(newVal);
        setTimeout(() => { ta.setSelectionRange(lineStart + 1, lineStart + 1); }, 0);
        return;
      }
      prefix = indent + num + ". ";
    } else if (dashMatch) {
      const indent = dashMatch[1];
      if (currentLine.trim() === "-") {
        e.preventDefault();
        const before = text.slice(0, lineStart);
        const after  = text.slice(pos);
        const newVal = before + "\n" + after;
        handleChange(newVal);
        setTimeout(() => { ta.setSelectionRange(lineStart + 1, lineStart + 1); }, 0);
        return;
      }
      prefix = indent + "- ";
    }

    if (prefix) {
      e.preventDefault();
      const before = text.slice(0, pos);
      const after  = text.slice(ta.selectionEnd);
      const newVal = before + "\n" + prefix + after;
      handleChange(newVal);
      const newPos = pos + 1 + prefix.length;
      setTimeout(() => { ta.setSelectionRange(newPos, newPos); }, 0);
    }
  };

  // auto-height
  const autoResize = () => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = ta.scrollHeight + "px";
  };

  useEffect(() => { autoResize(); }, [val]);

  return (
    <div style={sn.screen}>
      <style>{`
        .nb{background:none;border:none;cursor:pointer;padding:8px 12px;color:#555;font-size:28px;line-height:1;font-weight:300;}
        .nb:active{opacity:0.4;}
        .nt{width:100%;border:none;outline:none;resize:none;overflow:hidden;
          font-family:'Google Sans',Roboto,sans-serif;font-size:16px;line-height:1.85;
          color:#202124;background:transparent;padding:0;box-sizing:border-box;}
        .nt::placeholder{color:#bdbdbd;}
      `}</style>
      <div style={sn.topBar}>
        <button className="nb" onClick={onBack}>‹</button>
        <span style={sn.saveHint}>авто-сохранение</span>
      </div>
      <div style={sn.scroll}>
        <div style={sn.titleText}>{event.title}</div>
        <textarea
          ref={taRef}
          className="nt"
          placeholder="Начни писать..."
          value={val}
          onChange={e => { handleChange(e.target.value); autoResize(); }}
          onKeyDown={handleKeyDown}
        />
      </div>
    </div>
  );
}

// ── main app ──────────────────────────────────────────────
function App() {
  const [events, setEvents]               = useState([]);
  const [view, setView]                   = useState(VIEW_LIST);
  const [activeId, setActiveId]           = useState(null);
  const [draft, setDraft]                 = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [loading, setLoading]             = useState(true);
  const [saving, setSaving]               = useState(false);
  const [error, setError]                 = useState(null);
  const notesRef   = useRef(null);
  const notesTimer = useRef(null);

  useEffect(() => {
    (async () => {
      try { setEvents(await dbLoad()); }
      catch (e) { setError("Не удалось загрузить: " + e.message); }
      finally { setLoading(false); }
    })();
  }, []);

  const activeEvent  = events.find(e=>e.id===activeId)||null;
  const sortedEvents = [...events].sort((a,b)=>{
    if(!a.date) return 1; if(!b.date) return -1;
    return a.date.localeCompare(b.date);
  });

  const openEvent = (ev) => { setActiveId(ev.id); setView(VIEW_EVENT); };
  const openNew   = ()   => { setDraft(emptyEvent()); setView(VIEW_FORM); };
  const openEdit  = ()   => { setDraft({...activeEvent}); setView(VIEW_FORM); };

  const saveForm = async () => {
    if (!draft.title.trim()) return;
    setSaving(true);
    try {
      await dbUpsert(draft);
      const exists = events.find(e=>e.id===draft.id);
      const upd = exists ? events.map(e=>e.id===draft.id?draft:e) : [draft,...events];
      setEvents(upd); setActiveId(draft.id); setView(VIEW_EVENT); setDraft(null);
    } catch(e) { setError("Ошибка: "+e.message); }
    finally { setSaving(false); }
  };

  const cancelForm = () => { setView(activeId?VIEW_EVENT:VIEW_LIST); setDraft(null); };

  const doDelete = async () => {
    try {
      await dbDelete(activeId);
      setEvents(events.filter(e=>e.id!==activeId));
      setActiveId(null); setDeleteConfirm(false); setView(VIEW_LIST);
    } catch(e) { setError("Ошибка: "+e.message); }
  };

  const updateNotes = (val) => {
    const upd = events.map(e=>e.id===activeId?{...e,notes:val}:e);
    setEvents(upd);
    clearTimeout(notesTimer.current);
    notesTimer.current = setTimeout(async()=>{
      const ev = upd.find(e=>e.id===activeId);
      if(ev) { try { await dbUpsert(ev); } catch {} }
    }, 1500);
  };

  const setField = (f,v) => setDraft(d=>({...d,[f]:v}));

  useEffect(()=>{ if(view===VIEW_NOTES) setTimeout(()=>notesRef.current?.focus(),80); },[view]);

  const onTab = (t) => {
    if (t===VIEW_LIST||t===VIEW_DASH) { setActiveId(null); setDraft(null); setView(t); }
  };

  const showTabBar = view===VIEW_LIST || view===VIEW_DASH;

  // loading
  if (loading) return (
    <Screen>
      <div style={s.loadingWrap}>
        <div style={s.spinner}/>
        <div style={{color:C.textMuted,fontSize:13,marginTop:12}}>Загружаем данные...</div>
      </div>
    </Screen>
  );

  // LIST
  if (view===VIEW_LIST) return (
    <Screen>
      <TopBar
        title="HOST CRM"
        titleStyle={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,letterSpacing:3,color:C.accent}}
        right={<button style={s.addBtn} className="add-btn" onClick={openNew}>+</button>}
      />
      {error && <div style={s.errorBanner} onClick={()=>setError(null)}>{error} ✕</div>}
      <div style={{flex:1,overflowY:"auto"}}>
        {sortedEvents.length===0 && (
          <div style={s.emptyState}>
            <div style={{fontSize:52}}>🎤</div>
            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,color:C.textMuted,letterSpacing:2}}>Нет мероприятий</div>
            <div style={{color:C.textMuted,fontSize:13}}>Нажми «+» чтобы добавить</div>
          </div>
        )}
        {sortedEvents.map(ev=>{
          const rem=remaining(ev);
          return (
            <div key={ev.id} style={s.card} className="tap-card" onClick={()=>openEvent(ev)}>
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
        })}
      </div>
      <TabBar view={view} onTab={onTab}/>
    </Screen>
  );

  // DASHBOARD
  if (view===VIEW_DASH) return (
    <Screen>
      <TopBar
        title="ИТОГИ"
        titleStyle={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,letterSpacing:3,color:C.accent}}
      />
      {error&&<div style={s.errorBanner} onClick={()=>setError(null)}>{error} ✕</div>}
      <Dashboard events={events}/>
      <TabBar view={view} onTab={onTab}/>
    </Screen>
  );

  // EVENT DETAIL
  if (view===VIEW_EVENT&&activeEvent) {
    const rem=remaining(activeEvent);
    return (
      <Screen>
        <TopBar
          left={<BackBtn onClick={()=>setView(VIEW_LIST)}/>}
          title={activeEvent.title}
          right={
            <div style={{display:"flex",gap:6}}>
              <button style={s.iconBtn} className="icon-btn" onClick={openEdit}>✏️</button>
              <button style={{...s.iconBtn,borderColor:"#F5C6C2"}} className="icon-btn-del" onClick={()=>setDeleteConfirm(true)}>🗑</button>
            </div>
          }
        />
        {error&&<div style={s.errorBanner} onClick={()=>setError(null)}>{error} ✕</div>}
        <div style={{flex:1,overflowY:"auto"}}>
          {activeEvent.date&&<div style={s.eventDate}>{formatDate(activeEvent.date)}</div>}
          <div style={s.infoGrid}>
            {activeEvent.source&&<InfoCard label="Источник" value={activeEvent.source}/>}
            {activeEvent.clientName&&<InfoCard label="Заказчик" value={activeEvent.clientName}/>}
            {activeEvent.clientPhone&&(
              <InfoCard label="Телефон">
                <a href={`tel:${activeEvent.clientPhone}`} style={{color:C.accent,fontWeight:700,fontSize:14,textDecoration:"none"}}>
                  {activeEvent.clientPhone}
                </a>
              </InfoCard>
            )}
            {activeEvent.totalCost&&<InfoCard label="Стоимость" value={activeEvent.totalCost+" ₽"}/>}
            {activeEvent.totalCost&&(
              <InfoCard label="Остаток" accent={rem>0?"red":"green"}
                value={rem>0?fmt(rem)+" ₽":"✓ Оплачено"}/>
            )}
          </div>
          <div style={s.notesBlock} className="tap-card" onClick={()=>setView(VIEW_NOTES)}>
            <div style={s.notesBlockLabel}>📝 Заметки</div>
            <div style={s.notesBlockText}>
              {activeEvent.notes
                ? activeEvent.notes.slice(0,140)+(activeEvent.notes.length>140?"…":"")
                : <span style={{color:C.textMuted}}>Нажми чтобы добавить заметки...</span>}
            </div>
          </div>
        </div>
        {deleteConfirm&&(
          <div style={s.overlay} onClick={()=>setDeleteConfirm(false)}>
            <div style={s.confirmBox} onClick={e=>e.stopPropagation()}>
              <div style={s.confirmTitle}>Удалить мероприятие?</div>
              <div style={s.confirmSub}>Данные и заметки будут удалены навсегда.</div>
              <div style={{display:"flex",gap:8}}>
                <button style={s.btnGhost} onClick={()=>setDeleteConfirm(false)}>Отмена</button>
                <button style={{...s.btnSolid,background:C.red,flex:1}} onClick={doDelete}>Удалить</button>
              </div>
            </div>
          </div>
        )}
      </Screen>
    );
  }

  // NOTES
  if (view===VIEW_NOTES&&activeEvent) return (
    <NotesEditor
      event={activeEvent}
      onBack={()=>setView(VIEW_EVENT)}
      onSave={updateNotes}
    />
  );

  // FORM
  if (view===VIEW_FORM&&draft) {
    const rem=remaining(draft);
    return (
      <Screen>
        <TopBar
          left={<BackBtn onClick={cancelForm}/>}
          title={events.find(e=>e.id===draft.id)?"Редактировать":"Новое"}
          right={
            <button style={{...s.btnSolid,opacity:draft.title.trim()&&!saving?1:0.4}} onClick={saveForm}>
              {saving?"...":"Сохранить"}
            </button>
          }
        />
        {error&&<div style={s.errorBanner} onClick={()=>setError(null)}>{error} ✕</div>}
        <div style={{flex:1,overflowY:"auto",padding:"16px 16px 48px"}}>
          <Field label="Название *">
            <input style={s.input} className="crm-input" placeholder="Свадьба Ивановых"
              value={draft.title} autoFocus onChange={e=>setField("title",e.target.value)}/>
          </Field>
          <Field label="Дата мероприятия">
            <input type="date" style={s.input} className="crm-input"
              value={draft.date} onChange={e=>setField("date",e.target.value)}/>
          </Field>
          <Field label="Откуда заказ">
            <div style={s.sourceWrap}>
              {SOURCE_OPTIONS.map(opt=>(
                <button key={opt}
                  style={{...s.sourceChip,...(draft.source===opt?s.sourceChipActive:{})}}
                  onClick={()=>setField("source",draft.source===opt?"":opt)}>{opt}</button>
              ))}
            </div>
            <input
              style={{...s.input, marginTop:8}}
              className="crm-input"
              placeholder="Или напиши свой вариант..."
              value={SOURCE_OPTIONS.includes(draft.source)?"":draft.source}
              onChange={e=>setField("source",e.target.value)}
            />
          </Field>
          <Field label="Имя заказчика">
            <input style={s.input} className="crm-input" placeholder="Анна Иванова"
              value={draft.clientName} onChange={e=>setField("clientName",e.target.value)}/>
          </Field>
          <Field label="Номер заказчика">
            <input style={s.input} className="crm-input" placeholder="+7 (___) ___-__-__"
              inputMode="tel" value={draft.clientPhone}
              onChange={e=>setField("clientPhone",formatPhone(e.target.value))}/>
          </Field>
          <Field label="Стоимость заказа, ₽">
            <input style={s.input} className="crm-input" placeholder="50 000"
              inputMode="numeric" value={draft.totalCost}
              onChange={e=>setField("totalCost",formatMoney(e.target.value))}/>
          </Field>
          <Field label="Оплачено, ₽">
            <input style={s.input} className="crm-input" placeholder="25 000"
              inputMode="numeric" value={draft.paidCost}
              onChange={e=>setField("paidCost",formatMoney(e.target.value))}/>
          </Field>
          {draft.totalCost&&(
            <div style={s.remainBanner}>
              <span style={{color:C.textSub,fontSize:13}}>Остаток: </span>
              <span style={{color:rem>0?C.red:C.green,fontWeight:800,fontSize:15}}>
                {rem>0?`${fmt(rem)} ₽`:"Полностью оплачено ✓"}
              </span>
            </div>
          )}
        </div>
      </Screen>
    );
  }

  return null;
}

// ── styles ────────────────────────────────────────────────
const s = {
  screen:   { display:"flex",flexDirection:"column",height:"100vh",width:"100%",background:C.bg,color:C.text,fontFamily:"'Montserrat',sans-serif",overflow:"hidden" },
  topBar:   { display:"flex",alignItems:"center",padding:"0 12px",height:56,borderBottom:`1px solid ${C.border}`,background:C.topBar,flexShrink:0,gap:8,boxShadow:"0 1px 0 rgba(0,0,0,0.04)" },
  topSide:  { width:80,display:"flex",alignItems:"center",flexShrink:0 },
  topTitle: { flex:1,textAlign:"center",fontWeight:700,fontSize:15,color:C.text,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis" },
  backBtn:  { background:"none",border:"none",color:C.accent,fontSize:34,cursor:"pointer",lineHeight:1,padding:"0 4px 2px",fontWeight:300 },
  addBtn:   { width:36,height:36,background:C.accentBtn,border:"none",color:"#fff",fontSize:22,fontWeight:900,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",borderRadius:0,lineHeight:1 },
  iconBtn:  { background:"none",border:`1px solid ${C.border2}`,color:C.textSub,width:36,height:36,fontSize:15,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",borderRadius:0 },
  tabBar:   { display:"flex",borderTop:`1px solid ${C.border}`,background:C.surface,flexShrink:0,height:60 },
  tabBtn:   { flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"none",border:"none",cursor:"pointer",gap:2,opacity:0.5 },
  tabBtnActive: { opacity:1 },
  loadingWrap: { flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center" },
  spinner:  { width:32,height:32,border:`3px solid ${C.border}`,borderTop:`3px solid ${C.accent}`,borderRadius:"50%",animation:"spin 0.8s linear infinite" },
  errorBanner: { background:C.redBg,color:C.red,fontSize:12,padding:"10px 16px",borderBottom:`1px solid #F5C6C2`,cursor:"pointer",flexShrink:0 },
  emptyState: { display:"flex",flexDirection:"column",alignItems:"center",gap:12,padding:60,textAlign:"center" },
  card:     { padding:"14px 16px",borderBottom:`1px solid ${C.border}`,cursor:"pointer",background:C.surface },
  cardRow:  { display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,marginBottom:3 },
  cardTitle:{ fontWeight:700,fontSize:15,color:C.text,flex:1 },
  cardDate: { fontSize:12,color:C.textMuted,whiteSpace:"nowrap",marginTop:2 },
  cardSub:  { fontSize:12,color:C.textSub,marginBottom:8 },
  cardTags: { display:"flex",flexWrap:"wrap",gap:6 },
  tag:      { fontSize:11,fontWeight:700,padding:"3px 8px",letterSpacing:0.3 },
  eventDate:{ padding:"10px 16px 0",fontSize:12,color:C.textMuted },
  infoGrid: { display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,padding:"10px 16px" },
  infoCard: { background:C.surface,border:`1px solid ${C.border}`,padding:"10px 12px",display:"flex",flexDirection:"column",gap:4 },
  infoLabel:{ fontSize:9,color:C.textMuted,fontWeight:700,letterSpacing:1,textTransform:"uppercase" },
  infoVal:  { fontSize:14,fontWeight:700,wordBreak:"break-word" },
  notesBlock:{ margin:"0 16px 16px",border:`1px solid ${C.border}`,borderLeft:`3px solid ${C.accent}`,background:C.surface,padding:"12px 14px",cursor:"pointer" },
  notesBlockLabel:{ fontSize:11,color:C.accent,fontWeight:700,letterSpacing:1,marginBottom:8 },
  notesBlockText: { fontSize:13,color:C.textSub,lineHeight:1.6 },
  fullNotes:{ flex:1,background:C.surface,border:"none",outline:"none",color:C.text,fontSize:16,lineHeight:1.9,padding:"20px 16px",resize:"none",fontFamily:"'Montserrat',sans-serif",width:"100%",boxSizing:"border-box" },
  input:    { width:"100%",background:C.surface,border:`1px solid ${C.border2}`,color:C.text,padding:"12px 14px",fontSize:15,fontFamily:"'Montserrat',sans-serif",borderRadius:0,outline:"none",boxSizing:"border-box" },
  fieldLabel:{ fontSize:10,color:C.textSub,fontWeight:700,letterSpacing:1,textTransform:"uppercase",marginBottom:8 },
  sourceWrap:{ display:"flex",flexWrap:"wrap",gap:8 },
  sourceChip:{ background:C.surface,border:`1px solid ${C.border2}`,color:C.textSub,padding:"8px 14px",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",borderRadius:0 },
  sourceChipActive:{ background:C.accent,border:`1px solid ${C.accent}`,color:"#fff" },
  remainBanner:{ background:C.surface,border:`1px solid ${C.border}`,padding:"12px 16px",display:"flex",gap:8,alignItems:"center" },
  btnSolid: { background:C.accentBtn,border:"none",color:"#fff",padding:"8px 14px",fontWeight:800,fontSize:13,fontFamily:"'Montserrat',sans-serif",cursor:"pointer",borderRadius:0,whiteSpace:"nowrap" },
  btnGhost: { background:"none",border:`1px solid ${C.border2}`,color:C.textSub,padding:"12px 20px",fontWeight:600,fontSize:13,fontFamily:"'Montserrat',sans-serif",cursor:"pointer",borderRadius:0,flex:1 },
  overlay:  { position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",display:"flex",alignItems:"flex-end",zIndex:200 },
  confirmBox:{ background:C.surface,borderTop:`1px solid ${C.border}`,padding:"24px 16px 36px",width:"100%",display:"flex",flexDirection:"column",gap:12,boxShadow:"0 -4px 24px rgba(0,0,0,0.1)" },
  confirmTitle:{ fontFamily:"'Bebas Neue',sans-serif",fontSize:22,color:C.red,letterSpacing:1 },
  confirmSub:{ fontSize:13,color:C.textSub },
  // dashboard
  kpiGrid:  { display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:16 },
  kpiCard:  { background:C.surface,border:`1px solid ${C.border}`,padding:"14px",display:"flex",flexDirection:"column",gap:4 },
  kpiLabel: { fontSize:10,color:C.textMuted,fontWeight:700,letterSpacing:1,textTransform:"uppercase" },
  kpiValue: { fontSize:18,fontWeight:800,color:C.text,lineHeight:1.2 },
  section:  { background:C.surface,border:`1px solid ${C.border}`,padding:"14px",marginBottom:12 },
  sectionTitle:{ fontSize:11,color:C.textMuted,fontWeight:700,letterSpacing:1,textTransform:"uppercase",marginBottom:12 },
  progressWrap:{ height:10,background:C.border,overflow:"hidden" },
  progressBar:{ height:"100%",background:C.green,transition:"width 0.4s" },
  chartWrap:{ display:"flex",gap:6,alignItems:"flex-end",height:100 },
  chartCol: { flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4 },
  chartBarWrap:{ flex:1,width:"100%",display:"flex",alignItems:"flex-end" },
  chartBarBg:{ width:"100%",height:80,background:C.bg,position:"relative",display:"flex",alignItems:"flex-end" },
  chartBarFill:{ position:"absolute",bottom:0,left:0,right:0,background:C.border2,transition:"height 0.4s" },
  chartBarPaid:{ position:"absolute",bottom:0,left:0,right:0,background:C.green,transition:"height 0.4s" },
  chartLabel:{ fontSize:9,color:C.textMuted,fontWeight:700,textAlign:"center",whiteSpace:"nowrap" },
  chartCount:{ fontSize:9,color:C.textMuted,textAlign:"center" },
  chartLegend:{ display:"flex",alignItems:"center",marginTop:10,gap:4 },
  legendDot:{ width:8,height:8,borderRadius:"50%",flexShrink:0 },
  legendText:{ fontSize:11,color:C.textMuted },
  sourceRow:{ display:"flex",alignItems:"center",gap:8,marginBottom:8 },
  sourceName:{ fontSize:12,fontWeight:700,color:C.text,width:80,flexShrink:0 },
  sourceBarWrap:{ flex:1,height:6,background:C.bg,overflow:"hidden" },
  sourceBarFill:{ height:"100%",background:C.accent,transition:"width 0.4s" },
  sourceCnt:{ fontSize:12,color:C.textMuted,fontWeight:700,width:20,textAlign:"right" },
};


// ── Notes styles (Google Keep feel) ──────────────────────
const sn = {
  screen:  { display:"flex", flexDirection:"column", height:"100vh", background:"#ffffff", fontFamily:"'Google Sans',Roboto,'Helvetica Neue',sans-serif", overflow:"hidden" },
  topBar:  { display:"flex", alignItems:"center", justifyContent:"space-between", padding:"8px 4px", borderBottom:"1px solid #f1f3f4", flexShrink:0 },
  saveHint:{ fontSize:11, color:"#bdbdbd", paddingRight:16 },
  scroll:  { flex:1, overflowY:"auto", padding:"16px 24px 40px" },
  titleText:{ fontSize:26, fontWeight:400, color:"#202124", lineHeight:1.3, marginBottom:20, letterSpacing:"-0.01em" },
};

export default function Root() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Montserrat:wght@400;600;700;800&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
        body { background: ${C.bg}; }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-thumb { background: ${C.border2}; }
        .tap-card:active { background: ${C.bg} !important; }
        .add-btn:active { background: #333 !important; }
        .icon-btn:active { background: ${C.bg} !important; }
        .icon-btn-del:active { background: ${C.redBg} !important; }
        .crm-input:focus { border-color: ${C.accent} !important; }
        .notes-ta::placeholder { color: ${C.textMuted}; }
        input[type="date"]::-webkit-calendar-picker-indicator { opacity: 0.4; }
      `}</style>
      <App />
    </>
  );
}
