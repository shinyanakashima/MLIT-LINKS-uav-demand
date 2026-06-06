#!/usr/bin/env python3
"""測量・インフラ点検ドローン需要マップ用の集計データを生成する。

処理の流れ（1ファイルずつストリーミング処理し、巨大データでも低メモリで動く）:
  1. CKAN から月次 GeoJSON をダウンロード（既に data/raw にあれば再利用）
  2. ijson で逐次パースし、各 Feature の properties を正規化キーで参照
  3. 包括申請ノイズ（業務目的フラグが極端に多い行）を除外
  4. ターゲット用途（測量 / インフラ点検・保守 / 設備メンテナンス）を抽出
  5. 出発地（市区町村）別に集計（用途構成・資格保有・飛行方法・月別）
  6. docs/data/ に軽量な集計 JSON を出力

geometry（飛行範囲ポリゴン）は読み捨てる。出発地は秘匿化済みの市区町村重心粒度で
あり、本マップもその粒度で扱う（個人特定につながる二次加工はしない）。

使い方:
  python3 pipeline/build.py                # 全16ファイルを処理
  python3 pipeline/build.py --limit 4      # 先頭4ファイルのみ（動作確認用）
  python3 pipeline/build.py --keep         # 生データを削除せず残す
"""

import argparse
import json
import os
import subprocess
import sys
import time
from collections import Counter, defaultdict
from datetime import datetime, timezone

import ijson

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fields as F  # noqa: E402
from resources import (  # noqa: E402
    FLIGHT_PLAN_RESOURCES, MONTHS, DATASET_PAGE, download_url,
)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW_DIR = os.path.join(ROOT, "data", "raw")
OUT_DIR = os.path.join(ROOT, "docs", "data")

# 業務目的フラグがこの数以上立っている行は包括申請ノイズとみなし除外する。
BLANKET_THRESHOLD = 8


def log(msg):
    print(f"[{datetime.now():%H:%M:%S}] {msg}", flush=True)


def download(resource_id, filename, dest, retries=4):
    """curl でダウンロード（指数バックオフでリトライ）。"""
    url = download_url(resource_id, filename)
    delay = 2
    for attempt in range(1, retries + 1):
        rc = subprocess.call([
            "curl", "-sSL", "--fail", "--max-time", "1800",
            "-o", dest, url,
        ])
        if rc == 0 and os.path.getsize(dest) > 0:
            return True
        log(f"  download failed (rc={rc}, attempt {attempt}/{retries}); retrying in {delay}s")
        time.sleep(delay)
        delay *= 2
    return False


class Aggregator:
    def __init__(self):
        # 市区町村別集計。キーは正規化済み出発地テキスト。
        self.muni = {}
        self.month_target = Counter()      # 月別ターゲット件数
        self.month_total = Counter()       # 月別総件数
        self.total_features = 0
        self.total_business = 0            # 何らかの業務目的が立つ件数
        self.total_target = 0
        self.excluded_blanket = 0          # 包括申請として除外した件数
        self.target_no_location = 0        # 出発地不明のターゲット件数

    def _muni_rec(self, dep_text):
        rec = self.muni.get(dep_text)
        if rec is None:
            pref, city = F.split_departure(dep_text)
            rec = {
                "name": dep_text, "pref": pref, "city": city,
                "lat": None, "lon": None,
                "survey": 0, "infra": 0, "maint": 0, "target": 0,
                "bvlos": 0, "m30": 0, "lic1": 0, "lic2": 0,
                "months": Counter(),
            }
            self.muni[dep_text] = rec
        return rec

    def process_feature(self, props, month):
        self.total_features += 1
        self.month_total[month] += 1
        km = F.build_keymap(props)

        # 業務目的フラグを集計
        flags = {}
        n_business = 0
        for p in F.BUSINESS_PURPOSES:
            v = F.to_flag(F.get(props, km, F.purpose_key(p), 0))
            flags[p] = v
            n_business += v
        if n_business > 0:
            self.total_business += 1

        # 包括申請ノイズ除外
        if n_business >= BLANKET_THRESHOLD:
            self.excluded_blanket += 1
            return

        is_target = any(flags[p] for p in F.TARGET_PURPOSES)
        if not is_target:
            return

        self.total_target += 1
        self.month_target[month] += 1

        dep_text = F.norm(F.get(props, km, F.K_DEPARTURE, ""))
        if not dep_text:
            self.target_no_location += 1
            return

        rec = self._muni_rec(dep_text)
        rec["target"] += 1
        rec["months"][month] += 1
        if flags["測量"]:
            rec["survey"] += 1
        if flags["インフラ点検・保守"]:
            rec["infra"] += 1
        if flags["設備メンテナンス"]:
            rec["maint"] += 1
        if F.to_flag(F.get(props, km, F.K_METHOD_BVLOS, 0)):
            rec["bvlos"] += 1
        if F.to_flag(F.get(props, km, F.K_METHOD_30M, 0)):
            rec["m30"] += 1
        if F.to_flag(F.get(props, km, F.K_LICENSE1, 0)):
            rec["lic1"] += 1
        if F.to_flag(F.get(props, km, F.K_LICENSE2, 0)):
            rec["lic2"] += 1

        # 代表座標（市区町村重心）。最初に得た非 null 値を保持。
        if rec["lat"] is None:
            lat = F.get(props, km, F.K_DEP_LAT)
            lon = F.get(props, km, F.K_DEP_LON)
            if lat is not None and lon is not None:
                try:
                    rec["lat"] = round(float(lat), 5)
                    rec["lon"] = round(float(lon), 5)
                except (TypeError, ValueError):
                    pass


