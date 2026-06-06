/* 測量・インフラ点検ドローン需要マップ
 * 出典：国土交通省 Project LINKS『無人航空機飛行計画データ（2025年度）』を加工して作成
 * 地図: MapLibre GL JS。背景地図: 地理院タイル（標準地図 / 衛星写真）。いずれも
 * クライアント側で完結し API キー不要のため GitHub Pages 単独で動作する。
 */
"use strict";

const USE = {
  target: { label: "全ターゲット用途", color: "#2563eb" },
  survey: { label: "測量", color: "#1f9e5e" },
  infra:  { label: "インフラ点検・保守", color: "#e8730c" },
  maint:  { label: "設備メンテナンス", color: "#8b3fd6" },
};

const GSI = {
  std:   { tiles: "https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png" },
  photo: { tiles: "https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg" },
};
const GSI_ATTR =
  '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener">地理院タイル</a>' +
  '｜出典：国土交通省 Project LINKS';

const state = {
  use: "target",
  base: "std",
  munis: [],
  prefs: [],
  meta: null,
  map: null,
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
  return Math.max(4, 26 * Math.sqrt(v / max));
}

// 選択中の用途に応じた GeoJSON を組み立てる（円の半径・色を property に焼き込む）。
function buildFeatures() {
  const use = state.use;
  const vals = state.munis.map((m) => m[use]).filter((v) => v > 0);
  const max = vals.length ? Math.max(...vals) : 1;
  const feats = [];
  state.munis.forEach((m, idx) => {
    const v = m[use];
    if (!v) return;
    const color = use === "target" ? USE[dominantUse(m)].color : USE[use].color;
    feats.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [m.lon, m.lat] },
      properties: { idx, v, r: radius(v, max), color, name: m.name, sk: -v },
    });
  });
  return { type: "FeatureCollection", features: feats };
}

function refreshLayer() {
  if (state.map.getSource("munis")) {
    state.map.getSource("munis").setData(buildFeatures());
  }
}

function renderMetrics() {
  const use = state.use;
  let total = 0, munis = 0;
  for (const m of state.munis) if (m[use] > 0) { total += m[use]; munis++; }
  $("m-records").textContent = fmt(total);
  $("m-munis").textContent = fmt(munis);
}

