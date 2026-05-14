# -*- coding: utf-8 -*-
# streamlit_app_corrected.py
# 한솔 재단 ｜ 아이키움 ｜ 교사의 발견 Manual Automation 데모 앱
# 실행: streamlit run streamlit_app_corrected.py

import re
import random
import tempfile
import sqlite3
import pandas as pd
from datetime import datetime
from pathlib import Path

import streamlit as st
import matplotlib.pyplot as plt


st.set_page_config(
    page_title="교사의 발견",
    page_icon="🌿",
    layout="wide"
)

st.markdown(
    """
    <style>
    /* 전체 여백 정리 */
    .block-container {
        padding-top: 2rem;
        padding-left: 3rem;
        padding-right: 3rem;
        max-width: 1100px;
    }

    /* 메인 제목 */
    h1 {
        font-size: 42px !important;
        line-height: 1.25 !important;
        letter-spacing: -1px !important;
    }

    h2, h3 {
        letter-spacing: -0.5px !important;
    }

    /* 버튼 크기 */
    .stButton > button {
        min-height: 42px;
        border-radius: 10px;
        font-weight: 600;
    }

    /* 입력창, 선택창 */
    input, textarea, select {
        font-size: 16px !important;
    }

    /* 탭 글자 */
    button[data-baseweb="tab"] {
        font-size: 15px !important;
        white-space: nowrap;
    }

    /* 안내 문구 */
    .small-guide {
        color:#9AA1A9;
        font-size:13px;
        margin-top:-6px;
        margin-bottom:14px;
    }

    /* 모바일 대응 */
    @media (max-width: 768px) {
        .block-container {
            padding-top: 1.2rem;
            padding-left: 1rem;
            padding-right: 1rem;
            max-width: 100%;
        }

        h1 {
            font-size: 30px !important;
            line-height: 1.25 !important;
            letter-spacing: -0.8px !important;
        }

        h2 {
            font-size: 24px !important;
        }

        h3 {
            font-size: 21px !important;
        }

        p, div, span, label {
            font-size: 15px !important;
        }

        .stButton > button {
            width: 100%;
            min-height: 46px;
            font-size: 15px !important;
        }

        button[data-baseweb="tab"] {
            font-size: 13px !important;
            padding-left: 8px !important;
            padding-right: 8px !important;
        }

        .stSlider {
            padding-bottom: 8px;
        }
    }
    </style>
    """,
    unsafe_allow_html=True
)

st.markdown(
    """
    <meta name="google" content="notranslate">
    """,
    unsafe_allow_html=True
)

st.markdown(
    """
    <style>
    body {
        translate: no;
    }
    </style>
    """,
    unsafe_allow_html=True
)


DB_PATH = "witti_data.db"


def init_db():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    cur.execute("""
    CREATE TABLE IF NOT EXISTS subscribers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at TEXT,
        institution_name TEXT,
        institution_group TEXT,
        institution_type TEXT,
        institution_feature TEXT,
        phone TEXT,
        subscriber_name TEXT,
        position TEXT,
        email TEXT,
        privacy_agree TEXT,
        mailing_agree TEXT
    )
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS diary_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at TEXT,
        teacher_tone TEXT,
        daily_scope TEXT,
        original_text TEXT,
        summary TEXT,
        generated_message TEXT
    )
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS teacher_temperature_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at TEXT,
        diary_type TEXT,
        memory TEXT,
        emotion TEXT,
        temperature TEXT,
        average_temp REAL,
        temp_message TEXT,
        result_text TEXT
    )
    """)

    conn.commit()
    conn.close()


def save_subscriber(data):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    cur.execute("""
    INSERT INTO subscribers (
        created_at, institution_name, institution_group, institution_type,
        institution_feature, phone, subscriber_name, position, email,
        privacy_agree, mailing_agree
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        data["기관명"],
        data["기관 구분"],
        data["기관 유형"],
        data["기관 특성"],
        data["기관 연락처"],
        data["가입자 성명"],
        data["직책"],
        data["이메일"],
        str(data["개인정보 동의"]),
        str(data["메일링 수신 동의"]),
    ))

    conn.commit()
    conn.close()


def save_diary_log(teacher_tone, daily_scope, original_text, summary, generated_message):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    cur.execute("""
    INSERT INTO diary_logs (
        created_at, teacher_tone, daily_scope, original_text, summary, generated_message
    ) VALUES (?, ?, ?, ?, ?, ?)
    """, (
        datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        teacher_tone,
        daily_scope,
        original_text,
        summary,
        generated_message,
    ))

    conn.commit()
    conn.close()


def save_temperature_log(diary_type, memory, emotion, temperature, average_temp, temp_message, result_text):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    cur.execute("""
    INSERT INTO teacher_temperature_logs (
        created_at, diary_type, memory, emotion, temperature,
        average_temp, temp_message, result_text
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        diary_type,
        memory,
        emotion,
        temperature,
        average_temp,
        temp_message,
        result_text,
    ))

    conn.commit()
    conn.close()


def load_table(table_name):
    conn = sqlite3.connect(DB_PATH)
    df = pd.read_sql_query(f"SELECT * FROM {table_name} ORDER BY id DESC", conn)
    conn.close()
    return df

from PIL import Image, ImageEnhance
import io
import streamlit as st

from manual_automation_app import (
    rank_images,
    enhance_images_in_dir,
)


def clean_sentence(sentence: str) -> str:
    sentence = sentence.strip()
    sentence = sentence.replace("- ", "")
    sentence = sentence.replace("ㆍ", "")
    sentence = re.sub(r"\s+", " ", sentence)

    replacements = {
        "하였다.": "했습니다.",
        "했다.": "했습니다.",
        "한다.": "합니다.",
        "보았다.": "보았습니다.",
        "말했다.": "말했습니다.",
        "물었다.": "물었습니다.",
        "가졌다.": "가졌습니다.",
        "나갔다.": "나갔습니다.",
        "먹었다.": "먹었습니다.",
        "읽었다.": "읽었습니다.",
        "살펴보았다.": "살펴보았습니다.",
        "참여하였다.": "참여했습니다.",
        "표현하였다.": "표현했습니다.",
        "경험하였다.": "경험했습니다.",
        "놀이하였다.": "놀이했습니다.",
    }
    for old, new in replacements.items():
        sentence = sentence.replace(old, new)
    return sentence


