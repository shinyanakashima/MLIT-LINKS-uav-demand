# 測量・インフラ点検 ドローン需要マップ

国土交通省 Project LINKS の **無人航空機 飛行計画データ（2025年度）** をもとに、
**測量 / インフラ点検・保守 / 設備メンテナンス** 用途のドローン飛行計画（申請）を
市区町村別に集計し、需要の地域集積を地図で可視化する静的サイトです。

建設・測量・インフラ管理事業者の営業エリア分析・事業企画での活用を想定しています。

- 地図：用途別の地域集積（比例円マーカー）、都道府県／市区町村ランキング、月別推移
- ドリルダウン：市区町村ごとの用途構成、技能証明（一等・二等）保有率、目視外（BVLOS）・30m未満飛行の割合
- API キー不要（Leaflet + CARTO/OSM の無償タイル）。GitHub Pages 単独で完結。

> **重要：** 本マップは飛行計画の **「申請（通報）」ベース** であり、実際の飛行や実態を表すものではありません。
> 元データは紙資料のスキャン抽出を含むため **完全性・正確性は保証されません**。
> 位置は秘匿化済みの **市区町村重心粒度** です。個人特定につながる二次加工はしないでください。

## 出典

出典：国土交通省 Project LINKS『無人航空機飛行計画データ（2025年度）』を加工して作成

- プロジェクト: [Project LINKS](https://www.mlit.go.jp/links/)
- データセット: [無人航空機飛行計画データ（2025年度）](https://www.geospatial.jp/ckan/dataset/links-mujinkoukuukihikoukeikaku-2025_)
- ライセンス: 公共データ利用規約（第1.0版）／CC BY 4.0 互換・商用利用可・出典表記必須

## 構成

```
pipeline/        集計データ生成スクリプト（Python）
  resources.py     CKAN リソース定義（恒久ダウンロードURL）
  fields.py        フィールド名の正規化・出発地の都道府県/市区町村分割
  build.py         ダウンロード→ストリーミング集計→JSON 出力
docs/            GitHub Pages で配信する静的サイト
  index.html
  assets/{app.js,style.css}
  data/{municipalities,prefectures,meta}.json   ← 集計済み成果物
data/raw/        生 GeoJSON（.gitignore 対象。再生成可能）
```

## 集計データの再生成

元データは月次 GeoJSON 全16ファイルで合計約9.5GB（後半月は1ファイル約1GB）。
`build.py` は1ファイルずつダウンロード→ストリーミング解析→削除するため、
低メモリ・小ディスクで処理できます。geometry（飛行範囲ポリゴン）は読み捨てます。

```bash
pip install ijson openpyxl
python3 pipeline/build.py            # 全12ヶ月（2024年7月〜2025年6月）を処理
python3 pipeline/build.py --limit 4  # 先頭4ファイルのみ（動作確認用）
python3 pipeline/build.py --keep     # 生データを残す
```

成果物は `docs/data/` に出力されます（サイトはこの JSON のみを読み込みます）。

### 前処理の方針（データの癖への対応）

データセットには既知の癖があり、本パイプラインで以下のように織り込んでいます。

1. **規模が重い**（約297万レコード）→ ストリーミング解析で geometry を捨て、
   市区町村集計に要約。配信物は軽量 JSON のみ。
2. **フィールド名の表記ゆれ**（末尾スペース `インフラ点検・保守 `、CJK 部首字
   `機体認証(⼀種)` の `⼀` 等）→ 参照キーを NFKC 正規化＋trim してから照合。
   生キー名はハードコードしない（`pipeline/fields.py`）。
3. **日時の品質が低い**（`飛行日時_*` に年跨ぎ等）→ 月別集計は「ファイル＝対象月」を
   信頼単位とする。
4. **包括申請ノイズ**（業務目的フラグが極端に多い行）→ 業務目的フラグが
   `BLANKET_THRESHOLD`（既定8）以上立つ行を除外（`meta.json` に件数を記録）。
5. **座標の粒度差** → `出発地緯度経度`（市区町村重心・秘匿化済み）を地図の代表点に使用。
6. **「計画」であって実飛行ではない** → UI に「申請ベース」と明記。
7. **欠損** → null 安全に処理（座標欠損の市区町村は地図対象外）。

### ターゲット用途の定義

`飛行目的（業務）_測量` `_インフラ点検・保守` `_設備メンテナンス` のいずれかが `1` の行。
3用途は重複し得るため、「全ターゲット用途」件数は3用途の **和集合** です
（各用途の小計は重複を含みます）。

## デプロイ（GitHub Pages）

静的サイトのため GitHub Pages で配信できます。

- **方法A（推奨・Actions）**: 同梱の `.github/workflows/deploy-pages.yml` が `docs/` を
  Pages へ公開します。リポジトリの **Settings → Pages → Source** を
  **GitHub Actions** に設定してください。
- **方法B（ブランチ）**: Settings → Pages → Source を **Deploy from a branch** にし、
  対象ブランチの `/docs` フォルダを指定。

private リポジトリで Pages を使わない場合は、`docs/` をそのまま ConoHa WING 等へ
アップロードすれば動作します（ビルド不要）。

## ローカル確認

```bash
python3 -m http.server 8000 --directory docs
# http://localhost:8000/ を開く
```
