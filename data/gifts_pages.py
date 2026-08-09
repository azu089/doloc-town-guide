# -*- coding: utf-8 -*-
"""gifts / romance 两页的内容生成（数据驱动，禁止手写表格）。

来源：Steam 社区攻略《Doloc Town - Character Gifts》（作者 rockechic）[L2]
      正文是两张表格图片，2026-08-08 逐行读出到 data/gifts-raw.json。

⚠️ 数据文件必须放 data/ 不能放 work/：work/ 在 .gitignore 里，
   而 Cloudflare Pages 只 clone 仓库、在构建机上跑 build_content.py，
   放 work/ 会导致线上构建 FileNotFoundError（2026-08-08 差点踩中）。

⚠️ 三条纪律，改这个文件前先读：
1. **物品名与村民名一律保持英文原文**。官方中/日/韩本地化名我们没有，
   编译名 = 造假。页面上明确说明「名称按英文客户端」。
2. **物品表是机械反查**（villager→item 转 item→villager），不新增任何事实。
   判定档位也纯粹由计数得出。改判定阈值前先跑 --review 打全表人工核对。
3. **「没人讨厌」不等于「安全」**。原作者明说未列出的物品「可能中性，也可能只是没测」，
   所以只有数据点足够多才敢下结论，其余一律归入「数据有限」并写明测过几人。
"""
import json
from pathlib import Path
from collections import defaultdict

ROOT = Path(__file__).parent
RAW = json.loads((ROOT / "gifts-raw.json").read_text(encoding="utf-8"))
SRC = RAW["_source"]
VILL = {k: v for k, v in RAW["villagers"].items()
        if v["loves"] or v["likes"] or v["dislikes"]}
UNTESTED = [k for k in RAW["villagers"] if k not in VILL]
N = len(VILL)

# ---------- 机械反查：villager→item 转成 item→villager ----------
IDX = defaultdict(lambda: {"loves": [], "likes": [], "dislikes": []})
for _name, _p in VILL.items():
    for _it in _p["loves"]:    IDX[_it]["loves"].append(_name)
    for _it in _p["likes"]:    IDX[_it]["likes"].append(_name)
    for _it in _p["dislikes"]: IDX[_it]["dislikes"].append(_name)

BIG = 8  # 「多数人」阈值：13 人中 8 人 ≈ 62%


def verdict(e):
    pos, neg = len(e["loves"]) + len(e["likes"]), len(e["dislikes"])
    if neg == 0 and pos >= BIG: return "universal"   # 万能：多数人收，无人讨厌
    if pos == 0 and neg >= BIG: return "never"       # 雷区：多数人讨厌，无人收
    if pos and neg:             return "mixed"       # 分歧：有人爱有人恨
    return "limited"                                 # 数据有限：样本太少，不下结论


ITEMS = sorted(
    ((it, e, verdict(e)) for it, e in IDX.items()),
    key=lambda r: ({"universal": 0, "never": 1, "mixed": 2, "limited": 3}[r[2]],
                   -(len(r[1]["loves"]) + len(r[1]["likes"])), r[0])
)

UNIVERSAL = [it for it, e, v in ITEMS if v == "universal"]
NEVER     = [it for it, e, v in ITEMS if v == "never"]
MIXED     = [(it, e) for it, e, v in ITEMS if v == "mixed"]

# ---------- 文案（en 为源，其余语言逐条翻译；表格内容语言无关）----------
J = ", ".join
VERDICT_W = {
    "en":    {"universal": "Universal", "never": "Never gift", "mixed": "Divisive", "limited": "Limited data"},
    "zh-CN": {"universal": "万能",       "never": "绝对别送",   "mixed": "有分歧",   "limited": "数据有限"},
    "ja":    {"universal": "万能",       "never": "絶対に贈らない", "mixed": "賛否両論", "limited": "データ不足"},
    "ko":    {"universal": "만능",       "never": "절대 금지",  "mixed": "호불호",   "limited": "데이터 부족"},
    "es":    {"universal": "Universal",  "never": "Nunca",     "mixed": "Divisivo", "limited": "Datos limitados"},
}


def item_rows(lang):
    """物品反查表。名称保持英文；只有判定词跟随语言。"""
    w = VERDICT_W[lang]
    out = []
    for it, e, v in ITEMS:
        tested = len(e["loves"]) + len(e["likes"]) + len(e["dislikes"])
        tag = w[v] + (f" ({tested}/{N})" if v == "limited" else "")
        out.append([it, J(e["loves"]) or "—", J(e["likes"]) or "—", J(e["dislikes"]) or "—", tag])
    return out


def item_attrs():
    return [{"v": v} for _it, _e, v in ITEMS]


def villager_rows():
    """村民表：名称与物品全英文，无需按语言分版。"""
    return [[n, J(p["loves"]) or "—", J(p["likes"]) or "—", J(p["dislikes"]) or "—"]
            for n, p in sorted(VILL.items())]


