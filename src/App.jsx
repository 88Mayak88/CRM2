import { useState, useEffect, useRef } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, setDoc, deleteDoc, doc, orderBy, query, writeBatch } from "firebase/firestore";

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
async function dbUpsert(ev) { await setDoc(doc(db, COL, ev.id), baseEvent(ev)); }
const TX = "transactions", AS = "assets";
async function loadCol(name){ const snap=await getDocs(collection(db,name)); return snap.docs.map(d=>({id:d.id,...d.data()})); }
async function saveDoc(name,obj){ await setDoc(doc(db,name,obj.id),obj); }
async function removeDoc(name,id){ await deleteDoc(doc(db,name,id)); }
async function commitOps(ops){ for(let i=0;i<ops.length;i+=400){ const b=writeBatch(db); ops.slice(i,i+400).forEach(([col,obj,del])=>del?b.delete(doc(db,col,obj.id)):b.set(doc(db,col,obj.id),obj)); await b.commit(); } }
const BASE_FIELDS=["id","title","date","prepayDate","source","clientName","clientPhone","totalCost","notes","createdAt","archived","finMigrated"];
function baseEvent(ev){
  if(!ev.finMigrated){ const {incomeTxs,expenseTxs,...rest}=ev; return rest; }
  const o={}; BASE_FIELDS.forEach(k=>{ if(ev[k]!==undefined) o[k]=ev[k]; }); return o;
}
function newId(p){ return p+Date.now().toString(36)+Math.random().toString(36).slice(2,6); }
function pad2(n){ return String(n).padStart(2,"0"); }
function todayISO(){ const d=new Date(); return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`; }
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
function remaining(ev)    { return Math.max(0, parseMoney(ev.totalCost)-parseMoney(ev.paidCost)); }
function earned(ev)       { return Math.max(parseMoney(ev.totalCost), parseMoney(ev.paidCost)); }
function profit(ev)       { return earned(ev)-parseMoney(ev.expenses); }
function itemsTotal(items){ return (items||[]).reduce((s,i)=>s+parseMoney(i.amount),0); }
function legacyItems(ev){
  if(ev.expenseItems&&ev.expenseItems.length) return ev.expenseItems;
  if(parseMoney(ev.expenses)>0) return [{name:ev.expensesNote||"Расходы",amount:ev.expenses}];
  return [];
}
function csvCell(v){ const s=String(v??""); return /[;"\n\r]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s; }
async function shareCsv(table,name){
  const csv="\uFEFF"+table.map(r=>r.map(csvCell).join(";")).join("\r\n");
  const file=new File([csv],name,{type:"text/csv;charset=utf-8"});
  if(navigator.canShare&&navigator.canShare({files:[file]})){
    try{ await navigator.share({files:[file],title:name}); return; }catch(e){ if(e.name==="AbortError") return; }
  }
  const url=URL.createObjectURL(file);
  const a=document.createElement("a"); a.href=url; a.download=name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function exportEvents(events){
  const head=["Дата","Название","Статус","Заказчик","Телефон","Откуда клиент","Стоимость","Оплачено","Остаток","Дата предоплаты","Расходы","Расшифровка расходов","Прибыль","Заметки"];
  const rows=[...events].sort((a,b)=>(a.date||"").localeCompare(b.date||"")).map(ev=>{
    const items=legacyItems(ev);
    return [
      formatDate(ev.date), ev.title, ev.archived?"Архив":"В работе", ev.clientName, ev.clientPhone, ev.source,
      parseMoney(ev.totalCost), parseMoney(ev.paidCost), remaining(ev), formatDate(ev.prepayDate),
      parseMoney(ev.expenses), items.map(i=>`${i.name||"Без названия"} — ${parseMoney(i.amount)}`).join(", "),
      profit(ev), ev.notes||""
    ];
  });
  await shareCsv([head,...rows],`host-crm-заказы-${todayISO()}.csv`);
}
async function exportTransactions(txs,events){
  const head=["Дата","Тип","Сумма","Категория","Описание","Мероприятие"];
  const rows=[...txs].sort((a,b)=>(a.date||"").localeCompare(b.date||"")).map(t=>{
    const ev=events.find(e=>e.id===t.eventId);
    return [formatDate(t.date), t.type==="income"?"Доход":"Расход", parseMoney(t.amount), t.category||"", t.name||"", ev?`${ev.title}${ev.date?" ("+formatDate(ev.date)+")":""}`:""];
  });
  await shareCsv([head,...rows],`host-crm-финансы-${todayISO()}.csv`);
}
function sumTx(list){ return list.reduce((s,t)=>s+parseMoney(t.amount),0); }
function sumAmt(list){ return list.reduce((s,t)=>s+parseMoney(t.amount),0); }
function enrich(rawEvents,txs){
  const by={};
  txs.forEach(t=>{ if(t.eventId) (by[t.eventId]=by[t.eventId]||[]).push(t); });
  return rawEvents.map(ev=>{
    if(!ev.finMigrated) return ev;
    const linked=(by[ev.id]||[]).slice().sort((a,b)=>(a.date||"").localeCompare(b.date||""));
    const inc=linked.filter(t=>t.type==="income"), exp=linked.filter(t=>t.type==="expense");
    const p=sumTx(inc), e=sumTx(exp);
    return {...ev, paidCost:p?formatMoney(String(p)):"", expenses:e?formatMoney(String(e)):"",
      expenseItems:exp.map(t=>({name:t.name||t.category,amount:t.amount})), incomeTxs:inc, expenseTxs:exp};
  });
}
function migrationFor(ev){
  const now=new Date().toISOString(), day=ev.date||todayISO(), out=[];
  legacyItems(ev).forEach((it,i)=>{ if(parseMoney(it.amount)>0) out.push({id:`mig-e-${ev.id}-${i}`,type:"expense",date:day,amount:it.amount,name:it.name||"Расходы",category:"Мероприятия",eventId:ev.id,createdAt:now}); });
  if(parseMoney(ev.paidCost)>0) out.push({id:`mig-i-${ev.id}`,type:"income",date:ev.prepayDate||day,amount:ev.paidCost,name:"Оплата",category:"Мероприятия",eventId:ev.id,createdAt:now});
  return out;
}
const INCOME_CATS  = ["Мероприятия","Подработка","Проценты и дивиденды","Подарки","Другое"];
const EXPENSE_CATS = ["Мероприятия","Реквизит","Транспорт","Реклама","Связь","Продукты","Жильё","Здоровье","Развлечения","Другое"];
const ASSET_CATS   = ["Счета и наличные","Вклады","Акции и облигации","Дал в долг"];
const LIAB_CATS    = ["Кредиты","Мои долги"];
function formatDate(d)    { if(!d) return ""; const [y,m,day]=d.split("-"); return `${day}.${m}.${y}`; }
function fmt(n)           { return n.toLocaleString("ru"); }

const emptyEvent = () => ({ id:Date.now().toString(), title:"", date:"", prepayDate:"", source:"",
  clientName:"", clientPhone:"", totalCost:"", paidCost:"", expenses:"", expensesNote:"", expenseItems:[], notes:"",
  createdAt:new Date().toISOString(), archived:false, finMigrated:true });

const V = { LIST:"list", EVENT:"event", NOTES:"notes", FORM:"form", DASH:"dash", ARCHIVE:"archive", CLIENTS:"clients", CAL:"cal", MONTH:"month", FIN:"fin", TX:"tx", ASSET:"asset" };

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
    {id:V.FIN,label:"Финансы",icon:IconWallet},
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
function IconWallet({color}){return(<svg width="21" height="21" viewBox="0 0 24 24" fill="none"><rect x="3.5" y="6" width="17" height="13" rx="2.5" stroke={color} strokeWidth="1.6"/><path d="M16 12.5h4.5M6.5 6l8-2.5 1.3 2.5" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/><circle cx="16.5" cy="12.5" r="0.9" fill={color}/></svg>);}
function IconDownload({color}){return(<svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M12 4v11m0 0l-4-4m4 4l4-4M5 19h14" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>);}
function TxRow({ t, meta, onClick, onRename, showCat }) {
  const inc=t.type==="income";
  const label=t.name||t.category||(inc?"Доход":"Расход");
  // название редактируется прямо в списке: Enter / тап мимо — сохранить, Esc — отменить
  const [val,setVal]=useState(t.name||"");
  const cancel=useRef(false);
  useEffect(()=>setVal(t.name||""),[t.name]);
  const commit=()=>{
    if(cancel.current){ cancel.current=false; setVal(t.name||""); return; }
    const v=val.trim(); if(v!==(t.name||"")) onRename(t,v);
  };
  return (
    <div style={s.txRow} className="card-press" onClick={onClick}>
      <div style={{flex:1,minWidth:0}}>
        {onRename
          ? <input style={s.txNameEdit} className="inl" value={val} placeholder={label} enterKeyHint="done"
              onClick={e=>e.stopPropagation()} onChange={e=>setVal(e.target.value)} onBlur={commit}
              onKeyDown={e=>{ if(e.key==="Enter") e.currentTarget.blur(); if(e.key==="Escape"){ cancel.current=true; e.currentTarget.blur(); } }}/>
          : <div style={s.txName}>{label}</div>}
        {meta&&<div style={s.txMeta}>{meta}</div>}
      </div>
      {showCat&&<div style={t.category?s.txCat:{...s.txCat,...s.txCatNone}} title={t.category||"Без категории"}>{t.category||"Без категории"}</div>}
      <div style={{...s.txAmt,color:inc?C.green:C.text}}>{inc?"+":"−"}{fmt(parseMoney(t.amount))} ₽</div>
    </div>
  );
}
function AssetsView({ assets, onOpen }) {
  const A=assets.filter(a=>a.kind!=="liability"), L=assets.filter(a=>a.kind==="liability");
  const ta=sumAmt(A), tl=sumAmt(L);
  const group=(title,cats,list,isL)=>{
    const known=cats.map(cat=>({cat,items:list.filter(a=>a.category===cat)}));
    const other=list.filter(a=>!cats.includes(a.category));
    if(other.length) known.push({cat:"Прочее",items:other});
    const shown=known.filter(g=>g.items.length);
    if(!shown.length) return null;
    return (
      <>
        <div style={s.groupHead}>{title}</div>
        {shown.map(g=>(
          <div key={g.cat} style={s.panel}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:4}}>
              <span style={s.panelTitle}>{g.cat}</span>
              <span style={{fontSize:13,fontWeight:700,color:isL?C.red:C.text}}>{fmt(sumAmt(g.items))} ₽</span>
            </div>
            {g.items.map(a=>{
              const meta=[a.rate?`${a.rate}%`:null,a.dueDate?`до ${formatDate(a.dueDate)}`:null,a.note?a.note.split("\n")[0]:null].filter(Boolean).join(" · ");
              return (
                <div key={a.id} style={s.txRow} className="card-press" onClick={()=>onOpen(a)}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={s.txName}>{a.name}</div>
                    {meta&&<div style={s.txMeta}>{meta}</div>}
                  </div>
                  <div style={{...s.txAmt,color:isL?C.red:C.text}}>{fmt(parseMoney(a.amount))} ₽</div>
                </div>
              );
            })}
          </div>
        ))}
      </>
    );
  };
  return (
    <div style={{flex:1,overflowY:"auto",padding:"4px 16px 28px"}}>
      <div style={s.heroCard}>
        <div style={{fontSize:11,letterSpacing:1.5,color:"rgba(255,255,255,0.55)",fontWeight:600,textTransform:"uppercase"}}>Капитал</div>
        <div style={{fontSize:34,fontWeight:800,color:"#fff",letterSpacing:-1,marginTop:6,lineHeight:1}}>{fmt(ta-tl)} ₽</div>
        <div style={{display:"flex",gap:22,marginTop:16}}>
          <div><div style={{fontSize:10,color:"rgba(255,255,255,0.5)",letterSpacing:0.5}}>АКТИВЫ</div><div style={{fontSize:15,color:"#fff",fontWeight:700,marginTop:2}}>{fmt(ta)} ₽</div></div>
          <div><div style={{fontSize:10,color:"rgba(255,255,255,0.5)",letterSpacing:0.5}}>ПАССИВЫ</div><div style={{fontSize:15,color:"#E9A39C",fontWeight:700,marginTop:2}}>{fmt(tl)} ₽</div></div>
        </div>
      </div>
      {assets.length===0&&<div style={{...s.panel,textAlign:"center",color:C.textSub,fontSize:13,lineHeight:1.6}}>Здесь будут вклады, счета, акции и облигации, а также долги и кредиты.<br/>Нажми ＋ чтобы добавить первую позицию.</div>}
      {group("Активы",ASSET_CATS,A,false)}
      {group("Пассивы",LIAB_CATS,L,true)}
    </div>
  );
}
function IconArchive({color}){return(<svg width="21" height="21" viewBox="0 0 24 24" fill="none"><rect x="4" y="4" width="16" height="4" rx="1" stroke={color} strokeWidth="1.6"/><path d="M5.5 8v10a1 1 0 001 1h11a1 1 0 001-1V8" stroke={color} strokeWidth="1.6"/><path d="M10 12h4" stroke={color} strokeWidth="1.6" strokeLinecap="round"/></svg>);}
function IconEdit({color}){return(<svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M15 5l4 4M4 20l1-4L16 5l3 3L8 19l-4 1z" stroke={color} strokeWidth="1.6" strokeLinejoin="round"/></svg>);}
function IconArc({color}){return(<svg width="17" height="17" viewBox="0 0 24 24" fill="none"><rect x="4" y="4" width="16" height="4" rx="1" stroke={color} strokeWidth="1.6"/><path d="M5.5 8v10a1 1 0 001 1h11a1 1 0 001-1V8M10 12h4" stroke={color} strokeWidth="1.6"/></svg>);}
function IconUnarc({color}){return(<svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M4 8h16M6 8v11h12V8" stroke={color} strokeWidth="1.6"/><path d="M12 16v-5m0 0l-2 2m2-2l2 2" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>);}
function IconTrash({color}){return(<svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M5 7h14M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2M6 7l1 12a1 1 0 001 1h8a1 1 0 001-1l1-12" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>);}

// ── event card ──
function EventCard({ ev, onClick, showFinance }) {
  const rem=remaining(ev);
  const paid = ev.totalCost && rem===0;
  const exp = parseMoney(ev.expenses);
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
      {showFinance&&ev.totalCost&&(
        <div style={s.finRow}>
          <div style={s.finItem}><span style={s.finKey}>Расходы</span><span style={s.finVal}>{exp?fmt(exp)+" ₽":"—"}</span></div>
          <div style={s.finItem}><span style={s.finKey}>Прибыль</span><span style={{...s.finVal,color:C.brass,fontWeight:700}}>{fmt(profit(ev))} ₽</span></div>
        </div>
      )}
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

function Dashboard({ events, onMonthClick }) {
  const all = events; // ВСЕ заказы
  const revenue = all.reduce((s,e)=>s+earned(e),0);
  const expenses= all.reduce((s,e)=>s+parseMoney(e.expenses),0);
  const prof    = revenue - expenses;
  const paid    = all.reduce((s,e)=>s+parseMoney(e.paidCost),0);
  const owed     = all.reduce((s,e)=>s+remaining(e),0);
  const withPrice = all.filter(e=>earned(e)>0);
  const avg     = withPrice.length ? Math.round(revenue/withPrice.length) : 0;
  const margin  = revenue ? Math.round(prof/revenue*100) : 0;

  // by month
  const byMonth={};
  all.forEach(ev=>{
    if(!ev.date) return;
    const [y,m]=ev.date.split("-");
    const k=`${y}-${m}`;
    if(!byMonth[k]) byMonth[k]={key:k,name:MONTHS_RU[parseInt(m)-1],year:y,rev:0,exp:0,prof:0,count:0};
    byMonth[k].rev  += earned(ev);
    byMonth[k].exp  += parseMoney(ev.expenses);
    byMonth[k].prof += profit(ev);
    byMonth[k].count+= 1;
  });
  const months=Object.values(byMonth).sort((a,b)=>b.key.localeCompare(a.key));
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
          {months.map((m,i)=>(
            <div key={i} className="card-press" onClick={()=>onMonthClick(m.key)} style={{padding:"14px 4px",borderTop:i>0?`1px solid ${C.line}`:"none",cursor:"pointer",margin:"0 -4px",borderRadius:8}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:9}}>
                <span style={{fontSize:14,fontWeight:700,color:C.text}}>{m.name} <span style={{color:C.textMut,fontWeight:500,fontSize:12.5}}>{m.year}</span></span>
                <span style={{fontSize:11,color:C.textSub,fontWeight:600,display:"flex",alignItems:"center",gap:5}}>{m.count} {m.count===1?"заказ":m.count<5?"заказа":"заказов"}<span style={{color:C.brass,fontSize:16}}>›</span></span>
              </div>
              <div style={{height:8,background:C.bgAlt,borderRadius:5,overflow:"hidden",display:"flex",marginBottom:9}}>
                <div style={{width:`${Math.round(m.rev/maxRev*100)}%`,background:C.brass,height:"100%"}}/>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>
                <div><div style={{fontSize:10,color:C.textMut,marginBottom:2}}>Выручка</div><div style={{fontSize:13,fontWeight:700,color:C.text}}>{fmt(m.rev)} ₽</div></div>
                <div><div style={{fontSize:10,color:C.textMut,marginBottom:2}}>Расходы</div><div style={{fontSize:13,fontWeight:700,color:C.textSub}}>{fmt(m.exp)} ₽</div></div>
                <div><div style={{fontSize:10,color:C.textMut,marginBottom:2}}>Прибыль</div><div style={{fontSize:13,fontWeight:700,color:C.brass}}>{fmt(m.prof)} ₽</div></div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── finance analytics ──
const WORK_CATS   = ["Мероприятия","Реквизит","Реклама"];   // расходы, которые идут на работу, а не на жизнь
const LIQUID_CATS = ["Счета и наличные","Вклады"];           // деньги, доступные сразу — из них считается подушка
const isWorkTx = t => !!t.eventId || WORK_CATS.includes(t.category);
function lastMonths(n){ // n полных месяцев до текущего, от старых к новым
  const d=new Date(), out=[];
  for(let i=n;i>=1;i--){ const x=new Date(d.getFullYear(),d.getMonth()-i,1); out.push(`${x.getFullYear()}-${pad2(x.getMonth()+1)}`); }
  return out;
}
function Bar({ value, max, color }){
  return <div style={{height:6,background:C.bgAlt,borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:`${max?Math.min(100,Math.round(value/max*100)):0}%`,background:color,borderRadius:3}}/></div>;
}
function Row({ label, value, tone, hint }){
  const vc=tone==="green"?C.green:tone==="red"?C.red:tone==="brass"?C.brass:C.text;
  return (
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",padding:"8px 0",borderTop:`1px solid ${C.line}`}}>
      <span style={{fontSize:13,color:C.textSub}}>{label}{hint&&<span style={{color:C.textMut}}> · {hint}</span>}</span>
      <span style={{fontSize:14,fontWeight:700,color:vc}}>{value}</span>
    </div>
  );
}

function FinanceAnalytics({ txs, assets }) {
  const [period,setPeriod]=useState(3);
  const keys=lastMonths(period);
  const inPeriod=t=>keys.includes((t.date||"").slice(0,7));
  const months=keys.map(k=>{
    const list=txs.filter(t=>(t.date||"").startsWith(k)), exp=list.filter(t=>t.type==="expense");
    const work=sumTx(exp.filter(isWorkTx)), all=sumTx(exp);
    return {k, inc:sumTx(list.filter(t=>t.type==="income")), exp:all, work, personal:all-work};
  });
  const tot=f=>months.reduce((s,m)=>s+m[f],0);
  const tInc=tot("inc"), tExp=tot("exp"), tWork=tot("work"), tPers=tot("personal");
  const avg=v=>Math.round(v/period);
  const saved=tInc-tExp;
  const rate=tInc?Math.round(saved/tInc*100):null;
  const rateTone=rate===null?null:rate>=20?"green":rate>=0?"brass":"red";
  const noIncome=months.filter(m=>m.inc===0).length;
  const maxM=Math.max(...months.map(m=>Math.max(m.inc,m.exp)),1);

  const byCat={};
  txs.filter(t=>t.type==="expense"&&inPeriod(t)&&!isWorkTx(t)).forEach(t=>{ const k=t.category||"Без категории"; byCat[k]=(byCat[k]||0)+parseMoney(t.amount); });
  const cats=Object.entries(byCat).sort((a,b)=>b[1]-a[1]);

  const A=assets.filter(a=>a.kind!=="liability"), L=assets.filter(a=>a.kind==="liability");
  const ta=sumAmt(A), tl=sumAmt(L);
  const liquid=sumAmt(A.filter(a=>LIQUID_CATS.includes(a.category)));
  const lent=sumAmt(A.filter(a=>a.category==="Дал в долг"));
  const pAvg=avg(tPers), runway=pAvg?liquid/pAvg:null;
  const aCats={}; A.forEach(a=>{ const k=a.category||"Прочее"; aCats[k]=(aCats[k]||0)+parseMoney(a.amount); });
  const assetCats=Object.entries(aCats).sort((a,b)=>b[1]-a[1]);
  const mLabel=k=>{ const [y,m]=k.split("-"); return `${MONTHS_SHORT[+m-1]} ${y.slice(2)}`; };

  return (
    <div style={{flex:1,overflowY:"auto",padding:"4px 16px 28px"}}>
      <div style={{...s.seg,marginBottom:14}}>{[[3,"3 мес"],[6,"6 мес"],[12,"12 мес"]].map(([k,l])=>(
        <button key={k} className="press" style={{...s.segBtn,...(period===k?s.segOn:{})}} onClick={()=>setPeriod(k)}>{l}</button>))}</div>

      <div style={s.heroCard}>
        <div style={{fontSize:11,letterSpacing:1.5,color:"rgba(255,255,255,0.55)",fontWeight:600,textTransform:"uppercase"}}>Норма сбережений</div>
        <div style={{fontSize:38,fontWeight:800,color:rate===null?"#fff":rate>=20?"#9BD3AE":rate>=0?C.brass:"#E9A39C",letterSpacing:-1,marginTop:6,lineHeight:1}}>{rate===null?"—":`${rate}%`}</div>
        <div style={{fontSize:12.5,color:"rgba(255,255,255,0.7)",marginTop:10,lineHeight:1.45}}>
          {rate===null?"Нет доходов за период":<>{saved>=0?"Отложено":"Не хватило"} {fmt(Math.abs(saved))} ₽ из {fmt(tInc)} ₽ дохода за {mLabel(keys[0])} — {mLabel(keys[keys.length-1])}</>}
        </div>
      </div>
      {noIncome>0&&<div style={{...s.panel,fontSize:12,color:C.textSub,lineHeight:1.5}}>В {noIncome} из {period} мес. нет доходов в CRM — средние и норма сбережений за этот период занижены.</div>}

      <div style={s.statGrid}>
        <Stat label="Средний доход / мес" value={`${fmt(avg(tInc))} ₽`} tone="green"/>
        <Stat label="Средний расход / мес" value={`${fmt(avg(tExp))} ₽`}/>
        <Stat label="Личные / мес" value={`${fmt(pAvg)} ₽`}/>
        <Stat label="Рабочие / мес" value={`${fmt(avg(tWork))} ₽`}/>
      </div>

      <div style={s.panel}>
        <div style={s.panelTitle}>Доходы и расходы по месяцам</div>
        {months.map((m,i)=>{ const d=m.inc-m.exp, r=m.inc?Math.round(d/m.inc*100):null; return (
          <div key={m.k} style={{padding:"10px 0",borderTop:i?`1px solid ${C.line}`:"none"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:7}}>
              <span style={{fontSize:13.5,fontWeight:700,color:C.text}}>{mLabel(m.k)}</span>
              <span style={{fontSize:12.5,fontWeight:700,color:d>=0?C.green:C.red}}>{d>=0?"+":"−"}{fmt(Math.abs(d))} ₽{r!==null&&<span style={{color:C.textMut,fontWeight:600}}> · {r}%</span>}</span>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"64px 1fr 84px",gap:"5px 8px",alignItems:"center",fontSize:11.5,color:C.textSub}}>
              <span>Доход</span><Bar value={m.inc} max={maxM} color={C.green}/><span style={{textAlign:"right",fontWeight:600,color:C.text}}>{fmt(m.inc)} ₽</span>
              <span>Расход</span><Bar value={m.exp} max={maxM} color={C.brass}/><span style={{textAlign:"right",fontWeight:600,color:C.text}}>{fmt(m.exp)} ₽</span>
            </div>
          </div>
        ); })}
      </div>

      {cats.length>0&&(
        <div style={s.panel}>
          <div style={s.panelTitle}>Куда уходят личные деньги · в среднем за месяц</div>
          {cats.map(([k,v])=>(
            <div key={k} style={{marginBottom:10}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:5}}>
                <span style={{color:C.text,fontWeight:600}}>{k}</span>
                <span style={{color:C.textSub,fontWeight:600}}>{fmt(avg(v))} ₽ · {Math.round(v/tPers*100)}%</span>
              </div>
              <Bar value={v} max={cats[0][1]} color={C.brass}/>
            </div>
          ))}
        </div>
      )}

      <div style={s.panel}>
        <div style={s.panelTitle}>Капитал</div>
        <div style={{fontSize:28,fontWeight:800,color:C.text,letterSpacing:-0.8,marginBottom:10}}>{fmt(ta-tl)} ₽</div>
        <Row label="Активы" value={`${fmt(ta)} ₽`}/>
        <Row label="Пассивы" value={`${fmt(tl)} ₽`} tone={tl?"red":null}/>
        <Row label="Долговая нагрузка" hint="пассивы / активы" value={ta?`${Math.round(tl/ta*100)}%`:"—"} tone={ta&&tl/ta>0.5?"red":null}/>
        <Row label="Свободные деньги" hint="счета и вклады" value={`${fmt(liquid)} ₽`}/>
        <Row label="Подушка" hint="без доходов" value={runway===null?"—":`${runway.toFixed(1).replace(".",",")} мес`} tone={runway===null?null:runway>=6?"green":runway>=3?"brass":"red"}/>
        {runway!==null&&<div style={{marginTop:2,marginBottom:6}}><Bar value={runway} max={6} color={runway>=6?C.green:runway>=3?C.brass:C.red}/><div style={{fontSize:11,color:C.textMut,marginTop:5}}>Цель — 6 месяцев личных расходов ({fmt(pAvg*6)} ₽)</div></div>}
        {lent>0&&<Row label="Дал в долг" value={`${fmt(lent)} ₽`} tone="brass"/>}
      </div>

      {assetCats.length>0&&(
        <div style={s.panel}>
          <div style={s.panelTitle}>Структура активов</div>
          {assetCats.map(([k,v])=>(
            <div key={k} style={{marginBottom:10}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:5}}>
                <span style={{color:C.text,fontWeight:600}}>{k}</span>
                <span style={{color:C.textSub,fontWeight:600}}>{fmt(v)} ₽ · {Math.round(v/ta*100)}%</span>
              </div>
              <Bar value={v} max={assetCats[0][1]} color={C.ink}/>
            </div>
          ))}
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
  const [rawEvents,setRawEvents]=useState([]);
  const [txs,setTxs]=useState([]);
  const [assets,setAssets]=useState([]);
  const events=enrich(rawEvents,txs);
  const setEvents=(list)=>setRawEvents(list.map(baseEvent));
  const [txDraft,setTxDraft]=useState(null);
  const [txBack,setTxBack]=useState(V.FIN);
  const [txDel,setTxDel]=useState(false);
  const [finTab,setFinTab]=useState("income");
  const [dashTab,setDashTab]=useState("orders");
  const [finMonth,setFinMonth]=useState(todayISO().slice(0,7));
  const [assetDraft,setAssetDraft]=useState(null);
  const [assetDel,setAssetDel]=useState(false);
  const [view,setView]=useState(V.LIST);
  const [activeId,setActiveId]=useState(null);
  const [draft,setDraft]=useState(null);
  const [del,setDel]=useState(false);
  const [arc,setArc]=useState(false);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState(null);
  const [monthKey,setMonthKey]=useState(null);
  const [origin,setOrigin]=useState(V.LIST);
  const notesTimer=useRef(null);

  useEffect(()=>{ (async()=>{
    try{
      const [evs,tx,as]=await Promise.all([dbLoad(),loadCol(TX),loadCol(AS)]);
      let allTx=tx, allEv=evs;
      const pending=evs.filter(e=>!e.finMigrated);
      if(pending.length){
        try{
          const ops=[], added=[], known=new Set(tx.map(t=>t.id));
          pending.forEach(ev=>migrationFor(ev).forEach(t=>{ if(!known.has(t.id)){ ops.push([TX,t]); added.push(t); } }));
          const migrated=pending.map(ev=>baseEvent({...ev,finMigrated:true}));
          migrated.forEach(ev=>ops.push([COL,ev]));
          await commitOps(ops);
          allTx=[...tx,...added];
          allEv=evs.map(e=>migrated.find(m=>m.id===e.id)||e);
        }catch(e){ setError("Не удалось перенести старые оплаты и расходы: "+e.message); }
      }
      setRawEvents(allEv); setTxs(allTx); setAssets(as);
    }catch(e){ setError("Не удалось загрузить: "+e.message); }
    finally{ setLoading(false); }
  })(); },[]);

  const activeEvent=events.find(e=>e.id===activeId)||null;
  const activeEvents=[...events].filter(e=>!e.archived).sort((a,b)=>(a.date||"").localeCompare(b.date||""));
  const archivedEvents=[...events].filter(e=>e.archived).sort((a,b)=>(b.date||"").localeCompare(a.date||""));

  const openEvent=(ev,from)=>{ setActiveId(ev.id); if(from) setOrigin(from); setView(V.EVENT); };
  const openNew=()=>{ setDraft(emptyEvent()); setView(V.FORM); };
  const openEdit=()=>{ setDraft({...emptyEvent(),...baseEvent(activeEvent)}); setView(V.FORM); };

  const saveForm=async()=>{
    if(!draft.title.trim()) return; setSaving(true);
    const clean=baseEvent({...draft});
    try{ await dbUpsert(clean);
      const exists=rawEvents.find(e=>e.id===clean.id);
      setRawEvents(exists?rawEvents.map(e=>e.id===clean.id?clean:e):[clean,...rawEvents]);
      setActiveId(clean.id); setView(V.EVENT); setDraft(null);
    }catch(e){ setError("Ошибка: "+e.message); }finally{ setSaving(false); }
  };
  const cancelForm=()=>{ setView(activeId?V.EVENT:V.LIST); setDraft(null); };
  const doDelete=async()=>{ try{
      const ops=txs.filter(t=>t.eventId===activeId).map(t=>[TX,{...t,eventId:""}]);
      ops.push([COL,{id:activeId},true]);
      await commitOps(ops);
      setTxs(txs.map(t=>t.eventId===activeId?{...t,eventId:""}:t));
      setRawEvents(rawEvents.filter(e=>e.id!==activeId));
      const wasArc=activeEvent?.archived; setActiveId(null); setDel(false); setView(wasArc?V.ARCHIVE:V.LIST);
    }catch(e){setError("Ошибка: "+e.message);} };
  const doArchive=async()=>{ if(!activeEvent) return; const u={...activeEvent,archived:!activeEvent.archived}; try{ await dbUpsert(u); setEvents(events.map(e=>e.id===activeId?u:e)); setArc(false); setView(u.archived?V.ARCHIVE:V.LIST);}catch(e){setError("Ошибка: "+e.message);} };
  const updateNotes=(val)=>{ const upd=events.map(e=>e.id===activeId?{...e,notes:val}:e); setEvents(upd); clearTimeout(notesTimer.current); notesTimer.current=setTimeout(async()=>{ const ev=upd.find(e=>e.id===activeId); if(ev){try{await dbUpsert(ev);}catch{}} },1500); };
  const setField=(f,v)=>setDraft(d=>({...d,[f]:v}));
  const openTx=(t,back)=>{ setTxDraft({...t}); setTxBack(back); setTxDel(false); setView(V.TX); };
  const newTx=(type,eventId,back)=>openTx({id:newId("t"),type,date:todayISO(),amount:"",name:"",category:eventId?"Мероприятия":"",eventId:eventId||"",createdAt:new Date().toISOString(),_new:true},back);
  const closeTx=()=>{ setView(txBack); setTxDraft(null); };
  const saveTx=async()=>{
    if(parseMoney(txDraft.amount)<=0||saving) return; setSaving(true);
    const {_new,...t}=txDraft;
    try{ await saveDoc(TX,t); setTxs(txs.some(x=>x.id===t.id)?txs.map(x=>x.id===t.id?t:x):[...txs,t]); closeTx(); }
    catch(e){ setError("Ошибка: "+e.message); } finally{ setSaving(false); }
  };
  const renameTx=async(t,name)=>{
    const u={...t,name};
    setTxs(prev=>prev.map(x=>x.id===t.id?u:x));
    try{ await saveDoc(TX,u); }
    catch(e){ setTxs(prev=>prev.map(x=>x.id===t.id?t:x)); setError("Не удалось переименовать: "+e.message); }
  };
  const deleteTx=async()=>{ try{ await removeDoc(TX,txDraft.id); setTxs(txs.filter(x=>x.id!==txDraft.id)); setTxDel(false); closeTx(); }catch(e){ setError("Ошибка: "+e.message); } };
  const openAsset=(a)=>{ setAssetDraft({...a}); setAssetDel(false); setView(V.ASSET); };
  const newAsset=()=>openAsset({id:newId("a"),kind:"asset",category:"Вклады",name:"",amount:"",rate:"",dueDate:"",note:"",_new:true});
  const closeAsset=()=>{ setFinTab("assets"); setView(V.FIN); setAssetDraft(null); };
  const saveAsset=async()=>{
    if(!assetDraft.name.trim()||saving) return; setSaving(true);
    const {_new,...a}={...assetDraft,updatedAt:new Date().toISOString()};
    try{ await saveDoc(AS,a); setAssets(assets.some(x=>x.id===a.id)?assets.map(x=>x.id===a.id?a:x):[...assets,a]); closeAsset(); }
    catch(e){ setError("Ошибка: "+e.message); } finally{ setSaving(false); }
  };
  const deleteAsset=async()=>{ try{ await removeDoc(AS,assetDraft.id); setAssets(assets.filter(x=>x.id!==assetDraft.id)); setAssetDel(false); closeAsset(); }catch(e){ setError("Ошибка: "+e.message); } };
  const doExportTx=async()=>{ try{ await exportTransactions(txs,events); }catch(e){ setError("Не удалось выгрузить: "+e.message); } };
  const [exporting,setExporting]=useState(false);
  const doExport=async()=>{ setExporting(true); try{ await exportEvents(events); }catch(e){ setError("Не удалось выгрузить: "+e.message); } finally{ setExporting(false); } };
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
        {activeEvents.map(ev=><EventCard key={ev.id} ev={ev} onClick={()=>openEvent(ev,V.LIST)}/>)}
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
        {archivedEvents.map(ev=><EventCard key={ev.id} ev={ev} onClick={()=>openEvent(ev,V.ARCHIVE)}/>)}
      </div>
      <TabBar view={view} onTab={onTab}/>
    </div>
  );

  if(view===V.CLIENTS) return (
    <div style={s.screen}><TopBar title="Клиенты"/><Clients events={events}/><TabBar view={view} onTab={onTab}/></div>
  );
  if(view===V.CAL) return (
    <div style={s.screen}><TopBar title="Календарь"/><Calendar events={events} onEventClick={ev=>{setActiveId(ev.id);setOrigin(V.CAL);setView(V.EVENT);}}/><TabBar view={view} onTab={onTab}/></div>
  );
  if(view===V.DASH) return (
    <div style={s.screen}>
      <TopBar title="Аналитика" sub={dashTab==="orders"?"по всем заказам":"доходы, расходы, капитал"} right={dashTab==="orders"?<button style={s.exportBtn} className="press" onClick={doExport} disabled={exporting}>{exporting?"…":"Выгрузить"}</button>:null}/>
      <div style={{padding:"12px 16px 4px",flexShrink:0}}>
        <div style={s.seg}>{[["orders","Заказы"],["finance","Финансы"]].map(([k,l])=>(
          <button key={k} className="press" style={{...s.segBtn,...(dashTab===k?s.segOn:{})}} onClick={()=>setDashTab(k)}>{l}</button>))}</div>
      </div>
      {dashTab==="orders"
        ? <Dashboard events={events} onMonthClick={(k)=>{setMonthKey(k);setView(V.MONTH);}}/>
        : <FinanceAnalytics txs={txs} assets={assets}/>}
      <TabBar view={view} onTab={onTab}/>
    </div>
  );

  if(view===V.MONTH&&monthKey) {
    const [my,mm]=monthKey.split("-");
    const monthName=MONTHS_RU[parseInt(mm)-1];
    const monthEvents=[...events].filter(e=>(e.date||"").startsWith(monthKey)).sort((a,b)=>(a.date||"").localeCompare(b.date||""));
    const mRev=monthEvents.reduce((s,e)=>s+earned(e),0);
    const mExp=monthEvents.reduce((s,e)=>s+parseMoney(e.expenses),0);
    const mProf=monthEvents.reduce((s,e)=>s+profit(e),0);
    return (
      <div style={s.screen}>
        <TopBar left={<BackBtn onClick={()=>setView(V.DASH)}/>} title={`${monthName} ${my}`} sub={`${monthEvents.length} ${monthEvents.length===1?"заказ":monthEvents.length<5?"заказа":"заказов"} · ${fmt(mRev)} ₽`}/>
        {monthEvents.length>0&&(
          <div style={s.monthTotals}>
            <div style={s.mtItem}><div style={s.mtKey}>Выручка</div><div style={s.mtVal}>{fmt(mRev)} ₽</div></div>
            <div style={s.mtItem}><div style={s.mtKey}>Расходы</div><div style={{...s.mtVal,color:C.textSub}}>{fmt(mExp)} ₽</div></div>
            <div style={s.mtItem}><div style={s.mtKey}>Прибыль</div><div style={{...s.mtVal,color:C.brass}}>{fmt(mProf)} ₽</div></div>
          </div>
        )}
        <div style={{flex:1,overflowY:"auto"}}>
          {monthEvents.length===0&&<div style={s.empty}><div style={{color:C.textMut,fontSize:13}}>В этом месяце заказов нет</div></div>}
          {monthEvents.map(ev=><EventCard key={ev.id} ev={ev} showFinance onClick={()=>{setActiveId(ev.id);setOrigin(V.MONTH);setView(V.EVENT);}}/>)}
        </div>
      </div>
    );
  }

  if(view===V.FIN){
    const [fy,fm]=finMonth.split("-").map(Number);
    const shiftMonth=(d)=>{ const dt=new Date(fy,fm-1+d,1); setFinMonth(`${dt.getFullYear()}-${pad2(dt.getMonth()+1)}`); };
    const monthTx=txs.filter(t=>(t.date||"").startsWith(finMonth));
    const inc=sumTx(monthTx.filter(t=>t.type==="income")), exp=sumTx(monthTx.filter(t=>t.type==="expense"));
    const type=finTab==="income"?"income":"expense";
    const list=monthTx.filter(t=>t.type===type).sort((a,b)=>(b.date||"").localeCompare(a.date||"")||(b.createdAt||"").localeCompare(a.createdAt||""));
    const byCat={}; list.forEach(t=>{ const k=t.category||"Без категории"; byCat[k]=(byCat[k]||0)+parseMoney(t.amount); });
    const cats=Object.entries(byCat).sort((a,b)=>b[1]-a[1]);
    const total=type==="income"?inc:exp;
    const groups=[]; list.forEach(t=>{ const g=groups[groups.length-1]; if(g&&g.date===t.date) g.items.push(t); else groups.push({date:t.date,items:[t]}); });
    const evTitle=id=>{ const e=events.find(x=>x.id===id); return e?e.title:null; };
    return (
      <div style={s.screen}>
        <TopBar title="Финансы"
          left={finTab!=="assets"?<button style={s.iconBtn} className="press" onClick={doExportTx}><IconDownload color={C.textSub}/></button>:null}
          right={<button style={s.addBtn} className="press" onClick={()=>finTab==="assets"?newAsset():newTx(type,"",V.FIN)}>＋</button>}/>
        {error&&<Err error={error} clear={()=>setError(null)}/>}
        <div style={{padding:"12px 16px 8px",flexShrink:0}}>
          <div style={s.seg}>{[["income","Доходы"],["expense","Расходы"],["assets","Активы"]].map(([k,l])=>(
            <button key={k} className="press" style={{...s.segBtn,...(finTab===k?s.segOn:{})}} onClick={()=>setFinTab(k)}>{l}</button>))}</div>
        </div>
        {finTab==="assets"?<AssetsView assets={assets} onOpen={openAsset}/>:(
          <div style={{flex:1,overflowY:"auto",padding:"4px 16px 28px"}}>
            <div style={s.monthNav}>
              <button style={s.calNav} className="press" onClick={()=>shiftMonth(-1)}>‹</button>
              <span style={{fontSize:16,fontWeight:700,color:C.text}}>{MONTHS_RU[fm-1]} {fy}</span>
              <button style={s.calNav} className="press" onClick={()=>shiftMonth(1)}>›</button>
            </div>
            <div style={s.statGrid}>
              <div style={s.statCard}><div style={s.statLabel}>Доходы</div><div style={{...s.statValue,fontSize:18,color:C.green}}>{fmt(inc)} ₽</div></div>
              <div style={s.statCard}><div style={s.statLabel}>Расходы</div><div style={{...s.statValue,fontSize:18}}>{fmt(exp)} ₽</div></div>
              <div style={{...s.statCard,gridColumn:"span 2",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div style={s.statLabel}>Итог месяца</div>
                <div style={{...s.statValue,fontSize:18,color:inc-exp>=0?C.green:C.red}}>{inc-exp>=0?"+":"−"}{fmt(Math.abs(inc-exp))} ₽</div>
              </div>
            </div>
            {cats.length>0&&(
              <div style={s.panel}>
                <div style={s.panelTitle}>{type==="income"?"Доходы":"Расходы"} по категориям</div>
                {cats.map(([k,v])=>(
                  <div key={k} style={{marginBottom:10}}>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:5}}>
                      <span style={{color:C.text,fontWeight:600}}>{k}</span>
                      <span style={{color:C.textSub,fontWeight:600}}>{fmt(v)} ₽ · {Math.round(v/total*100)}%</span>
                    </div>
                    <div style={{height:6,background:C.bgAlt,borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:`${Math.round(v/total*100)}%`,background:type==="income"?C.green:C.brass,borderRadius:3}}/></div>
                  </div>
                ))}
              </div>
            )}
            {groups.length===0&&<div style={{...s.panel,textAlign:"center",color:C.textSub,fontSize:13}}>{type==="income"?"Доходов":"Расходов"} в этом месяце нет</div>}
            {groups.map(g=>(
              <div key={g.date}>
                <div style={s.groupHead}>{formatDate(g.date)}</div>
                <div style={{...s.panel,padding:"2px 16px"}}>
                  {g.items.map(t=>{ const et=evTitle(t.eventId);
                    return <TxRow key={t.id} t={t} showCat meta={et&&<span style={{color:C.brass}}>{et}</span>} onClick={()=>openTx(t,V.FIN)} onRename={renameTx}/>; })}
                </div>
              </div>
            ))}
          </div>
        )}
        <TabBar view={view} onTab={onTab}/>
      </div>
    );
  }

  if(view===V.TX&&txDraft){
    const isInc=txDraft.type==="income";
    const cats=isInc?INCOME_CATS:EXPENSE_CATS;
    const setT=(f,v)=>setTxDraft(d=>({...d,[f]:v}));
    const evOptions=[...events].sort((a,b)=>(b.date||"").localeCompare(a.date||""));
    return (
      <div style={s.screen}>
        <TopBar left={<BackBtn onClick={closeTx}/>} title={txDraft._new?(isInc?"Новый доход":"Новый расход"):(isInc?"Доход":"Расход")}
          right={<button style={{...s.saveBtn,opacity:parseMoney(txDraft.amount)>0&&!saving?1:0.35}} className="press" onClick={saveTx}>{saving?"…":"Готово"}</button>}/>
        {error&&<Err error={error} clear={()=>setError(null)}/>}
        <div style={{flex:1,overflowY:"auto",padding:"16px 16px 48px"}}>
          <div style={{...s.seg,marginBottom:16}}>{[["income","Доход"],["expense","Расход"]].map(([k,l])=>(
            <button key={k} className="press" style={{...s.segBtn,...(txDraft.type===k?s.segOn:{})}} onClick={()=>setT("type",k)}>{l}</button>))}</div>
          <div style={s.amountWrap}>
            <input style={{...s.amountInput,color:isInc?C.green:C.text}} inputMode="numeric" placeholder="0" autoFocus={!!txDraft._new} value={txDraft.amount} onChange={e=>setT("amount",formatMoney(e.target.value))}/>
            <span style={s.amountCur}>₽</span>
          </div>
          <Field label="Описание"><input style={s.fld} className="fld" placeholder={isInc?"Например, предоплата":"Например, аренда зала"} value={txDraft.name} onChange={e=>setT("name",e.target.value)}/></Field>
          <Field label="Категория">
            <div style={{display:"flex",flexWrap:"wrap",gap:7}}>{cats.map(o=><button key={o} style={{...s.pick,...(txDraft.category===o?s.pickOn:{})}} className="press" onClick={()=>setT("category",txDraft.category===o?"":o)}>{o}</button>)}</div>
            <input style={{...s.fld,marginTop:9}} className="fld" placeholder="Своя категория" value={cats.includes(txDraft.category)?"":txDraft.category} onChange={e=>setT("category",e.target.value)}/>
          </Field>
          <Field label="Дата"><input type="date" style={s.fld} className="fld" value={txDraft.date} onChange={e=>setT("date",e.target.value)}/></Field>
          <Field label="Мероприятие" hint="Если выбрать, запись появится в карточке этого заказа">
            <select style={s.fld} className="fld" value={txDraft.eventId||""} onChange={e=>setT("eventId",e.target.value)}>
              <option value="">Без привязки</option>
              {evOptions.map(ev=><option key={ev.id} value={ev.id}>{ev.date?formatDate(ev.date)+" · ":""}{ev.title}</option>)}
            </select>
          </Field>
          {!txDraft._new&&<button style={s.dangerLink} className="press" onClick={()=>setTxDel(true)}>Удалить запись</button>}
        </div>
        {txDel&&<Sheet title="Удалить запись?" sub="Запись удалится из финансов и из карточки заказа, если она к нему привязана." cancel={()=>setTxDel(false)} confirm={deleteTx} confirmLabel="Удалить" confirmColor={C.red}/>}
      </div>
    );
  }

  if(view===V.ASSET&&assetDraft){
    const isL=assetDraft.kind==="liability";
    const cats=isL?LIAB_CATS:ASSET_CATS;
    const setA=(f,v)=>setAssetDraft(d=>({...d,[f]:v}));
    const ph={"Счета и наличные":"Карта Тинькофф","Вклады":"Вклад в Сбере","Акции и облигации":"ОФЗ 26238","Дал в долг":"Долг Ивану","Кредиты":"Кредит на машину","Мои долги":"Долг Сергею"}[assetDraft.category]||"Название";
    const amountLabel=isL?"Сколько осталось вернуть, ₽":assetDraft.category==="Акции и облигации"?"Текущая стоимость, ₽":assetDraft.category==="Дал в долг"?"Сколько должны вернуть, ₽":"Сумма, ₽";
    return (
      <div style={s.screen}>
        <TopBar left={<BackBtn onClick={closeAsset}/>} title={assetDraft._new?(isL?"Новый пассив":"Новый актив"):assetDraft.name||"Позиция"}
          right={<button style={{...s.saveBtn,opacity:assetDraft.name.trim()&&!saving?1:0.35}} className="press" onClick={saveAsset}>{saving?"…":"Готово"}</button>}/>
        {error&&<Err error={error} clear={()=>setError(null)}/>}
        <div style={{flex:1,overflowY:"auto",padding:"16px 16px 48px"}}>
          <div style={{...s.seg,marginBottom:16}}>{[["asset","Актив"],["liability","Пассив"]].map(([k,l])=>(
            <button key={k} className="press" style={{...s.segBtn,...(assetDraft.kind===k?s.segOn:{})}}
              onClick={()=>setAssetDraft(d=>({...d,kind:k,category:(k==="liability"?LIAB_CATS:ASSET_CATS).includes(d.category)?d.category:(k==="liability"?LIAB_CATS:ASSET_CATS)[0]}))}>{l}</button>))}</div>
          <Field label="Категория">
            <div style={{display:"flex",flexWrap:"wrap",gap:7}}>{cats.map(o=><button key={o} style={{...s.pick,...(assetDraft.category===o?s.pickOn:{})}} className="press" onClick={()=>setA("category",o)}>{o}</button>)}</div>
          </Field>
          <Field label="Название"><input style={s.fld} className="fld" placeholder={ph} value={assetDraft.name} autoFocus={!!assetDraft._new} onChange={e=>setA("name",e.target.value)}/></Field>
          <Field label={amountLabel}><input style={s.fld} className="fld" placeholder="100 000" inputMode="numeric" value={assetDraft.amount} onChange={e=>setA("amount",formatMoney(e.target.value))}/></Field>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <Field label="Ставка, % годовых"><input style={s.fld} className="fld" placeholder="—" inputMode="decimal" value={assetDraft.rate} onChange={e=>setA("rate",e.target.value.replace(/[^\d.,]/g,"").replace(",","."))}/></Field>
            <Field label={isL||assetDraft.category==="Дал в долг"?"Вернуть до":"Срок до"}><input type="date" style={s.fld} className="fld" value={assetDraft.dueDate} onChange={e=>setA("dueDate",e.target.value)}/></Field>
          </div>
          <Field label="Заметка"><textarea style={{...s.fld,minHeight:80,resize:"vertical",lineHeight:1.5}} className="fld" placeholder="Банк, условия, количество бумаг, контакты…" value={assetDraft.note} onChange={e=>setA("note",e.target.value)}/></Field>
          {assetDraft.updatedAt&&<div style={{fontSize:12,color:C.textMut,marginTop:-6,marginBottom:14}}>Последнее обновление: {formatDate(assetDraft.updatedAt.slice(0,10))}</div>}
          {!assetDraft._new&&<button style={s.dangerLink} className="press" onClick={()=>setAssetDel(true)}>Удалить позицию</button>}
        </div>
        {assetDel&&<Sheet title="Удалить позицию?" sub="Она пропадёт из активов и пассивов." cancel={()=>setAssetDel(false)} confirm={deleteAsset} confirmLabel="Удалить" confirmColor={C.red}/>}
      </div>
    );
  }

  if(view===V.EVENT&&activeEvent) {
    const rem=remaining(activeEvent), pr=profit(activeEvent), isArc=activeEvent.archived;
    return (
      <div style={s.screen}>
        <TopBar left={<BackBtn onClick={()=>setView(isArc?V.ARCHIVE:origin)}/>} title={activeEvent.title}
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

          <div style={s.moneyBlock}>
            {activeEvent.totalCost&&<div style={s.moneyRow}><span style={s.moneyKey}>Стоимость</span><span style={s.moneyVal}>{activeEvent.totalCost} ₽</span></div>}
            <div style={s.moneyRow}><span style={s.moneyKey}>Оплачено</span><span style={{...s.moneyVal,color:C.green}}>{fmt(parseMoney(activeEvent.paidCost))} ₽</span></div>
            {activeEvent.totalCost&&<div style={s.moneyRow}><span style={s.moneyKey}>Остаток</span><span style={{...s.moneyVal,color:rem>0?C.red:C.green}}>{rem>0?`${fmt(rem)} ₽`:"оплачено"}</span></div>}
            <div style={s.moneyRow}><span style={s.moneyKey}>Расходы</span><span style={{...s.moneyVal,color:C.textSub}}>{fmt(parseMoney(activeEvent.expenses))} ₽</span></div>
            <div style={{...s.moneyRow,borderTop:`1px solid ${C.line}`,paddingTop:10,marginTop:4}}><span style={{...s.moneyKey,fontWeight:700,color:C.text}}>Прибыль</span><span style={{...s.moneyVal,color:C.brass,fontWeight:800}}>{fmt(pr)} ₽</span></div>
          </div>

          {[["income","Оплаты",activeEvent.incomeTxs||[],"＋ Добавить оплату"],["expense","Расходы",activeEvent.expenseTxs||[],"＋ Добавить расход"]].map(([type,title,list,add])=>(
            <div key={type} style={{...s.panel,padding:"14px 16px 4px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline"}}>
                <span style={{...s.panelTitle,marginBottom:4}}>{title}</span>
                {list.length>0&&<span style={{fontSize:13,fontWeight:700,color:type==="income"?C.green:C.text}}>{fmt(sumTx(list))} ₽</span>}
              </div>
              {list.map(t=><TxRow key={t.id} t={t} meta={[formatDate(t.date),t.category].filter(Boolean).join(" · ")} onClick={()=>openTx(t,V.EVENT)}/>)}
              <button style={{...s.expAdd,padding:"12px 0"}} className="press" onClick={()=>newTx(type,activeEvent.id,V.EVENT)}>{add}</button>
            </div>
          ))}

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
          <Field label="Стоимость, ₽" hint="Сумма, о которой договорились на встрече"><input style={s.fld} className="fld" placeholder="50 000" inputMode="numeric" value={draft.totalCost} onChange={e=>setField("totalCost",formatMoney(e.target.value))}/></Field>
          <div style={s.formSummary}><div style={{fontSize:13,color:C.textSub,lineHeight:1.55}}>Оплаты и расходы добавляются в карточке заказа после сохранения — они сразу попадают в раздел «Финансы».</div></div>
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
  monthTotals:{display:"flex",background:C.surface,borderBottom:`1px solid ${C.line}`,padding:"12px 16px",flexShrink:0},
  mtItem:{flex:1,display:"flex",flexDirection:"column",gap:3},
  mtKey:{fontSize:10,color:C.textMut,fontWeight:600,letterSpacing:0.3,textTransform:"uppercase"},
  mtVal:{fontSize:15,fontWeight:800,color:C.text,letterSpacing:-0.3},
  arcBanner:{background:C.amberBg,color:C.amber,fontSize:12,padding:"9px 16px",flexShrink:0,fontWeight:700,letterSpacing:0.2},
  empty:{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"70px 40px",flex:1,textAlign:"center",opacity:0.9},
  card:{padding:"15px 16px",cursor:"pointer",background:C.surface,borderBottom:`1px solid ${C.line}`},
  cardTitle:{fontWeight:700,fontSize:15.5,color:C.text,letterSpacing:-0.2,flex:1,lineHeight:1.3},
  cardDate:{fontSize:12,color:C.textMut,whiteSpace:"nowrap",fontWeight:600},
  cardSub:{fontSize:12.5,color:C.textSub,marginTop:2,marginBottom:9},
  cardChips:{display:"flex",flexWrap:"wrap",gap:6,marginTop:2},
  finRow:{display:"flex",gap:20,marginTop:11,paddingTop:11,borderTop:`1px solid ${C.line}`},
  finItem:{display:"flex",flexDirection:"column",gap:2},
  finKey:{fontSize:10,color:C.textMut,fontWeight:500},
  finVal:{fontSize:13,color:C.text,fontWeight:600},
  chip:{fontSize:11,fontWeight:600,padding:"4px 9px",borderRadius:7,letterSpacing:0.1},
  phoneLink:{fontSize:14,color:C.brass,fontWeight:700,textDecoration:"none",display:"block",margin:"5px 0 9px"},
  search:{width:"100%",background:C.surface,border:`1px solid ${C.line}`,color:C.text,padding:"12px 15px",fontSize:14.5,fontFamily:"inherit",borderRadius:12,outline:"none",boxSizing:"border-box"},
  // detail
  detailBlock:{background:C.surface,border:`1px solid ${C.line}`,borderRadius:16,padding:"4px 16px",marginBottom:12},
  detailRow:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 0",borderBottom:`1px solid ${C.line}`},
  detailKey:{fontSize:13,color:C.textSub},
  detailVal:{fontSize:14,color:C.text,fontWeight:600,textAlign:"right"},
  expNote:{fontSize:12.5,color:C.textSub,lineHeight:1.55,padding:"2px 0 8px",whiteSpace:"pre-wrap"},
  expList:{background:C.surface,border:`1px solid ${C.line2}`,borderRadius:12,overflow:"hidden"},
  expItemRow:{display:"flex",alignItems:"center",gap:8,padding:"6px 8px 6px 12px",borderBottom:`1px solid ${C.line}`},
  expName:{flex:1,minWidth:0,border:"none",outline:"none",background:"transparent",fontSize:15,fontFamily:"inherit",color:C.text,padding:"8px 0"},
  expAmt:{width:84,border:"none",outline:"none",background:C.bgAlt,borderRadius:8,fontSize:15,fontFamily:"inherit",color:C.text,padding:"8px 10px",textAlign:"right"},
  expDel:{width:30,height:30,border:"none",background:"transparent",color:C.textMut,fontSize:20,cursor:"pointer",lineHeight:1,flexShrink:0},
  expAdd:{width:"100%",border:"none",background:"transparent",color:C.brass,fontWeight:700,fontSize:13.5,fontFamily:"inherit",padding:"12px 14px",textAlign:"left",cursor:"pointer"},
  exportBtn:{background:C.surface,border:`1px solid ${C.line2}`,color:C.text,padding:"8px 12px",fontWeight:700,fontSize:12.5,fontFamily:"inherit",borderRadius:10,cursor:"pointer",whiteSpace:"nowrap"},
  seg:{display:"flex",background:C.bgAlt,borderRadius:12,padding:3,gap:3},
  segBtn:{flex:1,border:"none",background:"transparent",color:C.textSub,fontWeight:600,fontSize:13.5,fontFamily:"inherit",padding:"9px 6px",borderRadius:9,cursor:"pointer"},
  segOn:{background:C.surface,color:C.text,fontWeight:700,boxShadow:"0 1px 3px rgba(0,0,0,0.08)"},
  monthNav:{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"4px 0 14px"},
  groupHead:{fontSize:11.5,fontWeight:700,color:C.textSub,letterSpacing:0.3,textTransform:"uppercase",margin:"16px 2px 8px"},
  txRow:{display:"flex",alignItems:"center",gap:12,padding:"11px 0",borderBottom:`1px solid ${C.line}`,cursor:"pointer"},
  txName:{fontSize:14.5,fontWeight:600,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"},
  txNameEdit:{display:"block",width:"100%",fontSize:14.5,fontWeight:600,color:C.text,fontFamily:"inherit",background:"transparent",border:"none",borderBottom:"1px solid transparent",outline:"none",padding:"1px 0",borderRadius:0,textOverflow:"ellipsis"},
  txMeta:{fontSize:12,color:C.textSub,marginTop:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"},
  txAmt:{fontSize:15,fontWeight:700,whiteSpace:"nowrap",letterSpacing:-0.2},
  txCat:{fontSize:12,fontWeight:600,color:C.inkSoft,background:C.bgAlt,borderRadius:999,padding:"4px 10px",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:"38%",flexShrink:1},
  txCatNone:{color:C.textMut,background:"transparent",border:`1px dashed ${C.line2}`,fontWeight:500},
  amountWrap:{display:"flex",alignItems:"baseline",justifyContent:"center",gap:6,padding:"10px 0 22px"},
  amountInput:{width:"100%",maxWidth:240,border:"none",outline:"none",background:"transparent",fontSize:40,fontWeight:800,textAlign:"right",fontFamily:"inherit",letterSpacing:-1},
  amountCur:{fontSize:28,fontWeight:700,color:C.textMut},
  dangerLink:{width:"100%",background:"none",border:`1px solid ${C.redBg}`,color:C.red,fontWeight:700,fontSize:14,fontFamily:"inherit",padding:"13px",borderRadius:12,cursor:"pointer",marginTop:8},
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
        .inl:focus{border-bottom-color:${C.brass} !important}
        .inl::placeholder{color:${C.text}}
        input,textarea{font-size:16px}
        @media(min-width:400px){input,textarea{font-size:inherit}}
      `}</style>
      <App/>
    </>
  );
}
