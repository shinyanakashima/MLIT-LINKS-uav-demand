/* 測量・インフラ点検ドローン需要マップ
 * 出典：国土交通省 Project LINKS『無人航空機飛行計画データ（2025年度）』を加工して作成
 * 依存は Leaflet のみ。集計済み JSON（docs/data/*.json）を読み込んで描画する。
 */
"use strict";

const USE = {
  target: { label: "全ターゲット用途", color: "#4ea1ff" },
  survey: { label: "測量", color: "#2f9e6e" },
  infra:  { label: "インフラ点検・保守", color: "#e8853a" },
  maint:  { label: "設備メンテナンス", color: "#9b6dd6" },
};

const state = {
  use: "target",
  munis: [],
  prefs: [],
  meta: null,
  map: null,
  layer: null,
  selected: null,
};

const $ = (id) => document.getElementById(id);
const fmt = (n) => (n == null ? "–" : n.toLocaleString("ja-JP"));
const pct = (a, b) => (b > 0 ? Math.round((100 * a) / b) + "%" : "–");

async function loadJSON(path) {
  const r = await fetch(path, { cache: "no-cache" });
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  return r.json();
}

function dominantUse(m) {
  // survey/infra/maint は重複し得るが、代表色は最大カテゴリで決める。
  const order = [["survey", m.survey], ["infra", m.infra], ["maint", m.maint]];
  order.sort((a, b) => b[1] - a[1]);
  return order[0][1] > 0 ? order[0][0] : "target";
}

function radius(v, max) {
  if (v <= 0) return 0;
  const r = 22 * Math.sqrt(v / max);
  return Math.max(4, r);
}

function renderMap() {
  if (state.layer) state.layer.remove();
  const use = state.use;
  const vals = state.munis.map((m) => m[use]).filter((v) => v > 0);
  const max = vals.length ? Math.max(...vals) : 1;
  const markers = [];
  for (const m of state.munis) {
    const v = m[use];
    if (!v) continue;
    const color = use === "target" ? USE[dominantUse(m)].color : USE[use].color;
    const c = L.circleMarker([m.lat, m.lon], {
      radius: radius(v, max),
      color: color, weight: 1, fillColor: color, fillOpacity: 0.55,
    });
    c.bindPopup(
      `<b>${m.name}</b><br>${USE[use].label}：${fmt(v)} 件（申請）` +
      `<br><span style="color:#9aa7b4">クリックで詳細</span>`
    );
    c.on("click", () => showDetail(m));
    markers.push(c);
  }
  state.layer = L.layerGroup(markers).addTo(state.map);
}

function renderMetrics() {
  const use = state.use;
  let total = 0, munis = 0;
  for (const m of state.munis) { if (m[use] > 0) { total += m[use]; munis++; } }
  $("m-records").textContent = fmt(total);
  $("m-munis").textContent = fmt(munis);
}

function renderRanks() {
  const use = state.use;
  // 都道府県
  const prefs = state.prefs
    .filter((p) => p[use] > 0)
    .sort((a, b) => b[use] - a[use])
    .slice(0, 12);
  const pmax = prefs.length ? prefs[0][use] : 1;
  $("pref-rank").innerHTML = prefs.map((p) => `
    <li data-pref="${p.pref}">
      <span class="nm">${p.pref}</span><span class="val">${fmt(p[use])}</span>
      <span class="bar-wrap"><span class="bar" style="width:${(100 * p[use]) / pmax}%"></span></span>
    </li>`).join("");
  $("pref-rank").querySelectorAll("li").forEach((li) => {
    li.onclick = () => zoomPref(li.dataset.pref);
  });

  // 市区町村
  const munis = state.munis
    .filter((m) => m[use] > 0)
    .sort((a, b) => b[use] - a[use])
    .slice(0, 20);
  const mmax = munis.length ? munis[0][use] : 1;
  $("muni-rank").innerHTML = munis.map((m, i) => `
    <li data-i="${state.munis.indexOf(m)}">
      <span class="nm">${i + 1}. ${m.name}</span><span class="val">${fmt(m[use])}</span>
      <span class="bar-wrap"><span class="bar" style="width:${(100 * m[use]) / mmax}%"></span></span>
    </li>`).join("");
  $("muni-rank").querySelectorAll("li").forEach((li) => {
    const m = state.munis[+li.dataset.i];
    li.onclick = () => { state.map.setView([m.lat, m.lon], 9); showDetail(m); };
  });
}

function renderTrend(el, monthCounts, months) {
  const vals = months.map((mo) => monthCounts[mo] || 0);
  const max = Math.max(1, ...vals);
  el.innerHTML = months.map((mo, i) => {
    const h = Math.round((100 * vals[i]) / max);
    const lbl = mo.slice(2, 4) + "/" + mo.slice(4, 6);
    return `<div class="tcol" title="${mo}: ${fmt(vals[i])}件">
      <div class="tbar" style="height:${h}%"></div>
      <div class="tlbl">${lbl}</div></div>`;
  }).join("");
}

