/* 測量・インフラ点検ドローン需要マップ / Drone Demand Map (surveying & infrastructure)
 * 出典：国土交通省 Project LINKS『無人航空機飛行計画データ（2025年度）』を加工して作成
 * 地図: MapLibre GL JS。背景地図: 地理院タイル（標準地図 / 衛星写真）。いずれも
 * クライアント側で完結し API キー不要のため GitHub Pages 単独で動作する。
 */
"use strict";

const USE = {
  target: { color: "#2563eb", ja: "全ターゲット用途", en: "All target uses" },
  survey: { color: "#1f9e5e", ja: "測量", en: "Surveying" },
  infra:  { color: "#e8730c", ja: "インフラ点検・保守", en: "Infrastructure inspection" },
  maint:  { color: "#8b3fd6", ja: "設備メンテナンス", en: "Equipment maintenance" },
};

// 画面文言の対訳。data-i18n / data-i18n-html 属性のキーと一致させる。
const I18N = {
  ja: {
    title: "測量・インフラ点検ドローン需要マップ｜飛行計画（申請）ベース",
    brand_h1: "測量・インフラ点検 ドローン需要マップ",
    brand_sub: "無人航空機 飛行計画（申請）データ／市区町村別",
    sec_filter: "用途で絞り込む",
    sec_pref: "都道府県ランキング",
    sec_muni: "市区町村ランキング（上位20）",
    sec_trend: "月別推移（申請件数）",
    use_target: "全ターゲット用途", use_survey: "測量",
    use_infra: "インフラ点検・保守", use_maint: "設備メンテナンス",
    metric_records: "飛行計画 件数（申請）", metric_munis: "対象 市区町村",
    base_std: "標準地図", base_photo: "衛星写真",
    d_target: "対象用途 計（申請）", leg_survey: "測量", leg_infra: "インフラ", leg_maint: "設備",
    d_bvlos: "目視外（BVLOS）飛行", d_m30: "30m未満飛行",
    d_lic1: "技能証明 一等 保有", d_lic2: "技能証明 二等 保有",
    d_trend_label: "月別（対象用途・申請件数）",
    loading: "データを読み込み中…",
    disclaimer:
      "本マップは<strong>飛行計画の「申請（通報）」ベース</strong>であり、実際の飛行や実態を表すものではありません。" +
      "元データは紙資料のスキャン抽出を含むため<strong>完全性・正確性は保証されません</strong>。" +
      "位置は秘匿化済みの市区町村重心粒度です。個人特定につながる利用はしないでください。",
    popup_unit: "件（申請）",
    src_note: (url) =>
      `出典：<a href="${url}" target="_blank" rel="noopener">国土交通省 Project LINKS『無人航空機飛行計画データ（2025年度）』</a>を加工して作成。` +
      `背景地図：<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener">国土地理院（地理院タイル）</a>。`,
    meta_note: (s, mp, gen) =>
      `対象期間：${ymd(mp[0])}〜${ymd(mp[mp.length - 1])}（${mp.length}ヶ月）／` +
      `走査 ${fmt(s.features_scanned)} 件中、ターゲット用途 ${fmt(s.target_records)} 件、` +
      `包括申請として除外 ${fmt(s.excluded_blanket)} 件。生成：${gen}。`,
  },
  en: {
    title: "Drone Demand Map: Surveying & Infrastructure Inspection (flight-plan applications)",
    brand_h1: "Drone Demand Map — Surveying & Infrastructure Inspection",
    brand_sub: "UAV flight-plan (application) data, by municipality",
    sec_filter: "Filter by use",
    sec_pref: "Prefecture ranking",
    sec_muni: "Municipality ranking (top 20)",
    sec_trend: "Monthly trend (applications)",
    use_target: "All target uses", use_survey: "Surveying",
    use_infra: "Infrastructure inspection", use_maint: "Equipment maintenance",
    metric_records: "Flight-plan applications", metric_munis: "Municipalities",
    base_std: "Standard map", base_photo: "Satellite",
    d_target: "Target-use total (applications)", leg_survey: "Survey", leg_infra: "Infra", leg_maint: "Maint.",
    d_bvlos: "Beyond visual line of sight (BVLOS)", d_m30: "Within 30 m of people/objects",
    d_lic1: "Class-1 pilot license held", d_lic2: "Class-2 pilot license held",
    d_trend_label: "Monthly (target uses, applications)",
    loading: "Loading data…",
    disclaimer:
      "This map is based on flight-plan <strong>applications (notifications)</strong>, not actual flights or real-world activity. " +
      "The source data includes OCR extraction from scanned documents, so <strong>completeness and accuracy are not guaranteed</strong>. " +
      "Locations are anonymized to municipality-centroid granularity; do not use in any way that could identify individuals.",
    popup_unit: "applications",
    src_note: (url) =>
      `Source: created from <a href="${url}" target="_blank" rel="noopener">MLIT Project LINKS &ldquo;UAV Flight Plan Data (FY2025)&rdquo;</a>. ` +
      `Basemap: <a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener">GSI (Geospatial Information Authority of Japan) tiles</a>.`,
    meta_note: (s, mp, gen) =>
      `Period: ${ymd(mp[0])} to ${ymd(mp[mp.length - 1])} (${mp.length} months). ` +
      `Of ${fmt(s.features_scanned)} records scanned: ${fmt(s.target_records)} target-use applications, ` +
      `${fmt(s.excluded_blanket)} excluded as blanket filings. Generated: ${gen}.`,
  },
};