def _mixed_line(lang):
    """挑最反直觉的一条讲。Combat Chip：一个人爱、八个人恨。"""
    it, e = next(((i, e) for i, e in MIXED if e["loves"] and len(e["dislikes"]) >= BIG), MIXED[0])
    lover, haters = J(e["loves"]), len(e["dislikes"])
    return {
        "en":    f"{it} is the trap: {lover} loves it, but {haters} other villagers dislike it. There is no safe blanket gift among the machine parts.",
        "zh-CN": f"{it} 是个陷阱：{lover} 爱它，但另外 {haters} 位村民讨厌它。机械零件里没有可以无脑群发的礼物。",
        "ja":    f"{it} は罠だ——{lover} は喜ぶが、他の {haters} 人は嫌う。機械部品に「全員に配れる」贈り物は存在しない。",
        # ⚠️ 名字后面不要接 은/는 —— 村民名是变量，无法预知有无收音，
        #    写成「은(는)」在韩语母语者看来很业余。改用不接助词的句式绕开。
        "ko":    f"{it}이(가) 바로 함정이다. 좋아하는 주민은 {lover} 한 명뿐이고, 나머지 {haters}명은 싫어한다. 기계 부품 중에는 아무에게나 돌려도 되는 선물이 없다.",
        "es":    f"{it} es la trampa: a {lover} le encanta, pero a otros {haters} aldeanos no. No hay regalo universal entre las piezas de máquina.",
    }[lang]


SOURCE_NOTE = {
    "en":    (f"Every row below comes from the community Steam guide \"Doloc Town - Character Gifts\" by {SRC['author']}, "
              f"read directly from its two data tables. Two limits you should know before you spend a gift: the author states it is "
              f"\"still a work in progress\" and was built during Early Access, so it predates 1.0 (5 August 2026) by more than a year; "
              f"and {len(UNTESTED)} of the {len(RAW['villagers'])} characters have no data at all. "
              f"An item that is not listed may simply be untested — it is not proof that it is safe. "
              f"Item and villager names are kept exactly as they appear in the English client."),
    "zh-CN": (f"下面每一行都来自社区 Steam 攻略《Doloc Town - Character Gifts》（作者 {SRC['author']}），"
              f"从它的两张数据表逐行读出。花礼物之前先知道两个局限：作者自述这份表\"仍在完善中\"、"
              f"是抢先体验期做的，比 1.0（2026 年 8 月 5 日）早了一年多；"
              f"而且 {len(RAW['villagers'])} 个角色里有 {len(UNTESTED)} 个完全没有数据。"
              f"某个物品没被列出，可能只是没人测过——**不等于送了安全**。"
              f"物品名与村民名保持英文客户端里的原样。"),
    "ja":    (f"以下の各行はコミュニティ製 Steam ガイド『Doloc Town - Character Gifts』（作者 {SRC['author']}）の"
              f"2 枚のデータ表から直接読み取ったもの。贈り物を使う前に 2 つの限界を知っておきたい。"
              f"作者自身が「まだ作成途中」と述べており、アーリーアクセス期に作られたため 1.0（2026 年 8 月 5 日）より 1 年以上前のものだ。"
              f"さらに {len(RAW['villagers'])} 人のうち {len(UNTESTED)} 人はデータが一切ない。"
              f"表に無い物品は単に未検証かもしれず、**安全である証拠にはならない**。"
              f"物品名と住民名は英語クライアントの表記のまま。"),
    "ko":    (f"아래 모든 행은 커뮤니티 Steam 가이드 《Doloc Town - Character Gifts》(작성자 {SRC['author']})의 "
              f"데이터 표 두 장에서 그대로 옮긴 것이다. 선물을 쓰기 전에 알아둘 한계가 두 가지 있다. "
              f"작성자 본인이 \"아직 작업 중\"이라고 밝혔고 얼리 액세스 시기에 만든 자료라 1.0(2026년 8월 5일)보다 1년 이상 앞선다. "
              f"게다가 캐릭터 {len(RAW['villagers'])}명 중 {len(UNTESTED)}명은 데이터가 전혀 없다. "
              f"목록에 없는 물건은 그냥 아직 검증되지 않았을 수 있으며 **안전하다는 뜻이 아니다**. "
              f"아이템명과 주민 이름은 영어 클라이언트 표기 그대로 두었다."),
    "es":    (f"Cada fila procede de la guía comunitaria de Steam \"Doloc Town - Character Gifts\" de {SRC['author']}, "
              f"leída directamente de sus dos tablas. Dos límites antes de gastar un regalo: el autor indica que "
              f"\"sigue en proceso\" y la creó durante el Acceso Anticipado, más de un año antes de la 1.0 (5 de agosto de 2026); "
              f"y {len(UNTESTED)} de los {len(RAW['villagers'])} personajes no tienen datos. "
              f"Que un objeto no aparezca puede significar solo que nadie lo ha probado — no que sea seguro. "
              f"Los nombres se mantienen como aparecen en el cliente en inglés."),
}


# ---------- 页面组装 ----------
# 结论文案里的数字全部由上面的数据算出，不写死——改了数据源就自动跟着变。
_FF = len(IDX["Fern Fossil"]["likes"])
_HN = len(IDX["Honey"]["loves"]) + len(IDX["Honey"]["likes"])
_NV = len(IDX[NEVER[0]]["dislikes"])