function showDetail(m) {
  state.selected = m;
  $("d-name").textContent = m.city || m.name;
  $("d-pref").textContent = m.pref || "";
  $("d-target").textContent = fmt(m.target);
  $("d-survey").textContent = fmt(m.survey);
  $("d-infra").textContent = fmt(m.infra);
  $("d-maint").textContent = fmt(m.maint);
  $("d-bvlos").textContent = `${fmt(m.bvlos)}（${pct(m.bvlos, m.target)}）`;
  $("d-m30").textContent = `${fmt(m.m30)}（${pct(m.m30, m.target)}）`;
  $("d-lic1").textContent = `${fmt(m.lic1)}（${pct(m.lic1, m.target)}）`;
  $("d-lic2").textContent = `${fmt(m.lic2)}（${pct(m.lic2, m.target)}）`;
  // 用途構成バー（重複ありのため合計で正規化）
  const sum = m.survey + m.infra + m.maint || 1;
  $("d-compo").innerHTML =
    `<span style="width:${(100 * m.survey) / sum}%;background:var(--survey)"></span>` +
    `<span style="width:${(100 * m.infra) / sum}%;background:var(--infra)"></span>` +
    `<span style="width:${(100 * m.maint) / sum}%;background:var(--maint)"></span>`;
  renderTrend($("d-trend"), m.months || {}, state.meta.months_processed);
  $("detail").classList.add("show");
}

function zoomPref(pref) {
  const pts = state.munis.filter((m) => m.pref === pref && m[state.use] > 0);
  if (!pts.length) return;
  const b = L.latLngBounds(pts.map((m) => [m.lat, m.lon]));
  state.map.fitBounds(b.pad(0.2));
}

function setUse(use) {
  state.use = use;
  document.querySelectorAll("#use-seg .use").forEach((b) =>
    b.setAttribute("aria-pressed", String(b.dataset.use === use)));
  renderMap();
  renderMetrics();
  renderRanks();
}

function addLegend() {
  const lg = L.control({ position: "bottomright" });
  lg.onAdd = () => {
    const d = L.DomUtil.create("div", "map-legend");
    d.innerHTML =
      "円の大きさ＝申請件数<div class='circles'>" +
      "<span class='ring' style='width:10px;height:10px'></span>" +
      "<span class='ring' style='width:20px;height:20px'></span>" +
      "<span class='ring' style='width:32px;height:32px'></span></div>";
    return d;
  };
  lg.addTo(state.map);
}

async function init() {
  state.map = L.map("map", { preferCanvas: true, zoomControl: true })
    .setView([37.5, 137.5], 5);
  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> ' +
      '&copy; <a href="https://carto.com/attributions">CARTO</a>｜出典：国土交通省 Project LINKS',
    subdomains: "abcd", maxZoom: 18,
  }).addTo(state.map);
  addLegend();

  try {
    const [meta, munis, prefs] = await Promise.all([
      loadJSON("data/meta.json"),
      loadJSON("data/municipalities.json"),
      loadJSON("data/prefectures.json"),
    ]);
    state.meta = meta; state.munis = munis; state.prefs = prefs;

    $("src-note").innerHTML =
      `出典：<a href="${meta.source_url}" target="_blank" rel="noopener">` +
      `国土交通省 Project LINKS『無人航空機飛行計画データ（2025年度）』</a>を加工して作成。`;
    const s = meta.stats;
    const mp = meta.months_processed;
    $("meta-note").innerHTML =
      `対象期間：${mp[0] ? mp[0].slice(0,4)+"年"+(+mp[0].slice(4,6))+"月" : ""}〜` +
      `${mp.length ? mp[mp.length-1].slice(0,4)+"年"+(+mp[mp.length-1].slice(4,6))+"月" : ""}` +
      `（${mp.length}ヶ月）／走査 ${fmt(s.features_scanned)} 件中、` +
      `ターゲット用途 ${fmt(s.target_records)} 件、包括申請として除外 ${fmt(s.excluded_blanket)} 件。` +
      `生成：${meta.generated.slice(0,10)}。`;

    renderTrend($("trend"), meta.month_target, meta.months_processed);
    document.querySelectorAll("#use-seg .use").forEach((b) =>
      b.onclick = () => setUse(b.dataset.use));
    $("detail-close").onclick = () => $("detail").classList.remove("show");

    setUse("target");
  } catch (e) {
    $("loading").textContent = "データの読み込みに失敗しました: " + e.message;
    return;
  }
  $("loading").style.display = "none";
}

init();