const PREF_EN = {
  "北海道": "Hokkaido", "青森県": "Aomori", "岩手県": "Iwate", "宮城県": "Miyagi",
  "秋田県": "Akita", "山形県": "Yamagata", "福島県": "Fukushima", "茨城県": "Ibaraki",
  "栃木県": "Tochigi", "群馬県": "Gunma", "埼玉県": "Saitama", "千葉県": "Chiba",
  "東京都": "Tokyo", "神奈川県": "Kanagawa", "新潟県": "Niigata", "富山県": "Toyama",
  "石川県": "Ishikawa", "福井県": "Fukui", "山梨県": "Yamanashi", "長野県": "Nagano",
  "岐阜県": "Gifu", "静岡県": "Shizuoka", "愛知県": "Aichi", "三重県": "Mie",
  "滋賀県": "Shiga", "京都府": "Kyoto", "大阪府": "Osaka", "兵庫県": "Hyogo",
  "奈良県": "Nara", "和歌山県": "Wakayama", "鳥取県": "Tottori", "島根県": "Shimane",
  "岡山県": "Okayama", "広島県": "Hiroshima", "山口県": "Yamaguchi", "徳島県": "Tokushima",
  "香川県": "Kagawa", "愛媛県": "Ehime", "高知県": "Kochi", "福岡県": "Fukuoka",
  "佐賀県": "Saga", "長崎県": "Nagasaki", "熊本県": "Kumamoto", "大分県": "Oita",
  "宮崎県": "Miyazaki", "鹿児島県": "Kagoshima", "沖縄県": "Okinawa",
};

const GSI = {
  std:   { tiles: "https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png" },
  photo: { tiles: "https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg" },
};
const GSI_ATTR =
  '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener">地理院タイル</a>' +
  '｜出典：国土交通省 Project LINKS';

const state = {
  lang: "ja",
  use: "target",
  base: "std",
  munis: [],
  prefs: [],
  meta: null,
  map: null,
};

const $ = (id) => document.getElementById(id);
const L = () => I18N[state.lang];
const fmt = (n) => (n == null ? "–" : n.toLocaleString(state.lang === "en" ? "en-US" : "ja-JP"));
const pct = (a, b) => (b > 0 ? Math.round((100 * a) / b) + "%" : "–");
const useLabel = (u) => USE[u][state.lang];
const prefLabel = (p) => (state.lang === "en" ? (PREF_EN[p] || p || "Unknown") : (p || "不明"));

