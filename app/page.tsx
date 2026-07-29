"use client";

import { useEffect, useMemo, useState } from "react";

type SetRow = { id: number; weight: number; reps: number; done: boolean };
type Exercise = { id: number; name: string; muscle: string; restSeconds: number; sets: SetRow[] };
type CompletedExercise = { name: string; muscle: string; sets: { weight: number; reps: number }[] };
type Session = { id: number; iso: string; date: string; title: string; volume: number; duration: number; exercises?: CompletedExercise[] };
type Template = { id: number; name: string; subtitle: string; exercises: Exercise[] };
type Measurement = { id: number; iso: string; weight: number; waist: number; chest: number; arm: number; photo?: string };
type SavedState = { templates: Template[]; activeTemplateId: number; history: Session[]; measurements: Measurement[] };

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
const cloudSyncEnabled = process.env.NEXT_PUBLIC_CLOUD_SYNC !== "false";
const todayIso = () => new Date().toISOString().slice(0, 10);
const formatDate = (iso: string) => new Intl.DateTimeFormat("ru", { day: "numeric", month: "short" }).format(new Date(`${iso}T12:00:00`)).replace(".", "");
const setRows = (weights: number[][]) => weights.map((v, i) => ({ id: i + 1, weight: v[0], reps: v[1], done: false }));
const cloneExercises = (items: Exercise[]) => items.map(e => ({ ...e, sets: e.sets.map(s => ({ ...s, done: false })) }));

const catalog = [
  ["Жим штанги лёжа", "Грудь"], ["Жим гантелей на наклонной", "Грудь"], ["Сведение в кроссовере", "Грудь"],
  ["Тяга верхнего блока", "Спина"], ["Тяга штанги в наклоне", "Спина"], ["Подтягивания", "Спина"],
  ["Приседания со штангой", "Ноги"], ["Жим ногами", "Ноги"], ["Сгибание ног", "Ноги"], ["Разгибание ног", "Ноги"],
  ["Жим гантелей сидя", "Плечи"], ["Махи гантелей в стороны", "Плечи"], ["Обратная бабочка", "Плечи"],
  ["Сгибание рук со штангой", "Бицепс"], ["Молотковые сгибания", "Бицепс"],
  ["Разгибание рук на блоке", "Трицепс"], ["Французский жим", "Трицепс"],
  ["Становая тяга", "Всё тело"], ["Планка", "Кор"], ["Скручивания", "Кор"],
] as const;

const defaultTemplates: Template[] = [
  { id: 1, name: "Верх тела", subtitle: "Грудь · Спина · Плечи", exercises: [
    { id: 1, name: "Жим штанги лёжа", muscle: "Грудь", restSeconds: 120, sets: setRows([[60,10],[65,8],[65,8]]) },
    { id: 2, name: "Тяга верхнего блока", muscle: "Спина", restSeconds: 90, sets: setRows([[55,12],[60,10],[60,10]]) },
    { id: 3, name: "Жим гантелей сидя", muscle: "Плечи", restSeconds: 90, sets: setRows([[18,10],[18,10],[18,8]]) },
  ]},
  { id: 2, name: "Ноги", subtitle: "Квадрицепс · Бицепс бедра · Ягодицы", exercises: [
    { id: 4, name: "Приседания со штангой", muscle: "Ноги", restSeconds: 180, sets: setRows([[70,10],[80,8],[80,8]]) },
    { id: 5, name: "Жим ногами", muscle: "Ноги", restSeconds: 120, sets: setRows([[120,12],[130,10],[130,10]]) },
    { id: 6, name: "Сгибание ног", muscle: "Ноги", restSeconds: 75, sets: setRows([[35,12],[40,10],[40,10]]) },
  ]},
  { id: 3, name: "Руки и плечи", subtitle: "Плечи · Бицепс · Трицепс", exercises: [
    { id: 7, name: "Махи гантелей в стороны", muscle: "Плечи", restSeconds: 60, sets: setRows([[8,15],[8,15],[8,12]]) },
    { id: 8, name: "Сгибание рук со штангой", muscle: "Бицепс", restSeconds: 75, sets: setRows([[25,12],[30,10],[30,8]]) },
    { id: 9, name: "Разгибание рук на блоке", muscle: "Трицепс", restSeconds: 75, sets: setRows([[25,12],[30,10],[30,10]]) },
  ]},
];