def split_sentences(text: str) -> list[str]:
    raw = re.split(r"(?<=[.!?。])\s+|\n+", text)
    sentences = []
    for sentence in raw:
        sentence = clean_sentence(sentence)
        if len(sentence) >= 10:
            sentences.append(sentence)
    return sentences


def make_core_summary(text: str, max_sentences: int = 3) -> str:
    sentences = split_sentences(text)
    keywords = [
        "동화", "놀이", "활동", "산책", "식사", "휴식", "대화",
        "질문", "탐색", "표현", "관찰", "친구", "교사", "참여",
        "관심", "경험", "만들", "그리", "읽", "말",
    ]
    scored = []
    for idx, sentence in enumerate(sentences):
        score = sum(1 for keyword in keywords if keyword in sentence)
        score += max(0, 3 - idx) * 0.3
        scored.append((idx, score, sentence))

    if not scored:
        return ""

    selected = sorted(scored, key=lambda x: x[1], reverse=True)[:max_sentences]
    selected = sorted(selected, key=lambda x: x[0])
    return "\n".join([f"- {sentence}" for _, _, sentence in selected])


def remove_bullets(summary: str) -> str:
    text = summary.replace("- ", " ").replace("\n", " ")
    return re.sub(r"\s+", " ", text).strip()


def make_diary_message(summary: str, teacher_tone: str, daily_scope: str) -> str:
    clean_summary = remove_bullets(summary)
    scope_phrases = {
        "놀이 장면 중심": "놀이 중 보인 참여와 상호작용을 중심으로 전해드립니다.",
        "일상생활 중심": "식사, 휴식, 전이 등 일상 속 모습을 중심으로 전해드립니다.",
        "하루 전체 흐름": "하루 흐름 속에서 보인 아이들의 모습을 전해드립니다.",
        "특별활동 중심": "특별활동에서 보인 아이들의 경험을 중심으로 전해드립니다.",
    }
    scope_sentence = scope_phrases[daily_scope]

    if teacher_tone == "팩트 중심형":
        return f"오늘 아이들의 모습을 간단히 전해드립니다. {clean_summary} {scope_sentence}"
    if teacher_tone == "따뜻한 감성형":
        return f"오늘 아이들은 하루 속에서 즐겁게 참여하는 모습을 보여주었어요. {clean_summary} 아이들의 작은 표현과 반응이 참 소중하게 느껴지는 하루였습니다."
    if teacher_tone == "이모티콘 활용형":
        return f"오늘 우리 아이들은 즐겁게 하루를 보냈어요 😊 {clean_summary} 가정에서도 오늘의 이야기를 함께 나누어 주세요 🌿"
    if teacher_tone == "전문적 설명형":
        return f"오늘 활동에서는 아이들의 참여 과정과 반응을 중심으로 살펴볼 수 있었습니다. {clean_summary} 이러한 경험은 아이들의 탐색과 표현, 관계 경험을 넓히는 데 도움이 되었습니다."
    return clean_summary

st.set_page_config(page_title="[교사의 발견] 현장 지원을 위한 업무 자동화 파일럿 서비스 ", page_icon="🌿", layout="wide")
init_db()
st.title("🌿 교사의 발견_현장 업무 자동화 파일럿 서비스")

with st.sidebar:
    st.header("⚙️ 설정")

    top_k = st.slider(
        "선별할 사진 수",
        min_value=1,
        max_value=20,
        value=5
    )

    max_summary_sentences = st.slider(
        "알림장 요약 문장 수",
        min_value=1,
        max_value=10,
        value=3
    )

    st.divider()

    st.markdown("### 🌿 이용 안내")
    st.caption("☞ 사진 선별과 기록 , 사진 보정, 알림장 작성, 교사의 하루 기록을 한 곳에서 사용할 수 있습니다.")
    st.caption("☞ 업로드한 사진과 입력한 내용은 서비스 기능 실행을 위해서만 사용됩니다.")
    st.caption("☞ 본 플랫폼의 링크만 있으면, 모바일과 PC에서 모두 활용 가능합니다.")

tab1, tab2, tab3, tab4, tab5, tab6 = st.tabs([
    "💬 소통",
    "📸 사진 선별",
    "✨ 사진 보정",
    "📝 알림장 작성",
    "🌿 교사의 온도",
    "🔐 관리자",
])

work_dir = Path(tempfile.mkdtemp())
input_image_dir = work_dir / "input_images"
enhanced_dir = work_dir / "enhanced_images"
input_image_dir.mkdir(parents=True, exist_ok=True)
enhanced_dir.mkdir(parents=True, exist_ok=True)