_FIND = {
    "en": [
        f"Fern Fossil is the one true catch-all: {_FF} of the {N} villagers with data like it and nobody dislikes it. Honey is second at {_HN}/{N}, also with zero dislikes.",
        f"Never gift {J(NEVER)}. Each is disliked by {_NV} of {N} villagers and loved by none — they are the worst thing you can hand over.",
        _mixed_line("en"),
    ],
    "zh-CN": [
        f"Fern Fossil 是唯一真正的万能礼物：{N} 位有数据的村民里有 {_FF} 位喜欢，而且没有一个人讨厌。Honey 第二，{_HN}/{N}，同样零讨厌。",
        f"绝对别送 {J(NEVER)}。这三样每一样都被 {N} 人中的 {_NV} 人讨厌，没有任何人喜欢——是你能递出去的最差选择。",
        _mixed_line("zh-CN"),
    ],
    "ja": [
        f"Fern Fossil こそ唯一の万能ギフト。データのある {N} 人中 {_FF} 人が好み、嫌う人はゼロ。次点は Honey で {_HN}/{N}、こちらも嫌う人なし。",
        f"{J(NEVER)} は絶対に贈らないこと。どれも {N} 人中 {_NV} 人に嫌われ、好む人は一人もいない——渡せる中で最悪の品だ。",
        _mixed_line("ja"),
    ],
    "ko": [
        f"Fern Fossil이야말로 진짜 만능 선물이다. 데이터가 있는 주민 {N}명 중 {_FF}명이 좋아하고 싫어하는 사람은 한 명도 없다. 2위는 Honey로 {_HN}/{N}, 역시 싫어하는 사람이 없다.",
        f"{J(NEVER)}은 절대 주지 말 것. 각각 {N}명 중 {_NV}명이 싫어하고 좋아하는 사람은 아무도 없다. 건넬 수 있는 것 중 최악이다.",
        _mixed_line("ko"),
    ],
    "es": [
        f"Fern Fossil es el único regalo realmente universal: a {_FF} de los {N} aldeanos con datos les gusta y a nadie le disgusta. Honey va segundo con {_HN}/{N}, también sin rechazos.",
        f"Nunca regales {J(NEVER)}. A cada uno lo rechazan {_NV} de {N} aldeanos y no le gusta a ninguno — es lo peor que puedes entregar.",
        _mixed_line("es"),
    ],
}