function renderRanks() {
  const use = state.use;
  const prefs = state.prefs
    .filter((p) => p[use] > 0).sort((a, b) => b[use] - a[use]).slice(0, 12);
  const pmax = prefs.length ? prefs[0][use] : 1;
  $("pref-rank").innerHTML = prefs.map((p) => `
    <li data-pref="${p.pref}">
      <span class="nm">${p.pref}</span><span class="val">${fmt(p[use])}</span>
      <span class="bar-wrap"><span class="bar" style="width:${(100 * p[use]) / pmax}%"></span></span>
    </li>`).join("");
  $("pref-rank").querySelectorAll("li").forEach((li) => {
    li.onclick = () => zoomPref(li.dataset.pref);
  });

  const munis = state.munis
    .filter((m) => m[use] > 0).sort((a, b) => b[use] - a[use]).slice(0, 20);
  const mmax = munis.length ? munis[0][use] : 1;
  $("muni-rank").innerHTML = munis.map((m, i) => `
    <li data-i="${state.munis.indexOf(m)}">
      <span class="nm">${i + 1}. ${m.name}</span><span class="val">${fmt(m[use])}</span>
      <span class="bar-wrap"><span class="bar" style="width:${(100 * m[use]) / mmax}%"></span></span>
    </li>`).join("");
  $("muni-rank").querySelectorAll("li").forEach((li) => {
    const m = state.munis[+li.dataset.i];
    li.onclick = () => { state.map.flyTo({ center: [m.lon, m.lat], zoom: 8 }); showDetail(m); };
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
  const b = new maplibregl.LngLatBounds();
  pts.forEach((m) => b.extend([m.lon, m.lat]));
  state.map.fitBounds(b, { padding: 60, maxZoom: 9 });
}

function setUse(use) {
  state.use = use;
  document.querySelectorAll("#use-seg .use").forEach((b) =>
    b.setAttribute("aria-pressed", String(b.dataset.use === use)));
  refreshLayer();
  renderMetrics();
  renderRanks();
}

function setBase(base) {
  state.base = base;
  state.map.setLayoutProperty("gsi-std", "visibility", base === "std" ? "visible" : "none");
  state.map.setLayoutProperty("gsi-photo", "visibility", base === "photo" ? "visible" : "none");
  document.querySelectorAll("#basemap-switch button").forEach((b) =>
    b.setAttribute("aria-pressed", String(b.dataset.base === base)));
  // 衛星写真は背景が暗いので円の縁取りを明るくする。
  state.map.setPaintProperty("muni-circles", "circle-stroke-color",
    base === "photo" ? "#ffffff" : "#1a212b");
}

function mapStyle() {
  return {
    version: 8,
    sources: {
      "gsi-std": { type: "raster", tiles: [GSI.std.tiles], tileSize: 256, maxzoom: 18, attribution: GSI_ATTR },
      "gsi-photo": { type: "raster", tiles: [GSI.photo.tiles], tileSize: 256, maxzoom: 18, attribution: GSI_ATTR },
    },
    layers: [
      { id: "gsi-std", type: "raster", source: "gsi-std", layout: { visibility: "visible" } },
      { id: "gsi-photo", type: "raster", source: "gsi-photo", layout: { visibility: "none" } },
    ],
  };
}

function addDataLayer() {
  state.map.addSource("munis", { type: "geojson", data: buildFeatures() });
  state.map.addLayer({
    id: "muni-circles",
    type: "circle",
    source: "munis",
    layout: { "circle-sort-key": ["get", "sk"] },
    paint: {
      "circle-radius": ["get", "r"],
      "circle-color": ["get", "color"],
      "circle-opacity": 0.6,
      "circle-stroke-width": 0.9,
      "circle-stroke-color": "#1a212b",
      "circle-stroke-opacity": 0.7,
    },
  });

  const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: true });
  state.map.on("mouseenter", "muni-circles", () => { state.map.getCanvas().style.cursor = "pointer"; });
  state.map.on("mouseleave", "muni-circles", () => { state.map.getCanvas().style.cursor = ""; popup.remove(); });
  state.map.on("mousemove", "muni-circles", (e) => {
    const f = e.features[0];
    popup.setLngLat(f.geometry.coordinates)
      .setHTML(`<b>${f.properties.name}</b><br>${USE[state.use].label}：${fmt(f.properties.v)} 件（申請）`)
      .addTo(state.map);
  });
  state.map.on("click", "muni-circles", (e) => {
    showDetail(state.munis[e.features[0].properties.idx]);
  });
}

async function init() {
  state.map = new maplibregl.Map({
    container: "map",
    style: mapStyle(),
    center: [137.5, 37.8],
    zoom: 4.4,
    attributionControl: false,
  });
  state.map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-left");
  state.map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");

  try {
    const [meta, munis, prefs] = await Promise.all([
      loadJSON("data/meta.json"),
      loadJSON("data/municipalities.json"),
      loadJSON("data/prefectures.json"),
    ]);
    state.meta = meta; state.munis = munis; state.prefs = prefs;

    $("src-note").innerHTML =
      `出典：<a href="${meta.source_url}" target="_blank" rel="noopener">` +
      `国土交通省 Project LINKS『無人航空機飛行計画データ（2025年度）』</a>を加工して作成。` +
      `背景地図：<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener">国土地理院（地理院タイル）</a>。`;
    const s = meta.stats, mp = meta.months_processed;
    const ymd = (m) => m.slice(0, 4) + "年" + (+m.slice(4, 6)) + "月";
    $("meta-note").innerHTML =
      `対象期間：${mp.length ? ymd(mp[0]) : ""}〜${mp.length ? ymd(mp[mp.length - 1]) : ""}` +
      `（${mp.length}ヶ月）／走査 ${fmt(s.features_scanned)} 件中、` +
      `ターゲット用途 ${fmt(s.target_records)} 件、包括申請として除外 ${fmt(s.excluded_blanket)} 件。` +
      `生成：${meta.generated.slice(0, 10)}。`;
    renderTrend($("trend"), meta.month_target, meta.months_processed);

    document.querySelectorAll("#use-seg .use").forEach((b) => b.onclick = () => setUse(b.dataset.use));
    document.querySelectorAll("#basemap-switch button").forEach((b) => b.onclick = () => setBase(b.dataset.base));
    $("detail-close").onclick = () => $("detail").classList.remove("show");

    state.map.on("load", () => {
      addDataLayer();
      setBase("std");
      $("loading").style.display = "none";
    });
    renderMetrics();
    renderRanks();
  } catch (e) {
    $("loading").textContent = "データの読み込みに失敗しました: " + e.message;
  }
}

init();