with tab1:
    st.subheader("💬 함께 소통해요")
    st.write("교사의 발견 소식과 자료를 받아볼 수 있도록 기본 정보를 입력해 주세요.")

    st.markdown("### 1. 기관 기본 정보")

    institution_name = st.text_input(
        "기관명",
        placeholder="예: 한솔 / 아이키움 "
    )

    institution_group = st.selectbox(
        "기관 구분",
        ["어린이집", "유치원"]
    )

    if institution_group == "유치원":
        institution_type = st.selectbox(
            "유치원 유형",
            ["국립", "공립 단설", "공립 병설", "사립 법인", "사립 사인", "기타"]
        )

    else:
        institution_type = st.selectbox(
            "어린이집 유형",
            ["국공립", "사회복지법인", "법인·단체 등", "민간", "가정", "협동", "직장", "기타"]
        )

    institution_feature = st.multiselect(
        "기관 특성",
        [
            "일반",
            "장애통합",
            "다문화",
            "야간연장",
            "시간제보육",
            "방과후 과정",
            "숲·생태 특화",
            "놀이중심 운영",
            "부모참여 활성화",
            "기타"
        ]
    )

    st.caption(
        "※ 기관 특성은 현재 유치원 알리미와 자동 연동되지 않습니다. "
        "본 플랫폼에서는 사용자가 직접 선택하는 방식으로 운영합니다."
    )

    st.markdown("### 2. 기관 연락처")

    area_code = st.selectbox(
        "지역번호",
        ["02", "031", "032", "033", "041", "042", "043", "044", "051", "052", "053", "054", "055", "061", "062", "063", "064", "070"]
    )

    phone_number = st.text_input(
        "기관 연락처",
        placeholder="예: 1234-5678"
    )

    full_phone = f"{area_code}-{phone_number}" if phone_number else ""

    st.markdown("### 3. 가입자 정보")

    subscriber_name = st.text_input(
        "가입자 성명",
        placeholder="예: 홍길동"
    )

    position = st.selectbox(
        "직책",
        ["원장", "원감", "선임교사", "주임교사", "경력교사", "신입교사", "예비(실습)교사", "기타"]
    )

    st.markdown("### 4. 이메일 정보")

    email_id = st.text_input(
        "이메일 아이디",
        placeholder="예: witti"
    )

    email_domain = st.selectbox(
        "이메일 도메인",
        ["gmail.com", "naver.com", "daum.net", "hanmail.net", "kakao.com", "직접 입력"]
    )

    if email_domain == "직접 입력":
        custom_domain = st.text_input(
            "도메인 직접 입력",
            placeholder="예: example.com"
        )
        email = f"{email_id}@{custom_domain}" if email_id and custom_domain else ""
    else:
        email = f"{email_id}@{email_domain}" if email_id else ""

    st.markdown("### 5. 동의 항목")

    privacy_agree = st.checkbox(
        "개인정보 수집 및 이용에 동의합니다. 입력한 정보는 교사의 발견 소식, 자료 안내, 서비스 개선 및 문의 응대를 위한 목적으로만 활용됩니다."
    )

    mailing_agree = st.checkbox(
        "메일링 수신에 동의합니다. 교사의 발견 콘텐츠, 자료, 소식 안내를 이메일로 받아보겠습니다."
    )

    if st.button("정보 제출하기"):
        if not institution_name:
            st.warning("기관명을 입력해 주세요.")
        elif not phone_number:
            st.warning("기관 연락처를 입력해 주세요.")
        elif not subscriber_name:
            st.warning("가입자 성명을 입력해 주세요.")
        elif not email_id:
            st.warning("이메일 아이디를 입력해 주세요.")
        elif email_domain == "직접 입력" and not custom_domain:
            st.warning("이메일 도메인을 직접 입력해 주세요.")
        elif not privacy_agree:
            st.warning("개인정보 수집 및 이용 동의가 필요합니다.")
        else:
            submitted_data = {
                "기관명": institution_name,
                "기관 구분": institution_group,
                "기관 유형": institution_type,
                "기관 특성": ", ".join(institution_feature),
                "기관 연락처": full_phone,
                "가입자 성명": subscriber_name,
                "직책": position,
                "이메일": email,
                "개인정보 동의": privacy_agree,
                "메일링 수신 동의": mailing_agree,
            }

            save_subscriber(submitted_data)

            st.success("정보가 제출되었습니다.")
            st.json(submitted_data)