_T = {  # 每语言的固定文案
 "en": {"title":"Doloc Town Gift Guide: Every Villager's Loves, Likes & Dislikes",
   "mt":"Doloc Town Gifts: Villager Loves, Likes & Dislikes",
   "md":f"Which gifts each Doloc Town villager loves, likes and dislikes — plus the {_FF}/{N} universal gift and the three items you should never hand over.",
   "intro":f"Give the right item and friendship jumps; give the wrong one and you have wasted a day. This page maps {len(ITEMS)} items against the {N} villagers the community has actually tested, from both directions: look up an item to see who wants it, or look up a villager to see what to bring.",
   "h_src":"Where This Data Comes From", "h_find":"Three Things Worth Knowing First",
   "h_item":"Look Up an Item — Who Wants It?", "b_item":"Sorted by how decisive the answer is: universal gifts first, then the items to avoid, then the ones villagers disagree about.",
   "h_vill":"Look Up a Villager — What Should I Bring?", "b_vill":f"The {N} villagers with community-tested data. The other {len(UNTESTED)} characters ({J(UNTESTED)}) have no gift data recorded yet.",
   "cols_i":["Item","Loved by","Liked by","Disliked by","Verdict"], "cols_v":["Villager","Loves","Likes","Dislikes"],
   "h_faq":"Quick Answers",
   "faq":[["What is the best all-purpose gift in Doloc Town?",f"Fern Fossil. Of the {N} villagers with tested data, {_FF} like it and none dislike it. Honey is a close second at {_HN}/{N} with no dislikes."],
          ["What should I never give as a gift?",f"{J(NEVER)}. Each is disliked by {_NV} of {N} villagers and loved by nobody."],
          ["Is there romance or marriage in Doloc Town?","No. The developers confirmed Doloc Town has no romance or marriage system — gifts raise friendship only."],
          ["Why do some villagers have no gifts listed?",f"The community guide this data comes from was built during Early Access and is explicitly unfinished. {len(UNTESTED)} characters have no entries at all, and an unlisted item may simply be untested rather than neutral."]]},
 "zh-CN": {"title":"多洛可小镇送礼指南：每位村民的喜好与雷区",
   "mt":"多洛可小镇送礼：村民喜好、讨厌物一览",
   "md":f"多洛可小镇每位村民爱什么、喜欢什么、讨厌什么——外加 {_FF}/{N} 的万能礼物，以及绝对不能送的三样东西。",
   "intro":f"送对了好感度猛涨，送错了白费一天。本页把 {len(ITEMS)} 件物品和社区实测过的 {N} 位村民做了双向对照：可以按物品查谁想要，也可以按村民查该带什么。",
   "h_src":"这些数据从哪来", "h_find":"先看这三条",
   "h_item":"按物品查——谁会要它？", "b_item":"按结论的确定程度排序：万能礼物在最前，其次是该避开的，最后是村民意见不一的。",
   "h_vill":"按村民查——该带什么？", "b_vill":f"社区已实测的 {N} 位村民。另外 {len(UNTESTED)} 个角色（{J(UNTESTED)}）目前没有任何礼物数据。",
   "cols_i":["物品","谁爱它","谁喜欢","谁讨厌","判定"], "cols_v":["村民","爱","喜欢","讨厌"],
   "h_faq":"快速解答",
   "faq":[["多洛可小镇最万能的礼物是什么？",f"Fern Fossil。在 {N} 位有实测数据的村民里，{_FF} 位喜欢它，没有一个人讨厌。Honey 紧随其后，{_HN}/{N}，同样零讨厌。"],
          ["什么东西绝对不能送？",f"{J(NEVER)}。这三样每样都被 {N} 人中的 {_NV} 人讨厌，且无人喜欢。"],
          ["多洛可小镇有恋爱或结婚系统吗？","没有。开发者已确认本作没有恋爱与结婚系统，送礼只提升友谊好感度。"],
          ["为什么有些村民没有礼物数据？",f"这份数据来自的社区攻略是抢先体验期做的，作者自述尚未完成。有 {len(UNTESTED)} 个角色完全没有条目；而某个物品没被列出，可能只是没人测过，不代表它是中性的。"]]},
 "ja": {"title":"ドロックタウン 贈り物ガイド：住民ごとの好みと地雷",
   "mt":"ドロックタウン 贈り物：住民の好き嫌い一覧",
   "md":f"ドロックタウンの住民が何を愛し、何を好み、何を嫌うか。{_FF}/{N} の万能ギフトと、絶対に渡してはいけない 3 品も掲載。",
   "intro":f"正しい品を渡せば友好度は跳ね上がり、間違えれば一日を無駄にする。本ページは {len(ITEMS)} 品とコミュニティが実際に検証した住民 {N} 人を双方向で対照した。品物から「誰が欲しがるか」を引くことも、住民から「何を持っていくか」を引くこともできる。",
   "h_src":"このデータの出どころ", "h_find":"まず知っておきたい 3 点",
   "h_item":"品物から引く——誰が欲しがる？", "b_item":"結論の確度順に並べた。万能ギフトが先、次に避けるべき品、最後に住民の評価が割れる品。",
   "h_vill":"住民から引く——何を持っていく？", "b_vill":f"コミュニティ検証済みの住民 {N} 人。残る {len(UNTESTED)} 人（{J(UNTESTED)}）は贈り物データが未記録。",
   "cols_i":["品物","愛する人","好む人","嫌う人","判定"], "cols_v":["住民","愛する","好む","嫌う"],
   "h_faq":"クイック回答",
   "faq":[["ドロックタウンで最も万能な贈り物は？",f"Fern Fossil。検証データのある住民 {N} 人中 {_FF} 人が好み、嫌う人はいない。次点は Honey で {_HN}/{N}、こちらも嫌う人なし。"],
          ["絶対に贈ってはいけない物は？",f"{J(NEVER)}。いずれも {N} 人中 {_NV} 人に嫌われ、好む人は皆無。"],
          ["ドロックタウンに恋愛や結婚はある？","ない。開発者が本作に恋愛・結婚システムは無いと明言している。贈り物は友好度のみを上げる。"],
          ["贈り物データが無い住民がいるのはなぜ？",f"元になったコミュニティガイドはアーリーアクセス期に作られ、作者自身が未完成と述べている。{len(UNTESTED)} 人は項目自体が無く、表に無い品は「中立」ではなく単に未検証の可能性がある。"]]},
 "ko": {"title":"돌록 타운 선물 가이드: 주민별 선호 아이템과 지뢰",
   "mt":"돌록 타운 선물: 주민 선호·비선호 정리",
   "md":f"돌록 타운 주민이 무엇을 아주 좋아하고, 좋아하고, 싫어하는지 정리했다. {_FF}/{N}의 만능 선물과 절대 주면 안 되는 세 가지도 함께.",
   "intro":f"제대로 주면 호감도가 크게 오르고, 잘못 주면 하루를 날린다. 이 문서는 아이템 {len(ITEMS)}종과 커뮤니티가 실제로 검증한 주민 {N}명을 양방향으로 대조했다. 아이템으로 누가 원하는지 찾을 수도, 주민으로 무엇을 가져갈지 찾을 수도 있다.",
   "h_src":"이 데이터의 출처", "h_find":"먼저 알아둘 세 가지",
   "h_item":"아이템으로 찾기 — 누가 원하나?", "b_item":"결론이 확실한 순서로 정렬했다. 만능 선물이 먼저, 그다음 피해야 할 것, 마지막이 주민마다 갈리는 것.",
   "h_vill":"주민으로 찾기 — 무엇을 가져갈까?", "b_vill":f"커뮤니티가 검증한 주민 {N}명. 나머지 {len(UNTESTED)}명({J(UNTESTED)})은 아직 선물 데이터가 없다.",
   "cols_i":["아이템","아주 좋아함","좋아함","싫어함","판정"], "cols_v":["주민","아주 좋아함","좋아함","싫어함"],
   "h_faq":"빠른 답변",
   "faq":[["돌록 타운에서 가장 무난한 선물은?",f"Fern Fossil이다. 검증 데이터가 있는 주민 {N}명 중 {_FF}명이 좋아하고 싫어하는 사람은 없다. 그다음은 Honey로 {_HN}/{N}, 역시 싫어하는 사람이 없다."],
          ["절대 주면 안 되는 것은?",f"{J(NEVER)}. 각각 주민 {N}명 중 {_NV}명이 싫어하고 좋아하는 사람은 아무도 없다."],
          ["돌록 타운에 연애나 결혼이 있나요?","없다. 개발진이 본작에 연애·결혼 시스템이 없다고 확인했다. 선물은 우정 호감도만 올린다."],
          ["선물 데이터가 없는 주민은 왜 그런가요?",f"출처인 커뮤니티 가이드는 얼리 액세스 시기에 작성됐고 작성자 본인이 미완성이라고 밝혔다. {len(UNTESTED)}명은 항목 자체가 없으며, 목록에 없는 아이템은 중립이 아니라 그냥 미검증일 수 있다."]]},
 "es": {"title":"Guía de regalos de Doloc Town: gustos y rechazos de cada aldeano",
   "mt":"Regalos de Doloc Town: gustos y rechazos por aldeano",
   "md":f"Qué adora, qué le gusta y qué rechaza cada aldeano de Doloc Town — más el regalo universal ({_FF}/{N}) y los tres objetos que nunca debes entregar.",
   "intro":f"Acierta con el objeto y la amistad sube de golpe; falla y habrás perdido el día. Esta página cruza {len(ITEMS)} objetos con los {N} aldeanos que la comunidad ha probado, en ambos sentidos: busca un objeto para ver quién lo quiere, o un aldeano para ver qué llevarle.",
   "h_src":"De dónde salen estos datos", "h_find":"Tres cosas que conviene saber antes",
   "h_item":"Buscar por objeto — ¿quién lo quiere?", "b_item":"Ordenado por lo concluyente de la respuesta: primero los regalos universales, luego los que hay que evitar y por último aquellos en los que los aldeanos discrepan.",
   "h_vill":"Buscar por aldeano — ¿qué le llevo?", "b_vill":f"Los {N} aldeanos con datos probados por la comunidad. Los otros {len(UNTESTED)} personajes ({J(UNTESTED)}) todavía no tienen datos de regalos.",
   "cols_i":["Objeto","Lo adoran","Les gusta","Lo rechazan","Veredicto"], "cols_v":["Aldeano","Adora","Le gusta","Rechaza"],
   "h_faq":"Respuestas rápidas",
   "faq":[["¿Cuál es el mejor regalo para todos en Doloc Town?",f"Fern Fossil. De los {N} aldeanos con datos probados, a {_FF} les gusta y a ninguno le disgusta. Honey queda segundo con {_HN}/{N}, también sin rechazos."],
          ["¿Qué no debo regalar nunca?",f"{J(NEVER)}. A cada uno lo rechazan {_NV} de {N} aldeanos y no le gusta a nadie."],
          ["¿Hay romance o matrimonio en Doloc Town?","No. Los desarrolladores confirmaron que Doloc Town no tiene sistema de romance ni de matrimonio; los regalos solo suben la amistad."],
          ["¿Por qué algunos aldeanos no tienen regalos listados?",f"La guía comunitaria de la que proceden los datos se hizo durante el Acceso Anticipado y su autor la declara inacabada. {len(UNTESTED)} personajes no tienen ninguna entrada, y que un objeto no aparezca puede significar solo que nadie lo ha probado."]]},
}