const seedHistory: Session[] = [
  { id: 1, iso: "2026-07-22", date: "22 июл", title: "Верх тела", volume: 4280, duration: 54, exercises: [
    { name: "Жим штанги лёжа", muscle: "Грудь", sets: [{weight:60,reps:10},{weight:65,reps:8},{weight:65,reps:8}] },
    { name: "Тяга верхнего блока", muscle: "Спина", sets: [{weight:55,reps:12},{weight:60,reps:10},{weight:60,reps:10}] },
  ]},
  { id: 2, iso: "2026-07-19", date: "19 июл", title: "Ноги", volume: 6120, duration: 61, exercises: [
    { name: "Приседания со штангой", muscle: "Ноги", sets: [{weight:70,reps:10},{weight:80,reps:8},{weight:80,reps:8}] },
  ]},
  { id: 3, iso: "2026-07-16", date: "16 июл", title: "Верх тела", volume: 3860, duration: 49 },
];

const initialState: SavedState = { templates: defaultTemplates, activeTemplateId: 1, history: seedHistory, measurements: [] };

const Icon = ({ name }: { name: string }) => {
  const paths: Record<string, React.ReactNode> = {
    home: <><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v10h13V10"/><path d="M9.5 20v-6h5v6"/></>,
    dumbbell: <><path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/></>,
    chart: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></>,
    history: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/></>,
    plus: <path d="M12 5v14M5 12h14"/>, check: <path d="m5 12 4 4L19 7"/>,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
};

function openDb() {
  return new Promise<IDBDatabase | null>(resolve => {
    if (!("indexedDB" in window)) return resolve(null);
    const req = indexedDB.open("irontrack", 2);
    req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains("state")) req.result.createObjectStore("state"); };
    req.onerror = () => resolve(null); req.onsuccess = () => resolve(req.result);
  });
}