with tab2:
    st.subheader("📸 A급 사진 선별")
    st.write("20장 이내의 사진을 올리면 선명도와 밝기를 기준으로 상위 사진을 골라냅니다.")

    uploaded_images = st.file_uploader("사진을 업로드하세요", type=["jpg", "jpeg", "png"], accept_multiple_files=True, key="photo_selector")
    if uploaded_images:
        for uploaded_file in uploaded_images:
            save_path = input_image_dir / uploaded_file.name
            with open(save_path, "wb") as f:
                f.write(uploaded_file.getbuffer())
        ranked = rank_images(str(input_image_dir))
        selected = ranked[:top_k]
        st.success(f"총 {len(uploaded_images)}장 중 상위 {len(selected)}장을 선별했습니다.")
        cols = st.columns(min(len(selected), 3))
        for idx, (image_path, score) in enumerate(selected):
            with cols[idx % len(cols)]:
                st.image(image_path, caption=f"Top {idx + 1} / 점수: {score:.1f}", use_container_width=True)

    st.divider()
    st.subheader("💡 사진 기반 놀이 설명 자동 생성")
    st.write("선택한 사진 장면을 바탕으로 놀이 의미, 발달 의미, 부모 전달 문장을 함께 생성합니다.")

    play_keyword = st.text_input("사진 속 놀이 키워드 입력", placeholder="예: 숲체험, 감자캐기, 블록쌓기, 물감놀이")
    age_group = st.selectbox("연령 선택", ["0세", "1세", "2세", "3세", "4세", "5세"])
    curriculum_area = st.selectbox("누리과정 영역 선택", ["신체운동·건강", "의사소통", "사회관계", "예술경험", "자연탐구"])
    development_area = st.selectbox("발달영역 선택", ["신체", "언어", "인지", "사회정서", "창의성"])
    observation_type = st.selectbox("의도에 따른 유형 선택", ["알림장용", "관찰기록용", "서술형 일지용", "기관홍보용"])

    parent_type = None
    if observation_type == "알림장용":
        parent_type = st.selectbox("부모 성향 선택", ["일반형", "불안형", "정보형", "감성형"])

    child_action = st.selectbox(
        "사진 속 아이들의 모습 선택",
        [
            "호기심을 보이며 탐색하는 모습",
            "친구와 함께 협력하는 모습",
            "자신의 생각을 표현하는 모습",
            "반복하며 시도하는 모습",
            "새로운 방법을 찾아보는 모습",
            "교사의 지원을 받아 안정적으로 참여하는 모습",
        ],
    )

    child_label = "영아" if age_group in ["0세", "1세", "2세"] else "유아"

    age_templates_notice = {
        "0세": "눈으로 보고 손으로 만지며 감각적으로 경험했어요.",
        "1세": "관심 있는 대상을 반복해서 살펴보며 즐겁게 참여했어요.",
        "2세": "좋아하는 놀이에 관심을 보이며 말과 행동으로 표현해 보았어요.",
        "3세": "상상과 역할을 더해 놀이를 확장해 보았어요.",
        "4세": "친구들과 생각을 나누며 놀이를 이어갔어요.",
        "5세": "규칙과 협력을 바탕으로 놀이를 주도해 보았어요.",
    }
    age_templates_record = {
        "0세": "감각적으로 보고, 만지고, 반응하며 놀이를 경험함.",
        "1세": "관심 있는 대상을 반복적으로 탐색하며 안정감을 느끼는 모습이 관찰됨.",
        "2세": "좋아하는 놀이를 반복하며 말과 행동으로 표현하려는 모습을 보임.",
        "3세": "상상과 역할을 더해 놀이를 확장하는 모습을 보임.",
        "4세": "친구들과 의견을 나누며 놀이를 이어가는 모습을 보임.",
        "5세": "규칙과 협력을 바탕으로 놀이를 주도하고 확장하는 모습을 보임.",
    }
    curriculum_templates_record = {
        "신체운동·건강": "신체 움직임을 조절하고 건강하게 놀이에 참여하는 경험과 연결됨.",
        "의사소통": "자신의 생각과 느낌을 말이나 행동으로 표현하는 경험과 연결됨.",
        "사회관계": "친구와 관계를 맺고 함께 놀이를 이어가는 경험과 연결됨.",
        "예술경험": "느낌과 생각을 다양한 방식으로 표현하는 경험과 연결됨.",
        "자연탐구": "주변 세계에 호기심을 가지고 관찰하고 탐색하는 경험과 연결됨.",
    }
    development_templates_record = {
        "신체": "신체 조절력과 움직임의 자신감을 키워가는 과정이 나타남.",
        "언어": "새로운 어휘와 표현을 시도하며 언어적 경험을 확장함.",
        "인지": "비교하고 관찰하며 사고를 넓혀가는 모습이 나타남.",
        "사회정서": "친구와 감정을 나누고 관계 속에서 안정감을 경험함.",
        "창의성": "새로운 방법을 떠올리고 자신만의 방식으로 표현함.",
    }

    parent_templates = {
        "일반형": [
            "가정에서도 오늘 경험한 이야기를 편안하게 나누어 보시면 좋겠습니다.",
            "OO이의 작은 표현과 반응을 함께 응원해 주세요.",
            "오늘의 경험이 OO이에게 즐거운 기억으로 남았으면 좋겠습니다.",
        ],
        "불안형": [
            "OO이의 속도에 맞추어 천천히 경험하고 있으니 편안하게 지켜봐 주세요.",
            "처음에는 조심스러워도 조금씩 놀이에 익숙해지는 모습을 보이고 있습니다.",
            "아이마다 참여하는 속도가 다르니 오늘의 작은 시도도 소중하게 봐주시면 좋겠습니다.",
        ],
        "정보형": [
            "이 활동은 OO이가 직접 보고 만지고 표현해 보는 경험으로 이어졌습니다.",
            "놀이 과정에서 탐색, 표현, 관계 경험이 자연스럽게 함께 이루어졌습니다.",
            "오늘 활동은 OO이가 스스로 시도하고 주변을 살펴보는 데 도움이 되었습니다.",
        ],
        "감성형": [
            "작은 손짓과 표정 속에서도 OO이가 즐거움이 잘 느껴졌습니다.",
            "OO이의 하루 안에 반짝이는 장면이 하나 더 쌓였습니다.",
            "오늘의 놀이가 OO이 마음속에 따뜻한 기억으로 남기를 바랍니다.",
        ]
    }

    observation_templates = {
        "알림장용": [
            "오늘은 {keyword} 활동을 해보았습니다. OO이는 {action}을 보이며 즐겁게 참여했습니다.",
            "{keyword} 활동 시간에 OO이가 {action}을 보여주었습니다.",
            "오늘 {keyword} 놀이를 하며 OO이가 스스로 관심을 보이고 참여하는 모습을 볼 수 있었습니다.",
            "{keyword} 활동 속에서 OO이는 편안하게 놀이에 참여했습니다.",
        ],

        "관찰기록용": [
            "{keyword} 활동 중 {child}는 {action}을 보임.",
            "{child}는 {keyword} 상황에서 교사의 지원에 반응하며 활동에 참여함.",
            "{keyword} 놀이 과정에서 {child}는 주변 자극에 관심을 보이고 탐색을 시도함.",
            "{child}는 {keyword} 활동 중 또래 또는 교사와의 상호작용을 보임.",
        ],

        "서술형 일지용": [
            "{keyword} 활동을 통해 {child}가 놀이에 참여하는 모습을 관찰할 수 있었다.",
            "오늘 {keyword} 활동에서는 {child}의 참여 과정과 반응을 중심으로 살펴볼 수 있었다.",
            "{keyword} 놀이 과정에서 {child}는 자신의 방식으로 활동에 참여하였다.",
            "교사는 {keyword} 활동 중 {child}의 반응을 살피며 놀이가 이어질 수 있도록 지원하였다.",
        ],

        "기관홍보용": [
            "오늘 우리 아이들은 {keyword} 활동을 통해 즐겁게 배우는 시간을 가졌습니다.",
            "{keyword} 활동 안에서 아이들은 직접 경험하고 느끼며 놀이를 이어갔습니다.",
            "우리 기관은 아이들이 놀이 속에서 자연스럽게 배우고 성장할 수 있도록 다양한 경험을 마련하고 있습니다.",
            "아이들의 작은 호기심이 {keyword} 활동 속에서 즐거운 배움으로 이어졌습니다.",
        ],
    }

    if st.button("사진 기반 놀이 설명 생성"):
        if play_keyword:
            selected_sentences = random.sample(observation_templates[observation_type], k=min(3, len(observation_templates[observation_type])))
            st.success("사진 기반 놀이 설명이 생성되었습니다.")
            for idx, sentence in enumerate(selected_sentences, start=1):
                base_sentence = sentence.format(keyword=play_keyword, action=child_action, child=child_label)
                if observation_type == "알림장용":
                    final_result = f"{base_sentence} {age_templates_notice[age_group]}"
                    if parent_type:
                        final_result += f" {random.choice(parent_templates[parent_type])}"
                elif observation_type == "관찰기록용":
                    final_result = f"{base_sentence} {development_templates_record[development_area]}"
                elif observation_type == "서술형 일지용":
                    final_result = f"{base_sentence} {curriculum_templates_record[curriculum_area]} {development_templates_record[development_area]}"
                elif observation_type == "기관홍보용":
                    final_result = f"{base_sentence} {age_templates_notice[age_group]}"
                st.write(f"{idx}. {final_result}")
        else:
            st.warning("사진 속 놀이 키워드를 입력해 주세요.")