# ---------- romance 页 ----------
# ⚠️ 本作**没有**恋爱/结婚系统（官方确认 [L1]，见 docs/doloc-town-research.md）。
#    所以这页不是「恋爱攻略」，而是**否定式答案页**：直接回答"没有"，再讲实际机制是什么。
#    这类问题恰恰是大模型最容易凭空编造的（农场模拟游戏"应该"有恋爱），
#    我们做那个说清楚"没有"的权威答案。禁止在此页出现任何暗示存在恋爱系统的措辞。
_R = {
 "en": {"title":"Is There Romance in Doloc Town? The Straight Answer",
   "mt":"Doloc Town Romance: Is There Dating or Marriage?",
   "md":"Doloc Town has no romance or marriage (developers confirmed friendship-only). Social systems: gift tiers, heart events, festival reactions.",
   "intro":"Short answer: there is no dating, no courtship and no marriage in Doloc Town. The developers confirmed the social system is friendship-based. If you arrived here from a search expecting a romance guide, this page explains what exists instead — and it is a real progression system worth investing in.",
   "h_ans":"The Answer", "b_ans":"Doloc Town has no romance and no marriage mechanic. There are no bachelors or bachelorettes, no heart events that lead to a relationship, and no wedding. The developers stated this directly for the 1.0 release. Any guide promising a romance route is describing a different game — or guessing.",
   "h_instead":"What You Get Instead", "b_instead":"Friendship in Doloc Town is a progression system, not decoration.",
   "i_instead":["Hearts with every resident, raised by talking, gifting and completing quests.","Unique recipes gated behind individual friendships — ignore a villager and you lose their recipe permanently.","Personal storyline scenes that fill in the town's history and its mysteries.","Festivals, which are the highest-value friendship events in the calendar.","Kasia's max-friendship achievement, Blooming Friendship — the closest thing to a relationship milestone in the game."],
   "h_do":"If You Want To Get Closer To Someone", "b_do":"The mechanics reward routine over grinding.",
   "s_do":[["Talk to them every day","Free, takes seconds, and it is the base of every heart."],["Give what they actually like","Preferences differ sharply — the gift guide lists who wants what."],["Take their quests","Quests raise friendship faster per minute than anything else."],["Show up to festivals","Seasonal events give the biggest single boosts, including the 1.0 Mushroom Fest."]],
   "h_faq":"Quick Answers",
   "faq":[["Can you get married in Doloc Town?","No. There is no marriage system. The developers confirmed the game is friendship-based only."],["Are there romanceable characters?","No. Villagers have friendship hearts and personal storylines, but no romance route."],["Will romance be added later?","Nothing has been announced. Treat any claim otherwise as unverified until the developers say so."],["What is the closest thing to a relationship?","Maxing a villager's friendship. For Kasia this unlocks the Blooming Friendship achievement."]]},
 "zh-CN": {"title":"多洛可小镇有恋爱系统吗？直接答案",
   "mt":"多洛可小镇恋爱：能谈恋爱或结婚吗？",
   "md":"没有——多洛可小镇没有恋爱与结婚系统，开发者已确认社交是纯友谊向。本页说明实际的社交机制是什么。",
   "intro":"简短回答：多洛可小镇没有约会、没有追求、也没有结婚。开发者已确认社交系统是友谊向的。如果你是搜「恋爱攻略」来的，这一页告诉你实际存在的是什么——那是一套值得投入的真实养成系统。",
   "h_ans":"答案", "b_ans":"多洛可小镇没有恋爱、也没有结婚机制。没有可攻略对象，没有通向恋爱关系的剧情事件，没有婚礼。开发者在 1.0 发布时直接说明了这一点。任何承诺「恋爱路线」的攻略，要么写的是别的游戏，要么是在猜。",
   "h_instead":"实际有的是什么", "b_instead":"多洛可小镇的友谊是一套养成系统，不是装饰。",
   "i_instead":["和每位居民都有好感度，靠聊天、送礼、做委托提升。","专属食谱锁在各自的友谊进度后面——忽略某个村民，就永久失去他的food谱。","个人剧情场景，补完小镇的历史与谜团。","节日活动，是日历上友谊收益最高的事件。","卡莎的满好感成就 Blooming Friendship——游戏里最接近「关系里程碑」的东西。"],
   "h_do":"想和某人更亲近", "b_do":"这套机制奖励日常习惯，不奖励硬刷。",
   "s_do":[["每天和他说话","免费、几秒钟，是所有好感度的地基。"],["送他真正喜欢的东西","各人偏好差异极大——送礼指南列了谁要什么。"],["接他的委托","按每分钟收益算，委托涨好感最快。"],["节日一定到场","季节活动单次加成最大，包括 1.0 新增的蘑菇节。"]],
   "h_faq":"快速解答",
   "faq":[["多洛可小镇能结婚吗？","不能。没有结婚系统。开发者已确认本作只有友谊向社交。"],["有可攻略的角色吗？","没有。村民有友谊好感度和个人剧情，但没有恋爱路线。"],["以后会加入恋爱系统吗？","官方没有任何相关公告。在开发者明说之前，任何相反说法都视为未经证实。"],["最接近「恋爱关系」的是什么？","把某位村民的友谊刷满。卡莎刷满会解锁 Blooming Friendship 成就。"]]},
 "ja": {"title":"ドロックタウンに恋愛要素はある？——結論から",
   "mt":"ドロックタウンの恋愛：交際や結婚はできる？",
   "md":"無い——ドロックタウンに恋愛・結婚システムは存在しない。開発者が友情のみと明言している。実際の社交システムを解説。",
   "intro":"結論から言うと、ドロックタウンにデートも求愛も結婚も無い。開発者が社交システムは友情ベースだと明言している。恋愛攻略を探して辿り着いたなら、このページが「代わりに何があるか」を説明する——投資する価値のある本物の育成システムだ。",
   "h_ans":"結論", "b_ans":"ドロックタウンに恋愛も結婚も無い。攻略対象キャラも、交際に至るイベントも、結婚式も存在しない。開発者が 1.0 に際して明言している。恋愛ルートを謳うガイドは、別のゲームの話をしているか、推測で書いている。",
   "h_instead":"代わりにあるもの", "b_instead":"ドロックタウンの友情は飾りではなく育成システムだ。",
   "i_instead":["住民全員との好感度。会話・贈り物・クエストで上がる。","個別の友情の先にある専用レシピ——無視した住民のレシピは永久に手に入らない。","町の歴史と謎を埋める個人ストーリー。","カレンダー上で友好度の効率が最も高いイベント、祭り。","カシアの好感度最大実績 Blooming Friendship——本作で「関係の到達点」に最も近いもの。"],
   "h_do":"誰かと親しくなりたいなら", "b_do":"この仕組みは作業量ではなく日課を評価する。",
   "s_do":[["毎日話しかける","無料で数秒。すべての好感度の土台。"],["本当に好きな物を贈る","好みの差が大きい——贈り物ガイドに誰が何を欲しがるかを載せた。"],["クエストを受ける","時間あたりの好感度上昇は最も効率が良い。"],["祭りには必ず出る","季節イベントの一回あたりの上昇が最大。1.0 のキノコ祭も含む。"]],
   "h_faq":"クイック回答",
   "faq":[["ドロックタウンで結婚できる？","できない。結婚システムは無い。開発者が友情のみと確認している。"],["攻略できるキャラはいる？","いない。住民には友情の好感度と個人ストーリーがあるが、恋愛ルートは無い。"],["今後追加される？","公式発表は一切ない。開発者が明言するまで、それ以外の主張は未確認として扱うこと。"],["「関係」に最も近いものは？","住民の友情を最大まで上げること。カシアの場合は Blooming Friendship 実績が解除される。"]]},
 "ko": {"title":"돌록 타운에 연애 요소가 있나? 결론부터",
   "mt":"돌록 타운 연애: 연애나 결혼이 가능한가?",
   "md":"없다 — 돌록 타운에는 연애·결혼 시스템이 없다. 개발진이 우정 기반이라고 확인했다. 실제 사교 시스템이 무엇인지 정리했다.",
   "intro":"결론부터 말하면 돌록 타운에는 데이트도, 구애도, 결혼도 없다. 개발진이 사교 시스템은 우정 기반이라고 확인했다. 연애 공략을 찾다가 이 페이지에 왔다면, 대신 무엇이 있는지 알려주겠다. 투자할 가치가 있는 진짜 육성 시스템이다.",
   "h_ans":"결론", "b_ans":"돌록 타운에는 연애도 결혼도 없다. 공략 대상 캐릭터도, 연인 관계로 이어지는 이벤트도, 결혼식도 없다. 개발진이 1.0 출시에 맞춰 직접 밝힌 내용이다. 연애 루트를 약속하는 공략이 있다면 다른 게임 이야기이거나 추측이다.",
   "h_instead":"대신 있는 것", "b_instead":"돌록 타운의 우정은 장식이 아니라 육성 시스템이다.",
   "i_instead":["모든 주민과의 호감도. 대화·선물·의뢰로 올린다.","개별 우정 뒤에 잠긴 전용 레시피 — 한 주민을 무시하면 그 레시피는 영영 얻지 못한다.","마을의 역사와 수수께끼를 채우는 개인 스토리 장면.","달력에서 우정 효율이 가장 높은 이벤트인 축제.","카시아의 호감도 최대 도전과제 Blooming Friendship — 이 게임에서 '관계의 도달점'에 가장 가까운 것."],
   "h_do":"누군가와 더 가까워지고 싶다면", "b_do":"이 시스템은 노가다가 아니라 꾸준함을 보상한다.",
   "s_do":[["매일 말을 건다","공짜고 몇 초면 된다. 모든 호감도의 토대다."],["진짜 좋아하는 것을 준다","취향 차이가 크다 — 선물 가이드에 누가 무엇을 원하는지 정리해뒀다."],["의뢰를 받는다","시간 대비 호감도 상승은 의뢰가 가장 빠르다."],["축제에는 꼭 참석한다","계절 이벤트가 한 번에 주는 상승폭이 가장 크다. 1.0의 버섯 축제 포함."]],
   "h_faq":"빠른 답변",
   "faq":[["돌록 타운에서 결혼할 수 있나요?","없다. 결혼 시스템이 없다. 개발진이 우정 기반이라고 확인했다."],["공략 가능한 캐릭터가 있나요?","없다. 주민에게는 우정 호감도와 개인 스토리가 있지만 연애 루트는 없다."],["나중에 추가되나요?","공식 발표가 전혀 없다. 개발진이 밝히기 전까지는 미확인으로 봐야 한다."],["'연인 관계'에 가장 가까운 것은?","주민의 우정을 최대치까지 올리는 것. 카시아의 경우 Blooming Friendship 도전과제가 해금된다."]]},
 "es": {"title":"¿Hay romance en Doloc Town? La respuesta directa",
   "mt":"Romance en Doloc Town: ¿se puede tener pareja o casarse?",
   "md":"No — Doloc Town no tiene sistema de romance ni matrimonio. Los desarrolladores confirmaron que las relaciones son solo de amistad. Esto es lo que sí existe.",
   "intro":"Respuesta corta: en Doloc Town no hay citas, ni cortejo, ni matrimonio. Los desarrolladores confirmaron que el sistema social se basa en la amistad. Si llegaste buscando una guía de romance, esta página explica qué existe en su lugar — y es un sistema de progresión que merece la pena.",
   "h_ans":"La respuesta", "b_ans":"Doloc Town no tiene romance ni matrimonio. No hay personajes cortejables, ni eventos que lleven a una relación, ni boda. Los desarrolladores lo indicaron directamente para la 1.0. Cualquier guía que prometa una ruta romántica habla de otro juego o está adivinando.",
   "h_instead":"Lo que sí obtienes", "b_instead":"La amistad en Doloc Town es un sistema de progresión, no un adorno.",
   "i_instead":["Corazones con cada residente, que suben al hablar, regalar y completar encargos.","Recetas únicas tras cada amistad — si ignoras a un aldeano pierdes su receta para siempre.","Escenas de historia personal que rellenan el pasado del pueblo y sus misterios.","Festivales, los eventos de amistad más rentables del calendario.","El logro de amistad máxima de Kasia, Blooming Friendship — lo más parecido a un hito de relación."],
   "h_do":"Si quieres acercarte a alguien", "b_do":"Las mecánicas premian la rutina, no el farmeo.",
   "s_do":[["Háblale todos los días","Gratis, cuesta segundos y es la base de cada corazón."],["Regálale lo que de verdad le gusta","Las preferencias varían mucho — la guía de regalos indica quién quiere qué."],["Acepta sus encargos","Los encargos suben la amistad más rápido por minuto que cualquier otra cosa."],["Acude a los festivales","Los eventos de temporada dan el mayor impulso, incluida la Fiesta de las Setas de la 1.0."]],
   "h_faq":"Respuestas rápidas",
   "faq":[["¿Se puede uno casar en Doloc Town?","No. No hay sistema de matrimonio. Los desarrolladores confirmaron que el juego es solo de amistad."],["¿Hay personajes romanceables?","No. Los aldeanos tienen corazones de amistad e historias personales, pero ninguna ruta romántica."],["¿Se añadirá el romance más adelante?","No se ha anunciado nada. Considera no verificada cualquier afirmación en contra hasta que lo digan los desarrolladores."],["¿Qué es lo más parecido a una relación?","Llevar la amistad de un aldeano al máximo. Con Kasia desbloquea el logro Blooming Friendship."]]},
}

