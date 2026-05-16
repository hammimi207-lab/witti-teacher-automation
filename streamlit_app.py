# -*- coding: utf-8 -*-
# 교사의 발견_현장 업무 자동화 파일럿 서비스
# 실행: streamlit run streamlit_app.py

import re
import io
import random
import sqlite3
import tempfile
from datetime import datetime
from pathlib import Path

import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import pandas as pd
import streamlit as st
from PIL import Image, ImageEnhance
from streamlit_javascript import st_javascript

try:
    import altair as alt
except Exception:
    alt = None

from manual_automation_app import rank_images

st.set_page_config(page_title="교사의 발견", page_icon="🌿", layout="wide")

st.markdown("""
<meta name="google" content="notranslate">
<style>
body { translate: no; }
.block-container { padding-top: 2rem; padding-left: 3rem; padding-right: 3rem; max-width: 1100px; }
h1 { font-size: 42px !important; line-height: 1.25 !important; letter-spacing: -1px !important; }
h2, h3 { letter-spacing: -0.5px !important; }
.stButton > button { min-height: 42px; border-radius: 10px; font-weight: 600; }
input, textarea, select { font-size: 16px !important; }
button[data-baseweb="tab"] { font-size: 15px !important; white-space: nowrap; }
.small-guide { color:#9AA1A9; font-size:13px; margin-top:-6px; margin-bottom:14px; }
.letter-box { font-family: 'Pretendard', 'SUIT', 'Noto Sans KR', 'Malgun Gothic', sans-serif; font-size: 18px; line-height: 1.8; color: #333333; background-color: #FFF9F2; padding: 24px; border-radius: 18px; border: 1px solid #F1DEC8; white-space: pre-wrap; letter-spacing: -0.2px; margin-top: 12px; }
.result-card-blue { color:#1E5EFF; background-color:#EEF4FF; padding:16px; border-radius:10px; line-height:1.8; white-space:pre-wrap; }
.result-card-gray { color:#111111; background-color:#F5F5F5; padding:16px; border-radius:10px; line-height:1.8; white-space:pre-wrap; }
@media (max-width: 768px) {
    .block-container { padding-top: 1.2rem; padding-left: 1rem; padding-right: 1rem; max-width: 100%; }
    h1 { font-size: 36px !important; line-height: 1.18 !important; letter-spacing: -1px !important; }
    h2 { font-size: 25px !important; }
    h3 { font-size: 22px !important; }
    p, div, span, label { font-size: 15px !important; }
    .stButton > button { width: 100%; min-height: 46px; font-size: 15px !important; }
    button[data-baseweb="tab"] { font-size: 13px !important; padding-left: 8px !important; padding-right: 8px !important; }
    .stSlider { padding-top: 0px !important; padding-bottom: 4px !important; }
    .letter-box { font-size: 17px !important; line-height: 1.75 !important; padding: 18px !important; }
}
</style>
""", unsafe_allow_html=True)


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
        mailing_agree TEXT,
        deleted INTEGER DEFAULT 0
    )
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS diary_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at TEXT,
        record_type TEXT,
        teacher_tone TEXT,
        daily_scope TEXT,
        original_text TEXT,
        summary TEXT,
        generated_message TEXT,
        deleted INTEGER DEFAULT 0
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
        result_text TEXT,
        deleted INTEGER DEFAULT 0
    )
    """)

    conn.commit()
    conn.close()


def ensure_db_columns():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    required_columns = {
        "subscribers": {
            "deleted": "INTEGER DEFAULT 0"
        },
        "diary_logs": {
            "record_type": "TEXT",
            "deleted": "INTEGER DEFAULT 0"
        },
        "teacher_temperature_logs": {
            "deleted": "INTEGER DEFAULT 0"
        }
    }

    for table_name, columns_to_add in required_columns.items():
        cur.execute(f"PRAGMA table_info({table_name})")
        existing_columns = [column[1] for column in cur.fetchall()]

        for column_name, column_type in columns_to_add.items():
            if column_name not in existing_columns:
                cur.execute(
                    f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_type}"
                )

    cur.execute("""
    UPDATE diary_logs
    SET record_type = '알림장용'
    WHERE record_type IS NULL OR record_type = ''
    """)

    conn.commit()
    conn.close()


def save_subscriber(data):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    cur.execute("""
    INSERT INTO subscribers (
        created_at,
        institution_name,
        institution_group,
        institution_type,
        institution_feature,
        phone,
        subscriber_name,
        position,
        email,
        privacy_agree,
        mailing_agree
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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


def save_diary_log(record_type, teacher_tone, daily_scope, original_text, summary, generated_message):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    cur.execute("""
    INSERT INTO diary_logs (
        created_at,
        record_type,
        teacher_tone,
        daily_scope,
        original_text,
        summary,
        generated_message
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (
        datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        record_type,
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
        created_at,
        diary_type,
        memory,
        emotion,
        temperature,
        average_temp,
        temp_message,
        result_text
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
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


def load_table(table_name, include_deleted=False):
    conn = sqlite3.connect(DB_PATH)

    query = f"SELECT * FROM {table_name}"

    if not include_deleted:
        columns = pd.read_sql_query(f"PRAGMA table_info({table_name})", conn)
        column_names = columns["name"].tolist()

        if "deleted" in column_names:
            query += " WHERE deleted = 0"

    query += " ORDER BY id DESC"

    df = pd.read_sql_query(query, conn)
    conn.close()

    return df


def soft_delete_record(table_name, record_id):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    cur.execute(
        f"UPDATE {table_name} SET deleted = 1 WHERE id = ?",
        (record_id,)
    )

    conn.commit()
    conn.close()


def restore_record(table_name, record_id):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    cur.execute(
        f"UPDATE {table_name} SET deleted = 0 WHERE id = ?",
        (record_id,)
    )

    conn.commit()
    conn.close()


def draw_category_chart(series: pd.Series, title: str):
    if series.empty:
        st.caption("표시할 데이터가 없습니다.")
        return

    chart_df = series.reset_index()
    chart_df.columns = ["범주", "건수"]

    if alt is not None:
        chart = alt.Chart(chart_df).mark_arc(innerRadius=45).encode(
            theta=alt.Theta(field="건수", type="quantitative"),
            color=alt.Color(
                field="범주",
                type="nominal",
                legend=alt.Legend(title=None)
            ),
            tooltip=["범주", "건수"],
        ).properties(
            height=260,
            title=title
        )

        st.altair_chart(chart, use_container_width=True)
    else:
        st.bar_chart(chart_df.set_index("범주"))


def filter_by_period(df: pd.DataFrame, period: str) -> pd.DataFrame:
    if df.empty or "created_at" not in df.columns:
        return df

    df = df.copy()
    df["created_at_dt"] = pd.to_datetime(df["created_at"], errors="coerce")

    now = pd.Timestamp.now()

    if period == "오늘":
        return df[df["created_at_dt"].dt.date == now.date()]

    if period == "최근 7일":
        start_date = now - pd.Timedelta(days=7)
        return df[df["created_at_dt"] >= start_date]

    if period == "이번 달":
        return df[
            (df["created_at_dt"].dt.year == now.year)
            & (df["created_at_dt"].dt.month == now.month)
        ]

    return df

init_db()
ensure_db_columns()

st.title("🌿 교사의 발견_현장 업무 자동화 파일럿 서비스")
st.markdown("""
<div class="small-guide">
💡 본 플랫폼은 PC 또는 모바일에서 활용 가능합니다. 업로드한 사진과 일지 내용은 외부 서버로 전송되지 않습니다.<br>
💡 크롬 자동 번역 사용 시 일부 문장이 자연스럽지 않게 보일 수 있습니다.
</div>
""", unsafe_allow_html=True)

with st.sidebar:
    st.header("⚙️ 설정")
    top_k = st.slider("선별할 사진 수", min_value=1, max_value=20, value=5)
    max_summary_sentences = st.slider("알림장 요약 문장 수", min_value=1, max_value=10, value=3)
    st.divider()
    st.markdown("### 🌿 이용 안내")
    st.caption("☞ 사진 선별과 기록, 사진 보정, 알림장 작성, 교사의 하루 기록을 한 곳에서 사용할 수 있습니다.")
    st.caption("☞ 업로드한 사진과 입력한 내용은 서비스 기능 실행을 위해서만 사용됩니다.")
    st.caption("☞ 본 플랫폼의 링크만 있으면 모바일과 PC에서 모두 활용 가능합니다.")

tab1, tab2, tab3, tab4, tab5, tab6 = st.tabs(["💬 소통", "🧚‍♀️ 기록 요정", "✨ 사진 보정", "📝 알림장", "🌿 교사의 온도", "🔐 관리자"])

work_dir = Path(tempfile.mkdtemp())
input_image_dir = work_dir / "input_images"
input_image_dir.mkdir(parents=True, exist_ok=True)


def send_verification_email(to_email, code):
    sender_email = st.secrets["email"]["sender"]
    app_password = st.secrets["email"]["password"]

    subject = "[교사의 발견] 이메일 인증번호 안내"

    body = f"""
<html>
<body style="
    font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif;
    background:#f7f8fc;
    padding:40px 20px;
    color:#222;
">

<div style="
    max-width:520px;
    margin:0 auto;
    background:white;
    border-radius:20px;
    padding:40px 32px;
    box-shadow:0 6px 24px rgba(0,0,0,0.06);
">

    <div style="font-size:28px; font-weight:700; margin-bottom:12px; color:#1f2c4f;">
        🌿 교사의 발견
    </div>

    <div style="font-size:20px; font-weight:600; margin-bottom:24px;">
        이메일 인증번호 안내
    </div>

    <div style="font-size:16px; line-height:1.8; margin-bottom:28px;">
        안녕하세요.<br>
        교사의 발견 이메일 인증번호를 안내드립니다.<br><br>
        아래 인증번호를 입력해 인증을 완료해 주세요.
    </div>

    <div style="
        background:#f2f5ff;
        border:2px dashed #8ea8ff;
        border-radius:16px;
        padding:24px;
        text-align:center;
        margin-bottom:32px;
    ">
        <div style="font-size:14px; color:#666; margin-bottom:10px;">
            인증번호
        </div>

        <div style="font-size:38px; font-weight:800; letter-spacing:8px; color:#304ffe;">
            {code}
        </div>
    </div>

    <div style="font-size:14px; color:#777; line-height:1.7;">
        인증번호 메일이 보이지 않으면<br>
        스팸함 또는 프로모션함을 확인해 주세요. 
    </div>


</div>

</body>
</html>
"""

    message = MIMEMultipart()
    message["From"] = sender_email
    message["To"] = to_email
    message["Subject"] = subject
    message.attach(MIMEText(body, "html", "utf-8"))

    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
        server.login(sender_email, app_password)
        server.send_message(message)


# =========================
# TAB 1. 소통
# =========================
with tab1:
    st.subheader("💬 함께 소통해요")
    st.write("교사의 발견 소식과 자료를 받아볼 수 있도록 기본 정보를 입력해 주세요.")

    st.markdown("### 1. 기관 기본 정보")
    institution_name = st.text_input(
        "기관명",
        placeholder="예: 한솔 / 아이키움",
        key="join_institution_name"
    )

    institution_group = st.selectbox(
        "기관 구분",
        ["- 선택 -", "어린이집", "유치원"],
        key="join_institution_group"
    )

    if institution_group == "유치원":
        institution_type = st.selectbox(
            "유치원 유형",
            ["- 선택 -", "국립", "공립 단설", "공립 병설", "사립 법인", "사립 사인", "기타"],
            key="join_kinder_type"
        )
    elif institution_group == "어린이집":
        institution_type = st.selectbox(
            "어린이집 유형",
            ["- 선택 -", "국공립", "사회복지법인", "법인·단체 등", "민간", "가정", "협동", "직장", "기타"],
            key="join_childcare_type"
        )
    else:
        institution_type = "- 선택 -"

    institution_feature = st.multiselect(
        "기관 특성",
        ["일반", "장애통합", "다문화", "야간연장", "시간제보육", "방과후 과정", "숲·생태 특화", "놀이중심 운영", "부모참여 활성화", "기타"],
        key="join_institution_feature"
    )

    st.caption("※ 기관 특성은 현재 유치원 알리미와 자동 연동되지 않습니다. 본 플랫폼에서는 사용자가 직접 선택하는 방식으로 운영합니다.")

    st.markdown("### 2. 기관 연락처")
    phone_col1, phone_col2 = st.columns([1, 3])

    with phone_col1:
        area_code = st.selectbox(
            "지역번호",
            ["02", "031", "032", "033", "041", "042", "043", "044", "051", "052", "053", "054", "055", "061", "062", "063", "064", "070"],
            key="join_area_code"
        )

    with phone_col2:
        phone_number = st.text_input(
            "기관 연락처",
            placeholder="예: 1234-5678",
            key="join_phone_number"
        )
    st.caption("※ 기관 연락처를 정확하게 입력해주세요.")

    full_phone = f"{area_code}-{phone_number}" if phone_number else ""

    st.markdown("### 3. 가입자 정보")
    user_col1, user_col2 = st.columns([2, 2])

    with user_col1:
        subscriber_name = st.text_input(
            "가입자 성명",
            placeholder="예: 홍길동",
            key="join_subscriber_name"
        )

    st.caption("※ 본 플랫폼은 개별 맞춤 정보 제공을 위해 개인 회원가입 후 이용이 가능합니다.")

    with user_col2:
        position = st.selectbox(
            "직책",
            ["- 선택 -", "원장", "원감", "선임교사", "주임교사", "경력교사", "신입교사", "예비(실습)교사", "기타"],
            key="join_position"
        )

    st.markdown("### 4. 이메일 정보 및 인증")

    email_col1, email_col2 = st.columns([2, 2])

    with email_col1:
        email_id = st.text_input(
            "이메일 아이디",
            placeholder="예: witti",
            key="join_email_id"
        )

    with email_col2:
        email_domain = st.selectbox(
            "이메일 도메인",
            ["- 선택 -", "gmail.com", "naver.com", "daum.net", "hanmail.net", "kakao.com", "직접 입력"],
            key="join_email_domain"
        )

    custom_domain = ""
    if email_domain == "직접 입력":
        custom_domain = st.text_input(
            "도메인 직접 입력",
            placeholder="예: example.com",
            key="join_custom_domain"
        )
        email = f"{email_id}@{custom_domain}" if email_id and custom_domain else ""
    elif email_domain != "- 선택 -":
        email = f"{email_id}@{email_domain}" if email_id else ""
    else:
        email = ""

    if "email_verification_code" not in st.session_state:
        st.session_state["email_verification_code"] = ""

    if "email_verified" not in st.session_state:
        st.session_state["email_verified"] = False

    st.markdown("#### 이메일 인증")

    verify_col1, verify_col2, verify_col3 = st.columns([1.2, 2.2, 1])

    with verify_col1:
        send_code = st.button(
            "인증번호 받기",
            key="create_email_code",
            use_container_width=True
        )

    with verify_col2:
        input_code = st.text_input(
            "인증번호 입력",
            placeholder="6자리 인증번호 입력",
            label_visibility="collapsed",
            key="email_code_input"
        )

    with verify_col3:
        verify_email = st.button(
            "인증 확인",
            key="check_email_code",
            use_container_width=True
        )

    if send_code:
        if not email:
            st.warning("이메일을 먼저 입력해 주세요.")
        else:
            code = str(random.randint(100000, 999999))
            st.session_state["email_verification_code"] = code
            st.session_state["email_verified"] = False

            try:
                send_verification_email(email, code)
                st.success("인증번호를 이메일로 보냈습니다.")
            except Exception as e:
                st.error("이메일 발송 중 오류가 발생했습니다.")
                st.caption(str(e))

    if verify_email:
        if input_code == st.session_state["email_verification_code"] and input_code:
            st.session_state["email_verified"] = True
            st.success("이메일 인증이 완료되었습니다.")
        else:
            st.session_state["email_verified"] = False
            st.warning("인증번호가 일치하지 않습니다.")

    st.caption("※ 인증번호 메일이 보이지 않으면 스팸함 또는 프로모션함을 확인해 주세요.")
    st.caption("※ 5분 이내에 인증 메일이 도착하지 않으면 다시 시도해 주세요.")


    st.markdown("### 5. 제공 정보 동의 및 제출")
    privacy_agree = st.checkbox(
        "개인정보 수집 및 이용에 동의합니다. 입력한 정보는 교사의 발견 소식, 자료 안내, 서비스 개선 및 문의 응대를 위한 목적으로만 활용됩니다.",
        key="join_privacy_agree"
    )

    mailing_agree = st.checkbox(
        "메일링 수신에 동의합니다. 교사의 발견 콘텐츠, 자료, 소식 안내를 이메일로 받아보겠습니다.",
        key="join_mailing_agree"
    )

    if st.button("정보 제출하기", key="join_submit"):
        if not institution_name:
            st.warning("기관명을 입력해 주세요.")
        elif institution_group == "- 선택 -":
            st.warning("기관 구분을 선택해 주세요.")
        elif institution_type == "- 선택 -":
            st.warning("기관 유형을 선택해 주세요.")
        elif not phone_number:
            st.warning("기관 연락처를 입력해 주세요.")
        elif not subscriber_name:
            st.warning("가입자 성명을 입력해 주세요.")
        elif position == "- 선택 -":
            st.warning("직책을 선택해 주세요.")
        elif not email_id:
            st.warning("이메일 아이디를 입력해 주세요.")
        elif email_domain == "- 선택 -":
            st.warning("이메일 도메인을 선택해 주세요.")
        elif email_domain == "직접 입력" and not custom_domain:
            st.warning("이메일 도메인을 직접 입력해 주세요.")
        elif not st.session_state.get("email_verified"):
            st.warning("이메일 인증을 완료해 주세요.")
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

# =========================
# TAB 2. 기록 요정
# =========================
with tab2:
    st.subheader("🧚‍♀️ 상황별 문구 자동 생성")
    st.write("사진 장면을 바탕으로 놀이 의미, 발달 의미, 부모 전달 문장을 함께 생성합니다.")

    play_keyword = st.text_input("사진 속 놀이 키워드 입력", placeholder="예: 바깥놀이, 블록쌓기, 물감놀이, 역할놀이", key="photo_play_keyword")
    age_group = st.selectbox("연령 선택", ["- 선택 -", "0세", "1세", "2세", "3세", "4세", "5세"], key="photo_age_group")
    curriculum_area = st.selectbox("누리과정 영역 선택", ["- 선택 -", "신체운동·건강", "의사소통", "사회관계", "예술경험", "자연탐구"], key="photo_curriculum_area")
    development_area = st.selectbox("발달영역 선택", ["- 선택 -", "신체", "언어", "인지", "사회정서", "창의성"], key="photo_development_area")
    observation_type = st.selectbox("기록 유형 선택", ["- 선택 -", "알림장용", "관찰기록용", "서술형 일지용", "기관홍보용"], key="photo_observation_type")

    parent_type = None
    if observation_type == "알림장용":
        parent_type = st.selectbox("부모 성향 선택", ["- 선택 -", "일반형", "불안형", "정보형", "감성형"], key="photo_parent_type")

    child_action = st.selectbox("사진 속 아이들의 모습 선택", ["- 선택 -", "호기심을 보이며 탐색하는 모습", "친구와 함께 협력하는 모습", "자신의 생각을 표현하는 모습", "반복하며 시도하는 모습", "새로운 방법을 찾아보는 모습", "교사의 지원을 받아 안정적으로 참여하는 모습"], key="photo_child_action")

    if st.button("상황별 문구 생성", key="photo_generate_text"):
        if not play_keyword.strip():
            st.warning("사진 속 놀이 키워드를 입력해 주세요.")
        elif age_group == "- 선택 -":
            st.warning("연령을 선택해 주세요.")
        elif curriculum_area == "- 선택 -":
            st.warning("누리과정 영역을 선택해 주세요.")
        elif development_area == "- 선택 -":
            st.warning("발달영역을 선택해 주세요.")
        elif observation_type == "- 선택 -":
            st.warning("기록 유형을 선택해 주세요.")
        elif observation_type == "알림장용" and parent_type == "- 선택 -":
            st.warning("부모 성향을 선택해 주세요.")
        elif child_action == "- 선택 -":
            st.warning("사진 속 아이들의 모습을 선택해 주세요.")
        else:
            child_label = "영아" if age_group in ["0세", "1세", "2세"] else "유아"
            selected_sentences = random.sample(OBSERVATION_TEMPLATES[observation_type], k=min(3, len(OBSERVATION_TEMPLATES[observation_type])))
            st.success("상황별 문구가 생성되었습니다.")

            for idx, sentence in enumerate(selected_sentences, start=1):
                base_sentence = sentence.format(keyword=play_keyword, action=child_action, child=child_label)
                if observation_type == "알림장용":
                    final_result = f"{base_sentence} {AGE_NOTICE[age_group]} {random.choice(PARENT_TEMPLATES[parent_type])}"
                elif observation_type == "관찰기록용":
                    final_result = f"{base_sentence} {DEVELOPMENT_RECORD[development_area]}"
                elif observation_type == "서술형 일지용":
                    final_result = f"{base_sentence} {CURRICULUM_RECORD[curriculum_area]} {DEVELOPMENT_RECORD[development_area]}"
                else:
                    final_result = f"{base_sentence} {AGE_NOTICE[age_group]}"
                st.write(f"{idx}. {final_result}")

    st.divider()

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

        for idx, (image_path, score) in enumerate(selected):
            st.image(image_path, caption=f"Top {idx + 1} / 점수: {score:.1f}", use_container_width=True)


# =========================
# TAB 3. 사진 보정
# =========================
with tab3:
    st.subheader("✨ 초간편 사진 보정")
    st.write("원본과 보정본을 비교하며 밝기, 대비, 채도, 선명도를 직접 조절할 수 있습니다.")

    uploaded_for_enhance = st.file_uploader(
        "보정할 사진을 업로드하세요",
        type=["jpg", "jpeg", "png"],
        accept_multiple_files=False,
        key="photo_enhancer"
    )

    auto_enhance = st.button("⚡ 자동 보정 적용", key="auto_enhance_button")

    if auto_enhance:
        brightness_default = 1.0
        contrast_default = 0.90
        saturation_default = 1.0
        sharpness_default = 1.0
    else:
        brightness_default = 1.10
        contrast_default = 1.20
        saturation_default = 1.20
        sharpness_default = 1.30

    st.markdown("#### 보정값 조절")

    col_b1, col_b2 = st.columns(2)

    with col_b1:
        brightness_value = st.slider(
            "밝기",
            min_value=0.5,
            max_value=2.0,
            value=brightness_default,
            step=0.1,
            key="brightness_slider"
        )

        saturation_value = st.slider(
            "채도",
            min_value=0.5,
            max_value=2.0,
            value=saturation_default,
            step=0.1,
            key="saturation_slider"
        )

    with col_b2:
        contrast_value = st.slider(
            "대비",
            min_value=0.5,
            max_value=2.0,
            value=contrast_default,
            step=0.1,
            key="contrast_slider"
        )

        sharpness_value = st.slider(
            "선명도",
            min_value=0.5,
            max_value=2.0,
            value=sharpness_default,
            step=0.1,
            key="sharpness_slider"
        )

    if uploaded_for_enhance:
        original_image = Image.open(uploaded_for_enhance).convert("RGB")

        enhanced_image = original_image.copy()
        enhanced_image = ImageEnhance.Brightness(enhanced_image).enhance(brightness_value)
        enhanced_image = ImageEnhance.Contrast(enhanced_image).enhance(contrast_value)
        enhanced_image = ImageEnhance.Color(enhanced_image).enhance(saturation_value)
        enhanced_image = ImageEnhance.Sharpness(enhanced_image).enhance(sharpness_value)

        st.success("이미지 보정이 적용되었습니다.")

        screen_width = st_javascript(
            "window.innerWidth",
            key="screen_width"
        )

        is_mobile = False

        try:
            if screen_width and int(screen_width) < 768:
                is_mobile = True
        except:
            pass

        st.markdown("### 이미지 비교")

        if is_mobile:
            st.markdown("#### 원본 사진")
            st.image(original_image, use_container_width=True)

            st.markdown("<br>", unsafe_allow_html=True)

            st.markdown("#### 보정 사진")
            st.image(enhanced_image, use_container_width=True)

        else:
            col_img1, col_img2 = st.columns(2)

            with col_img1:
                st.markdown("#### 원본 사진")
                st.image(original_image, use_container_width=True)

            with col_img2:
                st.markdown("#### 보정 사진")
                st.image(enhanced_image, use_container_width=True)

        img_buffer = io.BytesIO()
        enhanced_image.save(img_buffer, format="JPEG")
        img_buffer.seek(0)

        st.download_button(
            label="보정 이미지 다운로드",
            data=img_buffer,
            file_name="enhanced_image.jpg",
            mime="image/jpeg",
            key="enhanced_download"
        )

# =========================
# TAB 4. 알림장
# =========================
with tab4:
    st.subheader("📝 알림장 요약 및 생성")
    st.write("알림장 초안을 입력하면 핵심 내용을 요약하고, 선택한 기록 성향에 맞게 알림장 문장을 생성합니다.")

    record_type = st.selectbox(
        "기록 유형 선택",
        ["- 선택 -", "알림장용", "관찰 기록용", "서술형 일지용", "기관홍보용"],
        key="record_type_select"
    )

    teacher_tone = st.selectbox(
        "기록 성향 선택",
        ["- 선택 -", "팩트 중심형", "따뜻한 감성형", "이모티콘 활용형", "전문적 설명형"],
        key="diary_teacher_tone"
    )

    daily_scope = st.selectbox(
        "하루일과 전달 범위 선택",
        ["- 선택 -", "놀이 장면 중심", "일상생활 중심", "하루 전체 흐름", "특별활동 중심"],
        key="diary_daily_scope"
    )

    diary_text = st.text_area(
        "일지 내용을 붙여넣으세요",
        height=250,
        placeholder="예: 오늘은 아이들과 함께 봄 소풍을 다녀왔다...",
        key="diary_input_text"
    )

    if st.button("알림장 요약 및 생성하기", key="diary_generate_button"):
        if record_type == "- 선택 -":
            st.warning("기록 유형을 선택해 주세요.")
        elif teacher_tone == "- 선택 -":
            st.warning("기록 성향을 선택해 주세요.")
        elif daily_scope == "- 선택 -":
            st.warning("하루일과 전달 범위를 선택해 주세요.")
        elif not diary_text.strip():
            st.warning("요약할 일지 내용을 먼저 입력해 주세요.")
        else:
            summary = make_core_summary(
                diary_text,
                max_sentences=max_summary_sentences
            )

            generated_message = make_diary_message(
                summary,
                teacher_tone,
                daily_scope
            )


            st.write("저장될 기록 유형:", record_type)

            save_diary_log(
                record_type=record_type,
                teacher_tone=teacher_tone,
                daily_scope=daily_scope,
                original_text=diary_text,
                summary=summary,
                generated_message=generated_message
            )

            st.success("알림장 요약과 생성이 완료되었습니다.")

            st.markdown("### 요약 결과")
            st.markdown(
                f"<div class='result-card-gray'>{summary}</div>",
                unsafe_allow_html=True
            )

            st.markdown("### 생성된 알림장 문장")
            st.markdown(
                f"<div class='result-card-blue'>{generated_message}</div>",
                unsafe_allow_html=True
            )

            st.download_button(
                "생성된 알림장 다운로드",
                data=generated_message.encode("utf-8"),
                file_name="generated_diary_message.txt",
                mime="text/plain",
                key="diary_download"
            )

# =========================
# TAB 5. 교사의 온도
# =========================
with tab5:
    st.subheader("🌡️ 지금 그리고 오늘, 교사의 온도")
    st.write("하루를 마무리하며, 교사의 마음을 짧게 기록하는 감성 기록 공간입니다.")

    diary_type = st.radio("기록 양식 선택", ["🕯️ 감성 일기", "✒️ 3줄 요약 다이어리"], horizontal=True, key="temperature_diary_type")
    st.divider()

    if diary_type == "🕯️ 감성 일기":
        st.markdown("### 🕯️ 감성 일기")
        one_line_options = ["- 선택 -", "오늘도 아이들 곁에서 충분히 애쓴 하루였습니다.", "조금 지쳤지만, 그래도 마음이 따뜻해지는 순간이 있었습니다.", "작은 웃음 하나가 긴 하루를 버티게 해주었습니다.", "바쁜 하루였지만 아이들의 반응 속에서 힘을 얻었습니다.", "완벽하지 않아도 괜찮았던 하루였습니다.", "직접 입력"]
        one_line_choice = st.selectbox("오늘의 한 줄 문장", one_line_options, key="temp_one_line_choice")
        one_line = st.text_input("오늘의 한 줄 문장 직접 입력", key="temp_one_line_input") if one_line_choice == "직접 입력" else one_line_choice

        best_moment_options = ["- 선택 -", "아이의 웃음이 가장 기억에 남았습니다.", "예상하지 못한 아이의 말 한마디가 마음에 남았습니다.", "함께 놀이하던 순간의 따뜻한 분위기가 좋았습니다.", "힘든 중에도 아이들이 즐겁게 참여하는 모습이 빛났습니다.", "동료와 주고받은 작은 응원이 기억에 남았습니다.", "직접 입력"]
        best_moment_choice = st.selectbox("가장 빛났던 순간", best_moment_options, key="temp_best_moment_choice")
        best_moment = st.text_area("가장 빛났던 순간 직접 입력", key="temp_best_moment_input") if best_moment_choice == "직접 입력" else best_moment_choice

        emotion_options = ["- 선택 -", "따뜻한", "차분한", "벅찬", "지친", "뿌듯한", "복잡한", "고요한", "열정적인", "직접 입력"]
        emotion_choice = st.selectbox("오늘 내 마음을 표현하는 단어", emotion_options, key="temp_emotion_choice")
        emotion_word = st.text_input("감정 직접 입력", placeholder="예: 몽글몽글한, 단단한, 흔들리는", key="temp_emotion_input") if emotion_choice == "직접 입력" else emotion_choice

        self_message_options = ["- 선택 -", "오늘도 충분히 잘했어.", "완벽하지 않아도 괜찮아.", "내가 버틴 하루도 소중해.", "조금 쉬어가도 괜찮아.", "내일의 나는 오늘의 나에게 고마워할 거야.", "직접 입력"]
        self_message_choice = st.selectbox("나에게 한마디", self_message_options, key="temp_self_message_choice")
        self_message = st.text_input("나에게 한마디 직접 입력", key="temp_self_message_input") if self_message_choice == "직접 입력" else self_message_choice

        if st.button("감성 일기 생성", key="temp_emotional_button"):
            if one_line == "- 선택 -":
                st.warning("오늘의 한 줄 문장을 선택해 주세요.")
            elif best_moment == "- 선택 -":
                st.warning("가장 빛났던 순간을 선택해 주세요.")
            elif emotion_word == "- 선택 -":
                st.warning("오늘 내 마음을 표현하는 단어를 선택해 주세요.")
            elif self_message == "- 선택 -":
                st.warning("나에게 한마디를 선택해 주세요.")
            else:
                result = f"오늘 하루를 돌아보면, {one_line}\n\n그중 가장 마음에 남는 순간은 {best_moment}\n\n오늘 내 마음은 {emotion_word} 쪽에 가까웠어요.\n\n그래도 나에게 이렇게 말해주고 싶어요.\n{self_message}"
                save_temperature_log("감성 일기", best_moment, emotion_word, "", None, "", result)
                st.success("감성 일기가 생성되었습니다.")
                st.markdown("### 생성 결과")
                st.markdown(f"<div class='letter-box'>{result}</div>", unsafe_allow_html=True)

    elif diary_type == "✒️ 3줄 요약 다이어리":
        st.markdown("### ✒️ 3줄 요약 다이어리")
        st.write("선택한 기억, 감정, 온도 값을 바탕으로 오늘의 평균 마음온도를 자동 계산합니다.")

        memory_options = ["- 선택 -", "아이의 웃음이 오래 기억에 남았습니다.", "예상하지 못한 아이의 표현이 마음에 남았습니다.", "함께 놀이하던 장면이 오늘의 가장 특별한 순간이었습니다.", "동료와 나눈 짧은 대화가 힘이 되었습니다.", "하루를 무사히 마무리한 것이 가장 큰 일이었습니다.", "직접 입력"]
        memory_temperature = {"아이의 웃음이 오래 기억에 남았습니다.": 38.0, "예상하지 못한 아이의 표현이 마음에 남았습니다.": 37.5, "함께 놀이하던 장면이 오늘의 가장 특별한 순간이었습니다.": 37.0, "동료와 나눈 짧은 대화가 힘이 되었습니다.": 36.5, "하루를 무사히 마무리한 것이 가장 큰 일이었습니다.": 35.5, "직접 입력": 36.5}
        memory_choice = st.selectbox("기억", memory_options, key="temp_memory_choice")
        memory = st.text_input("기억 직접 입력", key="temp_memory_input") if memory_choice == "직접 입력" else memory_choice

        emotion_options = ["- 선택 -", "뿌듯함이 남았습니다.", "조금 지쳤지만 따뜻함도 있었습니다.", "마음이 복잡했지만 잘 버텼습니다.", "작은 장면 하나에 위로를 받았습니다.", "생각보다 괜찮은 하루였습니다.", "직접 입력"]
        emotion_temperature = {"뿌듯함이 남았습니다.": 38.5, "조금 지쳤지만 따뜻함도 있었습니다.": 36.5, "마음이 복잡했지만 잘 버텼습니다.": 34.5, "작은 장면 하나에 위로를 받았습니다.": 37.0, "생각보다 괜찮은 하루였습니다.": 36.0, "직접 입력": 36.5}
        emotion_choice = st.selectbox("감정", emotion_options, key="temp_3line_emotion_choice")
        emotion = st.text_input("감정 직접 입력", key="temp_3line_emotion_input") if emotion_choice == "직접 입력" else emotion_choice

        temperature_options = ["- 선택 -", "따뜻한 36.5℃", "차분한 35℃", "열정적인 40℃", "조금 지친 32℃", "다시 회복 중인 34℃", "직접 입력"]
        temperature_temperature = {"따뜻한 36.5℃": 36.5, "차분한 35℃": 35.0, "열정적인 40℃": 40.0, "조금 지친 32℃": 32.0, "다시 회복 중인 34℃": 34.0, "직접 입력": 36.5}
        temperature_choice = st.selectbox("온도", temperature_options, key="temp_temperature_choice")
        temperature = st.text_input("온도 직접 입력", placeholder="예: 몽글몽글한 37℃", key="temp_temperature_input") if temperature_choice == "직접 입력" else temperature_choice

        if st.button("3줄 다이어리 생성", key="temp_3line_button"):
            if memory_choice == "- 선택 -":
                st.warning("기억을 선택해 주세요.")
            elif emotion_choice == "- 선택 -":
                st.warning("감정을 선택해 주세요.")
            elif temperature_choice == "- 선택 -":
                st.warning("온도를 선택해 주세요.")
            else:
                average_temp = round(memory_temperature[memory_choice] * 0.25 + emotion_temperature[emotion_choice] * 0.25 + temperature_temperature[temperature_choice] * 0.50, 1)
                if average_temp >= 38:
                    temp_message = "오늘은 마음의 에너지가 꽤 높았던 하루예요."
                elif average_temp >= 36:
                    temp_message = "따뜻함과 안정감이 남아 있는 하루예요."
                elif average_temp >= 34:
                    temp_message = "조금 지쳤지만 잘 버텨낸 하루예요."
                else:
                    temp_message = "마음의 온도가 낮아진 날이에요. 오늘은 회복이 먼저예요."
                result = f"오늘 하루를 돌아보면, {memory}\n\n그 순간의 내 마음에는 {emotion}\n\n그래서 오늘의 마음온도는 {temperature}에 가까웠어요.\n\n{temp_message}\n\n오늘도 충분히 애쓴 하루였어요."
                save_temperature_log("3줄 요약 다이어리", memory, emotion, temperature, average_temp, temp_message, result)
                st.success("3줄 요약 다이어리가 생성되었습니다.")
                st.metric(label="🌡️ 선생님들의 오늘, 평균 마음온도", value=f"{average_temp}℃")
                st.info(temp_message)
                st.markdown("### 생성 결과")
                st.markdown(f"<div class='letter-box'>{result}</div>", unsafe_allow_html=True)


# =========================
# TAB 6. 관리자
# =========================
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
            st.write("알림장 DB 확인")
            temp_df = load_table("teacher_temperature_logs")


            subscribers_filtered = filter_by_period(subscribers_df, dashboard_period)
            diary_filtered = filter_by_period(diary_df, dashboard_period)
            temp_filtered = filter_by_period(temp_df, dashboard_period)

            mailing_count = 0
            if not subscribers_filtered.empty and "mailing_agree" in subscribers_filtered.columns:
                mailing_count = subscribers_filtered[
                    subscribers_filtered["mailing_agree"].astype(str) == "True"
                ].shape[0]

            col1, col2, col3, col4 = st.columns(4)
            col1.metric("가입자 수", f"{len(subscribers_filtered)}명")
            col2.metric("메일링 동의", f"{mailing_count}명")
            col3.metric("알림장 생성", f"{len(diary_filtered)}건")
            col4.metric("교사의 온도 기록", f"{len(temp_filtered)}건")

            st.divider()
            st.markdown("### 📈 기록 분포")

            graph_col1, graph_col2, graph_col3 = st.columns(3)

            with graph_col1:
                st.markdown("#### 교사의 온도 기록 유형")
                if not temp_filtered.empty and "diary_type" in temp_filtered.columns:
                    temp_counts = temp_filtered["diary_type"].dropna()
                    temp_counts = temp_counts[temp_counts != ""]
                    if not temp_counts.empty:
                        draw_category_chart(temp_counts.value_counts(), "교사의 온도 기록 유형")
                    else:
                        st.caption("교사의 온도 기록이 없습니다.")
                else:
                    st.caption("교사의 온도 기록이 없습니다.")

            with graph_col2:
                st.markdown("#### 알림장 기록 성향")
                if not diary_filtered.empty and "teacher_tone" in diary_filtered.columns:
                    tone_counts = diary_filtered["teacher_tone"].dropna()
                    tone_counts = tone_counts[tone_counts != ""]
                    if not tone_counts.empty:
                        draw_category_chart(tone_counts.value_counts(), "알림장 기록 성향")
                    else:
                        st.caption("알림장 기록이 없습니다.")
                else:
                    st.caption("알림장 기록이 없습니다.")

            with graph_col3:
                st.markdown("#### 상황별 문구 자동 생성 유형")
                if not diary_filtered.empty and "record_type" in diary_filtered.columns:
                    record_type_counts = diary_filtered["record_type"].dropna()
                    record_type_counts = record_type_counts[record_type_counts != ""]
                    if not record_type_counts.empty:
                        draw_category_chart(record_type_counts.value_counts(), "상황별 문구 자동 생성 유형")
                    else:
                        st.caption("상황별 문구 생성 기록이 없습니다.")
                else:
                    st.caption("상황별 문구 생성 기록이 없습니다.")

            st.divider()

            admin_menu = st.selectbox(
                "조회할 데이터 선택",
                ["가입자 정보", "알림장 생성 기록", "교사의 온도 기록"],
                key="admin_data_select"
            )

            table_map = {
                "가입자 정보": "subscribers",
                "알림장 생성 기록": "diary_logs",
                "교사의 온도 기록": "teacher_temperature_logs"
            }

            file_map = {
                "가입자 정보": "subscribers.csv",
                "알림장 생성 기록": "diary_logs.csv",
                "교사의 온도 기록": "teacher_temperature_logs.csv"
            }

            table_name = table_map[admin_menu]
            file_name = file_map[admin_menu]

            df = load_table(table_name)
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
                "record_type": "기록 유형",
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
                "deleted": "삭제 여부",
            }

            display_df = df.rename(columns=column_rename)

            if "조회용 날짜" in display_df.columns:
                display_df = display_df.drop(columns=["조회용 날짜"])

            st.markdown("### 📁 데이터 조회 및 다운로드")
            st.dataframe(display_df, use_container_width=True)

            csv = display_df.to_csv(index=False).encode("utf-8-sig")

            st.download_button(
                label="CSV 다운로드",
                data=csv,
                file_name=file_name,
                mime="text/csv",
                key="admin_csv_download"
            )



            st.divider()
            st.markdown("### 🛠️ 기록 삭제")
            st.caption("선택한 기록은 완전히 삭제되지 않고 목록에서 숨김 처리됩니다.")

            delete_df = load_table(table_name)

            if delete_df.empty:
                st.caption("삭제할 기록이 없습니다.")
            else:
                delete_id = st.selectbox(
                    "삭제할 기록 ID 선택",
                    delete_df["id"].tolist(),
                    key="delete_record_id_select"
                )

                if st.button("선택 기록 삭제", key="soft_delete_button"):
                    soft_delete_record(table_name, delete_id)
                    st.success("선택한 기록을 삭제 처리했습니다.")
                    st.rerun()

            st.divider()
            st.markdown("### ♻️ 삭제 기록 복원")

            deleted_df = load_table(table_name, include_deleted=True)

            if "deleted" in deleted_df.columns:
                deleted_df = deleted_df[deleted_df["deleted"] == 1]

            if deleted_df.empty:
                st.caption("복원 가능한 삭제 기록이 없습니다.")
            else:
                restore_id = st.selectbox(
                    "복원할 기록 ID 선택",
                    deleted_df["id"].tolist(),
                    key="restore_record_id_select"
                )

                if st.button("선택 기록 복원", key="restore_button"):
                    restore_record(table_name, restore_id)
                    st.success("기록이 복원되었습니다.")
                    st.rerun()