function ymd(m) {
  if (!m) return "";
  const y = m.slice(0, 4), mo = m.slice(4, 6);
  return state.lang === "en" ? `${y}-${mo}` : `${y}年${+mo}月`;
}

async function loadJSON(path) {
  const r = await fetch(path, { cache: "no-cache" });
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  return r.json();
}

function dominantUse(m) {
  const order = [["survey", m.survey], ["infra", m.infra], ["maint", m.maint]];
  order.sort((a, b) => b[1] - a[1]);
  return order[0][1] > 0 ? order[0][0] : "target";
}

function radius(v, max) {
  if (v <= 0) return 0;
  return Math.max(4, 26 * Math.sqrt(v / max));
}

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
  if (state.map && state.map.getSource("munis")) {
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
      <span class="nm">${prefLabel(p.pref)}</span><span class="val">${fmt(p[use])}</span>
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
    return `<div class="tcol" title="${mo}: ${fmt(vals[i])}">
      <div class="tbar" style="height:${h}%"></div>
      <div class="tlbl">${lbl}</div></div>`;
  }).join("");
}

let currentDetail = null;
function showDetail(m) {
  currentDetail = m;
  $("d-name").textContent = m.city || m.name;
  $("d-pref").textContent = prefLabel(m.pref);
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
  state.map.setPaintProperty("muni-circles", "circle-stroke-color",
    base === "photo" ? "#ffffff" : "#1a212b");
}

// data-i18n / data-i18n-html を持つ全要素に現在言語の文言を流し込む。
function applyStaticI18n() {
  const t = L();
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const k = el.getAttribute("data-i18n");
    if (t[k] != null) el.textContent = t[k];
  });
  document.querySelectorAll("[data-i18n-html]").forEach((el) => {
    const k = el.getAttribute("data-i18n-html");
    if (t[k] != null) el.innerHTML = t[k];
  });
  document.title = t.title;
  document.documentElement.lang = state.lang;
}

function renderNotes() {
  const t = L(), s = state.meta.stats, mp = state.meta.months_processed;
  $("src-note").innerHTML = t.src_note(state.meta.source_url);
  $("meta-note").innerHTML = t.meta_note(s, mp, state.meta.generated.slice(0, 10));
}

function setLang(lang) {
  if (!I18N[lang]) return;
  state.lang = lang;
  document.querySelectorAll("#lang-switch button").forEach((b) =>
    b.setAttribute("aria-pressed", String(b.dataset.lang === lang)));
  applyStaticI18n();
  if (state.meta) { renderNotes(); renderMetrics(); renderRanks(); }
  if (currentDetail) showDetail(currentDetail);
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
      .setHTML(`<b>${f.properties.name}</b><br>${useLabel(state.use)}：${fmt(f.properties.v)} ${L().popup_unit}`)
      .addTo(state.map);
  });
  state.map.on("click", "muni-circles", (e) => {
    showDetail(state.munis[e.features[0].properties.idx]);
  });
}

async function init() {
  // 言語スイッチは地図/データ読込前でも動くよう先に配線。
  document.querySelectorAll("#lang-switch button").forEach((b) => b.onclick = () => setLang(b.dataset.lang));
  applyStaticI18n();

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

    renderNotes();
    renderTrend($("trend"), meta.month_target, meta.months_processed);
    document.querySelectorAll("#use-seg .use").forEach((b) => b.onclick = () => setUse(b.dataset.use));
    document.querySelectorAll("#basemap-switch button").forEach((b) => b.onclick = () => setBase(b.dataset.base));
    $("detail-close").onclick = () => { $("detail").classList.remove("show"); currentDetail = null; };

    state.map.on("load", () => {
      addDataLayer();
      setBase("std");
      $("loading").style.display = "none";
    });
    renderMetrics();
    renderRanks();
  } catch (e) {
    $("loading").textContent = (state.lang === "en" ? "Failed to load data: " : "データの読み込みに失敗しました: ") + e.message;
  }
}

init();
