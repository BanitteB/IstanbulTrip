// Istanbul-Reise-Dashboard · Valä, Cha, Bettä
// Viertel, Orte, Swipes und Packliste liegen in Supabase. Fotos: Wikimedia Commons.

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
const VIBE = { Touristisch: "📸 Touristisch", Lokal: "🏡 Lokal", Gemischt: "🔀 Gemischt" };

// ---------- Tage, Mahlzeiten ----------
const MEAL = { br: "Frühstück", lu: "Mittagessen", sn: "Kaffee & Dessert", di: "Abendessen", dr: "Drinks" };
const DAYNAME = { kad: "Do-Abend / So-Morgen", fr: "Freitag", sa: "Samstag", flex: "Fr oder Sa (wo Platz ist)" };
const GEO_ORDER = { fr: ["q_sul", "q_emi", "q_bal"], sa: ["q_kar", "q_gal", "q_bey", "q_ort"] };
const ACT_MAX_DAY = 7;
// Mahlzeiten pro Tag: [Label, Mahlzeiten, wo ("day" = Viertel des Tages, "kad" = Kadıköy), Position]
const MEALSLOTS = {
  do: [["19:30", ["di", "lu"], "kad", 850], ["Danach", ["sn", "dr"], "kad", 900]],
  fr: [["Frühstück", ["br"], "day", -10], ["Mittag", ["lu"], "day", 150], ["Pause", ["sn"], "day", 250], ["Abend", ["di", "dr"], "day|kad", 850], ["Danach", ["dr", "sn"], "day|kad", 900]],
  sa: [["Frühstück", ["br"], "day|kad", -10], ["Mittag", ["lu"], "day", 150], ["Pause", ["sn"], "day", 250], ["Abend", ["di", "dr"], "day|kad", 850], ["Danach", ["dr", "sn"], "day|kad", 900]],
  so: [["Frühstück", ["br", "sn"], "kad", -10]]
};
const BASE = {
  hotel: { n: "Otel Kadıköy", ll: [40.9905, 29.0275], d: "Uzun Hafız Sk. 18 · 5 Min. zur Fähre" },
  saw: { n: "Flughafen Sabiha Gökçen (SAW)", ll: [40.8986, 29.3092], d: "M4 direkt bis Kadıköy, knapp 1 Std." },
  merter: { n: "Merter", ll: [41.0075, 28.8950], d: "Shopping · M4 → Marmaray bis Yenikapı → M1A bis Merter", other: true }
};
const DAYS = [
  { key: "do", tab: "Do 19.", date: "2026-11-19", title: "Ankunft & Kadıköy", note: "✈️ ZRH → SAW 10:50–15:45 (PC948) · BJV → SAW 16:25–17:45 (PC2249). Check-in ab 14 Uhr.",
    start: [{ t: "15:45", p: "saw", info: "Zürich-Flug landet, mit der M4 bis Kadıköy", go: "Oder Hotel-Flughafentransfer" },
            { t: "ca. 17:00", p: "hotel", info: "Einchecken" },
            { t: "17:45", p: "saw", info: "Bodrum-Flug landet, ca. 19 Uhr im Hotel" }], end: [] },
  { key: "fr", tab: "Fr 20.", date: "2026-11-20", title: "Freitag", note: "", start: [], end: [] },
  { key: "sa", tab: "Sa 21.", date: "2026-11-21", title: "Samstag", note: "", start: [], end: [] },
  { key: "so", tab: "So 22.", date: "2026-11-22", title: "Abreise", note: "✈️ SAW → BJV 13:55 (PC2248) · SAW → Basel 15:00 (AJet VF105). Check-out bis 12 Uhr.",
    start: [], end: [{ t: "11:30", p: "hotel", info: "Check-out. Bodrum-Flug: spätestens jetzt los" },
                     { t: "12:00", p: "saw", info: "Basel-Flug: M4 direkt zum SAW, knapp 1 Std." }] }
];
// ÖV pro Viertel (ab Hotel)
const ROUTES = {
  q_kad: ["🚶 Alles zu Fuss, Moda ca. 15 Min. oder Nostalgie-Tram T3"],
  q_sul: ["⛴️ Fähre → Eminönü, dann T1 bis Sultanahmet", "🚇 M4 → Ayrılık Çeşmesi → Marmaray bis Sirkeci → T1"],
  q_emi: ["⛴️ Fähre → Eminönü (ca. 20 Min.)", "🚇 M4 → Marmaray bis Sirkeci"],
  q_bal: ["⛴️ Fähre → Eminönü, dann Bus oder Taxi am Goldenen Horn entlang (ca. 15 Min.)"],
  q_kar: ["⛴️ Fähre → Karaköy", "🚋 Von der Altstadt: T1 über die Galatabrücke"],
  q_gal: ["⛴️ Fähre → Karaköy, dann zu Fuss bergauf oder F2 Tünel", "🚇 M4 → Marmaray bis Yenikapı → M2 bis Şişhane"],
  q_bey: ["🚇 M4 → Marmaray bis Yenikapı → M2 bis Taksim", "⛴️ Fähre → Karaköy → F2 Tünel → İstiklal"],
  q_ort: ["⛴️ Fähre → Beşiktaş, dann Bus ca. 10 Min.", "🚇 M4 → Marmaray bis Üsküdar → Fähre nach Beşiktaş"],
  q_usk: ["🚇 M4 → Ayrılık Çeşmesi → Marmaray bis Üsküdar (1 Station)", "🚌 Kuzguncuk: ab Üsküdar Bus oder Taxi ca. 10 Min."]
};

// ---------- Orte laden ----------
let SPOTS = {}, PLACES = {}, SPOTS_FROM_DB = false;
async function loadSpots() {
  let rows = null;
  if (db) { const { data, error } = await db.from("places").select("id,data,sort").eq("trip", TRIP).order("sort"); if (!error && data.length && data.some(r => r.data.kind === "quarter")) { rows = data; SPOTS_FROM_DB = true } }
  if (!rows) { try { rows = await fetch("defaults.json?v=24").then(r => r.json()) } catch (e) { rows = [] } SPOTS_FROM_DB = false }
  SPOTS = {}; rows.forEach(r => SPOTS[r.id] = { ...r.data, sort: r.sort || 0 });
  PLACES = { ...BASE }; Object.entries(SPOTS).forEach(([id, s]) => PLACES[id] = s);
}
const bySort = (a, b) => (SPOTS[a].sort || 0) - (SPOTS[b].sort || 0);
const QIDS = () => Object.keys(SPOTS).filter(id => SPOTS[id].kind === "quarter").sort(bySort);
const kindIds = k => Object.keys(SPOTS).filter(id => SPOTS[id].kind === k && SPOTS[SPOTS[id].q]).sort((a, b) => QIDS().indexOf(SPOTS[a].q) - QIDS().indexOf(SPOTS[b].q) || bySort(a, b));
const qName = id => SPOTS[SPOTS[id]?.q]?.n || "";

