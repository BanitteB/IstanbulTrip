// Istanbul-Reise-Dashboard · Valä, Cha, Bettä
// Orte, Swipes und Packliste liegen in Supabase. Fotos: Wikimedia Commons.

// ---------- Grundlagen ----------
const SUPABASE_URL = "https://nwrrdbbnuseljmeqojey.supabase.co";
const SUPABASE_KEY = "sb_publishable_dvT7vJwoqNc62HFM64Y-9Q_5c-TUCpV";
const TRIP = "istanbul-2026";
const TRAVELERS = ["Valä", "Cha", "Bettä"];
const db = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

const store = {
  get(k, def) { try { return JSON.parse(localStorage.getItem(k)) ?? def } catch (e) { return def } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)) } catch (e) {} }
};
const $ = id => document.getElementById(id);
const esc = t => String(t ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const gmaps = n => "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(n.replace(/\s*\(.*?\)/g, "") + " Istanbul");
const route = ll => `https://www.google.com/maps/dir/?api=1&destination=${ll[0]},${ll[1]}&travelmode=transit`;

// ---------- Gegenden, Mahlzeiten, Tage ----------
const AREAS = {
  kad: { label: "Kadıköy & Moda", day: "kad" },
  alt: { label: "Altstadt (Sultanahmet, Eminönü)", day: "fr" },
  bey: { label: "Karaköy, Galata & Taksim", day: "sa" },
  bos: { label: "Beşiktaş & Ortaköy", day: "sa" },
  far: { label: "Weiter weg (Ausflug)", day: "x" }
};
const MEAL = { br: "Frühstück", lu: "Mittagessen", sn: "Kaffee & Dessert", di: "Abendessen", dr: "Drinks" };
const PART = { vm: "Vormittag", nm: "Nachmittag", ab: "Abend" };
const PARTPOS = { vm: 100, nm: 200, ab: 400 };
const ACT_MAX = { do: 1, fr: 6, sa: 6, so: 1 };
// [Uhrzeit-Label, passende Mahlzeiten, Gegenden, Position in der Zeitleiste]
const MEALSLOTS = {
  do: [["19:30", ["di"], ["kad"], 350], ["Danach", ["sn", "dr"], ["kad"], 450]],
  fr: [["Mittag", ["lu"], ["alt"], 150], ["Pause", ["sn"], ["alt"], 250], ["Abend", ["di", "dr"], ["kad"], 450]],
  sa: [["Frühstück", ["br"], ["kad"], 0], ["Mittag", ["lu"], ["bey", "bos"], 150], ["Pause", ["sn"], ["bey", "bos"], 250], ["Abend", ["dr", "di"], ["bey", "bos"], 450]],
  so: [["Frühstück", ["br"], ["kad"], 0]]
};
const DAYLABEL = { do: "📅 Do-Abend", fr: "📅 Freitag · Altstadt", sa: "📅 Samstag · Galata & Bosporus", so: "📅 So-Morgen · Moda", x: "✨ Ausflug, braucht Extra-Zeit" };
const actDay = s => { const d = AREAS[s.area]?.day || "x"; return d === "kad" ? (s.part === "ab" ? "do" : "so") : d };

const BASE = {
  hotel: { n: "Otel Kadıköy", ll: [40.9905, 29.0275], d: "Uzun Hafız Sk. 18 · 5 Min. zur Fähre" },
  saw: { n: "Flughafen Sabiha Gökçen (SAW)", ll: [40.8986, 29.3092], d: "M4 direkt bis Kadıköy, knapp 1 Std." }
};
const DAYS = [
  { key: "do", tab: "Do 19.", date: "2026-11-19", title: "Ankunft & Kadıköy", note: "✈️ ZRH → SAW 10:50–15:45 (PC948) · BJV → SAW 16:25–17:45 (PC2249). Check-in ab 14 Uhr.",
    start: [{ t: "15:45", p: "saw", info: "Zürich-Flug landet, mit der M4 bis Kadıköy", go: "Oder Hotel-Flughafentransfer" },
            { t: "ca. 17:00", p: "hotel", info: "Einchecken" },
            { t: "17:45", p: "saw", info: "Bodrum-Flug landet, ca. 19 Uhr im Hotel" }], end: [] },
  { key: "fr", tab: "Fr 20.", date: "2026-11-20", title: "Altstadt", note: "Geht auch bei Regen, fast alles drinnen. Moscheen freitags erst nach dem Mittagsgebet.", start: [], end: [] },
  { key: "sa", tab: "Sa 21.", date: "2026-11-21", title: "Galata, Taksim, Bosporus", note: "Am schönsten bei trockenem Wetter. Sonnenuntergang ca. 16:40.", start: [], end: [] },
  { key: "so", tab: "So 22.", date: "2026-11-22", title: "Abreise", note: "✈️ SAW → BJV 13:55 (PC2248) · SAW → Basel 15:00 (AJet VF105). Check-out bis 12 Uhr.",
    start: [], end: [{ t: "11:30", p: "hotel", info: "Check-out. Bodrum-Flug: spätestens jetzt los" },
                     { t: "12:00", p: "saw", info: "Basel-Flug: M4 direkt zum SAW, knapp 1 Std." }] }
];

// So kommt ihr hin – pro Gegend (ab Hotel in Kadıköy)
const ROUTES = {
  kad: ["🚶 Markt, Akmar & Cafés: 2–5 Min. zu Fuss", "🚋 Moda: 15 Min. zu Fuss oder Nostalgie-Tram T3"],
  alt: ["⛴️ Fähre Kadıköy → Eminönü (ca. 20 Min.), dann T1 bis Sultanahmet", "🚇 M4 bis Ayrılık Çeşmesi → Marmaray bis Sirkeci → T1 (Gülhane, Sultanahmet, Beyazıt für den Basar)"],
  bey: ["⛴️ Fähre Kadıköy → Karaköy, dann F2 Tünel hoch zur İstiklal", "🚇 M4 → Marmaray bis Yenikapı → M2 bis Şişhane (Galata, İstiklal) oder Taksim", "🚋 Von der Altstadt: T1 über die Galatabrücke bis Karaköy"],
  bos: ["⛴️ Fähre Kadıköy → Beşiktaş, dann Bus ca. 10 Min. nach Ortaköy", "🚇 M4 → Marmaray bis Üsküdar → Fähre nach Beşiktaş (10 Min.)"],
  far: ["🚇 Üsküdar, Kuzguncuk & Co.: M4 → Marmaray bis Üsküdar, dann Bus/Taxi", "🗺️ Für weitere Ausflüge: Route-Link beim Ort öffnen"]
};

// ---------- Orte laden ----------
let SPOTS = {};           // id -> {n,d,kind,area,meals,part,ll,img,tip,go,sort}
let PLACES = {};          // für Karte/Plan: Basis + Orte
let SPOTS_FROM_DB = false;
async function loadSpots() {
  let rows = null;
  if (db) { const { data, error } = await db.from("places").select("id,data,sort").eq("trip", TRIP).order("sort"); if (!error && data.length) { rows = data; SPOTS_FROM_DB = true } }
  if (!rows) { try { rows = await fetch("defaults.json?v=10").then(r => r.json()) } catch (e) { rows = [] } SPOTS_FROM_DB = false }
  SPOTS = {}; rows.forEach(r => SPOTS[r.id] = { ...r.data, sort: r.sort });
  PLACES = { ...BASE }; Object.entries(SPOTS).forEach(([id, s]) => PLACES[id] = s);
}
const FOODIDS = () => Object.keys(SPOTS).filter(id => SPOTS[id].kind === "food");
const ACTIDS = () => Object.keys(SPOTS).filter(id => SPOTS[id].kind === "act");
const SW_IDS = () => [...FOODIDS(), ...ACTIDS()];

// ---------- Karte ----------
const COLORS = { hotel: "#0f2a43", food: "#c8553d", act: "#1d5c7a", far: "#2a9d8f" };
const colorOf = id => BASE[id] ? COLORS.hotel : SPOTS[id]?.area === "far" ? COLORS.far : COLORS[SPOTS[id]?.kind] || COLORS.act;
const map = L.map("map", { scrollWheelZoom: false }).setView([41.012, 28.99], 12);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(map);
let markers = {}, routeLine = null;
function renderMarkers() {
  Object.values(markers).forEach(m => map.removeLayer(m)); markers = {};
  Object.entries(PLACES).forEach(([id, p]) => {
    if (!p.ll) return;
    markers[id] = L.circleMarker(p.ll, { radius: id === "hotel" ? 10 : 7, color: "#fff", weight: 2, fillColor: colorOf(id), fillOpacity: 1 }).addTo(map)
      .bindPopup(`<b>${esc(p.n)}</b><br><span style="color:#6b7380">${esc(p.d)}</span><br><a target="_blank" href="${route(p.ll)}">🚇 Route ↗</a> · <a target="_blank" href="${gmaps(p.n)}">📸 Fotos ↗</a>`);
  });
  $("legend").innerHTML = [["Hotel & Flughafen", COLORS.hotel], ["Essen & Drinks", COLORS.food], ["Aktivitäten", COLORS.act], ["Ausflüge", COLORS.far]].map(([l, c]) => `<span style="--c:${c}">${l}</span>`).join("");
}
function showDayOnMap(stops) {
  if (routeLine) map.removeLayer(routeLine);
  const pts = stops.filter(s => s.p !== "saw" && PLACES[s.p]?.ll).map(s => PLACES[s.p].ll);
  if (!pts.length) { map.setView([41.012, 28.99], 12); return }
  routeLine = L.polyline(pts, { color: "#c8553d", weight: 3, dashArray: "6 6" }).addTo(map);
  map.fitBounds(L.latLngBounds(pts).pad(.25));
}
function focusPlace(id) {
  const p = PLACES[id]; if (!p?.ll) return;
  map.setView(p.ll, 15); markers[id]?.openPopup();
  $("map").scrollIntoView({ behavior: "smooth", block: "center" });
}

// ---------- Countdown ----------
(() => {
  const start = new Date("2026-11-19T00:00:00+03:00"), end = new Date("2026-11-23T00:00:00+03:00"), now = new Date();
  if (now < start) { const d = Math.ceil((start - now) / 864e5); $("countdown").textContent = `Noch ${d} ${d === 1 ? "Tag" : "Tage"} ✈️` }
  else $("countdown").textContent = now < end ? "Ihr seid da! 🎉" : "Schön war's 💙";
})();

// ---------- Swipes & Plan ----------
let me = store.get("ist-me", ""); if (me && !TRAVELERS.includes(me)) me = "";
let myVotes = store.get("ist-myvotes", {});
let curCat = null, everyone = {}, planResult = null;
const doneIds = (v, ids) => v && ids.every(id => v[id] !== undefined);
const doneV = v => doneIds(v, SW_IDS());
const cnt = (v, ids) => ids.filter(id => v && v[id] !== undefined).length;

async function pull() {
  if (db) {
    const { data, error } = await db.from("swipes").select("name,votes").eq("trip", TRIP);
    if (!error) { everyone = {}; data.forEach(r => everyone[r.name] = r.votes || {}) }
  }
  // vom Admin zurückgesetzt? Dann lokale Swipes auch löschen
  if (db && me && store.get("ist-pushed", false) && !everyone[me] && Object.keys(myVotes).length) { myVotes = {}; store.set("ist-myvotes", {}); store.set("ist-pushed", false); curCat = null }
  if (me) everyone[me] = { ...(everyone[me] || {}), ...myVotes };
  computePlan();
}
let pushTimer = null;
function push() {
  store.set("ist-myvotes", myVotes);
  if (me) everyone[me] = { ...myVotes };
  if (!db || !me) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => db.from("swipes").upsert({ trip: TRIP, name: me, votes: myVotes, updated_at: new Date().toISOString() })
    .then(({ error }) => { if (!error) store.set("ist-pushed", true) }), 300);
}
function scoreRows() {
  const P = TRAVELERS.filter(n => doneV(everyone[n]));
  return { P, rows: SW_IDS().map(id => { const vs = P.map(n => everyone[n][id] ?? 0); return { id, vs, yes: vs.filter(v => v > 0).length, score: vs.reduce((a, b) => a + b, 0), star: vs.includes(2) } }).sort((a, b) => b.score - a.score || SPOTS[a.id].sort - SPOTS[b.id].sort) };
}
function computePlan() {
  const ids = SW_IDS();
  const allDone = ids.length && TRAVELERS.every(n => doneV(everyone[n]));
  if (!allDone) { if (planResult) { planResult = null; renderDay() } return }
  const { rows } = scoreRows(), need = Math.ceil(TRAVELERS.length * 2 / 3);
  const isChosen = r => r.yes >= need || r.star;
  const days = {}, extra = []; DAYS.forEach(d => days[d.key] = []);
  // 1) Aktivitäten nach Gegend auf die Tage
  const acts = rows.filter(r => SPOTS[r.id].kind === "act" && isChosen(r));
  DAYS.forEach(d => {
    const l = acts.filter(r => actDay(SPOTS[r.id]) === d.key);
    l.slice(ACT_MAX[d.key]).forEach(r => extra.push(r));
    l.slice(0, ACT_MAX[d.key]).forEach(r => days[d.key].push({ ...r, pos: (PARTPOS[SPOTS[r.id].part] || 200) + (SPOTS[r.id].sort || 0) / 1000, t: "" }));
  });
  acts.filter(r => actDay(SPOTS[r.id]) === "x").forEach(r => extra.push(r));
  // 2) Essen in passende Mahlzeiten in der Nähe
  const used = new Set(), foodRows = rows.filter(r => SPOTS[r.id].kind === "food");
  DAYS.forEach(d => (MEALSLOTS[d.key] || []).forEach(([t, meals, areas, pos]) => {
    const fits = r => !used.has(r.id) && areas.includes(SPOTS[r.id].area) && (SPOTS[r.id].meals || []).some(m => meals.includes(m));
    const pick = foodRows.find(r => isChosen(r) && fits(r)) || foodRows.find(r => r.yes > 0 && fits(r));
    if (pick) { used.add(pick.id); days[d.key].push({ ...pick, pos, t, meal: SPOTS[pick.id].meals.find(m => meals.includes(m)) }) }
  }));
  foodRows.filter(r => isChosen(r) && !used.has(r.id)).forEach(r => extra.push(r));
  // Zeit-Labels für Aktivitäten
  DAYS.forEach(d => {
    days[d.key].sort((a, b) => a.pos - b.pos);
    let last = ""; days[d.key].forEach(r => { if (!r.meal) { const p = SPOTS[r.id].part; if (p !== last) { r.t = PART[p] || ""; last = p } } });
  });
  const before = JSON.stringify(planResult);
  planResult = { days, extra };
  if (JSON.stringify(planResult) !== before) renderDay();
}