with tab3:
    st.subheader("✨ 초간편 사진 보정")
    st.write("원본과 보정본을 비교하며 밝기, 대비, 채도, 선명도를 직접 조절할 수 있습니다.")

    uploaded_for_enhance = st.file_uploader(
        "보정할 사진을 업로드하세요",
        type=["jpg", "jpeg", "png"],
        accept_multiple_files=False,
        key="photo_enhancer",
    )

    auto_enhance = st.button("⚡ 자동 보정 적용")

    if auto_enhance:
        brightness_default = 1.15
        contrast_default = 1.25
        saturation_default = 1.20
        sharpness_default = 1.35
    else:
        brightness_default = 1.1
        contrast_default = 1.2
        saturation_default = 1.2
        sharpness_default = 1.3

    brightness_value = st.slider(
        "밝기 조절",
        min_value=0.5,
        max_value=2.0,
        value=brightness_default,
        step=0.1
    )

    contrast_value = st.slider(
        "대비 조절",
        min_value=0.5,
        max_value=2.0,
        value=contrast_default,
        step=0.1
    )

    saturation_value = st.slider(
        "채도 조절",
        min_value=0.5,
        max_value=2.0,
        value=saturation_default,
        step=0.1
    )

    sharpness_value = st.slider(
        "선명도 조절",
        min_value=0.5,
        max_value=2.0,
        value=sharpness_default,
        step=0.1
    )

    if uploaded_for_enhance:
        import io
        from PIL import Image, ImageEnhance

        original_image = Image.open(uploaded_for_enhance).convert("RGB")

        enhanced_image = original_image.copy()
        enhanced_image = ImageEnhance.Brightness(enhanced_image).enhance(brightness_value)
        enhanced_image = ImageEnhance.Contrast(enhanced_image).enhance(contrast_value)
        enhanced_image = ImageEnhance.Color(enhanced_image).enhance(saturation_value)
        enhanced_image = ImageEnhance.Sharpness(enhanced_image).enhance(sharpness_value)

        st.success("이미지 보정이 적용되었습니다.")

        col1, col2 = st.columns(2)

        with col1:
            st.markdown("### 원본 사진")
            st.image(original_image, use_container_width=True)

        with col2:
            st.markdown("### 보정 사진")
            st.image(enhanced_image, use_container_width=True)

        img_buffer = io.BytesIO()
        enhanced_image.save(img_buffer, format="JPEG")
        img_buffer.seek(0)

        st.download_button(
            label="보정 이미지 다운로드",
            data=img_buffer,
            file_name="enhanced_image.jpg",
            mime="image/jpeg"
        )

with tab4:
    st.subheader("📝 알림장 요약 및 생성")
    st.write("알림장 초안을 입력하면 핵심 내용을 요약하고, 선택한 기록 성향에 맞게 알림장 문장을 생성합니다.")

    teacher_tone = st.selectbox(
        "기록 성향 선택",
        ["팩트 중심형", "따뜻한 감성형", "이모티콘 활용형", "전문적 설명형"]
    )

    daily_scope = st.selectbox(
        "하루일과 전달 범위 선택",
        ["놀이 장면 중심", "일상생활 중심", "하루 전체 흐름", "특별활동 중심"]
    )

    diary_text = st.text_area(
        "일지 내용을 붙여넣으세요",
        height=250,
        placeholder="예: 오늘은 아이들과 함께 봄 소풍을 다녀왔다...",
    )

    tone_templates = {
        "팩트 중심형": {
            "prefix": "오늘은",
            "ending": "활동에 참여했습니다.",
            "style": "핵심 사실을 중심으로 간결하게 전달합니다."
        },
        "따뜻한 감성형": {
            "prefix": "오늘 아이들은",
            "ending": "따뜻한 하루를 보냈습니다.",
            "style": "아이들의 표정과 감정을 부드럽게 담아 전달합니다."
        },
        "이모티콘 활용형": {
            "prefix": "오늘 우리 아이들은 😊",
            "ending": "즐거운 시간을 보냈습니다 🌿",
            "style": "이모티콘을 활용해 친근하고 밝게 전달합니다."
        },
        "전문적 설명형": {
            "prefix": "오늘 활동에서는",
            "ending": "경험을 통해 발달적 의미를 확장했습니다.",
            "style": "놀이의 의미와 발달적 해석을 함께 전달합니다."
        },
    }

    scope_templates = {
        "놀이 장면 중심": "놀이 중 나타난 아이들의 참여와 상호작용을 중심으로 정리했습니다.",
        "일상생활 중심": "식사, 휴식, 전이, 정리 등 일상생활 속 모습을 중심으로 정리했습니다.",
        "하루 전체 흐름": "등원부터 놀이, 식사, 휴식, 마무리까지 하루 흐름을 중심으로 정리했습니다.",
        "특별활동 중심": "특별활동이나 행사 장면에서 나타난 아이들의 경험을 중심으로 정리했습니다.",
    }

    if st.button("알림장 요약 및 생성하기"):
        if diary_text.strip():

            summary = make_core_summary(
                diary_text,
                max_sentences=max_summary_sentences
            )

            generated_message = make_diary_message(
                summary,
                teacher_tone,
                daily_scope
            )

            save_diary_log(
                teacher_tone=teacher_tone,
                daily_scope=daily_scope,
                original_text=diary_text,
                summary=summary,
                generated_message=generated_message
            )

            st.success("알림장 요약과 생성이 완료되었습니다.")

            st.markdown("### 요약 결과")
            st.markdown(
                f"""
                <div style='color:black; background-color:#f5f5f5; padding:16px; border-radius:10px; line-height:1.8;'>
                {summary.replace(chr(10), "<br>")}
                </div>
                """,
                unsafe_allow_html=True
            )

            st.markdown("### 생성된 알림장 문장")
            st.markdown(
                f"""
                <div style='color:#1E5EFF; background-color:#EEF4FF; padding:16px; border-radius:10px; line-height:1.8;'>
                {generated_message}
                </div>
                """,
                unsafe_allow_html=True
            )

            st.download_button(
                label="생성된 알림장 다운로드",
                data=generated_message.encode("utf-8"),
                file_name="generated_diary_message.txt",
                mime="text/plain",
            )

        else:
            st.warning("요약할 일지 내용을 먼저 입력해 주세요.")
  
