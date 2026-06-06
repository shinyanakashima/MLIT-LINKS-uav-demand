"""フィールド名の正規化と出発地テキストの解析。

実データには表記ゆれがある:
- 末尾スペース（例: '飛行目的（業務）_インフラ点検・保守 '）
- 全角/半角の括弧（'（業務）' と '(業務)'）
- CJK 部首字の混入（'機体認証(⼀種)' の '⼀' は U+2F00）

そのため properties のキーは生のままハードコードせず、NFKC 正規化 + trim した
キーで参照する。本モジュールはその正規化と、参照用の正規化キー定数を提供する。
"""

import unicodedata


def norm(s: str) -> str:
    """NFKC 正規化し前後の空白を除去する。"""
    if s is None:
        return ""
    return unicodedata.normalize("NFKC", str(s)).strip()


def build_keymap(properties: dict) -> dict:
    """{正規化キー: 元キー} のマップを作る。"""
    return {norm(k): k for k in properties}


# --- 正規化済み参照キー（norm() を通した形に揃える） ---------------------------
# 飛行目的（業務）。one-hot 0/1。
BUSINESS_PURPOSES = [
    "空撮", "報道取材", "警備", "農林水産業", "測量", "環境調査",
    "設備メンテナンス", "インフラ点検・保守", "資材管理", "輸送・宅配",
    "自然観測", "事故・災害対応等", "その他",
]
_PURPOSE_PREFIX = norm("飛行目的（業務）_")

# 本案のターゲット用途（測量・インフラ点検・保守・設備メンテナンス）。
TARGET_PURPOSES = ["測量", "インフラ点検・保守", "設備メンテナンス"]

K_DEPARTURE = norm("出発地")
K_DEP_LAT = norm("出発地緯度")
K_DEP_LON = norm("出発地経度")
K_METHOD_BVLOS = norm("飛行方法_目視外")
K_METHOD_30M = norm("飛行方法_30m")
K_LICENSE1 = norm("技能証明（一等）")
K_LICENSE2 = norm("技能証明（二等）")
K_PLANNED_START = norm("飛行予定日時_開始")


def purpose_key(purpose: str) -> str:
    """業務目的名から正規化済み参照キーを返す。"""
    return _PURPOSE_PREFIX + norm(purpose)


def get(properties: dict, keymap: dict, normalized_key: str, default=None):
    """正規化キーで properties から値を取り出す。"""
    orig = keymap.get(normalized_key)
    if orig is None:
        return default
    return properties.get(orig, default)


def to_flag(v) -> int:
    """0/1 フラグへ変換（'1' や 1 を 1、その他を 0）。"""
    return 1 if v in (1, "1", 1.0) else 0


# 都道府県（長い名前を先に並べ、最長一致で判定する）。
PREFECTURES = [
    "北海道",
    "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
    "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
    "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県",
    "岐阜県", "静岡県", "愛知県", "三重県",
    "滋賀県", "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県",
    "鳥取県", "島根県", "岡山県", "広島県", "山口県",
    "徳島県", "香川県", "愛媛県", "高知県",
    "福岡県", "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県",
]


def split_departure(text: str):
    """出発地テキストを (都道府県, 市区町村) に分割する。

    例: '神奈川県愛甲郡愛川町' -> ('神奈川県', '愛甲郡愛川町')
        '北海道帯広市'        -> ('北海道', '帯広市')
    都道府県が判定できない/空の場合は (None, text)。
    """
    t = norm(text)
    if not t:
        return None, ""
    for pref in PREFECTURES:
        if t.startswith(pref):
            return pref, t[len(pref):]
    return None, t
