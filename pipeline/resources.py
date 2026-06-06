"""国土交通省 Project LINKS『無人航空機飛行計画データ（2025年度）』のリソース定義。

出典：国土交通省 Project LINKS『無人航空機飛行計画データ（2025年度）』を加工して作成
データセット: https://www.geospatial.jp/ckan/dataset/links-mujinkoukuukihikoukeikaku-2025_

CKAN のダウンロードURLは恒久リンクとして利用できる（アクセスごとに有効期限付き
S3 URL へリダイレクトされる）。FILENAME は CKAN 上の正式名称と一致させること
（仕様書記載の短縮名では download エンドポイントが 500 を返す）。
"""

PACKAGE_ID = "9db8f0a7-5f94-424b-a978-740cfd58a5fa"
DATASET_PAGE = "https://www.geospatial.jp/ckan/dataset/links-mujinkoukuukihikoukeikaku-2025_"

_BASE = (
    "https://www.geospatial.jp/ckan/dataset/"
    f"{PACKAGE_ID}/resource/{{rid}}/download/{{fn}}"
)


def download_url(resource_id: str, filename: str) -> str:
    return _BASE.format(rid=resource_id, fn=filename)


# (対象月 YYYYMM, resource_id, filename)
# 同一月が _1/_2 に分割されているものは同じ month を共有する。
FLIGHT_PLAN_RESOURCES = [
    ("202407", "00e65a95-af82-4cdd-99be-adb524ddb449", "01_1_hikoukeikaku_202407.geojson"),
    ("202408", "4fb4c6b0-33a1-41fa-81ac-c9cfe28930f6", "01_2_hikoukeikaku_202408.geojson"),
    ("202409", "047e23f6-6c9b-48d5-b3fd-fdcefed4ee0c", "01_3_hikoukeikaku_202409.geojson"),
    ("202410", "045d69c2-c2a2-45b7-b368-ce867bf10c92", "01_4_hikoukeikaku_202410.geojson"),
    ("202411", "c231353d-3224-42e8-be21-de6431fd2c99", "01_5_hikoukeikaku_202411.geojson"),
    ("202412", "2c4f569f-b487-4f92-a1cf-2332ef4e9b7e", "01_6_hikoukeikaku_202412.geojson"),
    ("202501", "1d413e6b-61d5-4e50-8381-97421876a66a", "01_7_hikoukeikaku_202501.geojson"),
    ("202502", "ebb60fbe-ae89-429c-8fe0-9bae7e85569b", "01_8_hikoukeikaku_202502.geojson"),
    ("202503", "c6920c04-78a7-46a9-ab8a-adcc917ff313", "01_9_hikoukeikaku_202503_1.geojson"),
    ("202503", "a94bba7d-a87e-4969-8752-6360846e5bba", "01_9_hikoukeikaku_202503_2.geojson"),
    ("202504", "a3c04e15-f2ec-49bc-9518-25d4dd9d1e18", "01_10_hikoukeikaku_202504_1.geojson"),
    ("202504", "2c658546-b151-4713-9f0a-4f9aca5cbd22", "01_10_hikoukeikaku_202504_2.geojson"),
    ("202505", "cdc8a653-62df-42d5-9b5d-a418a903bebd", "01_11_hikoukeikaku_202505_1.geojson"),
    ("202505", "32f05c87-0cfb-48a1-bbc8-0baeef980533", "01_11_hikoukeikaku_202505_2.geojson"),
    ("202506", "37948aef-8c6d-4770-8346-8a6ba7fe8180", "01_12_hikoukeikaku_202506_1.geojson"),
    ("202506", "7be63f9a-4628-4d2f-8aec-12b278317421", "01_12_hikoukeikaku_202506_2.geojson"),
]

DATA_SPEC_RESOURCE = (
    "c8415c0c-3161-4d6f-be89-481485259b1b",
    "99_mujinkoukuuki_hikoukeikaku_dataspecificationdocument_2025.xlsx",
)

MONTHS = ["202407", "202408", "202409", "202410", "202411", "202412",
          "202501", "202502", "202503", "202504", "202505", "202506"]