with tab5:
    st.subheader("🌡️ 지금 그리고 오늘, 교사의 온도")

    st.markdown(
        """
        <style>
        .letter-box {
            font-family:  'KyoboHandwriting2023', 'Nanum Brush Script', 'Malgun Gothic', cursive;
            font-size: 18px;
            line-height: 1.8;
            color: #333333;
            background-color: #FFF9F2;
            padding: 24px;
            border-radius: 18px;
            border: 1px solid #F1DEC8;
            white-space: pre-wrap;
            letter-spacing: -0.2px;
            margin-top: 12px;
        }
        </style>
        """,
        unsafe_allow_html=True
    )

    st.write("하루를 마무리하며, 교사의 마음을 짧게 기록하는 감성 기록 공간입니다.")

    diary_type = st.radio(
        "기록 양식 선택",
        ["🕯️ 감성 일기", "✒️ 3줄 요약 다이어리"],
        horizontal=True
    )

    st.divider()

    # =========================
    # 감성 일기
    # =========================

    if diary_type == "🕯️ 감성 일기":

        st.markdown("### 🕯️ 감성 일기")

        one_line_options = [
            "오늘도 아이들 곁에서 충분히 애쓴 하루였습니다.",
            "조금 지쳤지만, 그래도 마음이 따뜻해지는 순간이 있었습니다.",
            "작은 웃음 하나가 긴 하루를 버티게 해주었습니다.",
            "바쁜 하루였지만 아이들의 반응 속에서 힘을 얻었습니다.",
            "완벽하지 않아도 괜찮았던 하루였습니다.",
            "직접 입력"
        ]

        one_line_choice = st.selectbox(
            "오늘의 한 줄 문장",
            one_line_options
        )

        if one_line_choice == "직접 입력":
            one_line = st.text_input(
                "오늘의 한 줄 문장 직접 입력"
            )
        else:
            one_line = one_line_choice

        best_moment_options = [
            "아이의 웃음이 가장 기억에 남았습니다.",
            "예상하지 못한 아이의 말 한마디가 마음에 남았습니다.",
            "함께 놀이하던 순간의 따뜻한 분위기가 좋았습니다.",
            "힘든 중에도 아이들이 즐겁게 참여하는 모습이 빛났습니다.",
            "동료와 주고받은 작은 응원이 기억에 남았습니다.",
            "직접 입력"
        ]

        best_moment_choice = st.selectbox(
            "가장 빛났던 순간",
            best_moment_options
        )

        if best_moment_choice == "직접 입력":
            best_moment = st.text_area(
                "가장 빛났던 순간 직접 입력"
            )
        else:
            best_moment = best_moment_choice

        emotion_options = [
            "따뜻한",
            "차분한",
            "벅찬",
            "지친",
            "뿌듯한",
            "복잡한",
            "고요한",
            "열정적인",
            "직접 입력"
        ]

        emotion_choice = st.selectbox(
            "오늘 내 마음을 표현하는 단어",
            emotion_options
        )

        if emotion_choice == "직접 입력":
            emotion_word = st.text_input(
                "감정 직접 입력",
                placeholder="예: 몽글몽글한, 단단한, 흔들리는"
            )
        else:
            emotion_word = emotion_choice

        self_message_options = [
            "오늘도 충분히 잘했어.",
            "완벽하지 않아도 괜찮아.",
            "내가 버틴 하루도 소중해.",
            "조금 쉬어가도 괜찮아.",
            "내일의 나는 오늘의 나에게 고마워할 거야.",
            "직접 입력"
        ]

        self_message_choice = st.selectbox(
            "나에게 한마디",
            self_message_options
        )

        if self_message_choice == "직접 입력":
            self_message = st.text_input(
                "나에게 한마디 직접 입력"
            )
        else:
            self_message = self_message_choice

        if st.button("감성 일기 생성"):

            result = (
                f"오늘 하루를 돌아보면, {one_line}\n\n"
                f"그중 가장 마음에 남는 순간은 {best_moment}\n\n"
                f"오늘 내 마음은 {emotion_word} 쪽에 가까웠어요.\n\n"
                f"그래도 나에게 이렇게 말해주고 싶어요.\n"
                f"{self_message}"
            )

            save_temperature_log(
                diary_type="감성 일기",
                memory=best_moment,
                emotion=emotion_word,
                temperature="",
                average_temp=None,
                temp_message="",
                result_text=result
            )

            st.success("감성 일기가 생성되었습니다.")

            st.markdown("### 생성 결과")

            st.markdown(
                f"<div class='letter-box'>{result}</div>",
                unsafe_allow_html=True
            )

    # =========================
    # 3줄 요약 다이어리
    # =========================

    elif diary_type == "✒️ 3줄 요약 다이어리":

        st.markdown("### ✒️ 3줄 요약 다이어리")

        st.write(
            "선택한 기억, 감정, 온도 값을 바탕으로 오늘의 평균 마음온도를 자동 계산합니다."
        )

        # 기억
        memory_options = [
            "아이의 웃음이 오래 기억에 남았습니다.",
            "예상하지 못한 아이의 표현이 마음에 남았습니다.",
            "함께 놀이하던 장면이 오늘의 가장 특별한 순간이었습니다.",
            "동료와 나눈 짧은 대화가 힘이 되었습니다.",
            "하루를 무사히 마무리한 것이 가장 큰 일이었습니다.",
            "직접 입력"
        ]

        memory_temperature = {
            "아이의 웃음이 오래 기억에 남았습니다.": 38.0,
            "예상하지 못한 아이의 표현이 마음에 남았습니다.": 37.5,
            "함께 놀이하던 장면이 오늘의 가장 특별한 순간이었습니다.": 37.0,
            "동료와 나눈 짧은 대화가 힘이 되었습니다.": 36.5,
            "하루를 무사히 마무리한 것이 가장 큰 일이었습니다.": 35.5,
            "직접 입력": 36.5,
        }

        memory_choice = st.selectbox(
            "기억 Memory",
            memory_options
        )

        if memory_choice == "직접 입력":
            memory = st.text_input("기억 직접 입력")
        else:
            memory = memory_choice

        # 감정
        emotion_options = [
            "뿌듯함이 남았습니다.",
            "조금 지쳤지만 따뜻함도 있었습니다.",
            "마음이 복잡했지만 잘 버텼습니다.",
            "작은 장면 하나에 위로를 받았습니다.",
            "생각보다 괜찮은 하루였습니다.",
            "직접 입력"
        ]

        emotion_temperature = {
            "뿌듯함이 남았습니다.": 38.5,
            "조금 지쳤지만 따뜻함도 있었습니다.": 36.5,
            "마음이 복잡했지만 잘 버텼습니다.": 34.5,
            "작은 장면 하나에 위로를 받았습니다.": 37.0,
            "생각보다 괜찮은 하루였습니다.": 36.0,
            "직접 입력": 36.5,
        }

        emotion_choice = st.selectbox(
            "감정 Emotion",
            emotion_options
        )

        if emotion_choice == "직접 입력":
            emotion = st.text_input("감정 직접 입력")
        else:
            emotion = emotion_choice

        # 온도
        temperature_options = [
            "따뜻한 36.5℃",
            "차분한 35℃",
            "열정적인 40℃",
            "조금 지친 32℃",
            "다시 회복 중인 34℃",
            "직접 입력"
        ]

        temperature_temperature = {
            "따뜻한 36.5℃": 36.5,
            "차분한 35℃": 35.0,
            "열정적인 40℃": 40.0,
            "조금 지친 32℃": 32.0,
            "다시 회복 중인 34℃": 34.0,
            "직접 입력": 36.5,
        }

        temperature_choice = st.selectbox(
            "온도 Temperature",
            temperature_options
        )

        if temperature_choice == "직접 입력":
            temperature = st.text_input(
                "온도 직접 입력",
                placeholder="예: 몽글몽글한 37℃"
            )
        else:
            temperature = temperature_choice

        # 생성 버튼
        if st.button("3줄 다이어리 생성"):

            average_temp = round(
                (
                    memory_temperature[memory_choice] * 0.25
                    + emotion_temperature[emotion_choice] * 0.25
                    + temperature_temperature[temperature_choice] * 0.50
                ),
                1
            )

            if average_temp >= 38:
                temp_message = "오늘은 마음의 에너지가 꽤 높았던 하루예요."

            elif average_temp >= 36:
                temp_message = "따뜻함과 안정감이 남아 있는 하루예요."

            elif average_temp >= 34:
                temp_message = "조금 지쳤지만 잘 버텨낸 하루예요."

            else:
                temp_message = "마음의 온도가 낮아진 날이에요. 오늘은 회복이 먼저예요."

            result = (
                f"오늘 하루를 돌아보면, {memory}\n\n"
                f"그 순간의 내 마음에는 {emotion}\n\n"
                f"그래서 오늘의 마음온도는 {temperature}에 가까웠어요.\n\n"
                f"{temp_message}\n\n"
                f"오늘도 충분히 애쓴 하루였어요."
            )

            save_temperature_log(
                diary_type="3줄 요약 다이어리",
                memory=memory,
                emotion=emotion,
                temperature=temperature,
                average_temp=average_temp,
                temp_message=temp_message,
                result_text=result
            )

            st.success("3줄 요약 다이어리가 생성되었습니다.")

            st.metric(
                label="🌡️ 선생님들의 오늘, 평균 마음온도",
                value=f"{average_temp}℃"
            )

            st.info(temp_message)

            st.markdown("### 생성 결과")

            st.markdown(
                f"<div class='letter-box'>{result}</div>",
                unsafe_allow_html=True
            )


