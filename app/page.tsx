"use client";

import { useEffect, useMemo, useState } from "react";

type SetRow = { id: number; weight: number; reps: number; done: boolean };
type Exercise = { id: number; name: string; muscle: string; sets: SetRow[] };
type Session = { date: string; title: string; volume: number; duration: number };

const starter: Exercise[] = [
  { id: 1, name: "Жим штанги лёжа", muscle: "Грудь", sets: [
    { id: 1, weight: 60, reps: 10, done: false }, { id: 2, weight: 65, reps: 8, done: false }, { id: 3, weight: 65, reps: 8, done: false },
  ]},
  { id: 2, name: "Тяга верхнего блока", muscle: "Спина", sets: [
    { id: 1, weight: 55, reps: 12, done: false }, { id: 2, weight: 60, reps: 10, done: false }, { id: 3, weight: 60, reps: 10, done: false },
  ]},
  { id: 3, name: "Жим гантелей сидя", muscle: "Плечи", sets: [
    { id: 1, weight: 18, reps: 10, done: false }, { id: 2, weight: 18, reps: 10, done: false }, { id: 3, weight: 18, reps: 8, done: false },
  ]},
];

const seedHistory: Session[] = [
  { date: "22 июл", title: "Верх тела", volume: 4280, duration: 54 },
  { date: "19 июл", title: "Ноги", volume: 6120, duration: 61 },
  { date: "16 июл", title: "Верх тела", volume: 3860, duration: 49 },
];