export default function Home() {
  const [tab, setTab] = useState<"home"|"workout"|"progress"|"history">("home");
  const [state, setState] = useState<SavedState>(initialState);
  const [exercises, setExercises] = useState<Exercise[]>(cloneExercises(defaultTemplates[0].exercises));
  const [started, setStarted] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [rest, setRest] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [settings, setSettings] = useState(false);
  const [programsOpen, setProgramsOpen] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [measurementOpen, setMeasurementOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState("Загружаю данные…");
  const [catalogSearch, setCatalogSearch] = useState("");
  const [muscleFilter, setMuscleFilter] = useState("Все");
  const [reportPeriod, setReportPeriod] = useState<"week"|"month">("month");
  const [measureForm, setMeasureForm] = useState({ weight:"", waist:"", chest:"", arm:"", photo:"" });

  const activeTemplate = state.templates.find(t => t.id === state.activeTemplateId) || state.templates[0];

  useEffect(() => {
    (async () => {
      let value: SavedState | null = null;
      const db = await openDb();
      if (db) value = await new Promise(resolve => {
        const req = db.transaction("state","readonly").objectStore("state").get("latest");
        req.onsuccess = () => resolve(req.result || null); req.onerror = () => resolve(null);
      });
      if (!value) {
        try {
          const raw = localStorage.getItem("irontrack-v4") || localStorage.getItem("irontrack-state");
          if (raw) {
            const old = JSON.parse(raw);
            value = old.templates ? old : { ...initialState, history: old.history || seedHistory };
          }
        } catch {}
      }
      if (value && !value.templates) {
        const legacy = value as unknown as { history?: Session[] };
        value = { ...initialState, history: legacy.history || seedHistory };
      }
      if (value) {
        const history = (value.history || seedHistory).map((session, index) => {
          const fallback = new Date();
          fallback.setDate(fallback.getDate() - index * 3);
          const iso = session.iso || fallback.toISOString().slice(0, 10);
          return { ...session, id: session.id || Date.now() + index, iso, date: session.date || formatDate(iso) };
        });
        value = {
          ...value,
          history,
          measurements: value.measurements || [],
          activeTemplateId: value.activeTemplateId || value.templates[0].id,
        };
      }
      const next = value || initialState;
      setState(next);
      const template = next.templates.find(t => t.id === next.activeTemplateId) || next.templates[0];
      setExercises(cloneExercises(template.exercises));
      if ("serviceWorker" in navigator) navigator.serviceWorker.register(`${basePath}/sw.js`).catch(() => {});
      if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
      setLoaded(true); setSaveStatus("Сохранено на устройстве");
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    setSaveStatus("Сохраняю…");
    const id = window.setTimeout(async () => {
      const db = await openDb();
      if (db) db.transaction("state","readwrite").objectStore("state").put(state, "latest");
      try {
        const light = { ...state, measurements: state.measurements.map(m => ({...m, photo: undefined})) };
        localStorage.setItem("irontrack-v4", JSON.stringify(light));
      } catch {}
      setSaveStatus("Сохранено на устройстве");
    }, 350);
    return () => clearTimeout(id);
  }, [state, loaded]);

  useEffect(() => {
    if (!started) return;
    const timer = window.setInterval(() => setSeconds(v => v + 1), 1000);
    return () => clearInterval(timer);
  }, [started]);

  useEffect(() => {
    if (rest <= 0) return;
    const timer = window.setInterval(() => setRest(v => {
      if (v === 1) {
        try {
          navigator.vibrate?.([200,100,200]);
          const AudioCtx = window.AudioContext || (window as typeof window & {webkitAudioContext: typeof AudioContext}).webkitAudioContext;
          const ctx = new AudioCtx(); const osc = ctx.createOscillator(); const gain = ctx.createGain();
          osc.connect(gain); gain.connect(ctx.destination); osc.frequency.value = 740; gain.gain.value = .08; osc.start(); osc.stop(ctx.currentTime + .25);
        } catch {}
      }
      return Math.max(0, v - 1);
    }), 1000);
    return () => clearInterval(timer);
  }, [rest]);

  const allSets = exercises.flatMap(e => e.sets);
  const doneSets = allSets.filter(s => s.done).length;
  const liveVolume = allSets.filter(s => s.done).reduce((n,s) => n + s.weight*s.reps, 0);
  const fmt = (v:number) => `${String(Math.floor(v/60)).padStart(2,"0")}:${String(v%60).padStart(2,"0")}`;
  const monthVolume = state.history.reduce((s,h) => s+h.volume,0);
  const chart = useMemo(() => [...state.history].slice(0,6).reverse().map(s => s.volume), [state.history]);
  const previousByName = (name:string) => state.history.find(h => h.exercises?.some(e => e.name === name))?.exercises?.find(e => e.name === name);

  const records = useMemo(() => {
    const map = new Map<string,{weight:number; oneRm:number}>();
    state.history.flatMap(h => h.exercises || []).forEach(e => e.sets.forEach(s => {
      const oneRm = Math.round(s.weight * (1 + s.reps/30) * 10)/10;
      const prev = map.get(e.name);
      if (!prev || oneRm > prev.oneRm) map.set(e.name,{weight:s.weight,oneRm});
    }));
    return [...map.entries()].sort((a,b) => b[1].oneRm-a[1].oneRm).slice(0,6);
  }, [state.history]);

  const reportSessions = useMemo(() => {
    const days = reportPeriod === "week" ? 7 : 31;
    const threshold = new Date(); threshold.setDate(threshold.getDate()-days);
    return state.history.filter(h => new Date(`${h.iso}T12:00:00`) >= threshold);
  }, [state.history, reportPeriod]);

  function chooseTemplate(id:number) {
    const template = state.templates.find(t => t.id===id); if (!template) return;
    setState(s => ({...s,activeTemplateId:id})); setExercises(cloneExercises(template.exercises)); setProgramsOpen(false);
  }
  function createProgram() {
    const name = prompt("Название тренировочного дня"); if (!name?.trim()) return;
    const template:Template = {id:Date.now(),name:name.trim(),subtitle:"Своя программа",exercises:[]};
    setState(s => ({...s,templates:[...s.templates,template],activeTemplateId:template.id}));
    setExercises([]); setProgramsOpen(false);
  }
  function deleteProgram(id:number) {
    if (state.templates.length<=1 || !confirm("Удалить эту программу?")) return;
    const templates=state.templates.filter(t=>t.id!==id); setState(s=>({...s,templates,activeTemplateId:templates[0].id}));
    setExercises(cloneExercises(templates[0].exercises));
  }
  function updateSet(exerciseId:number,setId:number,key:"weight"|"reps",value:number) {
    setExercises(items=>items.map(e=>e.id===exerciseId?{...e,sets:e.sets.map(s=>s.id===setId?{...s,[key]:value}:s)}:e));
  }
  function syncTemplate(next:Exercise[]) {
    setExercises(next); setState(s=>({...s,templates:s.templates.map(t=>t.id===s.activeTemplateId?{...t,exercises:next.map(e=>({...e,sets:e.sets.map(x=>({...x,done:false}))}))}:t)}));
  }
  function toggleSet(exerciseId:number,setId:number) {
    const ex=exercises.find(e=>e.id===exerciseId);
    setExercises(items=>items.map(e=>e.id===exerciseId?{...e,sets:e.sets.map(s=>s.id===setId?{...s,done:!s.done}:s)}:e));
    setRest(ex?.restSeconds || 90);
  }
  function addCatalogExercise(name:string,muscle:string) {
    const next=[...exercises,{id:Date.now(),name,muscle,restSeconds:90,sets:setRows([[20,10],[20,10],[20,10]])}];
    syncTemplate(next); setCatalogOpen(false); setCatalogSearch("");
  }
  function customExercise() {
    const name=prompt("Название упражнения"); if(!name?.trim())return;
    const muscle=prompt("Группа мышц","Другое")||"Другое"; addCatalogExercise(name.trim(),muscle);
  }
  function finishWorkout() {
    if(!doneSets)return;
    const completed:CompletedExercise[]=exercises.map(e=>({name:e.name,muscle:e.muscle,sets:e.sets.filter(s=>s.done).map(s=>({weight:s.weight,reps:s.reps}))})).filter(e=>e.sets.length);
    const session:Session={id:Date.now(),iso:todayIso(),date:formatDate(todayIso()),title:activeTemplate.name,volume:liveVolume,duration:Math.max(1,Math.round(seconds/60)),exercises:completed};
    setState(s=>({...s,history:[session,...s.history]})); setExercises(cloneExercises(activeTemplate.exercises));
    setStarted(false);setSeconds(0);setRest(0);setTab("home");
  }
  function addMeasurement() {
    const item:Measurement={id:Date.now(),iso:todayIso(),weight:Number(measureForm.weight)||0,waist:Number(measureForm.waist)||0,chest:Number(measureForm.chest)||0,arm:Number(measureForm.arm)||0,photo:measureForm.photo||undefined};
    setState(s=>({...s,measurements:[item,...s.measurements]}));setMeasureForm({weight:"",waist:"",chest:"",arm:"",photo:""});setMeasurementOpen(false);
  }
  function loadPhoto(file?:File) {
    if(!file)return; const reader=new FileReader();
    reader.onload=()=>{const img=new Image();img.onload=()=>{const scale=Math.min(1,900/img.width);const canvas=document.createElement("canvas");canvas.width=img.width*scale;canvas.height=img.height*scale;canvas.getContext("2d")?.drawImage(img,0,0,canvas.width,canvas.height);setMeasureForm(f=>({...f,photo:canvas.toDataURL("image/jpeg",.72)}));};img.src=String(reader.result);};reader.readAsDataURL(file);
  }
  function exportCsv() {
    const rows=[["Дата","Тренировка","Минуты","Объём, кг"],...reportSessions.map(s=>[s.iso,s.title,String(s.duration),String(s.volume)])];
    const blob=new Blob(["\ufeff"+rows.map(r=>r.map(x=>`"${x.replaceAll('"','""')}"`).join(";")).join("\n")],{type:"text/csv;charset=utf-8"});
    const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`irontrack-${reportPeriod}.csv`;a.click();URL.revokeObjectURL(url);
  }
  function exportBackup() {
    const blob=new Blob([JSON.stringify({...state,version:4,exportedAt:new Date().toISOString()},null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`irontrack-backup-${todayIso()}.json`;a.click();URL.revokeObjectURL(url);
  }
  function importBackup(file?:File) {
    if(!file)return;const reader=new FileReader();reader.onload=()=>{try{const v=JSON.parse(String(reader.result));if(!v.templates||!v.history)throw Error();const template=v.templates.find((t:Template)=>t.id===v.activeTemplateId)||v.templates[0];setState(v);setExercises(cloneExercises(template.exercises));setSettings(false);}catch{alert("Не удалось прочитать копию IronTrack.");}};reader.readAsText(file);
  }

  const muscles=["Все",...Array.from(new Set(catalog.map(x=>x[1])))];
  const filteredCatalog=catalog.filter(([n,m])=>(muscleFilter==="Все"||m===muscleFilter)&&n.toLowerCase().includes(catalogSearch.toLowerCase()));
  const calendarDays=useMemo(()=>{const now=new Date();const y=now.getFullYear(),m=now.getMonth();const first=(new Date(y,m,1).getDay()+6)%7;const count=new Date(y,m+1,0).getDate();return [...Array(first).fill(null),...Array.from({length:count},(_,i)=>i+1)];},[]);
  const trainedDays=new Set(state.history.filter(h=>h.iso.slice(0,7)===todayIso().slice(0,7)).map(h=>Number(h.iso.slice(8,10))));

  return <main className="shell">
    <header><button className="brand" onClick={()=>setTab("home")} aria-label="На главную"><span>IR</span> IronTrack</button><button className="avatar" onClick={()=>setSettings(true)} aria-label="Настройки и данные">А</button></header>

    {settings&&<div className="modal-backdrop" onClick={()=>setSettings(false)}><section className="settings-modal" role="dialog" aria-modal="true" aria-label="Настройки и данные" onClick={e=>e.stopPropagation()}>
      <button className="modal-close" onClick={()=>setSettings(false)} aria-label="Закрыть">×</button><div className="eyebrow">ДАННЫЕ И ПРИЛОЖЕНИЕ</div><h2>Всё под контролем.</h2>
      <div className="save-state cloud"><i/><div><strong>{saveStatus}</strong><span>Локальная база и офлайн-режим активны</span></div></div>
      <button className="data-button" onClick={exportBackup}><span>↓</span><div><strong>Скачать копию</strong><small>Программы, история, замеры и фото</small></div></button>
      <label className="data-button"><span>↑</span><div><strong>Восстановить данные</strong><small>Загрузить резервную копию</small></div><input type="file" accept=".json" onChange={e=>importBackup(e.target.files?.[0])}/></label>
      <p className="privacy-note">Данные хранятся на этом устройстве. Не очищайте данные сайта без резервной копии.</p>
    </section></div>}

    {programsOpen&&<div className="modal-backdrop" onClick={()=>setProgramsOpen(false)}><section className="settings-modal tall-modal" role="dialog" aria-modal="true" aria-label="Мои программы" onClick={e=>e.stopPropagation()}>
      <button className="modal-close" onClick={()=>setProgramsOpen(false)} aria-label="Закрыть">×</button><div className="eyebrow">ПРОГРАММА</div><h2>Тренировочные дни</h2>
      <div className="program-list">{state.templates.map(t=><div className={t.id===state.activeTemplateId?"selected":""} key={t.id}><button onClick={()=>chooseTemplate(t.id)}><strong>{t.name}</strong><small>{t.exercises.length} упражнений · {t.subtitle}</small></button><button className="trash" onClick={()=>deleteProgram(t.id)}>×</button></div>)}</div>
      <button className="primary light-primary" onClick={createProgram}>+ Создать программу</button>
    </section></div>}

    {catalogOpen&&<div className="modal-backdrop" onClick={()=>setCatalogOpen(false)}><section className="settings-modal tall-modal" role="dialog" aria-modal="true" aria-label="Каталог упражнений" onClick={e=>e.stopPropagation()}>
      <button className="modal-close" onClick={()=>setCatalogOpen(false)} aria-label="Закрыть">×</button><div className="eyebrow">КАТАЛОГ</div><h2>Добавить упражнение</h2>
      <input className="search-input" placeholder="Поиск упражнения" value={catalogSearch} onChange={e=>setCatalogSearch(e.target.value)}/>
      <div className="filter-row">{muscles.map(m=><button className={m===muscleFilter?"active":""} key={m} onClick={()=>setMuscleFilter(m)}>{m}</button>)}</div>
      <div className="catalog-list">{filteredCatalog.map(([n,m])=><button key={n} onClick={()=>addCatalogExercise(n,m)}><span><strong>{n}</strong><small>{m}</small></span><b>+</b></button>)}</div>
      <button className="add-set custom-button" onClick={customExercise}>+ Создать своё упражнение</button>
    </section></div>}

    {measurementOpen&&<div className="modal-backdrop" onClick={()=>setMeasurementOpen(false)}><section className="settings-modal" role="dialog" aria-modal="true" aria-label="Новый замер" onClick={e=>e.stopPropagation()}>
      <button className="modal-close" onClick={()=>setMeasurementOpen(false)} aria-label="Закрыть">×</button><div className="eyebrow">ПРОГРЕСС ТЕЛА</div><h2>Новый замер</h2>
      <div className="measure-grid">{[["weight","Вес, кг"],["waist","Талия, см"],["chest","Грудь, см"],["arm","Рука, см"]].map(([k,l])=><label key={k}><span>{l}</span><input type="number" value={measureForm[k as keyof typeof measureForm]} onChange={e=>setMeasureForm(f=>({...f,[k]:e.target.value}))}/></label>)}</div>
      <label className="photo-picker">{measureForm.photo?<img src={measureForm.photo} alt="Фото прогресса"/>:<span>＋ Добавить фото прогресса</span>}<input type="file" accept="image/*" onChange={e=>loadPhoto(e.target.files?.[0])}/></label>
      <button className="finish" onClick={addMeasurement}>Сохранить замер</button>
    </section></div>}

    {tab==="home"&&<section className="screen home-screen">
      <div className="eyebrow">СЕГОДНЯ · {formatDate(todayIso()).toUpperCase()}</div><h1>Пора стать<br/><em>сильнее.</em></h1><p className="lead">Выберите программу и продолжайте прогресс.</p>
      <div className="program-picker"><button onClick={()=>setProgramsOpen(true)}><span><small>ТЕКУЩАЯ ПРОГРАММА</small><strong>{activeTemplate.name}</strong></span><b>Изменить</b></button></div>
      <article className="workout-card"><div className="card-top"><span className="tag">СЕГОДНЯ</span><span className="duration">≈ {Math.max(35,activeTemplate.exercises.length*15)} мин</span></div><h2>{activeTemplate.name}</h2><p>{activeTemplate.subtitle}</p>
        <div className="exercise-preview">{activeTemplate.exercises.slice(0,4).map((e,i)=><div key={e.id}><b>{String(i+1).padStart(2,"0")}</b><span>{e.name}<small>{e.sets.length} подхода</small></span></div>)}</div>
        <button className="primary" disabled={!activeTemplate.exercises.length} onClick={()=>{setExercises(cloneExercises(activeTemplate.exercises));setStarted(true);setTab("workout")}}>Начать тренировку <span>→</span></button>
      </article>
      <div className="section-title"><h3>Этот месяц</h3><button onClick={()=>setTab("progress")}>Подробнее</button></div><div className="stats"><div><strong>{state.history.length}</strong><span>тренировки</span></div><div><strong>{(monthVolume/1000).toFixed(1)}<small>т</small></strong><span>объём</span></div><div><strong>{records.length}</strong><span>рекорды</span></div></div>
    </section>}

    {tab==="workout"&&<section className="screen"><div className="workout-head"><div><div className="eyebrow">ТРЕНИРОВКА В ПРОЦЕССЕ</div><h1>{activeTemplate.name}</h1></div><div className="timer">{fmt(seconds)}<small>{doneSets} / {allSets.length} подходов</small></div></div>
      <div className="progress-line"><span style={{width:`${allSets.length?(doneSets/allSets.length)*100:0}%`}}/></div>
      {rest>0&&<div className="rest"><span>Отдых</span><strong>{fmt(rest)}</strong><button onClick={()=>setRest(0)}>Пропустить</button></div>}
      <div className="exercise-list">{exercises.map(ex=><article className="exercise" key={ex.id}><div className="exercise-title"><div><span>{ex.muscle}</span><h2>{ex.name}</h2></div><select aria-label={`Отдых ${ex.name}`} value={ex.restSeconds} onChange={e=>setExercises(items=>items.map(x=>x.id===ex.id?{...x,restSeconds:Number(e.target.value)}:x))}><option value="60">60 с</option><option value="90">90 с</option><option value="120">2 мин</option><option value="180">3 мин</option></select></div>
        {previousByName(ex.name)&&<div className="previous">Прошлый раз: {previousByName(ex.name)?.sets.map(s=>`${s.weight}×${s.reps}`).join(" · ")}</div>}
        <div className="set-head"><span>ПОДХОД</span><span>КГ</span><span>ПОВТ.</span><span/></div>
        {ex.sets.map((s,i)=><div className={`set-row ${s.done?"complete":""}`} key={s.id}><b>{i+1}</b><input aria-label={`Вес ${ex.name} ${i+1}`} type="number" value={s.weight} onChange={e=>updateSet(ex.id,s.id,"weight",Number(e.target.value))}/><input aria-label={`Повторения ${ex.name} ${i+1}`} type="number" value={s.reps} onChange={e=>updateSet(ex.id,s.id,"reps",Number(e.target.value))}/><button aria-label={`Завершить ${ex.name} ${i+1}`} className="check" onClick={()=>toggleSet(ex.id,s.id)}><Icon name="check"/></button></div>)}
        <button className="add-set" onClick={()=>setExercises(items=>items.map(x=>x.id===ex.id?{...x,sets:[...x.sets,{...x.sets[x.sets.length-1],id:Date.now(),done:false}]}:x))}>+ Добавить подход</button>
      </article>)}</div>
      <button className="add-exercise" onClick={()=>setCatalogOpen(true)}><Icon name="plus"/> Каталог упражнений</button><button className="finish" disabled={!doneSets} onClick={finishWorkout}>Завершить тренировку</button>
    </section>}

    {tab==="progress"&&<section className="screen"><div className="eyebrow">АНАЛИТИКА</div><h1>Твой <em>прогресс.</em></h1>
      <div className="big-stat"><span>Общий объём</span><strong>{(monthVolume/1000).toFixed(1)} т</strong><small>{state.history.length} тренировок записано</small></div>
      <article className="chart-card"><div className="section-title"><h3>Объём тренировок</h3><span>последние {chart.length}</span></div><div className="bars">{chart.map((v,i)=><div key={i}><span style={{height:`${Math.max(15,(v/Math.max(...chart,1))*100)}%`}}/><small>Т{i+1}</small></div>)}</div></article>
      <div className="records"><div className="section-title"><h3>Личные рекорды</h3><span>расчётный 1ПМ</span></div>{records.length?records.map(([n,r])=><div key={n}><span>{n}<small>Лучший вес {r.weight} кг</small></span><strong>{r.oneRm} кг</strong></div>):<p className="empty">Завершите тренировку, чтобы увидеть рекорды.</p>}</div>
      <div className="section-title"><h3>Замеры тела</h3><button onClick={()=>setMeasurementOpen(true)}>+ Добавить</button></div>
      <div className="measurements">{state.measurements.length?state.measurements.slice(0,6).map(m=><article key={m.id}>{m.photo&&<img src={m.photo} alt={`Прогресс ${m.iso}`}/>}<div><strong>{m.weight||"—"} кг</strong><span>{formatDate(m.iso)}</span><small>Талия {m.waist||"—"} · Грудь {m.chest||"—"} · Рука {m.arm||"—"}</small></div></article>):<button className="empty-card" onClick={()=>setMeasurementOpen(true)}>Добавьте первый замер и фото прогресса</button>}</div>
    </section>}

    {tab==="history"&&<section className="screen report-page"><div className="eyebrow">ЖУРНАЛ</div><h1>История<br/><em>тренировок.</em></h1>
      <article className="calendar"><div className="section-title"><h3>{new Intl.DateTimeFormat("ru",{month:"long",year:"numeric"}).format(new Date())}</h3><span>{trainedDays.size} дней</span></div><div className="weekdays">{["Пн","Вт","Ср","Чт","Пт","Сб","Вс"].map(x=><b key={x}>{x}</b>)}</div><div className="calendar-grid">{calendarDays.map((d,i)=><span key={i} className={d&&trainedDays.has(d)?"trained":""}>{d||""}</span>)}</div></article>
      <div className="report-actions"><select aria-label="Период отчёта" value={reportPeriod} onChange={e=>setReportPeriod(e.target.value as "week"|"month")}><option value="week">7 дней</option><option value="month">30 дней</option></select><button onClick={exportCsv}>CSV</button><button onClick={()=>window.print()}>PDF / печать</button></div>
      <div className="print-summary"><h2>Отчёт IronTrack</h2><p>{reportPeriod==="week"?"Последние 7 дней":"Последние 30 дней"} · {reportSessions.length} тренировок · {(reportSessions.reduce((s,x)=>s+x.volume,0)/1000).toFixed(1)} т</p></div>
      <div className="history-list">{state.history.map(s=><article key={s.id}><div className="date-box"><b>{s.date.split(" ")[0]}</b><span>{s.date.split(" ")[1]}</span></div><div><h3>{s.title}</h3><p>{s.duration} мин · {(s.volume/1000).toFixed(1)} т объёма</p>{s.exercises&&<small>{s.exercises.map(e=>e.name).join(" · ")}</small>}</div><span>→</span></article>)}</div>
    </section>}

    <nav>{([["home","home","Главная"],["workout","dumbbell","Тренировка"],["progress","chart","Прогресс"],["history","history","История"]] as const).map(([id,icon,label])=><button key={id} className={tab===id?"active":""} onClick={()=>setTab(id)}><Icon name={icon}/><span>{label}</span></button>)}</nav>
  </main>;
}