with tab6:
    ADMIN_ID = "admin"
    ADMIN_PW = "witti7942"

    st.subheader("🔐 관리자 모드")

    with st.expander("관리자 메뉴 열기", expanded=False):
        st.write("가입자 정보와 생성 기록을 확인하고 CSV로 다운로드할 수 있습니다.")

        admin_id = st.text_input("관리자 아이디", key="admin_id_input")
        admin_pw = st.text_input("관리자 비밀번호", type="password", key="admin_pw_input")

        if st.button("관리자 로그인", key="admin_login_button"):
            if admin_id.strip() == ADMIN_ID and admin_pw.strip() == ADMIN_PW:
                st.session_state["admin_logged_in"] = True
                st.success("관리자 로그인에 성공했습니다.")
            else:
                st.session_state["admin_logged_in"] = False
                st.error("아이디 또는 비밀번호가 올바르지 않습니다.")

        if st.session_state.get("admin_logged_in"):

            st.markdown("### 📊 데이터 분석 대시보드")

            dashboard_period = st.selectbox(
                "조회 단위",
                ["전체", "오늘", "최근 7일", "이번 달"],
                key="dashboard_period_select"
            )

            subscribers_df = load_table("subscribers")
            diary_df = load_table("diary_logs")
            temp_df = load_table("teacher_temperature_logs")

            def filter_by_period(df, period):
                if df.empty or "created_at" not in df.columns:
                    return df

                df = df.copy()
                df["created_at_dt"] = pd.to_datetime(df["created_at"], errors="coerce")
                now = pd.Timestamp.now()

                if period == "오늘":
                    return df[df["created_at_dt"].dt.date == now.date()]

                elif period == "최근 7일":
                    start_date = now - pd.Timedelta(days=7)
                    return df[df["created_at_dt"] >= start_date]

                elif period == "이번 달":
                    return df[
                        (df["created_at_dt"].dt.year == now.year)
                        & (df["created_at_dt"].dt.month == now.month)
                    ]

                return df

            subscribers_filtered = filter_by_period(subscribers_df, dashboard_period)
            diary_filtered = filter_by_period(diary_df, dashboard_period)
            temp_filtered = filter_by_period(temp_df, dashboard_period)

            total_subscribers = len(subscribers_filtered)
            total_diary_logs = len(diary_filtered)
            total_temp_logs = len(temp_filtered)

            if not subscribers_filtered.empty and "mailing_agree" in subscribers_filtered.columns:
                mailing_count = subscribers_filtered[
                    subscribers_filtered["mailing_agree"].astype(str) == "True"
                ].shape[0]
            else:
                mailing_count = 0

            if not temp_filtered.empty and "average_temp" in temp_filtered.columns:
                valid_temp = temp_filtered["average_temp"].dropna()
                avg_teacher_temp = round(valid_temp.mean(), 1) if len(valid_temp) > 0 else 0
            else:
                avg_teacher_temp = 0

            col1, col2, col3, col4 = st.columns(4)

            col1.metric("가입자 수", f"{total_subscribers}명")
            col2.metric("메일링 동의", f"{mailing_count}명")
            col3.metric("알림장 생성", f"{total_diary_logs}건")
            col4.metric("교사의 온도 기록", f"{total_temp_logs}건")

            st.metric(
                label="평균 마음온도",
                value=f"{avg_teacher_temp}℃" if avg_teacher_temp else "기록 없음"
            )

            st.divider()

            col_a, col_b = st.columns(2)

            def draw_pie_chart(series, title):
                fig, ax = plt.subplots()
                ax.pie(
                    series.values,
                    labels=series.index,
                    autopct="%1.1f%%",
                    startangle=90
                )
                ax.set_title(title)
                ax.axis("equal")
                st.pyplot(fig)

            with col_a:
                st.markdown("#### 기록 유형 분포")

                if not temp_filtered.empty and "diary_type" in temp_filtered.columns:
                    diary_type_counts = temp_filtered["diary_type"].value_counts()
                    draw_pie_chart(diary_type_counts, "기록 유형 분포")
                else:
                    st.caption("해당 기간의 교사 온도 기록이 없습니다.")

            with col_b:
                st.markdown("#### 알림장 기록 성향 분포")

                if not diary_filtered.empty and "teacher_tone" in diary_filtered.columns:
                    tone_counts = diary_filtered["teacher_tone"].value_counts()
                    draw_pie_chart(tone_counts, "알림장 기록 성향 분포")
                else:
                    st.caption("해당 기간의 알림장 생성 기록이 없습니다.")

            st.divider()

            admin_menu = st.selectbox(
                "조회할 데이터 선택",
                ["가입자 정보", "알림장 생성 기록", "교사의 온도 기록"],
                key="admin_data_select"
            )

            if admin_menu == "가입자 정보":
                df = load_table("subscribers")
                file_name = "subscribers.csv"

            elif admin_menu == "알림장 생성 기록":
                df = load_table("diary_logs")
                file_name = "diary_logs.csv"

            else:
                df = load_table("teacher_temperature_logs")
                file_name = "teacher_temperature_logs.csv"

            df = filter_by_period(df, dashboard_period)

            column_rename = {
                "id": "번호",
                "created_at": "생성일시",

                "institution_name": "기관명",
                "institution_group": "기관 구분",
                "institution_type": "기관 유형",
                "institution_feature": "기관 특성",
                "phone": "연락처",
                "subscriber_name": "가입자 성명",
                "position": "직책",
                "email": "이메일",
                "privacy_agree": "개인정보 동의",
                "mailing_agree": "메일링 동의",

                "teacher_tone": "교사 전달 말투",
                "daily_scope": "하루일과 전달 범위",
                "original_text": "원문",
                "summary": "요약 결과",
                "generated_message": "생성된 알림장",

                "diary_type": "기록 유형",
                "memory": "기억",
                "emotion": "감정",
                "temperature": "교사 온도",
                "average_temp": "평균 마음온도",
                "temp_message": "온도 해석",
                "result_text": "생성 결과",
                "created_at_dt": "조회용 날짜",
            }

            df = df.rename(columns=column_rename)

            if "조회용 날짜" in df.columns:
                df = df.drop(columns=["조회용 날짜"])

            st.dataframe(df, use_container_width=True)

            csv = df.to_csv(index=False).encode("utf-8-sig")

            st.download_button(
                label="CSV 다운로드",
                data=csv,
                file_name=file_name,
                mime="text/csv",
                key="admin_csv_download"
            )