def process_file(path, month, agg):
    n0 = agg.total_features
    t0 = agg.total_target
    with open(path, "rb") as fh:
        for feat in ijson.items(fh, "features.item"):
            props = feat.get("properties") or {}
            agg.process_feature(props, month)
    log(f"  {month}: features={agg.total_features - n0:,} "
        f"target={agg.total_target - t0:,}")


def build_outputs(agg, processed_months, args):
    os.makedirs(OUT_DIR, exist_ok=True)
    generated = datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")

    municipalities = []
    for rec in agg.muni.values():
        if rec["lat"] is None:
            # 座標不明（出発地テキストはあるが緯度経度欠損）は地図に描けないため除外。
            continue
        municipalities.append({
            "name": rec["name"], "pref": rec["pref"], "city": rec["city"],
            "lat": rec["lat"], "lon": rec["lon"],
            "target": rec["target"], "survey": rec["survey"],
            "infra": rec["infra"], "maint": rec["maint"],
            "bvlos": rec["bvlos"], "m30": rec["m30"],
            "lic1": rec["lic1"], "lic2": rec["lic2"],
            "months": dict(sorted(rec["months"].items())),
        })
    municipalities.sort(key=lambda r: r["target"], reverse=True)

    # 都道府県ロールアップ
    pref_roll = defaultdict(lambda: {
        "target": 0, "survey": 0, "infra": 0, "maint": 0,
        "bvlos": 0, "m30": 0, "lic1": 0, "lic2": 0, "munis": 0,
    })
    for r in municipalities:
        p = r["pref"] or "不明"
        pr = pref_roll[p]
        for k in ("target", "survey", "infra", "maint", "bvlos", "m30", "lic1", "lic2"):
            pr[k] += r[k]
        pr["munis"] += 1
    prefectures = [dict(pref=k, **v) for k, v in pref_roll.items()]
    prefectures.sort(key=lambda r: r["target"], reverse=True)

    meta = {
        "generated": generated,
        "source": "国土交通省 Project LINKS『無人航空機飛行計画データ（2025年度）』を加工して作成",
        "source_url": DATASET_PAGE,
        "months_available": MONTHS,
        "months_processed": processed_months,
        "target_purposes": F.TARGET_PURPOSES,
        "blanket_threshold": BLANKET_THRESHOLD,
        "stats": {
            "features_scanned": agg.total_features,
            "business_records": agg.total_business,
            "target_records": agg.total_target,
            "excluded_blanket": agg.excluded_blanket,
            "target_no_location": agg.target_no_location,
            "municipalities": len(municipalities),
        },
        "month_target": dict(sorted(agg.month_target.items())),
        "month_total": dict(sorted(agg.month_total.items())),
    }

    with open(os.path.join(OUT_DIR, "municipalities.json"), "w", encoding="utf-8") as f:
        json.dump(municipalities, f, ensure_ascii=False, separators=(",", ":"))
    with open(os.path.join(OUT_DIR, "prefectures.json"), "w", encoding="utf-8") as f:
        json.dump(prefectures, f, ensure_ascii=False, separators=(",", ":"))
    with open(os.path.join(OUT_DIR, "meta.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)

    log(f"OUTPUT: {len(municipalities):,} municipalities, "
        f"{len(prefectures)} prefectures, {agg.total_target:,} target records")
    return meta


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0, help="先頭から処理するファイル数（0=全件）")
    ap.add_argument("--keep", action="store_true", help="処理後も生データを削除しない")
    args = ap.parse_args()

    os.makedirs(RAW_DIR, exist_ok=True)
    resources = FLIGHT_PLAN_RESOURCES
    if args.limit:
        resources = resources[:args.limit]

    agg = Aggregator()
    processed_months = []
    for i, (month, rid, fn) in enumerate(resources, 1):
        # data/raw のローカル名は分割ファイルも区別できるよう resource filename を使う。
        path = os.path.join(RAW_DIR, fn)
        log(f"[{i}/{len(resources)}] {fn} ({month})")
        downloaded_now = False
        if not (os.path.exists(path) and os.path.getsize(path) > 0):
            if not download(rid, fn, path):
                log(f"  SKIP: download failed for {fn}")
                continue
            downloaded_now = True
        size_mb = os.path.getsize(path) / 1e6
        log(f"  parsing {size_mb:,.1f} MB ...")
        try:
            process_file(path, month, agg)
            if month not in processed_months:
                processed_months.append(month)
        finally:
            if downloaded_now and not args.keep:
                os.remove(path)

    build_outputs(agg, processed_months, args)
    log("done.")


if __name__ == "__main__":
    main()