// ---------- Plan anzeigen ----------
let done = store.get("ist-done", {});
let curDay = (() => { const t = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Istanbul" }); const i = DAYS.findIndex(d => d.date === t); return i < 0 ? 1 : i })();
function dayStops(d) {
  const mid = planResult ? (planResult.days[d.key] || []).map(r => ({ t: r.t || "", p: r.id, info: (r.meal ? MEAL[r.meal] + " · " : "") + (SPOTS[r.id].d || "") + (r.star ? " ⭐" : ""), go: SPOTS[r.id].go })) : [];
  return [...d.start, ...mid, ...d.end];
}
function renderTabs() { $("tabs").innerHTML = DAYS.map((d, i) => `<button class="tab ${i === curDay ? "on" : ""}" data-i="${i}">${d.tab}</button>`).join("") }
function renderDay() {
  const d = DAYS[curDay], stops = dayStops(d);
  const locked = !planResult ? `<div class="wtip" style="margin:10px 0">🔒 Das Programm entsteht, sobald ${TRAVELERS.join(", ")} geswipt haben. <a href="#swipe-card">Zum Swipen ↓</a></div>` : "";
  const extra = planResult && curDay === DAYS.length - 1 && planResult.extra.length ? `<div class="wtip" style="margin-top:10px">✨ Wenn Zeit bleibt: ${planResult.extra.map(r => esc(SPOTS[r.id].n)).join(", ")}</div>` : "";
  $("daypanel").innerHTML = `<p class="daytitle">${d.title}</p><p class="daynote">${d.note}</p>` +
    stops.map(s => { const k = d.key + "-" + s.p + "-" + s.t, p = PLACES[s.p]; if (!p) return ""; return `<div class="stop ${done[k] ? "done" : ""}">
      <input type="checkbox" data-k="${esc(k)}" ${done[k] ? "checked" : ""} aria-label="erledigt">
      <div class="time">${esc(s.t)}</div>
      <div><div class="name" data-p="${esc(s.p)}">${esc(p.n)}</div><div class="info">${esc(s.info)}</div>
      ${s.go ? `<div class="go">🚋 ${esc(s.go)}</div>` : ""}${p.ll && s.p !== "saw" ? `<div class="go"><a href="${route(p.ll)}" target="_blank" rel="noopener">🚇 Route mit ÖV ↗</a></div>` : ""}</div></div>` }).join("") + locked + extra;
  showDayOnMap(stops);
}
$("tabs").onclick = e => { const b = e.target.closest(".tab"); if (!b) return; curDay = +b.dataset.i; renderTabs(); renderDay() };
$("daypanel").onclick = e => {
  const cb = e.target.closest("input"); if (cb) { done[cb.dataset.k] = cb.checked; store.set("ist-done", done); renderDay(); return }
  const n = e.target.closest(".name"); if (n) focusPlace(n.dataset.p);
};

// ---------- Swipen ----------
const swEl = $("swipe");
const SWCATS = () => ({ food: { label: "🍽️ Essen & Drinks", ids: FOODIDS() }, act: { label: "🎯 Aktivitäten", ids: ACTIDS() } });
function statusLine() {
  const ids = SW_IDS();
  return TRAVELERS.map(n => { const ok = doneV(everyone[n]); return `<span style="white-space:nowrap">${ok ? "✅" : "⏳"} ${esc(n)}${ok ? "" : ` ${cnt(everyone[n], ids)}/${ids.length}`}</span>` }).join(" &nbsp; ");
}
async function renderSwipe() {
  if (!me) return renderStart();
  if (curCat && !doneIds(myVotes, SWCATS()[curCat].ids)) return renderStack();
  if (!doneV(myVotes)) return renderCats();
  await pull(); renderResults();
}
async function renderStart() {
  await pull();
  swEl.innerHTML = `<div class="sw-center">
    <p>Swipe in zwei Runden: 🍽️ Essen & Drinks und 🎯 Aktivitäten.<br>❤️ will ich, ✕ eher nicht, ⭐ unbedingt.<br>Sobald alle drei fertig sind, erscheint oben euer Programm.</p>
    <p style="font-weight:600;margin:14px 0 8px">Wer swipt?</p>
    <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">${TRAVELERS.map(n => `<button class="btn" data-me="${esc(n)}" style="min-width:90px">${esc(n)}</button>`).join("")}</div>
    <p class="daynote" style="margin-top:14px">${statusLine()}</p></div>`;
  swEl.querySelectorAll("[data-me]").forEach(b => b.onclick = () => {
    me = b.dataset.me; store.set("ist-me", me); renderPack();
    myVotes = { ...(everyone[me] || {}) }; store.set("ist-myvotes", myVotes); curCat = null; renderSwipe();
  });
}
function renderCats() {
  swEl.innerHTML = `<div class="sw-center"><p class="sw-who">Hallo ${esc(me)}! Was swipst du?</p>
    <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-top:10px">${Object.entries(SWCATS()).map(([k, c]) => { const d = cnt(myVotes, c.ids), t = c.ids.length, ok = d === t;
      return `<button class="btn ${ok ? "ghost" : ""}" data-cat="${k}" style="min-width:200px;padding:16px 20px">${c.label}<br><span style="font-weight:500;font-size:.85rem">${ok ? "✅ fertig" : `${d}/${t}`}</span></button>` }).join("")}</div>
    <p class="daynote" style="margin-top:14px">${statusLine()}</p>
    <button class="btn ghost small" id="sw-who">Nicht ${esc(me)}?</button></div>`;
  swEl.querySelectorAll("[data-cat]").forEach(b => b.onclick = () => { curCat = b.dataset.cat; renderSwipe() });
  $("sw-who").onclick = switchUser;
}
function cardTag(s) { return s.kind === "food" ? `📍 ${AREAS[s.area]?.label || ""} · ${(s.meals || []).map(m => MEAL[m]).join(" / ")}` : DAYLABEL[actDay(s)] }
function renderStack() {
  const ids = SWCATS()[curCat].ids, todo = ids.filter(id => myVotes[id] === undefined);
  if (!todo.length) { curCat = null; return renderSwipe() }
  const pct = Math.round((ids.length - todo.length) / ids.length * 100);
  const card = (id, back) => { const s = SPOTS[id], im = s.img;
    const bg = im ? `background:linear-gradient(180deg,rgba(15,42,67,0) 30%,rgba(15,42,67,.92) 78%),url('${esc(im[0])}') center/cover,#0f2a43` : `background:linear-gradient(160deg,${s.kind === "food" ? "#c8553d" : "#1d5c7a"},#0f2a43)`;
    return `<div class="sw-card${back ? " back" : ""}" data-id="${esc(id)}" style="${bg}">
      ${im ? "" : `<div class="sw-emoji">${s.kind === "food" ? "🍽️" : "📍"}</div><a class="sw-gmaps big" href="${gmaps(s.n)}" target="_blank" rel="noopener">📸 Fotos auf Google Maps ansehen</a>`}<div class="stamp"></div>
      <h3>${esc(s.n)}</h3><p>${esc(s.d)}</p><span class="sw-day">${esc(cardTag(s))}</span>${im ? `<a class="sw-gmaps" href="${gmaps(s.n)}" target="_blank" rel="noopener">📸 Mehr Fotos</a>` : ""}
      ${im && im[2] ? `<a class="sw-credit" href="${esc(im[1] || im[0])}" target="_blank" rel="noopener">📷 ${esc(im[2])}${im[3] ? " · " + esc(im[3]) : ""}</a>` : ""}</div>` };
  swEl.innerHTML = `<div class="sw-who">${esc(me)} · ${SWCATS()[curCat].label} · ${ids.length - todo.length + 1}/${ids.length}</div>
    <div class="sw-progress"><div style="width:${pct}%"></div></div>
    <div class="stack">${todo[1] ? card(todo[1], true) : ""}${card(todo[0])}</div>
    <div class="sw-btns"><button class="sw-btn" data-v="0" aria-label="Nein">✕</button><button class="sw-btn star" data-v="2" aria-label="Unbedingt">⭐</button><button class="sw-btn" data-v="1" aria-label="Ja">❤️</button></div>
    <div class="sw-center"><button class="btn ghost small" id="sw-undo">↩︎ Zurück</button> <button class="btn ghost small" id="sw-back">Kategorie wechseln</button></div>`;
  const top = swEl.querySelector(".stack .sw-card:last-child"), stamp = top.querySelector(".stamp");
  top.querySelectorAll("a").forEach(a => a.addEventListener("pointerdown", e => e.stopPropagation()));
  const vote = v => { top.style.transform = v === 2 ? "translateY(-600px)" : `translateX(${v ? 600 : -600}px) rotate(${v ? 25 : -25}deg)`; myVotes[top.dataset.id] = v; push(); setTimeout(renderSwipe, 220) };
  swEl.querySelectorAll(".sw-btn").forEach(b => b.onclick = () => vote(+b.dataset.v));
  $("sw-undo").onclick = () => { const d = ids.filter(id => myVotes[id] !== undefined); if (d.length) { delete myVotes[d[d.length - 1]]; push(); renderStack() } };
  $("sw-back").onclick = () => { curCat = null; renderSwipe() };
  let x0 = null, y0 = 0;
  top.addEventListener("pointerdown", e => { x0 = e.clientX; y0 = e.clientY; top.classList.add("drag"); top.setPointerCapture(e.pointerId) });
  top.addEventListener("pointermove", e => { if (x0 === null) return; const dx = e.clientX - x0, dy = Math.min(0, e.clientY - y0);
    top.style.transform = `translate(${dx}px,${dy}px) rotate(${dx / 15}deg)`;
    const up = dy < -80 && Math.abs(dx) < 80; stamp.textContent = up ? "UNBEDINGT" : dx > 0 ? "JA" : "NEIN"; stamp.style.opacity = up ? Math.min(1, -dy / 120) : Math.min(1, Math.abs(dx) / 100) });
  const end = e => { if (x0 === null) return; const dx = e.clientX - x0, dy = e.clientY - y0; x0 = null; top.classList.remove("drag");
    if (dy < -110 && Math.abs(dx) < 80) vote(2); else if (dx > 100) vote(1); else if (dx < -100) vote(0); else { top.style.transform = ""; stamp.style.opacity = 0 } };
  top.addEventListener("pointerup", end); top.addEventListener("pointercancel", end);
}
function switchUser() { me = ""; myVotes = {}; curCat = null; store.set("ist-me", ""); store.set("ist-myvotes", {}); renderSwipe(); renderPack() }
function renderResults() {
  const allDone = TRAVELERS.every(n => doneV(everyone[n]));
  const { P, rows } = scoreRows(), N = P.length;
  const icon = v => v === 2 ? "⭐" : v === 1 ? "❤️" : "✕";
  const item = r => `<div class="res-item"><span class="pn" data-p="${esc(r.id)}" style="cursor:pointer">${esc(SPOTS[r.id].n)}</span><span class="votes">${r.vs.map((v, i) => `${esc(P[i])} ${icon(v)}`).join(" · ")}</span></div>`;
  const block = k => { const ids = SWCATS()[k].ids, rs = rows.filter(r => ids.includes(r.id)), all = rs.filter(r => r.yes === N), maybe = rs.filter(r => r.yes > 0 && r.yes < N), no = rs.filter(r => r.yes === 0);
    return `<h3 style="margin:18px 0 0">${SWCATS()[k].label}</h3>
    <div class="res-group"><h3>✅ Alle wollen (${all.length})</h3>${all.map(item).join("") || '<p class="muted">–</p>'}</div>
    <div class="res-group"><h3>🤔 Nicht alle (${maybe.length})</h3>${maybe.map(item).join("") || '<p class="muted">–</p>'}</div>
    <div class="res-group"><h3>❌ Will niemand (${no.length})</h3><p class="muted">${no.map(r => esc(SPOTS[r.id].n)).join(", ") || "–"}</p></div>` };
  swEl.innerHTML = `<p class="daynote" style="text-align:center">${statusLine()}</p>` + (allDone ? `<p class="daytitle">🎉 Alle haben geswipt! Euer Programm steht oben im Plan.</p>${block("food")}${block("act")}`
    : `<div class="sw-center"><p style="font-size:1.1rem">✅ Danke ${esc(me)}, du bist fertig!</p><p>Sobald alle drei durch sind, erscheint oben euer Programm. Diese Seite aktualisiert sich von selbst.</p></div>`) +
    `<div class="sw-center" style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:14px">
      ${allDone ? '<button class="btn" id="sw-plan">📅 Zum Plan</button>' : ""}
      <button class="btn ghost" id="sw-redo">Meine Swipes neu machen</button><button class="btn ghost" id="sw-who2">Andere Person</button></div>`;
  swEl.querySelectorAll(".pn").forEach(e => e.onclick = () => focusPlace(e.dataset.p));
  if ($("sw-plan")) $("sw-plan").onclick = () => { curDay = 1; renderTabs(); renderDay(); $("tabs").scrollIntoView({ behavior: "smooth", block: "start" }) };
  $("sw-redo").onclick = () => { if (confirm("Deine Swipes zurücksetzen und neu swipen?")) { myVotes = {}; push(); computePlan(); renderSwipe() } };
  $("sw-who2").onclick = switchUser;
}

// ---------- Lieblingsorte ----------
let favs = store.get("ist-favs", []), filter = "all";
function renderFilters() {
  const opts = [["all", "Alle"], ["fav", "❤️ Favoriten"], ["food", "🍽️ Essen"], ["act", "🎯 Aktivitäten"]];
  $("filters").innerHTML = opts.map(([k, l]) => `<button class="tab ${filter === k ? "on" : ""}" data-f="${k}">${l}</button>`).join("");
}
function renderPlaces() {
  const list = Object.entries(SPOTS).filter(([id, s]) => filter === "all" || (filter === "fav" ? favs.includes(id) : s.kind === filter));
  $("places").innerHTML = list.length ? list.map(([id, s]) => `<div class="place">${s.img ? `<img src="${esc(s.img[0])}" alt="" loading="lazy" style="width:64px;height:64px;object-fit:cover;border-radius:10px;flex:none">` : ""}
    <div class="body"><div class="pn" data-p="${esc(id)}">${esc(s.n)}</div><div class="pd">${esc(s.d)}</div><span class="tag" style="--c:${colorOf(id)}">${s.kind === "food" ? "Essen & Drinks" : "Aktivität"} · ${esc((AREAS[s.area]?.label || "").split(" (")[0])}</span></div>
    <button class="heart" data-h="${esc(id)}" aria-label="Favorit">${favs.includes(id) ? "❤️" : "🤍"}</button></div>`).join("")
    : `<div class="empty">Noch keine Favoriten. Tippe bei „Alle“ auf ein Herz 🤍</div>`;
}
$("filters").onclick = e => { const b = e.target.closest(".tab"); if (!b) return; filter = b.dataset.f; renderFilters(); renderPlaces() };
$("places").onclick = e => {
  const h = e.target.closest(".heart"); if (h) { const id = h.dataset.h; favs = favs.includes(id) ? favs.filter(x => x !== id) : [...favs, id]; store.set("ist-favs", favs); renderPlaces(); return }
  const n = e.target.closest(".pn"); if (n) focusPlace(n.dataset.p);
};

// ---------- Tipps (aus den Orten) & So kommt ihr hin ----------
function renderTips() {
  const withTip = Object.values(SPOTS).filter(s => s.tip);
  const general = [
    ["🧕 Moscheen", "Kopftuch oder Schal, Schultern und Knie bedeckt. Freitags erst nach dem Mittagsgebet."],
    ["☔ Bei Regen", "Altstadt-Tag (fast alles drinnen) auf den nasseren Tag legen."],
    ["💵 Bezahlen", "Karte geht fast überall, für kleine Lokale und Stände etwas Bargeld dabeihaben."]
  ];
  $("tips").innerHTML = withTip.map(s => `<div class="route"><b>${s.kind === "food" ? "🍽️" : "🎯"} ${esc(s.n)}</b>${esc(s.tip)}</div>`).join("") +
    general.map(([t, x]) => `<div class="route"><b>${t}</b>${x}</div>`).join("");
}
function renderRoutes() {
  const used = new Set(Object.values(SPOTS).map(s => s.area));
  const order = ["kad", "alt", "bey", "bos", "far"].filter(a => used.has(a));
  $("routes").innerHTML = order.map(a => `<div class="route"><b>${esc(AREAS[a].label)}</b>${ROUTES[a].map(x => `<div style="margin-top:3px">${x}</div>`).join("")}
    <div class="muted" style="margin-top:4px">${Object.values(SPOTS).filter(s => s.area === a).map(s => esc(s.n)).join(" · ")}</div></div>`).join("") +
    `<div class="route"><b>✈️ Flughafen SAW</b><div style="margin-top:3px">🚇 M4 direkt ab Kadıköy (Endstation), knapp 1 Std.</div><div style="margin-top:3px">🚐 Oder Flughafentransfer vom Hotel</div></div>`;
}

// ---------- Wetter (Tagesverlauf) ----------
const WMO = c => c === 0 ? ["☀️", "Sonnig"] : c <= 2 ? ["🌤️", "Heiter"] : c === 3 ? ["☁️", "Bewölkt"] : c <= 48 ? ["🌫️", "Nebel"] : c <= 57 ? ["🌦️", "Niesel"] : c <= 67 ? ["🌧️", "Regen"] : c <= 77 ? ["🌨️", "Schnee"] : c <= 82 ? ["🌦️", "Schauer"] : ["⛈️", "Gewitter"];
let WX = null, wxDay = null;
async function loadWeather() {
  const el = $("weather");
  try {
    WX = await fetch("https://api.open-meteo.com/v1/forecast?latitude=40.99&longitude=29.03&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset&hourly=temperature_2m,precipitation_probability,weathercode,wind_speed_10m&timezone=Europe%2FIstanbul&forecast_days=16").then(r => r.json());
    const d = WX.daily, idx = DAYS.map(x => d.time.indexOf(x.date)), rainy = [];
    el.innerHTML = DAYS.map((x, k) => { const i = idx[k]; if (i < 0) return `<div class="day trip"><div class="d">${x.tab}</div><div class="ic">❔</div><div class="r">noch keine Prognose</div></div>`;
      const [ic, lab] = WMO(d.weathercode[i]), pr = d.precipitation_probability_max[i]; if (pr >= 50) rainy.push(x.tab);
      return `<button class="day trip wxbtn" data-wx="${x.date}" title="${lab}"><div class="d">${x.tab}</div><div class="ic">${ic}</div><div class="t">${Math.round(d.temperature_2m_min[i])}–${Math.round(d.temperature_2m_max[i])}°</div><div class="r">💧 ${pr}%</div></button>` }).join("");
    el.querySelectorAll("[data-wx]").forEach(b => b.onclick = () => { wxDay = b.dataset.wx; renderHourly() });
    const tip = $("wtip");
    if (rainy.includes("Sa 21.") && !rainy.includes("Fr 20.")) tip.textContent = "☔ Samstag sieht nasser aus als Freitag: Tauscht die Tage! Galata & Bosporus am Freitag, die Altstadt (drinnen) am Samstag.";
    else if (rainy.length) tip.textContent = `☔ Regen möglich am ${rainy.join(", ")} – Regenjacke & wasserfeste Schuhe einpacken.`;
    else tip.textContent = "👍 Sieht gut aus, der Plan passt so.";
    const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Istanbul" });
    wxDay = DAYS.find(x => x.date === today && d.time.includes(x.date))?.date || DAYS.find(x => d.time.includes(x.date))?.date || null;
    renderHourly();
  } catch (e) { el.innerHTML = `<div class="muted">Wetter gerade nicht erreichbar.</div>` }
}
function renderHourly() {
  const box = $("hourly"); if (!WX || !wxDay) { box.innerHTML = '<p class="muted">Der Stundenverlauf erscheint, sobald es für eure Tage eine Prognose gibt (ca. 2 Wochen im Voraus).</p>'; return }
  document.querySelectorAll("[data-wx]").forEach(b => b.classList.toggle("on", b.dataset.wx === wxDay));
  const h = WX.hourly, di = WX.daily.time.indexOf(wxDay);
  const hrs = h.time.map((t, i) => ({ t, i })).filter(x => x.t.startsWith(wxDay) && +x.t.slice(11, 13) >= 7);
  if (!hrs.length) { box.innerHTML = ""; return }
  const temps = hrs.map(x => h.temperature_2m[x.i]), mn = Math.min(...temps) - 1, mx = Math.max(...temps) + 1;
  const W = hrs.length * 52, H = 60, pts = hrs.map((x, k) => `${k * 52 + 26},${H - 8 - (h.temperature_2m[x.i] - mn) / (mx - mn || 1) * (H - 20)}`).join(" ");
  const label = DAYS.find(x => x.date === wxDay)?.tab || wxDay;
  box.innerHTML = `<p class="daynote" style="margin:10px 0 4px"><b>${label}</b> · Stunde für Stunde · 🌅 ${WX.daily.sunrise[di].slice(11)} · 🌇 ${WX.daily.sunset[di].slice(11)}</p>
    <div class="hours"><div style="width:${W}px;position:relative">
      <svg width="${W}" height="${H}" style="display:block"><polyline points="${pts}" fill="none" stroke="#c8553d" stroke-width="2.5" stroke-linejoin="round"/>
        ${hrs.map((x, k) => `<circle cx="${k * 52 + 26}" cy="${pts.split(" ")[k].split(",")[1]}" r="3" fill="#c8553d"/>`).join("")}</svg>
      <div style="display:flex">${hrs.map(x => { const pr = h.precipitation_probability[x.i] ?? 0;
        return `<div class="hr"><div class="ht">${x.t.slice(11, 13)}h</div><div class="hi">${WMO(h.weathercode[x.i])[0]}</div><div class="hv">${Math.round(h.temperature_2m[x.i])}°</div>
          <div class="hb"><div style="height:${pr}%"></div></div><div class="hp">${pr}%</div></div>` }).join("")}</div></div></div>
    <p class="muted" style="margin:4px 0 0">Balken = Regenwahrscheinlichkeit. Tippe oben auf einen Tag.</p>`;
}

// ---------- Türkisch für unterwegs ----------
const PHRASES = [
  ["👋 Basics", [["Hallo", "Merhaba", "mer-ha-ba"], ["Danke", "Teşekkür ederim", "te-schek-kür e-de-rim"], ["Danke (locker)", "Sağ ol", "saa ol"], ["Bitte (bei Bitten)", "Lütfen", "lüt-fen"], ["Ja / Nein", "Evet / Hayır", "e-wet / ha-jer"], ["Entschuldigung", "Affedersiniz", "af-fe-der-si-nis"], ["Guten Morgen", "Günaydın", "gü-naj-den"], ["Guten Abend", "İyi akşamlar", "i-ji ak-scham-lar"], ["Tschüss", "Hoşça kal", "hosch-tscha kal"], ["Ich verstehe nicht", "Anlamıyorum", "an-la-me-jo-rum"], ["Sprechen Sie Englisch?", "İngilizce biliyor musunuz?", "in-gi-lis-dsche bi-li-jor mu-su-nus"]]],
  ["🍷 Im Restaurant & in der Bar", [["Weisswein", "Beyaz şarap", "be-jas scha-rap"], ["Rotwein", "Kırmızı şarap", "ker-me-se scha-rap"], ["Rosé", "Roze şarap", "ro-se scha-rap"], ["Ein Glas…", "Bir kadeh…", "bir ka-de"], ["Eine Flasche…", "Bir şişe…", "bir schi-sche"], ["Bier", "Bira", "bi-ra"], ["Prost!", "Şerefe!", "sche-re-fe"], ["Wasser (ohne Kohlensäure)", "Su", "su"], ["Mineralwasser", "Maden suyu / Soda", "ma-den su-ju"], ["Tee / Kaffee", "Çay / Kahve", "tschai / kach-we"], ["Die Rechnung, bitte", "Hesap, lütfen", "he-sap lüt-fen"], ["Speisekarte", "Menü", "me-nü"], ["Nicht scharf, bitte", "Acısız, lütfen", "a-dsche-ses lüt-fen"], ["Vegetarisch", "Vejetaryen", "we-sche-tar-jen"], ["Lecker!", "Çok lezzetli!", "tschok les-set-li"], ["Guten Appetit", "Afiyet olsun", "a-fi-jet ol-sun"]]],
  ["🛍️ Einkaufen & Basar", [["Wie viel kostet das?", "Ne kadar?", "ne ka-dar"], ["Zu teuer", "Çok pahalı", "tschok pa-ha-le"], ["Geht es günstiger?", "İndirim yapar mısınız?", "in-di-rim ja-par me-se-nes"], ["Kann ich mit Karte zahlen?", "Kartla ödeyebilir miyim?", "kart-la ö-de-je-bi-lir mi-jim"], ["Ich schaue nur", "Sadece bakıyorum", "sa-de-dsche ba-ke-jo-rum"]]],
  ["🚇 Unterwegs", [["Wo ist…?", "… nerede?", "ne-re-de"], ["Toilette", "Tuvalet", "tu-wa-let"], ["Metro / Fähre", "Metro / Vapur", "met-ro / wa-pur"], ["Haltestelle", "Durak", "du-rak"], ["Links / Rechts / Geradeaus", "Sol / Sağ / Düz", "sol / saa / düs"], ["Hilfe!", "İmdat!", "im-dat"]]],
  ["🔢 Zahlen", [["1 · 2 · 3", "bir · iki · üç", "bir · i-ki · ütsch"], ["4 · 5", "dört · beş", "dört · besch"], ["10 · 100", "on · yüz", "on · jüs"]]]
];
function speak(t) { try { const u = new SpeechSynthesisUtterance(t); u.lang = "tr-TR"; u.rate = .85; speechSynthesis.cancel(); speechSynthesis.speak(u) } catch (e) {} }
function renderPhrases() {
  const canSpeak = "speechSynthesis" in window;
  $("phrases").innerHTML = PHRASES.map(([g, list]) => `<div class="route"><b>${g}</b>${list.map(([de, tr, pr]) => `<div class="phr">
      <div><div class="tr">${esc(tr)}</div><div class="muted">${esc(de)} · <i>${esc(pr)}</i></div></div>
      ${canSpeak ? `<button class="say" data-say="${esc(tr.replace(/…/g, ""))}" aria-label="Anhören">🔊</button>` : ""}</div>`).join("")}</div>`).join("");
  $("phrases").querySelectorAll("[data-say]").forEach(b => b.onclick = () => speak(b.dataset.say));
}

// ---------- Bahnlinien auf der Karte ----------
let railLayer = null;
function toggleRail(on) {
  if (on && !railLayer) railLayer = L.tileLayer("https://{s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png", { maxZoom: 19, opacity: .85, attribution: "Bahnlinien © OpenRailwayMap (CC-BY-SA)" });
  if (on) railLayer.addTo(map); else if (railLayer) map.removeLayer(railLayer);
}

// ---------- Packliste ----------
let PACK = [
  ["📄 Dokumente", ["Pass oder ID", "Flugtickets / Boarding Pässe", "Hotelbuchung (Otel Kadıköy)", "Krankenkassenkarte / Reiseversicherung"]],
  ["💳 Geld & Handy", ["Kreditkarte + etwas Bargeld (TRY)", "Istanbulkart-App aufgeladen", "Powerbank", "Ladekabel", "Reiseadapter (Schweizer Stecker passen nicht in türkische Steckdosen)"]],
  ["🧥 Kleidung", ["Regenjacke", "Warmer Pulli / Fleece", "Bequeme, wasserfeste Schuhe", "Schal oder Tuch (Kopfbedeckung für Moscheen)", "Lange Hose / Rock über die Knie (Moscheen)", "Etwas Schickes für die Rooftop-Bar", "Pyjama"]],
  ["🧖 Hamam", ["Bikini / Badeanzug", "Flip-Flops", "Haargummi"]],
  ["🎒 Unterwegs", ["Kleiner Regenschirm", "Tagesrucksack", "Stoffbeutel für den Basar", "Taschentücher", "Sonnenbrille"]],
  ["💊 Pflege", ["Zahnbürste & Zahnpasta", "Medikamente", "Pflaster / Blasenpflaster", "Ohrstöpsel", "Handcreme / Lippenbalsam"]]
];
function renderPack() {
  const k = "ist-pack-" + (me || "x"), st = store.get(k, {}), tot = PACK.reduce((a, g) => a + g[1].length, 0), n = PACK.flatMap(g => g[1]).filter(it => st[it]).length;
  $("pack").innerHTML = `<p class="daynote">${me ? `Packliste von <b>${esc(me)}</b> · ` : ""}${n}/${tot} eingepackt</p>
    <div class="sw-progress" style="max-width:none;margin-bottom:10px"><div style="width:${tot ? Math.round(n / tot * 100) : 0}%"></div></div>
    <div class="routes">${PACK.map(([g, items]) => `<div class="route"><b>${esc(g)}</b>${items.map(it => `<label style="display:flex;gap:8px;align-items:flex-start;padding:3px 0;cursor:pointer">
      <input type="checkbox" data-pk="${esc(it)}" ${st[it] ? "checked" : ""} style="accent-color:var(--tile);margin-top:3px"> <span ${st[it] ? 'style="text-decoration:line-through;opacity:.55"' : ""}>${esc(it)}</span></label>`).join("")}</div>`).join("")}</div>`;
  document.querySelectorAll("[data-pk]").forEach(c => c.onchange = () => { st[c.dataset.pk] = c.checked; store.set(k, st); renderPack() });
}

// ---------- Admin ----------
let admPw = (() => { try { return sessionStorage.getItem("ist-adm") || "" } catch (e) { return "" } })();
let editId = null;
const admEl = $("admin");
const packToText = () => PACK.map(([g, items]) => "# " + g + "\n" + items.join("\n")).join("\n\n");
const textToPack = t => { const out = []; let cur = null; t.split("\n").map(l => l.trim()).filter(Boolean).forEach(l => { if (l.startsWith("#")) { cur = [l.replace(/^#+\s*/, ""), []]; out.push(cur) } else { if (!cur) { cur = ["Sonstiges", []]; out.push(cur) } cur[1].push(l) } }); return out.filter(g => g[1].length) };
async function rpc(fn, args) { const { data, error } = await db.rpc(fn, { pw: admPw, ...args }); if (error) throw new Error(error.message); return data }
async function ensureSeeded() {
  if (SPOTS_FROM_DB) return;
  for (const [id, s] of Object.entries(SPOTS)) { const { sort, ...d } = s; await rpc("admin_upsert_place", { pid: id, d, s: sort || 0 }) }
  SPOTS_FROM_DB = true;
}
async function refreshEverything() {
  await loadSpots(); renderMarkers(); renderPlaces(); renderTips(); renderRoutes(); await pull(); renderDay(); renderSwipe();
}
async function admRender() {
  if (location.hash !== "#admin") { admEl.style.display = "none"; return }
  admEl.style.display = "flex";
  const ok = admPw && db && (await db.rpc("admin_check", { pw: admPw })).data === true;
  $("adm-login").style.display = ok ? "none" : ""; $("adm-body").style.display = ok ? "" : "none";
  if (!ok) return;
  await pull();
  $("adm-status").innerHTML = statusLine();
  $("adm-btns").innerHTML = TRAVELERS.map(n => `<button class="btn ghost small" data-reset="${esc(n)}">↺ ${esc(n)} zurücksetzen</button>`).join("") + `<button class="btn small" data-reset="" style="background:var(--terra)">🗑️ Alle Swipes löschen</button>`;
  admEl.querySelectorAll("[data-reset]").forEach(b => b.onclick = async () => {
    const who = b.dataset.reset || null;
    if (!confirm(who ? `Swipes von ${who} löschen?` : "Wirklich ALLE Swipes löschen? Das kann man nicht rückgängig machen.")) return;
    try { await rpc("admin_reset_swipes", { who }) } catch (e) { return alert("Fehler: " + e.message) }
    if (!who || who === me) { myVotes = {}; store.set("ist-myvotes", {}); store.set("ist-pushed", false); curCat = null }
    everyone = {}; await pull(); renderSwipe(); admRender();
  });
  renderAdmSpots();
  const ta = $("adm-pack"); if (!ta.dataset.loaded) { ta.value = packToText(); ta.dataset.loaded = "1" }
}
function renderAdmSpots() {
  const list = k => Object.entries(SPOTS).filter(([, s]) => s.kind === k).sort((a, b) => (a[1].sort || 0) - (b[1].sort || 0));
  const row = ([id, s]) => `<div class="adm-row">${s.img ? `<img src="${esc(s.img[0])}" alt="">` : `<span class="adm-noimg">${s.kind === "food" ? "🍽️" : "📍"}</span>`}
    <div style="flex:1;min-width:0"><b>${esc(s.n)}</b><div class="muted">${esc((AREAS[s.area]?.label || "?").split(" (")[0])} · ${s.kind === "food" ? (s.meals || []).map(m => MEAL[m]).join(", ") : PART[s.part] || ""}</div></div>
    <button class="btn ghost small" data-edit="${esc(id)}">✏️</button><button class="btn ghost small" data-del="${esc(id)}">🗑️</button></div>`;
  $("adm-spots").innerHTML = `<p class="muted">${FOODIDS().length} Essen · ${ACTIDS().length} Aktivitäten${SPOTS_FROM_DB ? "" : " · (Startliste, wird beim ersten Speichern übernommen)"}</p>
    <h4>🍽️ Essen & Drinks</h4>${list("food").map(row).join("")}<h4>🎯 Aktivitäten</h4>${list("act").map(row).join("")}`;
  $("adm-spots").querySelectorAll("[data-edit]").forEach(b => b.onclick = () => openEditor(b.dataset.edit));
  $("adm-spots").querySelectorAll("[data-del]").forEach(b => b.onclick = async () => {
    const id = b.dataset.del; if (!confirm(`„${SPOTS[id].n}“ löschen?`)) return;
    try { await ensureSeeded(); await rpc("admin_delete_place", { pid: id }) } catch (e) { return alert("Fehler: " + e.message) }
    await refreshEverything(); renderAdmSpots();
  });
}
function openEditor(id) {
  editId = id; const s = id ? SPOTS[id] : { n: "", d: "", kind: "act", area: "alt", part: "vm", meals: [], ll: null, img: null, tip: "", go: "" };
  $("ed").style.display = ""; $("ed-title").textContent = id ? "Ort bearbeiten" : "Neuer Ort";
  $("ed-n").value = s.n; $("ed-d").value = s.d || ""; $("ed-kind").value = s.kind; $("ed-area").value = s.area; $("ed-part").value = s.part || "nm";
  document.querySelectorAll("[data-meal]").forEach(c => c.checked = (s.meals || []).includes(c.dataset.meal));
  $("ed-tip").value = s.tip || ""; $("ed-go").value = s.go || "";
  $("ed-lat").value = s.ll ? s.ll[0] : ""; $("ed-lng").value = s.ll ? s.ll[1] : "";
  setEdImg(s.img); $("ed-geo-res").innerHTML = ""; $("ed-img-res").innerHTML = ""; $("ed-msg").textContent = "";
  edKind(); $("ed").scrollIntoView({ behavior: "smooth", block: "start" });
}
let edImg = null;
function setEdImg(im) { edImg = im; $("ed-img-prev").innerHTML = im ? `<img src="${esc(im[0])}" style="width:120px;height:80px;object-fit:cover;border-radius:8px"> <span class="muted">${esc(im[2] || "")} ${esc(im[3] || "")}</span> <button class="btn ghost small" id="ed-img-x">Foto entfernen</button>` : `<span class="muted">Kein Foto</span>`; if (im) $("ed-img-x").onclick = () => setEdImg(null) }
function edKind() { const f = $("ed-kind").value === "food"; $("ed-meals").style.display = f ? "" : "none"; $("ed-partwrap").style.display = f ? "none" : "" }
async function geoSearch() {
  const q = $("ed-n").value.trim(); if (!q) return;
  $("ed-geo-res").innerHTML = '<span class="muted">Suche…</span>';
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=5&viewbox=28.5,41.3,29.5,40.8&bounded=1&q=${encodeURIComponent(q)}`).then(r => r.json());
    $("ed-geo-res").innerHTML = r.length ? r.map((x, i) => `<button class="btn ghost small" data-geo="${i}" style="text-align:left;margin:2px 0">📍 ${esc(x.display_name.split(",").slice(0, 3).join(","))}</button>`).join("<br>") : '<span class="muted">Nichts gefunden. Probier einen Google-Maps-Link oder trag die Koordinaten ein.</span>';
    $("ed-geo-res").querySelectorAll("[data-geo]").forEach(b => b.onclick = () => { const x = r[+b.dataset.geo]; $("ed-lat").value = (+x.lat).toFixed(5); $("ed-lng").value = (+x.lon).toFixed(5); $("ed-geo-res").innerHTML = "✅ Position übernommen" });
  } catch (e) { $("ed-geo-res").innerHTML = '<span class="muted">Suche gerade nicht möglich.</span>' }
}
function parseGmaps() {
  const t = $("ed-gm").value; const m = t.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) || t.match(/[?&](?:q|query|destination|ll)=(-?\d+\.\d+)(?:,|%2C)(-?\d+\.\d+)/) || t.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (m) { $("ed-lat").value = (+m[1]).toFixed(5); $("ed-lng").value = (+m[2]).toFixed(5); $("ed-geo-res").innerHTML = "✅ Position aus dem Link übernommen" }
  else $("ed-geo-res").innerHTML = '<span class="muted">Im Link keine Koordinaten gefunden. In Google Maps: Ort öffnen → in der Adresszeile steht „@41.0…,28.9…“, diesen Link kopieren.</span>';
}
async function imgSearch() {
  const q = $("ed-n").value.trim(); if (!q) return;
  $("ed-img-res").innerHTML = '<span class="muted">Suche freie Fotos…</span>';
  try {
    const r = await fetch(`https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(q + " filetype:bitmap")}&gsrnamespace=6&gsrlimit=12&prop=imageinfo&iiprop=url|extmetadata&iiextmetadatafilter=Artist|LicenseShortName&iiurlwidth=640&format=json&origin=*`).then(r => r.json());
    const L2 = Object.values(r.query?.pages || {}).filter(p => p.imageinfo).map(p => [p.imageinfo[0].thumburl, p.imageinfo[0].descriptionurl, (p.imageinfo[0].extmetadata?.Artist?.value || "").replace(/<[^>]+>/g, "").trim().slice(0, 50), p.imageinfo[0].extmetadata?.LicenseShortName?.value || ""]);
    $("ed-img-res").innerHTML = L2.length ? `<p class="muted">Tippe auf ein Foto, das wirklich diesen Ort zeigt:</p><div style="display:flex;gap:6px;flex-wrap:wrap">${L2.map((x, i) => `<img src="${esc(x[0])}" data-pick="${i}" style="width:110px;height:80px;object-fit:cover;border-radius:8px;cursor:pointer">`).join("")}</div>`
      : '<span class="muted">Keine freien Fotos gefunden. Du kannst unten einen eigenen Foto-Link einfügen.</span>';
    $("ed-img-res").querySelectorAll("[data-pick]").forEach(im => im.onclick = () => { setEdImg(L2[+im.dataset.pick]); $("ed-img-res").innerHTML = "✅ Foto übernommen" });
  } catch (e) { $("ed-img-res").innerHTML = '<span class="muted">Suche gerade nicht möglich.</span>' }
}
async function saveSpot() {
  const n = $("ed-n").value.trim(); if (!n) return $("ed-msg").textContent = "❌ Name fehlt";
  const kind = $("ed-kind").value, lat = parseFloat($("ed-lat").value), lng = parseFloat($("ed-lng").value);
  const meals = [...document.querySelectorAll("[data-meal]")].filter(c => c.checked).map(c => c.dataset.meal);
  if (kind === "food" && !meals.length) return $("ed-msg").textContent = "❌ Mindestens eine Mahlzeit wählen";
  const url = $("ed-imgurl").value.trim(); if (url) setEdImg([url, url, "", ""]);
  const d = { n, d: $("ed-d").value.trim(), kind, area: $("ed-area").value, ll: isFinite(lat) && isFinite(lng) ? [lat, lng] : null, img: edImg, tip: $("ed-tip").value.trim(), go: $("ed-go").value.trim() };
  if (kind === "food") d.meals = meals; else d.part = $("ed-part").value;
  const id = editId || (n.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ı/g, "i").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "ort") + (editId ? "" : "-" + Date.now().toString(36).slice(-4));
  const sort = editId ? (SPOTS[editId].sort || 0) : (Math.max(0, ...Object.values(SPOTS).map(s => s.sort || 0)) + 10);
  $("ed-msg").textContent = "Speichere…";
  try { await ensureSeeded(); await rpc("admin_upsert_place", { pid: id, d, s: sort }) } catch (e) { return $("ed-msg").textContent = "❌ " + e.message }
  $("ed-msg").textContent = "✅ Gespeichert"; $("ed-imgurl").value = ""; $("ed-gm").value = "";
  await refreshEverything(); renderAdmSpots(); setTimeout(() => { $("ed").style.display = "none" }, 600);
}
$("adm-go").onclick = async () => {
  admPw = $("adm-pw").value;
  const { data } = db ? await db.rpc("admin_check", { pw: admPw }) : { data: false };
  if (data === true) { try { sessionStorage.setItem("ist-adm", admPw) } catch (e) {} $("adm-msg").textContent = ""; admRender() }
  else $("adm-msg").textContent = "❌ Falsches Passwort";
};
$("adm-pw").onkeydown = e => e.key === "Enter" && $("adm-go").click();
$("adm-savepack").onclick = async () => {
  const g = textToPack($("adm-pack").value);
  try { await rpc("admin_set_pack", { g }); $("adm-packmsg").textContent = "✅ Gespeichert, alle sehen die neue Liste"; PACK = g; renderPack() } catch (e) { $("adm-packmsg").textContent = "❌ " + e.message }
};
$("adm-close").onclick = () => { history.replaceState(null, "", location.pathname); admRender() };
$("adm-out").onclick = () => { admPw = ""; try { sessionStorage.removeItem("ist-adm") } catch (e) {} history.replaceState(null, "", location.pathname); admRender() };
$("adm-new").onclick = () => openEditor(null);
$("ed-kind").onchange = edKind;
$("ed-geo").onclick = geoSearch; $("ed-gm-go").onclick = parseGmaps; $("ed-img").onclick = imgSearch;
$("ed-save").onclick = saveSpot; $("ed-cancel").onclick = () => { $("ed").style.display = "none" };
window.addEventListener("hashchange", admRender);

// ---------- Start ----------
async function refreshAll() { if (document.visibilityState !== "visible") return; await pull(); if (!me || (doneV(myVotes) && !curCat)) renderSwipe() }
(async () => {
  await loadSpots();
  renderMarkers(); renderTabs(); renderDay(); renderFilters(); renderPlaces(); renderTips(); renderRoutes(); renderPack(); renderPhrases(); loadWeather();
  $("rail").onchange = e => toggleRail(e.target.checked);
  if (db) db.from("packlist").select("groups").eq("trip", TRIP).maybeSingle().then(({ data }) => { if (data?.groups?.length) { PACK = data.groups; renderPack() } });
  await pull(); renderSwipe(); admRender();
  setInterval(refreshAll, 15000);
  document.addEventListener("visibilitychange", refreshAll);
})();
