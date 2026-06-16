# -*- coding: utf-8 -*-
# 교사의 발견_현장 업무 자동화 파일럿 서비스
# 실행: streamlit run streamlit_app.py

import re
import io
import random
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
<style>
:root {
    --witti-sky-50:#F2F9FF;
    --witti-sky-100:#E3F2FF;
    --witti-sky-200:#CDEAFF;
    --witti-sky-300:#9BD4FF;
    --witti-blue:#2F80ED;
    --witti-blue-deep:#1B4D89;
    --witti-navy:#16324F;
    --witti-yellow:#FFE88A;
    --witti-line:#D9ECFF;
    --witti-card:#FFFFFF;
}

html, body, [class*="css"] {
    font-family: 'Pretendard', 'SUIT', 'Noto Sans KR', 'Malgun Gothic', sans-serif !important;
}

.stApp {
    background: linear-gradient(180deg, #F4FAFF 0%, #FFFFFF 34%, #F8FCFF 100%);
}

.block-container {
    padding-top: 2rem;
    padding-left: 3rem;
    padding-right: 3rem;
    max-width: 1180px;
}

h1, h2, h3, h4 {
    color: var(--witti-navy) !important;
    letter-spacing: -0.6px !important;
}

.small-guide {
    color:#5F7188;
    font-size:14px;
    line-height:1.75;
    background: #F7FBFF;
    border: 1px solid var(--witti-line);
    border-radius: 16px;
    padding: 14px 18px;
    margin: 8px 0 22px 0;
}

/* 탭 메뉴바 */
div[data-testid="stTabs"] button[data-baseweb="tab"] {
    background: #EAF6FF !important;
    border: 1px solid #CFEAFF !important;
    border-radius: 999px !important;
    padding: 9px 14px !important;
    margin-right: 6px !important;
    color: #315A7D !important;
    font-weight: 700 !important;
}

div[data-testid="stTabs"] button[data-baseweb="tab"][aria-selected="true"] {
    background: linear-gradient(135deg, #4DA3FF 0%, #8FD3FF 100%) !important;
    color: white !important;
    border-color: #4DA3FF !important;
    box-shadow: 0 6px 16px rgba(47,128,237,0.18);
}

/* 입력 요소 */
.stTextInput input, .stTextArea textarea, div[data-baseweb="select"] > div {
    border-radius: 12px !important;
    border-color: #CFE6FA !important;
    background-color: #FFFFFF !important;
}

.stButton > button, .stDownloadButton > button {
    min-height: 44px;
    border-radius: 12px !important;
    font-weight: 700 !important;
    border: 1px solid #9ED3FF !important;
    background: linear-gradient(135deg, #2F80ED 0%, #56CCF2 100%) !important;
    color: white !important;
    box-shadow: 0 6px 15px rgba(47,128,237,0.18);
}

.stButton > button:hover, .stDownloadButton > button:hover {
    filter: brightness(0.98);
    border-color: #56CCF2 !important;
}

.menu-card {
    background: rgba(255,255,255,0.88);
    border: 1px solid #D7ECFF;
    border-left: 7px solid #6EC6FF;
    border-radius: 22px;
    padding: 20px 22px;
    margin: 10px 0 20px 0;
    box-shadow: 0 10px 30px rgba(47, 128, 237, 0.08);
}

.menu-card-title {
    font-size: 23px;
    font-weight: 800;
    color: #16324F;
    margin-bottom: 8px;
}

.menu-card-desc {
    font-size: 15px;
    line-height: 1.7;
    color: #526A7F;
}

.info-chip {
    display:inline-block;
    background:#EAF6FF;
    color:#1B4D89;
    border:1px solid #CFEAFF;
    border-radius:999px;
    padding:6px 11px;
    font-size:13px;
    font-weight:700;
    margin: 4px 4px 4px 0;
}

.letter-box {
    font-size: 18px;
    line-height: 1.8;
    color: #273849;
    background: linear-gradient(180deg, #FFFDF8 0%, #F7FBFF 100%);
    padding: 24px;
    border-radius: 18px;
    border: 1px solid #D7ECFF;
    white-space: pre-wrap;
    margin-top: 12px;
    box-shadow: 0 8px 22px rgba(47,128,237,0.06);
}

.result-card-blue {
    color:#16324F;
    background-color:#EEF7FF;
    border: 1px solid #CFEAFF;
    padding:18px;
    border-radius:16px;
    line-height:1.8;
    white-space:pre-wrap;
}

.result-card-gray {
    color:#1F2933;
    background-color:#F8FAFC;
    border: 1px solid #E5EDF5;
    padding:18px;
    border-radius:16px;
    line-height:1.8;
    white-space:pre-wrap;
}

[data-testid="stMetric"] {
    background:#FFFFFF;
    border:1px solid #D7ECFF;
    border-radius:18px;
    padding:14px;
    box-shadow:0 8px 22px rgba(47,128,237,0.06);
}

@media (max-width: 768px) {
    .block-container {
        padding-top: 1.2rem;
        padding-left: 1rem;
        padding-right: 1rem;
        max-width: 100%;
    }

    h1 { font-size: 31px !important; line-height:1.25 !important; }
    h2 { font-size: 24px !important; }
    h3 { font-size: 21px !important; }
    h4 { font-size: 18px !important; }

    label, p { font-size: 15px !important; line-height: 1.55 !important; }
    textarea, input, select { font-size: 16px !important; }

    div[data-testid="stTabs"] button[data-baseweb="tab"] {
        font-size: 13px !important;
        padding: 8px 10px !important;
        margin-right: 4px !important;
    }

    .menu-card { padding: 16px !important; border-radius: 18px !important; }
    .menu-card-title { font-size: 20px !important; }
    .menu-card-desc { font-size: 14px !important; }

    .letter-box,
    .result-card-blue,
    .result-card-gray {
        font-size: 16px !important;
        line-height: 1.75 !important;
        padding: 16px !important;
        border-radius: 14px !important;
    }
}
</style>
""", unsafe_allow_html=True)


# =========================
# Supabase DB 설정 및 공통 함수
# =========================
# 주의: SQLite(witti_data.db)는 배포 환경에서 PC/세션마다 기록이 달라질 수 있어 사용하지 않습니다.
# 모든 누적 기록은 Supabase 테이블에 저장하고, 관리자 페이지도 Supabase에서 다시 불러옵니다.

try:
    from supabase import create_client, Client
except Exception:
    create_client = None
    Client = None


@st.cache_resource
def get_supabase_client():
    if create_client is None:
        st.error("Supabase 라이브러리가 설치되지 않았습니다. requirements.txt에 supabase를 추가해 주세요.")
        st.stop()

    try:
        url = st.secrets["supabase"]["url"]
        key = st.secrets["supabase"]["service_role_key"]
    except Exception:
        st.error("Supabase secrets가 설정되지 않았습니다. Streamlit Cloud Secrets에 [supabase] url, service_role_key를 등록해 주세요.")
        st.stop()

    return create_client(url, key)


supabase = get_supabase_client()


TABLE_NAMES = {
    "subscribers": "subscribers",
    "diary_logs": "diary_logs",
    "phrase_logs": "phrase_logs",
    "teacher_temperature_logs": "teacher_temperature_logs",
}


def _response_data(response):
    return getattr(response, "data", []) or []


def save_subscriber(data):
    """소통 탭에서 입력받은 구독자/기관 정보를 Supabase에 저장합니다."""
    payload = {
        "institution_name": data.get("기관명", ""),
        "institution_group": data.get("기관 구분", ""),
        "institution_type": data.get("기관 유형", ""),
        "institution_feature": data.get("기관 특성", ""),
        "phone": data.get("기관 연락처", ""),
        "subscriber_name": data.get("가입자 성명", ""),
        "position": data.get("직책", ""),
        "email": data.get("이메일", ""),
        "privacy_agree": str(data.get("개인정보 동의", False)),
        "mailing_agree": str(data.get("메일링 수신 동의", False)),
        "deleted": False,
    }
    supabase.table("subscribers").insert(payload).execute()


def save_diary_log(record_type, teacher_tone, daily_scope, original_text, summary, generated_message):
    """TAB4 알림장/관찰기록/서술형일지/기관홍보 생성 기록을 저장합니다."""
    payload = {
        "record_type": record_type,
        "teacher_tone": teacher_tone,
        "daily_scope": daily_scope,
        "original_text": original_text,
        "summary": summary,
        "generated_message": generated_message,
        "deleted": False,
    }
    supabase.table("diary_logs").insert(payload).execute()


def save_phrase_log(record_type, play_keyword, age_group, curriculum_area, development_area, child_action, generated_text):
    """TAB2 상황별 문구 자동 생성 기록을 저장합니다."""
    payload = {
        "record_type": record_type,
        "play_keyword": play_keyword,
        "age_group": age_group,
        "curriculum_area": curriculum_area,
        "development_area": development_area,
        "child_action": child_action,
        "generated_text": generated_text,
        "deleted": False,
    }
    supabase.table("phrase_logs").insert(payload).execute()


def save_temperature_log(diary_type, memory, emotion, temperature, average_temp, temp_message, result_text):
    """TAB5 교사의 온도 기록을 저장합니다."""
    payload = {
        "diary_type": diary_type,
        "memory": memory,
        "emotion": emotion,
        "temperature": temperature,
        "average_temp": average_temp,
        "temp_message": temp_message,
        "result_text": result_text,
        "deleted": False,
    }
    supabase.table("teacher_temperature_logs").insert(payload).execute()


def load_table(table_name, include_deleted=False):
    """관리자 페이지에서 Supabase 테이블을 DataFrame으로 불러옵니다."""
    try:
        query = supabase.table(table_name).select("*").order("id", desc=True)
        if not include_deleted:
            query = query.eq("deleted", False)
        response = query.execute()
        return pd.DataFrame(_response_data(response))
    except Exception as e:
        st.warning(f"{table_name} 데이터를 불러오지 못했습니다: {e}")
        return pd.DataFrame()


def soft_delete_record(table_name, record_id):
    supabase.table(table_name).update({"deleted": True}).eq("id", int(record_id)).execute()


def restore_record(table_name, record_id):
    supabase.table(table_name).update({"deleted": False}).eq("id", int(record_id)).execute()


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
    df["created_at_dt"] = pd.to_datetime(df["created_at"], errors="coerce", utc=True)
    df = df.dropna(subset=["created_at_dt"])

    now_kr = pd.Timestamp.now(tz="Asia/Seoul")
    created_kr = df["created_at_dt"].dt.tz_convert("Asia/Seoul")

    if period == "오늘":
        return df[created_kr.dt.date == now_kr.date()]

    if period == "최근 7일":
        start_date_utc = (now_kr - pd.Timedelta(days=7)).tz_convert("UTC")
        return df[df["created_at_dt"] >= start_date_utc]

    if period == "이번 달":
        return df[
            (created_kr.dt.year == now_kr.year)
            & (created_kr.dt.month == now_kr.month)
        ]

    return df


def render_menu_card(title: str, description: str, chips: list[str] | None = None):
    chips = chips or []
    chip_html = "".join([f"<span class='info-chip'>{chip}</span>" for chip in chips])
    st.markdown(
        f"""
        <div class="menu-card">
            <div class="menu-card-title">{title}</div>
            <div class="menu-card-desc">{description}</div>
            <div>{chip_html}</div>
        </div>
        """,
        unsafe_allow_html=True,
    )


st.title("🌿 교사의 발견_현장 업무 자동화 파일럿 서비스")
st.markdown("""
<div class="small-guide">
💡 본 플랫폼은 PC 또는 모바일에서 활용 가능합니다. 업로드한 사진과 일지 내용은 외부 서버로 전송되지 않습니다.<br>
💡 크롬 자동 번역 사용 시 일부 문장이 자연스럽지 않게 보일 수 있습니다.
</div>
""", unsafe_allow_html=True)

with st.sidebar:
    st.header("⚙️ 설정")
    top_k = st.slider("선별할 사진 수", min_value=1, max_value=20, value=10)
    max_summary_sentences = st.slider("알림장 요약 문장 수", min_value=1, max_value=10, value=6)
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
    render_menu_card(
        "💬 함께 소통해요",
        "교사의 발견 소식과 자료를 받아볼 수 있도록 기본 정보를 입력해 주세요.",
        ["회원가입", "이메일 인증", "자료 안내"]
    )

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
            st.session_state["is_subscribed"] = True
            st.success("정보가 제출되었습니다.")
            st.json(submitted_data)

# =========================
# TAB 2. 기록 요정
# =========================

def clean_sentence(sentence: str) -> str:
    sentence = sentence.strip().replace("- ", "").replace("ㆍ", "")
    sentence = re.sub(r"\s+", " ", sentence)
    replacements = {
        "하였다.": "했습니다.", "했다.": "했습니다.", "한다.": "합니다.",
        "보았다.": "보았습니다.", "말했다.": "말했습니다.", "물었다.": "물었습니다.",
        "가졌다.": "가졌습니다.", "나갔다.": "나갔습니다.", "먹었다.": "먹었습니다.",
        "읽었다.": "읽었습니다.", "살펴보았다.": "살펴보았습니다.",
        "참여하였다.": "참여했습니다.", "표현하였다.": "표현했습니다.",
        "경험하였다.": "경험했습니다.", "놀이하였다.": "놀이했습니다.",
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
        "동화", "놀이", "활동", "산책", "식사", "휴식", "대화", "질문", "탐색", "표현",
        "관찰", "친구", "교사", "참여", "관심", "경험", "만들", "그리", "읽", "말",
        "협력", "반복", "시도", "감각", "역할", "상상", "조절", "선택", "공유", "발견"
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

def remove_bullets(summary: str) -> str:
    text = summary.replace("- ", " ").replace("\n", " ")
    return re.sub(r"\s+", " ", text).strip()

def extract_play_meaning(original_text: str, summary: str, daily_scope: str, record_type: str) -> dict:
    clean_text = remove_bullets(summary)

    activity_keywords = {
        "색깔": "색을 살펴보고 구분해보는 놀이",
        "색": "색을 살펴보고 구분해보는 놀이",
        "블록": "블록을 구성하고 공간을 만들어보는 놀이",
        "물감": "색과 재료를 감각적으로 탐색하는 미술 놀이",
        "역할": "상상한 내용을 말과 행동으로 표현하는 역할 놀이",
        "바깥": "몸을 움직이며 주변 환경을 탐색하는 바깥놀이",
        "산책": "주변 자연과 환경을 살펴보는 산책 활동",
        "동화": "이야기를 듣고 생각과 느낌을 나누는 동화 활동",
        "노래": "리듬과 소리를 느끼며 표현하는 음악 활동",
        "점프": "몸의 움직임을 조절하며 참여하는 신체 놀이",
        "공": "공을 주고받으며 신체 조절을 경험하는 놀이",
        "모래": "모래의 촉감과 형태를 탐색하는 감각 놀이",
        "물": "물의 움직임과 변화를 탐색하는 감각 놀이",
    }

    activity = "놀이와 일상 속 경험"
    for keyword, value in activity_keywords.items():
        if keyword in original_text or keyword in summary:
            activity = value
            break

    scope_intro = {
        "놀이 장면 중심": "오늘 아이들은 놀이 장면 속에서",
        "일상생활 중심": "오늘 아이들은 일상생활 속에서",
        "하루 전체 흐름": "오늘 하루의 흐름 속에서",
        "특별활동 중심": "오늘 특별활동을 통해",
    }.get(daily_scope, "오늘 아이들은")

    meaning_map = {
        "알림장용": "이 과정은 아이들이 주변을 관찰하고 자신의 생각을 표현하며 배움을 넓혀가는 경험으로 이어졌습니다.",
        "기관 홍보용": "이러한 경험은 아이들이 놀이 속에서 자연스럽게 배우고 성장하는 과정으로 연결되었습니다.",
        "관찰 기록용": "해당 장면은 아이의 탐색, 표현, 상호작용 과정을 살펴볼 수 있는 의미 있는 관찰 장면이었다.",
        "서술형 일지용": "이 경험은 아이들의 흥미와 반응을 바탕으로 놀이가 확장되는 과정으로 볼 수 있었다.",
    }

    return {
        "activity": activity,
        "summary_text": clean_text,
        "scope_intro": scope_intro,
        "meaning": meaning_map.get(record_type, meaning_map["알림장용"]),
    }


def build_restructured_diary(original_text: str, summary: str, daily_scope: str, record_type: str) -> str:
    info = extract_play_meaning(original_text, summary, daily_scope, record_type)

    if record_type in ["관찰 기록용", "서술형 일지용"]:
        return (
            f"{info['scope_intro']} {info['activity']}에 참여하는 모습이 나타났다.\n\n"
            f"주요 장면은 {info['summary_text']}\n\n"
            f"{info['meaning']}"
        )

    return (
        f"{info['scope_intro']} {info['activity']}에 즐겁게 참여했습니다.\n\n"
        f"아이들은 활동 과정에서 관심을 보이고, 자신의 방식으로 탐색하고 표현하는 모습을 보였습니다.\n\n"
        f"{info['meaning']}"
    )

DIARY_MESSAGE_BANK = {
    "알림장용": {
        "팩트 중심형": [
            "오늘 아이들의 모습을 간단히 전해드립니다.",
            "오늘 하루 중 의미 있었던 장면을 중심으로 전해드립니다.",
            "오늘 원에서 보인 아이들의 활동 모습을 정리해드립니다.",
            "오늘의 놀이와 일상 모습을 중심으로 안내드립니다.",
            "오늘 아이들이 참여한 활동 내용을 간단히 공유드립니다.",
            "오늘 하루 흐름 속에서 보인 모습을 전해드립니다.",
            "오늘 아이들의 참여 장면을 중심으로 알려드립니다.",
            "오늘 관찰된 주요 활동 모습을 공유드립니다.",
            "오늘의 경험 중 가정과 함께 나누면 좋을 장면을 전해드립니다.",
            "오늘 아이들이 경험한 놀이 장면을 정리해드립니다.",
        ],
        "따뜻한 감성형": [
            "오늘 아이들은 하루 속에서 즐겁게 참여하는 모습을 보여주었습니다.",
            "오늘 교실에는 아이들의 작은 웃음과 시도가 함께 담긴 장면이 있었습니다.",
            "오늘 아이들의 표정과 반응 속에서 따뜻한 배움의 순간을 볼 수 있었습니다.",
            "오늘 아이들은 각자의 속도로 놀이에 다가가며 하루를 채워갔습니다.",
            "오늘의 작은 표현들이 모여 의미 있는 하루가 되었습니다.",
            "아이들의 눈빛과 손짓에서 즐거운 참여가 느껴졌습니다.",
            "오늘 하루에도 아이들만의 반짝이는 장면이 있었습니다.",
            "아이들은 편안한 분위기 속에서 자신의 방식으로 경험을 이어갔습니다.",
            "오늘의 놀이 속에서 아이들의 마음이 조금씩 열리는 모습을 볼 수 있었습니다.",
            "작은 시도 하나도 소중하게 느껴지는 하루였습니다.",
        ],
        "이모티콘 활용형": [
            "오늘 우리 아이들은 즐겁게 하루를 보냈습니다 😊",
            "오늘도 교실에는 아이들의 웃음이 가득했습니다 🌿",
            "아이들이 놀이 속에서 즐거운 경험을 쌓았습니다 ✨",
            "오늘의 작은 시도가 아이들에게 좋은 기억이 되었기를 바랍니다 😊",
            "아이들이 자신의 방식으로 놀이에 참여했습니다 🌱",
            "오늘 하루도 아이들의 반짝이는 장면이 있었습니다 💛",
            "놀이 속에서 아이들의 호기심이 자라났습니다 🔍",
            "가정에서도 오늘의 이야기를 함께 나누어 주세요 🌿",
            "아이들의 즐거운 참여를 함께 응원해 주세요 😊",
            "오늘의 경험이 따뜻한 대화로 이어지길 바랍니다 ✨",
        ],
        "전문적 설명형": [
            "오늘 활동에서는 아이들의 참여 과정과 반응을 중심으로 살펴볼 수 있었습니다.",
            "해당 경험은 아이들의 탐색과 표현, 관계 경험을 넓히는 데 도움이 되었습니다.",
            "놀이 과정에서 아이들은 자신의 생각을 표현하고 주변과 상호작용했습니다.",
            "오늘의 장면은 아이들의 자발적 참여와 의미 구성 과정을 보여주었습니다.",
            "활동 중 아이들은 관찰, 비교, 표현의 과정을 자연스럽게 경험했습니다.",
            "일상 속 경험이 놀이와 연결되며 배움의 흐름을 만들었습니다.",
            "아이들의 반응은 발달적 특성과 현재의 관심을 이해하는 단서가 되었습니다.",
            "교사는 아이들의 흥미를 바탕으로 놀이가 이어질 수 있도록 지원했습니다.",
            "이 경험은 아이들의 자기표현과 관계 형성에 긍정적으로 연결되었습니다.",
            "오늘 활동은 놀이 중심 교육과정의 의미를 확인할 수 있는 장면이었습니다.",
        ],
    },
    "관찰 기록용": {
        "팩트 중심형": [
            "관찰 내용은 아이의 참여 과정, 반응, 상호작용을 중심으로 정리하였다.",
            "해당 장면에서 아이의 행동과 반응을 객관적으로 기록하였다.",
            "관찰은 활동 참여 여부와 반응의 변화를 중심으로 이루어졌다.",
            "아이의 관심, 시도, 반응을 중심으로 관찰 내용을 정리하였다.",
            "놀이 상황에서 나타난 행동 특성을 중심으로 기록하였다.",
            "활동 중 보인 언어적·비언어적 반응을 중심으로 살펴보았다.",
            "아이의 자발적 참여와 교사의 지원에 대한 반응을 기록하였다.",
            "자료 탐색과 또래 반응을 중심으로 관찰하였다.",
            "놀이의 시작, 지속, 전환 과정에서 나타난 모습을 정리하였다.",
            "관찰 장면에서 나타난 행동 단서를 중심으로 기록하였다.",
        ],
        "따뜻한 감성형": [
            "아이의 작은 반응과 시도를 중심으로 관찰하였다.",
            "해당 장면에서 아이가 편안하게 경험에 참여하려는 모습이 나타났다.",
            "아이의 조심스러운 시도와 관심 표현을 의미 있게 관찰하였다.",
            "놀이 안에서 아이가 자신의 속도로 참여하는 모습이 나타났다.",
            "아이의 표정과 행동에서 활동에 대한 흥미를 확인할 수 있었다.",
            "교사의 지원 속에서 아이가 안정적으로 참여하는 모습이 관찰되었다.",
            "작은 표현 안에서 아이의 관심과 즐거움이 드러났다.",
            "아이의 반복적인 시도는 놀이에 대한 몰입으로 볼 수 있었다.",
            "아이의 반응을 존중하며 참여 과정을 살펴보았다.",
            "해당 장면은 아이의 정서적 안정감과 참여 의지를 보여주었다.",
        ],
        "이모티콘 활용형": [
            "관찰 기록에서는 이모티콘을 사용하지 않고, 아이의 행동과 반응을 객관적으로 정리하였다.",
            "공식 기록의 성격을 고려하여 행동 중심 문장으로 기록하였다.",
            "아이의 반응은 객관적 표현으로 정리하였다.",
            "관찰 내용은 놀이 상황에서 나타난 행동 사실을 중심으로 기록하였다.",
            "감정 표현보다 관찰 가능한 행동 단서를 중심으로 정리하였다.",
            "아이의 참여 과정은 사실 문장으로 기록하였다.",
            "관찰 기록은 행동, 반응, 지원 내용을 중심으로 구성하였다.",
            "교사의 해석은 최소화하고 관찰 장면을 중심으로 기술하였다.",
            "놀이 중 나타난 시도와 반응을 문장으로 기록하였다.",
            "아이의 행동 흐름을 객관적인 문체로 정리하였다.",
        ],
        "전문적 설명형": [
            "해당 장면은 아이의 탐색, 표현, 관계 경험을 확인할 수 있는 상황으로 볼 수 있다.",
            "교사는 아이의 반응을 관찰하며 필요한 지원을 제공하였다.",
            "놀이 과정은 아이의 현재 흥미와 발달적 요구를 이해하는 단서가 되었다.",
            "아이의 행동은 주변 환경과 상호작용하며 의미를 구성하는 과정으로 볼 수 있다.",
            "해당 경험은 아이의 자기조절과 사회적 반응을 살펴볼 수 있는 장면이었다.",
            "교사는 아이의 참여 수준을 고려하여 활동 지속을 지원하였다.",
            "관찰 장면은 아이의 언어, 인지, 사회정서 발달과 관련하여 해석할 수 있다.",
            "놀이 맥락에서 나타난 반응은 교육적 지원 방향을 설정하는 근거가 되었다.",
            "아이의 시도와 반응은 발달 과정을 이해하는 중요한 자료가 되었다.",
            "교사는 아이의 흥미를 존중하며 놀이가 확장될 수 있도록 환경을 조성하였다.",
        ],
    },
    "서술형 일지용": {
        "팩트 중심형": [
            "교사는 아이들의 반응을 살피며 일과가 안정적으로 이어질 수 있도록 지원하였다.",
            "오늘 일과는 활동 참여와 일상 흐름을 중심으로 진행되었다.",
            "아이들은 각자의 방식으로 활동에 참여하며 경험을 이어갔다.",
            "교사는 활동 전개 과정에서 아이들의 반응을 관찰하였다.",
            "일과 중 나타난 참여 장면을 중심으로 기록하였다.",
            "아이들의 활동 과정과 교사의 지원 내용을 중심으로 정리하였다.",
            "오늘의 일지는 놀이와 일상 경험의 흐름을 중심으로 작성하였다.",
            "활동 중 아이들의 반응과 참여 양상을 살펴보았다.",
            "교사는 아이들이 활동에 안정적으로 참여할 수 있도록 지원하였다.",
            "일과 전반에서 나타난 의미 있는 장면을 중심으로 정리하였다.",
        ],
        "따뜻한 감성형": [
            "교사는 아이들이 자신의 속도에 맞게 경험에 참여할 수 있도록 정서적으로 지원하였다.",
            "오늘 일과 속에서 아이들의 작은 시도와 반응을 살펴볼 수 있었다.",
            "아이들의 표정과 움직임 속에서 놀이에 대한 즐거움이 나타났다.",
            "교사는 아이들의 마음이 안정될 수 있도록 따뜻하게 상호작용하였다.",
            "아이들은 편안한 분위기 속에서 하루의 경험을 이어갔다.",
            "작은 장면 안에서도 아이들의 성장과 시도를 확인할 수 있었다.",
            "오늘 일과는 아이들의 흥미와 정서적 안정감을 바탕으로 이어졌다.",
            "교사는 아이들의 반응을 존중하며 놀이가 자연스럽게 전개되도록 지원하였다.",
            "아이들은 서로의 모습을 살피며 함께하는 즐거움을 경험하였다.",
            "오늘의 장면은 아이들의 따뜻한 관계 경험을 보여주었다.",
        ],
        "이모티콘 활용형": [
            "서술형 일지는 공식 기록의 성격을 고려하여 이모티콘 없이 문장으로 정리하였다.",
            "오늘의 일과는 문장 중심의 기록으로 정리하였다.",
            "아이들의 경험은 객관적이고 서술적인 문장으로 기술하였다.",
            "교사는 활동 흐름과 아이들의 반응을 중심으로 기록하였다.",
            "일지는 놀이의 의미와 일과의 흐름을 함께 담아 작성하였다.",
            "아이들의 참여 장면은 공식 기록에 적합한 표현으로 정리하였다.",
            "감성 표현보다 일과와 지원 과정을 중심으로 기록하였다.",
            "아이들의 시도와 교사의 지원 내용을 균형 있게 서술하였다.",
            "오늘의 장면은 일지 형식에 맞추어 차분하게 정리하였다.",
            "활동 과정은 문장형 기록으로 남겼다.",
        ],
        "전문적 설명형": [
            "해당 경험은 아이들의 탐색, 표현, 사회적 관계 형성과 연결되며, 교사는 놀이와 일상 경험이 자연스럽게 이어질 수 있도록 지원하였다.",
            "오늘의 일과는 아이들의 참여 과정과 반응을 중심으로 구성되었다.",
            "교사는 놀이 맥락 안에서 아이들의 발달적 의미를 살펴보았다.",
            "아이들의 경험은 교육과정과 발달 영역이 통합적으로 나타나는 장면이었다.",
            "활동은 아이들의 흥미를 바탕으로 전개되었으며 교사는 필요한 지원을 제공하였다.",
            "해당 장면은 아이들의 자기표현과 관계 경험을 이해하는 자료가 되었다.",
            "교사는 아이들의 반응을 토대로 놀이 환경을 조정하였다.",
            "오늘 일과는 놀이 중심 교육과정의 흐름 속에서 의미 있게 전개되었다.",
            "아이들의 행동은 탐색과 표현, 상호작용의 관점에서 살펴볼 수 있었다.",
            "교사는 관찰 내용을 바탕으로 다음 놀이 지원 방향을 고려하였다.",
        ],
    },
    "기관 홍보용": {
        "팩트 중심형": [
            "우리 기관은 아이들의 일상 속 배움과 성장을 세심하게 기록하고 있습니다.",
            "아이들은 놀이를 통해 다양한 경험에 참여했습니다.",
            "오늘의 활동은 아이들의 자발적 참여를 중심으로 이루어졌습니다.",
            "우리 기관은 놀이와 일상 속 배움을 균형 있게 지원하고 있습니다.",
            "아이들은 활동 과정에서 탐색과 표현을 경험했습니다.",
            "오늘도 교실에서는 의미 있는 놀이 장면이 이어졌습니다.",
            "우리 기관은 아이들의 작은 시도도 소중한 배움으로 바라보고 있습니다.",
            "아이들의 참여 과정은 성장의 중요한 장면으로 기록되고 있습니다.",
            "오늘의 경험은 아이들의 일상 속 배움으로 연결되었습니다.",
            "우리 기관은 아이들이 안전하고 즐겁게 성장할 수 있도록 지원하고 있습니다.",
        ],
        "따뜻한 감성형": [
            "우리 기관은 아이들이 놀이 속에서 편안하게 경험하고 성장할 수 있도록 함께하고 있습니다.",
            "오늘도 아이들의 하루에는 작고 소중한 배움의 장면이 있었습니다.",
            "아이들의 웃음과 호기심이 교실을 따뜻하게 채웠습니다.",
            "우리 기관은 아이들의 반짝이는 순간을 놓치지 않고 기록하고 있습니다.",
            "작은 손짓과 표정도 아이들의 성장 이야기로 소중히 바라보고 있습니다.",
            "아이들은 따뜻한 관계 속에서 놀이의 즐거움을 경험했습니다.",
            "오늘의 교실에는 아이들의 마음이 열리는 순간들이 있었습니다.",
            "우리 기관은 아이들이 자신답게 자라날 수 있도록 곁에서 지원하고 있습니다.",
            "놀이 속 작은 발견이 아이들의 행복한 배움으로 이어지고 있습니다.",
            "아이들의 하루를 따뜻하게 기록하고 나누는 기관이 되겠습니다.",
        ],
        "이모티콘 활용형": [
            "놀이 속 작은 경험이 아이들의 배움으로 이어질 수 있도록 따뜻하게 지원하고 있습니다 😊",
            "오늘 우리 아이들은 즐겁게 하루를 보냈습니다 🌿",
            "아이들의 호기심이 반짝이는 하루였습니다 ✨",
            "우리 기관은 아이들의 작은 발견을 함께 응원합니다 💛",
            "놀이 안에서 자라는 아이들의 모습을 소중히 기록하고 있습니다 🌱",
            "오늘도 교실에는 웃음과 배움이 함께했습니다 😊",
            "아이들의 하루가 따뜻한 경험으로 채워졌습니다 🌼",
            "작은 놀이가 큰 성장으로 이어지고 있습니다 ✨",
            "아이들의 반응 하나하나를 소중히 바라보고 있습니다 🌿",
            "앞으로도 아이들의 즐거운 배움을 함께 만들어가겠습니다 😊",
        ],
        "전문적 설명형": [
            "우리 기관은 놀이와 일상 경험이 아이들의 발달적 성장으로 연결될 수 있도록 교육적 환경을 구성하고 있습니다.",
            "오늘의 활동은 아이들의 참여, 탐색, 표현 경험을 중심으로 이루어졌습니다.",
            "놀이 중심 교육과정 안에서 아이들은 주도성과 상호작용을 경험했습니다.",
            "우리 기관은 아이들의 발달 특성과 흥미를 반영하여 교육 환경을 마련하고 있습니다.",
            "아이들의 활동 과정은 교육과정과 발달 경험이 통합적으로 나타나는 장면입니다.",
            "교사는 아이들의 반응을 관찰하며 놀이가 확장될 수 있도록 지원하고 있습니다.",
            "아이들은 놀이 안에서 문제 해결, 표현, 관계 경험을 자연스럽게 쌓아가고 있습니다.",
            "우리 기관은 관찰과 기록을 바탕으로 아이들의 배움을 세심하게 지원합니다.",
            "오늘의 장면은 아이들의 자발성과 탐구 과정이 드러난 의미 있는 사례입니다.",
            "앞으로도 아이들의 성장 과정을 교육적으로 해석하고 지원하겠습니다.",
        ],
    },
}

def make_diary_message(restructured_text: str, teacher_tone: str, daily_scope: str, record_type: str) -> str:
    sentence_bank = DIARY_MESSAGE_BANK.get(record_type, DIARY_MESSAGE_BANK["알림장용"]).get(teacher_tone, [])
    selected_sentences = random.sample(sentence_bank, k=min(2, len(sentence_bank))) if sentence_bank else []
    selected_text = "\n".join([f"- {s}" for s in selected_sentences])

    if record_type in ["관찰 기록용", "서술형 일지용"]:
        return (
            f"{restructured_text}\n\n"
            f"{selected_text}"
        )

    if record_type == "기관 홍보용":
        return (
            f"{restructured_text}\n\n"
            f"{selected_text}"
        )

    return (
        f"{restructured_text}\n\n"
        f"{selected_text}"
    )


AGE_NOTICE = {
    "0세": "감각적으로 보고 만지고 느끼며 경험을 쌓아가고 있습니다.",
    "1세": "관심 있는 대상을 반복해서 살펴보며 놀이에 참여하고 있습니다.",
    "2세": "좋아하는 놀이에 관심을 보이며 말과 행동으로 표현하고 있습니다.",
    "3세": "상상과 역할을 더해 놀이를 확장해 가고 있습니다.",
    "4세": "친구들과 생각을 나누며 놀이를 이어가고 있습니다.",
    "5세": "규칙과 협력을 바탕으로 놀이를 주도해 가고 있습니다.",
}

STANDARD_AREAS = ["기본생활", "신체운동", "의사소통", "사회관계", "예술경험", "자연탐구"]
NURI_AREAS = ["신체운동·건강", "의사소통", "사회관계", "예술경험", "자연탐구"]

CURRICULUM_RECORD = {
    "기본생활": "일상 속 안정감과 기본생활 습관을 자연스럽게 경험하는 과정과 연결됩니다.",
    "신체운동": "몸을 움직이며 감각과 신체 조절력을 기르는 경험과 연결됩니다.",
    "신체운동·건강": "신체 움직임을 조절하고 건강하게 놀이에 참여하는 경험과 연결됩니다.",
    "의사소통": "자신의 생각과 느낌을 말, 몸짓, 표정으로 표현하는 경험과 연결됩니다.",
    "사회관계": "친구와 관계를 맺고 함께 놀이를 이어가는 경험과 연결됩니다.",
    "예술경험": "느낌과 생각을 다양한 방식으로 표현하는 경험과 연결됩니다.",
    "자연탐구": "주변 세계에 호기심을 가지고 관찰하고 탐색하는 경험과 연결됩니다.",
}

CURRICULUM_RECORD_NOTE = {
    "기본생활": "일상 속 안정감과 기본생활 습관을 경험하는 과정과 연결됨.",
    "신체운동": "몸을 움직이며 감각과 신체 조절력을 기르는 경험과 연결됨.",
    "신체운동·건강": "신체 움직임을 조절하고 건강하게 놀이에 참여하는 경험과 연결됨.",
    "의사소통": "자신의 생각과 느낌을 말, 몸짓, 표정으로 표현하는 경험과 연결됨.",
    "사회관계": "친구와 관계를 맺고 함께 놀이를 이어가는 경험과 연결됨.",
    "예술경험": "느낌과 생각을 다양한 방식으로 표현하는 경험과 연결됨.",
    "자연탐구": "주변 세계에 호기심을 가지고 관찰하고 탐색하는 경험과 연결됨.",
}

DEVELOPMENT_RECORD_FORMAL = {
    "신체": "신체 조절력과 움직임의 자신감을 키워가는 과정이 나타납니다.",
    "언어": "새로운 어휘와 표현을 시도하며 언어적 경험을 확장합니다.",
    "인지": "비교하고 관찰하며 사고를 넓혀가는 모습이 나타납니다.",
    "사회정서": "친구와 감정을 나누고 관계 속에서 안정감을 경험합니다.",
    "창의성": "새로운 방법을 떠올리고 자신만의 방식으로 표현합니다.",
}

DEVELOPMENT_RECORD_NOTE = {
    "신체": "신체 조절력과 움직임의 자신감을 키워가는 과정이 나타남.",
    "언어": "새로운 어휘와 표현을 시도하며 언어적 경험을 확장함.",
    "인지": "비교하고 관찰하며 사고를 넓혀가는 모습이 나타남.",
    "사회정서": "친구와 감정을 나누고 관계 속에서 안정감을 경험함.",
    "창의성": "새로운 방법을 떠올리고 자신만의 방식으로 표현함.",
}

# 알림장 부모 전달 문구: 각 성향별 10개
PARENT_TEMPLATES = {
    "일반형": [
        "가정에서도 오늘 경험한 이야기를 편안하게 나누어 보시면 좋겠습니다.",
        "OO이의 작은 표현과 반응을 함께 응원해 주세요.",
        "오늘의 경험이 OO이에게 즐거운 기억으로 남았으면 좋겠습니다.",
        "가정에서도 OO이가 이야기하는 놀이 장면에 귀 기울여 주세요.",
        "오늘의 작은 시도가 다음 놀이로 이어질 수 있도록 함께 격려해 주세요.",
        "OO이가 스스로 해보려는 모습을 따뜻하게 바라봐 주세요.",
        "놀이 속에서 보인 관심이 가정 대화로도 이어지면 좋겠습니다.",
        "오늘 경험한 내용을 짧게 다시 이야기해 보면 기억을 정리하는 데 도움이 됩니다.",
        "OO이가 즐거웠던 장면을 떠올릴 수 있도록 편안히 물어봐 주세요.",
        "가정과 원이 함께 OO이의 하루를 응원하겠습니다.",
    ],
    "불안형": [
        "OO이의 속도에 맞추어 천천히 경험하고 있으니 편안하게 지켜봐 주세요.",
        "처음에는 조심스러워도 조금씩 놀이에 익숙해지는 모습을 보이고 있습니다.",
        "아이마다 참여하는 속도가 다르니 오늘의 작은 시도도 소중하게 봐주시면 좋겠습니다.",
        "OO이가 안정감을 느끼며 참여할 수 있도록 원에서도 천천히 지원하고 있습니다.",
        "아직 낯선 장면에서는 시간이 필요하지만, 관심을 보이는 순간들이 나타나고 있습니다.",
        "작은 변화도 꾸준히 관찰하며 가정과 함께 공유하겠습니다.",
        "OO이가 부담을 느끼지 않도록 편안한 분위기 속에서 경험을 이어가고 있습니다.",
        "걱정되실 수 있는 부분은 원에서도 세심하게 살피고 있습니다.",
        "오늘은 작은 참여가 있었고, 그 시도 자체를 의미 있게 보고 있습니다.",
        "가정에서도 결과보다 시도한 마음을 먼저 격려해 주시면 좋겠습니다.",
    ],
    "정보형": [
        "이 활동은 OO이가 직접 보고 만지고 표현해 보는 경험으로 이어졌습니다.",
        "놀이 과정에서 탐색, 표현, 관계 경험이 자연스럽게 함께 이루어졌습니다.",
        "오늘 활동은 OO이가 스스로 시도하고 주변을 살펴보는 데 도움이 되었습니다.",
        "해당 경험은 관찰력과 표현력을 함께 확장하는 과정으로 볼 수 있습니다.",
        "OO이는 놀이 속에서 문제를 발견하고 해결 방법을 찾아보는 경험을 했습니다.",
        "친구와 함께하는 과정에서 의사소통과 사회적 조율 경험이 나타났습니다.",
        "반복해서 시도하는 과정은 집중력과 자기조절력을 기르는 데 도움이 됩니다.",
        "오늘의 장면은 놀이 중심 교육과정 안에서 의미 있는 배움으로 연결됩니다.",
        "감각적으로 탐색하는 과정이 언어와 사고의 확장으로 이어졌습니다.",
        "가정에서도 놀이 과정에서 사용한 말과 행동을 함께 떠올려 보시면 좋겠습니다.",
    ],
    "감성형": [
        "작은 손짓과 표정 속에서도 OO이의 즐거움이 잘 느껴졌습니다.",
        "OO이의 하루 안에 반짝이는 장면이 하나 더 쌓였습니다.",
        "오늘의 놀이가 OO이 마음속에 따뜻한 기억으로 남기를 바랍니다.",
        "OO이가 보여준 작은 미소가 오늘 교실을 더 환하게 만들었습니다.",
        "천천히 다가가고 표현하는 모습에서 OO이만의 속도가 느껴졌습니다.",
        "오늘의 작은 시도 하나가 OO이에게는 큰 용기였을 수 있습니다.",
        "놀이 속에서 OO이의 마음이 편안하게 열리는 순간을 볼 수 있었습니다.",
        "OO이가 경험한 즐거움이 가정에서도 따뜻한 이야기로 이어지길 바랍니다.",
        "아이의 작은 반응을 발견하는 일이 오늘의 소중한 장면이었습니다.",
        "OO이의 하루를 함께 응원할 수 있어 감사한 날이었습니다.",
    ],
}

# 상황별 문구 자동 생성: 기록 유형별 10개씩
OBSERVATION_TEMPLATES = {
    "알림장용": [
        "오늘은 {keyword} 활동을 해보았습니다. OO이는 {action}을 보이며 즐겁게 참여했습니다.",
        "{keyword} 활동 시간에 OO이가 {action}을 보여주었습니다.",
        "오늘 {keyword} 놀이를 하며 OO이가 스스로 관심을 보이고 참여하는 모습을 볼 수 있었습니다.",
        "{keyword} 활동 속에서 OO이는 편안하게 놀이에 참여했습니다.",
        "OO이는 {keyword} 놀이 중 주변을 살피며 {action}을 보였습니다.",
        "{keyword} 활동에서 OO이는 자신의 방식으로 탐색하며 놀이를 이어갔습니다.",
        "오늘 OO이는 {keyword} 장면에서 친구와 함께하는 즐거움을 경험했습니다.",
        "OO이는 {keyword} 놀이를 통해 새롭게 시도해보는 모습을 보였습니다.",
        "{keyword} 활동 중 OO이는 교사의 지원을 받아 안정적으로 참여했습니다.",
        "오늘의 {keyword} 경험은 OO이에게 즐거운 배움의 시간이 되었습니다.",
    ],
    "관찰 기록용": [
        "{keyword} 활동 중 {child}는 {action}을 보임.",
        "{child}는 {keyword} 상황에서 교사의 지원에 반응하며 활동에 참여함.",
        "{keyword} 놀이 과정에서 {child}는 주변 자극에 관심을 보이고 탐색을 시도함.",
        "{child}는 {keyword} 활동 중 또래 또는 교사와의 상호작용을 보임.",
        "{keyword} 활동에서 {child}는 놀이 자료를 살피고 반복적으로 조작함.",
        "{child}는 {keyword} 과정에서 자신의 의도를 행동으로 표현함.",
        "{keyword} 상황에서 {child}는 또래의 행동을 관찰하고 반응함.",
        "{child}는 {keyword} 놀이 중 교사의 언어적 지원에 따라 참여를 이어감.",
        "{keyword} 활동 중 {child}는 관심 있는 자료를 선택하여 탐색함.",
        "{child}는 {keyword} 놀이에서 안정적으로 머물며 활동을 경험함.",
    ],
    "서술형 일지용": [
        "{keyword} 활동을 통해 {child}가 놀이에 참여하는 모습을 관찰할 수 있었음.",
        "오늘 {keyword} 활동에서는 {child}의 참여 과정과 반응을 중심으로 살펴볼 수 있었음.",
        "{keyword} 놀이 과정에서 {child}는 자신의 방식으로 활동에 참여하였음.",
        "교사는 {keyword} 활동 중 {child}의 반응을 살피며 놀이가 이어질 수 있도록 지원하였음.",
        "{keyword} 활동은 {child}가 관심을 표현하고 놀이를 확장하는 계기가 되었음.",
        "{child}는 {keyword} 장면에서 또래와 함께 경험을 나누는 모습을 보였음.",
        "오늘 일과 중 {keyword} 활동을 통해 {child}의 탐색 과정이 나타났음.",
        "교사는 {child}가 {keyword} 놀이에 안정적으로 참여할 수 있도록 환경을 조정하였음.",
        "{keyword} 놀이에서 {child}는 반복적인 시도를 통해 활동에 몰입하였음.",
        "{keyword} 활동은 {child}의 표현과 상호작용을 살펴볼 수 있는 장면이 되었음.",
    ],
    "기관 홍보용": [
        "오늘 우리 아이들은 {keyword} 활동을 통해 즐겁게 배우는 시간을 가졌습니다.",
        "{keyword} 활동 안에서 아이들은 직접 경험하고 느끼며 놀이를 이어갔습니다.",
        "우리 기관은 아이들이 놀이 속에서 자연스럽게 배우고 성장할 수 있도록 다양한 경험을 마련하고 있습니다.",
        "아이들의 작은 호기심이 {keyword} 활동 속에서 즐거운 배움으로 이어졌습니다.",
        "{keyword} 놀이를 통해 아이들은 함께 생각하고 표현하는 시간을 가졌습니다.",
        "오늘 교실에서는 {keyword} 활동을 중심으로 아이들의 웃음과 배움이 함께 피어났습니다.",
        "아이들은 {keyword} 경험을 통해 스스로 탐색하고 표현하는 즐거움을 느꼈습니다.",
        "우리 기관은 놀이 속 작은 장면도 아이들의 성장으로 읽어내고 있습니다.",
        "{keyword} 활동은 아이들이 서로의 생각을 나누고 함께 성장하는 시간이 되었습니다.",
        "오늘의 {keyword} 경험은 아이들의 일상 속 배움으로 차곡차곡 쌓이고 있습니다.",
    ],
}


with tab2:

    render_menu_card(
        "🧚‍♀️ 상황별 문구 자동 생성",
        "사진 장면을 바탕으로 표준보육과정·누리과정, 발달 의미, 부모 전달 문장을 함께 생성합니다.",
        ["0~2세 표준보육과정", "3~5세 누리과정", "알림장 · 관찰 기록 · 서술형 일지 · 기관 홍보용 문구" ]
    )

    play_keyword = st.text_input("사진 속 놀이 키워드 입력", placeholder="예: 바깥놀이, 블록쌓기, 물감놀이, 역할놀이", key="photo_play_keyword")
    age_group = st.selectbox("연령 선택", ["- 선택 -", "0세", "1세", "2세", "3세", "4세", "5세"], key="photo_age_group")

    if age_group in ["0세", "1세", "2세"]:
        curriculum_area = st.selectbox(
            "표준보육과정 영역 선택",
            ["- 선택 -"] + STANDARD_AREAS,
            key="photo_standard_area"
        )
        st.caption("※ 0~2세는 표준보육과정 영역을 기준으로 문구를 생성합니다.")
    elif age_group in ["3세", "4세", "5세"]:
        curriculum_area = st.selectbox(
            "누리과정 영역 선택",
            ["- 선택 -"] + NURI_AREAS,
            key="photo_nuri_area"
        )
        st.caption("※ 3~5세는 누리과정 영역을 기준으로 문구를 생성합니다.")
    else:
        curriculum_area = "- 선택 -"
        st.selectbox(
            "표준보육과정·누리과정 영역 선택",
            ["연령을 먼저 선택해 주세요."],
            key="photo_curriculum_placeholder",
            disabled=True
        )

    development_area = st.selectbox("발달영역 선택", ["- 선택 -", "신체", "언어", "인지", "사회정서", "창의성"], key="photo_development_area")
    observation_type = st.selectbox("기록 유형 선택", ["- 선택 -", "알림장용", "관찰 기록용", "서술형 일지용", "기관 홍보용"], key="photo_observation_type")

    parent_type = None
    if observation_type == "알림장용":
        parent_type = st.selectbox("부모 성향 선택", ["- 선택 -", "일반형", "불안형", "정보형", "감성형"], key="photo_parent_type")

    child_action = st.selectbox(
        "사진 속 아이들의 모습 선택",
        [
            "- 선택 -",
            "호기심을 보이며 탐색하는 모습",
            "친구와 함께 협력하는 모습",
            "자신의 생각을 표현하는 모습",
            "반복하며 시도하는 모습",
            "새로운 방법을 찾아보는 모습",
            "교사의 지원을 받아 안정적으로 참여하는 모습",
            "놀이 자료를 조심스럽게 살펴보는 모습",
            "또래의 행동을 관찰하고 따라 해보는 모습",
            "자신이 선택한 놀이에 집중하는 모습",
            "완성한 결과물을 교사나 친구에게 보여주는 모습",
            "규칙을 이해하고 놀이에 참여하려는 모습",
            "감각적으로 느끼고 몸으로 표현하는 모습",
            "상상한 내용을 역할이나 말로 나타내는 모습",
            "어려운 부분을 다시 시도하며 조절하는 모습",
            "친구의 제안을 듣고 함께 방향을 바꾸어 보는 모습",
        ],
        key="photo_child_action"
    )


    if st.button("상황별 문구 생성", key="photo_generate_text"):
        if not play_keyword.strip():
            st.warning("사진 속 놀이 키워드를 입력해 주세요.")
        elif age_group == "- 선택 -":
            st.warning("연령을 선택해 주세요.")
        elif curriculum_area == "- 선택 -":
            st.warning("표준보육과정·누리과정 영역을 선택해 주세요.")
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
                elif observation_type == "관찰 기록용":
                    final_result = f"{base_sentence} {DEVELOPMENT_RECORD_NOTE[development_area]}"
                elif observation_type == "서술형 일지용":
                    final_result = f"{base_sentence} {CURRICULUM_RECORD_NOTE[curriculum_area]} {DEVELOPMENT_RECORD_NOTE[development_area]}"
                elif observation_type == "기관 홍보용":
                    final_result = f"{base_sentence} {CURRICULUM_RECORD[curriculum_area]} {DEVELOPMENT_RECORD_FORMAL[development_area]}"
                else:
                    final_result = f"{base_sentence} {AGE_NOTICE[age_group]}"
                st.write(f"{idx}. {final_result}")

                save_phrase_log(
                    record_type=observation_type,
                    play_keyword=play_keyword,
                    age_group=age_group,
                    curriculum_area=curriculum_area,
                    development_area=development_area,
                    child_action=child_action,
                    generated_text=final_result
                )


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

    render_menu_card(
        "✨ 초간편 사진 보정",
        "원본과 보정본을 비교하며 밝기, 대비, 채도, 선명도를 직접 조절할 수 있습니다.",
        ["밝기", "대비", "채도", "선명도"]
    )

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

    render_menu_card(
        "📝 일지 요약 및 알림장 생성",
        "일지를 입력하면 핵심 내용을 요약하고, 기록 유형과 성향에 맞는 문장을 생성합니다.",
        ["알림장용", "관찰 기록용", "서술형 일지용", "기관 홍보용"]
    )

    record_type = st.selectbox(
        "기록 유형 선택",
        ["- 선택 -", "알림장용", "관찰 기록용", "서술형 일지용", "기관 홍보용"],
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

            restructured_summary = build_restructured_diary(
                original_text=diary_text,
                summary=summary,
                daily_scope=daily_scope,
                record_type=record_type
            )

            generated_message = make_diary_message(
                restructured_summary,
                teacher_tone,
                daily_scope,
                record_type
            )
            save_diary_log(
                record_type=record_type,
                teacher_tone=teacher_tone,
                daily_scope=daily_scope,
                original_text=diary_text,
                summary=restructured_summary,
                generated_message=generated_message
            )

            st.success("일지 요약과 문구 생성이 완료되었습니다.")

            st.markdown("### 재구성된 핵심 내용")
            st.markdown(
                f"<div class='result-card-gray'>{restructured_summary}</div>",
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
    render_menu_card(
        "🌡️ 지금 그리고 오늘, 교사의 온도",
        "하루를 마무리하며, 교사의 마음을 짧게 기록하는 감성 기록 공간입니다.",
        ["감성 일기", "3줄 요약", "마음온도"]
    )

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

    render_menu_card(
        "🔐 관리자 모드",
        "가입자 정보와 생성 기록을 확인하고, 통계 그래프와 CSV 다운로드를 관리합니다.",
        ["누적 기록", "통계", "CSV"]
    )

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
            phrase_df = load_table("phrase_logs")

            subscribers_filtered = filter_by_period(subscribers_df, dashboard_period)
            diary_filtered = filter_by_period(diary_df, dashboard_period)
            temp_filtered = filter_by_period(temp_df, dashboard_period)
            phrase_filtered = filter_by_period(phrase_df, dashboard_period)
            mailing_count = 0
            if not subscribers_filtered.empty and "mailing_agree" in subscribers_filtered.columns:
                mailing_count = subscribers_filtered[
                    subscribers_filtered["mailing_agree"].astype(str) == "True"
                ].shape[0]

            col1, col2, col3, col4, col5 = st.columns(5)
            col1.metric("가입자 수", f"{len(subscribers_filtered)}명")
            col2.metric("메일링 동의", f"{mailing_count}명")
            col3.metric("알림장 생성", f"{len(diary_filtered)}건")
            col4.metric("상황별 문구 생성", f"{len(phrase_filtered)}건")
            col5.metric("교사의 온도 기록", f"{len(temp_filtered)}건")

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

                if not phrase_filtered.empty and "record_type" in phrase_filtered.columns:
                    phrase_counts = phrase_filtered["record_type"].dropna()
                    phrase_counts = phrase_counts[phrase_counts != ""]

                    if not phrase_counts.empty:
                        draw_category_chart(
                            phrase_counts.value_counts(),
                            "상황별 문구 자동 생성 유형"
                        )

                else:
                    st.caption("상황별 문구 생성 기록이 없습니다.")
            
            st.divider()

            admin_menu = st.selectbox(
                "조회할 데이터 선택",
                ["가입자 정보", "알림장 생성 기록", "상황별 문구 생성 기록", "교사의 온도 기록"],
                key="admin_data_select"
            )

            table_map = {
                "가입자 정보": "subscribers",
                "알림장 생성 기록": "diary_logs",
                "상황별 문구 생성 기록": "phrase_logs",
                "교사의 온도 기록": "teacher_temperature_logs"
            }

            file_map = {
                "가입자 정보": "subscribers.csv",
                "알림장 생성 기록": "diary_logs.csv",
                "상황별 문구 생성 기록": "phrase_logs.csv",
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
                "play_keyword": "사진 속 놀이 키워드 입력",
                "age_group": "연령 선택",
                "curriculum_area": "누리과정 영역 선택",
                "development_area": "발달 영역 선택",
                "child_action": "사진 속 아이들의 모습 선택",
                "generated_text": "생성 문구",

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