LANGS = ["en", "zh-CN", "ja", "ko", "es"]


def _gifts(lang):
    t, w = _T[lang], VERDICT_W[lang]
    return {"heading_set": [t["h_src"], t["h_find"], t["h_item"], t["h_vill"], t["h_faq"]],
            "sections": [
      {"type":"note", "heading":t["h_src"], "body":SOURCE_NOTE[lang]},
      {"type":"list", "heading":t["h_find"], "items":_FIND[lang]},
      {"type":"giftfilter"},
      {"type":"table","heading":t["h_item"],"body":t["b_item"],"columns":t["cols_i"],"rows":item_rows(lang),"rowAttrs":item_attrs()},
      {"type":"table","heading":t["h_vill"],"body":t["b_vill"],"columns":t["cols_v"],"rows":villager_rows()},
      {"type":"faq", "heading":t["h_faq"], "items":t["faq"]},
    ]}


def _romance(lang):
    r = _R[lang]
    return {"sections": [
      {"type":"note", "heading":r["h_ans"], "body":r["b_ans"]},
      {"type":"list", "heading":r["h_instead"], "body":r["b_instead"], "items":r["i_instead"]},
      {"type":"steps","heading":r["h_do"], "body":r["b_do"], "items":r["s_do"]},
      {"type":"faq",  "heading":r["h_faq"], "items":r["faq"]},
    ]}