const Icon = ({ name }: { name: string }) => {
  const paths: Record<string, React.ReactNode> = {
    home: <><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v10h13V10"/><path d="M9.5 20v-6h5v6"/></>,
    dumbbell: <><path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/></>,
    chart: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></>,
    history: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/></>,
    plus: <path d="M12 5v14M5 12h14"/>,
    check: <path d="m5 12 4 4L19 7"/>,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
};

export default function Home() {
  const [tab, setTab] = useState<"home" | "workout" | "progress" | "history">("home");
  const [exercises, setExercises] = useState<Exercise[]>(starter);
  const [history, setHistory] = useState<Session[]>(seedHistory);
  const [started, setStarted] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [rest, setRest] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [settings, setSettings] = useState(false);
  const [saveStatus, setSaveStatus] = useState("Подключаю облако…");
  const [cloudOnline, setCloudOnline] = useState(false);

  async function readIndexedBackup() {
    return new Promise<{ exercises: Exercise[]; history: Session[] } | null>((resolve) => {
      if (!("indexedDB" in window)) return resolve(null);
      const request = indexedDB.open("irontrack", 1);
      request.onupgradeneeded = () => request.result.createObjectStore("state");
      request.onerror = () => resolve(null);
      request.onsuccess = () => {
        const tx = request.result.transaction("state", "readonly");
        const get = tx.objectStore("state").get("latest");
        get.onsuccess = () => resolve(get.result || null);
        get.onerror = () => resolve(null);
      };
    });
  }

  async function writeIndexedBackup(value: { exercises: Exercise[]; history: Session[] }) {
    if (!("indexedDB" in window)) return;
    const request = indexedDB.open("irontrack", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("state");
    request.onsuccess = () => {
      const tx = request.result.transaction("state", "readwrite");
      tx.objectStore("state").put(value, "latest");
    };
  }

  useEffect(() => {
    (async () => {
      const saved = localStorage.getItem("irontrack-state");
      let value = null;
      if (saved) {
        try { value = JSON.parse(saved); } catch {}
      }
      if (!value) value = await readIndexedBackup();
      try {
        const response = await fetch("/api/state", { cache: "no-store" });
        if (response.ok) {
          const cloud = await response.json();
          if (cloud.state?.exercises && cloud.state?.history) value = cloud.state;
          setCloudOnline(true);
          setSaveStatus(cloud.state ? "Синхронизировано с облаком" : "Облако подключено");
        }
      } catch {
        setSaveStatus("Офлайн — данные на устройстве");
      }
      if (value) {
        setExercises(value.exercises || starter);
        setHistory(value.history || seedHistory);
      }
      if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
      if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (loaded) {
      const value = { exercises, history };
      setSaveStatus("Сохраняю…");
      localStorage.setItem("irontrack-state", JSON.stringify(value));
      writeIndexedBackup(value);
      const id = window.setTimeout(async () => {
        try {
          const response = await fetch("/api/state", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(value),
          });
          if (!response.ok) throw new Error();
          setCloudOnline(true);
          setSaveStatus("Синхронизировано с облаком");
        } catch {
          setCloudOnline(false);
          setSaveStatus("Офлайн — сохранено на устройстве");
        }
      }, 700);
      return () => window.clearTimeout(id);
    }
  }, [exercises, history, loaded]);

  useEffect(() => {
    if (!started) return;
    const timer = window.setInterval(() => setSeconds(v => v + 1), 1000);
    return () => window.clearInterval(timer);
  }, [started]);

  useEffect(() => {
    if (rest <= 0) return;
    const timer = window.setInterval(() => setRest(v => Math.max(0, v - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [rest]);

  const doneSets = exercises.flatMap(e => e.sets).filter(s => s.done).length;
  const allSets = exercises.flatMap(e => e.sets).length;
  const liveVolume = exercises.flatMap(e => e.sets).filter(s => s.done).reduce((n, s) => n + s.weight * s.reps, 0);
  const fmt = (value: number) => `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
  const weekVolume = history.reduce((sum, s) => sum + s.volume, 0);
  const chart = useMemo(() => [...history].reverse().map(s => s.volume), [history]);

  function updateSet(exerciseId: number, setId: number, key: "weight" | "reps", value: number) {
    setExercises(items => items.map(e => e.id === exerciseId ? { ...e, sets: e.sets.map(s => s.id === setId ? { ...s, [key]: value } : s) } : e));
  }

  function toggleSet(exerciseId: number, setId: number) {
    setExercises(items => items.map(e => e.id === exerciseId ? { ...e, sets: e.sets.map(s => s.id === setId ? { ...s, done: !s.done } : s) } : e));
    setRest(90);
  }

  function addExercise() {
    const name = window.prompt("Название упражнения");
    if (!name?.trim()) return;
    setExercises(items => [...items, { id: Date.now(), name: name.trim(), muscle: "Другое", sets: [{ id: 1, weight: 20, reps: 10, done: false }] }]);
  }

  function finishWorkout() {
    if (!doneSets) return;
    const today = new Intl.DateTimeFormat("ru", { day: "numeric", month: "short" }).format(new Date()).replace(".", "");
    setHistory(items => [{ date: today, title: "Верх тела", volume: liveVolume, duration: Math.max(1, Math.round(seconds / 60)) }, ...items]);
    setExercises(items => items.map(e => ({ ...e, sets: e.sets.map(s => ({ ...s, done: false })) })));
    setStarted(false); setSeconds(0); setRest(0); setTab("home");
  }

  function exportData() {
    const blob = new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), exercises, history }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `irontrack-backup-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function importData(file?: File) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const value = JSON.parse(String(reader.result));
        if (!Array.isArray(value.exercises) || !Array.isArray(value.history)) throw new Error();
        setExercises(value.exercises);
        setHistory(value.history);
        setSaveStatus("Резервная копия восстановлена");
        setSettings(false);
      } catch {
        window.alert("Не удалось прочитать резервную копию IronTrack.");
      }
    };
    reader.readAsText(file);
  }

  return (
    <main className="shell">
      <header>
        <button className="brand" onClick={() => setTab("home")} aria-label="На главную"><span>IR</span> IronTrack</button>
        <button className="avatar" onClick={() => setSettings(true)} aria-label="Настройки и данные">А</button>
      </header>

      {settings && <div className="modal-backdrop" role="presentation" onClick={() => setSettings(false)}>
        <section className="settings-modal" role="dialog" aria-modal="true" aria-label="Настройки и данные" onClick={e => e.stopPropagation()}>
          <button className="modal-close" onClick={() => setSettings(false)} aria-label="Закрыть">×</button>
          <div className="eyebrow">ДАННЫЕ И ПРИЛОЖЕНИЕ</div>
          <h2>Всё под контролем.</h2>
          <div className={`save-state ${cloudOnline ? "cloud" : "offline"}`}><i/><div><strong>{saveStatus}</strong><span>{cloudOnline ? "Серверная и локальная копии защищены" : "Синхронизируется при подключении"}</span></div></div>
          <button className="data-button" onClick={exportData}><span>↓</span><div><strong>Скачать копию</strong><small>Все тренировки в одном файле</small></div></button>
          <label className="data-button"><span>↑</span><div><strong>Восстановить данные</strong><small>Загрузить ранее сохранённую копию</small></div><input type="file" accept="application/json,.json" onChange={e => importData(e.target.files?.[0])}/></label>
          <p className="privacy-note">Данные сохраняются в защищённом облаке сайта и дублируются на устройстве для работы без интернета.</p>
        </section>
      </div>}

      {tab === "home" && <section className="screen home-screen">
        <div className="eyebrow">СРЕДА · 29 ИЮЛЯ</div>
        <h1>Пора стать<br/><em>сильнее.</em></h1>
        <p className="lead">Сегодня — верх тела. Продолжим прогресс?</p>

        <article className="workout-card">
          <div className="card-top"><span className="tag">СЕГОДНЯ</span><span className="duration">≈ 55 мин</span></div>
          <h2>Верх тела</h2>
          <p>Грудь · Спина · Плечи</p>
          <div className="exercise-preview">
            {exercises.slice(0, 3).map((e, i) => <div key={e.id}><b>{String(i + 1).padStart(2, "0")}</b><span>{e.name}<small>{e.sets.length} подхода</small></span></div>)}
          </div>
          <button className="primary" onClick={() => { setStarted(true); setTab("workout"); }}>Начать тренировку <span>→</span></button>
        </article>

        <div className="section-title"><h3>Эта неделя</h3><button onClick={() => setTab("progress")}>Подробнее</button></div>
        <div className="stats">
          <div><strong>{history.length}</strong><span>тренировки</span></div>
          <div><strong>{(weekVolume / 1000).toFixed(1)}<small>т</small></strong><span>объём</span></div>
          <div><strong>3</strong><span>дня подряд</span></div>
        </div>
      </section>}

      {tab === "workout" && <section className="screen">
        <div className="workout-head">
          <div><div className="eyebrow">ТРЕНИРОВКА В ПРОЦЕССЕ</div><h1>Верх тела</h1></div>
          <div className="timer">{fmt(seconds)}<small>{doneSets} / {allSets} подходов</small></div>
        </div>
        <div className="progress-line"><span style={{ width: `${(doneSets / allSets) * 100}%` }}/></div>
        {rest > 0 && <div className="rest"><span>Отдых</span><strong>{fmt(rest)}</strong><button onClick={() => setRest(0)}>Пропустить</button></div>}

        <div className="exercise-list">
          {exercises.map(exercise => <article className="exercise" key={exercise.id}>
            <div className="exercise-title"><div><span>{exercise.muscle}</span><h2>{exercise.name}</h2></div><button onClick={() => setExercises(x => x.filter(e => e.id !== exercise.id))}>•••</button></div>
            <div className="set-head"><span>ПОДХОД</span><span>КГ</span><span>ПОВТ.</span><span/></div>
            {exercise.sets.map((set, i) => <div className={`set-row ${set.done ? "complete" : ""}`} key={set.id}>
              <b>{i + 1}</b>
              <input aria-label="Вес" type="number" value={set.weight} onChange={e => updateSet(exercise.id, set.id, "weight", Number(e.target.value))}/>
              <input aria-label="Повторения" type="number" value={set.reps} onChange={e => updateSet(exercise.id, set.id, "reps", Number(e.target.value))}/>
              <button aria-label="Завершить подход" className="check" onClick={() => toggleSet(exercise.id, set.id)}><Icon name="check"/></button>
            </div>)}
            <button className="add-set" onClick={() => setExercises(items => items.map(e => e.id === exercise.id ? { ...e, sets: [...e.sets, { ...e.sets[e.sets.length - 1], id: Date.now(), done: false }] } : e))}>+ Добавить подход</button>
          </article>)}
        </div>
        <button className="add-exercise" onClick={addExercise}><Icon name="plus"/> Добавить упражнение</button>
        <button className="finish" disabled={!doneSets} onClick={finishWorkout}>Завершить тренировку</button>
      </section>}

      {tab === "progress" && <section className="screen">
        <div className="eyebrow">АНАЛИТИКА</div><h1>Твой <em>прогресс.</em></h1>
        <div className="big-stat"><span>Общий объём</span><strong>{(weekVolume / 1000).toFixed(1)} т</strong><small>↑ 12% за последние 4 недели</small></div>
        <article className="chart-card">
          <div className="section-title"><h3>Объём тренировок</h3><span>4 недели</span></div>
          <div className="bars">{chart.map((v, i) => <div key={i}><span style={{ height: `${Math.max(22, (v / Math.max(...chart)) * 100)}%` }}/><small>Н{i + 1}</small></div>)}</div>
        </article>
        <div className="records"><h3>Личные рекорды</h3>
          <div><span>Жим штанги лёжа<small>1 повторение</small></span><strong>82.5 кг</strong></div>
          <div><span>Приседания<small>1 повторение</small></span><strong>105 кг</strong></div>
          <div><span>Становая тяга<small>1 повторение</small></span><strong>125 кг</strong></div>
        </div>
      </section>}

      {tab === "history" && <section className="screen">
        <div className="eyebrow">ЖУРНАЛ</div><h1>История<br/><em>тренировок.</em></h1>
        <div className="history-list">{history.map((s, i) => <article key={`${s.date}-${i}`}>
          <div className="date-box"><b>{s.date.split(" ")[0]}</b><span>{s.date.split(" ")[1]}</span></div>
          <div><h3>{s.title}</h3><p>{s.duration} мин · {(s.volume / 1000).toFixed(1)} т объёма</p></div><span>→</span>
        </article>)}</div>
      </section>}

      <nav>
        {([["home","home","Главная"],["workout","dumbbell","Тренировка"],["progress","chart","Прогресс"],["history","history","История"]] as const).map(([id, icon, label]) =>
          <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}><Icon name={icon}/><span>{label}</span></button>
        )}
      </nav>
    </main>
  );
}
