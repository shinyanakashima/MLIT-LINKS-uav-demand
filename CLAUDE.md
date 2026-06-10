# CLAUDE.md

このリポジトリで作業する AI エージェント（Claude Code 等）向けのガイドです。

## 共通方針の正本

開発者の共通方針（Git 運用・デプロイ・技術選定・データ取り扱い・プロダクト方針）は
別リポジトリ **[`shinyanakashima/llm-workflows`](https://github.com/shinyanakashima/llm-workflows)** の
`preferences/` に集約されています。**そちらを正本として参照してください。** 要点のみ以下に再掲します。

- **Git**: 原則 `main` で作業し作業用ブランチは作らない。コミット/Issue/PR は本人作業として淡々と
  （日本語・変更内容のみ）。`by Claude` 等の AI 関与・宣伝・依頼者への助言/質問を含めない。PR は明示依頼時のみ。
- **デプロイ**: 静的公開 → GitHub Pages（private は ConoHa WING）／動的 → Cloudflare／常駐 → Railway／最後に AWS。
- **技術選定**: 地図は MapLibre + 地理院タイル（std/seamlessphoto）。外部依存・API キーを最小化し、
  **CDN 非依存で自己完結**する静的配信を優先。
- **データ**: 出典表記必須・ライセンス厳守・秘匿化粒度を上げない・null 安全・前処理を丁寧に。
  「申請/報告ベースであり実態でない」「品質非保証」を UI と README に明記。
- **プロダクト**: **日英バイリンガル対応**を重視。README は冒頭に公開 URL、早い位置にスクリーンショット、
  技術詳細は後半。第三者可読性を優先。

## このプロジェクトの概要

国土交通省 Project LINKS『無人航空機飛行計画データ（2025年度）』をもとに、測量・インフラ点検・保守・
設備メンテナンス用途のドローン飛行計画（申請）を市区町村別に集計・可視化する静的サイト。

- `pipeline/` … 集計データ生成（Python）。`resources.py`（リソース定義）／`fields.py`（フィールド正規化）／`build.py`（生成本体）。
- `docs/` … 配信物。`index.html` ＋ `assets/app.js`・`assets/style.css`、`assets/vendor/`（MapLibre 同梱）、`data/`（集計 JSON）。
- 集計データの再生成・前処理方針・出力 JSON の項目定義は `README.md` を参照。

## 作業時のメモ

- 元データは月次 GeoJSON 全16ファイル・約9.5GB（最大 約1GB/月）。`build.py` は1ファイルずつ
  ダウンロード→ストリーミング解析→削除する設計。生データ（`data/raw/`）はコミットしない。
- CKAN の download エンドポイントは**正式ファイル名が必須**（仕様書の短縮名は 500）。
  正式名・サイズは CKAN API `package_show` で取得できる。
- フィールド名は表記ゆれ（末尾スペース・異体字）があるため、NFKC 正規化＋trim してから参照する。
- 残課題は GitHub Issues を参照。