// ---------- Karte ----------
const COLORS = { hotel: "#0f2a43", quarter: "#7b4fa0", food: "#c8553d", act: "#1d5c7a", other: "#e0a13a" };
const colorOf = id => BASE[id]?.other ? COLORS.other : BASE[id] ? COLORS.hotel : COLORS[SPOTS[id]?.kind] || COLORS.act;
const map = L.map("map", { scrollWheelZoom: false }).setView([41.015, 28.99], 12);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(map);
let markers = {}, routeLine = null;
function renderMarkers() {
  Object.values(markers).forEach(m => map.removeLayer(m)); markers = {};
  Object.entries(PLACES).forEach(([id, p]) => {
    if (!p.ll) return;
    const q = p.kind === "quarter";
    markers[id] = L.circleMarker(p.ll, { radius: id === "hotel" ? 10 : q ? 13 : 7, color: "#fff", weight: 2, fillColor: colorOf(id), fillOpacity: q ? .55 : 1 }).addTo(map)
      .bindPopup(`<b>${esc(p.n)}</b>${p.q ? `<br><span style="color:#7b4fa0">${esc(qName(id))}</span>` : ""}<br><span style="color:#6b7380">${esc(p.d)}</span><br><a target="_blank" href="${route(p.ll)}">🚇 Route ↗</a> · <a target="_blank" href="${gmaps(p.n)}">📸 Fotos ↗</a>`);
  });
  $("legend").innerHTML = [["Hotel & Flughafen", COLORS.hotel], ["Viertel", COLORS.quarter], ["Sehenswertes", COLORS.act], ["Essen & Drinks", COLORS.food], ["Merter", COLORS.other]].map(([l, c]) => `<span style="--c:${c}">${l}</span>`).join("");
}
function showDayOnMap(stops) {
  if (routeLine) map.removeLayer(routeLine);
  const pts = stops.filter(s => s.p !== "saw" && PLACES[s.p]?.ll).map(s => PLACES[s.p].ll);
  if (!pts.length) { map.setView([41.015, 28.99], 12); return }
  routeLine = L.polyline(pts, { color: "#c8553d", weight: 3, dashArray: "6 6" }).addTo(map);
  map.fitBounds(L.latLngBounds(pts).pad(.25));
}
function openSec(el) { const sec = el?.closest("main > section.card"); if (sec && sec.classList.contains("collapsed")) sec.querySelector(":scope > h2").click() }
function focusPlace(id) {
  const p = PLACES[id]; if (!p?.ll) return;
  openSec($("map"));
  map.setView(p.ll, 15); markers[id]?.openPopup();
  $("map").scrollIntoView({ behavior: "smooth", block: "center" });
}

// ---------- Countdown ----------
(() => {
  const start = new Date("2026-11-19T00:00:00+03:00"), end = new Date("2026-11-23T00:00:00+03:00"), now = new Date();
  if (now < start) { const d = Math.ceil((start - now) / 864e5); $("countdown").textContent = `Noch ${d} ${d === 1 ? "Tag" : "Tage"} ✈️` }
  else $("countdown").textContent = now < end ? "Ihr seid da! 🎉" : "Schön war's 💙";
})();

// ---------- Swipes: wer muss was swipen ----------
let me = store.get("ist-me", ""); if (me && !TRAVELERS.includes(me)) me = "";
let myVotes = store.get("ist-myvotes", {});
let curCat = null, everyone = {}, planResult = null, introSeen = new Set();
// Runde 2 & 3: nur Orte in Vierteln, zu denen die Person Ja gesagt hat
const roundIds = (k, v) => k === "quarter" ? QIDS() : k === "pick" ? [...kindIds("act"), ...kindIds("food")].filter(id => (v?.[SPOTS[id].q] ?? 0) > 0) : kindIds(k).filter(id => (v?.[SPOTS[id].q] ?? 0) > 0);
const likedQ = v => QIDS().filter(q => (v?.[q] ?? 0) > 0 && Object.keys(SPOTS).some(id => SPOTS[id].q === q));
const qSpots = q => [...kindIds("act"), ...kindIds("food")].filter(id => SPOTS[id].q === q);
const qDone = (q, v) => qSpots(q).every(id => v?.[id] !== undefined);
const requiredIds = v => kindIds("act");
const doneIds = (v, ids) => !!v && ids.every(id => v[id] !== undefined);
const doneV = v => doneIds(v, kindIds("act"));
const progress = v => { const r = requiredIds(v || {}); return [r.filter(id => v && v[id] !== undefined).length, r.length] };