def en_pages():
    """注入 site.base.json 的两页（en）。"""
    g, t, r = _gifts("en"), _T["en"], _R["en"]
    return [
      {"slug":"gifts","title":t["title"],"metaTitle":t["mt"],"metaDescription":t["md"],
       "intro":t["intro"],"sections":g["sections"],"meta":{"icon":"friendship"},
       "sources":[{"label":"Steam Community guide: Doloc Town - Character Gifts (community-tested, Early Access era)","url":SRC["url"]},
                  {"label":"Official Steam page — Doloc Town","url":"https://store.steampowered.com/app/2285550/Doloc_Town/"}]},
      {"slug":"romance","title":r["title"],"metaTitle":r["mt"],"metaDescription":r["md"],
       "intro":r["intro"],"sections":_romance("en")["sections"],"meta":{"icon":"friendship"},
       "sources":[{"label":"Official Steam page — Doloc Town (friendship & festivals)","url":"https://store.steampowered.com/app/2285550/Doloc_Town/"},
                  {"label":"Developer statement on 1.0: no romance or marriage system","url":"https://store.steampowered.com/news/app/2285550"}]},
    ]


def translations(lang):
    """返回 {slug: {title, metaTitle, metaDescription, intro, sections}}，供 apply_lang 用。"""
    t, r = _T[lang], _R[lang]
    return {
      "gifts":   {"title":t["title"],"metaTitle":t["mt"],"metaDescription":t["md"],
                  "intro":t["intro"],"sections":_gifts(lang)["sections"]},
      "romance": {"title":r["title"],"metaTitle":r["mt"],"metaDescription":r["md"],
                  "intro":r["intro"],"sections":_romance(lang)["sections"]},
    }