async function pull() {
  if (db) {
    const { data, error } = await db.from("swipes").select("name,votes").eq("trip", TRIP);
    if (!error) { everyone = {}; data.forEach(r => everyone[r.name] = r.votes || {}) }
  }
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

// ---------- Auswertung & Plan ----------
function evaluate() {
  const N = TRAVELERS.length, need = Math.ceil(N * 2 / 3);
  const acts = kindIds("act").map(id => { const vs = TRAVELERS.map(n => everyone[n]?.[id] ?? 0);
    const yes = vs.filter(v => v > 0).length, star = vs.includes(2);
    return { id, vs, yes, star, score: vs.reduce((a, b) => a + b, 0), chosen: yes >= need || star } }).sort((a, b) => b.score - a.score || bySort(a.id, b.id));
  const qChosen = new Set(acts.filter(r => r.chosen).map(r => SPOTS[r.id].q));
  return { acts, qChosen };
}
function computePlan() {
  const allDone = kindIds("act").length && TRAVELERS.every(n => doneV(everyone[n]));
  if (!allDone) { if (planResult) { planResult = null; renderDay() } return }
  const E = evaluate(), days = {}, extra = [];
  DAYS.forEach(d => days[d.key] = []);
  // Viertel mit gewählten Sehenswürdigkeiten auf Fr/Sa verteilen
  const dayQ = { fr: [], sa: [] };
  ["fr", "sa"].forEach(d => GEO_ORDER[d].forEach(q => { if (E.qChosen.has(q)) dayQ[d].push(q) }));
  QIDS().forEach(q => { const day = SPOTS[q].day; if (!E.qChosen.has(q) || day === "kad") return;
    if (day === "fr" || day === "sa") { if (!dayQ[day].includes(q)) dayQ[day].push(q) }
    else { const load = d => dayQ[d].reduce((a, x) => a + E.acts.filter(r => r.chosen && SPOTS[r.id].q === x).length, 0); dayQ[load("fr") <= load("sa") ? "fr" : "sa"].push(q) } });
  ["fr", "sa"].forEach(d => {
    let n = 0;
    dayQ[d].forEach((q, k) => {
      days[d].push({ id: q, quarter: true, pos: k * 100, t: k === 0 ? "Vormittag" : "" });
      E.acts.filter(r => r.chosen && SPOTS[r.id].q === q).sort((a, b) => bySort(a.id, b.id)).forEach((r, i) => {
        if (n++ >= ACT_MAX_DAY) extra.push(r); else days[d].push({ ...r, pos: k * 100 + 1 + i, t: "" });
      });
    });
    const half = days[d].find(x => x.quarter && x.pos >= 100); if (half) half.t = "Nachmittag";
  });
  // Sehenswürdigkeiten in Hotelnähe (Tag "kad"): Do-Abend / So-Morgen
  E.acts.filter(r => r.chosen && SPOTS[SPOTS[r.id].q]?.day === "kad").forEach((r, i) => days[i % 2 ? "do" : "so"].push({ ...r, pos: i % 2 ? 870 : 0, t: i % 2 ? "Abend" : "Morgen" }));
  // Restaurant-Ideen in der Nähe (ohne Swipen)
  const kadQ = QIDS().filter(q => SPOTS[q].day === "kad");
  const food = {}; DAYS.forEach(d => { const qs = d.key === "fr" || d.key === "sa" ? [...dayQ[d.key], ...kadQ] : kadQ; food[d.key] = kindIds("food").filter(id => qs.includes(SPOTS[id].q)).sort((x, y) => qs.indexOf(SPOTS[x].q) - qs.indexOf(SPOTS[y].q)) });
  DAYS.forEach(d => days[d.key].sort((a, b) => a.pos - b.pos));
  const titles = { fr: dayQ.fr.map(q => SPOTS[q].n).join(" · ") || "Freier Tag", sa: dayQ.sa.map(q => SPOTS[q].n).join(" · ") || "Freier Tag" };
  const before = JSON.stringify(planResult);
  planResult = { days, extra, titles, food };
  if (JSON.stringify(planResult) !== before) renderDay();
}
// ---------- Wegzeiten (Schätzung) ----------
const BOSPORUS = [[40.97, 28.995], [41.02, 29.005], [41.04, 29.015], [41.05, 29.035], [41.12, 29.065]];
function isAsia([lat, lng]) {
  for (let i = 0; i < BOSPORUS.length - 1; i++) { const [a1, o1] = BOSPORUS[i], [a2, o2] = BOSPORUS[i + 1];
    if (lat <= a2 || i === BOSPORUS.length - 2) return lng > o1 + (Math.max(a1, Math.min(lat, a2)) - a1) / (a2 - a1) * (o2 - o1) }
}
function km(a, b) { const R = 6371, r = x => x * Math.PI / 180, dLa = r(b[0] - a[0]), dLo = r(b[1] - a[1]);
  return 2 * R * Math.asin(Math.sqrt(Math.sin(dLa / 2) ** 2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(dLo / 2) ** 2)) }
function leg(a, b) {
  const d = km(a, b), cross = isAsia(a) !== isAsia(b), r5 = m => m < 10 ? Math.max(2, Math.round(m)) : Math.round(m / 5) * 5;
  if (d < 0.08) return null;
  if (!cross && d <= 1.6) return { icon: "🚶", text: `ca. ${r5(d * 1.25 / 4.5 * 60)} Min. zu Fuss (${d < 1 ? Math.round(d * 1.25 * 100) * 10 + " m" : (d * 1.25).toFixed(1) + " km"})`, mode: "walking" };
  if (cross) return { icon: "⛴️", text: `ca. ${r5(18 + d * 3.5)} Min. mit Fähre/Marmaray`, mode: "transit" };
  return { icon: "🚇", text: `ca. ${r5(8 + d * 4)} Min. mit Tram/Bus/Taxi`, mode: "transit" };
}
const legLink = (a, b, mode) => `https://www.google.com/maps/dir/?api=1&origin=${a[0]},${a[1]}&destination=${b[0]},${b[1]}&travelmode=${mode}`;

// ---------- Plan anzeigen ----------
let done = store.get("ist-done", {});
let curDay = (() => { const t = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Istanbul" }); const i = DAYS.findIndex(d => d.date === t); return i < 0 ? 1 : i })();
function dayStops(d) {
  const mid = planResult ? (planResult.days[d.key] || []).map(r => r.quarter
    ? { t: r.t, p: r.id, info: "🚶 Viertel erkunden: " + (SPOTS[r.id].d || ""), go: ROUTES[r.id]?.[0], quarter: true }
    : { t: r.t || "", p: r.id, info: (r.meal ? MEAL[r.meal] + " · " : "") + (SPOTS[r.id].d || "") + (SPOTS[r.id].note ? " · " + SPOTS[r.id].note : "") + (r.star ? " ⭐" : "") }) : [];
  const home = planResult && (d.key === "fr" || d.key === "sa") && mid.length ? [{ t: "Start", p: "hotel", info: "Los geht's ab Hotel" }] : [];
  return [...d.start, ...home, ...mid, ...d.end];
}
function renderTabs() { $("tabs").innerHTML = DAYS.map((d, i) => `<button class="tab ${i === curDay ? "on" : ""}" data-i="${i}">${d.tab}</button>`).join("") }
function renderDay() {
  const d = DAYS[curDay], stops = dayStops(d);
  const title = planResult?.titles?.[d.key] || d.title;
  const locked = !planResult ? `<div class="wtip" style="margin:10px 0">🔒 Das Programm entsteht, sobald ${TRAVELERS.join(", ")} geswipt haben. <a href="#swipe-card">Zum Swipen ↓</a></div>` : "";
  const extra = (planResult && curDay === DAYS.length - 1 && planResult.extra.length ? `<div class="wtip" style="margin-top:10px">✨ Wenn Zeit bleibt: ${planResult.extra.map(r => esc(SPOTS[r.id].n)).join(", ")}</div>` : "") +
    (planResult && planResult.food[d.key]?.length ? `<div class="wtip" style="margin-top:10px">🍽️ Essen in der Nähe: ${planResult.food[d.key].map(id => `<a href="#food-card" data-food="${esc(id)}">${esc(SPOTS[id].n)}</a>`).join(" · ")}</div>` : "");
  let prev = null;
  $("daypanel").innerHTML = `<p class="daytitle">${esc(title)}</p>${d.note ? `<p class="daynote">${d.note}</p>` : ""}` +
    stops.map(s => { const k = d.key + "-" + s.p + "-" + s.t, p = PLACES[s.p]; if (!p) return "";
      let between = "";
      if (planResult && prev && p.ll && prev.ll && s.p !== "saw" && prev.id !== "saw" && prev.id !== s.p) { const L2 = leg(prev.ll, p.ll);
        if (L2) between = `<div class="leg"><span>${L2.icon} ${L2.text}</span><a href="${legLink(prev.ll, p.ll, L2.mode)}" target="_blank" rel="noopener">genau ↗</a></div>` }
      if (p.ll) prev = { ll: p.ll, id: s.p };
      return between + `<div class="stop ${done[k] ? "done" : ""}${s.quarter ? " qstop" : ""}">
      <input type="checkbox" data-k="${esc(k)}" ${done[k] ? "checked" : ""} aria-label="erledigt">
      <div class="time">${esc(s.t)}</div>
      <div><div class="name" data-p="${esc(s.p)}">${esc(p.n)}</div><div class="info">${esc(s.info)}</div>
      ${s.go ? `<div class="go">🚋 ${esc(s.go)}</div>` : ""}${p.ll && s.p !== "saw" && !planResult ? `<div class="go"><a href="${route(p.ll)}" target="_blank" rel="noopener">🚇 Route mit ÖV ↗</a></div>` : ""}</div></div>` }).join("") + locked + extra;
  showDayOnMap(stops);
}
$("tabs").onclick = e => { const b = e.target.closest(".tab"); if (!b) return; curDay = +b.dataset.i; renderTabs(); renderDay() };
$("daypanel").onclick = e => {
  const cb = e.target.closest("input"); if (cb) { done[cb.dataset.k] = cb.checked; store.set("ist-done", done); renderDay(); return }
  const n = e.target.closest(".name"); if (n) focusPlace(n.dataset.p);
  const f = e.target.closest("[data-food]"); if (f) { e.preventDefault(); const el = $("food-" + f.dataset.food); openSec(el); if (el) { el.scrollIntoView({ behavior: "smooth", block: "center" }); el.classList.add("flash"); setTimeout(() => el.classList.remove("flash"), 1500) } }
};

// ---------- Swipen ----------
const swEl = $("swipe");
const ROUNDS = [["quarter", "🗺️ 1. Viertel swipen", "Wo wollen wir überhaupt hin?"], ["pick", "✨ 2. Was dort?", "Pro Viertel antippen, was ihr sehen & essen wollt"]];
let pickQ = null, pickSel = {}, pickInit = null;
function statusLine() {
  return TRAVELERS.map(n => { const ok = doneV(everyone[n]), [a, b] = progress(everyone[n]); return `<span style="white-space:nowrap">${ok ? "✅" : "⏳"} ${esc(n)}${ok ? "" : ` ${a}/${b}`}</span>` }).join(" &nbsp; ");
}
async function renderSwipe() {
  if (!me) return renderStart();
  if (!doneV(myVotes)) return renderStack();
  await pull(); renderResults();
}
async function renderStart() {
  await pull();
  swEl.innerHTML = `<div class="sw-center">
    <p>Swipe durch die <b>Sehenswürdigkeiten</b>: ❤️ will ich · ✕ eher nicht · ⭐ unbedingt.<br>Sobald alle drei fertig sind, erscheint oben euer Programm. Restaurant-Ideen findet ihr weiter unten.</p>
    <p style="font-weight:600;margin:14px 0 8px">Wer swipt?</p>
    <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">${TRAVELERS.map(n => `<button class="btn" data-me="${esc(n)}" style="min-width:90px">${esc(n)}</button>`).join("")}</div>
    <p class="daynote" style="margin-top:14px">${statusLine()}</p></div>`;
  swEl.querySelectorAll("[data-me]").forEach(b => b.onclick = () => {
    me = b.dataset.me; store.set("ist-me", me); renderPack();
    myVotes = { ...(everyone[me] || {}) }; store.set("ist-myvotes", myVotes); curCat = null; pickQ = null; introSeen = new Set(); renderSwipe();
  });
}
function renderCats() {
  const r1 = doneIds(myVotes, QIDS()), lq = likedQ(myVotes), dq = lq.filter(q => qDone(q, myVotes));
  const qDoneCnt = QIDS().filter(id => myVotes[id] !== undefined).length;
  swEl.innerHTML = `<div class="sw-center"><p class="sw-who">Hallo ${esc(me)}!</p>
    <div class="rounds">
      <button class="round ${r1 ? "ok" : ""}" data-cat="quarter"><b>${ROUNDS[0][1]}</b><span>${ROUNDS[0][2]}</span><span class="rs">${r1 ? "✅ fertig" : `${qDoneCnt}/${QIDS().length}`}</span></button>
      <button class="round ${r1 && dq.length === lq.length ? "ok" : ""}" data-cat="pick" ${r1 ? "" : "disabled"}><b>${ROUNDS[1][1]}</b><span>${ROUNDS[1][2]}</span><span class="rs">${!r1 ? "🔒 erst Runde 1" : dq.length === lq.length ? "✅ fertig" : `${dq.length}/${lq.length} Viertel`}</span></button>
    </div>
    ${r1 && dq.length ? `<p class="daynote" style="margin-top:12px">Nochmal ändern: ${dq.map(q => `<button class="btn ghost small" data-editq="${esc(q)}">✏️ ${esc(SPOTS[q].n)}</button>`).join(" ")}</p>` : ""}
    <p class="daynote" style="margin-top:14px">${statusLine()}</p>
    <button class="btn ghost small" id="sw-who">Nicht ${esc(me)}?</button></div>`;
  swEl.querySelectorAll("[data-cat]:not([disabled])").forEach(b => b.onclick = () => { curCat = b.dataset.cat; pickQ = null; renderSwipe() });
  swEl.querySelectorAll("[data-editq]").forEach(b => b.onclick = () => { curCat = "pick"; pickQ = b.dataset.editq; renderSwipe() });
  $("sw-who").onclick = switchUser;
}
function renderPick() {
  const lq = likedQ(myVotes);
  const q = pickQ || lq.find(x => !qDone(x, myVotes)); if (!q) { curCat = null; pickQ = null; return renderSwipe() }
  if (pickInit !== q) { pickSel = {}; qSpots(q).forEach(id => { if ((myVotes[id] ?? 0) > 0) pickSel[id] = myVotes[id] }); pickInit = q }
  pickQ = q;
  const s = SPOTS[q], idx = lq.indexOf(q) + 1;
  const tile = id => { const p = SPOTS[id], v = pickSel[id] || 0, im = p.img;
    return `<button class="tile ${v ? "sel" : ""} ${v === 2 ? "star" : ""}" data-t="${esc(id)}">
      <div class="tile-img" style="${im ? `background-image:url('${esc(im[0])}')` : `background:${p.kind === "food" ? "#c8553d" : "#1d5c7a"}`}">${im && im[4] === "ex" ? '<span class="ex">Beispielbild</span>' : ""}<span class="tile-v">${v === 2 ? "⭐" : v ? "❤️" : "＋"}</span></div>
      <div class="tile-b"><span class="tile-k">${p.kind === "food" ? "🍽️ " + (p.meals || []).map(m => MEAL[m]).join(" / ") : "🎯 Sehenswert"}</span><b>${esc(p.n)}</b><span>${esc(p.d)}</span>${p.note ? `<span class="muted">ℹ️ ${esc(p.note)}</span>` : ""}</div></button>` };
  const acts = qSpots(q).filter(id => SPOTS[id].kind === "act"), food = qSpots(q).filter(id => SPOTS[id].kind === "food");
  swEl.innerHTML = `<div class="sw-who">${esc(me)} · Viertel ${idx}/${lq.length}</div>
    <div class="pick-head" style="${s.img ? `background-image:linear-gradient(180deg,rgba(15,42,67,.15),rgba(15,42,67,.85)),url('${esc(s.img[0])}')` : "background:#7b4fa0"}"><span class="intro-k">Was wollt ihr in</span><h3>${esc(s.n)}</h3><p>${esc(s.d)}</p></div>
    <p class="daynote" style="text-align:center;margin:10px 0">Antippen: einmal ❤️ · zweimal ⭐ unbedingt · dreimal wieder weg</p>
    ${acts.length ? `<h4 class="pick-h">🎯 Sehen & machen</h4><div class="tiles">${acts.map(tile).join("")}</div>` : ""}
    ${food.length ? `<h4 class="pick-h">🍽️ Essen & Drinks</h4><div class="tiles">${food.map(tile).join("")}</div>` : ""}
    <div class="sw-center" style="margin-top:14px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
      <button class="btn" id="pick-ok">${Object.keys(pickSel).length ? `${Object.keys(pickSel).length} ausgewählt · weiter →` : "Nichts davon · weiter →"}</button>
      <button class="btn ghost" id="pick-back">Zurück zur Übersicht</button></div>`;
  swEl.querySelectorAll("[data-t]").forEach(b => b.onclick = () => { const id = b.dataset.t, v = pickSel[id] || 0; if (v === 2) delete pickSel[id]; else pickSel[id] = v + 1; renderPick() });
  $("pick-ok").onclick = () => { qSpots(q).forEach(id => myVotes[id] = pickSel[id] || 0); push(); pickQ = null; pickSel = {}; pickInit = null; swEl.scrollIntoView({ behavior: "smooth", block: "start" }); renderSwipe() };
  $("pick-back").onclick = () => { pickQ = null; pickSel = {}; pickInit = null; curCat = null; renderSwipe() };
}
function cardHtml(id, back) {
  const s = SPOTS[id], im = s.img, quarter = s.kind === "quarter";
  const bg = im ? `background:linear-gradient(180deg,rgba(15,42,67,0) 22%,rgba(15,42,67,.94) 70%),url('${esc(im[0])}') center/cover,#0f2a43` : `background:linear-gradient(160deg,${s.kind === "food" ? "#c8553d" : quarter ? "#7b4fa0" : "#1d5c7a"},#0f2a43)`;
  const chips = `<div class="sw-chips">${s.vibe ? `<span>${VIBE[s.vibe] || esc(s.vibe)}</span>` : ""}${s.dist ? `<span>🏨 ${esc(s.dist)}</span>` : ""}${s.meals ? `<span>${s.meals.map(m => MEAL[m]).join(" / ")}</span>` : ""}</div>`;
  return `<div class="sw-card${back ? " back" : ""}${quarter ? " qcard" : ""}" data-id="${esc(id)}" style="${bg}">
    ${im ? "" : `<div class="sw-emoji">${s.kind === "food" ? "🍽️" : "📍"}</div><a class="sw-gmaps big" href="${gmaps(s.n)}" target="_blank" rel="noopener">📸 Fotos auf Google Maps ansehen</a>`}<div class="stamp"></div>
    ${!quarter && s.q ? `<div class="sw-q">📍 ${esc(qName(id))}</div>` : ""}
    <h3>${esc(s.n)}</h3><p>${esc(s.d)}</p>${chips}
    ${quarter && s.tip ? `<p class="sw-tip">💡 ${esc(s.tip)}</p>` : ""}${!quarter && s.note ? `<p class="sw-tip">ℹ️ ${esc(s.note)}</p>` : ""}
    ${im ? `<a class="sw-gmaps" href="${gmaps(s.n)}" target="_blank" rel="noopener">📸 Mehr Fotos</a>` : ""}
    ${im && im[4] === "ex" ? '<span class="ex ex-card">Beispielbild</span>' : ""}${im && im[2] ? `<a class="sw-credit" href="${esc(im[1] || im[0])}" target="_blank" rel="noopener">📷 ${esc(im[2])}${im[3] ? " · " + esc(im[3]) : ""}</a>` : ""}</div>`;
}
function renderIntro(q, count) {
  const s = SPOTS[q], im = s.img;
  swEl.innerHTML = `<div class="sw-who">${esc(me)} · ${ROUNDS.find(r => r[0] === curCat)[1]}</div>
    <div class="intro" style="${im ? `background:linear-gradient(180deg,rgba(15,42,67,.1),rgba(15,42,67,.9)),url('${esc(im[0])}') center/cover` : "background:#7b4fa0"}">
      <span class="intro-k">Jetzt im Viertel</span><h3>${esc(s.n)}</h3><p>${esc(s.d)}</p>
      <div class="sw-chips"><span>🏨 ${esc(s.dist || "")}</span><span>${VIBE[s.vibe] || ""}</span></div>
      <button class="btn" id="intro-go" style="margin-top:14px;background:#fff;color:var(--navy)">${count} ${curCat === "food" ? (count === 1 ? "Lokal" : "Lokale") : (count === 1 ? "Ort" : "Orte")} swipen →</button></div>
    <div class="sw-center"><button class="btn ghost small" id="sw-back">Runde wechseln</button></div>`;
  $("intro-go").onclick = () => { introSeen.add(curCat + q); renderStack() };
  $("sw-back").onclick = () => { curCat = null; renderSwipe() };
}
function renderStack() {
  const ids = kindIds("act"), todo = ids.filter(id => myVotes[id] === undefined);
  if (!todo.length) return renderSwipe();
  const pct = Math.round((ids.length - todo.length) / ids.length * 100);
  swEl.innerHTML = `<div class="sw-who">${esc(me)} · 🎯 Sehenswürdigkeiten · ${ids.length - todo.length + 1}/${ids.length}</div>
    <div class="sw-progress"><div style="width:${pct}%"></div></div>
    <div class="stack tall">${todo[1] ? cardHtml(todo[1], true) : ""}${cardHtml(todo[0])}</div>
    <div class="sw-btns"><button class="sw-btn" data-v="0" aria-label="Nein">✕</button><button class="sw-btn star" data-v="2" aria-label="Unbedingt">⭐</button><button class="sw-btn" data-v="1" aria-label="Ja">❤️</button></div>
    <div class="sw-center"><button class="btn ghost small" id="sw-undo">↩︎ Zurück</button> <button class="btn ghost small" id="sw-who">Nicht ${esc(me)}?</button></div>`;
  const top = swEl.querySelector(".stack .sw-card:last-child"), stamp = top.querySelector(".stamp");
  top.querySelectorAll("a").forEach(a => a.addEventListener("pointerdown", e => e.stopPropagation()));
  const vote = v => { top.style.transform = v === 2 ? "translateY(-600px)" : `translateX(${v ? 600 : -600}px) rotate(${v ? 25 : -25}deg)`; myVotes[top.dataset.id] = v; push(); setTimeout(renderSwipe, 220) };
  swEl.querySelectorAll(".sw-btn").forEach(b => b.onclick = () => vote(+b.dataset.v));
  $("sw-undo").onclick = () => { const d = ids.filter(id => myVotes[id] !== undefined); if (d.length) { delete myVotes[d[d.length - 1]]; push(); renderStack() } };
  $("sw-who").onclick = switchUser;
  let x0 = null, y0 = 0;
  top.addEventListener("pointerdown", e => { x0 = e.clientX; y0 = e.clientY; top.classList.add("drag"); top.setPointerCapture(e.pointerId) });
  top.addEventListener("pointermove", e => { if (x0 === null) return; const dx = e.clientX - x0, dy = Math.min(0, e.clientY - y0);
    top.style.transform = `translate(${dx}px,${dy}px) rotate(${dx / 15}deg)`;
    const up = dy < -80 && Math.abs(dx) < 80; stamp.textContent = up ? "UNBEDINGT" : dx > 0 ? "JA" : "NEIN"; stamp.style.opacity = up ? Math.min(1, -dy / 120) : Math.min(1, Math.abs(dx) / 100) });
  const end = e => { if (x0 === null) return; const dx = e.clientX - x0, dy = e.clientY - y0; x0 = null; top.classList.remove("drag");
    if (dy < -110 && Math.abs(dx) < 80) vote(2); else if (dx > 100) vote(1); else if (dx < -100) vote(0); else { top.style.transform = ""; stamp.style.opacity = 0 } };
  top.addEventListener("pointerup", end); top.addEventListener("pointercancel", end);
}
function switchUser() { me = ""; myVotes = {}; curCat = null; introSeen = new Set(); store.set("ist-me", ""); store.set("ist-myvotes", {}); renderSwipe(); renderPack() }
function renderResults() {
  const allDone = TRAVELERS.every(n => doneV(everyone[n]));
  const icon = v => v === 2 ? "⭐" : v === 1 ? "❤️" : "✕";
  let body = "";
  if (allDone) {
    const E = evaluate();
    body = `<p class="daytitle">🎉 Alle haben geswipt! Euer Programm steht oben im Plan.</p>` + QIDS().map(q => { const a = E.acts.filter(r => SPOTS[r.id].q === q);
      return a.length ? `<div class="res-group"><h3>📍 ${esc(SPOTS[q].n)}</h3>${a.map(r => `<div class="res-item"><span>${r.chosen ? "✅" : "▫️"} <span class="pn" data-p="${esc(r.id)}">${esc(SPOTS[r.id].n)}</span></span><span class="votes">${r.vs.map((v, i) => `${esc(TRAVELERS[i])} ${icon(v)}`).join(" · ")}</span></div>`).join("")}</div>` : "" }).join("");
  } else body = `<div class="sw-center"><p style="font-size:1.1rem">✅ Danke ${esc(me)}, du bist fertig!</p><p>Sobald alle drei durch sind, erscheint oben euer Programm. Diese Seite aktualisiert sich von selbst.</p></div>`;
  swEl.innerHTML = `<p class="daynote" style="text-align:center">${statusLine()}</p>` + body +
    `<div class="sw-center" style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:14px">
      ${allDone ? '<button class="btn" id="sw-plan">📅 Zum Plan</button>' : ""}
      <button class="btn ghost" id="sw-redo">Meine Swipes neu machen</button><button class="btn ghost" id="sw-who2">Andere Person</button></div>`;
  swEl.querySelectorAll(".pn").forEach(e => e.onclick = () => focusPlace(e.dataset.p));
  if ($("sw-plan")) $("sw-plan").onclick = () => { curDay = 1; renderTabs(); renderDay(); $("tabs").scrollIntoView({ behavior: "smooth", block: "start" }) };
  $("sw-redo").onclick = () => { if (confirm("Deine Swipes zurücksetzen und neu swipen?")) { myVotes = {}; push(); computePlan(); renderSwipe() } };
  $("sw-who2").onclick = switchUser;
}

// ---------- Restaurant-Ideen (ohne Swipen) ----------
function renderFood() {
  $("food").innerHTML = QIDS().map(q => { const f = kindIds("food").filter(id => SPOTS[id].q === q); if (!f.length) return "";
    return `<h3 class="food-q">📍 ${esc(SPOTS[q].n)}</h3><div class="food-grid">${f.map(id => { const s = SPOTS[id], im = s.img;
      return `<div class="food-item" id="food-${esc(id)}"><div class="food-img" style="${im ? `background-image:url('${esc(im[0])}')` : "background:#c8553d"}">${im && im[4] === "ex" ? '<span class="ex">Beispielbild</span>' : ""}</div>
        <div class="food-b"><b>${esc(s.n)}</b><span>${esc(s.d)}</span><span class="tile-k">${(s.meals || []).map(m => MEAL[m]).join(" · ")}${s.vibe ? " · " + (VIBE[s.vibe] || "") : ""}</span>${s.note ? `<span class="muted">ℹ️ ${esc(s.note)}</span>` : ""}
        <span class="food-l"><a href="${gmaps(s.n)}" target="_blank" rel="noopener">📸 Google Maps</a>${s.ll ? ` · <a href="${route(s.ll)}" target="_blank" rel="noopener">🚇 Route</a>` : ""}</span></div></div>` }).join("")}</div>` }).join("");
}
// ---------- Lieblingsorte ----------
let favs = store.get("ist-favs", []), filter = "all";
function renderFilters() {
  const opts = [["all", "Alle"], ["fav", "❤️ Favoriten"], ["quarter", "🗺️ Viertel"], ["act", "🎯 Sehenswertes"], ["food", "🍽️ Essen"]];
  $("filters").innerHTML = opts.map(([k, l]) => `<button class="tab ${filter === k ? "on" : ""}" data-f="${k}">${l}</button>`).join("");
}
function renderPlaces() {
  const list = Object.entries(SPOTS).filter(([id, s]) => filter === "all" || (filter === "fav" ? favs.includes(id) : s.kind === filter)).sort((a, b) => (a[1].sort || 0) - (b[1].sort || 0));
  $("places").innerHTML = list.length ? list.map(([id, s]) => `<div class="place">${s.img ? `<img src="${esc(s.img[0])}" alt="" loading="lazy" style="width:64px;height:64px;object-fit:cover;border-radius:10px;flex:none">` : ""}
    <div class="body"><div class="pn" data-p="${esc(id)}">${esc(s.n)}</div><div class="pd">${esc(s.d)}</div><span class="tag" style="--c:${colorOf(id)}">${s.kind === "quarter" ? "Viertel" : s.kind === "food" ? "Essen & Drinks" : "Sehenswert"}${s.q ? " · " + esc(qName(id)) : ""}</span></div>
    <button class="heart" data-h="${esc(id)}" aria-label="Favorit">${favs.includes(id) ? "❤️" : "🤍"}</button></div>`).join("")
    : `<div class="empty">Noch keine Favoriten. Tippe bei „Alle“ auf ein Herz 🤍</div>`;
}
$("filters").onclick = e => { const b = e.target.closest(".tab"); if (!b) return; filter = b.dataset.f; renderFilters(); renderPlaces() };
$("places").onclick = e => {
  const h = e.target.closest(".heart"); if (h) { const id = h.dataset.h; favs = favs.includes(id) ? favs.filter(x => x !== id) : [...favs, id]; store.set("ist-favs", favs); renderPlaces(); return }
  const n = e.target.closest(".pn"); if (n) focusPlace(n.dataset.p);
};

// ---------- Tipps & So kommt ihr hin (aus den Vierteln) ----------
function renderTips() {
  const qs = QIDS().map(id => SPOTS[id]).filter(s => s.tip);
  const notes = Object.values(SPOTS).filter(s => s.kind !== "quarter" && s.note);
  const general = [["🧕 Moscheen", "Kopftuch oder Schal, Schultern und Knie bedeckt. Freitags erst nach dem Mittagsgebet."], ["☔ Bei Regen", "Basilika-Zisterne, Topkapı, Basare und Eirene Tower sind drinnen."], ["💵 Bezahlen", "Karte geht fast überall, für kleine Lokale und Stände etwas Bargeld dabeihaben."]];
  $("tips").innerHTML = qs.map(s => `<div class="route"><b>🗺️ ${esc(s.n)}</b>${esc(s.tip)}</div>`).join("") +
    notes.map(s => `<div class="route"><b>${s.kind === "food" ? "🍽️" : "🎯"} ${esc(s.n)}</b>${esc(s.note)}</div>`).join("") +
    general.map(([t, x]) => `<div class="route"><b>${t}</b>${x}</div>`).join("");
}
function renderRoutes() {
  $("routes").innerHTML = QIDS().map(id => { const s = SPOTS[id]; return `<div class="route"><b>${esc(s.n)}</b><div class="muted">🏨 ${esc(s.dist || "")} · ${esc(s.go || "")}</div>
    ${(ROUTES[id] || []).map(x => `<div style="margin-top:3px">${x}</div>`).join("")}<div style="margin-top:4px"><a href="${route(s.ll || [41, 29])}" target="_blank" rel="noopener">🚇 Route in Google Maps ↗</a></div></div>` }).join("") +
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
  $("phrases").innerHTML = PHRASES.map(([g, list], i) => `<details class="phr-g" ${i < 2 ? "open" : ""}><summary>${g} <span class="muted">(${list.length})</span></summary>
    <div class="phr-list">${list.map(([de, tr, pr]) => `<div class="phr2"><span class="tr">${esc(tr)}</span><span class="meta">${esc(de)} · <i>${esc(pr)}</i></span>${canSpeak ? `<button class="say2" data-say="${esc(tr.replace(/…/g, ""))}" aria-label="Anhören">🔊</button>` : ""}</div>`).join("")}</div></details>`).join("");
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

// ---------- Ideen & Kommentare ----------
let IDEAS = [];
async function loadIdeas() { if (!db) return; const { data, error } = await db.from("ideas").select("id,name,text,created_at").eq("trip", TRIP).order("created_at", { ascending: false }); if (!error) { IDEAS = data; renderIdeas() } }
function renderIdeas() {
  const who = me || store.get("ist-idea-name", "");
  const isAdm = !!admPw;
  $("ideas").innerHTML = `<div class="idea-form">
      <select id="idea-name">${TRAVELERS.map(n => `<option ${n === who ? "selected" : ""}>${esc(n)}</option>`).join("")}</select>
      <textarea id="idea-text" rows="2" maxlength="600" placeholder="Idee, Wunsch oder Kommentar …"></textarea>
      <button class="btn" id="idea-send">Posten</button></div>
    <div class="idea-list">${IDEAS.length ? IDEAS.map(i => `<div class="idea"><div class="idea-h"><b>${esc(i.name)}</b><span class="muted">${new Date(i.created_at).toLocaleString("de-CH", { weekday: "short", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" })}</span>${isAdm ? `<button class="idea-del" data-del-idea="${i.id}" title="Löschen (Admin)">🗑️</button>` : ""}</div><div>${esc(i.text).replace(/\n/g, "<br>")}</div></div>`).join("") : '<p class="muted">Noch nichts gepostet.</p>'}</div>`;
  $("idea-send").onclick = async () => {
    const name = $("idea-name").value, text = $("idea-text").value.trim(); if (!text) return $("idea-text").focus();
    store.set("ist-idea-name", name); $("idea-send").disabled = true;
    const { error } = await db.from("ideas").insert({ trip: TRIP, name, text });
    if (error) { alert("Konnte nicht speichern: " + error.message); $("idea-send").disabled = false; return }
    await loadIdeas();
  };
  $("ideas").querySelectorAll("[data-del-idea]").forEach(b => b.onclick = async () => { if (!confirm("Diesen Beitrag löschen?")) return; try { await rpc("admin_delete_idea", { iid: +b.dataset.delIdea }); loadIdeas() } catch (e) { alert(e.message) } });
}

function renderAdmIdeas() {
  const el = $("adm-ideas"); if (!el) return;
  el.innerHTML = IDEAS.length ? IDEAS.map(i => `<div class="adm-row"><div style="flex:1;min-width:0"><b>${esc(i.name)}</b> <span class="muted">${new Date(i.created_at).toLocaleString("de-CH", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" })}</span><div style="font-size:.85rem">${esc(i.text)}</div></div>
    <button class="btn ghost small" data-adm-idea="${i.id}">🗑️</button></div>`).join("") + `<p style="margin-top:8px"><button class="btn ghost small" id="adm-ideas-all" style="color:var(--terra)">Alle Kommentare löschen</button></p>` : '<p class="muted">Noch keine Kommentare.</p>';
  el.querySelectorAll("[data-adm-idea]").forEach(b => b.onclick = async () => { if (!confirm("Diesen Kommentar löschen?")) return; try { await rpc("admin_delete_idea", { iid: +b.dataset.admIdea }); await loadIdeas(); renderAdmIdeas() } catch (e) { alert(e.message) } });
  if ($("adm-ideas-all")) $("adm-ideas-all").onclick = async () => { if (!confirm(`Alle ${IDEAS.length} Kommentare löschen?`)) return; try { for (const i of IDEAS) await rpc("admin_delete_idea", { iid: i.id }); await loadIdeas(); renderAdmIdeas() } catch (e) { alert(e.message) } };
}

// ---------- Notfall / Taxi-Karte ----------
$("taxi-full").onclick = () => {
  const d = document.createElement("div"); d.className = "taxi-full";
  d.innerHTML = `<p class="nf-tr">Beni bu adrese götürür müsünüz?</p><p class="nf-addr">Otel Kadıköy<br>Uzun Hafız Sokak No: 18<br>Osmanağa, Kadıköy / İstanbul</p><p class="muted">Antippen zum Schliessen</p>`;
  d.onclick = () => d.remove(); document.body.appendChild(d);
};
$("taxi-copy").onclick = async () => { try { await navigator.clipboard.writeText("Otel Kadıköy, Uzun Hafız Sokak No: 18, Osmanağa, Kadıköy / İstanbul"); $("taxi-copy").textContent = "✅ Kopiert" } catch (e) { $("taxi-copy").textContent = "Kopieren ging nicht" } setTimeout(() => $("taxi-copy").textContent = "📋 Adresse kopieren", 2500) };

// ---------- Admin ----------
let admPw = (() => { try { return sessionStorage.getItem("ist-adm") || "" } catch (e) { return "" } })();
let editId = null, edImg = null;
const admEl = $("admin");
const packToText = () => PACK.map(([g, items]) => "# " + g + "\n" + items.join("\n")).join("\n\n");
const textToPack = t => { const out = []; let cur = null; t.split("\n").map(l => l.trim()).filter(Boolean).forEach(l => { if (l.startsWith("#")) { cur = [l.replace(/^#+\s*/, ""), []]; out.push(cur) } else { if (!cur) { cur = ["Sonstiges", []]; out.push(cur) } cur[1].push(l) } }); return out.filter(g => g[1].length) };
async function rpc(fn, args) { const { data, error } = await db.rpc(fn, { pw: admPw, ...args }); if (error) throw new Error(error.message); return data }
async function ensureSeeded() {
  if (SPOTS_FROM_DB) return;
  const { data } = await db.from("places").select("id").eq("trip", TRIP);
  for (const r of data || []) await rpc("admin_delete_place", { pid: r.id }); // alte Liste ohne Viertel entfernen
  for (const [id, s] of Object.entries(SPOTS)) { const { sort, ...d } = s; await rpc("admin_upsert_place", { pid: id, d, s: sort || 0 }) }
  SPOTS_FROM_DB = true;
}
async function refreshEverything() { await loadSpots(); renderMarkers(); renderPlaces(); renderTips(); renderRoutes(); renderFood(); await pull(); renderDay(); renderSwipe() }
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
    if (!who || who === me) { myVotes = {}; store.set("ist-myvotes", {}); store.set("ist-pushed", false); curCat = null; introSeen = new Set() }
    everyone = {}; await pull(); renderSwipe(); admRender();
  });
  renderAdmSpots(); await loadIdeas(); renderAdmIdeas();
  const ta = $("adm-pack"); if (!ta.dataset.loaded) { ta.value = packToText(); ta.dataset.loaded = "1" }
}
function renderAdmSpots() {
  const row = id => { const s = SPOTS[id]; return `<div class="adm-row${s.kind === "quarter" ? " adm-q" : ""}">${s.img ? `<img src="${esc(s.img[0])}" alt="">` : `<span class="adm-noimg">${s.kind === "food" ? "🍽️" : s.kind === "quarter" ? "🗺️" : "📍"}</span>`}
    <div style="flex:1;min-width:0"><b>${esc(s.n)}</b><div class="muted">${s.kind === "quarter" ? "Viertel · " + (DAYNAME[s.day] || "") : (s.kind === "food" ? "🍽️ " + (s.meals || []).map(m => MEAL[m]).join(", ") : "🎯 Sehenswert")}</div></div>
    <button class="btn ghost small" data-edit="${esc(id)}">✏️</button><button class="btn ghost small" data-del="${esc(id)}">🗑️</button></div>` };
  $("adm-spots").innerHTML = `<p class="muted">${QIDS().length} Viertel · ${kindIds("act").length} Sehenswertes · ${kindIds("food").length} Essen${SPOTS_FROM_DB ? "" : " · (Startliste aus deiner Checkliste, wird beim ersten Speichern übernommen)"}</p>` +
    QIDS().map(q => row(q) + `<div class="adm-sub">${[...kindIds("act"), ...kindIds("food")].filter(id => SPOTS[id].q === q).map(row).join("") || '<p class="muted" style="margin:4px 0">Noch keine Orte</p>'}</div>`).join("");
  $("adm-spots").querySelectorAll("[data-edit]").forEach(b => b.onclick = () => openEditor(b.dataset.edit));
  $("adm-spots").querySelectorAll("[data-del]").forEach(b => b.onclick = async () => {
    const id = b.dataset.del, kids = Object.keys(SPOTS).filter(x => SPOTS[x].q === id);
    if (!confirm(`„${SPOTS[id].n}“ löschen?${kids.length ? ` Die ${kids.length} Orte darin werden auch gelöscht.` : ""}`)) return;
    try { await ensureSeeded(); for (const k of kids) await rpc("admin_delete_place", { pid: k }); await rpc("admin_delete_place", { pid: id }) } catch (e) { return alert("Fehler: " + e.message) }
    await refreshEverything(); renderAdmSpots();
  });
}
function openEditor(id, kind) {
  editId = id; const s = id ? SPOTS[id] : { n: "", d: "", kind: kind || "act", q: QIDS()[0], day: "fr", vibe: "Gemischt", meals: [], ll: null, img: null, tip: "", go: "", note: "", dist: "" };
  $("ed").style.display = ""; $("ed-title").textContent = id ? "Bearbeiten" : "Neu";
  $("ed-kind").value = s.kind; $("ed-n").value = s.n; $("ed-d").value = s.d || "";
  $("ed-q").innerHTML = QIDS().map(q => `<option value="${esc(q)}">${esc(SPOTS[q].n)}</option>`).join(""); if (s.q) $("ed-q").value = s.q;
  $("ed-day").value = s.day || "fr"; $("ed-vibe").value = s.vibe || "Gemischt"; $("ed-dist").value = s.dist || "";
  document.querySelectorAll("[data-meal]").forEach(c => c.checked = (s.meals || []).includes(c.dataset.meal));
  $("ed-tip").value = s.kind === "quarter" ? (s.tip || "") : (s.note || ""); $("ed-go").value = s.go || "";
  $("ed-lat").value = s.ll ? s.ll[0] : ""; $("ed-lng").value = s.ll ? s.ll[1] : "";
  setEdImg(s.img); $("ed-geo-res").innerHTML = ""; $("ed-img-res").innerHTML = ""; $("ed-msg").textContent = "";
  edKind(); $("ed").scrollIntoView({ behavior: "smooth", block: "start" });
}
function setEdImg(im) { edImg = im; $("ed-img-prev").innerHTML = im ? `<img src="${esc(im[0])}" style="width:120px;height:80px;object-fit:cover;border-radius:8px"> <span class="muted">${esc(im[2] || "")} ${esc(im[3] || "")}</span> <button class="btn ghost small" id="ed-img-x">Foto entfernen</button>` : `<span class="muted">Kein Foto</span>`; if (im) $("ed-img-x").onclick = () => setEdImg(null) }
function edKind() {
  const k = $("ed-kind").value, q = k === "quarter";
  $("ed-qwrap").style.display = q ? "none" : ""; $("ed-daywrap").style.display = q ? "" : "none"; $("ed-meals").style.display = k === "food" ? "" : "none";
  $("ed-gowrap").style.display = q ? "" : "none"; $("ed-tiplabel").firstChild.textContent = q ? "💡 Tipp zum Viertel" : "ℹ️ Hinweis (Öffnungszeiten, Reservation …)";
}
async function geoSearch() {
  const q = $("ed-n").value.trim(); if (!q) return;
  $("ed-geo-res").innerHTML = '<span class="muted">Suche…</span>';
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=5&viewbox=28.5,41.3,29.5,40.8&bounded=1&q=${encodeURIComponent(q)}`).then(r => r.json());
    $("ed-geo-res").innerHTML = r.length ? r.map((x, i) => `<button class="btn ghost small" data-geo="${i}" style="text-align:left;margin:2px 0">📍 ${esc(x.display_name.split(",").slice(0, 3).join(","))}</button>`).join("<br>") : '<span class="muted">Nichts gefunden. Probier einen Google-Maps-Link.</span>';
    $("ed-geo-res").querySelectorAll("[data-geo]").forEach(b => b.onclick = () => { const x = r[+b.dataset.geo]; $("ed-lat").value = (+x.lat).toFixed(5); $("ed-lng").value = (+x.lon).toFixed(5); $("ed-geo-res").innerHTML = "✅ Position übernommen" });
  } catch (e) { $("ed-geo-res").innerHTML = '<span class="muted">Suche gerade nicht möglich.</span>' }
}
function parseGmaps() {
  const t = $("ed-gm").value; const m = t.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) || t.match(/[?&](?:q|query|destination|ll)=(-?\d+\.\d+)(?:,|%2C)(-?\d+\.\d+)/) || t.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (m) { $("ed-lat").value = (+m[1]).toFixed(5); $("ed-lng").value = (+m[2]).toFixed(5); $("ed-geo-res").innerHTML = "✅ Position aus dem Link übernommen" }
  else $("ed-geo-res").innerHTML = '<span class="muted">Im Link keine Koordinaten gefunden. In Google Maps den Ort öffnen und den Link mit „@41.0…,28.9…“ kopieren.</span>';
}
async function imgSearch() {
  const q = $("ed-n").value.trim(); if (!q) return;
  $("ed-img-res").innerHTML = '<span class="muted">Suche freie Fotos…</span>';
  try {
    const r = await fetch(`https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(q + " filetype:bitmap")}&gsrnamespace=6&gsrlimit=12&prop=imageinfo&iiprop=url|extmetadata&iiextmetadatafilter=Artist|LicenseShortName&iiurlwidth=960&format=json&origin=*`).then(r => r.json());
    const L2 = Object.values(r.query?.pages || {}).filter(p => p.imageinfo).map(p => [p.imageinfo[0].thumburl.split("?")[0], p.imageinfo[0].descriptionurl, (p.imageinfo[0].extmetadata?.Artist?.value || "").replace(/<[^>]+>/g, "").trim().slice(0, 50), p.imageinfo[0].extmetadata?.LicenseShortName?.value || ""]);
    $("ed-img-res").innerHTML = L2.length ? `<p class="muted">Tippe auf ein Foto, das wirklich diesen Ort zeigt:</p><div style="display:flex;gap:6px;flex-wrap:wrap">${L2.map((x, i) => `<img src="${esc(x[0])}" data-pick="${i}" style="width:110px;height:80px;object-fit:cover;border-radius:8px;cursor:pointer">`).join("")}</div>` : '<span class="muted">Keine freien Fotos gefunden.</span>';
    $("ed-img-res").querySelectorAll("[data-pick]").forEach(im => im.onclick = () => { setEdImg(L2[+im.dataset.pick]); $("ed-img-res").innerHTML = "✅ Foto übernommen" });
  } catch (e) { $("ed-img-res").innerHTML = '<span class="muted">Suche gerade nicht möglich.</span>' }
}
async function saveSpot() {
  const n = $("ed-n").value.trim(); if (!n) return $("ed-msg").textContent = "❌ Name fehlt";
  const kind = $("ed-kind").value, lat = parseFloat($("ed-lat").value), lng = parseFloat($("ed-lng").value);
  const meals = [...document.querySelectorAll("[data-meal]")].filter(c => c.checked).map(c => c.dataset.meal);
  if (kind === "food" && !meals.length) return $("ed-msg").textContent = "❌ Mindestens eine Mahlzeit wählen";
  const url = $("ed-imgurl").value.trim(); if (url) setEdImg([url, url, "", ""]);
  const d = { kind, n, d: $("ed-d").value.trim(), vibe: $("ed-vibe").value, dist: $("ed-dist").value.trim(), ll: isFinite(lat) && isFinite(lng) ? [lat, lng] : null, img: edImg };
  if (kind === "quarter") Object.assign(d, { day: $("ed-day").value, tip: $("ed-tip").value.trim(), go: $("ed-go").value.trim() });
  else Object.assign(d, { q: $("ed-q").value, note: $("ed-tip").value.trim(), tip: "", go: "" }, kind === "food" ? { meals } : {});
  const slug = (kind === "quarter" ? "q_" : "") + (n.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ı/g, "i").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 36) || "ort");
  const id = editId || slug + "-" + Date.now().toString(36).slice(-4);
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
$("adm-prompt").onclick = () => { const p = prompt("Admin-Passwort"); if (p) { $("adm-pw").value = p; $("adm-go").click() } };
$("adm-savepack").onclick = async () => {
  const g = textToPack($("adm-pack").value);
  try { await rpc("admin_set_pack", { g }); $("adm-packmsg").textContent = "✅ Gespeichert, alle sehen die neue Liste"; PACK = g; renderPack() } catch (e) { $("adm-packmsg").textContent = "❌ " + e.message }
};
$("adm-close").onclick = () => { history.replaceState(null, "", location.pathname); admRender() };
$("adm-out").onclick = () => { admPw = ""; try { sessionStorage.removeItem("ist-adm") } catch (e) {} history.replaceState(null, "", location.pathname); admRender() };
$("adm-new").onclick = () => openEditor(null, "act");
$("adm-newq").onclick = () => openEditor(null, "quarter");
$("ed-kind").onchange = edKind;
$("ed-geo").onclick = geoSearch; $("ed-gm-go").onclick = parseGmaps; $("ed-img").onclick = imgSearch;
$("ed-save").onclick = saveSpot; $("ed-cancel").onclick = () => { $("ed").style.display = "none" };
window.addEventListener("hashchange", admRender);

// ---------- Bereiche ein-/ausklappen ----------
(() => {
  const open = store.get("ist-open", []);
  document.querySelectorAll("main > section.card").forEach((sec, i) => {
    const h2 = sec.querySelector(":scope > h2"); if (!h2) return;
    const key = sec.id || "sec" + i, body = document.createElement("div"); body.className = "card-body";
    while (h2.nextSibling) body.appendChild(h2.nextSibling);
    sec.appendChild(body);
    if (!open.includes(key)) sec.classList.add("collapsed");
    h2.onclick = () => {
      sec.classList.toggle("collapsed");
      const now = store.get("ist-open", []).filter(k => k !== key); if (!sec.classList.contains("collapsed")) now.push(key); store.set("ist-open", now);
      if (!sec.classList.contains("collapsed") && sec.querySelector("#map")) setTimeout(() => map.invalidateSize(), 50);
    };
  });
})();

document.addEventListener("click", e => { const a = e.target.closest('a[href^="#"]'); if (!a || a.getAttribute("href") === "#admin") return; const t = document.querySelector(a.getAttribute("href")); if (t && t.classList.contains("collapsed")) t.querySelector(":scope > h2").click() }, true);

// ---------- Start ----------
async function refreshAll() { if (document.visibilityState !== "visible") return; await pull(); loadIdeas(); if (!me || doneV(myVotes)) renderSwipe() }
(async () => {
  await loadSpots();
  renderMarkers(); renderTabs(); renderDay(); renderFilters(); renderPlaces(); renderTips(); renderRoutes(); renderFood(); renderPack(); renderPhrases(); loadWeather();
  $("rail").onchange = e => toggleRail(e.target.checked);
  if (db) db.from("packlist").select("groups").eq("trip", TRIP).maybeSingle().then(({ data }) => { if (data?.groups?.length) { PACK = data.groups; renderPack() } });
  await pull(); renderSwipe(); admRender(); loadIdeas();
  setInterval(refreshAll, 15000);
  document.addEventListener("visibilitychange", refreshAll);
})();
