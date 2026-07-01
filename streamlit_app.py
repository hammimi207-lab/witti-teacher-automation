# -*- coding: utf-8 -*-
# 공지사항 편집 영역 확대 · 첨부파일(최대 5개) 기능 추가
# 놀이 기록 자동화 플랫폼
# 실행: streamlit run streamlit_app.py

import base64
import hashlib
import hmac
import re
import secrets
import shutil
import html
import io
import json
import random
import tempfile
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo
from urllib.parse import urlparse

import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import pandas as pd
import streamlit as st
import streamlit.components.v1 as components
from PIL import Image, ImageEnhance
from streamlit_javascript import st_javascript

try:
    import altair as alt
except Exception:
    alt = None

try:
    from openai import OpenAI
except Exception:
    OpenAI = None

from manual_automation_app import rank_images

st.set_page_config(page_title="놀이 기록 자동화", page_icon="🌿", layout="wide", initial_sidebar_state="collapsed")

st.markdown("""

<style>
:root {
    --witti-bg:#F6F8FB;
    --witti-panel:#FFFFFF;
    --witti-panel-soft:#F8FAFC;
    --witti-line:#E5EAF1;
    --witti-line-blue:#D7E8FF;
    --witti-navy:#172B4D;
    --witti-text:#223044;
    --witti-muted:#667085;
    --witti-blue:#0CC0DF;
    --witti-blue-2:#36D7EF;
    --witti-blue-soft:#E9FBFF;
    --witti-green-soft:#E8F8EF;
    --witti-green:#188B55;
    --witti-yellow-soft:#FFF6DD;
    --witti-shadow:0 12px 32px rgba(15, 23, 42, 0.06);
    --witti-shadow-soft:0 8px 22px rgba(15, 23, 42, 0.045);
}

html, body, [class*="css"] {
    font-family: 'Pretendard', 'SUIT', 'Noto Sans KR', 'Malgun Gothic', sans-serif !important;
    color-scheme: light !important;
}

html, body, .stApp, [data-testid="stAppViewContainer"] {
    color-scheme: light !important;
}

#MainMenu, footer {
    visibility: hidden;
}

/* 사이드바 열기/닫기 버튼은 Streamlit header 안에 있으므로 header를 숨기면 설정창 버튼까지 사라집니다. */
header[data-testid="stHeader"] {
    visibility: visible !important;
    background: rgba(250, 252, 255, 0.72) !important;
    backdrop-filter: blur(10px);
    border-bottom: 1px solid rgba(229, 234, 241, 0.65);
    z-index: 999999 !important;
}

header[data-testid="stHeader"] * {
    visibility: visible !important;
}

/* 접힌 설정창 열기 버튼이 항상 보이도록 보정 */
div[data-testid="stSidebarCollapsedControl"],
div[data-testid="collapsedControl"] {
    visibility: visible !important;
    opacity: 1 !important;
    display: flex !important;
    z-index: 2147483646 !important;
}

div[data-testid="stSidebarCollapsedControl"] button,
div[data-testid="collapsedControl"] button {
    visibility: visible !important;
    opacity: 1 !important;
    background: #FFFFFF !important;
    color: #1D4ED8 !important;
    border: 1px solid #D7E6F8 !important;
    border-radius: 999px !important;
    box-shadow: 0 8px 20px rgba(15, 23, 42, 0.10) !important;
}

.stApp {
    background:
        radial-gradient(circle at 12% 0%, rgba(219, 234, 254, 0.72) 0, rgba(219, 234, 254, 0) 34%),
        linear-gradient(180deg, #FAFCFF 0%, var(--witti-bg) 44%, #FFFFFF 100%);
}

.block-container {
    padding-top: 1.45rem;
    padding-left: 2.2rem;
    padding-right: 2.2rem;
    max-width: 1180px;
}

h1, h2, h3, h4 {
    color: var(--witti-navy) !important;
    letter-spacing: -0.7px !important;
}

h2, h3 {
    margin-top: 1.15rem !important;
}

p, li, label, .stMarkdown {
    color: var(--witti-text);
}

.app-hero {
    background: rgba(255, 255, 255, 0.92);
    border: 1px solid var(--witti-line);
    border-radius: 24px;
    padding: 26px 30px 24px 30px;
    margin: 4px 0 20px 0;
    box-shadow: var(--witti-shadow);
}

.app-eyebrow {
    display:inline-flex;
    align-items:center;
    gap:6px;
    color: var(--witti-blue);
    background: var(--witti-blue-soft);
    border: 1px solid #D4E7FF;
    border-radius: 999px;
    font-size: 13px;
    font-weight: 800;
    padding: 7px 12px;
    margin-bottom: 12px;
}

.app-hero h1 {
    font-size: 34px;
    line-height: 1.24;
    margin: 0 0 8px 0 !important;
    color: var(--witti-navy) !important;
}

.app-hero p {
    margin: 0;
    color: var(--witti-muted);
    font-size: 15px;
    line-height: 1.7;
}

.hero-links {
    display:flex;
    flex-wrap:wrap;
    gap:8px;
    margin-top: 16px;
}

.hero-link {
    display:inline-flex;
    align-items:center;
    gap:6px;
    color:#1D4ED8 !important;
    background:#F8FBFF;
    border:1px solid #DCEBFF;
    border-radius:999px;
    padding:8px 12px;
    font-size:13px;
    font-weight:700;
    text-decoration:none !important;
}

span.hero-link {
    cursor: default;
}

.hero-link strong {
    color:#0F3B8F;
    font-weight:900;
}

.small-guide strong {
    color:#0F3B8F;
    font-weight:900;
}

.small-guide {
    color: var(--witti-muted);
    font-size:14px;
    line-height:1.75;
    background: #FFFFFF;
    border: 1px solid var(--witti-line);
    border-radius: 18px;
    padding: 14px 18px;
    margin: 8px 0 22px 0;
    box-shadow: var(--witti-shadow-soft);
}

/* 탭 메뉴바: 캡처본처럼 정돈된 내비게이션 느낌 */
div[data-testid="stTabs"] > div[role="tablist"] {
    gap: 8px;
    background: #FFFFFF;
    border: 1px solid var(--witti-line);
    border-radius: 18px;
    padding: 8px;
    box-shadow: var(--witti-shadow-soft);
    margin-bottom: 18px;
}

div[data-testid="stTabs"] button[data-baseweb="tab"] {
    background: transparent !important;
    border: 1px solid transparent !important;
    border-radius: 12px !important;
    padding: 10px 14px !important;
    color: #55677E !important;
    font-weight: 800 !important;
    min-height: 42px !important;
}

div[data-testid="stTabs"] button[data-baseweb="tab"]:hover {
    background: #F5F9FF !important;
    color: var(--witti-navy) !important;
}

div[data-testid="stTabs"] button[data-baseweb="tab"][aria-selected="true"] {
    background: #EAF3FF !important;
    color: #1D4ED8 !important;
    border-color: #D3E6FF !important;
    box-shadow: none !important;
}

/* 입력 요소: 모바일 다크모드/카카오 인앱 브라우저에서도 글자가 보이도록 강제 */
.stTextInput input,
.stTextArea textarea,
[data-baseweb="input"] input,
[data-baseweb="textarea"] textarea,
div[data-baseweb="select"] > div,
.stMultiSelect div[data-baseweb="select"] > div {
    border-radius: 12px !important;
    border: 1px solid #DCE5F0 !important;
    background-color: #FFFFFF !important;
    color: var(--witti-navy) !important;
    -webkit-text-fill-color: var(--witti-navy) !important;
    caret-color: var(--witti-navy) !important;
    box-shadow: none !important;
    outline: none !important;
    -webkit-appearance: none !important;
    appearance: none !important;
    color-scheme: light !important;
}

.stTextInput input::placeholder,
.stTextArea textarea::placeholder,
[data-baseweb="input"] input::placeholder,
[data-baseweb="textarea"] textarea::placeholder,
input::placeholder,
textarea::placeholder {
    color: #98A2B3 !important;
    -webkit-text-fill-color: #98A2B3 !important;
    opacity: 1 !important;
}

.stTextInput input:focus,
.stTextArea textarea:focus,
[data-baseweb="input"] input:focus,
[data-baseweb="textarea"] textarea:focus,
div[data-baseweb="select"]:focus-within > div {
    border-color: #7AB8E8 !important;
    box-shadow: 0 0 0 3px rgba(12,192,223,0.10) !important;
    outline: none !important;
}

/* selectbox 내부 값과 기본값(- 선택 -)이 흰색으로 사라지는 문제 방지 */
div[data-baseweb="select"] *,
div[data-baseweb="select"] input,
div[data-baseweb="select"] span,
div[data-baseweb="select"] div {
    color: var(--witti-navy) !important;
    -webkit-text-fill-color: var(--witti-navy) !important;
}

div[data-baseweb="select"] svg {
    color: #667085 !important;
    fill: #667085 !important;
    -webkit-text-fill-color: initial !important;
}

/* 모바일에서 select 옵션창이 검은색으로 뜨는 현상 완화 */
div[data-baseweb="popover"],
div[data-baseweb="popover"] *,
div[data-baseweb="menu"],
ul[data-baseweb="menu"],
div[role="listbox"],
div[role="listbox"] * {
    color-scheme: light !important;
}

div[data-baseweb="popover"] > div,
div[data-baseweb="menu"],
ul[data-baseweb="menu"],
div[role="listbox"] {
    background: #FFFFFF !important;
    color: var(--witti-navy) !important;
    -webkit-text-fill-color: var(--witti-navy) !important;
    border: 1px solid #DCE5F0 !important;
    box-shadow: 0 14px 36px rgba(15, 23, 42, 0.14) !important;
}

li[role="option"],
div[role="option"],
ul[data-baseweb="menu"] li {
    background: #FFFFFF !important;
    color: var(--witti-navy) !important;
    -webkit-text-fill-color: var(--witti-navy) !important;
}

li[role="option"]:hover,
div[role="option"]:hover,
ul[data-baseweb="menu"] li:hover {
    background: #F1F8FF !important;
    color: var(--witti-navy) !important;
}

/* 버튼 디자인: 남색 계열, 흰색 고딕 볼드, 그림자 없음 */
.stButton > button,
.stDownloadButton > button,
div[data-testid="stButton"] button,
div[data-testid="stDownloadButton"] button {
    min-height: 42px !important;
    border-radius: 12px !important;
    font-family: 'Pretendard', 'SUIT', 'Noto Sans KR', 'Malgun Gothic', sans-serif !important;
    font-weight: 800 !important;
    letter-spacing: -0.2px !important;
    border: 1px solid #0B2A45 !important;
    background: linear-gradient(135deg, #0B2A45 0%, #123A5A 55%, #1B4F72 100%) !important;
    color: #FFFFFF !important;
    -webkit-text-fill-color: #FFFFFF !important;
    box-shadow: none !important;
    text-shadow: none !important;
    transition: background 0.16s ease, border-color 0.16s ease, filter 0.16s ease;
}

/* Streamlit 버튼 안쪽의 p/span 텍스트까지 강제로 흰색 처리 */
.stButton > button *,
.stDownloadButton > button *,
div[data-testid="stButton"] button *,
div[data-testid="stDownloadButton"] button * {
    color: #FFFFFF !important;
    -webkit-text-fill-color: #FFFFFF !important;
    font-family: 'Pretendard', 'SUIT', 'Noto Sans KR', 'Malgun Gothic', sans-serif !important;
    font-weight: 800 !important;
}

.stButton > button:hover,
.stDownloadButton > button:hover,
div[data-testid="stButton"] button:hover,
div[data-testid="stDownloadButton"] button:hover {
    background: linear-gradient(135deg, #081F35 0%, #102F4C 55%, #174764 100%) !important;
    border-color: #081F35 !important;
    color: #FFFFFF !important;
    -webkit-text-fill-color: #FFFFFF !important;
    box-shadow: none !important;
    transform: none !important;
    filter: brightness(1.02);
}

.stButton > button:hover *,
.stDownloadButton > button:hover *,
div[data-testid="stButton"] button:hover *,
div[data-testid="stDownloadButton"] button:hover * {
    color: #FFFFFF !important;
    -webkit-text-fill-color: #FFFFFF !important;
}

.stButton > button:active,
.stDownloadButton > button:active,
div[data-testid="stButton"] button:active,
div[data-testid="stDownloadButton"] button:active {
    background: linear-gradient(135deg, #06182A 0%, #0B263F 55%, #123A55 100%) !important;
    color: #FFFFFF !important;
    -webkit-text-fill-color: #FFFFFF !important;
    box-shadow: none !important;
    transform: none !important;
}

.stButton > button:focus,
.stDownloadButton > button:focus,
div[data-testid="stButton"] button:focus,
div[data-testid="stDownloadButton"] button:focus {
    color: #FFFFFF !important;
    -webkit-text-fill-color: #FFFFFF !important;
    box-shadow: none !important;
    outline: 2px solid rgba(27, 79, 114, 0.28) !important;
    outline-offset: 2px !important;
}

/* 비활성화 버튼도 글씨가 보이도록 흰색 유지 */
.stButton > button:disabled,
.stDownloadButton > button:disabled,
div[data-testid="stButton"] button:disabled,
div[data-testid="stDownloadButton"] button:disabled,
.stButton > button[disabled],
.stDownloadButton > button[disabled],
div[data-testid="stButton"] button[disabled],
div[data-testid="stDownloadButton"] button[disabled],
.stButton > button[aria-disabled="true"],
.stDownloadButton > button[aria-disabled="true"],
div[data-testid="stButton"] button[aria-disabled="true"],
div[data-testid="stDownloadButton"] button[aria-disabled="true"] {
    background: linear-gradient(135deg, #31465B 0%, #405970 55%, #526F86 100%) !important;
    border-color: #31465B !important;
    color: #FFFFFF !important;
    -webkit-text-fill-color: #FFFFFF !important;
    opacity: 0.72 !important;
    box-shadow: none !important;
}

.stButton > button:disabled *,
.stDownloadButton > button:disabled *,
div[data-testid="stButton"] button:disabled *,
div[data-testid="stDownloadButton"] button:disabled *,
.stButton > button[disabled] *,
.stDownloadButton > button[disabled] *,
div[data-testid="stButton"] button[disabled] *,
div[data-testid="stDownloadButton"] button[disabled] *,
.stButton > button[aria-disabled="true"] *,
.stDownloadButton > button[aria-disabled="true"] *,
div[data-testid="stButton"] button[aria-disabled="true"] *,
div[data-testid="stDownloadButton"] button[aria-disabled="true"] * {
    color: #FFFFFF !important;
    -webkit-text-fill-color: #FFFFFF !important;
    font-weight: 800 !important;
}

.menu-card {
    background: rgba(255,255,255,0.95);
    border: 1px solid var(--witti-line);
    border-radius: 22px;
    padding: 22px 24px;
    margin: 10px 0 20px 0;
    box-shadow: var(--witti-shadow);
}

.menu-card-title {
    font-size: 22px;
    font-weight: 900;
    color: var(--witti-navy);
    margin-bottom: 8px;
}

.menu-card-desc {
    font-size: 15px;
    line-height: 1.75;
    color: var(--witti-muted);
    margin-bottom: 9px;
}

.info-chip {
    display:inline-flex;
    align-items:center;
    background:#F4F8FF;
    color:#245B99;
    border:1px solid #DCEBFF;
    border-radius:999px;
    padding:6px 11px;
    font-size:12.5px;
    font-weight:800;
    margin: 4px 4px 4px 0;
}

.letter-box {
    font-size: 17px;
    line-height: 1.85;
    color: var(--witti-text);
    background: #FFFFFF;
    padding: 24px;
    border-radius: 18px;
    border: 1px solid var(--witti-line);
    white-space: pre-wrap;
    margin-top: 12px;
    box-shadow: var(--witti-shadow-soft);
}

.result-card-blue {
    color: var(--witti-text);
    background-color:#F1F8FF;
    border: 1px solid #CFE4FF;
    padding:18px 20px;
    border-radius:18px;
    font-size:15px;
    font-weight:400;
    line-height:1.82;
    white-space:pre-wrap;
    box-shadow: var(--witti-shadow-soft);
}

.result-card-gray {
    color: var(--witti-text);
    background-color:#FFFFFF;
    border: 1px solid var(--witti-line);
    padding:18px 20px;
    border-radius:18px;
    font-size:15px;
    font-weight:400;
    line-height:1.82;
    white-space:pre-wrap;
    box-shadow: var(--witti-shadow-soft);
    margin: 10px 0;
}


/* 놀이 이야기 결과: 제목은 구분용으로만, 본문은 읽기 편한 크기로 표시 */
.play-story-card {
    color: var(--witti-text);
    background: #FFFFFF;
    border: 1px solid #DCE8F5;
    border-radius: 18px;
    padding: 20px;
    margin: 12px 0;
    box-shadow: var(--witti-shadow-soft);
}

.play-story-title {
    color: var(--witti-navy);
    font-size: 18px;
    font-weight: 800;
    letter-spacing: -0.35px;
    line-height: 1.45;
    margin: 0 0 5px 0;
    word-break: keep-all;
}

.play-story-meta {
    color: var(--witti-muted);
    font-size: 12.5px;
    font-weight: 400;
    line-height: 1.62;
    padding-bottom: 13px;
    margin-bottom: 2px;
    border-bottom: 1px solid #E7EEF6;
}

.play-story-section {
    padding: 14px 0;
    border-bottom: 1px solid #EEF3F8;
}

.play-story-section:last-child {
    border-bottom: none;
    padding-bottom: 0;
}

.play-story-section-title {
    color: #174F80;
    font-weight: 800;
    font-size: 14.5px;
    line-height: 1.45;
    margin-bottom: 7px;
}

.play-story-section-body {
    color: #344054;
    font-size: 14.5px;
    font-weight: 400;
    line-height: 1.86;
    white-space: normal;
    word-break: keep-all;
    overflow-wrap: break-word;
}

@media (max-width: 768px) {
    .play-story-card {
        padding: 16px;
        border-radius: 15px;
    }

    .play-story-title {
        font-size: 17px;
        line-height: 1.42;
    }

    .play-story-meta {
        font-size: 12px;
    }

    .play-story-section-title {
        font-size: 14px;
    }

    .play-story-section-body {
        font-size: 14px;
        line-height: 1.78;
    }
}

[data-testid="stMetric"] {
    background:#FFFFFF;
    border:1px solid var(--witti-line);
    border-radius:18px;
    padding:14px;
    box-shadow:var(--witti-shadow-soft);
}

div[data-testid="stAlert"] {
    border-radius: 16px !important;
    border: 1px solid #DDEBE4 !important;
}

div[data-testid="stFileUploader"] section {
    border-radius: 16px !important;
    border: 1px dashed #BBD7F6 !important;
    background: #FBFDFF !important;
}

div[data-testid="stExpander"] {
    border: 1px solid var(--witti-line) !important;
    border-radius: 18px !important;
    background: #FFFFFF !important;
    box-shadow: var(--witti-shadow-soft);
}

hr {
    border-color: #E5EAF1 !important;
}

/* 접힌 설정창 열기 버튼 툴팁
   실제 위치는 apply_sidebar_open_hint()의 JS가 화살표 버튼 좌표를 읽어 바로 옆에 표시합니다. */
#witti-sidebar-open-tooltip {
    position: fixed;
    display: none;
    z-index: 2147483647;
    pointer-events: none;
    white-space: nowrap;
    background: #172B4D;
    color: #FFFFFF;
    border-radius: 999px;
    padding: 7px 11px;
    font-size: 13px;
    font-weight: 800;
    line-height: 1;
    box-shadow: 0 8px 22px rgba(22,50,79,0.18);
}


/* 모바일에서 Streamlit 기본 사이드바 버튼이 숨겨지는 경우를 대비한 설정 열기 버튼 */
#witti-mobile-settings-launcher {
    display: none;
    position: fixed;
    align-items: center;
    gap: 5px;
    z-index: 2147483647;
    left: 12px;
    top: 12px;
    min-height: 34px;
    padding: 8px 12px;
    border-radius: 999px;
    border: 1px solid #D7E6F8;
    background: rgba(255, 255, 255, 0.96);
    color: #123A5A;
    -webkit-text-fill-color: #123A5A;
    font-family: 'Pretendard', 'SUIT', 'Noto Sans KR', 'Malgun Gothic', sans-serif;
    font-size: 13px;
    font-weight: 900;
    box-shadow: 0 8px 20px rgba(15, 23, 42, 0.12);
    cursor: pointer;
    user-select: none;
}

@media (max-width: 768px) {
    #witti-mobile-settings-launcher {
        display: inline-flex !important;
    }

    div[data-testid="stSidebarCollapsedControl"],
    div[data-testid="collapsedControl"] {
        visibility: visible !important;
        opacity: 1 !important;
        display: flex !important;
        position: fixed !important;
        left: 12px !important;
        top: 12px !important;
        z-index: 2147483646 !important;
    }

    .block-container {
        padding-top: 3.35rem;
        padding-left: 1rem;
        padding-right: 1rem;
        max-width: 100%;
    }

    .app-hero {
        padding: 20px 18px;
        border-radius: 20px;
    }

    .app-hero h1 {
        font-size: clamp(24px, 7.2vw, 31px) !important;
        line-height: 1.28 !important;
        word-break: keep-all !important;
        overflow-wrap: normal !important;
        letter-spacing: -1.1px !important;
    }

    h1 {
        font-size: clamp(25px, 7vw, 31px) !important;
        line-height:1.28 !important;
        word-break: keep-all !important;
        overflow-wrap: normal !important;
    }
    h2 { font-size: clamp(22px, 6.2vw, 27px) !important; line-height:1.32 !important; word-break:keep-all !important; }
    h3 { font-size: clamp(19px, 5.4vw, 23px) !important; line-height:1.34 !important; word-break:keep-all !important; }
    h4 { font-size: 18px !important; word-break:keep-all !important; }

    label, p { font-size: 15px !important; line-height: 1.55 !important; }
    textarea, input, select {
        font-size: 16px !important;
        color: var(--witti-navy) !important;
        -webkit-text-fill-color: var(--witti-navy) !important;
        background-color: #FFFFFF !important;
        color-scheme: light !important;
    }

    div[data-testid="stTabs"] > div[role="tablist"] {
        overflow-x: auto;
        flex-wrap: nowrap;
        justify-content: flex-start;
    }

    div[data-testid="stTabs"] button[data-baseweb="tab"] {
        font-size: 13px !important;
        padding: 8px 10px !important;
        margin-right: 0 !important;
        min-width: max-content;
    }

    .hero-links {
        display: flex !important;
        flex-direction: column !important;
        align-items: stretch !important;
        gap: 10px !important;
    }

    .hero-link {
        width: 100% !important;
        box-sizing: border-box !important;
        justify-content: flex-start !important;
        white-space: normal !important;
        word-break: keep-all !important;
        overflow-wrap: anywhere !important;
        font-size: 14px !important;
        line-height: 1.45 !important;
    }

    .menu-card { padding: 16px !important; border-radius: 18px !important; }
    .menu-card-title {
        font-size: clamp(21px, 6vw, 26px) !important;
        line-height: 1.32 !important;
        word-break: keep-all !important;
        overflow-wrap: normal !important;
    }
    .menu-card-desc { font-size: 14px !important; word-break: keep-all !important; }

    .letter-box,
    .result-card-blue,
    .result-card-gray {
        font-size: 16px !important;
        line-height: 1.75 !important;
        padding: 16px !important;
        border-radius: 14px !important;
    }
}


/* ===== 최종 모바일 보정: 이메일 안내, 입력창 그림자, 관리자 통계 배경 ===== */
/* 입력창/선택창의 검은색 포커스 그림자와 기본 그림자를 일괄 제거 */
.stTextInput input,
.stTextArea textarea,
[data-baseweb="input"],
[data-baseweb="textarea"],
[data-baseweb="select"],
[data-baseweb="select"] > div,
.stTextInput div[data-baseweb="input"],
.stTextArea div[data-baseweb="textarea"],
.stMultiSelect div[data-baseweb="select"] > div {
    box-shadow: none !important;
    -webkit-box-shadow: none !important;
    outline: none !important;
    filter: none !important;
}

.stTextInput input:focus,
.stTextArea textarea:focus,
[data-baseweb="input"]:focus-within,
[data-baseweb="textarea"]:focus-within,
[data-baseweb="select"]:focus-within,
div[data-baseweb="select"]:focus-within > div,
input:focus,
textarea:focus,
input:focus-visible,
textarea:focus-visible {
    border-color: #BFD0E3 !important;
    box-shadow: none !important;
    -webkit-box-shadow: none !important;
    outline: none !important;
    filter: none !important;
}

/* 관리자 통계 차트 영역이 모바일/다크모드에서 검게 보이지 않도록 고정 */
div[data-testid="stVegaLiteChart"],
div[data-testid="stVegaLiteChart"] > div,
div[data-testid="stVegaLiteChart"] canvas,
div[data-testid="stVegaLiteChart"] svg,
div.vega-embed,
div.vega-embed > div {
    background: #FFFFFF !important;
    color-scheme: light !important;
}

@media (max-width: 768px) {
    /* 이메일 안내 문구가 폰 화면에서 한 글자씩 밀리거나 분리되지 않도록 축소/정렬 */
    .hero-links {
        gap: 8px !important;
    }

    .hero-link {
        display: flex !important;
        flex-wrap: wrap !important;
        align-items: center !important;
        width: 100% !important;
        max-width: 100% !important;
        padding: 9px 10px !important;
        font-size: clamp(12px, 3.35vw, 13.5px) !important;
        line-height: 1.42 !important;
        white-space: normal !important;
        word-break: keep-all !important;
        overflow-wrap: anywhere !important;
    }

    span.hero-link {
        gap: 4px 6px !important;
    }

    span.hero-link strong {
        display: inline !important;
        min-width: 0 !important;
        max-width: 100% !important;
        font-size: clamp(11.5px, 3.25vw, 13px) !important;
        line-height: 1.38 !important;
        word-break: break-all !important;
        overflow-wrap: anywhere !important;
        letter-spacing: -0.25px !important;
    }

    /* 모바일에서 입력 중 나타나는 두꺼운 검은 테두리/그림자 제거 */
    .stTextInput input,
    .stTextArea textarea,
    [data-baseweb="input"],
    [data-baseweb="textarea"],
    [data-baseweb="select"],
    [data-baseweb="select"] > div {
        box-shadow: none !important;
        -webkit-box-shadow: none !important;
        outline: none !important;
        filter: none !important;
    }

    .stTextInput input:focus,
    .stTextArea textarea:focus,
    [data-baseweb="input"]:focus-within,
    [data-baseweb="textarea"]:focus-within,
    [data-baseweb="select"]:focus-within,
    div[data-baseweb="select"]:focus-within > div,
    input:focus,
    textarea:focus,
    input:focus-visible,
    textarea:focus-visible {
        border-color: #BFD0E3 !important;
        box-shadow: none !important;
        -webkit-box-shadow: none !important;
        outline: none !important;
    }
}


/* 놀이 이야기 등 복수 선택 항목: 선택된 태그를 차분한 파란색 칩으로 표시 */
div[data-testid="stMultiSelect"] [data-baseweb="tag"],
div[data-testid="stMultiSelect"] span[data-baseweb="tag"] {
    background: #EAF4FF !important;
    border: 1px solid #9CCBFF !important;
    border-radius: 8px !important;
    color: #1D4ED8 !important;
    -webkit-text-fill-color: #1D4ED8 !important;
    box-shadow: none !important;
}

div[data-testid="stMultiSelect"] [data-baseweb="tag"] *,
div[data-testid="stMultiSelect"] span[data-baseweb="tag"] * {
    color: #1D4ED8 !important;
    -webkit-text-fill-color: #1D4ED8 !important;
    font-weight: 700 !important;
}

div[data-testid="stMultiSelect"] [data-baseweb="tag"] svg,
div[data-testid="stMultiSelect"] span[data-baseweb="tag"] svg {
    fill: #1D4ED8 !important;
    color: #1D4ED8 !important;
}

/* 공지 본문에 붙여넣은 외부 링크 */
.notice-rich-content .notice-inline-link,
.notice-rich-content a[href^="http://"],
.notice-rich-content a[href^="https://"] {
    color: #0B63B6 !important;
    font-weight: 800;
    text-decoration: underline !important;
    text-underline-offset: 2px;
    overflow-wrap: anywhere;
    cursor: pointer !important;
    pointer-events: auto !important;
    position: relative;
    z-index: 3;
}
.notice-rich-content .notice-inline-link:hover,
.notice-rich-content a[href^="http://"]:hover,
.notice-rich-content a[href^="https://"]:hover {
    color: #063B75 !important;
}


/* 공지사항 블록 편집기 · 공개 보기 */
.notice-editor-guide { font-size:13px; color:#5D7088; line-height:1.65; margin:4px 0 10px; }
.notice-block-label { display:inline-flex; align-items:center; min-height:26px; padding:3px 9px; border-radius:999px; background:#EAF4FF; color:#1D4ED8; font-size:12px; font-weight:800; margin-bottom:8px; }
.notice-rich-content { color:#26364A; line-height:1.82; font-size:15px; }
.notice-rich-content h1,.notice-rich-content h2,.notice-rich-content h3,.notice-rich-content h4,.notice-rich-content h5 { color:#172B4D; letter-spacing:-0.45px; margin:20px 0 8px; word-break:keep-all; }
.notice-rich-content h1 {font-size:27px;line-height:1.35}.notice-rich-content h2 {font-size:23px;line-height:1.38}.notice-rich-content h3 {font-size:20px;line-height:1.42}.notice-rich-content h4 {font-size:18px;line-height:1.46}.notice-rich-content h5 {font-size:16px;line-height:1.52}
.notice-rich-content p { margin:10px 0; word-break:keep-all; overflow-wrap:break-word; }
.notice-rich-content hr { border:0; border-top:1px solid #DCE6F0; margin:24px 0; }
.notice-callout { border-radius:14px; padding:16px 18px; margin:16px 0; border:1px solid #DCE7F3; background:#F8FBFF; }
.notice-callout-title { font-size:15px; font-weight:900; margin-bottom:6px; color:#173C62; }
.notice-callout-body { font-size:14.5px; line-height:1.75; color:#384A60; }
.notice-callout.info { background:#F0F7FF; border-color:#CFE3FA; }.notice-callout.success { background:#F0FBF5; border-color:#CDEFD9; }.notice-callout.warning { background:#FFF8E7; border-color:#F4E1A5; }.notice-callout.danger { background:#FFF1F3; border-color:#F5CDD5; }
.notice-rich-image-wrap { margin:18px 0; padding:0; border-radius:14px; overflow:hidden; border:1px solid #E0E8F1; background:#FFF; }
.notice-rich-image-wrap a { display:block; line-height:0; }.notice-rich-image { display:block; width:100%; max-height:640px; object-fit:contain; background:#F5F7FA; }.notice-rich-image-caption { padding:9px 12px 11px; color:#667085; font-size:13px; line-height:1.55; background:#FFF; }
@media (max-width:768px) { .notice-rich-content{font-size:14.5px;line-height:1.76}.notice-rich-content h1{font-size:23px}.notice-rich-content h2{font-size:21px}.notice-rich-content h3{font-size:19px}.notice-rich-image{max-height:56vh} }

</style>

""", unsafe_allow_html=True)


# =========================
# Supabase DB 설정 및 공통 함수
# =========================
# 주의: SQLite(witti_data.db)는 배포 환경에서 PC/세션마다 기록이 달라질 수 있어 사용하지 않습니다.
# 모든 누적 기록은 Supabase 테이블에 저장하고, 관리자 페이지도 Supabase에서 다시 불러옵니다.

create_client = None
Client = None
supabase_import_error = None

try:
    from supabase import create_client, Client
except Exception as exc:
    supabase_import_error = exc


@st.cache_resource(show_spinner=False)
def get_supabase_service_client():
    """서버 전용 Supabase service-role 클라이언트입니다.

    회원 프로필 관리, 관리자 기능, Private Storage 처리처럼 서버에서만 실행되는
    작업에 사용합니다. service_role_key는 절대로 브라우저나 GitHub에 노출하지 않습니다.
    """
    if create_client is None:
        st.error("Supabase 라이브러리를 불러오지 못했습니다. requirements.txt의 'supabase' 항목을 확인해 주세요.")
        if supabase_import_error is not None:
            st.code(f"Supabase import 오류: {repr(supabase_import_error)}", language="text")
        st.stop()

    try:
        config = st.secrets["supabase"]
        url = str(config["url"])
        service_role_key = str(config["service_role_key"])
    except Exception:
        st.error("Supabase Secrets 설정을 확인해 주세요. [supabase] 아래에 url과 service_role_key가 필요합니다.")
        st.stop()

    return create_client(url, service_role_key)


def get_supabase_auth_client():
    """로그인 전용 Supabase 공개 키 클라이언트를 새로 만듭니다.

    service_role_key는 서버 전용 작업에만 사용하고, 로그인에는 반드시 anon_key 또는
    publishable_key를 사용합니다. 실패 원인은 세션에 짧게 보관해 로그인 화면에서만 안내합니다.
    """
    st.session_state.pop("_auth_client_init_error", None)

    if create_client is None:
        st.session_state["_auth_client_init_error"] = "supabase 패키지를 불러오지 못했습니다. requirements.txt를 확인해 주세요."
        return None

    try:
        config = st.secrets["supabase"]
        url = str(config["url"] or "").strip()
        auth_key = str(config.get("anon_key") or config.get("publishable_key") or "").strip()

        if not url.startswith("https://") or ".supabase.co" not in url:
            st.session_state["_auth_client_init_error"] = "Supabase URL 형식이 올바르지 않습니다. https://프로젝트ID.supabase.co 형식인지 확인해 주세요."
            return None
        if not auth_key:
            st.session_state["_auth_client_init_error"] = "Supabase 공개 키(anon_key 또는 publishable_key)가 없습니다."
            return None

        return create_client(url, auth_key)
    except Exception as exc:
        st.session_state["_auth_client_init_error"] = _safe_auth_exception_detail(exc)
        return None


supabase = get_supabase_service_client()


TABLE_NAMES = {
    "subscribers": "subscribers",
    "diary_logs": "diary_logs",
    "phrase_logs": "phrase_logs",
    "photo_records": "photo_records",
    "play_sessions": "play_sessions",
    "generated_texts": "generated_texts",
    "email_verifications": "email_verifications",
    "platform_notices": "platform_notices",
    "platform_popups": "platform_popups",
}


WITTI_SITE_URL = "https://witti.kr/"
WITTI_SITE_LABEL = "놀이 기록 자동화"
WITTI_CONTACT_EMAIL = "witti7942@gmail.com"
WITTI_CONTACT_LABEL = "놀이 기록 자동화 사용 문의"
WITTI_CONTACT_MAILTO = "mailto:witti7942@gmail.com?subject=%5B%EB%86%80%EC%9D%B4%20%EA%B8%B0%EB%A1%9D%20%EC%9E%90%EB%8F%99%ED%99%94%5D%20%EC%82%AC%EC%9A%A9%20%EB%AC%B8%EC%9D%98"
APP_VERSION = "2026-07-02-diary-components-platform-rename-v1"


# =========================
# 회원·개인기록·OpenAI 사진 분석 공통 기능
# =========================
PRIVATE_RECORD_TABLES = ("phrase_logs", "diary_logs", "generated_texts")
PRIVATE_RECORD_RETENTION_DAYS = 365
# 업로드는 최대 20장, 자동 추천·Storage 저장·AI 분석은 그중 3~5장으로 제한합니다.
MAX_PLAY_UPLOAD_COUNT = 20
MAX_PLAY_PHOTO_COUNT = 5
MIN_RECOMMENDED_PLAY_PHOTO_COUNT = 3
MAX_PLAY_PHOTO_BYTES = 10 * 1024 * 1024  # 사진 1장당 10MB
PLAY_PHOTO_BUCKET = "play-photos"
PLAY_PHOTO_SIGNED_URL_TTL_SECONDS = 300  # 본인 화면 표시용 5분 URL


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _expiry_iso(days: int = PRIVATE_RECORD_RETENTION_DAYS) -> str:
    return (datetime.now(timezone.utc) + timedelta(days=days)).isoformat()


def current_member_user_id() -> str:
    return str(st.session_state.get("member_user_id") or "").strip()


def current_member_email() -> str:
    return str(st.session_state.get("member_email") or "").strip()


def member_is_logged_in() -> bool:
    return bool(current_member_user_id())


def set_member_session(user_id: str, email: str, platform_member_id: str = ""):
    st.session_state["member_user_id"] = str(user_id)
    st.session_state["member_email"] = str(email or "")
    st.session_state["member_platform_id"] = str(platform_member_id or "")


def clear_member_session():
    for key in [
        "member_user_id",
        "member_email",
        "member_platform_id",
        "member_access_token",
        "member_refresh_token",
    ]:
        st.session_state.pop(key, None)


def normalize_username(username: str) -> str:
    """로그인 아이디는 영문 소문자·숫자·밑줄만 사용하도록 정규화합니다."""
    return re.sub(r"\s+", "", str(username or "").strip().lower())


def validate_username(username: str) -> tuple[bool, str]:
    normalized = normalize_username(username)
    if not re.fullmatch(r"[a-z][a-z0-9_]{3,19}", normalized):
        return False, "아이디는 영문 소문자로 시작하며, 영문 소문자·숫자·밑줄(_)만 사용해 4~20자로 입력해 주세요."
    return True, normalized


def get_member_profile(user_id: str) -> dict:
    if not user_id:
        return {}
    try:
        response = (
            supabase.table("subscribers")
            .select("*")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        rows = _response_data(response)
        return rows[0] if rows else {}
    except Exception:
        return {}


def get_member_profile_by_username(username: str) -> dict:
    """직접 지정한 아이디로 회원 프로필을 찾습니다. 기존 자동 ID 회원도 일시적으로 호환합니다."""
    normalized = normalize_username(username)
    if not normalized:
        return {}

    for column in ("username", "platform_member_id"):
        try:
            response = (
                supabase.table("subscribers")
                .select("*")
                .eq(column, normalized)
                .limit(1)
                .execute()
            )
            rows = _response_data(response)
            if rows:
                return rows[0]
        except Exception:
            continue
    return {}


def username_is_available(username: str) -> bool:
    valid, normalized_or_message = validate_username(username)
    if not valid:
        return False
    normalized = normalized_or_message
    return not bool(get_member_profile_by_username(normalized))


def update_member_last_login(user_id: str):
    if not user_id:
        return
    try:
        (
            supabase.table("subscribers")
            .update({"last_login_at": _utc_now_iso()})
            .eq("user_id", user_id)
            .execute()
        )
    except Exception:
        pass


def _safe_auth_exception_detail(exc: Exception) -> str:
    """로그인 오류 원인을 확인하기 위한 짧고 비밀값 없는 진단 문자열입니다."""
    parts = [type(exc).__name__]
    for attr in ("code", "status", "status_code", "message", "details", "body"):
        value = getattr(exc, attr, None)
        if value not in (None, "", {}, []):
            parts.append(f"{attr}={value}")

    response = getattr(exc, "response", None)
    if response is not None:
        response_status = getattr(response, "status_code", None) or getattr(response, "status", None)
        if response_status:
            parts.append(f"response_status={response_status}")
        response_text = getattr(response, "text", "")
        if response_text:
            parts.append(f"response={str(response_text)[:400]}")

    exc_text = str(exc or "").strip()
    if exc_text:
        parts.append(exc_text[:500])

    detail = " | ".join(dict.fromkeys(str(item) for item in parts if str(item).strip()))
    # 세션 토큰처럼 보이는 긴 JWT가 진단창에 노출되지 않도록 마스킹합니다.
    detail = re.sub(r"eyJ[a-zA-Z0-9_\-]{20,}\.[a-zA-Z0-9_\-]{20,}\.[a-zA-Z0-9_\-]{20,}", "[JWT 숨김]", detail)
    return detail[:1000] or "상세 오류 문자열을 받지 못했습니다."


def _auth_exception_to_message(exc: Exception) -> str:
    """Supabase 로그인 예외를 설정·네트워크·계정 상태별로 구분합니다."""
    detail = _safe_auth_exception_detail(exc)
    st.session_state["_last_auth_error_detail"] = detail

    raw = detail.lower()
    status_match = re.search(r"(?:status|status_code|response_status)=([0-9]{3})", raw)
    status = status_match.group(1) if status_match else ""

    if any(token in raw for token in ["invalid api key", "invalid_key", "apikey", "invalid jwt", "jwt malformed", "jwt is malformed", "401 unauthorized"]):
        return "로그인 연결 키가 올바르지 않거나 서로 다른 프로젝트 키가 섞여 있습니다. Streamlit Secrets의 supabase.url, anon_key(또는 publishable_key), service_role_key가 같은 Supabase 프로젝트 값인지 확인해 주세요."
    if any(token in raw for token in ["email not confirmed", "email_not_confirmed"]):
        return "Supabase Auth에서 이메일 확인이 완료되지 않은 계정입니다. Auth 사용자 정보에서 이메일 확인 상태를 점검해 주세요."
    if any(token in raw for token in ["email rate limit", "too many requests", "rate limit", "429"]):
        return "로그인 요청이 잠시 제한되었습니다. 5~10분 뒤 다시 시도해 주세요."
    if any(token in raw for token in ["invalid login credentials", "invalid_credentials", "invalid credentials"]):
        return "아이디 또는 비밀번호가 올바르지 않습니다. 비밀번호를 재설정한 뒤 다시 로그인해 주세요."
    if any(token in raw for token in ["user not found", "user_not_found"]):
        return "Supabase Auth 계정을 찾지 못했습니다. 회원 프로필은 있으나 로그인 계정 연결이 누락됐을 수 있습니다."
    if any(token in raw for token in ["connecterror", "connect timeout", "read timeout", "timed out", "network", "name or service not known", "temporary failure", "ssl", "proxyerror"]):
        return "Supabase 인증 서버에 연결하지 못했습니다. Streamlit Cloud 재부팅 후 다시 시도하고, 계속되면 Supabase 프로젝트 URL·네트워크 상태를 확인해 주세요."
    if status in {"500", "502", "503", "504"} or any(token in raw for token in ["internal server error", "server error", "unexpected_failure", "database error"]):
        return "Supabase 인증 서버에서 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요. 계속되면 Supabase Auth 설정을 점검해야 합니다."
    if status == "401":
        return "로그인 인증이 거부되었습니다. 공개 키와 프로젝트 URL이 서로 맞는지 먼저 확인해 주세요."
    if status == "422":
        return "로그인 요청 형식 또는 Auth 설정을 확인해야 합니다. 아래 상세 정보를 함께 확인해 주세요."

    return "로그인 요청은 Supabase까지 전달됐지만, 원인을 자동 분류하지 못했습니다. 아래 ‘오류 확인용 상세 정보’를 복사해 보내 주세요."


def _get_auth_user_by_id(user_id: str):
    """서버 전용 클라이언트로 auth.users의 실제 계정을 확인합니다."""
    if not user_id:
        return None
    try:
        response = supabase.auth.admin.get_user_by_id(str(user_id))
        return getattr(response, "user", None)
    except Exception:
        return None


def authenticate_member(username: str, password: str) -> tuple[bool, str]:
    """아이디 → subscribers 프로필 → auth.users 이메일·비밀번호 순서로 로그인합니다."""
    normalized_username = normalize_username(username)
    if not normalized_username or not str(password or ""):
        return False, "아이디와 비밀번호를 모두 입력해 주세요."

    auth_client = get_supabase_auth_client()
    if auth_client is None:
        detail = str(st.session_state.get("_auth_client_init_error") or "Supabase 공개 키(anon_key 또는 publishable_key)가 설정되지 않았습니다.")
        st.session_state["_last_auth_error_detail"] = detail
        return False, detail

    profile = get_member_profile_by_username(normalized_username)
    if not profile:
        return False, "등록된 아이디를 찾지 못했습니다. 아이디 찾기 기능으로 확인해 주세요."
    if bool(profile.get("deleted")) or profile.get("is_active") is False:
        return False, "현재 사용할 수 없는 계정입니다. 관리자에게 문의해 주세요."

    email = str(profile.get("email") or "").strip().lower()
    profile_user_id = str(profile.get("user_id") or "").strip()
    if not email or not profile_user_id:
        return False, "회원 프로필에 로그인 계정 정보가 완전하게 연결되어 있지 않습니다. 관리자에게 문의해 주세요."

    # 비밀번호를 확인하기 전에 public 프로필의 이메일과 실제 Supabase Auth 계정이 같은지 점검합니다.
    auth_account = _get_auth_user_by_id(profile_user_id)
    if auth_account is None:
        return False, "회원 프로필은 있으나 Supabase Auth 계정을 찾지 못했습니다. 이전 회원 데이터의 연결 상태를 점검해야 합니다."

    auth_email = str(getattr(auth_account, "email", "") or "").strip().lower()
    if auth_email and auth_email != email:
        return False, "회원 프로필 이메일과 로그인 계정 이메일이 서로 다릅니다. 비밀번호 문제가 아니라 계정 연결 정보 문제입니다."

    try:
        auth_response = auth_client.auth.sign_in_with_password(
            {"email": email, "password": str(password)}
        )
        auth_user = getattr(auth_response, "user", None)
        if not auth_user:
            return False, "Supabase 로그인 응답에서 회원 정보를 받지 못했습니다."

        user_id = str(getattr(auth_user, "id", "") or "")
        if user_id != profile_user_id:
            return False, "로그인된 Auth 계정과 가입 정보의 회원 연결값이 다릅니다. 관리자 계정 정리가 필요합니다."

        set_member_session(
            user_id=user_id,
            email=str(getattr(auth_user, "email", "") or email).lower(),
            platform_member_id=str(profile.get("username") or profile.get("platform_member_id") or ""),
        )
        session = getattr(auth_response, "session", None)
        if session:
            st.session_state["member_access_token"] = str(getattr(session, "access_token", "") or "")
            st.session_state["member_refresh_token"] = str(getattr(session, "refresh_token", "") or "")
        update_member_last_login(user_id)
        return True, str(profile.get("username") or profile.get("platform_member_id") or "")
    except Exception as exc:
        return False, _auth_exception_to_message(exc)


def create_auth_member(email: str, password: str, username: str, member_name: str) -> str:
    """이메일 인증을 마친 뒤 Supabase Auth 계정을 만듭니다.

    비밀번호 해시는 auth.users에만 안전하게 보관되며 public 테이블에는 저장하지 않습니다.
    """
    response = supabase.auth.admin.create_user(
        {
            "email": email.strip().lower(),
            "password": password,
            "email_confirm": True,
            "user_metadata": {
                "username": normalize_username(username),
                "member_name": member_name,
            },
        }
    )
    auth_user = getattr(response, "user", None)
    user_id = str(getattr(auth_user, "id", "") or "")
    if not user_id:
        raise RuntimeError("회원 계정 생성 후 사용자 ID를 확인하지 못했습니다.")
    return user_id


def delete_auth_member(user_id: str):
    if not user_id:
        return
    try:
        supabase.auth.admin.delete_user(str(user_id))
    except Exception:
        pass


EMAIL_VERIFICATION_TTL_MINUTES = 5
EMAIL_VERIFICATION_MAX_ATTEMPTS = 5


def _verification_code_hash(email: str, purpose: str, code: str) -> str:
    raw = f"{email.strip().lower()}|{purpose}|{code}".encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


def issue_email_verification(email: str, purpose: str) -> str:
    """인증번호 원문은 DB에 저장하지 않고 SHA-256 해시만 저장합니다."""
    normalized_email = str(email or "").strip().lower()
    if not normalized_email:
        raise ValueError("이메일을 입력해 주세요.")
    if purpose not in {"signup", "account_recovery"}:
        raise ValueError("지원하지 않는 이메일 인증 목적입니다.")

    code = f"{secrets.randbelow(1_000_000):06d}"
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=EMAIL_VERIFICATION_TTL_MINUTES)

    # 이전 미완료 인증번호는 즉시 만료 처리합니다.
    try:
        (
            supabase.table("email_verifications")
            .update({"expires_at": _utc_now_iso()})
            .eq("email", normalized_email)
            .eq("purpose", purpose)
            .eq("verified", False)
            .execute()
        )
    except Exception:
        pass

    payload = {
        "email": normalized_email,
        "purpose": purpose,
        "code_hash": _verification_code_hash(normalized_email, purpose, code),
        "expires_at": expires_at.isoformat(),
        "attempts": 0,
        "verified": False,
    }
    supabase.table("email_verifications").insert(payload).execute()
    return code


def verify_email_verification(email: str, purpose: str, input_code: str) -> tuple[bool, str]:
    normalized_email = str(email or "").strip().lower()
    code = str(input_code or "").strip()
    if not normalized_email or not code:
        return False, "이메일과 인증번호를 모두 입력해 주세요."

    try:
        response = (
            supabase.table("email_verifications")
            .select("*")
            .eq("email", normalized_email)
            .eq("purpose", purpose)
            .eq("verified", False)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        rows = _response_data(response)
        if not rows:
            return False, "유효한 인증번호를 찾지 못했습니다. 인증번호를 다시 받아 주세요."
        record = rows[0]
        record_id = record.get("id")
        expires_at = pd.to_datetime(record.get("expires_at"), utc=True, errors="coerce")
        if pd.isna(expires_at) or expires_at.to_pydatetime() < datetime.now(timezone.utc):
            return False, "인증번호 유효 시간이 지났습니다. 인증번호를 다시 받아 주세요."
        attempts = int(record.get("attempts") or 0)
        if attempts >= EMAIL_VERIFICATION_MAX_ATTEMPTS:
            return False, "인증번호 입력 가능 횟수를 초과했습니다. 새 인증번호를 받아 주세요."

        expected = str(record.get("code_hash") or "")
        actual = _verification_code_hash(normalized_email, purpose, code)
        if not hmac.compare_digest(expected, actual):
            if record_id:
                (
                    supabase.table("email_verifications")
                    .update({"attempts": attempts + 1})
                    .eq("id", record_id)
                    .execute()
                )
            return False, "인증번호가 일치하지 않습니다."

        if record_id:
            (
                supabase.table("email_verifications")
                .update({"verified": True, "verified_at": _utc_now_iso()})
                .eq("id", record_id)
                .execute()
            )
        return True, "이메일 인증이 완료되었습니다."
    except Exception as exc:
        return False, f"이메일 인증 정보를 확인하지 못했습니다: {exc}"


def find_member_id_by_email(email: str) -> str:
    normalized_email = str(email or "").strip().lower()
    if not normalized_email:
        return ""
    try:
        response = (
            supabase.table("subscribers")
            .select("username, platform_member_id")
            .eq("email", normalized_email)
            .eq("deleted", False)
            .limit(1)
            .execute()
        )
        rows = _response_data(response)
        if not rows:
            return ""
        return str(rows[0].get("username") or rows[0].get("platform_member_id") or "")
    except Exception:
        return ""


def reset_member_password_by_email(email: str, new_password: str):
    """본인 이메일 인증이 완료된 경우에만 실제 auth.users 계정의 비밀번호를 교체합니다."""
    normalized_email = str(email or "").strip().lower()
    if len(str(new_password or "")) < 8:
        raise ValueError("새 비밀번호는 8자 이상으로 입력해 주세요.")

    try:
        response = (
            supabase.table("subscribers")
            .select("user_id, email, username, platform_member_id")
            .eq("email", normalized_email)
            .eq("deleted", False)
            .limit(1)
            .execute()
        )
        rows = _response_data(response)
        if not rows or not rows[0].get("user_id"):
            raise ValueError("등록된 회원 정보를 찾지 못했습니다.")

        profile = rows[0]
        profile_user_id = str(profile.get("user_id") or "").strip()
        auth_account = _get_auth_user_by_id(profile_user_id)
        if auth_account is None:
            raise ValueError("Supabase Auth 계정을 찾지 못했습니다. 회원 프로필과 Auth 계정 연결이 끊어진 상태입니다.")

        auth_email = str(getattr(auth_account, "email", "") or "").strip().lower()
        if auth_email and auth_email != normalized_email:
            raise ValueError("회원 프로필 이메일과 Supabase Auth 이메일이 다릅니다. 비밀번호를 바꾸기 전에 계정 연결을 정리해야 합니다.")

        update_response = supabase.auth.admin.update_user_by_id(
            profile_user_id,
            {"password": str(new_password)},
        )
        updated_user = getattr(update_response, "user", None)
        updated_user_id = str(getattr(updated_user, "id", "") or "")
        if updated_user_id and updated_user_id != profile_user_id:
            raise ValueError("비밀번호 변경 응답의 회원 ID가 기존 계정과 일치하지 않습니다.")

        return True
    except Exception as exc:
        raise RuntimeError(f"비밀번호를 재설정하지 못했습니다: {exc}")


def private_log_metadata() -> dict | None:
    """로그인한 회원의 기록에만 1년 보관 정보를 붙입니다."""
    user_id = current_member_user_id()
    if not user_id:
        return None
    return {
        "user_id": user_id,
        "expires_at": _expiry_iso(),
    }


def purge_expired_private_records():
    """개인 기록의 만료일이 지나면 영구 삭제합니다.

    앱 접속 시에도 한 번 실행하고, DB Cron 작업으로 매일 한 번 더 실행합니다.
    """
    now_iso = _utc_now_iso()
    for table_name in PRIVATE_RECORD_TABLES:
        try:
            (
                supabase.table(table_name)
                .delete()
                .lte("expires_at", now_iso)
                .execute()
            )
        except Exception:
            # migration 전·테이블 미반영 상태에서 기존 화면을 멈추지 않기 위한 호환 처리입니다.
            pass


def purge_expired_private_records_once_per_session():
    state_key = "_private_record_retention_cleanup_ran"
    if st.session_state.get(state_key):
        return
    purge_expired_private_records()
    st.session_state[state_key] = True


def load_member_records(table_name: str, user_id: str) -> pd.DataFrame:
    if not user_id:
        return pd.DataFrame()

    try:
        response = (
            supabase.table(table_name)
            .select("*")
            .eq("user_id", user_id)
            .eq("deleted", False)
            .order("created_at", desc=True)
            .execute()
        )
        return pd.DataFrame(_response_data(response))
    except Exception:
        return pd.DataFrame()


def _format_kst_datetime_column(df: pd.DataFrame, source_column: str = "created_at", target_column: str = "작성일시") -> pd.DataFrame:
    if df.empty or source_column not in df.columns:
        return df

    copied = df.copy()
    converted = pd.to_datetime(copied[source_column], errors="coerce", utc=True)
    copied[target_column] = converted.dt.tz_convert("Asia/Seoul").dt.strftime("%Y-%m-%d %H:%M")
    return copied


@st.cache_resource
def get_openai_client():
    if OpenAI is None:
        return None

    try:
        api_key = st.secrets["openai"]["api_key"]
    except Exception:
        return None

    return OpenAI(api_key=api_key)


def get_openai_vision_model() -> str:
    try:
        config = st.secrets["openai"]
        return str(config["vision_model"] if "vision_model" in config else "gpt-5.4-mini")
    except Exception:
        return "gpt-5.4-mini"


def _uploaded_file_bytes_and_mime(uploaded_file) -> tuple[bytes, str]:
    """업로드 사진의 용량·형식을 확인하고 파일 바이트와 MIME 타입을 반환합니다."""
    image_bytes = uploaded_file.getvalue()
    if len(image_bytes) > MAX_PLAY_PHOTO_BYTES:
        raise ValueError(f"'{uploaded_file.name}' 파일이 10MB를 초과합니다.")

    mime_type = str(getattr(uploaded_file, "type", "") or "").lower()
    allowed_types = {"image/jpeg", "image/png", "image/webp"}
    if mime_type not in allowed_types:
        suffix = Path(str(getattr(uploaded_file, "name", ""))).suffix.lower()
        mime_type = {
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
            ".webp": "image/webp",
        }.get(suffix, "")

    if mime_type not in allowed_types:
        raise ValueError(f"'{uploaded_file.name}' 파일은 JPG, PNG, WEBP 형식만 업로드할 수 있습니다.")

    return image_bytes, mime_type


def _image_data_url(uploaded_file) -> str:
    """OpenAI 이미지 입력용 Base64 data URL을 만듭니다."""
    image_bytes, mime_type = _uploaded_file_bytes_and_mime(uploaded_file)
    encoded = base64.b64encode(image_bytes).decode("utf-8")
    return f"data:{mime_type};base64,{encoded}"

def _parse_json_object(raw_text: str) -> dict:
    cleaned = (raw_text or "").strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    try:
        payload = json.loads(cleaned)
    except Exception:
        start_at, end_at = cleaned.find("{"), cleaned.rfind("}")
        if start_at >= 0 and end_at > start_at:
            try:
                payload = json.loads(cleaned[start_at:end_at + 1])
            except Exception:
                payload = {}
        else:
            payload = {}
    return payload if isinstance(payload, dict) else {}


def _as_text_list(value) -> list[str]:
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, str) and value.strip():
        return [item.strip() for item in value.split(",") if item.strip()]
    return []


def curriculum_display_text(areas) -> str:
    values = _as_text_list(areas)
    return ", ".join(values) if values else "교육과정 영역 미선택"


def _normalize_photo_match_status(value: str) -> str:
    """사진과 입력 놀이명의 일치 점검 결과를 세 가지 상태로 정규화합니다."""
    cleaned = re.sub(r"\s+", " ", str(value or "").strip())
    if cleaned in {"일치", "확인 필요", "판단 어려움"}:
        return cleaned
    if any(token in cleaned for token in ["불일치", "확인", "다름", "맞지"]):
        return "확인 필요"
    if any(token in cleaned for token in ["어려움", "불명", "모름", "판단"]):
        return "판단 어려움"
    return "판단 어려움"


def _as_note_dict(value) -> dict[str, str]:
    """선택값별 교사 메모를 DB·프롬프트에 안전하게 전달할 수 있는 딕셔너리로 정리합니다."""
    if not isinstance(value, dict):
        return {}
    return {
        str(key).strip(): str(note).strip()
        for key, note in value.items()
        if str(key).strip() and str(note).strip()
    }


def _selection_notes_display(selected: list[str] | None, notes) -> str:
    """선택값과 해당 구체 장면 메모를 프롬프트에 넣기 좋은 문장으로 만듭니다."""
    note_map = _as_note_dict(notes)
    lines = []
    for option in selected or []:
        option_text = str(option).strip()
        if not option_text:
            continue
        note = note_map.get(option_text, "")
        if note:
            lines.append(f"- {option_text}: {note}")
        else:
            lines.append(f"- {option_text}: 구체 장면 메모 미입력")
    return "\n".join(lines) if lines else "미선택"


def _parse_photo_draft_json(raw_text: str) -> dict:
    payload = _parse_json_object(raw_text)
    cleaned = (raw_text or "").strip()
    match_status = _normalize_photo_match_status(payload.get("photo_match_status") or payload.get("play_name_match"))
    match_reason = str(
        payload.get("photo_match_reason")
        or payload.get("play_name_match_reason")
        or "사진과 입력한 놀이명의 일치 여부를 별도로 판단하지 못했습니다."
    ).strip()
    return {
        "play_title": str(payload.get("play_title") or "사진 속 놀이 장면").strip(),
        "play_keyword": str(payload.get("play_keyword") or "사진 기반 놀이 관찰").strip(),
        "observed_action": str(payload.get("observed_action") or "사진 속 자료를 살피고 놀이에 참여하는 모습").strip(),
        "ai_caption": str(payload.get("ai_caption") or "사진 속 놀이 장면을 관찰한 결과입니다.").strip(),
        "draft": str(payload.get("draft") or cleaned or "사진 분석 결과를 바탕으로 초안을 만들지 못했습니다.").strip(),
        "photo_match_status": match_status,
        "photo_match_reason": match_reason,
    }


def analyze_play_photos(uploaded_files, context: dict | None = None) -> dict:
    """선정된 3~5장 사진을 읽어 1차 기록과 사진-놀이명 일치 점검 결과를 만듭니다."""
    if not uploaded_files:
        raise ValueError("분석할 사진을 한 장 이상 업로드해 주세요.")
    if len(uploaded_files) > MAX_PLAY_PHOTO_COUNT:
        raise ValueError(f"AI 분석은 자동 추천된 최대 {MAX_PLAY_PHOTO_COUNT}장 사진만 진행합니다.")

    client = get_openai_client()
    if client is None:
        raise RuntimeError("OpenAI API 키가 설정되지 않았습니다. Streamlit Secrets의 [openai] api_key를 확인해 주세요.")

    context = context or {}
    play_name = str(context.get("play_name") or "").strip()
    play_goal = str(context.get("play_goal") or "").strip()
    age_group = str(context.get("age_group") or "").strip()
    child_alias = str(context.get("child_alias") or "").strip()
    curriculum = curriculum_display_text(context.get("curriculum_areas"))
    output_type = str(context.get("output_type") or "놀이 이야기")
    detail_notes = _selection_notes_display(
        _as_text_list(context.get("play_subcategories")),
        context.get("play_subcategory_notes"),
    )
    support_notes = _selection_notes_display(
        _as_text_list(context.get("teacher_supports")),
        context.get("teacher_support_notes"),
    )
    component_label = "보육일지 세부 구성" if output_type == "일지" else "놀이 세부 구분"
    support_input_text = (
        f"선택한 교사의 지원과 구체 지원 메모:\n{support_notes}"
        if output_type == "놀이 이야기"
        else "보육일지는 교사의 지원을 별도 선택하지 않습니다."
    )

    prompt = f"""
당신은 한국 어린이집·유치원 교사의 사진 기반 놀이 기록을 돕는 보조자입니다.
아래의 교사 입력값과 업로드된 사진에서 실제로 확인되는 장면만 바탕으로 1차 기록 초안을 작성하세요.

[교사 입력]
- 놀이명: {play_name or '미입력'}
- 연령: {age_group or '미입력'}
- 아이 별칭: {child_alias or '미입력'}
- 선택 교육과정 영역: {curriculum}
- 만들 기록: {output_type}
- 선택한 {component_label}과 실제 장면 메모:
{detail_notes}
- {support_input_text}

[사진과 놀이명 일치 점검]
- 사진을 먼저 사실대로 읽고, 그다음 입력한 놀이명의 핵심 자료·행동·공간과 실제 사진 장면이 충분히 맞는지 점검하세요.
- 예를 들어 놀이명이 '블록 동네'라면 블록, 구성물, 동네 만들기처럼 제목의 핵심 단서가 사진에 명확히 보여야 합니다.
- 제목의 핵심 단서가 사진에 보이지 않고 전혀 다른 유형의 놀이가 중심이면 photo_match_status를 '확인 필요'로 작성하세요.
- 사진이 일부만 보이거나 핵심 단서를 판별하기 어려우면 '판단 어려움'으로 작성하세요.
- 단순히 사진 구도가 다르거나 자료가 일부 가려진 정도로는 '확인 필요'로 판단하지 마세요.
- '확인 필요'일 때도 사진에서 실제로 보이는 장면만으로 초안을 작성하고, 입력한 놀이명이 사실인 것처럼 억지로 연결하지 마세요.

반드시 지킬 점:
- 사진 속 사람의 이름, 성별, 정확한 나이, 가족관계, 건강·장애·발달 상태를 추정하거나 단정하지 마세요.
- 사진에 보이지 않는 사건·대화·감정·교육적 효과를 지어내지 마세요.
- 관찰 중심 표현을 사용하고, 교사의 입력값은 사실로 보지 말고 기록 구성의 맥락으로만 활용하세요.
- draft는 한국어 4~6문장, 약 300~500자 안팎으로 작성하세요.
- 교사가 수정하기 쉬운 초안이므로 단정적인 평가보다 '...하는 모습이 보였습니다', '...로 이어질 수 있었습니다' 같은 표현을 사용하세요.

아래 JSON 객체만 반환하세요.
{{
  "play_title": "사진에서 실제로 확인되는 장면 중심의 짧은 제목",
  "play_keyword": "사진 속 놀이 - 세부 구분 형식의 짧은 키워드",
  "observed_action": "사진 속 아이들의 모습 선택란에 넣기 좋은 ‘...하는 모습’ 문장",
  "ai_caption": "사진에서 확인되는 자료·공간·행동을 1~2문장으로 요약",
  "photo_match_status": "일치 | 확인 필요 | 판단 어려움",
  "photo_match_reason": "사진과 놀이명 관계를 1문장으로 설명",
  "draft": "교사가 수정할 수 있는 4~6문장 1차 놀이 기록"
}}
""".strip()

    content = [{"type": "input_text", "text": prompt}]
    for uploaded_file in uploaded_files:
        content.append({"type": "input_image", "image_url": _image_data_url(uploaded_file), "detail": "low"})

    response = client.responses.create(
        model=get_openai_vision_model(),
        input=[{"role": "user", "content": content}],
        max_output_tokens=1200,
        store=False,
    )
    raw_text = str(getattr(response, "output_text", "") or "").strip()
    if not raw_text:
        raise RuntimeError("사진 분석 결과 텍스트를 받지 못했습니다.")
    return _parse_photo_draft_json(raw_text)


# Supabase Storage object key에는 원본 한글 파일명·공백·특수문자를 넣지 않습니다.
# 원본 파일명은 photo_records.original_file_name 컬럼에만 보관하고,
# Storage에는 UUID 기반의 영문 파일명만 사용합니다.
_STORAGE_EXTENSION_BY_MIME = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}
_ALLOWED_STORAGE_SUFFIXES = set(_STORAGE_EXTENSION_BY_MIME.values()) | {".jpeg"}


def _safe_storage_filename(file_name: str) -> str:
    """임시 선별 폴더에 쓸 ASCII 안전 파일명을 만듭니다."""
    raw_name = Path(str(file_name or "photo")).name
    stem = Path(raw_name).stem
    suffix = Path(raw_name).suffix.lower()

    # 로컬 임시 파일도 한글·공백·특수문자 없이 생성합니다.
    clean_stem = re.sub(r"[^0-9A-Za-z_-]+", "_", stem).strip("_") or "photo"
    if suffix not in _ALLOWED_STORAGE_SUFFIXES:
        suffix = ".jpg"
    return f"{clean_stem[:40]}{suffix}"


def _make_play_photo_storage_path(user_id: str, mime_type: str, now_utc: datetime | None = None) -> str:
    """Private Storage용 UUID 기반 object key를 만듭니다.

    사용자 원본 파일명은 이 경로에 포함하지 않습니다. 이렇게 해야 한글·공백·특수문자
    때문에 Supabase Storage가 InvalidKey를 반환하는 문제를 막을 수 있습니다.
    """
    now_utc = now_utc or datetime.now(timezone.utc)
    safe_user_id = re.sub(r"[^0-9A-Za-z_-]+", "", str(user_id or "")).strip("_-") or "member"
    suffix = _STORAGE_EXTENSION_BY_MIME.get(str(mime_type or "").lower(), ".jpg")
    return (
        f"{safe_user_id}/{now_utc.strftime('%Y')}/{now_utc.strftime('%m')}/"
        f"{uuid.uuid4().hex}{suffix}"
    )


def select_recommended_play_photos(uploaded_files, recommended_count: int) -> tuple[list, dict[str, float | None]]:
    """기존 사진 선별 모듈을 재사용해 업로드본 중 3~5장의 후보를 고릅니다.

    선별 실패 시 업로드 순서대로 고르되, 기록 생성 자체가 멈추지 않게 합니다.
    """
    files = list(uploaded_files or [])
    if not files:
        return [], {}
    if len(files) > MAX_PLAY_UPLOAD_COUNT:
        raise ValueError(f"한 번에 최대 {MAX_PLAY_UPLOAD_COUNT}장까지 업로드할 수 있습니다.")
    count = max(1, min(int(recommended_count), MAX_PLAY_PHOTO_COUNT, len(files)))
    if len(files) <= count:
        return files, {str(getattr(file, "name", "")): None for file in files}

    tmp_dir = Path(tempfile.mkdtemp(prefix="witti_play_rank_"))
    mapping: dict[str, object] = {}
    try:
        for index, uploaded_file in enumerate(files):
            safe_name = _safe_storage_filename(getattr(uploaded_file, "name", f"photo_{index}.jpg"))
            temp_path = tmp_dir / f"{index:03d}_{safe_name}"
            temp_path.write_bytes(uploaded_file.getvalue())
            mapping[temp_path.name] = uploaded_file
            mapping[str(temp_path)] = uploaded_file

        ranked = rank_images(str(tmp_dir))
        selected, score_map = [], {}
        for image_path, score in ranked[:count]:
            file = mapping.get(str(image_path)) or mapping.get(Path(str(image_path)).name)
            if file is not None:
                selected.append(file)
                score_map[str(getattr(file, "name", ""))] = float(score)
        if selected:
            return selected, score_map
    except Exception:
        pass
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)

    fallback = files[:count]
    return fallback, {str(getattr(file, "name", "")): None for file in fallback}


def create_play_session(
    user_id: str,
    play_name: str,
    play_goal: str,
    age_group: str,
    child_alias: str,
    curriculum_areas: list[str],
    output_type: str,
    play_subcategories: list[str],
    teacher_supports: list[str],
    parent_type: str = "",
    play_subcategory_notes: dict | None = None,
    teacher_support_notes: dict | None = None,
    teacher_observed_situation: str = "",
    next_play_support_plan: str = "",
) -> dict:
    """놀이 세션을 생성합니다.

    기존 play_goal 컬럼은 과거 기록 호환을 위해 빈 값으로만 유지합니다.
    새로 추가한 교사 관찰 상황·다음 놀이 지원 계획은 별도 update로 저장해,
    마이그레이션 전에도 사진 분석 기본 흐름이 멈추지 않도록 구성합니다.
    """
    payload = {
        "user_id": user_id,
        "play_name": play_name.strip(),
        "play_goal": str(play_goal or "").strip(),
        "age_group": age_group,
        "child_alias": child_alias.strip(),
        "curriculum_areas": curriculum_areas,
        "record_type": output_type,
        "play_subcategories": play_subcategories,
        "teacher_supports": teacher_supports,
        "deleted": False,
    }
    response = supabase.table("play_sessions").insert(payload).execute()
    rows = _response_data(response)
    if not rows:
        raise RuntimeError("놀이 기록 세션을 만들지 못했습니다.")

    session = rows[0]
    session_id = str(session.get("session_id") or "")
    optional_payload = {
        "parent_type": str(parent_type or "").strip() or None,
        "play_subcategory_notes": _as_note_dict(play_subcategory_notes),
        "teacher_support_notes": _as_note_dict(teacher_support_notes),
        "teacher_observed_situation": str(teacher_observed_situation or "").strip() or None,
        "next_play_support_plan": str(next_play_support_plan or "").strip() or None,
        "updated_at": _utc_now_iso(),
    }
    if session_id:
        try:
            supabase.table("play_sessions").update(optional_payload).eq("session_id", session_id).execute()
            session.update(optional_payload)
        except Exception:
            # 새 마이그레이션이 아직 적용되지 않았다면, 화면 내 분석 흐름은 유지합니다.
            pass
    return session


def update_play_session_teacher_context(
    session_id: str,
    teacher_observed_situation: str,
    next_play_support_plan: str,
):
    """교사가 최종 생성 전에 입력한 관찰 상황·다음 지원 계획을 세션에 저장합니다."""
    if not session_id:
        return
    payload = {
        "teacher_observed_situation": str(teacher_observed_situation or "").strip() or None,
        "next_play_support_plan": str(next_play_support_plan or "").strip() or None,
        "updated_at": _utc_now_iso(),
    }
    try:
        supabase.table("play_sessions").update(payload).eq("session_id", session_id).execute()
    except Exception:
        # 마이그레이션 전이라도 기록 생성은 계속할 수 있게 합니다.
        pass

def update_play_session_analysis(session_id: str, analysis_result: dict):
    if not session_id:
        return
    base_payload = {
        "ai_summary": str(analysis_result.get("draft") or ""),
        "ai_caption": str(analysis_result.get("ai_caption") or ""),
        "updated_at": _utc_now_iso(),
    }
    supabase.table("play_sessions").update(base_payload).eq("session_id", session_id).execute()

    optional_payload = {
        "photo_match_status": str(analysis_result.get("photo_match_status") or ""),
        "photo_match_reason": str(analysis_result.get("photo_match_reason") or ""),
        "updated_at": _utc_now_iso(),
    }
    try:
        supabase.table("play_sessions").update(optional_payload).eq("session_id", session_id).execute()
    except Exception:
        # 사진-놀이명 점검 컬럼은 신규 마이그레이션 후 자동 저장됩니다.
        pass


def store_play_photos(
    uploaded_files,
    user_id: str,
    session_id: str,
    child_alias: str = "",
    quality_scores: dict[str, float | None] | None = None,
) -> list[dict]:
    """추천된 사진 원본만 Private Storage에 저장하고 놀이 세션에 연결합니다."""
    if not user_id:
        raise PermissionError("사진을 저장하려면 먼저 로그인해 주세요.")
    if not session_id:
        raise ValueError("사진을 연결할 놀이 기록 세션이 없습니다.")
    if not uploaded_files:
        raise ValueError("저장할 사진을 한 장 이상 업로드해 주세요.")
    if len(uploaded_files) > MAX_PLAY_PHOTO_COUNT:
        raise ValueError(f"저장·분석할 사진은 최대 {MAX_PLAY_PHOTO_COUNT}장입니다.")

    created_records: list[dict] = []
    uploaded_paths: list[str] = []
    quality_scores = quality_scores or {}

    try:
        for uploaded_file in uploaded_files:
            file_bytes, mime_type = _uploaded_file_bytes_and_mime(uploaded_file)
            now_utc = datetime.now(timezone.utc)
            # Storage 경로는 UUID + 확장자만 사용합니다.
            # 원본 한글 파일명은 DB 메타데이터(original_file_name)에만 저장합니다.
            file_path = _make_play_photo_storage_path(user_id, mime_type, now_utc)
            try:
                supabase.storage.from_(PLAY_PHOTO_BUCKET).upload(
                    file_path,
                    file_bytes,
                    file_options={"content-type": mime_type, "upsert": "false"},
                )
            except Exception as storage_exc:
                original_name = str(getattr(uploaded_file, "name", "") or "사진 파일")
                raise RuntimeError(
                    f"'{original_name}' 사진을 비공개 저장소에 저장하지 못했습니다. "
                    f"Storage 경로: {file_path}. 상세 오류: {storage_exc}"
                ) from storage_exc

            uploaded_paths.append(file_path)
            score = quality_scores.get(str(getattr(uploaded_file, "name", "")))
            payload = {
                "user_id": user_id,
                "session_id": session_id,
                "storage_bucket": PLAY_PHOTO_BUCKET,
                "file_path": file_path,
                "original_file_name": str(
                    getattr(uploaded_file, "name", "") or f"play_photo{_STORAGE_EXTENSION_BY_MIME.get(mime_type, '.jpg')}"
                ),
                "mime_type": mime_type,
                "size_bytes": len(file_bytes),
                "child_alias": child_alias.strip(),
                "quality_score": score,
                "selection_reason": (f"기존 사진 선별 도구의 선명도·밝기 기준 자동 추천 (점수 {score:.1f})" if score is not None else "업로드 사진 수가 적어 자동 추천 대상에 포함"),
                "is_selected": True,
                "deleted": False,
            }
            response = supabase.table("photo_records").insert(payload).execute()
            rows = _response_data(response)
            created_records.append(rows[0] if rows else payload)
        return created_records
    except Exception:
        if uploaded_paths:
            try:
                supabase.storage.from_(PLAY_PHOTO_BUCKET).remove(uploaded_paths)
            except Exception:
                pass
        for record in created_records:
            if record.get("id"):
                try:
                    supabase.table("photo_records").delete().eq("id", int(record["id"])).execute()
                except Exception:
                    pass
        raise


def attach_photo_analysis_to_records(photo_records: list[dict], analysis_result: dict):
    if not photo_records:
        return
    payload = {
        "play_title": str(analysis_result.get("play_title") or ""),
        "play_keyword": str(analysis_result.get("play_keyword") or ""),
        "observed_action": str(analysis_result.get("observed_action") or ""),
        "draft_text": str(analysis_result.get("draft") or ""),
        "ai_caption": str(analysis_result.get("ai_caption") or ""),
        "analyzed_at": _utc_now_iso(),
    }
    for record in photo_records:
        record_id = record.get("id")
        if record_id:
            try:
                supabase.table("photo_records").update(payload).eq("id", int(record_id)).execute()
            except Exception:
                pass


PARENT_TYPE_OPTIONS = ["일반형", "예민형", "공격형", "불안형"]


PARENT_TYPE_GUIDANCE = {
    "일반형": "관찰된 장면과 교사의 지원을 따뜻하고 자연스럽게 전달하세요.",
    "예민형": "평가·추정·과장 표현을 피하고, 사진과 교사 초안에서 확인되는 사실과 지원을 짧고 명료하게 전달하세요. 보호자의 감정이나 의도를 해석하지 마세요.",
    "공격형": "분쟁이 될 수 있는 해석, 비난, 책임 전가, 지시형 표현을 피하세요. 관찰된 사실과 교사의 구체적 지원만 중립적으로 기록하고, 단정적 표현을 사용하지 마세요.",
    "불안형": "안심시키는 어조를 사용하되 '괜찮다'고 단정하지 마세요. 확인된 장면, 교사의 지원, 이후 함께 살필 수 있는 방향을 차분하게 전달하세요.",
}


CURRICULUM_CORE_GUIDES_BY_AGE = {
    "0세": {
        "신체운동·건강": "감각 자극에 반응하고 몸을 움직이며 편안한 일과와 신체 경험의 기초를 쌓아가는 과정입니다.",
        "의사소통": "시선, 표정, 울음, 옹알이와 말소리로 관심과 요구를 나타내는 경험과 연결됩니다.",
        "사회관계": "교사와 친숙한 사람에게 안정감을 느끼고 또래가 있는 공간에 관심을 보이는 경험과 연결됩니다.",
        "예술경험": "소리, 리듬, 색, 촉감에 감각적으로 반응하며 아름다움을 느끼는 경험과 연결됩니다.",
        "자연탐구": "보고, 듣고, 만지는 감각 경험을 통해 주변 사물과 자연에 관심을 갖는 과정과 연결됩니다.",
    },
    "1세": {
        "신체운동·건강": "감각과 신체를 활용해 움직임을 반복해서 시도하고 일과에 익숙해지는 경험과 연결됩니다.",
        "의사소통": "몸짓, 말소리, 간단한 말로 관심과 요구를 나타내는 경험과 연결됩니다.",
        "사회관계": "친숙한 사람과 안정적인 관계를 맺고 또래의 행동에 관심을 보이는 경험과 연결됩니다.",
        "예술경험": "소리와 리듬, 미술 재료의 촉감과 모방 행동을 즐기는 경험과 연결됩니다.",
        "자연탐구": "친숙한 사물과 자연을 감각으로 반복 탐색하며 특성과 변화를 알아가는 경험과 연결됩니다.",
    },
    "2세": {
        "신체운동·건강": "몸의 움직임과 일상생활 습관을 함께 경험하며 건강하고 안전한 생활의 기초를 다지는 과정과 연결됩니다.",
        "의사소통": "표정, 몸짓, 단어, 짧은 말로 요구와 느낌을 나타내고 말놀이와 이야기에 관심을 갖는 경험과 연결됩니다.",
        "사회관계": "나와 다른 사람을 구별하고 또래 곁에서 또는 함께 놀이하며 다른 사람의 행동과 감정에 반응하는 경험과 연결됩니다.",
        "예술경험": "노래, 리듬, 움직임, 미술 재료를 활용해 자신의 느낌을 표현해 보는 경험과 연결됩니다.",
        "자연탐구": "주변 사물과 자연을 반복 탐색하고 같고 다름, 수량, 공간, 변화에 관심을 갖는 경험과 연결됩니다.",
    },
    "3세": {
        "신체운동·건강": "기본 움직임을 즐기고 몸의 균형과 방향을 조절하며 안전한 놀이 방식을 경험하는 과정과 연결됩니다.",
        "의사소통": "짧은 문장과 질문으로 생각과 느낌을 나타내고 그림책과 이야기 듣기에 관심을 보이는 경험과 연결됩니다.",
        "사회관계": "나와 친구의 감정을 알아가고 친구 곁에서 함께 놀이하며 간단한 약속을 경험하는 과정과 연결됩니다.",
        "예술경험": "소리, 움직임, 색, 모양을 즐기고 자신의 느낌을 자유롭게 표현하는 경험과 연결됩니다.",
        "자연탐구": "주변 사물과 자연에 호기심을 보이고 같고 다름을 살펴보며 탐색하는 경험과 연결됩니다.",
    },
    "4세": {
        "신체운동·건강": "몸의 움직임을 조절하고 도구와 공간을 활용하며 놀이 속 안전과 건강한 생활을 경험하는 과정과 연결됩니다.",
        "의사소통": "자신의 생각과 이유를 말하고 이야기의 흐름을 듣고 묻고 답하며 표현을 확장하는 경험과 연결됩니다.",
        "사회관계": "친구와 차례, 공유, 간단한 규칙을 경험하고 서로의 감정과 생각을 살피는 과정과 연결됩니다.",
        "예술경험": "상상한 내용을 음악, 움직임, 미술, 극놀이 등 다양한 방식으로 표현하는 경험과 연결됩니다.",
        "자연탐구": "주변 세계의 특징을 비교하고 변화에 관심을 가지며 궁금한 점을 탐색하는 경험과 연결됩니다.",
    },
    "5세": {
        "신체운동·건강": "몸의 움직임을 계획적으로 조절하고 규칙 있는 놀이에 참여하며 안전한 생활 태도를 확장하는 과정과 연결됩니다.",
        "의사소통": "경험을 회상해 이야기하고 자신의 생각을 이유와 함께 설명하며 듣기·말하기·읽기·쓰기에 관심을 넓히는 경험과 연결됩니다.",
        "사회관계": "친구와 역할과 규칙을 조율하고 공동의 놀이를 만들어 가며 협력하는 과정과 연결됩니다.",
        "예술경험": "표현 방법을 선택하고 계획하여 자신의 생각과 느낌을 창의적으로 나타내는 경험과 연결됩니다.",
        "자연탐구": "자연과 생활 속 문제를 관찰, 비교, 예측하며 탐구하고 해결 방법을 시도하는 경험과 연결됩니다.",
    },
}

RECORD_TYPE_CORE_GUIDANCE = {
    "놀이 이야기": "사진과 교사의 관찰을 바탕으로 놀이가 관심에서 시작되어 탐색·표현·관계·확장으로 이어지는 흐름을 읽고, 교사의 지원과 다음 놀이를 연결해 기록합니다.",
    "일지": "하루 중 실제로 있었던 일상생활·놀이·활동 장면을 선택해, 영유아가 무엇을 했는지와 그 안에서 드러난 배움을 차례대로 정리하는 기록입니다.",
    "알림장": "가정과 공유할 수 있도록 관찰된 사실과 교사의 지원을 따뜻하고 분명한 문장으로 전달하는 기록입니다.",
}

PLAY_DETAIL_CORE_GUIDANCE = {
    "영아": {
        "관심의 시작": "영아가 사람·사물·자료·공간에 시선, 몸짓, 소리, 움직임으로 반응하고 스스로 다가가며 놀이가 시작되는 단서입니다.",
        "탐색과 반복": "영아가 자료를 만지고 움직이고 되풀이하며 감각적 특성과 변화를 알아가는 과정입니다.",
        "표현과 구성": "영아가 표정, 몸짓, 소리, 단어·짧은 말, 재료 조작으로 관심과 느낌을 나타내는 과정입니다.",
        "관계와 상호작용": "교사 또는 또래가 있는 공간에서 반응을 주고받고, 함께 머무르며 놀이 경험을 넓혀가는 과정입니다.",
        "확장과 심화": "관심을 보인 자료나 행동을 다시 선택하고 새로운 방식으로 이어가며 놀이 경험을 지속하는 과정입니다.",
    },
    "유아": {
        "관심의 시작": "유아가 자신의 흥미와 선택을 바탕으로 자료·공간·또래에게 다가가며 놀이를 시작하는 단서입니다.",
        "탐색과 반복": "자료의 특성과 관계를 살피고 비교·반복하며 자신만의 놀이 방법을 만들어 가는 과정입니다.",
        "표현과 구성": "유아가 생각과 느낌을 말, 움직임, 미술, 구성, 역할놀이 등 다양한 방식으로 표현하고 구성하는 과정입니다.",
        "관계와 상호작용": "친구와 생각·역할·차례를 나누고 반응을 조절하며 공동의 놀이 흐름을 만들어 가는 과정입니다.",
        "확장과 심화": "기존 놀이에 새로운 자료·역할·규칙·질문을 더해 놀이의 의미와 방법을 넓혀가는 과정입니다.",
    },
}



# 보육일지에서는 놀이의 단계가 아니라 하루의 실제 장면을 기준으로 기록합니다.
# 0~2세는 2024 개정 표준보육과정의 일상·놀이 중심 관점,
# 3~5세는 2019 개정 누리과정의 유아·놀이 중심 관점을 반영한 안내 문장입니다.
DIARY_COMPONENT_OPTIONS = ["일상생활", "놀이", "활동"]

DIARY_COMPONENT_CORE_GUIDANCE = {
    "영아": {
        "일상생활": "일과 속에서 먹기·쉬기·씻기·배변·정리처럼 반복되는 생활을 경험하며, 몸짓·표정·말소리·짧은 말로 자신의 요구를 나타내고 편안한 생활 리듬을 만들어 가는 과정입니다.",
        "놀이": "관심 있는 사람·사물·자료에 스스로 다가가 보고, 만지고, 움직이고, 되풀이하며 감각적 특성과 변화를 알아가는 과정입니다.",
        "활동": "교사가 마련한 동화·음악·미술·신체·감각 활동에 참여하며, 보고 듣고 움직이고 표현하는 경험을 넓혀가는 과정입니다.",
    },
    "유아": {
        "일상생활": "일과 속에서 건강·안전·자조 행동을 경험하고, 자신과 다른 사람을 존중하며 공동생활에 필요한 약속과 생활 태도를 익혀가는 과정입니다.",
        "놀이": "자신의 흥미에 따라 자료와 공간을 선택하고, 탐색·표현·구성·또래와의 상호작용을 통해 놀이의 방법과 의미를 확장하는 과정입니다.",
        "활동": "동화·음악·미술·신체·자연 탐구 등 다양한 활동에 참여하며, 자신의 생각과 느낌을 표현하고 배움의 방법을 넓혀가는 과정입니다.",
    },
}

DIARY_COMPONENT_NOTE_PLACEHOLDERS = {
    "일상생활": "예: 점심시간에 스스로 숟가락을 잡고 반찬을 살펴본 뒤, 더 먹고 싶은 음식을 짧은 말과 몸짓으로 표현했습니다.",
    "놀이": "예: 블록을 길게 이어 붙이고 친구가 만든 공간과 연결하며 놀이를 이어갔습니다.",
    "활동": "예: 자연물을 만져 본 뒤 종이 위에 놓아 보고, 완성한 모습을 친구에게 보여 주었습니다.",
}


def diary_component_guidance_text(age_group: str, selected_components: list[str] | None) -> str:
    subject_group = "영아" if normalize_age(age_group) in ["0세", "1세", "2세"] else "유아"
    guide = DIARY_COMPONENT_CORE_GUIDANCE[subject_group]
    rows = []
    for item in selected_components or []:
        if item in guide:
            rows.append(f"- {item}: {guide[item]}")
    return "\n".join(rows) if rows else "미선택"


def render_diary_component_guidance(age_group: str, selected_components: list[str]):
    if not selected_components:
        return
    framework = curriculum_framework_label(age_group) if age_group and age_group != "- 선택 -" else "표준보육과정·누리과정"
    st.markdown(f"**{framework} 관점의 보육일지 세부 구성 안내**")
    for line in diary_component_guidance_text(age_group, selected_components).split("\n"):
        st.caption(line)


def curriculum_framework_label(age_group: str) -> str:
    return "표준보육과정" if normalize_age(age_group) in ["0세", "1세", "2세"] else "누리과정"


def curriculum_framework_short_label(age_group: str) -> str:
    return "표준보육과정 연계" if normalize_age(age_group) in ["0세", "1세", "2세"] else "누리과정 연계"


def play_detail_guidance_text(age_group: str, selected_details: list[str] | None) -> str:
    subject_group = "영아" if normalize_age(age_group) in ["0세", "1세", "2세"] else "유아"
    guide = PLAY_DETAIL_CORE_GUIDANCE[subject_group]
    rows = []
    for item in selected_details or []:
        if item in guide:
            rows.append(f"- {item}: {guide[item]}")
    return "\n".join(rows) if rows else "미선택"


def render_record_type_guidance(record_type: str, age_group: str):
    if record_type == "일지":
        framework = curriculum_framework_label(age_group) if age_group and age_group != "- 선택 -" else "표준보육과정·누리과정"
        st.info(
            "**보육일지는 하루의 실제 장면을 차례대로 남기는 기록입니다.**\n\n"
            "아래에서 **일상생활 · 놀이 · 활동** 중 기록할 장면을 고른 뒤, "
            "각 장면에서 영유아가 무엇을 했는지 교사가 구체적으로 적어 주세요.\n\n"
            f"선택한 {framework} 영역은 이후 **교육과정 연계**와 **영유아 관찰 및 평가**에 반영됩니다."
        )
        return

    if record_type in RECORD_TYPE_CORE_GUIDANCE:
        framework = curriculum_framework_label(age_group) if age_group and age_group != "- 선택 -" else "표준보육과정·누리과정"
        st.info(
            f"**기록 유형 핵심 안내**\n\n"
            f"{RECORD_TYPE_CORE_GUIDANCE[record_type]}\n\n"
            f"{framework}의 놀이 중심·관찰 중심 원칙에 맞춰 사실과 교사의 판단을 구분해 기록합니다."
        )

def render_play_detail_guidance(age_group: str, selected_details: list[str]):
    if not selected_details:
        return
    framework = curriculum_framework_label(age_group) if age_group and age_group != "- 선택 -" else "표준보육과정·누리과정"
    st.markdown(f"**{framework} 관점의 놀이 세부 구분 핵심 설명**")
    guide = play_detail_guidance_text(age_group, selected_details)
    for line in guide.split("\n"):
        st.caption(line)


def _curriculum_fallback_links(age_group: str, curriculum_areas: list[str]) -> list[dict]:
    age = normalize_age(age_group)
    guides = CURRICULUM_CORE_GUIDES_BY_AGE.get(age, CURRICULUM_CORE_GUIDES_BY_AGE["2세"])
    return [
        {"area": str(area), "description": guides.get(str(area), "선택한 교육과정 영역의 경험과 연결해 살펴볼 수 있습니다.")}
        for area in curriculum_areas or []
    ]


def _normalize_curriculum_links(value, age_group: str, selected_areas: list[str]) -> list[dict]:
    by_area: dict[str, str] = {}
    if isinstance(value, list):
        for item in value:
            if not isinstance(item, dict):
                continue
            area = str(item.get("area") or "").strip()
            description = str(item.get("description") or "").strip()
            if area and description:
                by_area[area] = description

    fallback = {item["area"]: item["description"] for item in _curriculum_fallback_links(age_group, selected_areas)}
    normalized = []
    for area in selected_areas or []:
        area_text = str(area).strip()
        if not area_text:
            continue
        normalized.append({"area": area_text, "description": by_area.get(area_text) or fallback.get(area_text) or "선택한 영역의 경험과 연결해 살펴볼 수 있습니다."})
    return normalized


def _record_label(output_type: str) -> str:
    return "놀이 이야기 기록 예시 (종합)" if output_type == "놀이 이야기" else "보육일지 기록 예시 (종합)"


def _structured_record_plain_text(output: dict) -> str:
    framework = str(output.get("framework_label") or "교육과정")
    observation_label = str(output.get("observation_label") or "영유아 관찰 및 평가")
    record_label = str(output.get("record_label") or "종합 기록")
    links = output.get("curriculum_links") or []
    link_text = "\n".join([f"- {item.get('area')}: {item.get('description')}" for item in links if isinstance(item, dict)]) or "- 선택한 교육과정 영역이 없습니다."
    chunks = [
        f"[{('사진 속 놀이 내용' if str(output.get('output_type') or '') == '놀이 이야기' else '사진 속 일상·놀이·활동 장면')}]\n{str(output.get('photo_play_content') or '').strip()}",
        f"[교사가 관찰한 놀이 상황]\n{str(output.get('teacher_observed_situation') or '').strip()}",
        f"[{framework}]\n{link_text}",
        f"[{observation_label}]\n{str(output.get('observation_evaluation') or '').strip()}",
    ]
    next_plan = str(output.get("next_play_support_plan") or "").strip()
    if next_plan:
        chunks.append(f"[다음 놀이 지원 계획]\n{next_plan}")
    chunks.append(f"[{record_label}]\n{str(output.get('integrated_record') or '').strip()}")
    return "\n\n".join(chunks).strip()


def generate_final_play_record(context: dict, edited_draft: str, revision_direction: str = "") -> dict:
    """놀이 이야기·일지는 과정 산출과 종합 기록을 함께 만들고, 알림장은 기존 3개 예시 방식을 유지합니다."""
    client = get_openai_client()
    if client is None:
        raise RuntimeError("OpenAI API 키가 설정되지 않았습니다. Streamlit Secrets의 [openai] api_key를 확인해 주세요.")

    output_type = str(context.get("output_type") or "놀이 이야기")
    play_name = str(context.get("play_name") or "오늘의 놀이")
    age_group = str(context.get("age_group") or "")
    child_alias = str(context.get("child_alias") or "")
    curriculum_areas = _as_text_list(context.get("curriculum_areas"))
    curriculum = curriculum_display_text(curriculum_areas)
    play_subcategories = _as_text_list(context.get("play_subcategories"))
    teacher_supports = _as_text_list(context.get("teacher_supports"))
    detail_tags = ", ".join(play_subcategories) or "미선택"
    supports = ", ".join(teacher_supports) or "미선택"
    detail_notes = _selection_notes_display(play_subcategories, context.get("play_subcategory_notes"))
    support_notes = _selection_notes_display(teacher_supports, context.get("teacher_support_notes"))
    teacher_observed_situation = str(context.get("teacher_observed_situation") or revision_direction or "").strip()
    next_play_support_plan = str(context.get("next_play_support_plan") or "").strip()
    analysis = context.get("photo_analysis") if isinstance(context.get("photo_analysis"), dict) else {}
    photo_play_content = str(analysis.get("ai_caption") or "사진에서 확인되는 놀이 장면을 바탕으로 분석했습니다.").strip()
    framework = curriculum_framework_label(age_group)
    framework_title = curriculum_framework_short_label(age_group)
    child_label = "영아" if normalize_age(age_group) in ["0세", "1세", "2세"] else "유아"
    component_label = "보육일지 세부 구성" if output_type == "일지" else "놀이 세부 구분"
    component_guidance = (
        diary_component_guidance_text(age_group, play_subcategories)
        if output_type == "일지"
        else play_detail_guidance_text(age_group, play_subcategories)
    )
    support_input_block = (
        f"- 교사의 지원: {supports}\n- 교사의 지원별 구체 내용:\n{support_notes}"
        if output_type == "놀이 이야기"
        else "- 보육일지는 별도의 '교사의 지원' 선택값을 입력하지 않습니다. 교사가 관찰한 놀이 상황과 사진 1차 분석에 실제로 적힌 지원 내용만 기록에 반영하세요."
    )

    if output_type in ["놀이 이야기", "일지"]:
        record_label = _record_label(output_type)
        record_style = (
            "놀이의 관심·탐색·표현·관계·교사 지원 흐름이 자연스럽게 이어지도록 6~9문장으로 작성하세요."
            if output_type == "놀이 이야기"
            else "보육일지 문체로, 선택한 일상생활·놀이·활동의 실제 장면과 그 안에서 드러난 배움이 분명히 나타나도록 6~9문장으로 작성하세요. '했음/보였음/지원하였음'처럼 공식 기록에 적합한 종결을 사용하세요."
        )
        output_schema = """{
  \"curriculum_links\": [
    {\"area\": \"선택한 영역명\", \"description\": \"사진과 교사 관찰에 근거한 1문장 연계 설명\"}
  ],
  \"observation_evaluation\": \"영아 또는 유아의 관심, 탐색, 표현, 관계, 배움의 변화를 교육과정에 근거해 3~5문장으로 정리\",
  \"integrated_record\": \"종합 기록 6~9문장\"
}"""
        prompt = f"""
당신은 한국 영유아교육 현장의 사진 기반 기록을 돕는 보조자입니다.
사진 1차 분석과 교사가 직접 적은 관찰 상황을 바탕으로, 교사의 판단이 드러나는 과정형 기록을 작성하세요.

[기본 정보]
- 놀이명: {play_name}
- 연령: {age_group or '미입력'}
- 아이 별칭: {child_alias or '미입력'}
- 기록 유형: {output_type}
- {framework} 선택 영역: {curriculum}
- 사진 속 놀이 내용: {photo_play_content}
- 교사가 관찰한 놀이 상황(필수): {teacher_observed_situation}
- {component_label}: {detail_tags}
- {component_label}별 구체 장면:
{detail_notes}
{support_input_block}
- {component_label}의 {framework} 관점 핵심 설명:
{component_guidance}
- 교사가 수정한 사진 1차 분석 결과:
{edited_draft.strip()}

[작성 기준]
- 사진과 교사 관찰에 직접 드러난 사실만 사용하세요. 보이지 않은 대화·감정·사건·발달 상태를 지어내지 마세요.
- curriculum_links에는 교사가 선택한 영역만 정확히 포함하고, 영역마다 사진·관찰 장면과 연결된 설명을 1문장씩 작성하세요.
- 0~2세는 ‘영아’의 감각, 반응, 반복 탐색, 몸짓·말소리·짧은 말, 안정감의 언어를 사용하세요.
- 3~5세는 ‘유아’의 흥미, 선택, 탐색, 표현, 또래와의 상호작용, 놀이 확장의 언어를 사용하세요.
- observation_evaluation은 평가적 낙인이나 단정 없이, {child_label}의 관심·탐색·표현·관계·배움의 변화를 {framework} 관점에서 정리하세요.
- {record_label}은 {record_style}
- 기록 유형이 일지라면, 선택한 보육일지 세부 구성(일상생활·놀이·활동)과 교사가 적은 실제 장면을 중심으로 작성하고, 선택하지 않은 구성은 임의로 추가하지 마세요.
- 기록 유형이 일지라면, 별도의 교사 지원 선택값이 없으므로 사진 1차 분석이나 교사 관찰에 실제로 적힌 지원 내용만 자연스럽게 반영하세요.
- 다음 놀이 지원 계획은 AI가 새로 만들거나 바꾸지 않습니다. 별도 입력값이 있을 때 화면에서 원문 그대로 보여 줄 것입니다.
- 아래 JSON 객체만 반환하세요.

{output_schema}
""".strip()

        response = client.responses.create(
            model=get_openai_vision_model(),
            input=[{"role": "user", "content": [{"type": "input_text", "text": prompt}]}],
            max_output_tokens=1800,
            store=False,
        )
        raw = str(getattr(response, "output_text", "") or "").strip()
        payload = _parse_json_object(raw)
        curriculum_links = _normalize_curriculum_links(payload.get("curriculum_links"), age_group, curriculum_areas)
        observation_evaluation = str(payload.get("observation_evaluation") or "").strip()
        integrated_record = str(payload.get("integrated_record") or "").strip()
        if not observation_evaluation:
            observation_evaluation = (
                f"{child_alias.strip() or child_label}는 {teacher_observed_situation}의 과정에서 관심을 보인 자료와 행동을 반복해 살피며 놀이를 이어갔습니다. "
                f"선택한 {framework} 영역의 경험이 사진과 교사 관찰 속에서 함께 드러났습니다."
            )
        if not integrated_record:
            if output_type == "일지":
                integrated_record = (
                    f"{edited_draft.strip()} {teacher_observed_situation} "
                    f"선택한 일상생활·놀이·활동 장면을 바탕으로 {child_label}의 반응과 배움을 기록하였음."
                ).strip()
            else:
                integrated_record = (
                    f"{edited_draft.strip()} {teacher_observed_situation} "
                    f"교사는 {supports if supports != '미선택' else '영유아의 반응을 살피는 지원'}을 통해 놀이가 이어질 수 있도록 도왔습니다."
                ).strip()
        result = {
            "output_type": output_type,
            "photo_play_content": photo_play_content,
            "teacher_observed_situation": teacher_observed_situation,
            "framework_label": framework_title,
            "observation_label": f"{child_label} 관찰 및 평가",
            "curriculum_links": curriculum_links,
            "observation_evaluation": age_sanitize(observation_evaluation, age_group),
            "next_play_support_plan": next_play_support_plan,
            "record_label": record_label,
            "integrated_record": age_sanitize(integrated_record, age_group),
            "sections": {},
            "examples": [],
        }
        result["plain_text"] = _structured_record_plain_text(result)
        return result

    # 알림장은 기존 보호자 유형별 3개 예시 생성 방식을 유지합니다.
    parent_type = str(context.get("parent_type") or "일반형").strip()
    if parent_type not in PARENT_TYPE_OPTIONS:
        parent_type = "일반형"
    parent_guidance = PARENT_TYPE_GUIDANCE[parent_type]
    output_schema = """{\n  \"examples\": [\"서로 다른 문체의 완결된 예시 1\", \"예시 2\", \"예시 3\"]\n}"""
    prompt = f"""
당신은 한국 영유아교육 현장의 알림장 문장을 돕는 보조자입니다.
사진 분석 1차 결과와 교사의 관찰을 바탕으로 알림장 예시 3개를 작성하세요.

- 놀이명: {play_name}
- 연령: {age_group or '미입력'}
- 아이 별칭: {child_alias or '미입력'}
- 선택 교육과정 영역: {curriculum}
- 교사가 수정한 사진 1차 분석 결과: {edited_draft.strip()}
- 교사가 관찰한 놀이 상황: {teacher_observed_situation or '미입력'}
- 보호자 유형에 따른 문체 기준: {parent_guidance}

사진에 직접 드러나지 않은 사건·감정·발달 수준을 지어내지 말고, 각 예시는 3~5문장 이내로 작성하세요.
결과에는 보호자 유형명 자체를 쓰지 마세요. 아래 JSON 형식만 반환하세요.
{output_schema}
""".strip()
    response = client.responses.create(
        model=get_openai_vision_model(),
        input=[{"role": "user", "content": [{"type": "input_text", "text": prompt}]}],
        max_output_tokens=1500,
        store=False,
    )
    raw = str(getattr(response, "output_text", "") or "").strip()
    payload = _parse_json_object(raw)
    examples = payload.get("examples") if isinstance(payload.get("examples"), list) else []
    examples = [str(item).strip() for item in examples if str(item).strip()][:3]
    if len(examples) < 3:
        subject = child_alias.strip() or ("영아" if normalize_age(age_group) in ["0세", "1세", "2세"] else "유아")
        base = edited_draft.strip()
        examples = [
            f"{base}\n\n{subject}의 관심과 반응을 중심으로 오늘의 모습을 전합니다.",
            f"{play_name} 활동에서 관찰된 장면을 바탕으로 정리했습니다. {base}",
            f"오늘의 {play_name} 경험은 {curriculum} 영역과 연결해 살펴볼 수 있었습니다. {base}",
        ]
    plain = "\n\n".join(f"예시 {index + 1}\n{item}" for index, item in enumerate(examples))
    return {"output_type": output_type, "sections": {}, "examples": examples, "plain_text": plain}

def save_generated_text(session_id: str, user_id: str, output_type: str, result_text: str, edited_text: str, source_text: str):
    payload = {
        "session_id": session_id,
        "user_id": user_id,
        "output_type": output_type,
        "result_text": result_text,
        "edited_text": edited_text,
        "source_text": source_text,
        "expires_at": _expiry_iso(),
        "deleted": False,
    }
    response = supabase.table("generated_texts").insert(payload).execute()
    rows = _response_data(response)
    return rows[0] if rows else payload


def load_member_play_sessions(user_id: str) -> pd.DataFrame:
    if not user_id:
        return pd.DataFrame()
    try:
        response = supabase.table("play_sessions").select("*").eq("user_id", user_id).eq("deleted", False).order("created_at", desc=True).execute()
        return pd.DataFrame(_response_data(response))
    except Exception:
        return pd.DataFrame()


def load_member_generated_texts(user_id: str) -> pd.DataFrame:
    if not user_id:
        return pd.DataFrame()
    try:
        response = supabase.table("generated_texts").select("*").eq("user_id", user_id).eq("deleted", False).order("created_at", desc=True).execute()
        return pd.DataFrame(_response_data(response))
    except Exception:
        return pd.DataFrame()


def load_member_photo_records(user_id: str) -> pd.DataFrame:
    if not user_id:
        return pd.DataFrame()
    try:
        response = supabase.table("photo_records").select("*").eq("user_id", user_id).eq("deleted", False).order("created_at", desc=True).execute()
        return pd.DataFrame(_response_data(response))
    except Exception:
        return pd.DataFrame()


def create_member_photo_signed_url(file_path: str, bucket_name: str = PLAY_PHOTO_BUCKET) -> str:
    """Private Storage 사진을 본인 화면에서 짧은 시간만 볼 수 있는 signed URL로 변환합니다."""
    if not file_path:
        return ""

    try:
        response = (
            supabase.storage.from_(str(bucket_name or PLAY_PHOTO_BUCKET))
            .create_signed_url(str(file_path), PLAY_PHOTO_SIGNED_URL_TTL_SECONDS)
        )
        if isinstance(response, dict):
            return str(response.get("signedURL") or response.get("signedUrl") or response.get("signed_url") or "")
        return str(
            getattr(response, "signedURL", "")
            or getattr(response, "signed_url", "")
            or getattr(response, "signedUrl", "")
            or ""
        )
    except Exception:
        return ""


def delete_member_photo(photo_id: int, user_id: str) -> bool:
    """회원 본인이 선택한 사진을 Storage와 photo_records에서 함께 영구 삭제합니다."""
    if not user_id:
        raise PermissionError("사진을 삭제하려면 로그인해 주세요.")

    response = (
        supabase.table("photo_records")
        .select("id, user_id, storage_bucket, file_path")
        .eq("id", int(photo_id))
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    rows = _response_data(response)
    if not rows:
        raise PermissionError("삭제할 사진을 찾지 못했거나 삭제 권한이 없습니다.")

    record = rows[0]
    bucket_name = str(record.get("storage_bucket") or PLAY_PHOTO_BUCKET)
    file_path = str(record.get("file_path") or "")
    if file_path:
        supabase.storage.from_(bucket_name).remove([file_path])

    supabase.table("photo_records").delete().eq("id", int(photo_id)).eq("user_id", user_id).execute()
    return True


def delete_all_member_photos(user_id: str):
    """회원 계정 영구 삭제 전에 해당 회원의 사진 원본과 메타데이터를 모두 정리합니다."""
    if not user_id:
        return

    photo_df = load_member_photo_records(user_id)
    if photo_df.empty:
        return

    if "storage_bucket" in photo_df.columns:
        bucket_series = photo_df["storage_bucket"].fillna(PLAY_PHOTO_BUCKET)
    else:
        bucket_series = pd.Series([PLAY_PHOTO_BUCKET] * len(photo_df), index=photo_df.index)

    for bucket_name, group in photo_df.groupby(bucket_series):
        paths = [str(path) for path in group.get("file_path", pd.Series(dtype=str)).dropna().tolist() if str(path)]
        if paths:
            try:
                supabase.storage.from_(str(bucket_name)).remove(paths)
            except Exception:
                pass

    try:
        supabase.table("photo_records").delete().eq("user_id", user_id).execute()
    except Exception:
        pass


def render_member_information_page():
    """교사의 온도 없이, 회원별 놀이 세션·생성문장·비공개 사진만 보여 줍니다."""
    render_menu_card(
        "👤 내 정보 보기",
        "내 계정, 저장된 놀이 기록과 비공개 사진을 확인하고 사진을 직접 삭제할 수 있습니다.",
        ["가입 정보", "놀이 기록", "생성 문장", "내 놀이 사진"]
    )
    purge_expired_private_records_once_per_session()
    user_id = current_member_user_id()
    if not user_id:
        st.info("소통 탭에서 아이디와 비밀번호로 로그인하면 내 놀이 기록과 보관 사진을 확인할 수 있습니다.")
        return
    profile = get_member_profile(user_id)
    if not profile:
        st.warning("회원 프로필을 확인하지 못했습니다. 다시 로그인하거나 관리자에게 문의해 주세요.")
        return

    st.markdown("### 가입 정보")
    info_col1, info_col2 = st.columns(2)
    with info_col1:
        st.write(f"**아이디**  {profile.get('username') or profile.get('platform_member_id') or '-'}")
        st.write(f"**가입자 성명**  {profile.get('subscriber_name') or profile.get('display_name') or '-'}")
        st.write(f"**이메일**  {profile.get('email') or current_member_email() or '-'}")
        st.write(f"**직책**  {profile.get('position') or '-'}")
    with info_col2:
        st.write(f"**기관명**  {profile.get('institution_name') or '-'}")
        st.write(f"**기관 구분·유형**  {(profile.get('institution_group') or '-')} / {(profile.get('institution_type') or '-')}")
        st.write(f"**기관 특성**  {profile.get('institution_feature') or '-'}")
        st.write(f"**최근 로그인**  {profile.get('last_login_at') or '-'}")
    st.caption("생성된 텍스트 기록은 작성일로부터 1년 후 자동 삭제됩니다. 사진 원본은 비공개 Storage에 보관되며 자동 삭제되지 않고 본인이 직접 삭제할 수 있습니다.")
    if st.button("로그아웃", key="my_page_logout"):
        clear_member_session()
        st.rerun()

    sessions_df = load_member_play_sessions(user_id)
    texts_df = load_member_generated_texts(user_id)
    legacy_phrase_df = load_member_records("phrase_logs", user_id)
    photo_df = load_member_photo_records(user_id)
    record_tab1, record_tab2, record_tab3 = st.tabs(["🗂️ 내 놀이 기록", "📝 생성 문장", "📷 내 놀이 사진"])

    with record_tab1:
        if sessions_df.empty:
            st.caption("저장된 놀이 기록이 없습니다. 기록 요정에서 사진 분석을 시작해 주세요.")
        else:
            display = _format_kst_datetime_column(sessions_df)
            cols = [c for c in ["작성일시", "play_name", "age_group", "child_alias", "record_type", "parent_type", "curriculum_areas", "play_subcategories", "teacher_supports", "teacher_observed_situation", "next_play_support_plan", "photo_match_status", "photo_match_reason", "ai_summary"] if c in display.columns]
            display = display[cols].rename(columns={
                "play_name": "놀이명", "age_group": "연령", "child_alias": "아이 별칭", "teacher_observed_situation": "교사가 관찰한 놀이 상황", "next_play_support_plan": "다음 놀이 지원 계획",
                "record_type": "기록 유형", "curriculum_areas": "교육과정 영역", "ai_summary": "사진에 대한 1차 분석 결과",
            })
            st.dataframe(display, use_container_width=True, hide_index=True, height=360)

    with record_tab2:
        if texts_df.empty and legacy_phrase_df.empty:
            st.caption("저장된 생성 문장이 없습니다.")
        else:
            if not texts_df.empty:
                st.markdown("#### 사진 기반 생성 문장")
                for record in _format_kst_datetime_column(texts_df).to_dict("records"):
                    label = f"{record.get('작성일시') or record.get('created_at') or '-'} · {record.get('output_type') or '기록'}"
                    with st.expander(label, expanded=False):
                        st.write(record.get("result_text") or "")
                        if record.get("edited_text"):
                            st.caption("교사가 수정한 1차 초안")
                            st.write(record.get("edited_text"))
            if not legacy_phrase_df.empty:
                st.markdown("#### 이전 기록 요정 기록")
                legacy = _format_kst_datetime_column(legacy_phrase_df)
                cols = [c for c in ["작성일시", "record_type", "play_keyword", "generated_text"] if c in legacy.columns]
                st.dataframe(legacy[cols], use_container_width=True, hide_index=True, height=240)

    with record_tab3:
        st.caption("사진 원본은 비공개 Supabase Storage에 보관됩니다. 삭제하면 원본 파일과 연결 정보가 함께 영구 삭제됩니다.")
        if photo_df.empty:
            st.caption("보관된 놀이 사진이 없습니다.")
        else:
            records = _format_kst_datetime_column(photo_df).to_dict("records")
            for row_index in range(0, len(records), 2):
                columns = st.columns(2)
                for column, record in zip(columns, records[row_index:row_index + 2]):
                    with column:
                        photo_id = record.get("id")
                        signed_url = create_member_photo_signed_url(str(record.get("file_path") or ""), str(record.get("storage_bucket") or PLAY_PHOTO_BUCKET))
                        if signed_url:
                            st.image(signed_url, use_container_width=True)
                        st.caption(f"{record.get('작성일시') or '-'} · {record.get('original_file_name') or '놀이 사진'}")
                        if record.get("play_title"):
                            st.write(f"**연결 놀이명**  {record.get('play_title')}")
                        if record.get("selection_reason"):
                            st.caption(record.get("selection_reason"))
                        request_key = f"member_photo_delete_request_{photo_id}"
                        if st.button("이 사진 삭제", key=f"member_photo_delete_button_{photo_id}"):
                            st.session_state[request_key] = True
                        if st.session_state.get(request_key):
                            confirmed = st.checkbox("사진 원본과 연결 정보가 영구 삭제되는 것을 확인했습니다.", key=f"member_photo_delete_confirm_{photo_id}")
                            if st.button("사진 영구 삭제", key=f"member_photo_delete_confirm_button_{photo_id}", disabled=not confirmed):
                                delete_member_photo(int(photo_id), user_id)
                                st.session_state.pop(request_key, None)
                                st.success("사진을 영구 삭제했습니다.")
                                st.rerun()


def platform_info_text() -> str:
    """상단 안내 영역에만 사용하는 플랫폼 안내 문구입니다."""
    return (
        f"{WITTI_SITE_LABEL}: {WITTI_SITE_URL}\n"
        f"{WITTI_CONTACT_LABEL}: {WITTI_CONTACT_EMAIL}"
    )

def append_platform_info(text: str) -> str:
    """생성 문구에는 플랫폼 안내를 붙이지 않습니다. 기존 호출 호환용 안전 함수입니다."""
    return (text or "").strip()


def text_to_html_with_links(text: str) -> str:
    """문장 출력 시 사이트 URL만 클릭 가능한 링크로 변환합니다. 문의 이메일은 오작동을 막기 위해 일반 텍스트로 둡니다."""
    escaped = html.escape(text or "")
    escaped_site = html.escape(WITTI_SITE_URL)
    escaped = escaped.replace(
        escaped_site,
        f'<a href="{escaped_site}" target="_blank" rel="noopener noreferrer">{escaped_site}</a>'
    )
    return escaped.replace("\n", "<br>")


def render_platform_guide():
    st.markdown(
        f"""
        <div class="small-guide">
        🔗 {WITTI_SITE_LABEL}: <a href="{WITTI_SITE_URL}" target="_blank" rel="noopener noreferrer">{WITTI_SITE_URL}</a><br>
        ✉️ {WITTI_CONTACT_LABEL}: <strong>{WITTI_CONTACT_EMAIL}</strong>
        </div>
        """,
        unsafe_allow_html=True,
    )


def render_generated_phrase(idx: int, text: str):
    """기록 요정 결과는 번호 없이 문장 자체가 읽히도록 표시합니다."""
    st.markdown(
        f"<div class='result-card-gray'>{text_to_html_with_links(text)}</div>",
        unsafe_allow_html=True,
    )

def apply_sidebar_open_hint():
    """접힌 사이드바 열기 버튼 바로 옆에 '설정 창 열기' 툴팁을 표시합니다."""
    components.html(
        """
        <script>
        (function () {
            const win = window.parent;
            const doc = win.document;
            const TOOLTIP_TEXT = '설정 창 열기';

            function ensureTooltip() {
                let tooltip = doc.getElementById('witti-sidebar-open-tooltip');
                if (!tooltip) {
                    tooltip = doc.createElement('div');
                    tooltip.id = 'witti-sidebar-open-tooltip';
                    tooltip.textContent = TOOLTIP_TEXT;
                    tooltip.style.position = 'fixed';
                    tooltip.style.display = 'none';
                    tooltip.style.zIndex = '2147483647';
                    tooltip.style.pointerEvents = 'none';
                    tooltip.style.whiteSpace = 'nowrap';
                    tooltip.style.background = '#16324F';
                    tooltip.style.color = '#FFFFFF';
                    tooltip.style.borderRadius = '999px';
                    tooltip.style.padding = '7px 11px';
                    tooltip.style.fontSize = '13px';
                    tooltip.style.fontWeight = '700';
                    tooltip.style.lineHeight = '1';
                    tooltip.style.boxShadow = '0 8px 22px rgba(22,50,79,0.18)';
                    doc.body.appendChild(tooltip);
                }
                return tooltip;
            }

            const tooltip = ensureTooltip();

            function isVisible(el) {
                if (!el) return false;
                const rect = el.getBoundingClientRect();
                const style = win.getComputedStyle(el);
                return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
            }

            function getCollapsedOpenButtons() {
                const selectors = [
                    'div[data-testid="stSidebarCollapsedControl"] button',
                    'div[data-testid="collapsedControl"] button',
                    'button[aria-label*="Open sidebar"]',
                    'button[title*="Open sidebar"]',
                    'button[aria-label*="open sidebar"]',
                    'button[title*="open sidebar"]'
                ];

                return Array.from(doc.querySelectorAll(selectors.join(',')))
                    .filter((button) => {
                        if (!isVisible(button)) return false;
                        const label = `${button.getAttribute('aria-label') || ''} ${button.getAttribute('title') || ''}`.toLowerCase();
                        const parentTestId = button.closest('[data-testid]')?.getAttribute('data-testid') || '';
                        return (
                            parentTestId === 'stSidebarCollapsedControl' ||
                            parentTestId === 'collapsedControl' ||
                            label.includes('open sidebar')
                        );
                    });
            }

            function placeTooltipNextTo(button) {
                const rect = button.getBoundingClientRect();
                const gap = 8;
                let left = rect.right + gap;
                let top = rect.top + rect.height / 2;

                tooltip.textContent = TOOLTIP_TEXT;
                tooltip.style.display = 'block';
                tooltip.style.left = `${left}px`;
                tooltip.style.top = `${top}px`;
                tooltip.style.transform = 'translateY(-50%)';

                const tooltipRect = tooltip.getBoundingClientRect();
                if (tooltipRect.right > win.innerWidth - 8) {
                    left = Math.max(8, rect.left - tooltipRect.width - gap);
                    tooltip.style.left = `${left}px`;
                }
            }

            function hideTooltip() {
                tooltip.style.display = 'none';
            }

            function attachHint() {
                const buttons = getCollapsedOpenButtons();
                buttons.forEach((button) => {
                    if (button.dataset.wittiSidebarOpenHint === 'done') return;
                    button.dataset.wittiSidebarOpenHint = 'done';
                    button.setAttribute('title', TOOLTIP_TEXT);
                    button.setAttribute('aria-label', TOOLTIP_TEXT);
                    button.addEventListener('mouseenter', () => placeTooltipNextTo(button));
                    button.addEventListener('mousemove', () => placeTooltipNextTo(button));
                    button.addEventListener('mouseleave', hideTooltip);
                    button.addEventListener('focus', () => placeTooltipNextTo(button));
                    button.addEventListener('blur', hideTooltip);
                    button.addEventListener('click', hideTooltip);
                });
            }

            attachHint();
            if (!win.__wittiSidebarOpenHintObserver) {
                win.__wittiSidebarOpenHintObserver = new MutationObserver(attachHint);
                win.__wittiSidebarOpenHintObserver.observe(doc.body, { childList: true, subtree: true, attributes: true });
            }
            setTimeout(attachHint, 200);
            setTimeout(attachHint, 700);
            setTimeout(attachHint, 1500);
            setTimeout(attachHint, 3000);
        })();
        </script>
        """,
        height=0,
        width=0,
    )


def apply_mobile_settings_launcher():
    """모바일에서 기본 설정 버튼이 보이지 않을 때 사용할 고정 설정 버튼을 만듭니다."""
    components.html(
        """
        <script>
        (function () {
            const win = window.parent;
            const doc = win.document;
            const BUTTON_ID = 'witti-mobile-settings-launcher';

            function isVisible(el) {
                if (!el) return false;
                const rect = el.getBoundingClientRect();
                const style = win.getComputedStyle(el);
                return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
            }

            function findSidebarOpenButton() {
                const selectors = [
                    'div[data-testid="stSidebarCollapsedControl"] button',
                    'div[data-testid="collapsedControl"] button',
                    'button[aria-label*="Open sidebar"]',
                    'button[title*="Open sidebar"]',
                    'button[aria-label*="open sidebar"]',
                    'button[title*="open sidebar"]'
                ];
                return Array.from(doc.querySelectorAll(selectors.join(','))).find(isVisible) || null;
            }

            function findSidebarCloseButton() {
                const selectors = [
                    'button[data-testid="stSidebarCollapseButton"]',
                    'button[aria-label*="Close sidebar"]',
                    'button[title*="Close sidebar"]',
                    'button[aria-label*="Collapse sidebar"]',
                    'button[title*="Collapse sidebar"]'
                ];
                return Array.from(doc.querySelectorAll(selectors.join(','))).find(isVisible) || null;
            }

            function sidebarIsOpen() {
                const sidebar = doc.querySelector('section[data-testid="stSidebar"], aside[data-testid="stSidebar"], div[data-testid="stSidebar"]');
                if (!sidebar) return false;
                const rect = sidebar.getBoundingClientRect();
                return rect.width > 120 && rect.right > 120;
            }

            function ensureLauncher() {
                let button = doc.getElementById(BUTTON_ID);
                if (!button) {
                    button = doc.createElement('button');
                    button.id = BUTTON_ID;
                    button.type = 'button';
                    button.textContent = '⚙️ 설정';
                    button.setAttribute('aria-label', '설정 창 열기');
                    button.addEventListener('click', function () {
                        const openButton = findSidebarOpenButton();
                        const closeButton = findSidebarCloseButton();
                        if (!sidebarIsOpen() && openButton) {
                            openButton.click();
                        } else if (sidebarIsOpen() && closeButton) {
                            closeButton.click();
                        } else if (openButton) {
                            openButton.click();
                        }
                    });
                    doc.body.appendChild(button);
                }
                return button;
            }

            function updateLauncherVisibility() {
                const button = ensureLauncher();
                if (win.innerWidth <= 768) {
                    button.style.display = 'inline-flex';
                } else {
                    button.style.display = 'none';
                }
            }

            updateLauncherVisibility();
            win.addEventListener('resize', updateLauncherVisibility);

            if (!win.__wittiMobileSettingsLauncherObserver) {
                win.__wittiMobileSettingsLauncherObserver = new MutationObserver(updateLauncherVisibility);
                win.__wittiMobileSettingsLauncherObserver.observe(doc.body, { childList: true, subtree: true, attributes: true });
            }
            [200, 700, 1500, 3000].forEach((delay) => setTimeout(updateLauncherVisibility, delay));
        })();
        </script>
        """,
        height=0,
        width=0,
    )


def apply_multiselect_korean_labels():
    """Streamlit/BaseWeb의 기본 영문 복수 선택 문구를 한국어로 보정합니다.

    위젯별 placeholder도 함께 지정하지만, 브라우저·Streamlit 버전에 따라
    기본 문구가 다시 나타나는 경우를 대비해 문서 레벨에서 한 번 더 바꿉니다.
    """
    components.html(
        """
        <script>
        (function () {
            const win = window.parent;
            const doc = win.document;

            function translateMultiselectLabels() {
                doc.querySelectorAll('input[placeholder="Choose options"]').forEach((input) => {
                    input.setAttribute('placeholder', '선택해 주세요.');
                });

                const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
                const nodes = [];
                let node;
                while ((node = walker.nextNode())) nodes.push(node);

                nodes.forEach((textNode) => {
                    const value = textNode.nodeValue || '';
                    const trimmed = value.trim();
                    if (trimmed === 'Choose options') {
                        textNode.nodeValue = value.replace('Choose options', '선택해 주세요.');
                    } else if (trimmed === 'Select all') {
                        textNode.nodeValue = value.replace('Select all', '전체 선택');
                    }
                });
            }

            translateMultiselectLabels();
            if (!win.__wittiMultiselectKoreanObserver) {
                win.__wittiMultiselectKoreanObserver = new MutationObserver(translateMultiselectLabels);
                win.__wittiMultiselectKoreanObserver.observe(doc.body, {
                    childList: true,
                    subtree: true,
                    characterData: true,
                    attributes: true,
                    attributeFilter: ['placeholder']
                });
            }
            [150, 500, 1200, 2500].forEach((delay) => setTimeout(translateMultiselectLabels, delay));
        })();
        </script>
        """,
        height=0,
        width=0,
    )


def force_sidebar_collapsed_on_first_load():
    """
    페이지가 처음 열릴 때 사이드바가 보이면 자동으로 접습니다.
    Streamlit이 브라우저에 이전 사이드바 열림 상태를 기억할 수 있어 공식 collapsed 옵션을 보완합니다.
    사용자가 이후 직접 다시 열었을 때는 계속 강제로 닫지 않도록 초기 몇 초 동안만 작동합니다.
    """
    components.html(
        """
        <script>
        (function () {
            const win = window.parent;
            const doc = win.document;

            if (win.__wittiSidebarDefaultCollapseStarted) {
                return;
            }
            win.__wittiSidebarDefaultCollapseStarted = true;

            function isVisible(el) {
                if (!el) return false;
                const rect = el.getBoundingClientRect();
                const style = win.getComputedStyle(el);
                return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
            }

            function getSidebar() {
                return doc.querySelector([
                    'section[data-testid="stSidebar"]',
                    'aside[data-testid="stSidebar"]',
                    'div[data-testid="stSidebar"]'
                ].join(','));
            }

            function getOpenSidebarButton() {
                return Array.from(doc.querySelectorAll([
                    'div[data-testid="stSidebarCollapsedControl"] button',
                    'div[data-testid="collapsedControl"] button',
                    'button[aria-label*="Open sidebar"]',
                    'button[title*="Open sidebar"]'
                ].join(','))).find(isVisible) || null;
            }

            function sidebarIsCollapsed() {
                if (getOpenSidebarButton()) return true;
                const sidebar = getSidebar();
                if (!sidebar) return false;
                const rect = sidebar.getBoundingClientRect();
                const style = win.getComputedStyle(sidebar);
                return rect.width < 90 || rect.right < 90 || style.display === 'none' || style.visibility === 'hidden';
            }

            function findCollapseButton() {
                const selectors = [
                    'button[data-testid="stSidebarCollapseButton"]',
                    'button[aria-label*="Close sidebar"]',
                    'button[title*="Close sidebar"]',
                    'button[aria-label*="Collapse sidebar"]',
                    'button[title*="Collapse sidebar"]',
                    'button[aria-label*="close sidebar"]',
                    'button[title*="close sidebar"]',
                    'button[aria-label*="collapse sidebar"]',
                    'button[title*="collapse sidebar"]'
                ];

                for (const selector of selectors) {
                    const button = Array.from(doc.querySelectorAll(selector)).find(isVisible);
                    if (button) return button;
                }

                const sidebar = getSidebar();
                if (!sidebar || !isVisible(sidebar)) return null;
                const sidebarRect = sidebar.getBoundingClientRect();

                const buttons = Array.from(sidebar.querySelectorAll('button')).filter(isVisible);
                if (!buttons.length) return null;

                const textMatch = buttons.find((button) => {
                    const text = `${button.innerText || ''} ${button.textContent || ''} ${button.getAttribute('aria-label') || ''} ${button.getAttribute('title') || ''}`;
                    return text.includes('«') || text.includes('‹') || text.includes('<<') || text.toLowerCase().includes('close') || text.toLowerCase().includes('collapse');
                });
                if (textMatch) return textMatch;

                // 접기 버튼은 보통 사이드바 오른쪽 위에 있으므로, 그 위치에 가장 가까운 작은 버튼을 고릅니다.
                const upperSmallButtons = buttons
                    .map((button) => ({ button, rect: button.getBoundingClientRect() }))
                    .filter(({ rect }) => rect.top < 120 && rect.width <= 80 && rect.height <= 80)
                    .sort((a, b) => Math.abs(a.rect.right - sidebarRect.right) - Math.abs(b.rect.right - sidebarRect.right));
                return upperSmallButtons[0]?.button || null;
            }

            let attempts = 0;
            const maxAttempts = 70;

            function collapseIfNeeded() {
                attempts += 1;
                if (sidebarIsCollapsed()) {
                    clearInterval(timer);
                    return;
                }

                const sidebar = getSidebar();
                const sidebarWidth = sidebar ? sidebar.getBoundingClientRect().width : 0;
                const button = findCollapseButton();

                if (button && sidebarWidth > 120) {
                    button.click();
                    setTimeout(() => {
                        if (sidebarIsCollapsed()) clearInterval(timer);
                    }, 250);
                    return;
                }

                if (attempts >= maxAttempts) {
                    clearInterval(timer);
                }
            }

            const timer = setInterval(collapseIfNeeded, 100);
            [50, 150, 300, 600, 1000, 1800, 3000, 5000].forEach((delay) => setTimeout(collapseIfNeeded, delay));
        })();
        </script>
        """,
        height=0,
        width=0,
    )


def render_result_card(text: str, css_class: str = "result-card-blue"):
    st.markdown(
        f"<div class='{css_class}'>{text_to_html_with_links(text)}</div>",
        unsafe_allow_html=True,
    )


def _response_data(response):
    return getattr(response, "data", []) or []


# =========================
# 공지사항 · 방문 팝업 공통 기능
# =========================
PLATFORM_NOTICE_TABLE = "platform_notices"
PLATFORM_POPUP_TABLE = "platform_popups"
KST = ZoneInfo("Asia/Seoul")


# 방문 팝업 이미지 자산은 영유아 놀이 사진과 분리된 전용 비공개 Storage 버킷에 보관합니다.
# 방문자 화면에는 서버가 발급한 짧은 시간의 signed URL만 전달합니다.
POPUP_IMAGE_BUCKET = "platform-popup-images"
POPUP_IMAGE_SIGNED_URL_TTL_SECONDS = 60 * 60
MAX_POPUP_IMAGE_BYTES = 10 * 1024 * 1024
POPUP_POSITION_OPTIONS = {
    "상단 왼쪽": "top-left",
    "상단 가운데": "top-center",
    "상단 오른쪽": "top-right",
    "중앙 왼쪽": "middle-left",
    "정중앙": "center",
    "중앙 오른쪽": "middle-right",
    "하단 왼쪽": "bottom-left",
    "하단 가운데": "bottom-center",
    "하단 오른쪽": "bottom-right",
}
POPUP_POSITION_LABELS = {value: label for label, value in POPUP_POSITION_OPTIONS.items()}


def _normalize_popup_position(value: str | None) -> str:
    value = str(value or "").strip()
    return value if value in POPUP_POSITION_LABELS else "center"


def _validate_popup_link_url(value: str | None) -> tuple[bool, str]:
    """팝업 링크는 외부 이동이 가능한 http/https 주소만 저장합니다.

    복사·붙여넣기 과정에서 함께 들어오는 공백·제로폭 문자·HTML 엔티티를 정리해
    저장값과 실제 클릭 주소가 달라지는 문제를 예방합니다.
    """
    url = html.unescape(str(value or ""))
    url = url.replace("\u200b", "").replace("\ufeff", "").strip()
    if not url:
        return True, ""
    if any(ch.isspace() for ch in url):
        return False, "링크 주소에는 줄바꿈이나 공백을 넣을 수 없습니다. 주소만 다시 붙여넣어 주세요."
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return False, "링크 주소는 https:// 또는 http://로 시작하는 완전한 주소로 입력해 주세요."
    return True, url


def _popup_image_extension(mime_type: str) -> str:
    return {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
    }.get(str(mime_type or "").lower(), ".jpg")


def _make_popup_image_storage_path(mime_type: str, now_utc: datetime | None = None) -> str:
    now_utc = now_utc or datetime.now(timezone.utc)
    return (
        f"popups/{now_utc.strftime('%Y')}/{now_utc.strftime('%m')}/"
        f"{uuid.uuid4().hex}{_popup_image_extension(mime_type)}"
    )


def _get_popup_image_bytes_and_mime(uploaded_file) -> tuple[bytes, str]:
    if uploaded_file is None:
        raise ValueError("팝업 이미지를 선택해 주세요.")
    image_bytes = uploaded_file.getvalue()
    if len(image_bytes) > MAX_POPUP_IMAGE_BYTES:
        raise ValueError(f"'{uploaded_file.name}' 파일이 10MB를 초과합니다.")

    mime_type = str(getattr(uploaded_file, "type", "") or "").lower()
    allowed_types = {"image/jpeg", "image/png", "image/webp"}
    if mime_type not in allowed_types:
        suffix = Path(str(getattr(uploaded_file, "name", ""))).suffix.lower()
        mime_type = {
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
            ".webp": "image/webp",
        }.get(suffix, "")
    if mime_type not in allowed_types:
        raise ValueError("팝업 이미지는 JPG, PNG, WEBP 형식만 업로드할 수 있습니다.")
    return image_bytes, mime_type


def upload_platform_popup_image(uploaded_file) -> dict:
    """관리자가 선택한 팝업 이미지를 전용 Private Storage에 업로드합니다.

    DB 저장이 실패하면 호출부에서 이 새 파일을 다시 지울 수 있도록 경로와 메타데이터를 반환합니다.
    """
    image_bytes, mime_type = _get_popup_image_bytes_and_mime(uploaded_file)
    file_path = _make_popup_image_storage_path(mime_type)
    supabase.storage.from_(POPUP_IMAGE_BUCKET).upload(
        file_path,
        image_bytes,
        file_options={"content-type": mime_type, "upsert": "false"},
    )
    return {
        "image_bucket": POPUP_IMAGE_BUCKET,
        "image_path": file_path,
        "image_original_file_name": str(getattr(uploaded_file, "name", "") or "popup-image"),
        "image_mime_type": mime_type,
        "image_size_bytes": len(image_bytes),
    }


def delete_platform_popup_image_by_values(bucket_name: str | None, image_path: str | None):
    """팝업 레코드가 지워질 때 연결된 Storage 이미지도 함께 정리합니다."""
    path = str(image_path or "").strip()
    if not path:
        return
    try:
        supabase.storage.from_(str(bucket_name or POPUP_IMAGE_BUCKET)).remove([path])
    except Exception:
        # 삭제 실패가 DB 관리 화면 전체를 멈추게 하지 않습니다.
        pass


def create_platform_popup_signed_url(popup: dict) -> str:
    """방문자 화면의 팝업 이미지에 사용할 제한 시간 signed URL을 만듭니다."""
    if not isinstance(popup, dict):
        return ""
    path = str(popup.get("image_path") or "").strip()
    if not path:
        return ""
    try:
        response = supabase.storage.from_(str(popup.get("image_bucket") or POPUP_IMAGE_BUCKET)).create_signed_url(
            path,
            POPUP_IMAGE_SIGNED_URL_TTL_SECONDS,
        )
        if isinstance(response, dict):
            return str(response.get("signedURL") or response.get("signedUrl") or response.get("signed_url") or "")
        return str(
            getattr(response, "signedURL", "")
            or getattr(response, "signedUrl", "")
            or getattr(response, "signed_url", "")
            or ""
        )
    except Exception:
        return ""


def _as_bool(value, default: bool = False) -> bool:
    if isinstance(value, bool):
        return value
    if value is None:
        return default
    return str(value).strip().lower() in {"true", "1", "yes", "y", "on"}


def _parse_utc_datetime(value):
    if value in (None, ""):
        return None
    parsed = pd.to_datetime(value, utc=True, errors="coerce")
    if pd.isna(parsed):
        return None
    return parsed.to_pydatetime()


def _to_kst_date_time(value):
    """DB timestamptz 값을 Streamlit 입력값(날짜·시간)으로 바꿉니다."""
    parsed = _parse_utc_datetime(value)
    if parsed is None:
        now_kst = datetime.now(KST)
        return now_kst.date(), now_kst.time().replace(second=0, microsecond=0, tzinfo=None)
    converted = parsed.astimezone(KST)
    return converted.date(), converted.time().replace(second=0, microsecond=0, tzinfo=None)


def _schedule_to_utc_iso(date_value, time_value) -> str:
    """관리자 입력(한국 시간)을 Supabase timestamptz용 UTC ISO 문자열로 변환합니다."""
    local_dt = datetime.combine(date_value, time_value).replace(tzinfo=KST)
    return local_dt.astimezone(timezone.utc).isoformat()


def _is_currently_visible(record: dict) -> bool:
    """게시 여부와 표시 기간을 함께 점검합니다."""
    if not record or _as_bool(record.get("deleted")):
        return False
    if not _as_bool(record.get("is_active")):
        return False

    now = datetime.now(timezone.utc)
    start_at = _parse_utc_datetime(record.get("display_start_at"))
    end_at = _parse_utc_datetime(record.get("display_end_at"))

    if start_at is not None and now < start_at:
        return False
    if end_at is not None and now > end_at:
        return False
    return True


def _load_platform_rows(table_name: str) -> list[dict]:
    """공지·팝업은 서버 service-role로 읽습니다. SQL 적용 전에는 화면을 멈추지 않습니다."""
    try:
        response = supabase.table(table_name).select("*").order("created_at", desc=True).execute()
        return [row for row in _response_data(response) if isinstance(row, dict)]
    except Exception:
        return []


def load_visible_notices() -> list[dict]:
    rows = [row for row in _load_platform_rows(PLATFORM_NOTICE_TABLE) if _is_currently_visible(row)]
    return sorted(
        rows,
        key=lambda row: (
            0 if _as_bool(row.get("is_pinned")) else 1,
            -(int(pd.Timestamp(_parse_utc_datetime(row.get("created_at")) or datetime.now(timezone.utc)).timestamp())),
        ),
    )


def load_visible_popups() -> list[dict]:
    rows = []
    for row in _load_platform_rows(PLATFORM_POPUP_TABLE):
        if not _is_currently_visible(row):
            continue
        audience = str(row.get("audience") or "all")
        if audience == "member" and not member_is_logged_in():
            continue
        rows.append(row)
    return sorted(
        rows,
        key=lambda row: (
            -int(row.get("priority") or 0),
            -(int(pd.Timestamp(_parse_utc_datetime(row.get("created_at")) or datetime.now(timezone.utc)).timestamp())),
        ),
    )


def _content_level_icon(level: str) -> str:
    return {"중요": "🚨", "점검": "🛠️", "일반": "📢"}.get(str(level), "📢")


def _content_level_label(level: str) -> str:
    return {"중요": "중요 공지", "점검": "점검 안내", "일반": "일반 공지"}.get(str(level), "공지")


def _format_kst_display(value) -> str:
    parsed = _parse_utc_datetime(value)
    if parsed is None:
        return ""
    return parsed.astimezone(KST).strftime("%Y.%m.%d %H:%M")


def render_active_notice_banner():
    """상단에는 고정 공지 1건만 간단히 보여 주고, 전체는 공지사항 탭에서 확인합니다."""
    notices = load_visible_notices()
    pinned = [row for row in notices if _as_bool(row.get("is_pinned"))]
    if not pinned:
        return

    notice = pinned[0]
    icon = _content_level_icon(str(notice.get("notice_level") or "일반"))
    title = str(notice.get("title") or "공지사항")
    content = str(notice.get("content") or "")
    st.info(f"{icon} **{title}**\n\n{content}")


def render_active_popup_if_needed():
    """이미지 전용 방문 팝업을 지정 위치에 표시합니다.

    방문자 화면에는 업로드한 이미지와 닫기·오늘 하루 다시 보지 않기만 표시합니다.
    제목과 본문은 관리자 식별·관리용 데이터로만 유지하며, 방문자 팝업에는 노출하지 않습니다.
    """
    popups = load_visible_popups()
    popup_payloads = []
    for popup in popups:
        copied = dict(popup)
        copied["image_signed_url"] = create_platform_popup_signed_url(copied)
        copied["popup_position"] = _normalize_popup_position(copied.get("popup_position"))
        popup_payloads.append(copied)

    safe_payload = json.dumps(popup_payloads, ensure_ascii=False).replace('</', '<\\/')
    script = r"""
        <script>
        (function () {
            const win = window.parent;
            const doc = win.document;
            const ROOT_ID = 'witti-platform-popup-root';
            const STYLE_ID = 'witti-platform-popup-style';
            const popups = __POPUP_PAYLOAD__;

            function removeCurrent() {
                const old = doc.getElementById(ROOT_ID);
                if (old) old.remove();
            }

            function safeHttpUrl(raw) {
                if (!raw) return '';
                try {
                    const url = new URL(String(raw));
                    return (url.protocol === 'https:' || url.protocol === 'http:') ? url.href : '';
                } catch (error) {
                    return '';
                }
            }

            function revisionKey(popup) {
                return String(popup.id || '') + '_' + String(popup.updated_at || popup.created_at || '');
            }

            function kstDateKey() {
                try {
                    const parts = new Intl.DateTimeFormat('en-US', {
                        timeZone: 'Asia/Seoul',
                        year: 'numeric', month: '2-digit', day: '2-digit'
                    }).formatToParts(new Date());
                    const map = {};
                    parts.forEach((part) => { map[part.type] = part.value; });
                    return String(map.year || '') + '-' + String(map.month || '') + '-' + String(map.day || '');
                } catch (error) {
                    const now = new Date();
                    const month = String(now.getMonth() + 1).padStart(2, '0');
                    const day = String(now.getDate()).padStart(2, '0');
                    return String(now.getFullYear()) + '-' + month + '-' + day;
                }
            }

            function todayKey(popup) {
                return 'witti_platform_popup_dismissed_today_' + revisionKey(popup) + '_' + kstDateKey();
            }

            function wasDismissed(popup) {
                // '오늘 하루 다시 열지 않기'에 체크한 경우에만 날짜 기준으로 숨깁니다.
                // X 버튼만 누른 경우에는 저장소에 아무 값도 남기지 않으므로,
                // 다음 새로고침·페이지 이동·재방문 시 팝업이 다시 표시됩니다.
                try {
                    return win.localStorage.getItem(todayKey(popup)) === '1';
                } catch (error) {
                    return false;
                }
            }

            function markTodayDismissed(popup) {
                try {
                    win.localStorage.setItem(todayKey(popup), '1');
                } catch (error) {
                    // 브라우저 저장소를 사용할 수 없는 환경에서는 현재 화면만 닫힙니다.
                }
            }

            function ensureStyle() {
                if (doc.getElementById(STYLE_ID)) return;
                const style = doc.createElement('style');
                style.id = STYLE_ID;
                style.textContent = `
                    #${ROOT_ID} {
                        position: fixed;
                        z-index: 2147483645;
                        width: min(460px, calc(100vw - 40px));
                        max-height: min(82vh, 760px);
                        overflow: auto;
                        background: #FFFFFF;
                        border: 1px solid #D8E5F2;
                        border-radius: 20px;
                        box-shadow: 0 20px 52px rgba(15, 23, 42, 0.24);
                        box-sizing: border-box;
                        font-family: Pretendard, SUIT, 'Noto Sans KR', 'Malgun Gothic', sans-serif;
                    }
                    #${ROOT_ID}.top-left { top: 84px; left: 22px; }
                    #${ROOT_ID}.top-center { top: 84px; left: 50%; transform: translateX(-50%); }
                    #${ROOT_ID}.top-right { top: 84px; right: 22px; }
                    #${ROOT_ID}.middle-left { top: 50%; left: 22px; transform: translateY(-50%); }
                    #${ROOT_ID}.center { top: 50%; left: 50%; transform: translate(-50%, -50%); }
                    #${ROOT_ID}.middle-right { top: 50%; right: 22px; transform: translateY(-50%); }
                    #${ROOT_ID}.bottom-left { bottom: 22px; left: 22px; }
                    #${ROOT_ID}.bottom-center { bottom: 22px; left: 50%; transform: translateX(-50%); }
                    #${ROOT_ID}.bottom-right { bottom: 22px; right: 22px; }
                    #${ROOT_ID} .witti-popup-close {
                        position: absolute;
                        top: 10px;
                        right: 10px;
                        width: 34px;
                        height: 34px;
                        border: 0;
                        border-radius: 999px;
                        background: rgba(255,255,255,0.94);
                        color: #344054;
                        font-size: 22px;
                        line-height: 1;
                        cursor: pointer;
                        box-shadow: 0 3px 10px rgba(15,23,42,0.12);
                        z-index: 3;
                    }
                    #${ROOT_ID} .witti-popup-image-link { display: block; text-decoration: none; cursor: pointer; pointer-events: auto; }
                    #${ROOT_ID} .witti-popup-image {
                        display: block;
                        width: 100%;
                        max-height: 650px;
                        object-fit: contain;
                        background: #F7FAFC;
                        border-radius: 20px 20px 0 0;
                    }
                    #${ROOT_ID} .witti-popup-dismiss-row {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        min-height: 48px;
                        padding: 11px 16px 13px;
                        color: #475467;
                        background: #FFFFFF;
                        border-top: 1px solid #EDF1F5;
                        font-size: 13px;
                        line-height: 1.35;
                        font-weight: 700;
                        cursor: pointer;
                        box-sizing: border-box;
                    }
                    #${ROOT_ID} .witti-popup-dismiss-row input {
                        width: 16px;
                        height: 16px;
                        margin: 0;
                        accent-color: #123A5A;
                        flex: 0 0 auto;
                        cursor: pointer;
                    }
                    #${ROOT_ID} .witti-popup-dismiss-row span { cursor: pointer; word-break: keep-all; }
                    @media (max-width: 768px) {
                        #${ROOT_ID},
                        #${ROOT_ID}.top-left,
                        #${ROOT_ID}.top-center,
                        #${ROOT_ID}.top-right,
                        #${ROOT_ID}.middle-left,
                        #${ROOT_ID}.center,
                        #${ROOT_ID}.middle-right,
                        #${ROOT_ID}.bottom-left,
                        #${ROOT_ID}.bottom-center,
                        #${ROOT_ID}.bottom-right {
                            width: auto;
                            max-width: none;
                            left: 12px;
                            right: 12px;
                            top: auto;
                            bottom: 12px;
                            transform: none;
                            max-height: 80vh;
                        }
                        #${ROOT_ID} .witti-popup-image { max-height: 67vh; }
                        #${ROOT_ID} .witti-popup-dismiss-row { padding: 11px 14px 13px; }
                    }
                `;
                doc.head.appendChild(style);
            }

            removeCurrent();
            if (!Array.isArray(popups) || !popups.length) return;
            const popup = popups.find((item) => item && safeHttpUrl(item.image_signed_url) && !wasDismissed(item));
            if (!popup) return;

            ensureStyle();
            const root = doc.createElement('section');
            root.id = ROOT_ID;
            root.className = String(popup.popup_position || 'center');
            root.setAttribute('role', 'dialog');
            root.setAttribute('aria-modal', 'false');
            root.setAttribute('aria-label', String(popup.title || '서비스 안내 이미지'));

            const imageUrl = safeHttpUrl(popup.image_signed_url);
            const linkUrl = safeHttpUrl(popup.link_url);
            const image = doc.createElement('img');
            image.className = 'witti-popup-image';
            image.src = imageUrl;
            image.alt = String(popup.image_alt_text || popup.title || '팝업 안내 이미지');
            if (linkUrl) {
                const imageLink = doc.createElement('a');
                imageLink.className = 'witti-popup-image-link';
                imageLink.href = linkUrl;
                imageLink.target = '_blank';
                imageLink.rel = 'noopener noreferrer';
                imageLink.setAttribute('aria-label', '팝업 이미지 링크 열기');
                imageLink.setAttribute('title', '이미지를 클릭하면 연결된 페이지가 열립니다.');
                // 링크는 JavaScript로 가로채지 않고 브라우저의 기본 <a> 동작을 사용합니다.
                // 이렇게 해야 모바일·인앱 브라우저에서도 사용자 클릭으로 인식되어
                // 새 창 또는 해당 브라우저의 링크 화면으로 안정적으로 이동합니다.
                imageLink.addEventListener('click', function (event) {
                    if (!safeHttpUrl(linkUrl)) {
                        event.preventDefault();
                    }
                });
                imageLink.appendChild(image);
                root.appendChild(imageLink);
            } else {
                root.appendChild(image);
            }

            const dismissRow = doc.createElement('label');
            dismissRow.className = 'witti-popup-dismiss-row';
            const dismissCheckbox = doc.createElement('input');
            dismissCheckbox.type = 'checkbox';
            dismissCheckbox.setAttribute('aria-label', '오늘 하루 이 창을 다시 열지 않습니다.');
            const dismissText = doc.createElement('span');
            dismissText.textContent = '오늘 하루 이 창을 다시 열지 않습니다.';
            dismissRow.appendChild(dismissCheckbox);
            dismissRow.appendChild(dismissText);
            root.appendChild(dismissRow);

            const closeButton = doc.createElement('button');
            closeButton.type = 'button';
            closeButton.className = 'witti-popup-close';
            closeButton.setAttribute('aria-label', '팝업 닫기');
            closeButton.textContent = '×';
            closeButton.addEventListener('click', function () {
                // X는 현재 보이는 팝업만 닫습니다.
                // 체크박스를 선택했을 때에만 한국 시간 기준 오늘 하루 동안 다시 표시하지 않습니다.
                if (dismissCheckbox.checked) {
                    markTodayDismissed(popup);
                }
                root.remove();
            });
            root.appendChild(closeButton);

            doc.body.appendChild(root);
        })();
        </script>
    """
    components.html(
        script.replace("__POPUP_PAYLOAD__", safe_payload),
        height=0,
        width=0,
    )


def render_public_notice_page():
    render_menu_card(
        "📢 공지사항",
        "서비스 이용 전 알아두면 좋은 안내와 운영 소식을 확인할 수 있습니다.",
        ["운영 안내", "점검 안내", "중요 공지"]
    )
    notices = load_visible_notices()
    if not notices:
        st.caption("현재 게시 중인 공지사항이 없습니다.")
        return

    for index, notice in enumerate(notices):
        level = str(notice.get("notice_level") or "일반")
        icon = _content_level_icon(level)
        title = str(notice.get("title") or "공지사항")
        created_at = _format_kst_display(notice.get("published_at") or notice.get("created_at"))
        pin_mark = "📌 " if _as_bool(notice.get("is_pinned")) else ""
        with st.expander(f"{pin_mark}{icon} {title}", expanded=(index == 0 and _as_bool(notice.get("is_pinned")))):
            if created_at:
                st.caption(f"{_content_level_label(level)} · {created_at}")
            st.write(str(notice.get("content") or ""))


def _save_platform_content(table_name: str, record_id, payload: dict):
    """공지·팝업 신규 작성과 기존 편집을 공통 처리합니다."""
    if record_id:
        response = supabase.table(table_name).update(payload).eq("id", int(record_id)).execute()
    else:
        response = supabase.table(table_name).insert(payload).execute()
    rows = _response_data(response)
    return rows[0] if rows else payload


def _admin_content_display_df(rows: list[dict], content_type: str) -> pd.DataFrame:
    df = pd.DataFrame(rows)
    if df.empty:
        return df
    if content_type == "notice":
        rename_map = {
            "id": "번호", "title": "제목", "notice_level": "구분", "is_pinned": "상단 고정",
            "is_active": "게시", "display_start_at": "게시 시작", "display_end_at": "게시 종료",
            "published_at": "게시일", "updated_at": "수정일", "deleted": "숨김 여부",
        }
        columns = ["id", "title", "notice_level", "is_pinned", "is_active", "display_start_at", "display_end_at", "published_at", "updated_at", "deleted"]
    else:
        rename_map = {
            "id": "번호", "title": "제목", "popup_level": "구분", "audience": "표시 대상",
            "popup_position": "표시 위치", "image_path": "이미지", "link_url": "연결 링크",
            "priority": "우선순위", "is_active": "표시", "display_start_at": "표시 시작",
            "display_end_at": "표시 종료", "updated_at": "수정일", "deleted": "숨김 여부",
        }
        columns = ["id", "title", "popup_level", "audience", "popup_position", "image_path", "link_url", "priority", "is_active", "display_start_at", "display_end_at", "updated_at", "deleted"]
    columns = [column for column in columns if column in df.columns]
    displayed = df[columns].copy()
    for column in ["display_start_at", "display_end_at", "published_at", "updated_at"]:
        if column in displayed.columns:
            displayed[column] = displayed[column].apply(_format_kst_display)
    return displayed.rename(columns=rename_map)


def _render_schedule_inputs(prefix: str, existing: dict) -> tuple[bool, str | None, str | None]:
    existing_start = existing.get("display_start_at") if existing else None
    existing_end = existing.get("display_end_at") if existing else None
    has_schedule_default = bool(existing_start or existing_end)
    use_schedule = st.checkbox("게시·표시 기간을 설정합니다.", value=has_schedule_default, key=f"{prefix}_use_schedule")
    if not use_schedule:
        return False, None, None

    start_date, start_time = _to_kst_date_time(existing_start)
    end_date, end_time = _to_kst_date_time(existing_end)
    if not existing_end:
        end_date = start_date + timedelta(days=7)

    st.caption("입력 시간은 한국 시간(KST) 기준입니다.")
    start_col1, start_col2 = st.columns(2)
    with start_col1:
        selected_start_date = st.date_input("시작 날짜", value=start_date, key=f"{prefix}_start_date")
    with start_col2:
        selected_start_time = st.time_input("시작 시간", value=start_time, key=f"{prefix}_start_time")
    end_col1, end_col2 = st.columns(2)
    with end_col1:
        selected_end_date = st.date_input("종료 날짜", value=end_date, key=f"{prefix}_end_date")
    with end_col2:
        selected_end_time = st.time_input("종료 시간", value=end_time, key=f"{prefix}_end_time")

    start_iso = _schedule_to_utc_iso(selected_start_date, selected_start_time)
    end_iso = _schedule_to_utc_iso(selected_end_date, selected_end_time)
    if _parse_utc_datetime(end_iso) < _parse_utc_datetime(start_iso):
        st.warning("종료 시점은 시작 시점보다 빠를 수 없습니다.")
        return True, "INVALID", "INVALID"
    return True, start_iso, end_iso


def render_admin_notice_manager():
    st.markdown("### 📢 공지사항 관리")
    st.caption("공지사항은 공지 탭에서 보이며, 상단 고정 공지는 첫 화면에도 간단히 표시됩니다.")
    rows = _load_platform_rows(PLATFORM_NOTICE_TABLE)
    options = {"새 공지 작성": None}
    for row in rows:
        label = f"#{row.get('id')} · {str(row.get('title') or '제목 없음')[:60]}"
        if _as_bool(row.get("deleted")):
            label += " [숨김]"
        options[label] = row

    selected_label = st.selectbox("작성·편집할 공지", list(options.keys()), key="notice_editor_select")
    existing = options[selected_label] or {}
    record_id = existing.get("id")
    token = f"notice_{record_id or 'new'}"

    with st.form(f"notice_editor_form_{token}"):
        title = st.text_input("공지 제목", value=str(existing.get("title") or ""), max_chars=120, key=f"{token}_title")
        content = st.text_area("공지 내용", value=str(existing.get("content") or ""), height=220, max_chars=5000, key=f"{token}_content")
        form_col1, form_col2 = st.columns(2)
        with form_col1:
            notice_level = st.selectbox(
                "공지 구분", ["일반", "중요", "점검"],
                index=["일반", "중요", "점검"].index(str(existing.get("notice_level") or "일반")) if str(existing.get("notice_level") or "일반") in ["일반", "중요", "점검"] else 0,
                key=f"{token}_level",
            )
            is_pinned = st.checkbox("첫 화면 상단에 고정 표시", value=_as_bool(existing.get("is_pinned")), key=f"{token}_pinned")
        with form_col2:
            is_active = st.checkbox("바로 게시", value=_as_bool(existing.get("is_active"), True), key=f"{token}_active")
            if existing.get("updated_at"):
                st.caption(f"최근 수정: {_format_kst_display(existing.get('updated_at'))}")
        _, start_at, end_at = _render_schedule_inputs(token, existing)
        submitted = st.form_submit_button("공지사항 저장", use_container_width=True)

    if submitted:
        if not title.strip() or not content.strip():
            st.warning("공지 제목과 내용을 모두 입력해 주세요.")
        elif start_at == "INVALID":
            st.warning("게시 기간을 다시 확인해 주세요.")
        else:
            payload = {
                "title": title.strip(), "content": content.strip(), "notice_level": notice_level,
                "is_pinned": is_pinned, "is_active": is_active,
                "display_start_at": start_at, "display_end_at": end_at,
            }
            if not record_id:
                payload["created_by"] = "admin"
                if is_active:
                    payload["published_at"] = _utc_now_iso()
            elif is_active and not existing.get("published_at"):
                payload["published_at"] = _utc_now_iso()
            try:
                _save_platform_content(PLATFORM_NOTICE_TABLE, record_id, payload)
                st.success("공지사항을 저장했습니다.")
                st.rerun()
            except Exception as exc:
                st.error("공지사항을 저장하지 못했습니다. 먼저 공지·팝업 SQL을 실행했는지 확인해 주세요.")
                st.caption(str(exc))

    st.divider()
    st.markdown("#### 게시·보관 목록")
    if not rows:
        st.caption("작성된 공지사항이 없습니다.")
    else:
        st.dataframe(_admin_content_display_df(rows, "notice"), use_container_width=True, hide_index=True, height=300)
        active_rows = [row for row in rows if not _as_bool(row.get("deleted"))]
        hidden_rows = [row for row in rows if _as_bool(row.get("deleted"))]
        manage_col1, manage_col2 = st.columns(2)
        with manage_col1:
            hide_options = {f"#{row['id']} · {row.get('title')}": row.get("id") for row in active_rows}
            selected_hide = st.selectbox("숨김 처리할 공지", ["선택해 주세요."] + list(hide_options.keys()), key="notice_hide_select")
            if st.button("선택 공지 숨김 처리", key="notice_soft_delete", disabled=selected_hide == "선택해 주세요."):
                soft_delete_record(PLATFORM_NOTICE_TABLE, hide_options[selected_hide])
                st.success("공지사항을 숨김 처리했습니다.")
                st.rerun()
        with manage_col2:
            restore_options = {f"#{row['id']} · {row.get('title')}": row.get("id") for row in hidden_rows}
            selected_restore = st.selectbox("복구할 숨김 공지", ["선택해 주세요."] + list(restore_options.keys()), key="notice_restore_select")
            if st.button("선택 공지 복구", key="notice_restore", disabled=selected_restore == "선택해 주세요."):
                restore_record(PLATFORM_NOTICE_TABLE, restore_options[selected_restore])
                st.success("공지사항을 다시 게시 목록으로 복구했습니다.")
                st.rerun()


def render_admin_popup_manager():
    """이미지 전용 방문 팝업을 작성·수정·게시하는 관리자 화면입니다."""
    st.markdown("### 🪟 방문 팝업 관리")
    st.caption("방문자 화면에는 업로드한 이미지와 닫기·‘오늘 하루 다시 열지 않기’만 표시됩니다. 제목과 메모는 관리자 관리용이며 방문자에게 노출되지 않습니다.")

    rows = _load_platform_rows(PLATFORM_POPUP_TABLE)
    options = {"새 이미지 팝업 작성": None}
    for row in rows:
        label = f"#{row.get('id')} · {str(row.get('title') or '제목 없음')[:60]}"
        if _as_bool(row.get("deleted")):
            label += " [숨김]"
        options[label] = row

    # 저장 직후에는 방금 편집한 팝업을 다시 불러와 링크·이미지를 바로 확인할 수 있게 합니다.
    pending_popup_select = st.session_state.pop("_popup_editor_select_after_save", None)
    if pending_popup_select in options:
        st.session_state["popup_editor_select"] = pending_popup_select

    selected_label = st.selectbox("작성·편집할 팝업", list(options.keys()), key="popup_editor_select")
    existing = options[selected_label] or {}
    record_id = existing.get("id")
    # 기존 링크는 편집 화면의 위젯 상태가 비어 있더라도 보존합니다.
    # 삭제는 아래의 전용 체크박스를 선택했을 때만 허용합니다.
    existing_link_url = str(existing.get("link_url") or "").strip()
    token = f"popup_{record_id or 'new'}"
    existing_position = _normalize_popup_position(existing.get("popup_position"))
    position_labels = list(POPUP_POSITION_OPTIONS.keys())
    position_index = position_labels.index(POPUP_POSITION_LABELS.get(existing_position, "정중앙"))
    existing_image_url = create_platform_popup_signed_url(existing) if existing.get("image_path") else ""

    if existing_image_url:
        st.markdown("#### 현재 등록 이미지")
        preview_col1, preview_col2 = st.columns([1, 1])
        with preview_col1:
            st.image(existing_image_url, caption=str(existing.get("image_original_file_name") or "팝업 이미지"), use_container_width=True)
        with preview_col2:
            st.caption(f"표시 위치: {POPUP_POSITION_LABELS.get(existing_position, '정중앙')}")
            if existing.get("link_url"):
                st.caption("방문자가 이미지를 클릭하면 아래 링크가 새 창으로 열립니다.")
                st.code(str(existing.get("link_url")), language=None)
            else:
                st.caption("연결 링크가 없으면 이미지는 안내용으로만 표시됩니다.")

    with st.form(f"popup_editor_form_{token}"):
        title = st.text_input(
            "관리용 팝업 제목",
            value=str(existing.get("title") or ""),
            max_chars=120,
            key=f"{token}_title",
            help="방문자 화면에는 표시되지 않습니다. 관리자 목록에서 팝업을 구분하기 위한 제목입니다.",
        )
        form_col1, form_col2, form_col3 = st.columns(3)
        with form_col1:
            popup_level = st.selectbox(
                "관리 구분", ["일반", "중요", "점검"],
                index=["일반", "중요", "점검"].index(str(existing.get("popup_level") or "일반")) if str(existing.get("popup_level") or "일반") in ["일반", "중요", "점검"] else 0,
                key=f"{token}_level",
            )
        with form_col2:
            audience_label = st.selectbox(
                "표시 대상", ["모든 방문자", "로그인 회원만"],
                index=1 if str(existing.get("audience") or "all") == "member" else 0,
                key=f"{token}_audience",
            )
        with form_col3:
            priority = st.number_input("우선순위", min_value=0, max_value=1000, value=int(existing.get("priority") or 0), step=1, key=f"{token}_priority")
            is_active = st.checkbox("바로 표시", value=_as_bool(existing.get("is_active"), True), key=f"{token}_active")

        st.markdown("#### 팝업 이미지와 연결 링크")
        st.caption("팝업은 이미지 전용으로 표시됩니다. 새 팝업은 이미지를 반드시 등록해야 합니다.")
        popup_image = st.file_uploader(
            "팝업 이미지 업로드",
            type=["jpg", "jpeg", "png", "webp"],
            accept_multiple_files=False,
            key=f"{token}_image_upload",
            help="권장: 가로 800~1200px, JPG·PNG·WEBP, 10MB 이하",
        )
        remove_existing_image = st.checkbox(
            "현재 등록된 팝업 이미지를 삭제합니다.",
            value=False,
            disabled=not bool(existing.get("image_path")),
            key=f"{token}_remove_image",
        )
        image_alt_text = st.text_input(
            "이미지 대체 설명 (선택)",
            value=str(existing.get("image_alt_text") or ""),
            max_chars=200,
            key=f"{token}_image_alt",
            help="이미지가 보이지 않을 때 사용되는 짧은 설명입니다.",
        )
        link_url = st.text_input(
            "이미지 클릭 연결 링크 (선택)",
            value=existing_link_url,
            max_chars=1000,
            key=f"{token}_link_url",
            placeholder="https://witti.kr/...",
            help="입력하면 방문자가 팝업 이미지를 클릭했을 때 연결된 페이지가 열립니다. 링크를 지우려면 아래 체크박스를 사용해 주세요.",
        )
        remove_existing_link = st.checkbox(
            "현재 연결 링크를 삭제합니다.",
            value=False,
            disabled=not bool(existing_link_url),
            key=f"{token}_remove_link",
        )
        popup_position_label = st.selectbox(
            "팝업 표시 위치",
            position_labels,
            index=position_index,
            key=f"{token}_position",
            help="모바일에서는 화면을 가리지 않도록 하단 중앙 형태로 자동 조정됩니다.",
        )
        _, start_at, end_at = _render_schedule_inputs(token, existing)
        submitted = st.form_submit_button("팝업 저장", use_container_width=True)

    if submitted:
        # 기존 링크가 있는 편집 화면에서 위젯값이 빈 값으로 돌아가도 링크가 사라지지 않도록 합니다.
        # 실제 삭제는 '현재 연결 링크를 삭제합니다'를 체크했을 때만 수행합니다.
        if remove_existing_link:
            effective_link_url = ""
        elif str(link_url or "").strip():
            effective_link_url = str(link_url or "").strip()
        else:
            effective_link_url = existing_link_url

        valid_link, normalized_link_or_message = _validate_popup_link_url(effective_link_url)
        has_existing_image = bool(existing.get("image_path"))
        will_have_image = bool(popup_image is not None or (has_existing_image and not remove_existing_image))
        if not title.strip():
            st.warning("관리용 팝업 제목을 입력해 주세요.")
        elif not will_have_image:
            st.warning("이미지 전용 팝업은 팝업 이미지를 반드시 등록해야 합니다.")
        elif not valid_link:
            st.warning(normalized_link_or_message)
        elif start_at == "INVALID":
            st.warning("표시 기간을 다시 확인해 주세요.")
        else:
            uploaded_image_meta = None
            old_bucket = str(existing.get("image_bucket") or POPUP_IMAGE_BUCKET)
            old_path = str(existing.get("image_path") or "")
            try:
                if popup_image is not None:
                    uploaded_image_meta = upload_platform_popup_image(popup_image)
                internal_content = str(existing.get("content") or "이미지형 팝업").strip() or "이미지형 팝업"
                payload = {
                    "title": title.strip(),
                    "content": internal_content,
                    "popup_level": popup_level,
                    "audience": "member" if audience_label == "로그인 회원만" else "all",
                    "priority": int(priority),
                    "is_active": is_active,
                    "display_start_at": start_at,
                    "display_end_at": end_at,
                    "popup_position": POPUP_POSITION_OPTIONS[popup_position_label],
                    "link_url": normalized_link_or_message,
                    "link_label": "이미지 열기",
                    "image_alt_text": image_alt_text.strip(),
                }
                if uploaded_image_meta:
                    payload.update(uploaded_image_meta)
                elif remove_existing_image:
                    payload.update({
                        "image_bucket": None,
                        "image_path": None,
                        "image_original_file_name": None,
                        "image_mime_type": None,
                        "image_size_bytes": None,
                    })
                if not record_id:
                    payload["created_by"] = "admin"

                saved_popup = _save_platform_content(PLATFORM_POPUP_TABLE, record_id, payload)
                saved_popup_id = saved_popup.get("id") if isinstance(saved_popup, dict) else record_id

                # 저장 직후 DB 값을 다시 읽어 링크 보존 여부를 확인합니다.
                # 일부 이전 코드·브라우저 위젯 상태가 빈 값을 넘기며 링크를 지우는 문제를 이중으로 막습니다.
                if saved_popup_id:
                    verified_rows = _response_data(
                        supabase.table(PLATFORM_POPUP_TABLE)
                        .select("id, link_url")
                        .eq("id", int(saved_popup_id))
                        .limit(1)
                        .execute()
                    )
                    if verified_rows:
                        saved_link_url = str(verified_rows[0].get("link_url") or "").strip()
                        if saved_link_url != normalized_link_or_message:
                            supabase.table(PLATFORM_POPUP_TABLE).update(
                                {"link_url": normalized_link_or_message}
                            ).eq("id", int(saved_popup_id)).execute()

                    # 저장 뒤에도 같은 팝업을 계속 편집할 수 있도록, 다음 렌더링에서 선택할 항목을 예약합니다.
                    st.session_state["_popup_editor_select_after_save"] = f"#{saved_popup_id} · {title.strip()[:60]}"

                if old_path and (uploaded_image_meta or remove_existing_image):
                    delete_platform_popup_image_by_values(old_bucket, old_path)
                st.session_state.pop("dismissed_platform_popup_ids", None)
                st.success("이미지 전용 방문 팝업을 저장했습니다. 연결 링크도 함께 저장되었습니다." if normalized_link_or_message else "이미지 전용 방문 팝업을 저장했습니다.")
                st.rerun()
            except Exception as exc:
                if uploaded_image_meta:
                    delete_platform_popup_image_by_values(uploaded_image_meta.get("image_bucket"), uploaded_image_meta.get("image_path"))
                st.error("팝업을 저장하지 못했습니다. 이미지형 팝업 확장 SQL과 Storage 버킷 설정을 확인해 주세요.")
                st.caption(str(exc))

    st.divider()
    st.markdown("#### 표시·보관 목록")
    if not rows:
        st.caption("작성된 팝업이 없습니다.")
    else:
        st.dataframe(_admin_content_display_df(rows, "popup"), use_container_width=True, hide_index=True, height=300)
        active_rows = [row for row in rows if not _as_bool(row.get("deleted"))]
        hidden_rows = [row for row in rows if _as_bool(row.get("deleted"))]
        manage_col1, manage_col2 = st.columns(2)
        with manage_col1:
            hide_options = {f"#{row['id']} · {row.get('title')}": row.get("id") for row in active_rows}
            selected_hide = st.selectbox("숨김 처리할 팝업", ["선택해 주세요."] + list(hide_options.keys()), key="popup_hide_select")
            if st.button("선택 팝업 숨김 처리", key="popup_soft_delete", disabled=selected_hide == "선택해 주세요."):
                soft_delete_record(PLATFORM_POPUP_TABLE, hide_options[selected_hide])
                st.session_state.pop("dismissed_platform_popup_ids", None)
                st.success("팝업을 숨김 처리했습니다.")
                st.rerun()
        with manage_col2:
            restore_options = {f"#{row['id']} · {row.get('title')}": row.get("id") for row in hidden_rows}
            selected_restore = st.selectbox("복구할 숨김 팝업", ["선택해 주세요."] + list(restore_options.keys()), key="popup_restore_select")
            if st.button("선택 팝업 복구", key="popup_restore", disabled=selected_restore == "선택해 주세요."):
                restore_record(PLATFORM_POPUP_TABLE, restore_options[selected_restore])
                st.session_state.pop("dismissed_platform_popup_ids", None)
                st.success("팝업을 다시 표시 목록으로 복구했습니다.")
                st.rerun()


def save_subscriber(data):
    """소통 탭에서 입력받은 회원·기관 정보를 Supabase public profile 테이블에 저장합니다."""
    payload = {
        "user_id": data.get("회원 UID", ""),
        "platform_member_id": data.get("회원 ID", ""),
        "username": data.get("아이디", data.get("회원 ID", "")),
        "display_name": data.get("가입자 성명", ""),
        "role": "teacher",
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
        "is_active": True,
        "member_created_at": _utc_now_iso(),
        "last_login_at": _utc_now_iso(),
        "deleted": False,
    }
    supabase.table("subscribers").insert(payload).execute()


def save_diary_log(record_type, teacher_tone, daily_scope, original_text, summary, generated_message):
    """알림장 기록은 로그인한 회원의 개인 기록으로만 1년 저장합니다."""
    private_meta = private_log_metadata()
    if not private_meta:
        return False

    payload = {
        "record_type": record_type,
        "teacher_tone": teacher_tone,
        "daily_scope": daily_scope,
        "original_text": original_text,
        "summary": summary,
        "generated_message": generated_message,
        "deleted": False,
        **private_meta,
    }
    supabase.table("diary_logs").insert(payload).execute()
    return True


def save_phrase_log(record_type, play_keyword, age_group, curriculum_area, development_area, child_action, generated_text):
    """기록 요정의 문구·사진 분석 초안은 로그인한 회원의 개인 기록으로만 1년 저장합니다."""
    private_meta = private_log_metadata()
    if not private_meta:
        return False

    payload = {
        "record_type": record_type,
        "play_keyword": play_keyword,
        "age_group": age_group,
        "curriculum_area": curriculum_area,
        "development_area": development_area,
        "child_action": child_action,
        "generated_text": generated_text,
        "deleted": False,
        **private_meta,
    }
    supabase.table("phrase_logs").insert(payload).execute()
    return True


def load_table(table_name, include_deleted=False):
    """관리자 페이지에서 Supabase 테이블을 DataFrame으로 불러옵니다."""
    try:
        query = supabase.table(table_name).select("*").order("id", desc=True)
        if not include_deleted:
            query = query.eq("deleted", False)
        response = query.execute()
        return pd.DataFrame(_response_data(response))
    except Exception:
        try:
            response = supabase.table(table_name).select("*").order("id", desc=True).execute()
            return pd.DataFrame(_response_data(response))
        except Exception as e:
            st.warning(f"{table_name} 데이터를 불러오지 못했습니다: {e}")
            return pd.DataFrame()


def soft_delete_record(table_name, record_id):
    payload = {"deleted": True}
    if table_name == "subscribers":
        payload["is_active"] = False
    supabase.table(table_name).update(payload).eq("id", int(record_id)).execute()


def restore_record(table_name, record_id):
    payload = {"deleted": False}
    if table_name == "subscribers":
        payload["is_active"] = True
    supabase.table(table_name).update(payload).eq("id", int(record_id)).execute()


def delete_photos_for_session(session_id: str):
    if not session_id:
        return
    try:
        response = supabase.table("photo_records").select("id, storage_bucket, file_path").eq("session_id", session_id).execute()
        rows = _response_data(response)
    except Exception:
        rows = []
    buckets: dict[str, list[str]] = {}
    for row in rows:
        bucket = str(row.get("storage_bucket") or PLAY_PHOTO_BUCKET)
        path = str(row.get("file_path") or "")
        if path:
            buckets.setdefault(bucket, []).append(path)
    for bucket, paths in buckets.items():
        try:
            supabase.storage.from_(bucket).remove(paths)
        except Exception:
            pass
    try:
        supabase.table("photo_records").delete().eq("session_id", session_id).execute()
    except Exception:
        pass


def hard_delete_record(table_name, record_id):
    """관리자 영구 삭제 시 Auth·Storage까지 함께 정리합니다."""
    if table_name == "subscribers":
        user_id = ""
        try:
            rows = _response_data(supabase.table("subscribers").select("user_id").eq("id", int(record_id)).limit(1).execute())
            user_id = str(rows[0].get("user_id") or "") if rows else ""
        except Exception:
            pass
        if user_id:
            delete_all_member_photos(user_id)
            delete_auth_member(user_id)
    elif table_name == "photo_records":
        try:
            rows = _response_data(supabase.table("photo_records").select("storage_bucket, file_path").eq("id", int(record_id)).limit(1).execute())
            if rows and rows[0].get("file_path"):
                supabase.storage.from_(str(rows[0].get("storage_bucket") or PLAY_PHOTO_BUCKET)).remove([str(rows[0]["file_path"])])
        except Exception:
            pass
    elif table_name == "play_sessions":
        try:
            rows = _response_data(supabase.table("play_sessions").select("session_id").eq("id", int(record_id)).limit(1).execute())
            if rows:
                delete_photos_for_session(str(rows[0].get("session_id") or ""))
        except Exception:
            pass
    elif table_name == PLATFORM_POPUP_TABLE:
        try:
            rows = _response_data(
                supabase.table(PLATFORM_POPUP_TABLE)
                .select("image_bucket, image_path")
                .eq("id", int(record_id))
                .limit(1)
                .execute()
            )
            if rows:
                delete_platform_popup_image_by_values(rows[0].get("image_bucket"), rows[0].get("image_path"))
        except Exception:
            pass
    supabase.table(table_name).delete().eq("id", int(record_id)).execute()


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
                legend=alt.Legend(title=None, labelColor="#172B4D")
            ),
            tooltip=["범주", "건수"],
        ).properties(
            height=260,
            title=title,
            background="#FFFFFF"
        ).configure_view(
            fill="#FFFFFF",
            strokeWidth=0
        ).configure_title(
            color="#172B4D",
            fontSize=16,
            fontWeight=700
        ).configure_legend(
            labelColor="#172B4D"
        )
        st.altair_chart(chart, use_container_width=True, theme=None)
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


st.markdown(f"""
<!-- APP_VERSION: {APP_VERSION} -->
<div class="app-hero">
    <div class="app-eyebrow">🌿 놀이 기록 자동화</div>
    <h1>놀이 기록 자동화</h1>
    <p>사진 선별, 놀이 이야기와 기록 문구 생성, 사진 보정, 기록 관리를 한 화면에서 정리할 수 있도록 구성했습니다.</p>
    <div class="hero-links">
        <a class="hero-link" href="{WITTI_SITE_URL}" target="_blank" rel="noopener noreferrer">🔗 {WITTI_SITE_LABEL}</a>
        <span class="hero-link">✉️ {WITTI_CONTACT_LABEL}: <strong>{WITTI_CONTACT_EMAIL}</strong></span>
    </div>
</div>
""", unsafe_allow_html=True)


# =========================
# 공지사항 단일 문서 편집기
# =========================
# 작성 화면은 하나의 본문 문서로 유지합니다.
# 나눔 줄·강조박스·이미지는 문서 안에 삽입 표식으로 넣고, 공개 화면에서는 읽기 쉬운 카드/이미지로 렌더링합니다.
# 기존 blocks-v1 공지는 열 때 새 단일 문서 형식으로 자동 변환됩니다.
NOTICE_IMAGE_BUCKET = "platform-notice-images"
NOTICE_IMAGE_SIGNED_URL_TTL_SECONDS = 60 * 60
MAX_NOTICE_IMAGE_BYTES = 10 * 1024 * 1024

# 공지사항 첨부파일은 본문 이미지와 분리된 private Storage 버킷에 저장합니다.
# 한 공지당 최대 5개, 파일 1개당 최대 20MB로 제한합니다.
NOTICE_ATTACHMENT_BUCKET = "platform-notice-attachments"
NOTICE_ATTACHMENT_SIGNED_URL_TTL_SECONDS = 60 * 60
MAX_NOTICE_ATTACHMENT_COUNT = 5
MAX_NOTICE_ATTACHMENT_BYTES = 20 * 1024 * 1024
NOTICE_ATTACHMENT_MIME_BY_EXTENSION = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".pdf": "application/pdf",
    ".hwp": "application/x-hwp",
    ".hwpx": "application/vnd.hancom.hwpx",
}
NOTICE_ATTACHMENT_ALLOWED_TYPES = ["jpg", "jpeg", "png", "webp", "pdf", "hwp", "hwpx"]
NOTICE_TEXT_STYLE_OPTIONS = ["노멀", "헤딩 1", "헤딩 2", "헤딩 3", "헤딩 4", "헤딩 5"]
NOTICE_TEXT_STYLE_TAGS = {"노멀": "p", "헤딩 1": "h1", "헤딩 2": "h2", "헤딩 3": "h3", "헤딩 4": "h4", "헤딩 5": "h5"}
NOTICE_TEXT_COLOR_OPTIONS = {"기본색": "", "남색": "#172B4D", "파랑": "#1D4ED8", "초록": "#188B55", "주황": "#B54708", "빨강": "#B42318", "보라": "#6941C6", "회색": "#475467"}
NOTICE_HIGHLIGHT_OPTIONS = {"없음": "", "노랑": "#FFF3B0", "하늘": "#DFF4FF", "연두": "#DCFCE7", "분홍": "#FFE4E6", "보라": "#EEE5FF"}
NOTICE_CALLOUT_OPTIONS = {"안내(파랑)": "info", "성공·완료(초록)": "success", "유의(노랑)": "warning", "중요·긴급(분홍)": "danger"}
NOTICE_CALLOUT_LABELS = {value: label for label, value in NOTICE_CALLOUT_OPTIONS.items()}
NOTICE_DOCUMENT_TYPE = "document-v2"

st.markdown(
    """
    <style>
    .notice-doc-toolbar-note {
        color:#667085; font-size:13px; line-height:1.65; margin:4px 0 12px;
        padding:10px 12px; background:#F8FBFF; border:1px solid #DCEBFF; border-radius:12px;
    }
    .notice-doc-toolbar-note code { color:#174F80; background:#EAF4FF; border-radius:5px; padding:1px 5px; }
    .notice-media-card { background:#FFFFFF; border:1px solid #E1EAF3; border-radius:14px; padding:12px; margin:10px 0; }
    .notice-media-card-title { color:#174F80; font-size:13px; font-weight:900; margin-bottom:7px; }
    .notice-inline-tip { color:#667085; font-size:12.5px; line-height:1.55; margin-top:5px; }
    .notice-preview-frame {
        max-height:360px; overflow-y:auto; background:#FFFFFF; border:1px solid #E1EAF3;
        border-radius:14px; padding:16px 18px; margin-top:6px;
    }
    .notice-attachments { margin:18px 0 4px; padding:14px; background:#F8FBFF; border:1px solid #DCEBFF; border-radius:14px; }
    .notice-attachments-title { color:#174F80; font-size:14px; font-weight:900; margin-bottom:8px; }
    .notice-attachment-link {
        display:flex; align-items:center; gap:8px; color:#174F80 !important; background:#FFFFFF;
        border:1px solid #DCE8F5; border-radius:10px; padding:10px 12px; margin-top:8px;
        text-decoration:none !important; font-size:14px; font-weight:700;
    }
    .notice-attachment-link:hover { background:#F1F8FF; border-color:#A9CFF5; }
    .notice-attachment-meta { color:#667085; font-size:12px; font-weight:500; }
    </style>
    """,
    unsafe_allow_html=True,
)


def _notice_image_extension(mime_type: str) -> str:
    return {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}.get(str(mime_type or "").lower(), ".jpg")


def _make_notice_image_storage_path(mime_type: str, now_utc: datetime | None = None) -> str:
    now_utc = now_utc or datetime.now(timezone.utc)
    return f"notices/{now_utc.strftime('%Y')}/{now_utc.strftime('%m')}/{uuid.uuid4().hex}{_notice_image_extension(mime_type)}"


def _get_notice_image_bytes_and_mime(uploaded_file) -> tuple[bytes, str]:
    if uploaded_file is None:
        raise ValueError("공지 이미지를 선택해 주세요.")
    image_bytes = uploaded_file.getvalue()
    if len(image_bytes) > MAX_NOTICE_IMAGE_BYTES:
        raise ValueError(f"'{uploaded_file.name}' 파일이 10MB를 초과합니다.")
    mime_type = str(getattr(uploaded_file, "type", "") or "").lower()
    allowed_types = {"image/jpeg", "image/png", "image/webp"}
    if mime_type not in allowed_types:
        suffix = Path(str(getattr(uploaded_file, "name", ""))).suffix.lower()
        mime_type = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}.get(suffix, "")
    if mime_type not in allowed_types:
        raise ValueError("공지 이미지는 JPG, PNG, WEBP 형식만 업로드할 수 있습니다.")
    return image_bytes, mime_type


def upload_platform_notice_image(uploaded_file) -> dict:
    image_bytes, mime_type = _get_notice_image_bytes_and_mime(uploaded_file)
    file_path = _make_notice_image_storage_path(mime_type)
    supabase.storage.from_(NOTICE_IMAGE_BUCKET).upload(
        file_path,
        image_bytes,
        file_options={"content-type": mime_type, "upsert": "false"},
    )
    return {
        "image_bucket": NOTICE_IMAGE_BUCKET,
        "image_path": file_path,
        "image_original_file_name": str(getattr(uploaded_file, "name", "") or "notice-image"),
        "image_mime_type": mime_type,
        "image_size_bytes": len(image_bytes),
    }


def delete_platform_notice_image_by_values(bucket_name: str | None, image_path: str | None):
    path = str(image_path or "").strip()
    if not path:
        return
    try:
        supabase.storage.from_(str(bucket_name or NOTICE_IMAGE_BUCKET)).remove([path])
    except Exception:
        pass


def create_platform_notice_signed_url(image_bucket: str | None, image_path: str | None) -> str:
    path = str(image_path or "").strip()
    if not path:
        return ""
    try:
        response = supabase.storage.from_(str(image_bucket or NOTICE_IMAGE_BUCKET)).create_signed_url(
            path,
            NOTICE_IMAGE_SIGNED_URL_TTL_SECONDS,
        )
        if isinstance(response, dict):
            return str(response.get("signedURL") or response.get("signedUrl") or response.get("signed_url") or "")
        return str(
            getattr(response, "signedURL", "")
            or getattr(response, "signedUrl", "")
            or getattr(response, "signed_url", "")
            or ""
        )
    except Exception:
        return ""



def _notice_attachment_extension(uploaded_file) -> str:
    suffix = Path(str(getattr(uploaded_file, "name", "") or "")).suffix.lower()
    if suffix not in NOTICE_ATTACHMENT_MIME_BY_EXTENSION:
        raise ValueError("첨부파일은 JPG, PNG, WEBP, PDF, HWP, HWPX 형식만 업로드할 수 있습니다.")
    return suffix


def _make_notice_attachment_storage_path(uploaded_file, now_utc: datetime | None = None) -> str:
    now_utc = now_utc or datetime.now(timezone.utc)
    suffix = _notice_attachment_extension(uploaded_file)
    return f"attachments/{now_utc.strftime('%Y')}/{now_utc.strftime('%m')}/{uuid.uuid4().hex}{suffix}"


def _get_notice_attachment_bytes_and_mime(uploaded_file) -> tuple[bytes, str, str]:
    if uploaded_file is None:
        raise ValueError("첨부할 파일을 선택해 주세요.")
    file_bytes = uploaded_file.getvalue()
    if len(file_bytes) > MAX_NOTICE_ATTACHMENT_BYTES:
        raise ValueError(f"'{uploaded_file.name}' 파일이 20MB를 초과합니다.")
    suffix = _notice_attachment_extension(uploaded_file)
    mime_type = NOTICE_ATTACHMENT_MIME_BY_EXTENSION[suffix]
    return file_bytes, mime_type, suffix


def upload_platform_notice_attachment(uploaded_file) -> dict:
    file_bytes, mime_type, suffix = _get_notice_attachment_bytes_and_mime(uploaded_file)
    file_path = _make_notice_attachment_storage_path(uploaded_file)
    supabase.storage.from_(NOTICE_ATTACHMENT_BUCKET).upload(
        file_path,
        file_bytes,
        file_options={"content-type": mime_type, "upsert": "false"},
    )
    return {
        "attachment_bucket": NOTICE_ATTACHMENT_BUCKET,
        "attachment_path": file_path,
        "attachment_original_file_name": str(getattr(uploaded_file, "name", "") or f"attachment{suffix}"),
        "attachment_mime_type": mime_type,
        "attachment_size_bytes": len(file_bytes),
    }


def delete_platform_notice_attachment_by_values(bucket_name: str | None, attachment_path: str | None):
    path = str(attachment_path or "").strip()
    if not path:
        return
    try:
        supabase.storage.from_(str(bucket_name or NOTICE_ATTACHMENT_BUCKET)).remove([path])
    except Exception:
        pass


def create_platform_notice_attachment_signed_url(attachment_bucket: str | None, attachment_path: str | None) -> str:
    path = str(attachment_path or "").strip()
    if not path:
        return ""
    try:
        response = supabase.storage.from_(str(attachment_bucket or NOTICE_ATTACHMENT_BUCKET)).create_signed_url(
            path,
            NOTICE_ATTACHMENT_SIGNED_URL_TTL_SECONDS,
        )
        if isinstance(response, dict):
            return str(response.get("signedURL") or response.get("signedUrl") or response.get("signed_url") or "")
        return str(
            getattr(response, "signedURL", "")
            or getattr(response, "signedUrl", "")
            or getattr(response, "signed_url", "")
            or ""
        )
    except Exception:
        return ""


def _attachment_icon(mime_type: str, file_name: str = "") -> str:
    suffix = Path(str(file_name or "")).suffix.lower()
    mime = str(mime_type or "").lower()
    if mime.startswith("image/") or suffix in {".jpg", ".jpeg", ".png", ".webp"}:
        return "🖼️"
    if mime == "application/pdf" or suffix == ".pdf":
        return "📄"
    return "📝"


def _format_attachment_size(value) -> str:
    try:
        size = int(value or 0)
    except Exception:
        size = 0
    if size <= 0:
        return ""
    if size >= 1024 * 1024:
        return f"{size / (1024 * 1024):.1f}MB"
    return f"{max(1, size // 1024)}KB"

def _new_notice_text_block(text: str = "") -> dict:
    # 기존 공지 호환용으로만 유지합니다.
    return {
        "block_id": uuid.uuid4().hex,
        "type": "text",
        "text": str(text or ""),
        "text_style": "노멀",
        "text_color": "기본색",
        "highlight_color": "없음",
    }


def _new_notice_callout_block() -> dict:
    return {
        "block_id": uuid.uuid4().hex,
        "type": "callout",
        "callout_style": "info",
        "callout_title": "알아두세요",
        "text": "",
    }


def _new_notice_divider_block() -> dict:
    return {"block_id": uuid.uuid4().hex, "type": "divider"}


def _new_notice_image_block() -> dict:
    return {
        "block_id": uuid.uuid4().hex,
        "type": "image",
        "image_bucket": "",
        "image_path": "",
        "image_original_file_name": "",
        "image_mime_type": "",
        "image_size_bytes": None,
        "image_alt_text": "",
        "image_caption": "",
        "image_link_url": "",
    }


def _new_notice_document(body: str = "", assets: list[dict] | None = None, attachments: list[dict] | None = None) -> dict:
    return {
        "block_id": uuid.uuid4().hex,
        "type": NOTICE_DOCUMENT_TYPE,
        "body": str(body or ""),
        "assets": list(assets or []),
        "attachments": list(attachments or []),
    }


def _normalize_notice_block(raw_block) -> dict:
    if not isinstance(raw_block, dict):
        return _new_notice_text_block(str(raw_block or ""))
    kind = str(raw_block.get("type") or "text")
    if kind == NOTICE_DOCUMENT_TYPE:
        block = _new_notice_document()
    elif kind == "divider":
        block = _new_notice_divider_block()
    elif kind == "callout":
        block = _new_notice_callout_block()
    elif kind == "image":
        block = _new_notice_image_block()
    else:
        block = _new_notice_text_block()
    block.update({key: value for key, value in raw_block.items() if key != "_uploaded_file"})
    block["block_id"] = str(block.get("block_id") or uuid.uuid4().hex)
    if block.get("type") not in {NOTICE_DOCUMENT_TYPE, "text", "divider", "callout", "image"}:
        block["type"] = "text"
    if block.get("type") == NOTICE_DOCUMENT_TYPE:
        block["body"] = str(block.get("body") or "")
        assets = block.get("assets")
        attachments = block.get("attachments")
        block["assets"] = [dict(item) for item in assets if isinstance(item, dict)] if isinstance(assets, list) else []
        block["attachments"] = [dict(item) for item in attachments if isinstance(item, dict)] if isinstance(attachments, list) else []
    if block.get("text_style") not in NOTICE_TEXT_STYLE_OPTIONS:
        block["text_style"] = "노멀"
    if block.get("text_color") not in NOTICE_TEXT_COLOR_OPTIONS:
        block["text_color"] = "기본색"
    if block.get("highlight_color") not in NOTICE_HIGHLIGHT_OPTIONS:
        block["highlight_color"] = "없음"
    if block.get("callout_style") not in NOTICE_CALLOUT_LABELS:
        block["callout_style"] = "info"
    return block


def _notice_asset_marker(asset_id: str) -> str:
    return f"[[이미지:{asset_id}]]"


def _normalize_notice_asset(asset: dict, index: int = 0) -> dict:
    source = dict(asset or {})
    asset_id = str(source.get("asset_id") or f"img_{index + 1}_{uuid.uuid4().hex[:6]}")
    normalized = {
        "asset_id": asset_id,
        "image_bucket": str(source.get("image_bucket") or NOTICE_IMAGE_BUCKET),
        "image_path": str(source.get("image_path") or ""),
        "image_original_file_name": str(source.get("image_original_file_name") or ""),
        "image_mime_type": str(source.get("image_mime_type") or ""),
        "image_size_bytes": source.get("image_size_bytes"),
        "image_alt_text": str(source.get("image_alt_text") or ""),
        "image_caption": str(source.get("image_caption") or ""),
        "image_link_url": str(source.get("image_link_url") or ""),
        "remove_image": bool(source.get("remove_image") or False),
    }
    if source.get("_uploaded_file") is not None:
        normalized["_uploaded_file"] = source.get("_uploaded_file")
    return normalized



def _normalize_notice_attachment(attachment: dict, index: int = 0) -> dict:
    source = dict(attachment or {})
    attachment_id = str(source.get("attachment_id") or f"file_{index + 1}_{uuid.uuid4().hex[:6]}")
    normalized = {
        "attachment_id": attachment_id,
        "attachment_bucket": str(source.get("attachment_bucket") or NOTICE_ATTACHMENT_BUCKET),
        "attachment_path": str(source.get("attachment_path") or ""),
        "attachment_original_file_name": str(source.get("attachment_original_file_name") or ""),
        "attachment_mime_type": str(source.get("attachment_mime_type") or ""),
        "attachment_size_bytes": source.get("attachment_size_bytes"),
        "remove_attachment": bool(source.get("remove_attachment") or False),
    }
    if source.get("_uploaded_file") is not None:
        normalized["_uploaded_file"] = source.get("_uploaded_file")
    return normalized


def _new_document_attachment(document: dict) -> dict:
    existing = document.get("attachments") if isinstance(document.get("attachments"), list) else []
    serial = len(existing) + 1
    return _normalize_notice_attachment({"attachment_id": f"file_{serial}_{uuid.uuid4().hex[:6]}"}, serial)

def _legacy_blocks_to_document(blocks: list[dict]) -> dict:
    parts: list[str] = []
    assets: list[dict] = []
    for index, raw_block in enumerate(blocks or []):
        block = _normalize_notice_block(raw_block)
        kind = str(block.get("type") or "text")
        if kind == NOTICE_DOCUMENT_TYPE:
            return block
        if kind == "divider":
            parts.append("---")
            continue
        if kind == "callout":
            style = str(block.get("callout_style") or "info")
            title = str(block.get("callout_title") or "알아두세요").replace("|", " ").strip()
            body = str(block.get("text") or "").strip()
            parts.append(f":::callout|{style}|{title}\n{body}\n:::")
            continue
        if kind == "image":
            asset = _normalize_notice_asset({
                "asset_id": f"img_{len(assets) + 1}_{uuid.uuid4().hex[:6]}",
                "image_bucket": block.get("image_bucket"),
                "image_path": block.get("image_path"),
                "image_original_file_name": block.get("image_original_file_name"),
                "image_mime_type": block.get("image_mime_type"),
                "image_size_bytes": block.get("image_size_bytes"),
                "image_alt_text": block.get("image_alt_text"),
                "image_caption": block.get("image_caption"),
                "image_link_url": block.get("image_link_url"),
            }, len(assets))
            assets.append(asset)
            parts.append(_notice_asset_marker(asset["asset_id"]))
            continue
        text = str(block.get("text") or "").strip()
        if not text:
            continue
        style = str(block.get("text_style") or "노멀")
        color = str(block.get("text_color") or "기본색")
        highlight = str(block.get("highlight_color") or "없음")
        if style != "노멀" or color != "기본색" or highlight != "없음":
            parts.append(f":::style|{style}|{color}|{highlight}\n{text}\n:::")
        else:
            parts.append(text)
    return _new_notice_document("\n\n".join(parts).strip(), assets)


def _notice_blocks_from_record(record: dict | None) -> list[dict]:
    record = record or {}
    raw_blocks = record.get("content_blocks")
    if isinstance(raw_blocks, str):
        try:
            raw_blocks = json.loads(raw_blocks)
        except Exception:
            raw_blocks = None
    if isinstance(raw_blocks, dict) and str(raw_blocks.get("type") or "") == NOTICE_DOCUMENT_TYPE:
        return [_normalize_notice_block(raw_blocks)]
    if isinstance(raw_blocks, list) and raw_blocks:
        normalized = [_normalize_notice_block(item) for item in raw_blocks]
        if len(normalized) == 1 and normalized[0].get("type") == NOTICE_DOCUMENT_TYPE:
            return normalized
        return [_legacy_blocks_to_document(normalized)]
    legacy = str(record.get("content") or "").strip()
    return [_new_notice_document(legacy)]


def _get_notice_document(blocks: list[dict]) -> dict:
    normalized = [_normalize_notice_block(item) for item in (blocks or [])]
    if normalized and normalized[0].get("type") == NOTICE_DOCUMENT_TYPE:
        return normalized[0]
    return _legacy_blocks_to_document(normalized)


def _strip_notice_markup_to_plain_text(body: str, assets: list[dict] | None = None) -> str:
    text = str(body or "")
    text = re.sub(r"\[\[이미지:[^\]]+\]\]", "공지 이미지", text)
    text = re.sub(r"^:::callout\|[^\n]*\n", "", text, flags=re.MULTILINE)
    text = re.sub(r"^:::style\|[^\n]*\n", "", text, flags=re.MULTILINE)
    text = re.sub(r"^:::$", "", text, flags=re.MULTILINE)
    text = re.sub(r"^#{1,5}\s*", "", text, flags=re.MULTILINE)
    text = re.sub(r"^---$", "", text, flags=re.MULTILINE)
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def _notice_block_plain_text(block: dict) -> str:
    block = _normalize_notice_block(block)
    if block.get("type") == NOTICE_DOCUMENT_TYPE:
        return _strip_notice_markup_to_plain_text(block.get("body"), block.get("assets"))
    kind = str(block.get("type") or "text")
    if kind == "divider":
        return ""
    if kind == "image":
        return str(block.get("image_caption") or block.get("image_alt_text") or "공지 이미지").strip()
    if kind == "callout":
        return "\n".join([str(block.get("callout_title") or "").strip(), str(block.get("text") or "").strip()]).strip()
    return str(block.get("text") or "").strip()


def _notice_plain_text_from_blocks(blocks: list[dict]) -> str:
    return "\n\n".join([value for value in (_notice_block_plain_text(block) for block in blocks) if value]).strip()


def _safe_notice_link(url: str | None) -> str:
    valid, normalized = _validate_popup_link_url(url)
    return normalized if valid else ""


def _render_notice_image_html(asset: dict) -> str:
    asset = _normalize_notice_asset(asset)
    signed_url = create_platform_notice_signed_url(asset.get("image_bucket"), asset.get("image_path"))
    if not signed_url:
        return ""
    image_url = html.escape(signed_url, quote=True)
    alt = html.escape(str(asset.get("image_alt_text") or asset.get("image_original_file_name") or "공지 이미지"), quote=True)
    image_html = f"<img class='notice-rich-image' src='{image_url}' alt='{alt}'>"
    link = _safe_notice_link(str(asset.get("image_link_url") or ""))
    if link:
        image_html = f"<a href='{html.escape(link, quote=True)}' target='_blank' rel='noopener noreferrer'>{image_html}</a>"
    caption = html.escape(str(asset.get("image_caption") or "")).replace("\n", "<br>")
    caption_html = f"<figcaption class='notice-rich-image-caption'>{caption}</figcaption>" if caption else ""
    return f"<figure class='notice-rich-image-wrap'>{image_html}{caption_html}</figure>"


NOTICE_MARKDOWN_OR_URL_PATTERN = re.compile(
    r"\[([^\]\n]{1,240})\]\((https?://[^\s)<>\"']+)\)|(?P<url>https?://[^\s<>\"'`]+)",
    re.IGNORECASE,
)
NOTICE_URL_TRAILING_PUNCTUATION = ".,;:!?)]}›»”’"


def _render_notice_text_with_links(text: str) -> str:
    """공지 본문 속 URL을 안전한 실제 링크로 변환합니다.

    - https:// 또는 http:// 주소를 자동 링크로 변환
    - [표시 문구](https://주소) 형식 지원
    - HTML은 이스케이프해 스크립트 삽입을 차단
    - data-witti-external-url 속성을 함께 넣어 Streamlit/인앱 브라우저에서도
      별도 클릭 처리기가 URL을 확실히 열 수 있게 함
    """
    source = str(text or "")
    if not source:
        return ""

    parts: list[str] = []
    cursor = 0
    for match in NOTICE_MARKDOWN_OR_URL_PATTERN.finditer(source):
        parts.append(html.escape(source[cursor:match.start()]))
        label = match.group(1) if match.group(1) is not None else ""
        raw_url = match.group(2) if match.group(2) is not None else match.group("url")
        raw_url = str(raw_url or "")

        # 문장 끝 마침표·괄호는 링크 바깥에 남깁니다.
        trailing = ""
        if match.group(1) is None:
            while raw_url and raw_url[-1] in NOTICE_URL_TRAILING_PUNCTUATION:
                trailing = raw_url[-1] + trailing
                raw_url = raw_url[:-1]

        valid, normalized_url = _validate_popup_link_url(raw_url)
        if valid and normalized_url:
            visible_label = str(label or raw_url)
            href = html.escape(normalized_url, quote=True)
            parts.append(
                "<a class='notice-inline-link' "
                f"href='{href}' data-witti-external-url='{href}' "
                "target='_blank' rel='noopener noreferrer'>"
                f"{html.escape(visible_label)}</a>"
            )
            if trailing:
                parts.append(html.escape(trailing))
        else:
            parts.append(html.escape(match.group(0)))
        cursor = match.end()

    parts.append(html.escape(source[cursor:]))
    return "".join(parts).replace("\n", "<br>")


def install_notice_link_click_handler():
    """공지 링크가 Streamlit·모바일 인앱 브라우저에서도 직접 열리도록 보강합니다.

    표준 <a> 링크를 우선 사용하되, Streamlit expander 또는 일부 인앱 브라우저가
    클릭을 가로채는 경우를 대비해 부모 문서에 이벤트 위임 처리기를 한 번 등록합니다.
    """
    components.html(
        """
        <script>
        (function () {
            const win = window.parent;
            const doc = win.document;
            const MARKER = '__wittiNoticeExternalLinkHandlerInstalled';
            if (win[MARKER]) return;
            win[MARKER] = true;

            function normalizeHttpUrl(value) {
                try {
                    const url = new URL(String(value || '').trim());
                    return (url.protocol === 'https:' || url.protocol === 'http:') ? url.href : '';
                } catch (error) {
                    return '';
                }
            }

            doc.addEventListener('click', function (event) {
                const target = event.target;
                if (!target || !target.closest) return;
                const anchor = target.closest('a.notice-inline-link, .notice-rich-content a[href]');
                if (!anchor) return;

                const url = normalizeHttpUrl(
                    anchor.getAttribute('data-witti-external-url') || anchor.getAttribute('href') || ''
                );
                if (!url) return;

                event.preventDefault();
                event.stopPropagation();

                let opened = null;
                try {
                    opened = win.open(url, '_blank', 'noopener,noreferrer');
                } catch (error) {
                    opened = null;
                }

                // 인앱 브라우저에서 새 창 열기가 막히면 현재 창에서라도 링크로 이동합니다.
                if (!opened) {
                    try {
                        win.location.assign(url);
                    } catch (error) {
                        win.location.href = url;
                    }
                }
            }, true);
        })();
        </script>
        """,
        height=0,
        width=0,
    )


def _render_plain_notice_paragraph(lines: list[str]) -> str:
    text = "\n".join(lines).strip()
    if not text:
        return ""
    return f"<p>{_render_notice_text_with_links(text)}</p>"


def _build_notice_document_html(body: str, assets: list[dict]) -> str:
    asset_map = {str(asset.get("asset_id")): _normalize_notice_asset(asset, index) for index, asset in enumerate(assets or [])}
    lines = str(body or "").replace("\r\n", "\n").replace("\r", "\n").split("\n")
    html_parts: list[str] = []
    plain_lines: list[str] = []

    def flush_plain():
        rendered = _render_plain_notice_paragraph(plain_lines)
        if rendered:
            html_parts.append(rendered)
        plain_lines.clear()

    index = 0
    while index < len(lines):
        line = lines[index]
        stripped = line.strip()
        if stripped.startswith(":::callout|"):
            flush_plain()
            header = stripped.split("|", 2)
            style = header[1].strip() if len(header) > 1 else "info"
            if style not in NOTICE_CALLOUT_LABELS:
                style = "info"
            title = header[2].strip() if len(header) > 2 else "알아두세요"
            index += 1
            body_lines: list[str] = []
            while index < len(lines) and lines[index].strip() != ":::":
                body_lines.append(lines[index])
                index += 1
            body_html = _render_notice_text_with_links("\n".join(body_lines).strip())
            html_parts.append(
                f"<div class='notice-callout {style}'><div class='notice-callout-title'>{html.escape(title)}</div><div class='notice-callout-body'>{body_html}</div></div>"
            )
        elif stripped.startswith(":::style|"):
            flush_plain()
            header = stripped.split("|", 3)
            style_label = header[1].strip() if len(header) > 1 else "노멀"
            color_label = header[2].strip() if len(header) > 2 else "기본색"
            highlight_label = header[3].strip() if len(header) > 3 else "없음"
            if style_label not in NOTICE_TEXT_STYLE_OPTIONS:
                style_label = "노멀"
            if color_label not in NOTICE_TEXT_COLOR_OPTIONS:
                color_label = "기본색"
            if highlight_label not in NOTICE_HIGHLIGHT_OPTIONS:
                highlight_label = "없음"
            index += 1
            body_lines = []
            while index < len(lines) and lines[index].strip() != ":::":
                body_lines.append(lines[index])
                index += 1
            body_html = _render_notice_text_with_links("\n".join(body_lines).strip())
            if body_html:
                tag = NOTICE_TEXT_STYLE_TAGS[style_label]
                styles = []
                color = NOTICE_TEXT_COLOR_OPTIONS[color_label]
                highlight = NOTICE_HIGHLIGHT_OPTIONS[highlight_label]
                if color:
                    styles.append(f"color:{color}")
                if highlight:
                    styles.extend([f"background-color:{highlight}", "padding:0.08em 0.26em", "border-radius:0.26em"])
                attr = f" style='{';'.join(styles)}'" if styles else ""
                html_parts.append(f"<{tag}{attr}>{body_html}</{tag}>")
        elif stripped == "---":
            flush_plain()
            html_parts.append("<hr>")
        else:
            marker_match = re.fullmatch(r"\[\[이미지:([^\]]+)\]\]", stripped)
            heading_match = re.fullmatch(r"(#{1,5})\s+(.+)", stripped)
            if marker_match:
                flush_plain()
                asset = asset_map.get(marker_match.group(1))
                if asset:
                    image_html = _render_notice_image_html(asset)
                    if image_html:
                        html_parts.append(image_html)
            elif heading_match:
                flush_plain()
                tag = f"h{len(heading_match.group(1))}"
                html_parts.append(f"<{tag}>{html.escape(heading_match.group(2).strip())}</{tag}>")
            elif not stripped:
                flush_plain()
            else:
                plain_lines.append(line)
        index += 1
    flush_plain()
    return "".join(html_parts)


def build_notice_blocks_html(blocks: list[dict]) -> str:
    document = _get_notice_document(blocks)
    return _build_notice_document_html(document.get("body"), document.get("assets") or [])


def _build_notice_attachments_html(blocks: list[dict]) -> str:
    document = _get_notice_document(blocks)
    attachments = document.get("attachments") if isinstance(document.get("attachments"), list) else []
    rendered: list[str] = []
    for index, raw_attachment in enumerate(attachments):
        attachment = _normalize_notice_attachment(raw_attachment, index)
        if attachment.get("remove_attachment"):
            continue
        signed_url = create_platform_notice_attachment_signed_url(
            attachment.get("attachment_bucket"),
            attachment.get("attachment_path"),
        )
        if not signed_url:
            continue
        file_name = str(attachment.get("attachment_original_file_name") or "첨부파일")
        file_name_html = html.escape(file_name)
        icon = _attachment_icon(str(attachment.get("attachment_mime_type") or ""), file_name)
        size_text = _format_attachment_size(attachment.get("attachment_size_bytes"))
        meta_html = f"<span class='notice-attachment-meta'>{html.escape(size_text)}</span>" if size_text else ""
        rendered.append(
            f"<a class='notice-attachment-link' href='{html.escape(signed_url, quote=True)}' "
            f"data-witti-external-url='{html.escape(signed_url, quote=True)}' "
            "target='_blank' rel='noopener noreferrer' download>"
            f"<span>{icon}</span><span>{file_name_html} {meta_html}</span></a>"
        )
    if not rendered:
        return ""
    return "<div class='notice-attachments'><div class='notice-attachments-title'>첨부파일</div>" + "".join(rendered) + "</div>"


def render_notice_blocks(blocks: list[dict]):
    rendered = build_notice_blocks_html(blocks)
    attachment_html = _build_notice_attachments_html(blocks)
    combined = f"{rendered}{attachment_html}"
    if combined:
        st.markdown(f"<div class='notice-rich-content'>{combined}</div>", unsafe_allow_html=True)
    else:
        st.caption("등록된 공지 내용이 없습니다.")


def _notice_editor_state_key(token: str) -> str:
    return f"{token}_document_state"


def _initialize_notice_editor(token: str, existing: dict) -> dict:
    state_key = _notice_editor_state_key(token)
    if state_key not in st.session_state:
        st.session_state[state_key] = _get_notice_document(_notice_blocks_from_record(existing))
    return st.session_state[state_key]


def _append_notice_body(token: str, value: str):
    body_key = f"{token}_document_body"
    current = str(st.session_state.get(body_key) or "")
    addition = str(value or "").strip("\n")
    st.session_state[body_key] = f"{current.rstrip()}\n\n{addition}\n".strip("\n") if current.strip() else addition


def _new_document_asset(document: dict) -> dict:
    existing_assets = document.get("assets") if isinstance(document.get("assets"), list) else []
    serial = len(existing_assets) + 1
    return _normalize_notice_asset({"asset_id": f"img_{serial}_{uuid.uuid4().hex[:6]}"}, serial)


def _render_document_toolbar(token: str, document: dict):
    st.markdown("<div class='notice-editor-guide'>본문은 하나의 편집창에서 작성합니다. 아래 도구는 본문 끝에 삽입되며, 삽입된 <code>나눔 줄·강조박스·이미지 표식</code>은 본문 안에서 잘라 원하는 위치로 옮길 수 있습니다.</div>", unsafe_allow_html=True)
    tool1, tool2, tool3, tool4, tool5 = st.columns([1.05, 1.0, 1.0, 1.0, 1.15])

    with tool1:
        with st.popover("Tt 서식", use_container_width=True):
            style = st.selectbox("글자 크기", NOTICE_TEXT_STYLE_OPTIONS, key=f"{token}_quick_style")
            color = st.selectbox("글자 색", list(NOTICE_TEXT_COLOR_OPTIONS.keys()), key=f"{token}_quick_color")
            highlight = st.selectbox("음영", list(NOTICE_HIGHLIGHT_OPTIONS.keys()), key=f"{token}_quick_highlight")
            text = st.text_area("삽입할 문장", key=f"{token}_quick_text", height=100, placeholder="강조하거나 제목으로 만들 문장을 입력해 주세요.")
            if st.button("본문에 서식 문장 삽입", key=f"{token}_insert_style", use_container_width=True):
                if not text.strip():
                    st.warning("삽입할 문장을 입력해 주세요.")
                elif style == "노멀" and color == "기본색" and highlight == "없음":
                    _append_notice_body(token, text.strip())
                    st.rerun()
                else:
                    _append_notice_body(token, f":::style|{style}|{color}|{highlight}\n{text.strip()}\n:::")
                    st.rerun()

    with tool2:
        if st.button("— 나눔 줄", key=f"{token}_insert_divider", use_container_width=True, help="본문 끝에 나눔 줄을 삽입합니다."):
            _append_notice_body(token, "---")
            st.rerun()

    with tool3:
        with st.popover("▣ 강조박스", use_container_width=True):
            style_label = st.selectbox("박스 종류", list(NOTICE_CALLOUT_OPTIONS.keys()), key=f"{token}_callout_style")
            title = st.text_input("박스 제목", value="알아두세요", key=f"{token}_callout_title")
            body = st.text_area("박스 내용", key=f"{token}_callout_body", height=110)
            if st.button("본문에 강조박스 삽입", key=f"{token}_insert_callout", use_container_width=True):
                if not body.strip():
                    st.warning("강조박스 내용을 입력해 주세요.")
                else:
                    safe_title = (title.strip() or "알아두세요").replace("|", " ")
                    _append_notice_body(token, f":::callout|{NOTICE_CALLOUT_OPTIONS[style_label]}|{safe_title}\n{body.strip()}\n:::")
                    st.rerun()

    with tool4:
        with st.popover("🖼 이미지", use_container_width=True):
            uploaded = st.file_uploader("이미지 선택", type=["jpg", "jpeg", "png", "webp"], key=f"{token}_image_upload", help="JPG·PNG·WEBP, 10MB 이하")
            alt = st.text_input("이미지 설명", key=f"{token}_image_alt", max_chars=200)
            caption = st.text_area("이미지 아래 설명", key=f"{token}_image_caption", height=80, max_chars=500)
            link = st.text_input("이미지 클릭 링크", key=f"{token}_image_link", placeholder="https://...", max_chars=1000)
            if uploaded is not None:
                st.image(uploaded, caption=uploaded.name, use_container_width=True)
            if st.button("본문에 이미지 삽입", key=f"{token}_insert_image", use_container_width=True):
                if uploaded is None:
                    st.warning("삽입할 이미지를 선택해 주세요.")
                else:
                    valid, normalized_link = _validate_popup_link_url(link)
                    if not valid:
                        st.warning("이미지 링크는 https:// 또는 http://로 시작하는 주소로 입력해 주세요.")
                    else:
                        asset = _new_document_asset(document)
                        asset.update({
                            "image_alt_text": alt.strip(),
                            "image_caption": caption.strip(),
                            "image_link_url": normalized_link,
                            "_uploaded_file": uploaded,
                        })
                        document.setdefault("assets", []).append(asset)
                        _append_notice_body(token, _notice_asset_marker(asset["asset_id"]))
                        st.rerun()

    with tool5:
        with st.popover("ⓘ 작성 도움", use_container_width=True):
            st.markdown("**제목**은 본문에 `# 제목`처럼 입력하면 됩니다.")
            st.markdown("**나눔 줄**은 `---`, **이미지**는 `[[이미지:...]]` 표식으로 본문에 들어갑니다.")
            st.caption("표식은 본문 안에서 잘라 이동해 원하는 위치에 배치할 수 있습니다. 우클릭 메뉴는 브라우저 기본 메뉴와 충돌하고 모바일에서 작동하지 않아 넣지 않았습니다.")


def _render_document_asset_manager(token: str, document: dict):
    assets = document.get("assets") if isinstance(document.get("assets"), list) else []
    if not assets:
        return
    with st.expander(f"삽입된 이미지 관리 · {len(assets)}개", expanded=False):
        st.caption("이미지 위치는 본문의 이미지 표식을 잘라 옮겨 조정합니다. 이미지 설명과 링크만 여기에서 관리합니다.")
        active_assets = []
        for index, raw_asset in enumerate(list(assets)):
            asset = _normalize_notice_asset(raw_asset, index)
            asset_id = asset["asset_id"]
            marker = _notice_asset_marker(asset_id)
            st.markdown(f"<div class='notice-media-card'><div class='notice-media-card-title'>{html.escape(marker)}</div>", unsafe_allow_html=True)
            signed = create_platform_notice_signed_url(asset.get("image_bucket"), asset.get("image_path"))
            if signed:
                st.image(signed, caption=asset.get("image_original_file_name") or "공지 이미지", use_container_width=True)
            elif asset.get("_uploaded_file") is not None:
                st.image(asset.get("_uploaded_file"), caption=getattr(asset.get("_uploaded_file"), "name", "새 이미지"), use_container_width=True)
            c1, c2 = st.columns(2)
            with c1:
                asset["image_alt_text"] = st.text_input("이미지 설명", value=asset.get("image_alt_text") or "", key=f"{token}_{asset_id}_alt", max_chars=200)
                asset["image_caption"] = st.text_area("이미지 아래 설명", value=asset.get("image_caption") or "", key=f"{token}_{asset_id}_caption", height=72, max_chars=500)
            with c2:
                asset["image_link_url"] = st.text_input("이미지 클릭 링크", value=asset.get("image_link_url") or "", key=f"{token}_{asset_id}_link", placeholder="https://...", max_chars=1000)
                remove = st.checkbox("이 이미지 삭제", value=bool(asset.get("remove_image") or False), key=f"{token}_{asset_id}_remove")
                asset["remove_image"] = remove
                if st.button("본문에서 이미지 표식 지우기", key=f"{token}_{asset_id}_remove_marker", use_container_width=True):
                    body_key = f"{token}_document_body"
                    st.session_state[body_key] = str(st.session_state.get(body_key) or "").replace(marker, "").replace("\n\n\n", "\n\n")
                    st.rerun()
            st.markdown("</div>", unsafe_allow_html=True)
            if not remove:
                active_assets.append(asset)
        document["assets"] = active_assets



def _render_document_attachment_manager(token: str, document: dict):
    attachments = document.get("attachments") if isinstance(document.get("attachments"), list) else []
    active_attachments = [
        _normalize_notice_attachment(item, index)
        for index, item in enumerate(attachments)
        if not bool((item or {}).get("remove_attachment"))
    ]

    st.markdown("#### 첨부파일")
    st.caption("공지마다 최대 5개까지 업로드할 수 있습니다. JPG·PNG·WEBP 이미지, PDF, 한글(HWP·HWPX) 파일을 지원하며 파일 1개당 최대 20MB입니다.")

    remaining = max(0, MAX_NOTICE_ATTACHMENT_COUNT - len(active_attachments))
    if remaining <= 0:
        st.info("첨부파일은 최대 5개까지 등록할 수 있습니다. 기존 파일을 삭제하면 새 파일을 추가할 수 있습니다.")
    else:
        selected_files = st.file_uploader(
            f"첨부파일 선택 · 남은 수 {remaining}개",
            type=NOTICE_ATTACHMENT_ALLOWED_TYPES,
            accept_multiple_files=True,
            key=f"{token}_attachment_upload",
            help="이미지, PDF, 한글(HWP·HWPX) 파일을 최대 5개까지 선택할 수 있습니다.",
        )
        if st.button("첨부파일 목록에 추가", key=f"{token}_attachment_add", use_container_width=True):
            selected_files = list(selected_files or [])
            if not selected_files:
                st.warning("추가할 첨부파일을 먼저 선택해 주세요.")
            elif len(selected_files) > remaining:
                st.warning(f"현재 공지에는 {remaining}개만 더 추가할 수 있습니다.")
            else:
                validated: list[dict] = []
                try:
                    for uploaded_file in selected_files:
                        file_bytes, mime_type, _ = _get_notice_attachment_bytes_and_mime(uploaded_file)
                        attachment = _new_document_attachment(document)
                        attachment.update({
                            "attachment_original_file_name": str(getattr(uploaded_file, "name", "") or "첨부파일"),
                            "attachment_mime_type": mime_type,
                            "attachment_size_bytes": len(file_bytes),
                            "_uploaded_file": uploaded_file,
                        })
                        validated.append(attachment)
                    document.setdefault("attachments", []).extend(validated)
                    st.rerun()
                except Exception as exc:
                    st.warning(str(exc))

    if not attachments:
        return

    with st.expander(f"등록할 첨부파일 관리 · {len(active_attachments)}개", expanded=True):
        kept: list[dict] = []
        for index, raw_attachment in enumerate(list(attachments)):
            attachment = _normalize_notice_attachment(raw_attachment, index)
            attachment_id = attachment["attachment_id"]
            file_name = attachment.get("attachment_original_file_name") or "첨부파일"
            icon = _attachment_icon(attachment.get("attachment_mime_type") or "", file_name)
            size_text = _format_attachment_size(attachment.get("attachment_size_bytes"))
            state_text = "저장 전 파일" if attachment.get("_uploaded_file") is not None else "저장된 파일"
            with st.container(border=True):
                left, right = st.columns([5, 1.7])
                with left:
                    st.markdown(f"**{icon} {file_name}**")
                    st.caption(" · ".join([item for item in [state_text, size_text] if item]))
                    signed = create_platform_notice_attachment_signed_url(
                        attachment.get("attachment_bucket"), attachment.get("attachment_path")
                    )
                    if signed:
                        st.link_button("첨부파일 열기", signed, use_container_width=False)
                with right:
                    attachment["remove_attachment"] = st.checkbox(
                        "삭제", value=bool(attachment.get("remove_attachment") or False),
                        key=f"{token}_{attachment_id}_remove_attachment"
                    )
                if not attachment.get("remove_attachment"):
                    kept.append(attachment)
        document["attachments"] = kept

def render_notice_block_editor(token: str, existing: dict) -> list[dict]:
    # 함수명은 기존 관리자 호출과의 호환을 위해 유지합니다.
    document = _initialize_notice_editor(token, existing)
    body_key = f"{token}_document_body"
    if body_key not in st.session_state:
        st.session_state[body_key] = str(document.get("body") or "")
    st.markdown("#### 공지 본문 편집")
    st.caption("본문 작성 영역을 넓히고, 미리보기는 접어서 확인할 수 있도록 조정했습니다.")
    _render_document_toolbar(token, document)
    document["body"] = st.text_area(
        "본문",
        key=body_key,
        height=680,
        max_chars=8000,
        placeholder="공지 내용을 입력해 주세요.\n\n제목은 # 제목처럼, 나눔 줄은 ---처럼 본문 안에서 바로 쓸 수 있습니다.",
    )
    _render_document_asset_manager(token, document)
    _render_document_attachment_manager(token, document)
    with st.expander("미리보기 열기", expanded=False):
        st.caption("저장 전 게시 화면을 확인할 수 있습니다. 긴 공지도 편집 영역을 가리지 않도록 높이를 제한했습니다.")
        with st.container(height=360, border=True):
            render_notice_blocks([document])
    return [document]


def _clean_notice_blocks_for_storage(blocks: list[dict]) -> list[dict]:
    document = _get_notice_document(blocks)
    clean_assets: list[dict] = []
    clean_attachments: list[dict] = []
    for index, raw_asset in enumerate(document.get("assets") or []):
        asset = _normalize_notice_asset(raw_asset, index)
        if asset.get("remove_image"):
            continue
        if not str(asset.get("image_path") or "").strip():
            continue
        clean_assets.append({
            key: asset.get(key)
            for key in [
                "asset_id", "image_bucket", "image_path", "image_original_file_name",
                "image_mime_type", "image_size_bytes", "image_alt_text", "image_caption", "image_link_url",
            ]
        })
    for index, raw_attachment in enumerate(document.get("attachments") or []):
        attachment = _normalize_notice_attachment(raw_attachment, index)
        if attachment.get("remove_attachment"):
            continue
        if not str(attachment.get("attachment_path") or "").strip():
            continue
        clean_attachments.append({
            key: attachment.get(key)
            for key in [
                "attachment_id", "attachment_bucket", "attachment_path", "attachment_original_file_name",
                "attachment_mime_type", "attachment_size_bytes",
            ]
        })
    return [{
        "block_id": str(document.get("block_id") or uuid.uuid4().hex),
        "type": NOTICE_DOCUMENT_TYPE,
        "body": str(document.get("body") or ""),
        "assets": clean_assets,
        "attachments": clean_attachments,
    }]


def _notice_image_refs(blocks: list[dict]) -> set[tuple[str, str]]:
    document = _get_notice_document(blocks)
    refs: set[tuple[str, str]] = set()
    for index, raw_asset in enumerate(document.get("assets") or []):
        asset = _normalize_notice_asset(raw_asset, index)
        path = str(asset.get("image_path") or "").strip()
        if path and not asset.get("remove_image"):
            refs.add((str(asset.get("image_bucket") or NOTICE_IMAGE_BUCKET), path))
    return refs



def _notice_attachment_refs(blocks: list[dict]) -> set[tuple[str, str]]:
    document = _get_notice_document(blocks)
    refs: set[tuple[str, str]] = set()
    for index, raw_attachment in enumerate(document.get("attachments") or []):
        attachment = _normalize_notice_attachment(raw_attachment, index)
        path = str(attachment.get("attachment_path") or "").strip()
        if path and not attachment.get("remove_attachment"):
            refs.add((str(attachment.get("attachment_bucket") or NOTICE_ATTACHMENT_BUCKET), path))
    return refs

def _prepare_notice_blocks_for_save(blocks: list[dict]) -> tuple[list[dict], list[dict], list[dict]]:
    document = _get_notice_document(blocks)
    body = str(document.get("body") or "")
    prepared_assets: list[dict] = []
    prepared_attachments: list[dict] = []
    uploaded_image_metas: list[dict] = []
    uploaded_attachment_metas: list[dict] = []

    for index, raw_asset in enumerate(document.get("assets") or []):
        asset = _normalize_notice_asset(raw_asset, index)
        if asset.get("remove_image"):
            continue
        new_upload = raw_asset.get("_uploaded_file") if isinstance(raw_asset, dict) else None
        if new_upload is not None:
            meta = upload_platform_notice_image(new_upload)
            uploaded_image_metas.append(meta)
            asset.update(meta)
        valid, normalized = _validate_popup_link_url(str(asset.get("image_link_url") or ""))
        if not valid:
            raise ValueError("공지 이미지 링크는 https:// 또는 http://로 시작하는 완전한 주소로 입력해 주세요.")
        asset["image_link_url"] = normalized
        marker = _notice_asset_marker(asset["asset_id"])
        # 본문에서 지워진 이미지 표식은 저장하지 않아 불필요한 파일을 남기지 않습니다.
        if marker not in body:
            continue
        prepared_assets.append(asset)

    for index, raw_attachment in enumerate(document.get("attachments") or []):
        attachment = _normalize_notice_attachment(raw_attachment, index)
        if attachment.get("remove_attachment"):
            continue
        new_upload = raw_attachment.get("_uploaded_file") if isinstance(raw_attachment, dict) else None
        if new_upload is not None:
            meta = upload_platform_notice_attachment(new_upload)
            uploaded_attachment_metas.append(meta)
            attachment.update(meta)
        if not str(attachment.get("attachment_path") or "").strip():
            continue
        prepared_attachments.append(attachment)

    if len(prepared_attachments) > MAX_NOTICE_ATTACHMENT_COUNT:
        raise ValueError(f"공지사항 첨부파일은 최대 {MAX_NOTICE_ATTACHMENT_COUNT}개까지 등록할 수 있습니다.")

    prepared_document = _new_notice_document(body, prepared_assets, prepared_attachments)
    return _clean_notice_blocks_for_storage([prepared_document]), uploaded_image_metas, uploaded_attachment_metas


def _clear_notice_editor_state(token: str):
    document = st.session_state.pop(_notice_editor_state_key(token), {})
    body_key = f"{token}_document_body"
    st.session_state.pop(body_key, None)
    for key in list(st.session_state.keys()):
        if (
            key.startswith(f"{token}_quick_")
            or key.startswith(f"{token}_callout_")
            or key.startswith(f"{token}_image_")
            or key.startswith(f"{token}_attachment_")
        ):
            st.session_state.pop(key, None)
    for raw_asset in document.get("assets", []) if isinstance(document, dict) else []:
        asset_id = str(raw_asset.get("asset_id") or "") if isinstance(raw_asset, dict) else ""
        if asset_id:
            for key in list(st.session_state.keys()):
                if key.startswith(f"{token}_{asset_id}_"):
                    st.session_state.pop(key, None)
    for raw_attachment in document.get("attachments", []) if isinstance(document, dict) else []:
        attachment_id = str(raw_attachment.get("attachment_id") or "") if isinstance(raw_attachment, dict) else ""
        if attachment_id:
            for key in list(st.session_state.keys()):
                if key.startswith(f"{token}_{attachment_id}_"):
                    st.session_state.pop(key, None)


# 공지 상단 요약과 공개 공지 보기만 단일 문서 렌더러로 덮어씁니다.
def render_active_notice_banner():
    notices = load_visible_notices()
    pinned = [row for row in notices if _as_bool(row.get("is_pinned"))]
    if not pinned:
        return
    notice = pinned[0]
    icon = _content_level_icon(str(notice.get("notice_level") or "일반"))
    title = str(notice.get("title") or "공지사항")
    summary = re.sub(r"\s+", " ", _notice_plain_text_from_blocks(_notice_blocks_from_record(notice))).strip()
    if len(summary) > 240:
        summary = f"{summary[:240].rstrip()}…"
    st.info(f"{icon} **{title}**\n\n{summary}")


def render_public_notice_page():
    render_menu_card("📢 공지사항", "서비스 이용 전 알아두면 좋은 안내와 운영 소식을 확인할 수 있습니다.", ["운영 안내", "점검 안내", "중요 공지"])
    notices = load_visible_notices()
    if not notices:
        st.caption("현재 게시 중인 공지사항이 없습니다.")
        return
    for index, notice in enumerate(notices):
        level = str(notice.get("notice_level") or "일반")
        icon = _content_level_icon(level)
        title = str(notice.get("title") or "공지사항")
        created_at = _format_kst_display(notice.get("published_at") or notice.get("created_at"))
        pin_mark = "📌 " if _as_bool(notice.get("is_pinned")) else ""
        with st.expander(f"{pin_mark}{icon} {title}", expanded=(index == 0 and _as_bool(notice.get("is_pinned")))):
            if created_at:
                st.caption(f"{_content_level_label(level)} · {created_at}")
            render_notice_blocks(_notice_blocks_from_record(notice))


def render_admin_notice_manager():
    """공지사항을 목록에서 바로 불러와 수정·저장할 수 있는 관리자 화면입니다.

    기존에는 상단 selectbox와 하단 dataframe이 분리되어 있어, 목록의 공지를 클릭해
    바로 편집한다는 흐름이 보이지 않았습니다. 이 화면은 게시·보관 목록의 각 제목/수정
    버튼을 누르면 해당 공지의 저장된 제목·본문·이미지·서식 정보를 편집기에 불러옵니다.
    """
    st.markdown("### 📢 공지사항 관리")
    st.caption("게시·보관 목록에서 공지를 선택하면 바로 아래 편집기에 기존 제목·본문·이미지·서식이 불러와집니다.")

    rows = _load_platform_rows(PLATFORM_NOTICE_TABLE)
    rows_by_id = {str(row.get("id")): row for row in rows if row.get("id") is not None}

    # 목록에서 선택한 공지 ID를 별도로 관리합니다. dataframe은 행 클릭 이벤트를 안정적으로
    # 전달하지 못하므로, 각 공지 행에 있는 '내용 수정' 버튼으로 편집기를 여는 방식입니다.
    target_key = "notice_editor_target_id"
    selected_raw = st.session_state.get(target_key)
    selected_id = str(selected_raw) if selected_raw not in (None, "") else ""
    existing = rows_by_id.get(selected_id, {})
    if selected_id and not existing:
        st.session_state.pop(target_key, None)
        selected_id = ""

    def _reset_notice_form_state(record_id_for_state):
        """목록에서 다른 공지를 열 때 이전 편집기의 임시값이 섞이지 않도록 초기화합니다."""
        edit_token = f"notice_{record_id_for_state or 'new'}"
        _clear_notice_editor_state(edit_token)
        for suffix in [
            "_title", "_level", "_pinned", "_active", "_use_schedule",
            "_start_date", "_start_time", "_end_date", "_end_time", "_restore_from_archive",
        ]:
            st.session_state.pop(f"{edit_token}{suffix}", None)

    # -----------------------------------------------------------------
    # 1) 게시·보관 목록: 제목 또는 수정 버튼을 누르면 해당 공지가 편집기에 로드됩니다.
    # -----------------------------------------------------------------
    st.markdown("#### 게시·보관 목록")
    if not rows:
        st.caption("작성된 공지사항이 없습니다. 아래에서 새 공지를 작성해 주세요.")
    else:
        # 활성 공지를 먼저, 보관된 공지를 나중에 표시합니다. 같은 상태 안에서는 최신순입니다.
        ordered_rows = sorted(
            rows,
            key=lambda row: (
                1 if _as_bool(row.get("deleted")) else 0,
                -int(row.get("id") or 0),
            ),
        )
        for row in ordered_rows:
            row_id = row.get("id")
            title_value = str(row.get("title") or "제목 없음")
            level = str(row.get("notice_level") or "일반")
            is_deleted = _as_bool(row.get("deleted"))
            is_active = _as_bool(row.get("is_active"), True)
            is_visible = _is_currently_visible(row)
            if is_deleted:
                status_label = "보관됨"
            elif not is_active:
                status_label = "게시 중지"
            elif is_visible:
                status_label = "게시 중"
            else:
                status_label = "예약·기간 종료"

            preview_text = _notice_plain_text_from_blocks(_notice_blocks_from_record(row))
            preview_text = re.sub(r"\s+", " ", preview_text).strip()
            if len(preview_text) > 95:
                preview_text = preview_text[:95].rstrip() + "…"

            with st.container(border=True):
                title_col, status_col, action_col = st.columns([6.2, 1.8, 1.6])
                with title_col:
                    # 제목 자체를 버튼으로 두어 목록에서 바로 편집할 수 있게 합니다.
                    if st.button(
                        f"{_content_level_icon(level)} #{row_id} · {title_value}",
                        key=f"notice_open_title_{row_id}",
                        use_container_width=True,
                    ):
                        _reset_notice_form_state(row_id)
                        st.session_state[target_key] = int(row_id)
                        st.rerun()
                    if preview_text:
                        st.caption(preview_text)
                    modified_at = _format_kst_display(row.get("updated_at") or row.get("created_at"))
                    meta = f"{_content_level_label(level)} · {modified_at or '-'}"
                    if _as_bool(row.get("is_pinned")):
                        meta += " · 상단 고정"
                    st.caption(meta)
                with status_col:
                    st.markdown(f"**{status_label}**")
                    if row.get("display_start_at") or row.get("display_end_at"):
                        st.caption("게시 기간 설정됨")
                with action_col:
                    if st.button("내용 수정", key=f"notice_open_edit_{row_id}", use_container_width=True):
                        _reset_notice_form_state(row_id)
                        st.session_state[target_key] = int(row_id)
                        st.rerun()

    top_col, status_col = st.columns([2, 6])
    with top_col:
        if st.button("＋ 새 공지 작성", key="notice_open_new", use_container_width=True):
            _reset_notice_form_state(None)
            st.session_state.pop(target_key, None)
            st.rerun()
    with status_col:
        if existing:
            state_text = "보관 상태" if _as_bool(existing.get("deleted")) else "편집 중"
            st.info(f"현재 #{existing.get('id')} 공지를 {state_text}입니다. 수정한 뒤 아래 ‘공지사항 저장’을 누르세요.")
        else:
            st.caption("새 공지 작성 모드입니다. 저장하면 게시·보관 목록에 추가됩니다.")

    st.divider()

    # -----------------------------------------------------------------
    # 2) 선택된 공지의 편집기
    # -----------------------------------------------------------------
    if existing:
        st.markdown(f"#### ✏️ 공지 수정 · #{existing.get('id')}")
    else:
        st.markdown("#### ✍️ 새 공지 작성")

    record_id = existing.get("id")
    token = f"notice_{record_id or 'new'}"
    title_key = f"{token}_title"
    if title_key not in st.session_state:
        st.session_state[title_key] = str(existing.get("title") or "")
    title = st.text_input("공지 제목", key=title_key, max_chars=120)

    c1, c2 = st.columns(2)
    with c1:
        level_key = f"{token}_level"
        if level_key not in st.session_state:
            st.session_state[level_key] = str(existing.get("notice_level") or "일반")
        notice_level = st.selectbox("공지 구분", ["일반", "중요", "점검"], key=level_key)

        pinned_key = f"{token}_pinned"
        if pinned_key not in st.session_state:
            st.session_state[pinned_key] = _as_bool(existing.get("is_pinned"))
        is_pinned = st.checkbox("첫 화면 상단에 고정 표시", key=pinned_key)
    with c2:
        active_key = f"{token}_active"
        if active_key not in st.session_state:
            st.session_state[active_key] = _as_bool(existing.get("is_active"), True)
        is_active = st.checkbox("바로 게시", key=active_key)
        if existing.get("updated_at"):
            st.caption(f"최근 수정: {_format_kst_display(existing.get('updated_at'))}")

    restore_from_archive = False
    if existing and _as_bool(existing.get("deleted")):
        restore_key = f"{token}_restore_from_archive"
        if restore_key not in st.session_state:
            st.session_state[restore_key] = True
        restore_from_archive = st.checkbox(
            "보관 상태를 해제하고 다시 목록에 게시합니다.",
            key=restore_key,
        )
        st.caption("체크하지 않고 저장하면 보관 상태를 유지한 채 내용만 수정합니다.")

    _, start_at, end_at = _render_schedule_inputs(token, existing)
    blocks = render_notice_block_editor(token, existing)

    save_col, reset_col = st.columns([3, 1])
    with save_col:
        save_clicked = st.button("공지사항 저장", key=f"{token}_save", use_container_width=True)
    with reset_col:
        if record_id and st.button("저장 전 내용 되돌리기", key=f"{token}_reset", use_container_width=True):
            _reset_notice_form_state(record_id)
            st.rerun()

    if save_clicked:
        if not title.strip():
            st.warning("공지 제목을 입력해 주세요.")
        elif start_at == "INVALID":
            st.warning("게시 기간을 다시 확인해 주세요.")
        else:
            old_blocks = _notice_blocks_from_record(existing)
            uploaded_metas: list[dict] = []
            uploaded_attachment_metas: list[dict] = []
            try:
                prepared_blocks, uploaded_metas, uploaded_attachment_metas = _prepare_notice_blocks_for_save(blocks)
                plain_content = _notice_plain_text_from_blocks(prepared_blocks)
                prepared_document = _get_notice_document(prepared_blocks)
                attachment_names = [
                    str(_normalize_notice_attachment(item, index).get("attachment_original_file_name") or "첨부파일")
                    for index, item in enumerate(prepared_document.get("attachments") or [])
                ]
                if not plain_content and not attachment_names:
                    raise ValueError("공지 본문, 이미지 또는 첨부파일을 하나 이상 입력해 주세요.")
                if not plain_content and attachment_names:
                    plain_content = "첨부파일: " + ", ".join(attachment_names)
                if len(plain_content) > 5000:
                    raise ValueError("공지 본문의 텍스트 길이가 5,000자를 초과했습니다. 내용을 줄여 주세요.")

                payload = {
                    "title": title.strip(),
                    "content": plain_content,
                    "content_blocks": prepared_blocks,
                    "content_format": "document-v2",
                    "notice_level": notice_level,
                    "is_pinned": is_pinned,
                    "is_active": is_active,
                    "display_start_at": start_at,
                    "display_end_at": end_at,
                }
                if existing and _as_bool(existing.get("deleted")) and restore_from_archive:
                    payload["deleted"] = False
                if not record_id:
                    payload["created_by"] = "admin"
                    if is_active:
                        payload["published_at"] = _utc_now_iso()
                elif is_active and not existing.get("published_at"):
                    payload["published_at"] = _utc_now_iso()

                saved = _save_platform_content(PLATFORM_NOTICE_TABLE, record_id, payload)
                for bucket_name, path in _notice_image_refs(old_blocks) - _notice_image_refs(prepared_blocks):
                    delete_platform_notice_image_by_values(bucket_name, path)
                for bucket_name, path in _notice_attachment_refs(old_blocks) - _notice_attachment_refs(prepared_blocks):
                    delete_platform_notice_attachment_by_values(bucket_name, path)
                _reset_notice_form_state(record_id)

                # 새 공지는 저장 직후 방금 만든 공지를 바로 편집 상태로 유지합니다.
                saved_id = saved.get("id") if isinstance(saved, dict) else None
                if saved_id:
                    st.session_state[target_key] = int(saved_id)
                elif record_id:
                    st.session_state[target_key] = int(record_id)
                else:
                    st.session_state.pop(target_key, None)
                st.success("공지사항을 저장했습니다.")
                st.rerun()
            except Exception as exc:
                for meta in uploaded_metas:
                    delete_platform_notice_image_by_values(meta.get("image_bucket"), meta.get("image_path"))
                for meta in uploaded_attachment_metas:
                    delete_platform_notice_attachment_by_values(meta.get("attachment_bucket"), meta.get("attachment_path"))
                st.error("공지사항을 저장하지 못했습니다.")
                st.caption(str(exc))

    # -----------------------------------------------------------------
    # 3) 보관·복구 관리: 기존 기능은 유지하되 편집 흐름과 분리합니다.
    # -----------------------------------------------------------------
    if rows:
        with st.expander("보관·복구 관리", expanded=False):
            st.caption("숨김 처리한 공지는 DB에 보관됩니다. 목록에서 다시 불러와 수정하거나, 여기서 바로 복구할 수 있습니다.")
            active_rows = [row for row in rows if not _as_bool(row.get("deleted"))]
            hidden_rows = [row for row in rows if _as_bool(row.get("deleted"))]
            c1, c2 = st.columns(2)
            with c1:
                hide_options = {f"#{row['id']} · {row.get('title')}": row.get("id") for row in active_rows}
                selected_hide = st.selectbox(
                    "보관 처리할 공지",
                    ["선택해 주세요."] + list(hide_options.keys()),
                    key="notice_hide_select",
                )
                if st.button("선택 공지 보관", key="notice_soft_delete", disabled=selected_hide == "선택해 주세요."):
                    soft_delete_record(PLATFORM_NOTICE_TABLE, hide_options[selected_hide])
                    if str(st.session_state.get(target_key) or "") == str(hide_options[selected_hide]):
                        _reset_notice_form_state(hide_options[selected_hide])
                    st.success("공지사항을 보관 처리했습니다.")
                    st.rerun()
            with c2:
                restore_options = {f"#{row['id']} · {row.get('title')}": row.get("id") for row in hidden_rows}
                selected_restore = st.selectbox(
                    "복구할 보관 공지",
                    ["선택해 주세요."] + list(restore_options.keys()),
                    key="notice_restore_select",
                )
                if st.button("선택 공지 복구", key="notice_restore", disabled=selected_restore == "선택해 주세요."):
                    restored_id = restore_options[selected_restore]
                    restore_record(PLATFORM_NOTICE_TABLE, restored_id)
                    _reset_notice_form_state(restored_id)
                    st.session_state[target_key] = int(restored_id)
                    st.success("공지사항을 다시 게시 목록으로 복구했습니다. 아래 편집기에서 내용을 이어서 수정할 수 있습니다.")
                    st.rerun()


# 공지사항을 관리자 데이터 관리 화면에서 영구 삭제할 때, 연결된 공지 이미지도 함께 정리합니다.
_hard_delete_record_base = hard_delete_record

def hard_delete_record(table_name, record_id):
    if table_name != PLATFORM_NOTICE_TABLE:
        return _hard_delete_record_base(table_name, record_id)
    try:
        rows = _response_data(
            supabase.table(PLATFORM_NOTICE_TABLE)
            .select("content_blocks")
            .eq("id", int(record_id))
            .limit(1)
            .execute()
        )
        if rows:
            notice_blocks = _notice_blocks_from_record(rows[0])
            for bucket_name, path in _notice_image_refs(notice_blocks):
                delete_platform_notice_image_by_values(bucket_name, path)
            for bucket_name, path in _notice_attachment_refs(notice_blocks):
                delete_platform_notice_attachment_by_values(bucket_name, path)
    except Exception:
        pass
    supabase.table(PLATFORM_NOTICE_TABLE).delete().eq("id", int(record_id)).execute()


def install_notice_editor_copy_guard():
    """공지 본문 입력 중 Ctrl/Cmd+C가 앱 전역 단축키로 해석되지 않게 합니다.

    기본 복사 동작은 막지 않고 이벤트 전파만 차단하므로 Windows Ctrl+C와 Mac Cmd+C 모두
    텍스트 영역에서 정상 복사됩니다.
    """
    components.html(
        """
        <script>
        (function () {
            const win = window.parent;
            const doc = win.document;
            const MARKER = '__wittiNoticeEditorCopyGuardInstalled';
            if (win[MARKER]) return;
            win[MARKER] = true;

            function isEditableTarget(target) {
                if (!target) return false;
                const tag = String(target.tagName || '').toLowerCase();
                return tag === 'textarea' || tag === 'input' || target.isContentEditable === true;
            }

            function guardCopy(event) {
                const key = String(event.key || '').toLowerCase();
                if (!(event.ctrlKey || event.metaKey) || key !== 'c') return;
                if (!isEditableTarget(doc.activeElement)) return;
                // preventDefault()는 호출하지 않습니다. 브라우저의 복사 기능은 그대로 유지합니다.
                event.stopImmediatePropagation();
                event.stopPropagation();
            }

            win.addEventListener('keydown', guardCopy, true);
            win.addEventListener('keyup', guardCopy, true);
        })();
        </script>
        """,
        height=0,
        width=0,
    )


# 첫 화면의 고정 공지와 방문 팝업은 관리자에서 작성·게시합니다.
# 공지 본문 링크는 Streamlit 및 모바일 인앱 브라우저에서도 직접 열리도록 한 번 등록합니다.
install_notice_editor_copy_guard()
install_notice_link_click_handler()
render_active_notice_banner()
render_active_popup_if_needed()

# =========================
# 공개 기능 설정
# - False: 알림장 기능은 코드와 기존 기록을 보존한 채 사용자 화면에서 숨깁니다.
# - True: 기존 알림장 탭을 다시 노출합니다.
# =========================
SHOW_DIARY_FEATURE = False

with st.sidebar:
    st.header("⚙️ 설정")
    top_k = st.slider("선별할 사진 수", min_value=1, max_value=20, value=10)

    # 알림장 기능이 숨김 상태일 때는 관련 설정도 사용자 화면에 보이지 않습니다.
    if SHOW_DIARY_FEATURE:
        max_summary_sentences = st.slider("알림장 요약 문장 수", min_value=1, max_value=10, value=6)
    else:
        max_summary_sentences = 6

    st.divider()
    st.markdown("### 🌿 이용 안내")
    st.caption("☞ 사진 선별, 사진 기반 놀이 기록 생성, 사진 보정, 개인 기록 관리를 한 곳에서 사용할 수 있습니다.")
    st.caption("☞ 업로드한 사진과 입력한 내용은 서비스 기능 실행을 위해서만 사용됩니다.")
    st.markdown(
        f"""
        <div class="small-guide" style="margin-top:10px; padding:12px 14px;">
        🔗 {WITTI_SITE_LABEL}: <a href="{WITTI_SITE_URL}" target="_blank" rel="noopener noreferrer">{WITTI_SITE_URL}</a><br>
        ✉️ {WITTI_CONTACT_LABEL}: <strong>{WITTI_CONTACT_EMAIL}</strong>
        </div>
        """,
        unsafe_allow_html=True,
    )

force_sidebar_collapsed_on_first_load()
apply_sidebar_open_hint()
apply_mobile_settings_launcher()
apply_multiselect_korean_labels()
purge_expired_private_records_once_per_session()

tab_labels = ["💬 소통", "🧚‍♀️ 기록 요정", "✨ 사진 보정", "📢 공지사항", "👤 내 정보 보기", "🔐 관리자"]
tabs = st.tabs(tab_labels)
tab1, tab2, tab3, tab_notice, tab6, tab7 = tabs

work_dir = Path(tempfile.mkdtemp())
input_image_dir = work_dir / "input_images"
input_image_dir.mkdir(parents=True, exist_ok=True)


def send_verification_email(to_email, code):
    sender_email = st.secrets["email"]["sender"]
    app_password = st.secrets["email"]["password"]

    subject = "[놀이 기록 자동화] 이메일 인증번호 안내"

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
        🌿 놀이 기록 자동화
    </div>

    <div style="font-size:20px; font-weight:600; margin-bottom:24px;">
        이메일 인증번호 안내
    </div>

    <div style="font-size:16px; line-height:1.8; margin-bottom:28px;">
        안녕하세요.<br>
        놀이 기록 자동화 이메일 인증번호를 안내드립니다.<br><br>
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
        "가입자가 직접 만든 아이디와 비밀번호로 로그인합니다. 이메일 인증은 회원가입과 아이디·비밀번호 찾기에 사용됩니다.",
        ["아이디 로그인", "이메일 인증", "회원가입", "아이디·비밀번호 찾기"]
    )

    login_tab, join_tab, recovery_tab = st.tabs(["로그인", "회원가입", "아이디·비밀번호 찾기"])

    with login_tab:
        st.markdown("### 아이디 로그인")
        if member_is_logged_in():
            st.success(f"{st.session_state.get('member_platform_id') or '회원'}님이 로그인되어 있습니다.")
            if st.button("로그아웃", key="communication_logout"):
                clear_member_session()
                st.rerun()
        else:
            login_id = st.text_input("아이디", placeholder="회원가입 시 직접 만든 아이디", key="member_login_id")
            login_password = st.text_input("비밀번호", type="password", placeholder="비밀번호 입력", key="member_login_password")
            if st.button("로그인", key="member_login_button"):
                if not login_id.strip() or not login_password:
                    st.warning("아이디와 비밀번호를 모두 입력해 주세요.")
                else:
                    success, result = authenticate_member(login_id, login_password)
                    if success:
                        st.success(f"로그인되었습니다. 아이디: {result}")
                        st.rerun()
                    else:
                        st.error(result)
                        auth_detail = str(st.session_state.get("_last_auth_error_detail") or "").strip()
                        if auth_detail:
                            with st.expander("오류 확인용 상세 정보", expanded=True):
                                st.code(auth_detail, language="text")
                                st.caption("이 내용에는 비밀번호·서비스 키·사진 파일은 표시되지 않습니다. 화면을 캡처해 보내면 원인을 정확히 분리할 수 있습니다.")

    with join_tab:
        st.markdown("### 1. 기관 기본 정보")
        institution_name = st.text_input("기관명", placeholder="예: 한솔 / 아이키움", key="join_institution_name")
        institution_group = st.selectbox("기관 구분", ["- 선택 -", "어린이집", "유치원"], key="join_institution_group")
        if institution_group == "유치원":
            institution_type = st.selectbox("유치원 유형", ["- 선택 -", "국립", "공립 단설", "공립 병설", "사립 법인", "사립 사인", "기타"], key="join_kinder_type")
        elif institution_group == "어린이집":
            institution_type = st.selectbox("어린이집 유형", ["- 선택 -", "국공립", "사회복지법인", "법인·단체 등", "민간", "가정", "협동", "직장", "기타"], key="join_childcare_type")
        else:
            institution_type = "- 선택 -"
        institution_feature = st.multiselect("기관 특성", ["일반", "장애통합", "다문화", "야간연장", "시간제보육", "방과후 과정", "숲·생태 특화", "놀이중심 운영", "부모참여 활성화", "기타"], key="join_institution_feature", placeholder="선택해 주세요.")

        st.markdown("### 2. 기관 연락처")
        phone_col1, phone_col2 = st.columns([1, 3])
        with phone_col1:
            area_code = st.selectbox("지역번호", ["02", "031", "032", "033", "041", "042", "043", "044", "051", "052", "053", "054", "055", "061", "062", "063", "064", "070"], key="join_area_code")
        with phone_col2:
            phone_number = st.text_input("기관 연락처", placeholder="예: 1234-5678", key="join_phone_number")
        full_phone = f"{area_code}-{phone_number}" if phone_number else ""

        st.markdown("### 3. 가입자 정보")
        user_col1, user_col2 = st.columns([2, 2])
        with user_col1:
            subscriber_name = st.text_input("가입자 성명", placeholder="예: 홍길동", key="join_subscriber_name")
        with user_col2:
            position = st.selectbox("직책", ["- 선택 -", "원장", "원감", "선임교사", "주임교사", "경력교사", "신입교사", "예비(실습)교사", "기타"], key="join_position")

        st.markdown("### 4. 계정 정보")
        member_username = st.text_input("아이디", placeholder="영문 소문자·숫자·밑줄(_) 4~20자", key="join_member_username")
        st.caption("아이디는 로그인과 기록 소유자 구분에 사용됩니다. 가입 후 변경은 관리자 문의로 처리합니다.")
        password_col1, password_col2 = st.columns(2)
        with password_col1:
            member_password = st.text_input("비밀번호", type="password", placeholder="8자 이상 입력", key="join_member_password")
        with password_col2:
            member_password_confirm = st.text_input("비밀번호 확인", type="password", placeholder="비밀번호를 한 번 더 입력", key="join_member_password_confirm")
        st.caption("비밀번호는 Supabase Auth에만 해시 형태로 저장되며, 플랫폼 프로필 DB에는 저장하지 않습니다.")

        st.markdown("### 5. 이메일 정보 및 인증")
        email_col1, email_col2 = st.columns([2, 2])
        with email_col1:
            email_id = st.text_input("이메일 아이디", placeholder="예: witti", key="join_email_id")
        with email_col2:
            email_domain = st.selectbox("이메일 도메인", ["- 선택 -", "gmail.com", "naver.com", "daum.net", "hanmail.net", "kakao.com", "직접 입력"], key="join_email_domain")
        custom_domain = ""
        if email_domain == "직접 입력":
            custom_domain = st.text_input("도메인 직접 입력", placeholder="예: example.com", key="join_custom_domain")
            email = f"{email_id}@{custom_domain}" if email_id and custom_domain else ""
        elif email_domain != "- 선택 -":
            email = f"{email_id}@{email_domain}" if email_id else ""
        else:
            email = ""

        verify_col1, verify_col2, verify_col3 = st.columns([1.2, 2.2, 1])
        with verify_col1:
            send_code = st.button("인증번호 받기", key="signup_email_code_send", use_container_width=True)
        with verify_col2:
            input_code = st.text_input("인증번호 입력", placeholder="6자리 인증번호", label_visibility="collapsed", key="signup_email_code_input")
        with verify_col3:
            verify_email = st.button("인증 확인", key="signup_email_code_verify", use_container_width=True)
        if send_code:
            if not email:
                st.warning("이메일을 먼저 입력해 주세요.")
            else:
                try:
                    code = issue_email_verification(email, "signup")
                    send_verification_email(email, code)
                    st.session_state["signup_verified_email"] = ""
                    st.success("인증번호를 이메일로 보냈습니다.")
                except Exception as exc:
                    st.error("인증번호를 발송하지 못했습니다.")
                    st.caption(str(exc))
        if verify_email:
            verified, message = verify_email_verification(email, "signup", input_code)
            if verified:
                st.session_state["signup_verified_email"] = email.strip().lower()
                st.success(message)
            else:
                st.warning(message)
        st.caption("인증번호는 5분 동안 유효하며, DB에는 인증번호 원문 대신 해시값만 저장됩니다.")

        st.markdown("### 6. 제공 정보 동의 및 제출")
        privacy_agree = st.checkbox("개인정보 수집 및 이용에 동의합니다. 입력한 정보는 서비스 제공, 문의 응대, 자료 안내 및 개선 목적으로만 활용됩니다.", key="join_privacy_agree")
        mailing_agree = st.checkbox("메일링 수신에 동의합니다. 놀이 기록 자동화 콘텐츠와 자료, 소식 안내를 이메일로 받아보겠습니다.", key="join_mailing_agree")
        if st.button("회원가입 완료", key="join_submit"):
            valid_username, username_result = validate_username(member_username)
            if get_supabase_auth_client() is None:
                st.error("로그인용 Supabase 공개 키가 설정되지 않았습니다. Streamlit Secrets의 supabase.anon_key를 확인해 주세요.")
            elif not valid_username:
                st.warning(username_result)
            elif not username_is_available(username_result):
                st.warning("이미 사용 중인 아이디입니다. 다른 아이디를 입력해 주세요.")
            elif not institution_name or institution_group == "- 선택 -" or institution_type == "- 선택 -":
                st.warning("기관명, 기관 구분, 기관 유형을 모두 입력해 주세요.")
            elif not phone_number or not subscriber_name or position == "- 선택 -":
                st.warning("기관 연락처, 가입자 성명, 직책을 모두 입력해 주세요.")
            elif len(member_password) < 8:
                st.warning("비밀번호는 8자 이상으로 입력해 주세요.")
            elif member_password != member_password_confirm:
                st.warning("비밀번호와 비밀번호 확인이 일치하지 않습니다.")
            elif not email or st.session_state.get("signup_verified_email") != email.strip().lower():
                st.warning("현재 이메일 주소의 인증을 완료해 주세요.")
            elif not privacy_agree:
                st.warning("개인정보 수집 및 이용 동의가 필요합니다.")
            else:
                created_user_id = ""
                try:
                    created_user_id = create_auth_member(email, member_password, username_result, subscriber_name)
                    save_subscriber({
                        "회원 UID": created_user_id,
                        "회원 ID": username_result,
                        "아이디": username_result,
                        "기관명": institution_name,
                        "기관 구분": institution_group,
                        "기관 유형": institution_type,
                        "기관 특성": ", ".join(institution_feature),
                        "기관 연락처": full_phone,
                        "가입자 성명": subscriber_name,
                        "직책": position,
                        "이메일": email.strip().lower(),
                        "개인정보 동의": privacy_agree,
                        "메일링 수신 동의": mailing_agree,
                    })
                    set_member_session(created_user_id, email.strip().lower(), username_result)
                    st.session_state["signup_verified_email"] = ""
                    st.success("회원가입이 완료되었습니다.")
                    st.info(f"내 아이디: {username_result}")
                except Exception as exc:
                    if created_user_id:
                        delete_auth_member(created_user_id)
                    st.error("회원가입을 완료하지 못했습니다. 아이디와 이메일 중복 여부를 확인해 주세요.")
                    st.caption(str(exc))

    with recovery_tab:
        st.markdown("### 아이디 찾기 · 비밀번호 재설정")
        recovery_email = st.text_input("가입 시 등록한 이메일", placeholder="예: witti@example.com", key="recovery_email")
        rec_col1, rec_col2, rec_col3 = st.columns([1.2, 2.2, 1])
        with rec_col1:
            send_recovery_code = st.button("인증번호 받기", key="recovery_email_code_send", use_container_width=True)
        with rec_col2:
            recovery_code = st.text_input("인증번호", placeholder="6자리 인증번호", label_visibility="collapsed", key="recovery_email_code_input")
        with rec_col3:
            verify_recovery_code = st.button("인증 확인", key="recovery_email_code_verify", use_container_width=True)
        if send_recovery_code:
            if not recovery_email.strip():
                st.warning("이메일을 입력해 주세요.")
            else:
                try:
                    code = issue_email_verification(recovery_email, "account_recovery")
                    send_verification_email(recovery_email, code)
                    st.session_state["recovery_verified_email"] = ""
                    st.success("인증번호를 이메일로 보냈습니다.")
                except Exception as exc:
                    st.error("인증번호를 발송하지 못했습니다.")
                    st.caption(str(exc))
        if verify_recovery_code:
            verified, message = verify_email_verification(recovery_email, "account_recovery", recovery_code)
            if verified:
                st.session_state["recovery_verified_email"] = recovery_email.strip().lower()
                st.success(message)
            else:
                st.warning(message)

        if st.session_state.get("recovery_verified_email") == recovery_email.strip().lower():
            found_id = find_member_id_by_email(recovery_email)
            if found_id:
                st.success(f"가입 아이디는 **{found_id}** 입니다.")
                st.markdown("#### 새 비밀번호 설정")
                new_pw1, new_pw2 = st.columns(2)
                with new_pw1:
                    new_password = st.text_input("새 비밀번호", type="password", key="recovery_new_password")
                with new_pw2:
                    new_password_confirm = st.text_input("새 비밀번호 확인", type="password", key="recovery_new_password_confirm")
                if st.button("비밀번호 재설정", key="recovery_reset_password"):
                    if len(new_password) < 8:
                        st.warning("새 비밀번호는 8자 이상으로 입력해 주세요.")
                    elif new_password != new_password_confirm:
                        st.warning("새 비밀번호와 확인 값이 일치하지 않습니다.")
                    else:
                        try:
                            reset_member_password_by_email(recovery_email, new_password)
                            st.session_state["recovery_verified_email"] = ""
                            st.success("비밀번호를 재설정했습니다. 새 비밀번호로 로그인해 주세요.")
                        except Exception as exc:
                            st.error(str(exc))
            else:
                st.warning("해당 이메일로 가입된 계정을 찾지 못했습니다.")

# =========================
# TAB 2. 기록 요정
# =========================
# =========================
# TAB 2. 기록 요정
# =========================

from typing import List


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


def validate_diary_text(text: str) -> tuple[bool, str]:
    """알림장 생성용 일지 입력이 단어/키워드가 아니라 문장인지 확인합니다."""
    cleaned = re.sub(r"\s+", " ", (text or "").strip())
    compact = re.sub(r"\s+", "", cleaned)
    tokens = re.findall(r"[가-힣A-Za-z0-9]+", cleaned)

    guide = (
        "일지 내용은 단어가 아니라 관찰된 장면이 드러나는 문장으로 입력해 주세요. "
        "예: 오늘 OO이는 블록을 쌓으며 친구와 놀이에 참여했습니다."
    )

    if not cleaned:
        return False, "요약할 일지 내용을 먼저 입력해 주세요."

    if len(compact) < 12 or len(tokens) < 3:
        return False, guide

    sentence_like_pattern = (
        r"(다|요|음|함|됨|임|했다|하였다|했습니다|합니다|습니다|있었다|보였다|나타났다|"
        r"참여했다|참여했습니다|놀이했다|놀이했습니다|경험했다|경험했습니다|보임|나타남|참여함|경험함)"
        r"(?:[.!?。]|\s*$)"
    )
    has_sentence_ending = bool(re.search(sentence_like_pattern, cleaned))
    has_sentence_punctuation = bool(re.search(r"[.!?。]", cleaned))

    if not (has_sentence_ending or has_sentence_punctuation):
        return False, guide

    return True, ""

INFANT_AGES = ["0세", "1세", "2세"]


def normalize_age(age: str | None) -> str:
    """입력 연령을 0세/1세/2세/3세/4세/5세 중 하나로 정규화합니다."""
    if not age:
        return "2세"
    age = str(age).strip()
    if age in ["만0세", "0", "0세", "영아0세"]:
        return "0세"
    if age in ["만1세", "1", "1세", "영아1세"]:
        return "1세"
    if age in ["만2세", "2", "2세", "영아2세"]:
        return "2세"
    if age in ["만3세", "3", "3세"]:
        return "3세"
    if age in ["만4세", "4", "4세"]:
        return "4세"
    if age in ["만5세", "5", "5세"]:
        return "5세"
    return age


def infant_stage(age: str | None) -> str:
    """0세와 1세는 0-1세 보육과정 언어로, 2세는 2세 보육과정 언어로 구분합니다."""
    age = normalize_age(age)
    if age in ["0세", "1세"]:
        return "0-1세"
    if age == "2세":
        return "2세"
    return "3-5세"


AGE_NOTICE = {
    "0세": "감각으로 주변을 만나고, 표정·소리·몸짓으로 반응하며 경험을 쌓아가고 있습니다.",
    "1세": "관심 있는 대상을 반복해서 살펴보고 조작하며, 몸짓·말소리·간단한 말로 표현을 시도하고 있습니다.",
    "2세": "좋아하는 놀이에 스스로 다가가고, 표정·몸짓·단어·짧은 말로 요구와 느낌을 표현하고 있습니다.",
    "3세": "상상과 역할을 더해 놀이를 확장해 가고 있습니다.",
    "4세": "친구들과 생각을 나누며 놀이를 이어가고 있습니다.",
    "5세": "규칙과 협력을 바탕으로 놀이를 주도해 가고 있습니다.",
}


# 연령별 금지 또는 주의 표현입니다. 템플릿 자체에서 피하고, 최종 문장에서도 한 번 더 정리합니다.
AGE_SENSITIVE_REPLACEMENTS = {
    "0세": {
        "친구와 함께하는 즐거움": "교사와 함께 있는 안정감",
        "친구와 함께": "교사 곁에서",
        "친구들과 함께": "교사와 함께",
        "또래와 함께": "또래가 있는 공간에서",
        "또래 또는 교사": "교사 또는 친숙한 사람",
        "또래 관계": "또래에게 보이는 관심",
        "관계를 맺고": "익숙한 사람에게 반응하고",
        "관계 형성": "안정감 형성",
        "사회적 조율": "교사의 도움을 받은 반응",
        "협력": "함께 있는 경험",
        "문제 해결": "반복 탐색",
        "자신의 생각을 표현": "표정과 소리, 몸짓으로 반응",
        "생각을 표현": "반응을 나타내",
        "생각을 나누": "반응을 주고받",
        "말로 표현": "표정과 몸짓으로 나타내",
        "단어로 표현": "소리와 몸짓으로 나타내",
        "말과 행동으로 표현": "표정, 소리, 몸짓으로 반응",
        "언어적 지원": "말소리와 몸짓 지원",
        "상상놀이": "익숙한 행동을 바라보거나 모방하는 놀이",
        "역할 놀이": "모방 놀이",
        "규칙과 약속": "반복되는 일과의 흐름",
        "자기조절": "정서적 안정",
        "비교하고": "살펴보고",
    },
    "1세": {
        "친구와 함께하는 즐거움": "또래 곁에서 놀이하는 경험",
        "친구들과 생각을 나누": "또래의 놀이를 보고 반응하",
        "또래 관계": "또래에게 보이는 관심",
        "사회적 조율": "교사의 도움을 받아 반응을 조절하는 경험",
        "협력": "곁에서 함께 경험하는 과정",
        "문제 해결": "반복해서 시도하는 경험",
        "의견": "반응",
        "규칙과 약속": "반복되는 일과의 흐름",
        "상상놀이": "익숙한 행동을 흉내 내는 놀이",
        "역할 놀이": "모방 놀이",
        "말로 표현": "몸짓과 말소리, 간단한 말로 나타내",
        "자신의 생각을 표현": "관심과 요구를 몸짓과 말소리로 나타내",
    },
    "2세": {
        "협력적 문제 해결": "교사의 도움을 받아 시도하는 경험",
        "사회적 조율": "또래와의 상황에서 교사의 도움을 받아 반응을 조절하는 경험",
        "의견을 나누": "짧은 말과 행동으로 반응을 주고받",
        "규칙을 주도": "간단한 약속을 경험",
        "놀이를 주도": "관심 있는 놀이를 선택",
    },
}


def age_sanitize(text: str, age: str | None) -> str:
    """연령에 비해 과성숙한 표현을 부드럽게 치환합니다.

    놀이 이야기는 문단과 단계별 줄바꿈이 의미를 가지므로, 공백만 정리하고
    줄바꿈(특히 문단 사이의 빈 줄)은 보존합니다.
    """
    age = normalize_age(age)
    text = text or ""
    replacements = AGE_SENSITIVE_REPLACEMENTS.get(age, {})
    for old, new in replacements.items():
        text = text.replace(old, new)

    # 문단 구조는 유지하고, 각 줄 안의 연속 공백만 정리합니다.
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    lines = [re.sub(r"[ \t]+", " ", line).strip() for line in text.split("\n")]
    text = "\n".join(lines)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


ACTIVITY_KEYWORDS_BY_AGE = {
    "0세": {
        "색깔": "색과 밝기, 촉감을 감각적으로 느끼는 놀이",
        "색": "색과 밝기, 촉감을 감각적으로 느끼는 놀이",
        "블록": "블록을 보고 만지고 두드리며 탐색하는 놀이",
        "물감": "색과 촉감을 손끝으로 경험하는 감각 놀이",
        "역할": "익숙한 행동을 바라보거나 따라 해 보는 모방 놀이",
        "바깥": "바깥의 빛, 소리, 바람을 감각으로 느끼는 시간",
        "산책": "주변 소리와 움직임, 자연물을 감각적으로 경험하는 산책",
        "동화": "책의 그림과 소리에 관심을 보이는 경험",
        "노래": "소리와 리듬에 반응하는 음악 경험",
        "점프": "몸의 움직임을 즐기고 균형을 경험하는 신체 놀이",
        "공": "공을 바라보고 만지며 움직임에 관심을 보이는 놀이",
        "모래": "모래의 촉감을 손으로 느껴보는 감각 놀이",
        "물": "물의 촉감과 움직임을 느껴보는 감각 놀이",
    },
    "1세": {
        "색깔": "색과 모양을 보고 만지며 탐색하는 놀이",
        "색": "색과 모양을 보고 만지며 탐색하는 놀이",
        "블록": "블록을 쌓고 무너뜨리며 반복해서 탐색하는 놀이",
        "물감": "미술 재료의 색과 촉감을 경험하는 감각 놀이",
        "역할": "익숙한 생활 행동을 흉내 내는 모방 놀이",
        "바깥": "몸을 움직이며 바깥 환경을 탐색하는 놀이",
        "산책": "주변 사물과 자연에 관심을 보이는 산책",
        "동화": "그림책을 보고 소리와 이야기에 관심을 보이는 경험",
        "노래": "리듬과 소리에 맞춰 몸을 움직이는 음악 경험",
        "점프": "몸을 움직이며 균형과 움직임을 경험하는 신체 놀이",
        "공": "공을 굴리고 따라가며 움직임을 경험하는 놀이",
        "모래": "모래를 담고 쏟으며 촉감과 변화를 탐색하는 놀이",
        "물": "물을 담고 쏟으며 움직임과 변화를 탐색하는 놀이",
    },
    "2세": {
        "색깔": "색과 모양의 같고 다름에 관심을 가지는 탐색 놀이",
        "색": "색과 모양의 같고 다름에 관심을 가지는 탐색 놀이",
        "블록": "블록을 쌓고 이어 붙이며 공간을 구성해 보는 놀이",
        "물감": "미술 재료의 색과 촉감을 활용해 표현해 보는 놀이",
        "역할": "익숙한 일상 경험을 말과 행동으로 나타내는 상상 놀이",
        "바깥": "몸을 움직이며 바깥 환경을 탐색하는 신체 놀이",
        "산책": "주변 자연과 사물에 호기심을 가지고 살펴보는 산책",
        "동화": "그림책을 보고 말놀이와 이야기에 관심을 보이는 경험",
        "노래": "리듬과 노래에 맞춰 움직임과 소리로 표현하는 음악 경험",
        "점프": "몸의 움직임을 조절하며 즐기는 신체 놀이",
        "공": "공을 굴리고 차며 움직임을 조절해 보는 놀이",
        "모래": "모래를 담고 쏟으며 형태와 변화를 탐색하는 감각 놀이",
        "물": "물을 담고 쏟으며 양과 움직임의 변화를 탐색하는 감각 놀이",
    },
}


def get_activity_description(original_text: str, summary: str, age: str | None) -> str:
    age = normalize_age(age)
    activity = "놀이와 일상 속 경험"
    bank = ACTIVITY_KEYWORDS_BY_AGE.get(age, ACTIVITY_KEYWORDS_BY_AGE["2세"])
    source = f"{original_text} {summary}"
    for keyword, value in bank.items():
        if keyword in source:
            return value
    return activity


SCOPE_INTRO_BY_AGE = {
    "0세": {
        "놀이 장면 중심": "놀이 장면에서",
        "일상생활 중심": "일상생활 속에서",
        "하루 전체 흐름": "하루의 흐름 속에서",
        "특별활동 중심": "새로운 경험 속에서",
    },
    "1세": {
        "놀이 장면 중심": "놀이 장면에서",
        "일상생활 중심": "일상생활 속에서",
        "하루 전체 흐름": "하루의 흐름 속에서",
        "특별활동 중심": "활동 경험 속에서",
    },
    "2세": {
        "놀이 장면 중심": "놀이 장면에서",
        "일상생활 중심": "일상생활 속에서",
        "하루 전체 흐름": "하루의 흐름 속에서",
        "특별활동 중심": "활동 경험 속에서",
    },
}


MEANING_MAP_BY_AGE = {
    "0세": {
        "알림장용": "이 과정은 감각으로 주변을 만나고, 안정감 속에서 반응을 쌓아가는 경험으로 이어졌습니다.",
        "기관 홍보용": "이러한 경험은 영아가 감각과 애착을 바탕으로 세상을 알아가는 과정으로 연결됩니다.",
        "관찰 기록용": "해당 장면은 감각 자극에 대한 반응, 정서적 안정감, 교사와의 상호작용을 살펴볼 수 있는 관찰 장면이었다.",
        "서술형 일지용": "이 경험은 영아가 감각적으로 주변을 탐색하고 안정된 관계 안에서 반응을 나타내는 과정으로 볼 수 있었다.",
    },
    "1세": {
        "알림장용": "이 과정은 관심 있는 대상을 반복해서 살펴보고, 몸짓과 말소리로 반응을 나타내는 경험으로 이어졌습니다.",
        "기관 홍보용": "이러한 경험은 영아가 반복 탐색과 모방을 통해 놀이의 즐거움을 알아가는 과정으로 연결됩니다.",
        "관찰 기록용": "해당 장면은 반복 탐색, 모방, 몸짓과 말소리를 통한 의사 표현을 살펴볼 수 있는 관찰 장면이었다.",
        "서술형 일지용": "이 경험은 영아가 관심 있는 대상에 다가가 반복적으로 시도하고 반응을 나타내는 과정으로 볼 수 있었다.",
    },
    "2세": {
        "알림장용": "이 과정은 좋아하는 놀이를 선택하고, 표정·몸짓·단어·짧은 말로 요구와 느낌을 표현하는 경험으로 이어졌습니다.",
        "기관 홍보용": "이러한 경험은 영아가 놀이 속에서 탐색, 표현, 또래 곁에서의 관계 경험을 넓혀가는 과정으로 연결됩니다.",
        "관찰 기록용": "해당 장면은 탐색, 표현, 또래 및 교사와의 상호작용을 살펴볼 수 있는 관찰 장면이었다.",
        "서술형 일지용": "이 경험은 영아의 흥미와 반응을 바탕으로 놀이가 이어지고 표현이 확장되는 과정으로 볼 수 있었다.",
    },
}


def extract_play_meaning(
    original_text: str,
    summary: str,
    daily_scope: str,
    record_type: str,
    age: str | None = "2세",
    child: str = "OO이",
) -> dict:
    age = normalize_age(age)
    clean_text = remove_bullets(summary) if "remove_bullets" in globals() else re.sub(r"\s+", " ", summary.replace("- ", " ")).strip()
    activity = get_activity_description(original_text, summary, age)
    scope_intro = SCOPE_INTRO_BY_AGE.get(age, SCOPE_INTRO_BY_AGE["2세"]).get(daily_scope, "놀이와 일상 속에서")
    meaning = MEANING_MAP_BY_AGE.get(age, MEANING_MAP_BY_AGE["2세"]).get(record_type, MEANING_MAP_BY_AGE["2세"]["알림장용"])
    return {
        "age": age,
        "child": child,
        "activity": activity,
        "summary_text": age_sanitize(clean_text, age),
        "scope_intro": scope_intro,
        "meaning": age_sanitize(meaning, age),
    }


def build_restructured_diary(
    original_text: str,
    summary: str,
    daily_scope: str,
    record_type: str,
    age: str | None = "2세",
    child: str = "OO이",
) -> str:
    info = extract_play_meaning(original_text, summary, daily_scope, record_type, age=age, child=child)
    age = info["age"]

    if record_type in ["관찰 기록용", "서술형 일지용"]:
        text = (
            f"{info['child']}는 {info['scope_intro']} {info['activity']}에 참여하는 모습이 나타났다.\n\n"
            f"주요 장면은 {info['summary_text']}\n\n"
            f"{info['meaning']}"
        )
        return age_sanitize(text, age)

    text = (
        f"오늘 {info['child']}는 {info['scope_intro']} {info['activity']}에 참여했습니다.\n\n"
        f"{info['child']}는 자신의 속도에 맞게 관심을 보이고, 익숙한 방식으로 탐색과 반응을 이어갔습니다.\n\n"
        f"{info['meaning']}"
    )
    return age_sanitize(text, age)


# 0~2세 보육과정 영역별 설명. 기존 6영역 UI와 호환되도록 기본생활/신체운동 명칭을 유지합니다.
CURRICULUM_RECORD_BY_AGE = {
    "0세": {
        "신체운동·건강": "도움을 받아 편안한 일과를 경험하고, 먹기·쉬기·배변 등 일상생활의 리듬을 알아가는 과정과 연결됩니다.",
        "의사소통": "표정, 몸짓, 울음, 옹알이와 말소리로 의사를 나타내고 주변 소리에 관심을 갖는 경험과 연결됩니다.",
        "사회관계": "교사와 친숙한 사람에게 안정감을 느끼고, 또래가 있는 공간에 관심을 보이는 경험과 연결됩니다.",
        "예술경험": "소리, 리듬, 색, 촉감에 감각적으로 반응하며 아름다움을 느끼는 경험과 연결됩니다.",
        "자연탐구": "보고 듣고 만지는 감각 경험을 통해 주변 사물과 자연에 관심을 갖는 과정과 연결됩니다.",
    },
    "1세": {
        "신체운동·건강":  "도움을 받으며 일과에 익숙해지고, 먹기·씻기·쉬기·배변 의사를 조금씩 나타내는 과정과 연결됩니다.",
        "의사소통": "표정, 몸짓, 말소리, 간단한 말로 관심과 요구를 나타내는 경험과 연결됩니다.",
        "사회관계": "친숙한 사람과 안정적인 관계를 맺고, 또래의 행동에 관심을 보이는 경험과 연결됩니다.",
        "예술경험": "소리와 리듬, 미술 재료의 촉감, 모방 행동을 즐기는 경험과 연결됩니다.",
        "자연탐구": "친숙한 사물과 자연을 감각으로 반복해서 탐색하는 경험과 연결됩니다.",
    },
    "2세": {
        "신체운동·건강": "몸의 움직임과 일상생활 습관을 함께 경험하며 건강하고 안전한 생활의 기초를 다지는 과정과 연결됩니다.",
        "의사소통": "표정, 몸짓, 단어, 짧은 말로 요구와 느낌을 나타내고 말놀이와 이야기에 관심을 갖는 경험과 연결됩니다.",
        "사회관계": "나와 다른 사람을 구별하고, 또래 곁에서 또는 함께 놀이하며 다른 사람의 감정과 행동에 반응하는 경험과 연결됩니다.",
        "예술경험": "노래, 리듬, 움직임, 미술 재료를 활용해 자신의 느낌을 표현해 보는 경험과 연결됩니다.",
        "자연탐구": "주변 사물과 자연을 반복해서 탐색하고, 같고 다름·수량·공간·변화에 관심을 갖는 경험과 연결됩니다.",
    },
}

CURRICULUM_RECORD_NOTE_BY_AGE = {
    age: {area: sentence.replace("습니다.", "음.").replace("됩니다.", "됨.") for area, sentence in areas.items()}
    for age, areas in CURRICULUM_RECORD_BY_AGE.items()
}


def get_curriculum_record(area: str, age: str | None = "2세", note: bool = False) -> str:
    age = normalize_age(age)
    bank = CURRICULUM_RECORD_NOTE_BY_AGE if note else CURRICULUM_RECORD_BY_AGE
    return bank.get(age, CURRICULUM_RECORD_BY_AGE["2세"]).get(area, "영아의 흥미와 발달 수준에 맞는 놀이 경험과 연결됩니다.")


DEVELOPMENT_RECORD_FORMAL_BY_AGE = {
    "0세": {
        "신체": "감각 자극에 반응하고 몸을 움직이며 신체를 알아가는 과정이 나타납니다.",
        "언어": "시선, 표정, 울음, 옹알이와 말소리로 의사를 나타내는 과정이 나타납니다.",
        "인지": "친숙한 자극에 관심을 보이고 반복 경험을 통해 주변을 알아가는 모습이 나타납니다.",
        "사회정서": "친숙한 교사와 안정감을 형성하고 정서적 반응을 나타내는 모습이 나타납니다.",
        "창의성": "소리, 움직임, 색, 촉감에 감각적으로 반응하며 자신만의 방식으로 경험합니다.",
    },
    "1세": {
        "신체": "대소근육을 사용해 움직임을 시도하고 감각으로 주변을 탐색하는 과정이 나타납니다.",
        "언어": "몸짓, 말소리, 간단한 말로 관심과 요구를 나타내는 과정이 나타납니다.",
        "인지": "관심 있는 대상을 반복해서 조작하고 변화에 반응하는 모습이 나타납니다.",
        "사회정서": "친숙한 사람과 안정감을 느끼고 또래의 행동에 관심을 보이는 모습이 나타납니다.",
        "창의성": "익숙한 소리, 움직임, 재료를 반복적으로 경험하며 모방과 표현을 즐깁니다.",
    },
    "2세": {
        "신체": "몸의 움직임을 조절하며 신체활동을 즐기는 과정이 나타납니다.",
        "언어": "표정, 몸짓, 단어, 짧은 말로 요구와 느낌을 표현하는 과정이 나타납니다.",
        "인지": "주변 사물의 같고 다름, 수량, 공간, 변화에 관심을 가지고 탐색하는 모습이 나타납니다.",
        "사회정서": "나와 다른 사람을 구별하고, 또래와의 놀이 상황에서 교사의 도움을 받아 반응을 조절하는 경험이 나타납니다.",
        "창의성": "일상 경험을 움직임, 소리, 미술 재료, 간단한 상상 놀이로 표현해 봅니다.",
    },
}

DEVELOPMENT_RECORD_NOTE_BY_AGE = {
    age: {area: sentence.replace("습니다.", "음.").replace("납니다.", "남.").replace("봅니다.", "봄.") for area, sentence in areas.items()}
    for age, areas in DEVELOPMENT_RECORD_FORMAL_BY_AGE.items()
}


def get_development_record(area: str, age: str | None = "2세", note: bool = False) -> str:
    age = normalize_age(age)
    bank = DEVELOPMENT_RECORD_NOTE_BY_AGE if note else DEVELOPMENT_RECORD_FORMAL_BY_AGE
    return bank.get(age, DEVELOPMENT_RECORD_FORMAL_BY_AGE["2세"]).get(area, "영아의 현재 관심과 발달적 변화를 이해할 수 있는 장면입니다.")


DIARY_MESSAGE_BANK_BY_AGE = {
    "0세": {
        "알림장용": {
            "팩트 중심형": [
                "오늘 OO이는 감각으로 주변을 살펴보며 하루를 보냈습니다.",
                "오늘 하루 중 OO이가 보인 표정과 반응을 중심으로 전해드립니다.",
                "OO이는 교사의 도움을 받으며 편안하게 일과를 경험했습니다.",
                "오늘 OO이가 관심을 보인 장면을 중심으로 공유드립니다.",
                "OO이는 자신의 속도에 맞게 놀이와 일상을 경험했습니다.",
                "오늘 관찰된 OO이의 시선, 손짓, 몸 움직임을 중심으로 전해드립니다.",
                "OO이는 익숙한 환경 안에서 안정적으로 머무르는 모습을 보였습니다.",
                "오늘 OO이가 감각적으로 반응한 장면을 정리해드립니다.",
                "OO이는 교사의 말소리와 몸짓에 반응하며 경험을 이어갔습니다.",
                "오늘의 작은 반응을 가정과 함께 나누고자 합니다.",
            ],
            "따뜻한 감성형": [
                "작은 눈빛과 손짓 속에서 OO이의 하루가 차근차근 채워졌습니다.",
                "OO이는 익숙한 품과 공간 안에서 편안하게 경험을 이어갔습니다.",
                "오늘 OO이의 작은 반응 하나가 참 소중하게 느껴졌습니다.",
                "OO이는 소리와 촉감, 빛에 천천히 반응하며 하루를 만났습니다.",
                "OO이만의 속도로 세상을 알아가는 장면이 있었습니다.",
                "교사의 곁에서 안정감을 느끼며 놀이를 경험했습니다.",
                "오늘 OO이의 표정 속에서 편안함과 호기심을 함께 볼 수 있었습니다.",
                "작은 손끝의 움직임에도 OO이의 관심이 담겨 있었습니다.",
                "OO이는 익숙한 일과 안에서 조금씩 반응을 넓혀갔습니다.",
                "오늘도 OO이의 하루에는 조용히 반짝이는 순간이 있었습니다.",
            ],
            "이모티콘 활용형": [
                "OO이가 감각으로 주변을 만나며 하루를 보냈습니다 😊",
                "작은 손짓과 표정이 참 소중했던 하루였습니다 🌱",
                "OO이는 교사 곁에서 편안하게 경험을 이어갔습니다 🌿",
                "오늘 OO이의 호기심이 작은 눈빛으로 나타났습니다 ✨",
                "OO이의 속도에 맞춰 천천히 하루를 경험했습니다 💛",
                "소리와 촉감에 반응하는 OO이의 모습이 보였습니다 😊",
                "오늘도 OO이의 작은 시도를 따뜻하게 지켜보았습니다 🌼",
                "OO이는 익숙한 환경 안에서 안정적으로 지냈습니다 🌿",
                "작은 반응 하나하나가 OO이의 배움이었습니다 ✨",
                "가정에서도 OO이의 편안한 하루를 함께 떠올려 주세요 😊",
            ],
            "전문적 설명형": [
                "오늘 장면에서는 OO이의 감각 반응과 정서적 안정감을 중심으로 살펴볼 수 있었습니다.",
                "OO이는 감각 자극에 반응하며 주변 환경을 알아가는 과정을 보였습니다.",
                "교사는 OO이의 신호에 민감하게 반응하며 안정적인 상호작용을 지원했습니다.",
                "해당 경험은 영아가 감각과 애착을 바탕으로 세상을 탐색하는 과정과 연결됩니다.",
                "OO이의 시선, 표정, 몸짓은 현재 관심과 요구를 이해하는 중요한 단서가 되었습니다.",
                "반복되는 일과 안에서 OO이는 예측 가능한 안정감을 경험했습니다.",
                "교사는 OO이가 부담 없이 감각 경험에 참여할 수 있도록 환경을 조절했습니다.",
                "오늘 활동은 신체·감각·정서 발달이 통합적으로 나타나는 장면이었습니다.",
                "OO이는 친숙한 사람과의 관계 안에서 반응을 확장해 가고 있습니다.",
                "이 장면은 영아의 개별적 속도를 존중한 지원이 필요한 순간으로 볼 수 있습니다.",
            ],
        }
    },
    "1세": {},
    "2세": {},
}

# 1세, 2세는 0세 구조를 복사하지 않고 별도 문장을 둡니다.
DIARY_MESSAGE_BANK_BY_AGE["1세"] = {
    "알림장용": {
        "팩트 중심형": [
            "오늘 OO이는 관심 있는 놀잇감을 반복해서 살펴보며 놀이했습니다.",
            "OO이는 몸짓과 말소리로 자신의 관심을 나타냈습니다.",
            "오늘 하루 중 OO이가 스스로 다가간 놀이 장면을 전해드립니다.",
            "OO이는 교사의 도움을 받으며 놀이를 이어갔습니다.",
            "오늘 OO이는 익숙한 일과 안에서 안정적으로 참여했습니다.",
            "OO이는 또래가 놀이하는 모습을 바라보고 가까이 다가가는 모습을 보였습니다.",
            "관심 있는 대상을 만지고 움직이며 반복적으로 탐색했습니다.",
            "OO이는 간단한 말소리와 몸짓으로 요구를 나타냈습니다.",
            "오늘의 경험은 OO이가 자신의 방식으로 놀이에 참여한 장면입니다.",
            "OO이의 탐색과 반응을 중심으로 오늘의 모습을 전해드립니다.",
        ],
        "따뜻한 감성형": [
            "OO이는 마음이 끌리는 놀잇감에 천천히 다가가며 하루를 채웠습니다.",
            "반복해서 시도하는 모습 속에서 OO이의 호기심이 느껴졌습니다.",
            "작은 말소리와 손짓이 OO이의 마음을 전해 주었습니다.",
            "OO이는 익숙한 일과 안에서 편안하게 자신을 표현했습니다.",
            "또래의 놀이를 바라보며 OO이만의 방식으로 함께 있는 경험을 했습니다.",
            "OO이의 작은 시도가 오늘의 소중한 장면이 되었습니다.",
            "놀이를 반복하는 과정에서 안정감과 즐거움이 함께 나타났습니다.",
            "OO이는 교사의 곁에서 조금씩 놀이에 몰입했습니다.",
            "오늘 OO이의 하루에는 스스로 해보고 싶은 마음이 담겨 있었습니다.",
            "OO이의 표정과 움직임에서 놀이의 즐거움이 느껴졌습니다.",
        ],
        "이모티콘 활용형": [
            "OO이가 관심 있는 놀잇감을 반복해서 탐색했습니다 😊",
            "작은 몸짓과 말소리로 마음을 전해 주었습니다 🌱",
            "OO이의 호기심이 놀이 속에서 자라났습니다 ✨",
            "오늘도 OO이만의 속도로 놀이를 경험했습니다 🌿",
            "또래 곁에서 함께 있는 경험을 해보았습니다 💛",
            "OO이의 반복적인 시도가 반가운 하루였습니다 😊",
            "교사의 도움 속에서 안정적으로 놀이에 참여했습니다 🌼",
            "OO이의 작은 표현을 함께 응원해 주세요 ✨",
            "놀이 속에서 OO이의 관심이 조금씩 넓어졌습니다 🌱",
            "가정에서도 오늘의 작은 시도를 따뜻하게 격려해 주세요 😊",
        ],
        "전문적 설명형": [
            "오늘 장면에서는 OO이의 반복 탐색과 몸짓·말소리 표현을 중심으로 살펴볼 수 있었습니다.",
            "OO이는 관심 있는 대상에 스스로 다가가며 자발적 탐색을 시도했습니다.",
            "교사는 OO이의 반응을 관찰하며 놀이가 지속될 수 있도록 필요한 지원을 제공했습니다.",
            "해당 경험은 감각 탐색, 모방, 초기 의사소통 경험과 연결됩니다.",
            "OO이는 또래의 행동에 관심을 보이며 사회적 관심의 기초를 나타냈습니다.",
            "반복 조작은 OO이가 사물의 특성과 변화를 알아가는 과정으로 볼 수 있습니다.",
            "OO이의 몸짓과 말소리는 요구와 흥미를 이해하는 중요한 단서가 되었습니다.",
            "교사는 안정적인 환경 안에서 OO이의 탐색을 확장할 수 있도록 지원했습니다.",
            "오늘 활동은 영아의 개별적 속도와 현재 흥미가 드러난 장면이었습니다.",
            "놀이 과정에서 OO이는 감각, 신체, 의사소통 경험을 통합적으로 경험했습니다.",
        ],
    }
}

DIARY_MESSAGE_BANK_BY_AGE["2세"] = {
    "알림장용": {
        "팩트 중심형": [
            "오늘 OO이는 관심 있는 놀이를 선택하고 참여하는 모습을 보였습니다.",
            "OO이는 표정, 몸짓, 단어, 짧은 말로 자신의 요구와 느낌을 나타냈습니다.",
            "오늘의 놀이 장면에서 OO이의 탐색과 표현이 함께 나타났습니다.",
            "OO이는 또래 곁에서 놀이하며 주변의 반응을 살펴보았습니다.",
            "교사의 지원 속에서 놀이를 안정적으로 이어갔습니다.",
            "OO이는 놀이 자료를 반복해서 사용하며 변화를 탐색했습니다.",
            "오늘 하루 중 OO이가 스스로 시도한 장면을 중심으로 전해드립니다.",
            "OO이는 익숙한 일과 안에서 자신의 선호를 나타냈습니다.",
            "놀이 과정에서 OO이의 관심, 선택, 표현이 관찰되었습니다.",
            "오늘 경험은 OO이의 탐색과 초기 관계 경험을 이해할 수 있는 장면입니다.",
        ],
        "따뜻한 감성형": [
            "OO이는 좋아하는 놀이에 스스로 다가가며 즐거움을 느꼈습니다.",
            "짧은 말과 표정 속에서 OO이의 마음이 잘 전해졌습니다.",
            "OO이의 작은 선택들이 모여 의미 있는 하루가 되었습니다.",
            "또래 곁에서 놀이하는 모습 속에 함께하는 경험이 조금씩 쌓였습니다.",
            "반복해서 해보는 모습에서 OO이의 몰입이 느껴졌습니다.",
            "OO이는 자신의 방식으로 놀이를 즐기며 표현을 넓혀갔습니다.",
            "오늘 OO이의 시도에는 해보고 싶은 마음이 담겨 있었습니다.",
            "교사의 도움을 받아 안정적으로 놀이를 이어가는 모습이 보였습니다.",
            "OO이가 보여준 작은 말과 행동이 오늘의 반짝이는 장면이었습니다.",
            "OO이의 하루 안에 탐색과 표현의 순간이 따뜻하게 쌓였습니다.",
        ],
        "이모티콘 활용형": [
            "OO이가 좋아하는 놀이에 스스로 다가갔습니다 😊",
            "짧은 말과 몸짓으로 마음을 표현해 보았습니다 🌱",
            "놀이 속에서 OO이의 호기심이 반짝였습니다 ✨",
            "또래 곁에서 함께 놀이하는 경험을 했습니다 💛",
            "반복해서 시도하며 놀이를 즐겼습니다 🌿",
            "OO이의 작은 선택을 따뜻하게 응원해 주세요 😊",
            "오늘도 OO이만의 방식으로 탐색하고 표현했습니다 🌼",
            "교사의 도움 속에서 안정적으로 놀이를 이어갔습니다 ✨",
            "OO이의 짧은 말과 표정이 참 반가웠습니다 🌱",
            "가정에서도 오늘의 놀이 이야기를 편안하게 나누어 주세요 😊",
        ],
        "전문적 설명형": [
            "오늘 장면에서는 OO이의 놀이 선택, 탐색, 초기 의사 표현을 중심으로 살펴볼 수 있었습니다.",
            "OO이는 표정, 몸짓, 단어, 짧은 말을 활용해 자신의 요구와 느낌을 나타냈습니다.",
            "또래와의 상황에서는 교사의 지원을 통해 함께 놀이하는 경험을 이어갔습니다.",
            "해당 경험은 탐색, 표현, 사회정서 발달이 통합적으로 나타나는 장면입니다.",
            "반복적인 시도는 OO이가 사물의 특성과 변화를 알아가는 과정으로 볼 수 있습니다.",
            "교사는 OO이의 관심을 바탕으로 놀이가 안정적으로 지속될 수 있도록 지원했습니다.",
            "OO이의 반응은 현재 선호와 발달적 요구를 이해하는 단서가 되었습니다.",
            "놀이 과정에서 OO이는 자율적 선택과 교사의 조절 지원을 함께 경험했습니다.",
            "오늘 활동은 2세 영아의 탐색 욕구와 표현 욕구가 드러난 장면이었습니다.",
            "OO이는 놀이 속에서 주변 사람과 사물에 대한 관심을 조금씩 넓혀갔습니다.",
        ],
    }
}


PARENT_TEMPLATES_BY_AGE = {
    "0세": {
        "일반형": [
            "가정에서도 OO이가 편안히 쉬고 먹는 리듬을 이어갈 수 있도록 도와주세요.",
            "OO이의 작은 표정과 손짓을 따뜻하게 바라봐 주세요.",
            "오늘 경험한 소리와 촉감을 가정에서도 편안하게 이어가 보셔도 좋겠습니다.",
            "OO이가 보내는 신호에 천천히 반응해 주시면 안정감 형성에 도움이 됩니다.",
            "OO이의 속도에 맞추어 충분히 기다려 주세요.",
            "익숙한 목소리로 오늘의 하루를 짧게 들려주시면 좋겠습니다.",
            "결과보다 OO이가 편안하게 경험한 과정을 함께 응원해 주세요.",
            "OO이가 관심 보인 사물을 안전하게 만져볼 수 있도록 도와주세요.",
            "작은 반응도 OO이의 표현으로 보며 따뜻하게 답해 주세요.",
            "원과 가정이 함께 OO이의 안정적인 하루를 응원하겠습니다.",
        ],
        "불안형": [
            "OO이는 자신의 속도로 천천히 반응을 넓혀가고 있으니 편안하게 지켜봐 주세요.",
            "아직 낯선 자극에는 시간이 필요할 수 있어 원에서도 천천히 지원하고 있습니다.",
            "작은 시선과 손짓도 OO이에게는 의미 있는 표현으로 보고 있습니다.",
            "OO이가 부담을 느끼지 않도록 안정적인 분위기 속에서 경험을 이어가고 있습니다.",
            "걱정되실 수 있는 부분은 원에서도 세심하게 살피며 공유하겠습니다.",
            "영아는 하루 컨디션에 따라 반응이 달라질 수 있어 꾸준히 관찰하겠습니다.",
            "OO이가 편안함을 느낄 수 있도록 익숙한 일과를 유지하고 있습니다.",
            "새로운 경험은 짧고 부드럽게 제공하며 반응을 살피겠습니다.",
            "오늘의 작은 반응도 발달 과정 안에서 의미 있게 보고 있습니다.",
            "가정에서도 안정감을 먼저 느낄 수 있도록 따뜻하게 안아 주세요.",
        ],
        "정보형": [
            "0세 영아에게는 보고, 듣고, 만지는 감각 경험이 주변을 알아가는 중요한 과정입니다.",
            "표정, 울음, 옹알이, 몸짓은 OO이가 의사를 나타내는 중요한 신호입니다.",
            "반복되는 일과는 OO이가 안정감을 느끼고 예측 가능성을 경험하는 데 도움이 됩니다.",
            "교사의 민감한 반응은 OO이의 안정 애착과 정서 조절의 기초가 됩니다.",
            "감각 탐색은 이후 신체, 언어, 인지 발달의 바탕이 됩니다.",
            "OO이가 관심을 보이는 대상을 안전하게 탐색하도록 지원하고 있습니다.",
            "말을 많이 시키기보다 OO이의 신호에 맞추어 짧고 따뜻하게 반응하는 것이 좋습니다.",
            "같은 놀이를 반복하는 것은 영아가 익숙함과 변화를 알아가는 과정입니다.",
            "손으로 만지고 입으로 탐색하려는 모습은 감각 발달 과정에서 자주 나타납니다.",
            "오늘의 장면은 OO이가 감각과 관계를 통해 세상을 알아가는 과정으로 볼 수 있습니다.",
        ],
        "감성형": [
            "OO이의 작은 눈빛 하나에도 오늘의 이야기가 담겨 있었습니다.",
            "천천히 반응하는 OO이의 모습이 참 사랑스러웠습니다.",
            "오늘의 감각 경험이 OO이에게 편안한 기억으로 남기를 바랍니다.",
            "작은 손끝의 움직임에서도 OO이의 호기심이 느껴졌습니다.",
            "OO이가 안정감을 느끼며 하루를 보내는 모습을 따뜻하게 지켜보았습니다.",
            "OO이만의 속도가 오늘도 조용히 자라고 있었습니다.",
            "말보다 먼저 전해지는 표정과 몸짓을 소중히 바라보았습니다.",
            "OO이의 편안한 미소가 교실을 따뜻하게 만들었습니다.",
            "작은 반응을 함께 발견할 수 있어 반가운 하루였습니다.",
            "OO이의 하루를 가정과 함께 응원할 수 있어 감사합니다.",
        ],
    },
    "1세": {
        "일반형": [
            "가정에서도 OO이가 관심 보인 사물을 반복해서 탐색해 볼 수 있도록 도와주세요.",
            "OO이의 몸짓과 말소리에 따뜻하게 반응해 주세요.",
            "오늘의 놀이를 짧은 말로 다시 들려주시면 좋겠습니다.",
            "OO이가 스스로 해보려는 마음을 편안하게 기다려 주세요.",
            "반복해서 시도하는 모습은 배움의 과정으로 보아 주세요.",
            "OO이가 좋아하는 놀이를 가정에서도 안전하게 이어가 보시면 좋겠습니다.",
            "또래 이야기는 ‘친구가 옆에서 놀이했구나’처럼 편안하게 나누어 주세요.",
            "OO이의 작은 표현을 알아차리고 짧게 말로 되돌려 주세요.",
            "오늘 보인 관심이 가정에서도 즐거운 대화로 이어지길 바랍니다.",
            "원과 가정이 함께 OO이의 시도를 응원하겠습니다.",
        ],
        "불안형": [
            "OO이는 자신의 속도로 반복하며 익숙해지고 있으니 천천히 지켜봐 주세요.",
            "처음에는 조심스러워도 관심을 보이는 순간들이 나타나고 있습니다.",
            "말보다 몸짓과 표정으로 먼저 표현할 수 있어 원에서도 그 신호를 살피고 있습니다.",
            "또래와의 경험은 함께 어울리기보다 곁에서 보고 반응하는 단계로 이해해 주세요.",
            "작은 시도도 꾸준히 관찰하며 가정과 공유하겠습니다.",
            "OO이가 부담을 느끼지 않도록 편안한 분위기에서 참여를 지원하고 있습니다.",
            "반복 놀이가 많아 보일 수 있지만, 이 시기에는 중요한 탐색 과정입니다.",
            "걱정되는 부분은 원에서도 세심하게 살피며 함께 조정하겠습니다.",
            "오늘은 작은 참여가 있었고, 그 시도 자체를 의미 있게 보고 있습니다.",
            "가정에서도 결과보다 해보려는 마음을 먼저 격려해 주세요.",
        ],
        "정보형": [
            "1세 영아는 관심 있는 대상을 반복해서 조작하며 사물의 특성을 알아갑니다.",
            "몸짓, 말소리, 간단한 말은 OO이가 요구와 관심을 나타내는 중요한 표현입니다.",
            "또래에게 관심을 보이는 모습은 사회적 관심의 기초로 볼 수 있습니다.",
            "모방 놀이는 일상 경험을 이해하고 표현하는 중요한 과정입니다.",
            "같은 행동을 반복하는 것은 기억, 예측, 원인과 결과를 경험하는 데 도움이 됩니다.",
            "교사는 OO이의 반응을 따라가며 놀이가 지속될 수 있도록 지원하고 있습니다.",
            "간단한 선택 경험은 자율성의 기초를 기르는 데 도움이 됩니다.",
            "놀이 중 사용한 말과 몸짓을 가정에서 짧게 되짚어 주시면 좋습니다.",
            "감각 탐색과 신체 움직임은 이 시기 발달이 통합적으로 나타나는 장면입니다.",
            "오늘의 장면은 OO이의 탐색, 모방, 초기 의사소통 경험과 연결됩니다.",
        ],
        "감성형": [
            "OO이가 반복해서 해보는 모습 속에 작은 자신감이 담겨 있었습니다.",
            "몸짓과 말소리로 전하는 OO이의 마음이 참 반가웠습니다.",
            "오늘의 놀이가 OO이에게 즐거운 기억으로 남기를 바랍니다.",
            "천천히 다가가고 다시 시도하는 모습에서 OO이만의 속도가 느껴졌습니다.",
            "또래 곁에서 머무는 모습도 OO이에게는 의미 있는 경험이었습니다.",
            "OO이의 작은 호기심이 오늘 교실을 환하게 만들었습니다.",
            "놀이 속에서 OO이의 마음이 편안하게 열리는 순간을 볼 수 있었습니다.",
            "OO이가 경험한 즐거움이 가정에서도 따뜻한 이야기로 이어지길 바랍니다.",
            "작은 반응을 발견하는 일이 오늘의 소중한 장면이었습니다.",
            "OO이의 하루를 함께 응원할 수 있어 감사한 날이었습니다.",
        ],
    },
    "2세": {
        "일반형": [
            "가정에서도 오늘 경험한 놀이를 짧은 말로 함께 나누어 보시면 좋겠습니다.",
            "OO이의 짧은 말과 몸짓 표현을 함께 응원해 주세요.",
            "오늘의 경험이 OO이에게 즐거운 기억으로 남았으면 좋겠습니다.",
            "가정에서도 OO이가 말하는 놀이 장면에 편안히 귀 기울여 주세요.",
            "오늘의 작은 시도가 다음 놀이로 이어질 수 있도록 격려해 주세요.",
            "OO이가 스스로 해보려는 모습을 따뜻하게 바라봐 주세요.",
            "놀이 속에서 보인 관심이 가정 대화로도 이어지면 좋겠습니다.",
            "오늘 경험한 내용을 짧게 다시 말해 보면 기억을 정리하는 데 도움이 됩니다.",
            "OO이가 즐거웠던 장면을 떠올릴 수 있도록 편안히 물어봐 주세요.",
            "가정과 원이 함께 OO이의 하루를 응원하겠습니다.",
        ],
        "불안형": [
            "OO이의 속도에 맞추어 천천히 경험하고 있으니 편안하게 지켜봐 주세요.",
            "처음에는 조심스러워도 조금씩 놀이에 익숙해지는 모습을 보이고 있습니다.",
            "2세는 또래와의 놀이에서 교사의 도움이 필요한 시기이니 천천히 경험을 쌓아가겠습니다.",
            "OO이가 안정감을 느끼며 참여할 수 있도록 원에서도 지원하고 있습니다.",
            "아직 낯선 장면에서는 시간이 필요하지만, 관심을 보이는 순간들이 나타나고 있습니다.",
            "작은 변화도 꾸준히 관찰하며 가정과 함께 공유하겠습니다.",
            "OO이가 부담을 느끼지 않도록 편안한 분위기 속에서 경험을 이어가고 있습니다.",
            "걱정되실 수 있는 부분은 원에서도 세심하게 살피고 있습니다.",
            "오늘은 작은 참여가 있었고, 그 시도 자체를 의미 있게 보고 있습니다.",
            "가정에서도 결과보다 시도한 마음을 먼저 격려해 주시면 좋겠습니다.",
        ],
        "정보형": [
            "이 활동은 OO이가 직접 보고 만지고 짧은 말과 행동으로 나타내 보는 경험으로 이어졌습니다.",
            "놀이 과정에서 탐색, 표현, 또래 곁에서의 관계 경험이 자연스럽게 함께 이루어졌습니다.",
            "오늘 활동은 OO이가 스스로 시도하고 주변을 살펴보는 데 도움이 되었습니다.",
            "해당 경험은 관찰력과 초기 표현을 함께 넓혀가는 과정으로 볼 수 있습니다.",
            "OO이는 놀이 속에서 반복해서 시도하며 사물의 변화를 알아보는 경험을 했습니다.",
            "또래와 함께하는 과정에서는 교사의 도움을 받아 기다리기와 차례 경험이 나타났습니다.",
            "반복해서 시도하는 과정은 집중과 정서 조절의 기초를 기르는 데 도움이 됩니다.",
            "오늘의 장면은 놀이 중심 보육과정 안에서 의미 있는 배움으로 연결됩니다.",
            "감각적으로 탐색하는 과정이 말과 사고의 기초로 이어졌습니다.",
            "가정에서도 놀이 과정에서 사용한 짧은 말과 행동을 함께 떠올려 보시면 좋겠습니다.",
        ],
        "감성형": [
            "작은 말과 표정 속에서도 OO이의 즐거움이 잘 느껴졌습니다.",
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
    },
}


def get_parent_template(parent_type: str, age: str | None = "2세") -> str:
    age = normalize_age(age)
    bank = PARENT_TEMPLATES_BY_AGE.get(age, PARENT_TEMPLATES_BY_AGE["2세"]).get(parent_type, [])
    if not bank:
        return "가정에서도 OO이의 속도와 표현을 따뜻하게 응원해 주세요."
    return age_sanitize(random.choice(bank), age)


OBSERVATION_TEMPLATES_BY_AGE = {
    "0세": {
        "알림장용": [
            "오늘은 {keyword} 경험을 해보았습니다. OO이는 {action}을 보이며 자신의 속도로 참여했습니다.",
            "{keyword} 시간에 OO이가 {action}을 나타냈습니다.",
            "오늘 {keyword} 놀이에서 OO이가 시선과 몸짓으로 관심을 보였습니다.",
            "{keyword} 경험 속에서 OO이는 교사의 도움을 받으며 편안하게 머물렀습니다.",
            "OO이는 {keyword} 중 주변 소리와 움직임을 살피며 {action}을 보였습니다.",
            "{keyword} 활동에서 OO이는 만지고 바라보며 감각적으로 탐색했습니다.",
            "오늘 OO이는 {keyword} 장면에서 교사 곁에서 안정감을 경험했습니다.",
            "OO이는 {keyword} 놀이를 통해 새로운 자극에 천천히 반응했습니다.",
            "{keyword} 중 OO이는 교사의 말소리와 몸짓 지원에 반응했습니다.",
            "오늘의 {keyword} 경험은 OO이가 주변을 감각으로 만나보는 시간이 되었습니다.",
        ],
        "관찰 기록용": [
            "{keyword} 활동 중 {child}는 {action}을 보임.",
            "{child}는 {keyword} 상황에서 교사의 지원에 반응하며 경험에 참여함.",
            "{keyword} 과정에서 {child}는 주변 자극에 시선과 몸짓으로 반응함.",
            "{child}는 {keyword} 활동 중 교사 또는 친숙한 사람과의 상호작용을 보임.",
            "{keyword} 활동에서 {child}는 자료를 바라보고 만지며 감각적으로 탐색함.",
            "{child}는 {keyword} 과정에서 자신의 요구를 표정, 소리, 몸짓으로 나타냄.",
            "{keyword} 상황에서 {child}는 또래가 있는 공간에 관심을 보임.",
            "{child}는 {keyword} 놀이 중 교사의 말소리와 몸짓 지원에 따라 참여를 이어감.",
            "{keyword} 활동 중 {child}는 관심 있는 자료를 바라보거나 손으로 탐색함.",
            "{child}는 {keyword} 놀이에서 안정적으로 머물며 경험함.",
        ],
        "서술형 일지용": [
            "{keyword} 활동을 통해 {child}가 감각적으로 경험에 참여하는 모습을 관찰할 수 있었음.",
            "오늘 {keyword} 활동에서는 {child}의 시선, 표정, 몸짓 반응을 중심으로 살펴볼 수 있었음.",
            "{keyword} 과정에서 {child}는 자신의 속도에 맞게 활동에 참여하였음.",
            "교사는 {keyword} 활동 중 {child}의 신호를 살피며 안정적으로 경험할 수 있도록 지원하였음.",
            "{keyword} 활동은 {child}가 주변 자극에 관심을 보이는 계기가 되었음.",
            "{child}는 {keyword} 장면에서 교사와 함께 있는 안정감을 경험하였음.",
            "오늘 일과 중 {keyword} 활동을 통해 {child}의 감각 반응이 나타났음.",
            "교사는 {child}가 {keyword} 경험에 편안하게 참여할 수 있도록 환경을 조정하였음.",
            "{keyword} 놀이에서 {child}는 반복적인 감각 경험을 통해 관심을 이어갔음.",
            "{keyword} 활동은 {child}의 감각 탐색과 정서적 안정감을 살펴볼 수 있는 장면이 되었음.",
        ],
        "기관 홍보용": [
            "오늘 우리 영아들은 {keyword} 경험을 통해 감각으로 세상을 만나보았습니다.",
            "{keyword} 활동 안에서 아이들은 보고, 듣고, 만지며 자신의 속도로 경험했습니다.",
            "우리 기관은 영아가 안정된 관계 안에서 감각 경험을 넓혀갈 수 있도록 지원하고 있습니다.",
            "아이들의 작은 시선과 손짓이 {keyword} 경험 속에서 소중한 배움으로 이어졌습니다.",
            "{keyword} 놀이를 통해 아이들은 새로운 자극에 천천히 반응해 보았습니다.",
            "오늘 교실에서는 {keyword} 활동을 중심으로 영아들의 작은 반응이 모였습니다.",
            "아이들은 {keyword} 경험을 통해 주변 환경에 관심을 보였습니다.",
            "우리 기관은 영아의 작은 신호도 성장의 장면으로 읽어내고 있습니다.",
            "{keyword} 활동은 아이들이 안정감 속에서 주변을 탐색하는 시간이 되었습니다.",
            "오늘의 {keyword} 경험은 영아의 일상 속 배움으로 차곡차곡 쌓이고 있습니다.",
        ],
    },
    "1세": {
        "알림장용": [
            "오늘은 {keyword} 활동을 해보았습니다. OO이는 {action}을 보이며 반복해서 참여했습니다.",
            "{keyword} 활동 시간에 OO이가 {action}을 나타냈습니다.",
            "오늘 {keyword} 놀이를 하며 OO이가 스스로 관심을 보이고 다가가는 모습을 볼 수 있었습니다.",
            "{keyword} 활동 속에서 OO이는 편안하게 놀이에 참여했습니다.",
            "OO이는 {keyword} 놀이 중 주변을 살피며 {action}을 보였습니다.",
            "{keyword} 활동에서 OO이는 자신의 방식으로 만지고 움직이며 탐색했습니다.",
            "오늘 OO이는 {keyword} 장면에서 또래 곁에 머물며 함께 있는 경험을 했습니다.",
            "OO이는 {keyword} 놀이를 통해 새롭게 시도해보는 모습을 보였습니다.",
            "{keyword} 활동 중 OO이는 교사의 도움을 받아 안정적으로 참여했습니다.",
            "오늘의 {keyword} 경험은 OO이가 관심 있는 대상을 반복해서 알아보는 시간이 되었습니다.",
        ],
        "관찰 기록용": [
            "{keyword} 활동 중 {child}는 {action}을 보임.",
            "{child}는 {keyword} 상황에서 교사의 지원에 반응하며 활동에 참여함.",
            "{keyword} 놀이 과정에서 {child}는 주변 자극에 관심을 보이고 탐색을 시도함.",
            "{child}는 {keyword} 활동 중 교사 또는 또래의 행동에 관심을 보임.",
            "{keyword} 활동에서 {child}는 놀이 자료를 살피고 반복적으로 조작함.",
            "{child}는 {keyword} 과정에서 자신의 의도를 몸짓과 말소리로 표현함.",
            "{keyword} 상황에서 {child}는 또래의 행동을 바라보고 반응함.",
            "{child}는 {keyword} 놀이 중 교사의 말과 몸짓 지원에 따라 참여를 이어감.",
            "{keyword} 활동 중 {child}는 관심 있는 자료를 선택하여 탐색함.",
            "{child}는 {keyword} 놀이에서 안정적으로 머물며 활동을 경험함.",
        ],
        "서술형 일지용": [
            "{keyword} 활동을 통해 {child}가 놀이에 참여하는 모습을 관찰할 수 있었음.",
            "오늘 {keyword} 활동에서는 {child}의 참여 과정과 반응을 중심으로 살펴볼 수 있었음.",
            "{keyword} 놀이 과정에서 {child}는 자신의 방식으로 활동에 참여하였음.",
            "교사는 {keyword} 활동 중 {child}의 반응을 살피며 놀이가 이어질 수 있도록 지원하였음.",
            "{keyword} 활동은 {child}가 관심을 나타내고 반복 탐색을 이어가는 계기가 되었음.",
            "{child}는 {keyword} 장면에서 또래 곁에 머물며 함께 있는 경험을 하였음.",
            "오늘 일과 중 {keyword} 활동을 통해 {child}의 탐색 과정이 나타났음.",
            "교사는 {child}가 {keyword} 놀이에 안정적으로 참여할 수 있도록 환경을 조정하였음.",
            "{keyword} 놀이에서 {child}는 반복적인 시도를 통해 활동에 몰입하였음.",
            "{keyword} 활동은 {child}의 탐색과 초기 의사 표현을 살펴볼 수 있는 장면이 되었음.",
        ],
        "기관 홍보용": [
            "오늘 우리 영아들은 {keyword} 활동을 통해 반복 탐색의 즐거움을 경험했습니다.",
            "{keyword} 활동 안에서 아이들은 직접 보고 만지며 놀이를 이어갔습니다.",
            "우리 기관은 영아가 자신의 속도로 놀이하고 배울 수 있도록 다양한 경험을 마련하고 있습니다.",
            "아이들의 작은 호기심이 {keyword} 활동 속에서 즐거운 배움으로 이어졌습니다.",
            "{keyword} 놀이를 통해 아이들은 몸짓과 말소리로 관심을 나타냈습니다.",
            "오늘 교실에서는 {keyword} 활동을 중심으로 아이들의 탐색이 이어졌습니다.",
            "아이들은 {keyword} 경험을 통해 스스로 다가가고 반복해 보는 즐거움을 느꼈습니다.",
            "우리 기관은 놀이 속 작은 반응도 영아의 성장으로 읽어내고 있습니다.",
            "{keyword} 활동은 아이들이 또래 곁에서 함께 있는 경험을 해보는 시간이 되었습니다.",
            "오늘의 {keyword} 경험은 영아의 일상 속 배움으로 차곡차곡 쌓이고 있습니다.",
        ],
    },
    "2세": {
        "알림장용": [
            "오늘은 {keyword} 활동을 해보았습니다. OO이는 {action}을 보이며 즐겁게 참여했습니다.",
            "{keyword} 활동 시간에 OO이가 {action}을 보여주었습니다.",
            "오늘 {keyword} 놀이를 하며 OO이가 스스로 관심을 보이고 참여하는 모습을 볼 수 있었습니다.",
            "{keyword} 활동 속에서 OO이는 편안하게 놀이에 참여했습니다.",
            "OO이는 {keyword} 놀이 중 주변을 살피며 {action}을 보였습니다.",
            "{keyword} 활동에서 OO이는 자신의 방식으로 탐색하며 놀이를 이어갔습니다.",
            "오늘 OO이는 {keyword} 장면에서 또래 곁에서 놀이하는 경험을 했습니다.",
            "OO이는 {keyword} 놀이를 통해 새롭게 시도해보는 모습을 보였습니다.",
            "{keyword} 활동 중 OO이는 교사의 지원을 받아 안정적으로 참여했습니다.",
            "오늘의 {keyword} 경험은 OO이에게 즐거운 탐색과 표현의 시간이 되었습니다.",
        ],
        "관찰 기록용": [
            "{keyword} 활동 중 {child}는 {action}을 보임.",
            "{child}는 {keyword} 상황에서 교사의 지원에 반응하며 활동에 참여함.",
            "{keyword} 놀이 과정에서 {child}는 주변 자극에 관심을 보이고 탐색을 시도함.",
            "{child}는 {keyword} 활동 중 또래 또는 교사와의 상호작용을 보임.",
            "{keyword} 활동에서 {child}는 놀이 자료를 살피고 반복적으로 조작함.",
            "{child}는 {keyword} 과정에서 자신의 의도를 표정, 몸짓, 단어, 짧은 말로 표현함.",
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
            "{keyword} 활동은 {child}가 관심을 표현하고 놀이를 이어가는 계기가 되었음.",
            "{child}는 {keyword} 장면에서 또래 곁에서 또는 함께 놀이하는 경험을 하였음.",
            "오늘 일과 중 {keyword} 활동을 통해 {child}의 탐색 과정이 나타났음.",
            "교사는 {child}가 {keyword} 놀이에 안정적으로 참여할 수 있도록 환경을 조정하였음.",
            "{keyword} 놀이에서 {child}는 반복적인 시도를 통해 활동에 몰입하였음.",
            "{keyword} 활동은 {child}의 탐색, 표현, 초기 상호작용을 살펴볼 수 있는 장면이 되었음.",
        ],
        "기관 홍보용": [
            "오늘 우리 영아들은 {keyword} 활동을 통해 즐겁게 탐색하는 시간을 가졌습니다.",
            "{keyword} 활동 안에서 아이들은 직접 경험하고 느끼며 놀이를 이어갔습니다.",
            "우리 기관은 아이들이 놀이 속에서 자연스럽게 배우고 성장할 수 있도록 다양한 경험을 마련하고 있습니다.",
            "아이들의 작은 호기심이 {keyword} 활동 속에서 즐거운 배움으로 이어졌습니다.",
            "{keyword} 놀이를 통해 아이들은 짧은 말과 행동으로 관심을 표현해 보았습니다.",
            "오늘 교실에서는 {keyword} 활동을 중심으로 아이들의 웃음과 탐색이 함께 피어났습니다.",
            "아이들은 {keyword} 경험을 통해 스스로 탐색하고 표현하는 즐거움을 느꼈습니다.",
            "우리 기관은 놀이 속 작은 장면도 아이들의 성장으로 읽어내고 있습니다.",
            "{keyword} 활동은 아이들이 또래 곁에서 함께하는 경험을 쌓는 시간이 되었습니다.",
            "오늘의 {keyword} 경험은 아이들의 일상 속 배움으로 차곡차곡 쌓이고 있습니다.",
        ],
    },
}


def get_observation_template_bank(record_type: str, age: str | None = "2세") -> List[str]:
    age = normalize_age(age)
    age_bank = OBSERVATION_TEMPLATES_BY_AGE.get(age, OBSERVATION_TEMPLATES_BY_AGE["2세"])
    return age_bank.get(record_type, age_bank["알림장용"])


def make_observation_sentence(
    record_type: str,
    keyword: str,
    action: str,
    age: str | None = "2세",
    child: str = "OO이",
) -> str:
    age = normalize_age(age)
    bank = get_observation_template_bank(record_type, age)
    template = random.choice(bank)
    sentence = template.format(keyword=keyword, action=action, child=child)
    return age_sanitize(sentence, age)


# 기존 이름과 호환시키고 싶을 때 사용할 수 있는 기본값입니다.
# 단, 실제 생성에서는 OBSERVATION_TEMPLATES_BY_AGE를 우선 사용하세요.
OBSERVATION_TEMPLATES = OBSERVATION_TEMPLATES_BY_AGE["2세"]
PARENT_TEMPLATES = PARENT_TEMPLATES_BY_AGE["2세"]
CURRICULUM_RECORD = CURRICULUM_RECORD_BY_AGE["2세"]
CURRICULUM_RECORD_NOTE = CURRICULUM_RECORD_NOTE_BY_AGE["2세"]
DEVELOPMENT_RECORD_FORMAL = DEVELOPMENT_RECORD_FORMAL_BY_AGE["2세"]
DEVELOPMENT_RECORD_NOTE = DEVELOPMENT_RECORD_NOTE_BY_AGE["2세"]


# 0~2세 표준보육과정 / 3~5세 누리과정 UI 영역
STANDARD_AREAS = ["신체운동·건강", "의사소통", "사회관계", "예술경험", "자연탐구"]
NURI_AREAS = ["신체운동·건강", "의사소통", "사회관계", "예술경험", "자연탐구"]

# 3~5세용 일반 문구. 0~2세는 위의 연령별 딕셔너리를 우선 사용합니다.
PRESCHOOL_CURRICULUM_RECORD = {
    "신체운동·건강": "몸의 움직임을 조절하고 건강하고 안전하게 놀이에 참여하는 경험과 연결됩니다.",
    "의사소통": "듣고 말하기, 읽기와 쓰기에 관심 가지기를 통해 자신의 생각과 느낌을 표현하는 경험과 연결됩니다.",
    "사회관계": "나를 알고 존중하며, 친구와 더불어 생활하고 공동체 안에서 관계를 경험하는 과정과 연결됩니다.",
    "예술경험": "아름다움을 느끼고 음악, 움직임, 미술, 극놀이 등 다양한 방식으로 표현하는 경험과 연결됩니다.",
    "자연탐구": "주변 세계와 자연에 호기심을 가지고 탐구하며 생활 속 문제를 알아가는 경험과 연결됩니다.",
}
PRESCHOOL_DEVELOPMENT_RECORD = {
    "신체": "신체 움직임을 조절하고 자신감 있게 참여하는 과정이 나타납니다.",
    "언어": "말과 문장으로 생각과 느낌을 표현하며 의사소통 경험을 확장합니다.",
    "인지": "관찰, 비교, 분류, 예측을 통해 사고를 넓혀가는 모습이 나타납니다.",
    "사회정서": "친구와 감정을 나누고 관계 속에서 협력과 조절을 경험합니다.",
    "창의성": "새로운 방법을 떠올리고 자신만의 방식으로 표현합니다.",
}
PRESCHOOL_PARENT_TEMPLATES = {
    "일반형": [
        "가정에서도 오늘 경험한 이야기를 편안하게 나누어 보시면 좋겠습니다.",
        "OO이의 작은 표현과 반응을 함께 응원해 주세요.",
        "오늘의 작은 시도가 다음 놀이로 이어질 수 있도록 함께 격려해 주세요.",
    ],
    "불안형": [
        "OO이의 속도에 맞추어 천천히 경험하고 있으니 편안하게 지켜봐 주세요.",
        "처음에는 조심스러워도 조금씩 놀이에 익숙해지는 모습을 보이고 있습니다.",
        "걱정되실 수 있는 부분은 원에서도 세심하게 살피고 있습니다.",
    ],
    "정보형": [
        "이 활동은 OO이가 직접 보고 만지고 표현해 보는 경험으로 이어졌습니다.",
        "놀이 과정에서 탐색, 표현, 관계 경험이 자연스럽게 함께 이루어졌습니다.",
        "오늘의 장면은 놀이 중심 교육과정 안에서 의미 있는 배움으로 연결됩니다.",
    ],
    "감성형": [
        "OO이의 하루 안에 반짝이는 장면이 하나 더 쌓였습니다.",
        "오늘의 놀이가 OO이 마음속에 따뜻한 기억으로 남기를 바랍니다.",
        "OO이의 하루를 함께 응원할 수 있어 감사한 날이었습니다.",
    ],
}
PRESCHOOL_OBSERVATION_TEMPLATES = {
    "알림장용": [
        "오늘은 {keyword} 활동을 해보았습니다. OO이는 {action}을 보이며 즐겁게 참여했습니다.",
        "{keyword} 활동 시간에 OO이가 {action}을 보여주었습니다.",
        "{keyword} 활동에서 OO이는 자신의 방식으로 탐색하며 놀이를 이어갔습니다.",
    ],
    "관찰 기록용": [
        "{keyword} 활동 중 {child}는 {action}을 보임.",
        "{child}는 {keyword} 상황에서 교사의 지원에 반응하며 활동에 참여함.",
        "{keyword} 상황에서 {child}는 또래의 행동을 관찰하고 반응함.",
    ],
    "서술형 일지용": [
        "{keyword} 활동을 통해 {child}가 놀이에 참여하는 모습을 관찰할 수 있었음.",
        "오늘 {keyword} 활동에서는 {child}의 참여 과정과 반응을 중심으로 살펴볼 수 있었음.",
        "{keyword} 활동은 {child}의 표현과 상호작용을 살펴볼 수 있는 장면이 되었음.",
    ],
    "기관 홍보용": [
        "오늘 우리 아이들은 {keyword} 활동을 통해 즐겁게 배우는 시간을 가졌습니다.",
        "{keyword} 활동 안에서 아이들은 직접 경험하고 느끼며 놀이를 이어갔습니다.",
        "오늘의 {keyword} 경험은 아이들의 일상 속 배움으로 차곡차곡 쌓이고 있습니다.",
    ],
}
GENERAL_DIARY_MESSAGE_BANK = {
    "알림장용": {
        "팩트 중심형": ["오늘 아이들의 활동 모습을 정리해드립니다.", "오늘 하루 흐름 속에서 보인 모습을 전해드립니다."],
        "따뜻한 감성형": ["오늘 아이들은 각자의 속도로 놀이에 다가가며 하루를 채워갔습니다.", "작은 시도 하나도 소중하게 느껴지는 하루였습니다."],
        "이모티콘 활용형": ["오늘 우리 아이들은 즐겁게 하루를 보냈습니다 😊", "놀이 속에서 아이들의 호기심이 자라났습니다 🔍"],
        "전문적 설명형": ["오늘 활동에서는 아이들의 참여 과정과 반응을 중심으로 살펴볼 수 있었습니다.", "아이들의 반응은 발달적 특성과 현재의 관심을 이해하는 단서가 되었습니다."],
    },
    "관찰 기록용": {
        "팩트 중심형": ["관찰 내용은 아이의 참여 과정과 반응을 중심으로 정리하였다.", "해당 장면에서 아이의 행동과 반응을 객관적으로 기록하였다."],
        "따뜻한 감성형": ["아이의 작은 반응과 시도를 중심으로 관찰하였다.", "아이의 표정과 행동에서 활동에 대한 흥미를 확인할 수 있었다."],
        "이모티콘 활용형": ["관찰 기록은 행동, 반응, 지원 내용을 중심으로 구성하였다.", "아이의 행동 흐름을 객관적인 문체로 정리하였다."],
        "전문적 설명형": ["놀이 과정은 아이의 현재 흥미와 발달적 요구를 이해하는 단서가 되었다.", "교사는 아이의 반응을 관찰하며 필요한 지원을 제공하였다."],
    },
    "서술형 일지용": {
        "팩트 중심형": ["교사는 아이들의 반응을 살피며 일과가 안정적으로 이어질 수 있도록 지원하였다.", "오늘의 일지는 놀이와 일상 경험의 흐름을 중심으로 작성하였다."],
        "따뜻한 감성형": ["아이들은 편안한 분위기 속에서 하루의 경험을 이어갔다.", "작은 장면 안에서도 아이들의 성장과 시도를 확인할 수 있었다."],
        "이모티콘 활용형": ["서술형 일지는 공식 기록의 성격을 고려하여 이모티콘 없이 문장으로 정리하였다.", "아이들의 참여 장면은 공식 기록에 적합한 표현으로 정리하였다."],
        "전문적 설명형": ["교사는 놀이 맥락 안에서 아이들의 발달적 의미를 살펴보았다.", "교사는 관찰 내용을 바탕으로 다음 놀이 지원 방향을 고려하였다."],
    },
    "기관 홍보용": {
        "팩트 중심형": ["우리 기관은 아이들의 일상 속 배움과 성장을 세심하게 기록하고 있습니다.", "아이들은 놀이를 통해 다양한 경험에 참여했습니다."],
        "따뜻한 감성형": ["우리 기관은 아이들이 놀이 속에서 편안하게 경험하고 성장할 수 있도록 함께하고 있습니다.", "작은 손짓과 표정도 아이들의 성장 이야기로 소중히 바라보고 있습니다."],
        "이모티콘 활용형": ["놀이 속 작은 경험이 아이들의 배움으로 이어질 수 있도록 따뜻하게 지원하고 있습니다 😊", "아이들의 호기심이 반짝이는 하루였습니다 ✨"],
        "전문적 설명형": ["우리 기관은 아이들의 발달 특성과 흥미를 반영하여 교육 환경을 마련하고 있습니다.", "교사는 아이들의 반응을 관찰하며 놀이가 확장될 수 있도록 지원하고 있습니다."],
    },
}

for _age in ["3세", "4세", "5세"]:
    CURRICULUM_RECORD_BY_AGE[_age] = PRESCHOOL_CURRICULUM_RECORD
    CURRICULUM_RECORD_NOTE_BY_AGE[_age] = {
        area: sentence.replace("습니다.", "음.").replace("됩니다.", "됨.")
        for area, sentence in PRESCHOOL_CURRICULUM_RECORD.items()
    }
    DEVELOPMENT_RECORD_FORMAL_BY_AGE[_age] = PRESCHOOL_DEVELOPMENT_RECORD
    DEVELOPMENT_RECORD_NOTE_BY_AGE[_age] = {
        area: sentence.replace("습니다.", "음.").replace("납니다.", "남.").replace("봅니다.", "봄.")
        for area, sentence in PRESCHOOL_DEVELOPMENT_RECORD.items()
    }
    PARENT_TEMPLATES_BY_AGE[_age] = PRESCHOOL_PARENT_TEMPLATES
    OBSERVATION_TEMPLATES_BY_AGE[_age] = PRESCHOOL_OBSERVATION_TEMPLATES


# =========================
# 3~5세 연령별 발달 수준 보정 패치
# - 2019 개정 누리과정은 3~5세 공통 교육과정이지만, 문구 생성에서는 실제 발달 표현 수준을 3/4/5세로 분리합니다.
# - 3세: 관심·모방·간단한 역할·친구 곁/함께 놀이·짧은 말 중심
# - 4세: 상상 확장·이유 설명·차례/공유·간단한 규칙 경험 중심
# - 5세: 계획·협력·규칙 조율·회상/이야기 구성·문제 해결 시도 중심
# =========================

AGE_NOTICE.update({
    "3세": "관심 있는 놀이에 스스로 다가가고, 짧은 말과 행동으로 생각과 느낌을 나타내며 친구 곁에서 함께 놀이하는 경험을 넓혀가고 있습니다.",
    "4세": "상상한 내용을 놀이로 확장하고, 이유를 말하거나 차례와 약속을 경험하며 친구와 놀이를 이어가고 있습니다.",
    "5세": "놀이를 계획하고 역할과 규칙을 조율하며, 친구와 협력하고 자신의 생각을 비교적 분명하게 설명하는 경험을 넓혀가고 있습니다.",
})

AGE_SENSITIVE_REPLACEMENTS.update({
    "3세": {
        "협력적 문제 해결": "교사의 도움을 받아 함께 시도하는 과정",
        "문제 해결": "해결 방법을 떠올려 보는 경험",
        "놀이를 주도": "관심 있는 놀이를 선택",
        "규칙과 협력": "간단한 약속과 함께 놀이하는 경험",
        "생각을 논리적으로": "생각을 짧은 말로",
        "의견을 조율": "교사의 도움을 받아 반응을 맞추",
        "친구의 제안을 듣고 함께 방향을 바꾸어 보는 모습": "친구의 말과 행동을 살피며 놀이에 반응하는 모습",
        "복잡한 규칙": "간단한 약속",
    },
    "4세": {
        "협력적 문제 해결": "친구와 의견을 주고받으며 해결을 시도하는 과정",
        "복잡한 규칙": "놀이 속 약속",
        "놀이를 주도": "놀이 방향을 제안",
        "논리적으로 설명": "이유를 들어 설명",
        "규칙을 완전히 조율": "규칙을 함께 맞추어 보",
    },
    "5세": {
        "자기주도적 학습": "스스로 계획하고 시도하는 놀이 경험",
        "완전한 협력": "역할과 규칙을 조율하는 협력 경험",
    },
})

PRESCHOOL_ACTIVITY_KEYWORDS_BY_AGE = {
    "3세": {
        "색깔": "색과 모양의 같고 다름을 살펴보는 탐색 놀이",
        "색": "색과 모양의 같고 다름을 살펴보는 탐색 놀이",
        "블록": "블록을 쌓고 무너뜨리며 형태를 만들어 보는 구성 놀이",
        "물감": "색과 재료의 느낌을 경험하며 표현해 보는 미술 놀이",
        "역할": "익숙한 생활 장면을 흉내 내며 짧은 말과 행동으로 나타내는 역할 놀이",
        "바깥": "몸을 움직이며 주변 환경을 살펴보는 바깥놀이",
        "산책": "주변 사물과 자연에 관심을 가지고 살펴보는 산책",
        "동화": "그림과 이야기를 듣고 떠오른 생각을 짧게 말해보는 동화 활동",
        "노래": "리듬과 노래에 맞춰 몸을 움직이는 음악 경험",
        "점프": "몸의 움직임을 조절하며 즐기는 신체 놀이",
        "공": "공을 굴리고 던지며 움직임을 경험하는 놀이",
        "모래": "모래를 담고 쏟으며 형태와 촉감을 탐색하는 감각 놀이",
        "물": "물을 담고 쏟으며 움직임과 변화를 탐색하는 감각 놀이",
    },
    "4세": {
        "색깔": "색과 모양의 특징을 비교하고 표현해 보는 탐색 놀이",
        "색": "색과 모양의 특징을 비교하고 표현해 보는 탐색 놀이",
        "블록": "블록으로 구조물을 만들고 놀이 이야기를 더해 보는 구성 놀이",
        "물감": "색을 섞고 재료를 활용해 의도한 이미지를 표현해 보는 미술 놀이",
        "역할": "상상한 상황과 역할을 말과 행동으로 이어가는 역할 놀이",
        "바깥": "몸을 조절하며 친구와 함께 규칙을 경험하는 바깥놀이",
        "산책": "주변 자연의 변화와 특징을 관찰하고 말해보는 산책",
        "동화": "이야기를 듣고 장면, 인물, 다음 상황을 떠올려 보는 동화 활동",
        "노래": "리듬, 움직임, 소리를 활용해 느낌을 표현하는 음악 경험",
        "점프": "몸의 균형과 방향을 조절하며 참여하는 신체 놀이",
        "공": "공을 주고받으며 방향과 힘을 조절해 보는 놀이",
        "모래": "모래의 형태 변화를 활용해 구성하고 표현하는 감각 놀이",
        "물": "물의 흐름과 양의 변화를 관찰하며 실험해 보는 탐색 놀이",
    },
    "5세": {
        "색깔": "색과 형태를 계획적으로 활용해 표현하고 설명하는 탐색 놀이",
        "색": "색과 형태를 계획적으로 활용해 표현하고 설명하는 탐색 놀이",
        "블록": "계획한 구조를 구성하고 친구와 역할을 나누어 확장하는 구성 놀이",
        "물감": "재료와 표현 방법을 선택해 의도한 내용을 나타내는 미술 놀이",
        "역할": "역할, 규칙, 이야기를 함께 정하며 전개하는 협동 역할 놀이",
        "바깥": "규칙과 전략을 이해하고 친구와 협력하는 바깥놀이",
        "산책": "자연과 생활 속 변화를 비교하고 궁금한 점을 탐구하는 산책",
        "동화": "이야기를 듣고 사건의 흐름, 인물의 마음, 자신의 생각을 말해보는 동화 활동",
        "노래": "음악의 분위기와 리듬을 느끼고 움직임이나 이야기로 표현하는 음악 경험",
        "점프": "몸의 균형, 방향, 속도를 조절하며 도전하는 신체 놀이",
        "공": "규칙을 정하고 공을 주고받으며 협력하는 신체 놀이",
        "모래": "모래와 도구를 활용해 계획한 형태를 구성하고 설명하는 감각·구성 놀이",
        "물": "물의 흐름, 양, 움직임을 비교하며 탐구하는 과학적 탐색 놀이",
    },
}
ACTIVITY_KEYWORDS_BY_AGE.update(PRESCHOOL_ACTIVITY_KEYWORDS_BY_AGE)

PRESCHOOL_SCOPE_INTRO_BY_AGE = {
    "3세": {
        "놀이 장면 중심": "놀이 장면에서",
        "일상생활 중심": "일상생활 속에서",
        "하루 전체 흐름": "하루의 흐름 속에서",
        "특별활동 중심": "활동 경험 속에서",
    },
    "4세": {
        "놀이 장면 중심": "놀이 장면에서",
        "일상생활 중심": "일상생활 속에서",
        "하루 전체 흐름": "하루의 흐름 속에서",
        "특별활동 중심": "활동 경험 속에서",
    },
    "5세": {
        "놀이 장면 중심": "놀이 장면에서",
        "일상생활 중심": "일상생활과 놀이의 흐름 속에서",
        "하루 전체 흐름": "하루의 흐름 속에서",
        "특별활동 중심": "활동 경험 속에서",
    },
}
SCOPE_INTRO_BY_AGE.update(PRESCHOOL_SCOPE_INTRO_BY_AGE)

PRESCHOOL_MEANING_MAP_BY_AGE = {
    "3세": {
        "알림장용": "이 과정은 유아가 흥미 있는 놀이에 다가가고, 짧은 말과 행동으로 생각과 느낌을 나타내는 경험으로 이어졌습니다.",
        "기관 홍보용": "이러한 경험은 유아가 놀이 속에서 관심을 표현하고 친구 곁에서 함께하는 즐거움을 알아가는 과정으로 연결됩니다.",
        "관찰 기록용": "해당 장면은 유아의 관심 표현, 간단한 언어 표현, 친구 곁에서의 상호작용을 살펴볼 수 있는 관찰 장면이었다.",
        "서술형 일지용": "이 경험은 유아가 자신의 흥미를 바탕으로 놀이에 참여하고 교사의 지원 속에서 표현을 넓혀가는 과정으로 볼 수 있었다.",
    },
    "4세": {
        "알림장용": "이 과정은 유아가 상상한 내용을 놀이로 확장하고, 친구와 차례·공유·간단한 약속을 경험하는 시간으로 이어졌습니다.",
        "기관 홍보용": "이러한 경험은 유아가 놀이 속에서 상상, 설명, 또래와의 조절 경험을 넓혀가는 과정으로 연결됩니다.",
        "관찰 기록용": "해당 장면은 유아의 상상 놀이 확장, 이유 설명, 또래와의 차례·공유 경험을 살펴볼 수 있는 관찰 장면이었다.",
        "서술형 일지용": "이 경험은 유아가 놀이 상황을 확장하고 친구와 의견을 주고받으며 관계 경험을 넓혀가는 과정으로 볼 수 있었다.",
    },
    "5세": {
        "알림장용": "이 과정은 유아가 놀이를 계획하고 역할과 규칙을 조율하며, 자신의 생각을 설명하고 협력하는 경험으로 이어졌습니다.",
        "기관 홍보용": "이러한 경험은 유아가 놀이 속에서 계획, 협력, 문제 해결, 회상과 설명의 힘을 키워가는 과정으로 연결됩니다.",
        "관찰 기록용": "해당 장면은 유아의 놀이 계획, 협력, 규칙 조율, 이야기 구성 및 문제 해결 시도를 살펴볼 수 있는 관찰 장면이었다.",
        "서술형 일지용": "이 경험은 유아가 친구와 역할과 규칙을 조율하고 자신의 생각을 설명하며 놀이를 주도적으로 확장하는 과정으로 볼 수 있었다.",
    },
}
MEANING_MAP_BY_AGE.update(PRESCHOOL_MEANING_MAP_BY_AGE)

PRESCHOOL_CURRICULUM_RECORD_BY_AGE = {
    "3세": {
        "신체운동·건강": "기본 움직임을 즐기고 몸의 균형과 방향을 조절하며 안전한 놀이 방식을 경험하는 과정과 연결됩니다.",
        "의사소통": "짧은 문장과 질문으로 생각과 느낌을 나타내고, 그림책과 이야기 듣기에 관심을 보이는 경험과 연결됩니다.",
        "사회관계": "나와 친구의 감정을 알아가고, 친구 곁에서 함께 놀이하며 간단한 약속을 경험하는 과정과 연결됩니다.",
        "예술경험": "소리, 움직임, 색, 모양을 즐기고 자신의 느낌을 자유롭게 표현하는 경험과 연결됩니다.",
        "자연탐구": "주변 사물과 자연에 호기심을 보이고, 같고 다름을 살펴보며 탐색하는 경험과 연결됩니다.",
    },
    "4세": {
        "신체운동·건강": "몸의 움직임을 조절하고 도구와 공간을 활용하며, 놀이 속 안전과 건강한 생활을 경험하는 과정과 연결됩니다.",
        "의사소통": "자신의 생각과 이유를 말하고, 이야기의 흐름을 듣고 묻고 답하며 표현을 확장하는 경험과 연결됩니다.",
        "사회관계": "친구와 차례, 공유, 간단한 규칙을 경험하고 서로의 감정과 생각을 살피는 과정과 연결됩니다.",
        "예술경험": "상상한 내용을 음악, 움직임, 미술, 극놀이 등 다양한 방식으로 표현하는 경험과 연결됩니다.",
        "자연탐구": "주변 세계의 특징을 비교하고 변화에 관심을 가지며 궁금한 점을 탐색하는 경험과 연결됩니다.",
    },
    "5세": {
        "신체운동·건강": "몸의 움직임을 계획적으로 조절하고 규칙 있는 놀이에 참여하며 안전한 생활 태도를 확장하는 과정과 연결됩니다.",
        "의사소통": "경험을 회상해 이야기하고, 자신의 생각을 이유와 함께 설명하며 듣기·말하기·읽기·쓰기에 관심을 넓히는 경험과 연결됩니다.",
        "사회관계": "친구와 역할과 규칙을 조율하고, 공동의 놀이 안에서 함께 배우고 협력하는 과정과 연결됩니다.",
        "예술경험": "표현 방법을 선택하고 계획하여 자신의 생각과 느낌을 창의적으로 나타내는 경험과 연결됩니다.",
        "자연탐구": "자연과 생활 속 문제를 관찰, 비교, 예측하며 탐구하고 해결 방법을 시도하는 경험과 연결됩니다.",
    },
}
PRESCHOOL_DEVELOPMENT_RECORD_BY_AGE = {
    "3세": {
        "신체": "기본 움직임을 즐기며 몸의 균형과 방향을 조절해 보는 과정이 나타납니다.",
        "언어": "짧은 문장과 질문으로 생각과 느낌을 표현하며 말하기 경험을 넓혀갑니다.",
        "인지": "주변 사물의 같고 다름을 살펴보고 간단히 비교하는 모습이 나타납니다.",
        "사회정서": "친구 곁에서 놀이하고 교사의 도움을 받아 감정과 요구를 표현하는 경험을 합니다.",
        "창의성": "익숙한 경험을 흉내 내거나 상상한 내용을 자신의 방식으로 표현합니다.",
    },
    "4세": {
        "신체": "몸의 움직임을 조절하고 도구를 활용하며 놀이에 자신 있게 참여하는 과정이 나타납니다.",
        "언어": "자신의 생각과 이유를 말하고 친구와 묻고 답하며 의사소통 경험을 확장합니다.",
        "인지": "관찰, 비교, 분류를 통해 사물의 특징과 관계를 알아가는 모습이 나타납니다.",
        "사회정서": "친구와 차례와 공유를 경험하고 서로의 감정을 살피며 관계를 조절해 봅니다.",
        "창의성": "상상한 내용을 다양한 재료와 역할, 이야기로 확장하여 표현합니다.",
    },
    "5세": {
        "신체": "몸의 움직임을 계획적으로 조절하고 규칙 있는 신체 놀이에 능동적으로 참여합니다.",
        "언어": "경험을 회상해 이야기하고 자신의 생각을 이유와 함께 비교적 분명하게 설명합니다.",
        "인지": "관찰, 예측, 비교를 바탕으로 문제 해결 방법을 떠올리고 시도하는 모습이 나타납니다.",
        "사회정서": "친구와 역할과 규칙을 조율하며 공동의 놀이를 이어가는 협력 경험을 합니다.",
        "창의성": "목적에 맞게 표현 방법을 선택하고 새로운 방식으로 놀이를 구성합니다.",
    },
}

def _to_note_sentence(sentence: str) -> str:
    return (
        sentence.replace("습니다.", "음.")
        .replace("갑니다.", "감.")
        .replace("봅니다.", "봄.")
        .replace("납니다.", "남.")
        .replace("합니다.", "함.")
        .replace("됩니다.", "됨.")
    )

for _age, _areas in PRESCHOOL_CURRICULUM_RECORD_BY_AGE.items():
    CURRICULUM_RECORD_BY_AGE[_age] = _areas
    CURRICULUM_RECORD_NOTE_BY_AGE[_age] = {area: _to_note_sentence(sentence) for area, sentence in _areas.items()}

for _age, _areas in PRESCHOOL_DEVELOPMENT_RECORD_BY_AGE.items():
    DEVELOPMENT_RECORD_FORMAL_BY_AGE[_age] = _areas
    DEVELOPMENT_RECORD_NOTE_BY_AGE[_age] = {area: _to_note_sentence(sentence) for area, sentence in _areas.items()}

PRESCHOOL_PARENT_TEMPLATES_BY_AGE = {
    "3세": {
        "일반형": [
            "가정에서도 OO이가 오늘 어떤 놀이가 즐거웠는지 짧게 이야기해 볼 수 있도록 물어봐 주세요.",
            "OO이가 스스로 해보려는 작은 시도를 따뜻하게 응원해 주세요.",
            "오늘 경험한 장면을 그림이나 몸짓으로 다시 표현해 보아도 좋겠습니다.",
            "OO이가 친구 곁에서 함께 놀이한 경험을 편안하게 떠올릴 수 있도록 이야기 나누어 주세요.",
        ],
        "불안형": [
            "3세는 아직 함께 놀이하는 방법을 배워가는 시기라, 작은 참여도 의미 있게 보고 있습니다.",
            "OO이가 부담 없이 놀이에 다가갈 수 있도록 원에서도 천천히 지원하고 있습니다.",
            "낯선 장면에서는 시간이 필요하지만, 관심을 보이는 순간을 세심하게 살피고 있습니다.",
            "결과보다 시도한 마음을 먼저 격려해 주시면 OO이에게 큰 힘이 됩니다.",
        ],
        "정보형": [
            "이 활동은 OO이가 짧은 말과 행동으로 관심과 느낌을 표현해 보는 경험이 되었습니다.",
            "3세 유아에게는 반복 탐색과 간단한 역할 표현이 놀이 발달의 중요한 과정입니다.",
            "친구 곁에서 놀이하는 경험은 사회관계의 기초를 넓히는 데 도움이 됩니다.",
            "가정에서도 놀이 장면을 간단한 문장으로 다시 말해 보면 표현 경험이 이어집니다.",
        ],
        "감성형": [
            "OO이의 작은 말과 표정 속에서 오늘의 즐거움이 느껴졌습니다.",
            "조심스럽게 다가가던 모습도 OO이에게는 소중한 용기였습니다.",
            "오늘의 놀이가 OO이 마음속에 따뜻한 장면으로 남기를 바랍니다.",
            "OO이만의 속도로 놀이에 마음을 열어가는 모습이 반가웠습니다.",
        ],
    },
    "4세": {
        "일반형": [
            "가정에서도 OO이가 오늘 놀이에서 어떤 역할을 해보았는지 이야기 나누어 보세요.",
            "OO이가 생각한 이유나 방법을 편안하게 말해볼 수 있도록 기다려 주세요.",
            "오늘 경험한 차례, 공유, 약속의 장면을 함께 떠올려 보셔도 좋겠습니다.",
            "OO이가 상상한 이야기를 이어 말해볼 수 있도록 질문해 주세요.",
        ],
        "불안형": [
            "4세는 친구와 의견을 주고받는 과정에서 아직 교사의 도움이 필요할 수 있습니다.",
            "OO이가 차례와 공유를 경험하며 조금씩 관계 조절을 배워가고 있습니다.",
            "갈등 없이 완성하는 것보다, 상황을 이해하고 다시 시도해 보는 과정이 중요합니다.",
            "원에서도 OO이가 자신의 생각을 편안히 말할 수 있도록 세심하게 돕고 있습니다.",
        ],
        "정보형": [
            "이 활동은 OO이가 이유를 말하고 친구의 반응을 살피며 놀이를 확장하는 경험이 되었습니다.",
            "4세 유아에게는 상상 놀이, 차례 경험, 간단한 규칙 이해가 중요한 발달 과정입니다.",
            "놀이 속 비교와 분류, 이유 말하기는 사고와 언어 발달을 함께 돕습니다.",
            "가정에서도 '왜 그렇게 생각했어?'처럼 이유를 묻는 대화가 도움이 됩니다.",
        ],
        "감성형": [
            "OO이가 상상한 이야기가 놀이 속에서 살아나는 장면이 참 인상적이었습니다.",
            "친구와 맞춰가려는 OO이의 작은 노력이 따뜻하게 보였습니다.",
            "오늘의 놀이 안에서 OO이의 생각이 한 뼘 더 자란 듯했습니다.",
            "OO이가 자신의 방법을 찾아가는 모습이 반짝였습니다.",
        ],
    },
    "5세": {
        "일반형": [
            "가정에서도 OO이가 오늘 놀이를 어떻게 계획하고 이어갔는지 이야기 나누어 보세요.",
            "OO이가 친구와 정한 역할이나 규칙을 떠올리며 설명해 볼 수 있도록 격려해 주세요.",
            "오늘 경험한 문제 해결 장면을 함께 회상해 보면 사고를 정리하는 데 도움이 됩니다.",
            "OO이가 자신의 생각을 이유와 함께 말할 수 있도록 충분히 들어 주세요.",
        ],
        "불안형": [
            "5세도 협력 과정에서는 의견 차이가 생길 수 있고, 그 조율 과정 자체가 중요한 배움입니다.",
            "OO이가 스스로 계획하고 시도하는 힘을 키워갈 수 있도록 원에서도 지켜보고 지원하겠습니다.",
            "결과가 완벽하지 않아도 역할과 규칙을 맞추어 보려는 과정이 의미 있습니다.",
            "걱정되는 부분은 계속 관찰하며 OO이에게 필요한 지원을 이어가겠습니다.",
        ],
        "정보형": [
            "이 활동은 OO이가 계획, 역할 조율, 문제 해결을 함께 경험하는 놀이 과정이 되었습니다.",
            "5세 유아에게는 자신의 생각을 이유와 함께 설명하고 친구와 협력하는 경험이 중요합니다.",
            "규칙 있는 놀이와 회상 대화는 자기조절, 언어 표현, 사회적 문제 해결을 함께 돕습니다.",
            "가정에서도 '처음에는 어떻게 하려고 했어?', '다음에는 어떻게 해볼까?'처럼 과정 중심 질문을 해보시면 좋겠습니다.",
        ],
        "감성형": [
            "OO이가 친구와 함께 방법을 찾아가는 모습에서 든든한 성장이 느껴졌습니다.",
            "오늘의 놀이에는 OO이의 생각과 계획이 또렷하게 담겨 있었습니다.",
            "스스로 해보려는 OO이의 마음이 빛났던 하루였습니다.",
            "친구와 맞춰가며 놀이를 완성해 가는 모습이 참 기특했습니다.",
        ],
    },
}
PARENT_TEMPLATES_BY_AGE.update(PRESCHOOL_PARENT_TEMPLATES_BY_AGE)

PRESCHOOL_OBSERVATION_TEMPLATES_BY_AGE = {
    "3세": {
        "알림장용": [
            "오늘은 {keyword} 활동을 해보았습니다. OO이는 {action}을 보이며 놀이에 관심을 나타냈습니다.",
            "{keyword} 활동 시간에 OO이가 {action}을 보이며 자신의 방식으로 참여했습니다.",
            "OO이는 {keyword} 놀이 중 친구 곁에서 놀이를 살피고 함께하는 경험을 했습니다.",
            "{keyword} 활동에서 OO이는 짧은 말과 행동으로 관심과 느낌을 표현했습니다.",
            "오늘의 {keyword} 경험은 OO이가 놀이에 천천히 다가가 보는 시간이 되었습니다.",
        ],
        "관찰 기록용": [
            "{keyword} 활동 중 {child}는 {action}을 보임.",
            "{child}는 {keyword} 상황에서 교사의 지원을 받아 놀이에 참여함.",
            "{keyword} 놀이 과정에서 {child}는 친구의 행동을 살피고 반응함.",
            "{child}는 {keyword} 활동 중 짧은 말과 행동으로 관심을 표현함.",
            "{keyword} 활동에서 {child}는 관심 있는 자료를 선택해 탐색함.",
        ],
        "서술형 일지용": [
            "{keyword} 활동을 통해 {child}가 관심 있는 놀이에 다가가는 모습을 관찰할 수 있었음.",
            "오늘 {keyword} 활동에서는 {child}의 관심 표현과 참여 과정을 중심으로 살펴볼 수 있었음.",
            "{child}는 {keyword} 장면에서 친구 곁에서 놀이하며 반응하는 모습을 보였음.",
            "교사는 {child}가 {keyword} 놀이에 안정적으로 참여할 수 있도록 언어와 정서적 지원을 제공하였음.",
            "{keyword} 활동은 {child}의 짧은 말, 행동 표현, 친구 곁 놀이 경험을 살펴볼 수 있는 장면이 되었음.",
        ],
        "기관 홍보용": [
            "오늘 우리 3세 유아들은 {keyword} 활동을 통해 관심 있는 놀이에 다가가 보는 시간을 가졌습니다.",
            "{keyword} 활동 안에서 아이들은 짧은 말과 행동으로 자신의 느낌을 표현했습니다.",
            "아이들의 작은 호기심이 {keyword} 활동 속에서 즐거운 탐색으로 이어졌습니다.",
            "우리 기관은 3세 유아가 친구 곁에서 함께 놀이하는 경험을 안정적으로 쌓아갈 수 있도록 지원합니다.",
            "오늘의 {keyword} 경험은 유아의 놀이 참여와 표현이 자라나는 장면이 되었습니다.",
        ],
    },
    "4세": {
        "알림장용": [
            "오늘은 {keyword} 활동을 해보았습니다. OO이는 {action}을 보이며 놀이를 확장했습니다.",
            "{keyword} 활동 시간에 OO이가 친구와 생각을 주고받으며 참여하는 모습을 보였습니다.",
            "OO이는 {keyword} 놀이 중 차례와 약속을 경험하며 놀이를 이어갔습니다.",
            "{keyword} 활동에서 OO이는 상상한 내용을 말과 행동으로 표현했습니다.",
            "오늘의 {keyword} 경험은 OO이가 이유를 말하고 친구의 반응을 살피는 시간이 되었습니다.",
        ],
        "관찰 기록용": [
            "{keyword} 활동 중 {child}는 {action}을 보임.",
            "{child}는 {keyword} 상황에서 친구와 차례를 경험하며 놀이에 참여함.",
            "{keyword} 놀이 과정에서 {child}는 자신의 생각과 이유를 말로 표현함.",
            "{child}는 {keyword} 활동 중 친구의 반응을 살피고 놀이 방향을 조정해 봄.",
            "{keyword} 활동에서 {child}는 상상한 내용을 역할과 행동으로 표현함.",
        ],
        "서술형 일지용": [
            "{keyword} 활동을 통해 {child}가 상상한 내용을 놀이로 확장하는 모습을 관찰할 수 있었음.",
            "오늘 {keyword} 활동에서는 {child}의 이유 설명, 차례 경험, 친구와의 상호작용을 중심으로 살펴볼 수 있었음.",
            "{child}는 {keyword} 장면에서 친구와 의견을 주고받으며 놀이를 이어갔음.",
            "교사는 {child}가 {keyword} 놀이 속 약속과 역할을 이해할 수 있도록 지원하였음.",
            "{keyword} 활동은 {child}의 상상 표현과 관계 조절 경험을 살펴볼 수 있는 장면이 되었음.",
        ],
        "기관 홍보용": [
            "오늘 우리 4세 유아들은 {keyword} 활동을 통해 상상과 표현을 확장하는 시간을 가졌습니다.",
            "{keyword} 활동 안에서 아이들은 친구와 생각을 주고받고 차례와 약속을 경험했습니다.",
            "아이들의 호기심이 {keyword} 활동 속에서 이야기와 표현으로 이어졌습니다.",
            "우리 기관은 4세 유아가 놀이 속에서 생각을 말하고 친구와 맞춰가는 경험을 넓혀가도록 지원합니다.",
            "오늘의 {keyword} 경험은 유아의 상상, 표현, 관계 경험이 함께 자라는 시간이 되었습니다.",
        ],
    },
    "5세": {
        "알림장용": [
            "오늘은 {keyword} 활동을 해보았습니다. OO이는 {action}을 보이며 놀이를 계획하고 이어갔습니다.",
            "{keyword} 활동 시간에 OO이가 친구와 역할과 규칙을 정하며 참여하는 모습을 보였습니다.",
            "OO이는 {keyword} 놀이 중 자신의 생각을 이유와 함께 설명하며 놀이를 확장했습니다.",
            "{keyword} 활동에서 OO이는 친구와 협력하며 문제 해결 방법을 찾아보았습니다.",
            "오늘의 {keyword} 경험은 OO이가 계획, 협력, 설명의 힘을 키워가는 시간이 되었습니다.",
        ],
        "관찰 기록용": [
            "{keyword} 활동 중 {child}는 {action}을 보임.",
            "{child}는 {keyword} 상황에서 친구와 역할과 규칙을 조율하며 놀이에 참여함.",
            "{keyword} 놀이 과정에서 {child}는 자신의 생각을 이유와 함께 설명함.",
            "{child}는 {keyword} 활동 중 문제 상황에 대해 해결 방법을 제안하고 시도함.",
            "{keyword} 활동에서 {child}는 놀이 계획을 세우고 친구와 협력해 활동을 이어감.",
        ],
        "서술형 일지용": [
            "{keyword} 활동을 통해 {child}가 놀이를 계획하고 친구와 협력하는 모습을 관찰할 수 있었음.",
            "오늘 {keyword} 활동에서는 {child}의 역할 조율, 규칙 이해, 문제 해결 시도를 중심으로 살펴볼 수 있었음.",
            "{child}는 {keyword} 장면에서 자신의 생각을 이유와 함께 설명하며 놀이를 확장하였음.",
            "교사는 {child}가 {keyword} 놀이에서 스스로 계획하고 협력할 수 있도록 필요한 지원을 제공하였음.",
            "{keyword} 활동은 {child}의 계획성, 협력, 회상과 설명 능력을 살펴볼 수 있는 장면이 되었음.",
        ],
        "기관 홍보용": [
            "오늘 우리 5세 유아들은 {keyword} 활동을 통해 계획하고 협력하는 놀이 경험을 쌓았습니다.",
            "{keyword} 활동 안에서 아이들은 역할과 규칙을 조율하며 놀이를 주도적으로 이어갔습니다.",
            "아이들의 생각이 {keyword} 활동 속에서 이야기, 계획, 문제 해결로 확장되었습니다.",
            "우리 기관은 5세 유아가 놀이 속에서 협력하고 자신의 생각을 설명하는 힘을 기를 수 있도록 지원합니다.",
            "오늘의 {keyword} 경험은 유아의 주도성, 협력, 탐구가 함께 드러난 장면이 되었습니다.",
        ],
    },
}
OBSERVATION_TEMPLATES_BY_AGE.update(PRESCHOOL_OBSERVATION_TEMPLATES_BY_AGE)

DIARY_MESSAGE_BANK_BY_AGE = {
    "3세": GENERAL_DIARY_MESSAGE_BANK,
    "4세": GENERAL_DIARY_MESSAGE_BANK,
    "5세": GENERAL_DIARY_MESSAGE_BANK,
}


def make_diary_message(
    restructured_text: str,
    teacher_tone: str,
    daily_scope: str,
    record_type: str,
    age: str | None = "2세",
) -> str:
    """알림장/일지 생성 문구를 연령별 보정 후 반환합니다."""
    age = normalize_age(age)
    bank = GENERAL_DIARY_MESSAGE_BANK.get(record_type, GENERAL_DIARY_MESSAGE_BANK["알림장용"]).get(teacher_tone, [])
    selected = random.sample(bank, k=min(2, len(bank))) if bank else []

    age_tail = {
        "3세": {
            "알림장용": "- 3세 발달 특성을 고려해 놀이 참여, 짧은 표현, 친구 곁에서의 경험을 중심으로 살펴보았습니다.",
            "관찰 기록용": "- 3세 유아의 관심 표현, 짧은 말, 친구 곁 놀이 경험을 중심으로 기록하였다.",
            "서술형 일지용": "- 3세 유아의 놀이 접근, 표현 시도, 관계 경험을 중심으로 일과를 정리하였다.",
            "기관 홍보용": "- 3세 유아의 작은 참여와 표현을 소중한 배움의 장면으로 기록하고 있습니다.",
        },
        "4세": {
            "알림장용": "- 4세 발달 특성을 고려해 상상 확장, 이유 말하기, 차례와 공유 경험을 중심으로 살펴보았습니다.",
            "관찰 기록용": "- 4세 유아의 상상 표현, 이유 설명, 친구와의 조절 경험을 중심으로 기록하였다.",
            "서술형 일지용": "- 4세 유아의 놀이 확장, 차례 경험, 관계 조절 과정을 중심으로 일과를 정리하였다.",
            "기관 홍보용": "- 4세 유아의 상상과 관계 경험이 놀이 안에서 자랄 수 있도록 지원하고 있습니다.",
        },
        "5세": {
            "알림장용": "- 5세 발달 특성을 고려해 계획, 협력, 규칙 조율, 이유 설명을 중심으로 살펴보았습니다.",
            "관찰 기록용": "- 5세 유아의 계획성, 협력, 규칙 조율, 문제 해결 시도를 중심으로 기록하였다.",
            "서술형 일지용": "- 5세 유아의 놀이 계획, 협력, 회상과 설명 과정을 중심으로 일과를 정리하였다.",
            "기관 홍보용": "- 5세 유아의 주도성, 협력, 탐구 경험이 놀이 속에서 확장되도록 지원하고 있습니다.",
        },
    }

    if age in age_tail:
        selected.append(age_tail[age].get(record_type, ""))

    selected_text = "\n".join([f"- {age_sanitize(s, age).lstrip('- ').strip()}" for s in selected if s])
    return age_sanitize(f"{restructured_text}\n\n{selected_text}".strip(), age)


def get_child_action_options(age: str | None) -> list[str]:
    age = normalize_age(age)
    if age not in ["0세", "1세", "2세", "3세", "4세", "5세"]:
        return ["- 선택 -"]
    if age == "0세":
        return [
            "- 선택 -",
            "주변 소리와 움직임에 시선을 두는 모습",
            "손으로 만지고 입으로 탐색하려는 모습",
            "교사의 말소리와 표정에 반응하는 모습",
            "편안한 자세로 머물며 감각을 느끼는 모습",
            "표정, 울음, 옹알이, 몸짓으로 반응하는 모습",
            "관심 있는 놀잇감을 바라보거나 손을 뻗는 모습",
            "익숙한 사람 곁에서 안정감을 보이는 모습",
            "반복되는 소리나 움직임에 관심을 보이는 모습",
        ]
    if age == "1세":
        return [
            "- 선택 -",
            "관심 있는 놀잇감을 반복해서 살펴보는 모습",
            "몸짓과 말소리로 요구를 나타내는 모습",
            "교사의 도움을 받아 놀이에 참여하는 모습",
            "놀이 자료를 만지고 움직이며 탐색하는 모습",
            "또래의 행동을 바라보고 가까이 다가가는 모습",
            "익숙한 행동을 흉내 내는 모습",
            "스스로 해보려는 시도를 반복하는 모습",
            "간단한 말이나 손짓으로 반응하는 모습",
        ]
    if age == "2세":
        return [
            "- 선택 -",
            "호기심을 보이며 탐색하는 모습",
            "단어와 짧은 말로 요구를 표현하는 모습",
            "반복하며 시도하는 모습",
            "교사의 지원을 받아 안정적으로 참여하는 모습",
            "놀이 자료를 조심스럽게 살펴보는 모습",
            "또래 곁에서 놀이하며 반응하는 모습",
            "자신이 선택한 놀이에 집중하는 모습",
            "감각적으로 느끼고 몸으로 표현하는 모습",
            "익숙한 일상 행동을 놀이로 나타내는 모습",
        ]
    if age == "3세":
        return [
            "- 선택 -",
            "호기심을 보이며 놀이에 다가가는 모습",
            "짧은 말과 행동으로 생각을 표현하는 모습",
            "친구 곁에서 놀이를 살피고 참여하는 모습",
            "익숙한 생활 장면을 흉내 내는 모습",
            "반복하며 방법을 시도하는 모습",
            "교사의 도움을 받아 차례를 경험하는 모습",
            "놀이 자료를 선택하고 탐색하는 모습",
            "감각적으로 느끼고 몸으로 표현하는 모습",
            "간단한 역할이나 상상 행동을 나타내는 모습",
        ]
    if age == "4세":
        return [
            "- 선택 -",
            "친구와 생각을 주고받으며 놀이하는 모습",
            "자신의 생각과 이유를 말로 표현하는 모습",
            "상상한 내용을 역할이나 이야기로 확장하는 모습",
            "차례와 공유를 경험하며 참여하는 모습",
            "새로운 방법을 찾아보고 다시 시도하는 모습",
            "놀이 속 약속을 이해하고 지키려는 모습",
            "친구의 말과 행동을 살피며 반응하는 모습",
            "놀이 자료의 특징을 비교하고 분류하는 모습",
            "완성한 결과물을 교사나 친구에게 설명하는 모습",
        ]
    if age == "5세":
        return [
            "- 선택 -",
            "놀이를 계획하고 필요한 자료를 선택하는 모습",
            "친구와 역할과 규칙을 조율하는 모습",
            "자신의 생각을 이유와 함께 설명하는 모습",
            "문제 상황에서 해결 방법을 제안하는 모습",
            "친구와 협력하여 놀이를 이어가는 모습",
            "규칙을 이해하고 놀이에 적용하려는 모습",
            "경험한 내용을 회상하며 이야기하는 모습",
            "여러 방법을 비교하고 다시 시도하는 모습",
            "완성한 결과물의 과정과 의미를 설명하는 모습",
        ]
    return ["- 선택 -"]


# =========================
# 놀이 이야기 생성
# =========================
# 기록 요정의 '놀이 이야기'는 선택한 단계만 출력합니다.
# 교사의 지원은 복수 선택을 허용하며, 지원을 하나라도 고르면
# '4. 교사의 지원' 단계가 선택되지 않았더라도 결과에 자동 반영됩니다.
PLAY_STORY_STAGE_OPTIONS = [
    "1. 시작 (놀이 발현)",
    "2. 과정 (놀이 전개)",
    "3. 배움 읽기 (의미 찾기)",
    "4. 교사의 지원",
    "5. 변화 (확장과 심화)",
    "6. 결과 (성찰 및 연계)",
]

TEACHER_SUPPORT_OPTIONS = [
    "시간 지원",
    "공간 지원",
    "자료 지원",
    "상호작용 지원",
]

TEACHER_SUPPORT_GUIDE = {
    "시간 지원": "놀이의 연속성 확보 및 융통성 있는 일과 운영",
    "공간 지원": "흥미 영역의 경계를 허문 가변적이고 유연한 물리적 공간 구성",
    "자료 지원": "비구조화된 매체(개방적 자료) 및 일상 사물의 제공",
    "상호작용 지원": "정서적 지지, 개방적 발문, 공동 놀이자로서의 적절한 개입",
}


PLAY_STORY_AGE_LANGUAGE = {
    "0세": {
        "process": "{subject}는 관심이 가는 자료를 바라보고 만지며, 익숙해질 때까지 자신의 속도로 감각 경험을 이어갔습니다.",
        "change": "{support_context} {subject}는 관심을 보인 자극을 다시 바라보거나 손으로 탐색하며 반응을 이어갔습니다.",
        "result": "이번 경험을 통해 {subject}는 감각과 정서적 안정감을 바탕으로 주변을 알아가는 시간을 가졌습니다. 교사는 시선과 표정, 소리와 몸짓이 다음 놀이를 이어갈 중요한 신호임을 확인했습니다. 다음에는 같은 자료를 가까이에 두어 편안한 감각 경험이 다시 이어지도록 지원할 수 있습니다.",
    },
    "1세": {
        "process": "{subject}는 관심 가는 자료를 만지고 움직이며 같은 행동을 여러 번 시도했습니다. 몸짓과 말소리로 관심을 드러내며 놀이 흐름을 이어갔습니다.",
        "change": "{support_context} {subject}는 익숙해진 자료를 다시 선택하고, 자신이 알고 있는 방법으로 탐색을 조금 더 이어갔습니다.",
        "result": "이번 경험을 통해 {subject}는 반복 탐색과 작은 모방을 통해 놀이의 즐거움을 알아갔습니다. 교사는 스스로 다시 시도하려는 모습이 다음 놀이를 확장하는 단서임을 확인했습니다. 다음에는 오늘 관심 보인 자료를 가까이에 두어 스스로 다시 선택해 볼 수 있도록 연결할 수 있습니다.",
    },
    "2세": {
        "process": "{subject}는 선택한 자료를 반복해서 사용하며, 표정·몸짓·단어·짧은 말로 관심과 요구를 나타냈습니다. 익숙한 방법을 바탕으로 자신만의 탐색을 이어갔습니다.",
        "change": "{support_context} {subject}는 선택한 자료를 다시 활용하고, 또래와 교사의 반응을 살피며 놀이의 흐름을 한층 더 이어갔습니다.",
        "result": "이번 경험을 통해 {subject}는 관심 있는 놀이를 선택하고, 짧은 말과 행동으로 자신의 생각을 표현해 보았습니다. 교사는 아이의 선택과 표현이 다음 놀이를 넓혀가는 중요한 단서임을 확인했습니다. 다음에는 오늘 사용한 자료를 다른 재료와 연결하여 탐색과 표현이 이어지도록 지원할 수 있습니다.",
    },
    "3세": {
        "process": "{subject}는 관심 가는 자료를 골라 만지고 움직이며, 짧은 말과 행동으로 자신의 생각을 나타냈습니다. 친구의 놀이를 살피고 곁에서 함께하며 놀이에 참여했습니다.",
        "change": "{support_context} {subject}는 익숙한 행동을 다시 시도하고, 친구의 놀이를 살피며 자신에게 맞는 참여 방식을 넓혀갔습니다.",
        "result": "이번 경험을 통해 {subject}는 관심 있는 놀이에 다가가 짧은 말과 행동으로 자신의 생각을 표현해 보았습니다. 교사는 이러한 과정 자체가 중요한 배움임을 확인했습니다. 다음에는 오늘의 장면을 간단한 역할이나 이야기로 다시 이어가 볼 수 있습니다.",
    },
    "4세": {
        "process": "{subject}는 자료의 특징을 살피고 친구와 생각을 주고받으며, 차례와 약속을 경험하는 가운데 놀이를 확장했습니다.",
        "change": "{support_context} {subject}는 상상한 내용을 역할과 이야기로 더해 보고, 친구의 반응을 살피며 놀이 방향을 다시 조정했습니다.",
        "result": "이번 경험을 통해 {subject}는 상상한 내용을 놀이로 확장하고, 친구와 생각을 맞춰가는 시간을 가졌습니다. 교사는 이유를 말하고 친구의 반응을 살피는 과정에서 언어와 관계 경험이 함께 넓어지고 있음을 확인했습니다. 다음에는 오늘 만든 이야기에 새로운 역할이나 재료를 더해 놀이를 이어갈 수 있습니다.",
    },
    "5세": {
        "process": "{subject}는 필요한 자료를 살피고 친구와 역할과 규칙을 정하며 놀이를 이어갔습니다. 자신의 생각을 이유와 함께 설명하고, 서로의 의견을 반영하며 놀이 흐름을 만들어갔습니다.",
        "change": "{support_context} {subject}는 여러 방법을 비교하고 친구와 의견을 조율하며, 더 복잡하고 풍부한 놀이 흐름으로 확장했습니다.",
        "result": "이번 경험을 통해 {subject}는 계획, 협력, 문제 해결 시도, 회상과 설명을 놀이 안에서 함께 경험했습니다. 교사는 아이들이 스스로 세운 계획을 조정하며 공동의 놀이를 만들어가는 힘을 확인했습니다. 다음에는 오늘의 과정과 결과를 다시 이야기하며 새로운 놀이 계획으로 연결할 수 있습니다.",
    },
}


def _play_story_subject(age: str) -> str:
    return "영아" if age in ["0세", "1세", "2세"] else "유아"


def _ordered_selections(options: list[str], selected: list[str] | None) -> list[str]:
    selected = selected or []
    return [option for option in options if option in selected]


def _split_play_keyword(play_keyword: str) -> tuple[str, str, str]:
    """'놀이 - 세부 구분' 입력을 이야기 제목에 자연스럽게 반영합니다."""
    cleaned = re.sub(r"\s+", " ", (play_keyword or "").strip())
    parts = [part.strip() for part in re.split(r"\s*[-–—:]\s*", cleaned, maxsplit=1) if part.strip()]

    if len(parts) >= 2:
        play_name, detail = parts[0], parts[1]
        return play_name, detail, f"{play_name} - {detail}"

    return cleaned, "", cleaned


def _ensure_sentence_end(text: str) -> str:
    text = (text or "").strip()
    if not text:
        return ""
    return text if text.endswith((".", "!", "?", "…")) else f"{text}."


def _is_complete_observation(text: str) -> bool:
    cleaned = (text or "").strip().rstrip(".")
    return bool(
        re.search(
            r"(습니다|했습니다|하였다|했다|보였습니다|보였다|나타났습니다|나타났다|였습니다|이었다|입니다|이다|됨|함)$",
            cleaned,
        )
    )


def _observation_sentence_for_story(subject: str, child_action: str) -> str:
    """선택형 '...하는 모습'과 직접 입력 문장을 모두 자연스럽게 시작 문장으로 바꿉니다."""
    action = re.sub(r"\s+", " ", (child_action or "").strip()).strip(" .")

    if not action:
        return f"사진 속 {subject}가 놀이에 관심을 보였습니다."

    if _is_complete_observation(action):
        return _ensure_sentence_end(action)

    if action.endswith("모습"):
        return f"사진 속 {subject}에게서 {action}이 관찰되었습니다."

    if re.search(r"(하며|하면서|하고|한 뒤|한 후|다가가며|이어가며)$", action):
        return f"사진 속 {subject}는 {action} 놀이를 이어갔습니다."

    return f"사진 속 {subject}가 {action}을 보였습니다."


PLAY_STORY_DISPLAY_TITLES = {
    "1. 시작 (놀이 발현)": "🌱 놀이의 시작",
    "2. 과정 (놀이 전개)": "🧩 놀이의 흐름",
    "3. 배움 읽기 (의미 찾기)": "💡 놀이에서 읽은 배움",
    "4. 교사의 지원": "🪴 교사의 지원",
    "5. 변화 (확장과 심화)": "🌿 더 깊어진 놀이",
    "6. 결과 (성찰 및 연계)": "🔗 다음 놀이로 이어가기",
}


def _support_context(selected_supports: list[str]) -> str:
    return "교사의 지원과 충분한 놀이 시간 속에서" if selected_supports else "반복해서 탐색하는 과정에서"


def _clean_play_title(play_title: str, play_keyword: str) -> str:
    """사용자가 쓴 놀이명을 우선 사용하고, 비어 있으면 키워드로 자연스럽게 대체합니다."""
    title = re.sub(r"\s+", " ", (play_title or "").strip())
    if title:
        return title
    _, _, keyword_title = _split_play_keyword(play_keyword)
    return keyword_title or "오늘의 놀이"


def _build_play_learning_text(
    age: str,
    curriculum_area: str,
    development_area: str,
) -> str:
    """선택한 교육과정·발달영역을 문장 안에 자연스럽게 연결합니다."""
    age_meaning = {
        "0세": "감각 자극에 반응하고 친숙한 사람과의 안정감 안에서 주변을 알아가는 경험이 쌓였습니다.",
        "1세": "관심 있는 대상을 반복해 탐색하고, 몸짓과 말소리로 반응을 나타내는 경험이 이어졌습니다.",
        "2세": "스스로 선택한 놀이를 반복하며 표정·몸짓·단어·짧은 말로 관심과 요구를 표현해 보는 경험이 이어졌습니다.",
        "3세": "관심 있는 놀이에 다가가 짧은 말과 행동으로 생각을 나타내고, 친구 곁에서 함께하는 경험을 넓혔습니다.",
        "4세": "상상한 내용을 놀이로 확장하고, 친구와 생각을 주고받으며 차례와 약속을 경험했습니다.",
        "5세": "놀이를 계획하고 역할과 규칙을 조율하며, 자신의 생각을 이유와 함께 설명하고 협력하는 경험을 넓혔습니다.",
    }
    return (
        f"이 과정에서 {age_meaning.get(age, age_meaning['2세'])} "
        f"특히 {curriculum_area} 영역의 경험과 {development_area} 발달이 놀이 안에서 함께 드러났습니다."
    )


def build_teacher_support_text(
    age: str,
    supports: list[str],
    play_keyword: str,
    curriculum_area: str,
    development_area: str,
    child_action: str,
) -> str:
    """선택한 교사 지원을 결과 본문에 자연스럽게 반영합니다."""
    age = normalize_age(age)
    selected_supports = _ordered_selections(TEACHER_SUPPORT_OPTIONS, supports)
    if not selected_supports:
        return ""

    subject = _play_story_subject(age)
    clauses_by_age = {
        "0세": {
            "시간 지원": "관심을 보인 감각 경험에 충분히 머물 수 있도록 일과의 속도를 조절했습니다.",
            "공간 지원": "교사 곁에서 편안히 탐색할 수 있도록 안전하고 안정적인 자리를 마련했습니다.",
            "자료 지원": "바라보고 만지고 들을 수 있는 안전한 감각 자료와 일상 사물을 가까이에 두었습니다.",
            "상호작용 지원": "시선·표정·소리·몸짓을 세심히 읽고, 말소리와 표정으로 반응을 되돌려 주었습니다.",
        },
        "1세": {
            "시간 지원": "자료를 반복해서 조작하고 다시 시도할 수 있도록 놀이 시간을 충분히 보장했습니다.",
            "공간 지원": "관심 있는 자료에 자유롭게 다가가고 교사 곁에서 안정감을 느낄 수 있도록 놀이 영역을 유연하게 구성했습니다.",
            "자료 지원": "만지고 움직이며 탐색할 수 있는 개방적인 자료와 일상 사물을 제공했습니다.",
            "상호작용 지원": "몸짓과 말소리를 기다리고 짧은 말로 되돌려 주며 놀이 참여가 이어지도록 도왔습니다.",
        },
        "2세": {
            "시간 지원": "선택한 놀이를 반복하고 자신의 반응을 충분히 표현할 수 있도록 놀이 시간을 확보했습니다.",
            "공간 지원": "또래 곁에서 놀이를 살피고 필요할 때 교사와 가까이 머물 수 있도록 영역의 경계를 유연하게 조정했습니다.",
            "자료 지원": "스스로 선택하고 조합해 볼 수 있는 비구조화된 재료와 일상 사물을 제공했습니다.",
            "상호작용 지원": "표정·몸짓·단어·짧은 말을 존중하고, 선택과 시도를 말로 반영하며 놀이를 함께 이어갔습니다.",
        },
        "3세": {
            "시간 지원": "놀이에 천천히 다가가고 반복해 볼 수 있도록 흐름을 서두르지 않고 보장했습니다.",
            "공간 지원": "관심 있는 자료를 선택하고 친구 곁에서 함께 놀이할 수 있도록 영역을 연결해 유연하게 구성했습니다.",
            "자료 지원": "만지고 옮기고 조합하며 놀이를 확장할 수 있는 개방적인 자료와 일상 사물을 제공했습니다.",
            "상호작용 지원": "짧은 말과 행동을 기다리고 선택을 말로 되짚으며, 친구와 함께 놀이할 수 있도록 정서적으로 지지했습니다.",
        },
        "4세": {
            "시간 지원": "떠올린 생각을 충분히 시도하고 친구와 차례와 약속을 경험할 수 있도록 놀이 시간을 이어갔습니다.",
            "공간 지원": "역할과 이야기를 확장할 수 있도록 영역의 경계를 열고 자료를 이동할 수 있는 유연한 공간을 마련했습니다.",
            "자료 지원": "비교하고 조합하며 상상한 내용을 표현할 수 있도록 다양한 개방형 재료와 일상 사물을 제공했습니다.",
            "상호작용 지원": "자신의 생각과 이유를 말하고 친구의 반응을 살필 수 있도록 개방적 발문과 공동 놀이자 역할로 함께했습니다.",
        },
        "5세": {
            "시간 지원": "놀이를 계획하고 역할과 규칙을 조율하며 충분히 수정·보완할 수 있도록 일과를 융통성 있게 운영했습니다.",
            "공간 지원": "자료를 배치하고 역할 놀이 또는 구성 놀이를 확장할 수 있도록 영역을 가변적으로 연결했습니다.",
            "자료 지원": "여러 방법을 비교하고 해결 방법을 시도할 수 있도록 개방형 재료와 일상 사물을 충분히 제공했습니다.",
            "상호작용 지원": "생각을 이유와 함께 설명하고 친구와 조율할 수 있도록 개방적 발문과 적절한 공동 놀이자 지원을 제공했습니다.",
        },
    }

    selected_sentences = [
        clauses_by_age.get(age, clauses_by_age["2세"])[support]
        for support in selected_supports
    ]

    # 한 지원은 한 문장으로, 여러 지원은 문단 안에서 끊어 읽기 좋게 이어 줍니다.
    support_body = " ".join(selected_sentences)
    purpose = (
        f"이러한 지원은 {subject}가 ‘{play_keyword}’ 놀이를 충분히 이어가며 "
        f"{curriculum_area} 영역의 경험과 {development_area} 발달을 자연스럽게 넓혀가도록 돕기 위한 것이었습니다."
    )
    return f"교사는 {support_body}\n{purpose}"

def build_play_story(
    play_title: str,
    play_keyword: str,
    age_group: str,
    curriculum_area: str,
    development_area: str,
    child_action: str,
    selected_steps: list[str],
    selected_supports: list[str],
) -> str:
    """선택한 단계와 교사 지원을 번호 없이, 문단 구조로 읽히는 놀이 이야기로 구성합니다."""
    age = normalize_age(age_group)
    ordered_steps = _ordered_selections(PLAY_STORY_STAGE_OPTIONS, selected_steps)

    # 지원 유형을 하나라도 선택했다면 4단계를 자동 포함합니다.
    if selected_supports and "4. 교사의 지원" not in ordered_steps:
        ordered_steps = _ordered_selections(
            PLAY_STORY_STAGE_OPTIONS,
            list(ordered_steps) + ["4. 교사의 지원"],
        )

    subject = _play_story_subject(age)
    _, _, keyword_title = _split_play_keyword(play_keyword)
    story_title = _clean_play_title(play_title, play_keyword)
    language = PLAY_STORY_AGE_LANGUAGE.get(age, PLAY_STORY_AGE_LANGUAGE["2세"])
    observation_sentence = _observation_sentence_for_story(subject, child_action)

    sections = [
        f"🎈 {story_title}\n"
        f"놀이 주제: {keyword_title} · 연령: {age} · {curriculum_area} · {development_area}"
    ]

    for step in ordered_steps:
        display_title = PLAY_STORY_DISPLAY_TITLES.get(step, step)

        if step == "1. 시작 (놀이 발현)":
            body = (
                f"{observation_sentence} 이 장면에서 {subject}의 흥미가 ‘{story_title}’ 놀이로 이어지기 시작했습니다."
            )
        elif step == "2. 과정 (놀이 전개)":
            body = language["process"].format(subject=subject)
        elif step == "3. 배움 읽기 (의미 찾기)":
            body = _build_play_learning_text(
                age=age,
                curriculum_area=curriculum_area,
                development_area=development_area,
            )
        elif step == "4. 교사의 지원":
            body = build_teacher_support_text(
                age=age,
                supports=selected_supports,
                play_keyword=story_title,
                curriculum_area=curriculum_area,
                development_area=development_area,
                child_action=child_action,
            )
            if not body:
                body = (
                    f"교사는 {subject}의 반응을 세심히 관찰하며, 놀이가 자연스럽게 이어질 수 있도록 "
                    f"시간과 공간, 자료와 상호작용을 조절했습니다."
                )
        elif step == "5. 변화 (확장과 심화)":
            if selected_supports:
                support_context = "교사의 지원이 이어진 뒤"
            else:
                support_context = "반복해서 탐색하는 과정에서"
            body = language["change"].format(
                subject=subject,
                support_context=support_context,
            )
        elif step == "6. 결과 (성찰 및 연계)":
            body = language["result"].format(subject=subject)
        else:
            continue

        sections.append(f"{display_title}\n{body}")

    # 단계 사이의 빈 줄은 render_play_story가 문단을 분리하는 기준이므로 반드시 보존합니다.
    return age_sanitize("\n\n".join(sections), age)

def render_play_story(text: str):
    """놀이 이야기를 제목·메타·단계별 본문으로 안전하게 분리해 표시합니다."""
    normalized = (text or "").replace("\r\n", "\n").replace("\r", "\n").strip()
    blocks = [block.strip() for block in re.split(r"\n{2,}", normalized) if block.strip()]
    if not blocks:
        return

    header_lines = [line.strip() for line in blocks[0].split("\n") if line.strip()]
    title = header_lines[0] if header_lines else "🎈 놀이 이야기"
    meta = " ".join(header_lines[1:]).strip()

    section_html = []
    for block in blocks[1:]:
        lines = [line.strip() for line in block.split("\n") if line.strip()]
        if not lines:
            continue
        section_title = re.sub(r"^\d+\.\s*", "", lines[0])
        # 단계 본문 안의 줄바꿈은 문장 구분으로 활용합니다.
        section_body = "<br>".join(html.escape(line) for line in lines[1:])
        if section_title and section_body:
            section_html.append(
                f"<section class='play-story-section'>"
                f"<div class='play-story-section-title'>{html.escape(section_title)}</div>"
                f"<div class='play-story-section-body'>{section_body}</div>"
                f"</section>"
            )

    st.markdown(
        f"<div class='play-story-card'>"
        f"<div class='play-story-title'>{html.escape(title)}</div>"
        f"<div class='play-story-meta'>{html.escape(meta)}</div>"
        f"{''.join(section_html)}"
        f"</div>",
        unsafe_allow_html=True,
    )

def get_child_action_options_with_custom(age: str | None) -> list[str]:
    """기존 연령별 선택지에 직접 입력을 안전하게 추가합니다."""
    options = list(get_child_action_options(age))
    if "직접 입력" not in options:
        options.append("직접 입력")
    return options

def reset_tab2_inputs_once():
    """기록 요정 탭의 이전 입력값이 처음 화면에 남아 보이지 않도록 한 번만 초기화합니다.

    Streamlit은 같은 key를 가진 위젯 값을 브라우저 세션에 보관할 수 있습니다.
    그래서 코드상 기본값이 "- 선택 -"이어도 이전에 선택한 값이 다시 보일 수 있습니다.
    이 함수는 앱 갱신 후 첫 렌더링에서만 기존 기록 요정 입력값을 지우고,
    사용자가 이후 선택한 값은 정상적으로 유지되게 합니다.
    """
    reset_flag = "_tab2_initial_values_cleared_20260702_v7"
    if st.session_state.get(reset_flag):
        return

    # 기존 선택값 '놀이의 시작'은 새 명칭 '관심의 시작'으로 안전하게 옮깁니다.
    previous_details = st.session_state.get("wizard_play_subcategories")
    if isinstance(previous_details, list):
        st.session_state["wizard_play_subcategories"] = [
            "관심의 시작" if value == "놀이의 시작" else value
            for value in previous_details
        ]

    keys_to_clear = [
        "photo_play_story_name",
        "photo_play_keyword",
        "photo_age_group",
        "photo_standard_area",
        "photo_nuri_area",
        "photo_curriculum_placeholder",
        "photo_development_area",
        "photo_observation_type",
        "photo_parent_type",
        "photo_play_story_steps",
        "photo_teacher_supports",
        "photo_child_action",
        "photo_child_action_custom",
        "wizard_parent_type",
        "wizard_play_goal",
        "wizard_diary_components",
        "wizard_teacher_observed_situation",
        "wizard_next_play_support_plan",
    ]

    for key in keys_to_clear:
        st.session_state.pop(key, None)

    st.session_state[reset_flag] = True


PLAY_STORY_DETAIL_OPTIONS = [
    "관심의 시작", "탐색과 반복", "표현과 구성", "관계와 상호작용", "확장과 심화"
]

PLAY_DETAIL_NOTE_PLACEHOLDERS = {
    "관심의 시작": "예: 자연물을 음식처럼 놓고 ‘가게예요’라고 말하며 놀이를 시작했습니다.",
    "탐색과 반복": "예: 바구니에 재료를 반복해서 담고 꺼내며 가격표를 만들어 보았습니다.",
    "표현과 구성": "예: 나무 블록과 자연물을 놓아 가게 공간을 꾸미며 역할을 더했습니다.",
    "관계와 상호작용": "예: 친구에게 물건을 건네고 손님·주인 역할을 번갈아 경험했습니다.",
    "확장과 심화": "예: 메뉴판이나 가격표를 더하며 가게 놀이를 다음 활동으로 이어갔습니다.",
}

TEACHER_SUPPORT_NOTE_PLACEHOLDERS = {
    "시간 지원": "예: 정리 시간을 늦추고 아이들이 선택한 놀이를 충분히 이어갈 수 있도록 했습니다.",
    "공간 지원": "예: 가게와 주방 공간을 연결해 재료를 자유롭게 옮길 수 있도록 했습니다.",
    "자료 지원": "예: 바구니, 가격표, 자연물과 음식 모형을 추가로 제공했습니다.",
    "상호작용 지원": "예: ‘어떤 가게인가요?’라고 묻고 아이의 설명을 되짚어 주었습니다.",
}


def _note_widget_key(prefix: str, option: str) -> str:
    digest = hashlib.sha1(str(option).encode("utf-8")).hexdigest()[:12]
    return f"{prefix}_{digest}"


def render_selected_note_inputs(selected: list[str], note_kind: str) -> dict[str, str]:
    """선택된 구성마다 교사가 실제 장면 또는 구체 지원을 적도록 합니다.

    놀이 이야기: 놀이 세부 구분과 교사의 지원별 메모가 필수입니다.
    보육일지: 일상생활·놀이·활동별 실제 장면 메모가 필수입니다.
    """
    notes: dict[str, str] = {}
    if not selected:
        return notes

    if note_kind == "play_detail":
        title = "선택한 놀이 세부 구분별 실제 장면"
        placeholders = PLAY_DETAIL_NOTE_PLACEHOLDERS
        key_prefix = "wizard_play_detail_note"
        label_suffix = "장면 설명 (필수)"
    elif note_kind == "diary_component":
        title = "선택한 보육일지 세부 구성별 실제 장면"
        placeholders = DIARY_COMPONENT_NOTE_PLACEHOLDERS
        key_prefix = "wizard_diary_component_note"
        label_suffix = "세부 설명 (필수)"
    else:
        title = "선택한 교사 지원별 구체 지원 내용"
        placeholders = TEACHER_SUPPORT_NOTE_PLACEHOLDERS
        key_prefix = "wizard_teacher_support_note"
        label_suffix = "구체 지원 (필수)"

    st.caption(f"{title}은 **필수 입력**입니다. 사진과 실제 관찰에 근거해 적을수록 최종 기록이 정확해집니다.")

    for option in selected:
        st.markdown(f"**{option}**")
        value = st.text_area(
            f"{option} {label_suffix}",
            placeholder=placeholders.get(option, "사진에서 확인되는 실제 장면이나 교사의 지원을 적어 주세요."),
            height=84,
            key=_note_widget_key(key_prefix, option),
        )
        if value.strip():
            notes[option] = value.strip()
    return notes

def render_final_play_output(output: dict):
    output_type = str(output.get("output_type") or "")
    if output_type in ["놀이 이야기", "일지"]:
        photo_section_title = "사진 속 놀이 내용" if output_type == "놀이 이야기" else "사진 속 일상·놀이·활동 장면"
        st.markdown(f"#### {photo_section_title}")
        render_result_card(str(output.get("photo_play_content") or ""), "result-card-gray")

        st.markdown("#### 교사가 관찰한 놀이 상황")
        render_result_card(str(output.get("teacher_observed_situation") or ""), "result-card-gray")

        st.markdown(f"#### {output.get('framework_label') or '교육과정 연계'}")
        link_rows = output.get("curriculum_links") or []
        if link_rows:
            curriculum_df = pd.DataFrame(link_rows).rename(columns={"area": "영역", "description": "내용"})
            st.dataframe(curriculum_df, use_container_width=True, hide_index=True)
        else:
            st.caption("선택한 교육과정 영역의 연계 설명이 없습니다.")

        st.markdown(f"#### {output.get('observation_label') or '영유아 관찰 및 평가'}")
        render_result_card(str(output.get("observation_evaluation") or ""), "result-card-gray")

        next_plan = str(output.get("next_play_support_plan") or "").strip()
        if next_plan:
            st.markdown("#### 다음 놀이 지원 계획")
            st.caption("교사가 입력한 계획을 원문 그대로 표시합니다.")
            render_result_card(next_plan, "result-card-gray")

        st.markdown(f"#### {output.get('record_label') or '종합 기록'}")
        render_result_card(str(output.get("integrated_record") or ""), "result-card-gray")
        return

    for index, example in enumerate(output.get("examples") or [], start=1):
        st.markdown(f"#### {output_type} 예시 {index}")
        render_result_card(str(example), "result-card-gray")

def build_record_download_text(context: dict, first_draft: str, output: dict) -> str:
    output_type = str(context.get("output_type") or "")
    component_label = "보육일지 세부 구성" if output_type == "일지" else "놀이 세부 구분"
    component_details = _selection_notes_display(
        _as_text_list(context.get("play_subcategories")),
        context.get("play_subcategory_notes"),
    )
    support_details = _selection_notes_display(
        _as_text_list(context.get("teacher_supports")),
        context.get("teacher_support_notes"),
    )
    analysis = context.get("photo_analysis") if isinstance(context.get("photo_analysis"), dict) else {}
    base = (
        "놀이 기록 자동화 | 사진 기반 기록\n\n"
        f"놀이명: {context.get('play_name') or '-'}\n"
        f"연령: {context.get('age_group') or '-'}\n"
        f"아이 별칭: {context.get('child_alias') or '-'}\n"
        f"교육과정 영역: {curriculum_display_text(context.get('curriculum_areas'))}\n"
        f"기록 유형: {output_type or '-'}\n"
        f"보호자 유형: {context.get('parent_type') or '-'}\n\n"
        f"[{component_label}과 실제 장면]\n{component_details}\n\n"
    )
    if output_type == "놀이 이야기":
        base += f"[교사의 지원과 구체 지원]\n{support_details}\n\n"
    base += (
        f"[사진-놀이명 점검]\n"
        f"상태: {analysis.get('photo_match_status') or '-'}\n"
        f"사유: {analysis.get('photo_match_reason') or '-'}\n\n"
        f"[사진에 대한 1차 분석 결과]\n{first_draft.strip()}\n\n"
    )
    return base + f"[최종 생성 결과]\n{output.get('plain_text') or ''}\n"

with tab2:
    reset_tab2_inputs_once()
    render_menu_card(
        "🧚‍♀️ 사진 기반 놀이 기록 만들기",
        "놀이 정보를 입력하고 사진을 올리면 자동으로 3~5장을 추천·분석합니다. 사진 분석 결과와 교사의 관찰을 바탕으로 놀이 이야기·보육일지를 과정과 함께 생성합니다.",
        ["사진 자동 추천", "사진-놀이명 점검", "사진 1차 분석", "교사 관찰", "과정 산출", "기록 다운로드"]
    )

    if not member_is_logged_in():
        st.info("사진 저장과 개인 기록 연결을 위해 소통 탭에서 아이디와 비밀번호로 로그인해 주세요.")
    else:
        st.markdown("### 1. 놀이 기본 정보")
        play_name = st.text_input("놀이명", placeholder="예: 블록으로 만든 우리 동네", key="wizard_play_name")
        info_col1, info_col2 = st.columns(2)
        with info_col1:
            age_group = st.selectbox("연령", ["- 선택 -", "0세", "1세", "2세", "3세", "4세", "5세"], key="wizard_age_group")
        with info_col2:
            child_alias = st.text_input("아이 별칭", placeholder="예: 민들레반 A, 별칭 등", key="wizard_child_alias")

        if age_group in ["0세", "1세", "2세"]:
            curriculum_options = STANDARD_AREAS
            curriculum_label = "표준보육과정 영역 (복수 선택)"
            curriculum_help = "0~2세는 표준보육과정 영역 중 사진과 관찰 장면에 실제로 연결되는 항목을 복수로 선택합니다."
        elif age_group in ["3세", "4세", "5세"]:
            curriculum_options = NURI_AREAS
            curriculum_label = "누리과정 영역 (복수 선택)"
            curriculum_help = "3~5세는 누리과정 영역 중 사진과 관찰 장면에 실제로 연결되는 항목을 복수로 선택합니다."
        else:
            curriculum_options = []
            curriculum_label = "표준보육과정·누리과정 영역 (복수 선택)"
            curriculum_help = "연령을 먼저 선택해 주세요."

        curriculum_areas = st.multiselect(
            curriculum_label,
            curriculum_options,
            key="wizard_curriculum_areas",
            disabled=not bool(curriculum_options),
            help=curriculum_help,
            placeholder="선택해 주세요.",
        )
        st.caption(curriculum_help)

        record_type = st.selectbox("놀이 기록 유형", ["- 선택 -", "놀이 이야기", "일지", "알림장"], key="wizard_record_type")
        render_record_type_guidance(record_type, age_group)

        play_subcategories: list[str] = []
        teacher_supports: list[str] = []
        play_subcategory_notes: dict[str, str] = {}
        teacher_support_notes: dict[str, str] = {}
        parent_type = ""

        if record_type == "알림장":
            parent_type = st.selectbox(
                "보호자 유형",
                ["- 선택 -", *PARENT_TYPE_OPTIONS],
                key="wizard_parent_type",
                help="생성 문장의 전달 방식만 조정하며, 결과 문장에는 보호자 유형이 표시되지 않습니다.",
            )
            st.caption("일반형은 따뜻하고 자연스럽게, 예민형·공격형은 사실과 지원을 더 중립적으로, 불안형은 차분한 안내 중심으로 문장을 생성합니다.")

        if record_type == "놀이 이야기":
            st.markdown("#### 놀이 이야기 세부 구성")
            play_subcategories = st.multiselect(
                "놀이 세부 구분 (복수 선택)",
                PLAY_STORY_DETAIL_OPTIONS,
                key="wizard_play_subcategories",
                placeholder="선택해 주세요.",
            )
            render_play_detail_guidance(age_group, play_subcategories)
            play_subcategory_notes = render_selected_note_inputs(play_subcategories, "play_detail")

            teacher_supports = st.multiselect(
                "교사의 지원 (복수 선택)",
                TEACHER_SUPPORT_OPTIONS,
                key="wizard_teacher_supports",
                placeholder="선택해 주세요.",
            )
            teacher_support_notes = render_selected_note_inputs(teacher_supports, "teacher_support")
            st.caption("선택한 놀이 세부 구분과 교사의 지원은 각각 구체 설명을 입력해야 합니다. 입력 내용은 교육과정 연계, 관찰 및 평가, 종합 기록에 반영됩니다.")

        elif record_type == "일지":
            st.markdown("#### 보육일지 세부 구성")
            play_subcategories = st.multiselect(
                "기록할 장면 선택 (복수 선택)",
                DIARY_COMPONENT_OPTIONS,
                key="wizard_diary_components",
                placeholder="선택해 주세요.",
                help="하루 기록에 실제로 포함할 일상생활·놀이·활동 장면만 선택해 주세요.",
            )
            render_diary_component_guidance(age_group, play_subcategories)
            play_subcategory_notes = render_selected_note_inputs(play_subcategories, "diary_component")
            # 보육일지는 별도의 교사 지원 선택값을 두지 않습니다.
            teacher_supports = []
            teacher_support_notes = {}
            st.caption("선택한 일상생활·놀이·활동 장면마다 실제로 관찰한 내용을 입력해 주세요. 입력 내용은 교육과정 연계, 영유아 관찰 및 평가, 보육일지 기록 예시에 반영됩니다.")

        st.markdown("### 2. 사진 등록 및 자동 추천")
        uploaded_play_photos = st.file_uploader(
            "놀이 사진 등록",
            type=["jpg", "jpeg", "png", "webp"],
            accept_multiple_files=True,
            key="wizard_play_photo_uploader",
            help="최대 20장까지 올릴 수 있으며, 사진 선별 도구가 그중 3~5장을 추천합니다.",
        )
        recommendation_count = st.slider("AI 분석할 추천 사진 수", min_value=3, max_value=5, value=3, key="wizard_recommendation_count")
        photo_analysis_agree = st.checkbox(
            "사진 속 영유아의 보호자 동의와 기관의 사진 활용 지침을 확인했습니다. 자동 추천된 사진 원본은 비공개 Supabase Storage에 저장되며, 내 정보 보기에서 본인이 직접 삭제할 수 있습니다.",
            key="wizard_photo_analysis_agree",
        )

        if st.button("사진 자동 추천 및 1차 정보 만들기", key="wizard_start_analysis"):
            missing_detail_notes = [option for option in play_subcategories if not _as_note_dict(play_subcategory_notes).get(option, "").strip()]
            missing_support_notes = [option for option in teacher_supports if not _as_note_dict(teacher_support_notes).get(option, "").strip()]
            if not play_name.strip():
                st.warning("놀이명을 입력해 주세요.")
            elif age_group == "- 선택 -":
                st.warning("연령을 선택해 주세요.")
            elif not child_alias.strip():
                st.warning("아이 별칭을 입력해 주세요.")
            elif not curriculum_areas:
                st.warning("표준보육과정 또는 누리과정 영역을 한 개 이상 선택해 주세요.")
            elif record_type == "- 선택 -":
                st.warning("놀이 기록 유형을 선택해 주세요.")
            elif record_type == "알림장" and parent_type == "- 선택 -":
                st.warning("알림장에 적용할 보호자 유형을 선택해 주세요.")
            elif record_type == "놀이 이야기" and not play_subcategories:
                st.warning("놀이 세부 구분을 한 개 이상 선택해 주세요.")
            elif record_type == "일지" and not play_subcategories:
                st.warning("보육일지 세부 구성에서 일상생활·놀이·활동 중 한 개 이상 선택해 주세요.")
            elif record_type == "놀이 이야기" and not teacher_supports:
                st.warning("교사의 지원을 한 개 이상 선택해 주세요.")
            elif missing_detail_notes:
                detail_label = "보육일지 세부 구성" if record_type == "일지" else "놀이 세부 구분"
                st.warning(f"선택한 {detail_label}의 실제 장면 설명을 모두 입력해 주세요: " + ", ".join(missing_detail_notes))
            elif record_type == "놀이 이야기" and missing_support_notes:
                st.warning("선택한 교사의 지원의 구체 지원 내용을 모두 입력해 주세요: " + ", ".join(missing_support_notes))
            elif not uploaded_play_photos:
                st.warning("놀이 사진을 한 장 이상 등록해 주세요.")
            elif len(uploaded_play_photos) < MIN_RECOMMENDED_PLAY_PHOTO_COUNT:
                st.warning(f"사진 자동 추천·분석은 최소 {MIN_RECOMMENDED_PLAY_PHOTO_COUNT}장부터 진행합니다.")
            elif len(uploaded_play_photos) > MAX_PLAY_UPLOAD_COUNT:
                st.warning(f"사진은 한 번에 최대 {MAX_PLAY_UPLOAD_COUNT}장까지 업로드할 수 있습니다.")
            elif not photo_analysis_agree:
                st.warning("사진 활용 확인에 동의한 뒤 진행해 주세요.")
            else:
                context = {
                    "play_name": play_name,
                    "age_group": age_group,
                    "child_alias": child_alias,
                    "curriculum_areas": curriculum_areas,
                    "output_type": record_type,
                    "parent_type": parent_type if record_type == "알림장" else "",
                    "play_subcategories": play_subcategories,
                    "play_subcategory_notes": play_subcategory_notes,
                    "teacher_supports": teacher_supports,
                    "teacher_support_notes": teacher_support_notes,
                    "teacher_observed_situation": "",
                    "next_play_support_plan": "",
                }
                session_id = ""
                try:
                    with st.spinner("사진을 선별하고 비공개로 저장한 뒤, 놀이 장면을 분석하고 있습니다."):
                        recommended_files, quality_scores = select_recommended_play_photos(
                            uploaded_play_photos,
                            recommendation_count,
                        )
                        session = create_play_session(
                            current_member_user_id(),
                            play_name,
                            "",
                            age_group,
                            child_alias,
                            curriculum_areas,
                            record_type,
                            play_subcategories,
                            teacher_supports,
                            parent_type=context["parent_type"],
                            play_subcategory_notes=play_subcategory_notes,
                            teacher_support_notes=teacher_support_notes,
                        )
                        session_id = str(session.get("session_id") or "")
                        stored_records = store_play_photos(
                            recommended_files,
                            current_member_user_id(),
                            session_id,
                            child_alias,
                            quality_scores,
                        )
                        analysis = analyze_play_photos(recommended_files, context)
                        attach_photo_analysis_to_records(stored_records, analysis)
                        update_play_session_analysis(session_id, analysis)

                    context["photo_analysis"] = analysis
                    st.session_state["wizard_session_id"] = session_id
                    st.session_state["wizard_context"] = context
                    st.session_state["wizard_selected_photo_names"] = [str(getattr(file, "name", "")) for file in recommended_files]
                    st.session_state["wizard_analysis_result"] = analysis
                    st.session_state["wizard_initial_draft"] = analysis.get("draft") or ""
                    st.session_state["wizard_teacher_observed_situation"] = ""
                    st.session_state["wizard_next_play_support_plan"] = ""
                    st.session_state.pop("wizard_final_output", None)
                    st.success(f"사진 {len(recommended_files)}장을 자동 추천하고 1차 정보를 만들었습니다.")
                except Exception as exc:
                    if session_id:
                        delete_photos_for_session(session_id)
                        try:
                            supabase.table("play_sessions").delete().eq("session_id", session_id).execute()
                        except Exception:
                            pass
                    st.error("사진 추천·저장 또는 1차 분석을 완료하지 못했습니다.")
                    st.caption(str(exc))

        analysis = st.session_state.get("wizard_analysis_result") or {}
        context = st.session_state.get("wizard_context") or {}
        if analysis and context:
            st.markdown("### 3. 사진에 대한 1차 분석 결과")
            selected_names = st.session_state.get("wizard_selected_photo_names") or []
            st.caption("자동 추천 사진: " + ", ".join(selected_names))

            photo_match_status = _normalize_photo_match_status(analysis.get("photo_match_status"))
            photo_match_reason = str(analysis.get("photo_match_reason") or "").strip()
            if photo_match_status == "확인 필요":
                st.warning(
                    "입력한 놀이명과 사진의 주요 장면이 충분히 일치하지 않을 수 있습니다. 사진 또는 놀이명을 다시 확인해 주세요.\n\n"
                    + (photo_match_reason or "사진 속 핵심 자료·행동을 다시 확인해 주세요.")
                )
            elif photo_match_status == "판단 어려움":
                st.info(
                    "사진과 놀이명의 일치 여부를 충분히 판단하기 어려운 장면이 있습니다. 사진과 놀이명을 한 번 더 확인한 뒤 기록을 수정해 주세요.\n\n"
                    + (photo_match_reason or "사진 속 핵심 자료·행동이 일부만 보입니다.")
                )
            else:
                st.success("입력한 놀이명과 자동 추천 사진의 주요 장면이 대체로 일치합니다.")

            if analysis.get("ai_caption"):
                st.info(analysis.get("ai_caption"))
            st.text_area(
                "사진에 대한 1차 분석 결과 (교사가 수정 가능)",
                height=210,
                key="wizard_initial_draft",
                help="사진 분석으로 만든 초안입니다. 실제 관찰 내용과 기관의 기록 원칙에 맞게 교사가 수정해 주세요.",
            )
            if "wizard_teacher_observed_situation" not in st.session_state and context.get("teacher_observed_situation"):
                st.session_state["wizard_teacher_observed_situation"] = str(context.get("teacher_observed_situation") or "")
            if "wizard_next_play_support_plan" not in st.session_state and context.get("next_play_support_plan"):
                st.session_state["wizard_next_play_support_plan"] = str(context.get("next_play_support_plan") or "")
            teacher_observed_situation = st.text_area(
                "교사가 관찰한 놀이 상황 (필수 입력)",
                placeholder="예: 영아들이 자연물을 음식처럼 바구니에 담고, 가게 주인과 손님 역할을 번갈아 하며 놀이를 이어갔습니다.",
                height=120,
                key="wizard_teacher_observed_situation",
                help="사진에서 확인한 장면에 교사가 실제로 관찰한 놀이 흐름, 말과 행동, 관계 장면을 적어 주세요.",
            )
            next_play_support_plan = st.text_area(
                "다음 놀이 지원 계획 (선택)",
                placeholder="예: 가격표와 메뉴판을 추가로 제공해 가게 놀이가 글자와 수 개념 탐색으로 이어지도록 지원합니다.",
                height=100,
                key="wizard_next_play_support_plan",
                help="입력하면 최종 결과에 교사가 작성한 문장을 그대로 표시합니다. 입력하지 않으면 결과에 표시하지 않습니다.",
            )
            if st.button("교사가 관찰한 놀이 상황을 반영해 최종 기록 생성", key="wizard_regenerate"):
                edited_draft = str(st.session_state.get("wizard_initial_draft") or "").strip()
                if not edited_draft:
                    st.warning("사진에 대한 1차 분석 결과를 확인하고 수정해 주세요.")
                elif not teacher_observed_situation.strip():
                    st.warning("교사가 관찰한 놀이 상황은 필수 입력입니다.")
                else:
                    try:
                        context["teacher_observed_situation"] = teacher_observed_situation.strip()
                        context["next_play_support_plan"] = next_play_support_plan.strip()
                        st.session_state["wizard_context"] = context
                        update_play_session_teacher_context(
                            str(st.session_state.get("wizard_session_id") or ""),
                            teacher_observed_situation,
                            next_play_support_plan,
                        )
                        with st.spinner("사진 1차 분석 결과와 교사의 관찰을 반영해 과정형 기록을 만들고 있습니다."):
                            output = generate_final_play_record(context, edited_draft)
                            save_generated_text(
                                str(st.session_state.get("wizard_session_id") or ""),
                                current_member_user_id(),
                                str(context.get("output_type") or ""),
                                str(output.get("plain_text") or ""),
                                edited_draft,
                                str(analysis.get("draft") or ""),
                            )
                        st.session_state["wizard_final_output"] = output
                        st.success("사진 분석, 교사 관찰, 교육과정 연계, 종합 기록을 생성했습니다.")
                    except Exception as exc:
                        st.error("최종 기록을 만들지 못했습니다.")
                        st.caption(str(exc))

        output = st.session_state.get("wizard_final_output") or {}
        if output and context:
            st.markdown("### 4. 과정과 최종 기록")
            render_final_play_output(output)
            download_text = build_record_download_text(context, str(st.session_state.get("wizard_initial_draft") or ""), output)
            safe_title = re.sub(r"[^0-9A-Za-z가-힣_-]+", "_", str(context.get("play_name") or "놀이기록"))[:40]
            st.download_button("기록 다운로드", data=download_text.encode("utf-8"), file_name=f"{safe_title}_놀이기록.txt", mime="text/plain", key="wizard_record_download")

# =========================
# TAB 3. 사진 보정
# =========================
# =========================
# TAB 3. 사진 보정
# =========================
with tab3:

    render_menu_card(
        "✨ 사진 선별 및 보정",
        "먼저 A급 사진을 선별하고, 필요한 사진은 밝기·대비·채도·선명도를 조절해 바로 보정할 수 있습니다.",
        ["A급 사진 선별", "밝기", "대비", "채도", "선명도"]
    )

    # 1) A급 사진 선별
    st.subheader("📸 A급 사진 선별")
    st.write("20장 이내의 사진을 올리면 선명도와 밝기를 기준으로 상위 사진을 골라냅니다.")

    uploaded_images = st.file_uploader(
        "선별할 사진을 업로드하세요",
        type=["jpg", "jpeg", "png"],
        accept_multiple_files=True,
        key="photo_selector"
    )

    if uploaded_images:
        for uploaded_file in uploaded_images:
            save_path = input_image_dir / uploaded_file.name
            with open(save_path, "wb") as f:
                f.write(uploaded_file.getbuffer())

        ranked = rank_images(str(input_image_dir))
        selected = ranked[:top_k]
        st.success(f"총 {len(uploaded_images)}장 중 상위 {len(selected)}장을 선별했습니다.")

        for idx, (image_path, score) in enumerate(selected):
            st.image(
                image_path,
                caption=f"Top {idx + 1} / 점수: {score:.1f}",
                use_container_width=True
            )

    st.divider()

    # 2) 사진 보정
    st.subheader("✨ 사진 보정")
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
        except Exception:
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
def reset_tab4_inputs_once():
    """알림장 탭의 이전 입력값이 처음 화면에 남아 보이지 않도록 한 번만 초기화합니다.

    Streamlit은 같은 key를 가진 위젯 값을 브라우저 세션에 보관할 수 있습니다.
    그래서 코드상 기본값이 "- 선택 -"이어도 이전에 선택한 값이 다시 보일 수 있습니다.
    이 함수는 앱 갱신 후 첫 렌더링에서만 기존 알림장 입력값을 지우고,
    사용자가 이후 선택하거나 입력한 값은 정상적으로 유지되게 합니다.
    """
    reset_flag = "_tab4_initial_values_cleared_20260617_v3"
    if st.session_state.get(reset_flag):
        return

    keys_to_clear = [
        "record_type_select",
        "diary_age_group",
        "diary_teacher_tone",
        "diary_daily_scope",
        "diary_input_text",
    ]

    for key in keys_to_clear:
        st.session_state.pop(key, None)

    st.session_state[reset_flag] = True


if SHOW_DIARY_FEATURE:
    with tab4:

        reset_tab4_inputs_once()

        render_menu_card(
            "📝 일지 요약 및 알림장 생성",
            "일지를 입력하면 핵심 내용을 요약하고, 기록 유형과 성향에 맞는 문장을 생성합니다.",
            ["알림장용", "관찰 기록용", "서술형 일지용", "기관 홍보용"]
        )

        record_type = st.selectbox(
            "기록 유형 선택",
            ["- 선택 -", "알림장용", "관찰 기록용", "서술형 일지용", "기관 홍보용"],
            index=0,
            key="record_type_select"
        )

        diary_age_group = st.selectbox(
            "연령 선택",
            ["- 선택 -", "0세", "1세", "2세", "3세", "4세", "5세"],
            index=0,
            key="diary_age_group"
        )

        teacher_tone = st.selectbox(
            "기록 성향 선택",
            ["- 선택 -", "팩트 중심형", "따뜻한 감성형", "이모티콘 활용형", "전문적 설명형"],
            index=0,
            key="diary_teacher_tone"
        )

        daily_scope = st.selectbox(
            "하루일과 전달 범위 선택",
            ["- 선택 -", "놀이 장면 중심", "일상생활 중심", "하루 전체 흐름", "특별활동 중심"],
            index=0,
            key="diary_daily_scope"
        )

        diary_text = st.text_area(
            "일지 내용을 붙여넣으세요",
            value="",
            height=250,
            placeholder="단어만 입력하면 생성되지 않습니다. 예: 오늘 OO이는 블록을 쌓으며 친구와 놀이에 참여했습니다.",
            key="diary_input_text"
        )

        if st.button("알림장 요약 및 생성하기", key="diary_generate_button"):
            if record_type == "- 선택 -":
                st.warning("기록 유형을 선택해 주세요.")
            elif diary_age_group == "- 선택 -":
                st.warning("연령을 선택해 주세요.")
            elif teacher_tone == "- 선택 -":
                st.warning("기록 성향을 선택해 주세요.")
            elif daily_scope == "- 선택 -":
                st.warning("하루일과 전달 범위를 선택해 주세요.")
            else:
                is_valid_diary, diary_warning = validate_diary_text(diary_text)
                if not is_valid_diary:
                    st.warning(diary_warning)
                    st.stop()

                summary = make_core_summary(
                    diary_text,
                    max_sentences=max_summary_sentences
                )

                if not summary.strip():
                    st.warning("일지 내용에서 요약할 수 있는 문장을 찾지 못했습니다. 관찰 장면이 드러나는 문장으로 다시 입력해 주세요.")
                    st.stop()

                restructured_summary = build_restructured_diary(
                    original_text=diary_text,
                    summary=summary,
                    daily_scope=daily_scope,
                    record_type=record_type,
                    age=diary_age_group
                )

                generated_message = make_diary_message(
                    restructured_summary,
                    teacher_tone,
                    daily_scope,
                    record_type,
                    age=diary_age_group
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
                render_result_card(generated_message, "result-card-blue")

                st.download_button(
                    "생성된 알림장 다운로드",
                    data=generated_message.encode("utf-8"),
                    file_name="generated_diary_message.txt",
                    mime="text/plain",
                    key="diary_download"
                )

# =========================
# TAB 4. 공지사항
# =========================
with tab_notice:
    render_public_notice_page()

# =========================
# TAB 6. 내 정보 보기
# =========================
with tab6:
    render_member_information_page()


# =========================
# TAB 7. 관리자
# =========================
with tab7:
    try:
        admin_config = st.secrets["admin"]
        ADMIN_ID = str(admin_config.get("id") or "")
        ADMIN_PW = str(admin_config.get("password") or "")
    except Exception:
        ADMIN_ID, ADMIN_PW = "", ""

    render_menu_card(
        "🔐 관리자 모드",
        "회원·기록 데이터를 관리하고, 방문자 공지사항과 팝업을 작성·수정·게시할 수 있습니다.",
        ["회원 관리", "기록 관리", "공지사항", "방문 팝업", "숨김 기록 복구", "CSV"]
    )

    with st.expander("관리자 메뉴 열기", expanded=False):
        admin_id = st.text_input("관리자 아이디", key="admin_id_input")
        admin_pw = st.text_input("관리자 비밀번호", type="password", key="admin_pw_input")
        if st.button("관리자 로그인", key="admin_login_button"):
            if not ADMIN_ID or not ADMIN_PW:
                st.session_state["admin_logged_in"] = False
                st.error("관리자 계정이 Secrets에 설정되지 않았습니다. [admin] id, password를 등록해 주세요.")
            elif admin_id.strip() == ADMIN_ID and admin_pw.strip() == ADMIN_PW:
                st.session_state["admin_logged_in"] = True
                st.success("관리자 로그인에 성공했습니다.")
            else:
                st.session_state["admin_logged_in"] = False
                st.error("아이디 또는 비밀번호가 올바르지 않습니다.")

        if st.session_state.get("admin_logged_in"):
            admin_console_tabs = st.tabs(["📊 데이터 관리", "📢 공지사항", "🪟 방문 팝업"])
            with admin_console_tabs[0]:
                period = st.selectbox("조회 단위", ["전체", "오늘", "최근 7일", "이번 달"], key="dashboard_period_select")
                table_options = {
                    "회원 관리": ("subscribers", "members.csv"),
                    "놀이 세션": ("play_sessions", "play_sessions.csv"),
                    "사진 기록": ("photo_records", "photo_records.csv"),
                    "생성 문장": ("generated_texts", "generated_texts.csv"),
                    "이전 기록 요정 기록": ("phrase_logs", "phrase_logs.csv"),
                }

                # 대시보드와 일반 목록은 숨김 처리되지 않은 활성 기록만 표시합니다.
                all_frames = {
                    label: filter_by_period(load_table(table), period)
                    for label, (table, _) in table_options.items()
                }

                col1, col2, col3, col4 = st.columns(4)
                col1.metric("회원 수", f"{len(all_frames['회원 관리'])}명")
                col2.metric("놀이 세션", f"{len(all_frames['놀이 세션'])}건")
                col3.metric("보관 사진", f"{len(all_frames['사진 기록'])}장")
                col4.metric("생성 문장", f"{len(all_frames['생성 문장'])}건")

                st.divider()
                graph_col1, graph_col2 = st.columns(2)
                with graph_col1:
                    session_df = all_frames["놀이 세션"]
                    if not session_df.empty and "record_type" in session_df.columns:
                        draw_category_chart(session_df["record_type"].fillna("미분류").value_counts(), "기록 유형 분포")
                    else:
                        st.caption("표시할 놀이 세션이 없습니다.")
                with graph_col2:
                    generated_df = all_frames["생성 문장"]
                    if not generated_df.empty and "output_type" in generated_df.columns:
                        draw_category_chart(generated_df["output_type"].fillna("미분류").value_counts(), "생성 문장 유형")
                    else:
                        st.caption("표시할 생성 문장이 없습니다.")

                admin_menu = st.selectbox("조회할 데이터 선택", list(table_options.keys()), key="admin_data_select")
                table_name, file_name = table_options[admin_menu]
                df = all_frames[admin_menu].copy()

                rename_map = {
                    "id": "번호", "created_at": "생성일시", "updated_at": "수정일시", "user_id": "회원 UID",
                    "username": "아이디", "platform_member_id": "기존 회원 ID", "subscriber_name": "가입자 성명", "display_name": "표시 이름", "role": "권한",
                    "email": "이메일", "institution_name": "기관명", "institution_group": "기관 구분", "institution_type": "기관 유형", "position": "직책",
                    "play_name": "놀이명", "age_group": "연령", "child_alias": "아이 별칭", "teacher_observed_situation": "교사가 관찰한 놀이 상황", "next_play_support_plan": "다음 놀이 지원 계획", "curriculum_areas": "교육과정 영역",
                    "record_type": "기록 유형", "parent_type": "보호자 유형", "play_subcategories": "놀이 세부 구분", "play_subcategory_notes": "놀이 세부 구분별 장면", "teacher_supports": "교사의 지원", "teacher_support_notes": "교사의 구체 지원", "photo_match_status": "사진-놀이명 점검", "photo_match_reason": "점검 사유", "ai_summary": "사진에 대한 1차 분석 결과",
                    "session_id": "세션 ID", "file_path": "Storage 경로", "original_file_name": "파일명", "mime_type": "형식", "size_bytes": "파일 크기",
                    "quality_score": "추천 점수", "selection_reason": "추천 이유", "ai_caption": "사진 설명", "output_type": "생성 유형",
                    "result_text": "생성 결과", "edited_text": "교사가 수정한 1차 분석 결과", "source_text": "원본 사진 1차 분석 결과", "expires_at": "자동 삭제 예정일", "deleted": "삭제 여부",
                }

                st.markdown("### 현재 활성 기록")
                display_df = df.rename(columns=rename_map)
                if "삭제 여부" in display_df.columns:
                    display_df = display_df.drop(columns=["삭제 여부"])
                st.dataframe(display_df, use_container_width=True, hide_index=True, height=420)
                st.download_button(
                    "CSV 다운로드",
                    display_df.to_csv(index=False).encode("utf-8-sig"),
                    file_name=file_name,
                    mime="text/csv",
                    key="admin_csv_download",
                )

                if not df.empty and "id" in df.columns:
                    st.divider()
                    st.markdown("### 🛠️ 활성 기록 숨김·영구 삭제")
                    st.caption("숨김 처리는 DB에서 지우지 않고 목록에서만 감춥니다. 아래 ‘숨김 기록 복구’에서 다시 활성화할 수 있습니다.")
                    delete_ids = st.multiselect(
                        "숨김 처리 또는 영구 삭제할 번호",
                        df["id"].dropna().astype(int).tolist(),
                        key=f"admin_delete_ids_{table_name}",
                        placeholder="선택해 주세요.",
                    )
                    dcol1, dcol2 = st.columns(2)
                    with dcol1:
                        if st.button("선택 기록 숨김 처리", key=f"admin_soft_delete_{table_name}", disabled=not delete_ids):
                            for record_id in delete_ids:
                                soft_delete_record(table_name, record_id)
                            st.success(f"{len(delete_ids)}건을 숨김 처리했습니다.")
                            st.rerun()
                    with dcol2:
                        confirm = st.text_input("영구 삭제하려면 '영구삭제' 입력", key=f"admin_hard_confirm_{table_name}")
                        if st.button(
                            "선택 기록 영구 삭제",
                            key=f"admin_hard_delete_{table_name}",
                            disabled=(not delete_ids or confirm.strip() != "영구삭제"),
                        ):
                            for record_id in delete_ids:
                                hard_delete_record(table_name, record_id)
                            st.success(f"{len(delete_ids)}건을 영구 삭제했습니다.")
                            st.rerun()

                # ---------------------------------------------------------
                # 숨김 기록 복구: 이전 코드에 있었지만 1차 보수 과정에서 UI가 누락된 기능을 복원합니다.
                # - load_table(..., include_deleted=True)로 DB의 숨김 기록까지 다시 불러옵니다.
                # - subscribers를 복구할 때는 restore_record()가 is_active도 함께 True로 변경합니다.
                # ---------------------------------------------------------
                st.divider()
                st.markdown("### ♻️ 숨김 기록 복구")
                st.caption("숨김 처리된 기록은 아직 DB에 남아 있습니다. 선택한 기록을 다시 활성 목록으로 되돌릴 수 있습니다.")

                hidden_scope = st.radio(
                    "숨김 기록 조회 범위",
                    ["전체", "현재 조회 단위"],
                    horizontal=True,
                    key=f"admin_restore_scope_{table_name}",
                )

                hidden_all_df = load_table(table_name, include_deleted=True)
                if not hidden_all_df.empty and "deleted" in hidden_all_df.columns:
                    hidden_mask = hidden_all_df["deleted"].apply(
                        lambda value: str(value).strip().lower() in {"true", "1", "yes", "y"}
                    )
                    hidden_df = hidden_all_df.loc[hidden_mask].copy()
                else:
                    hidden_df = pd.DataFrame()

                if hidden_scope == "현재 조회 단위":
                    hidden_df = filter_by_period(hidden_df, period)

                if hidden_df.empty:
                    st.info("현재 조건에서 복구할 숨김 기록이 없습니다.")
                else:
                    hidden_display_df = hidden_df.rename(columns=rename_map)
                    if "삭제 여부" in hidden_display_df.columns:
                        hidden_display_df = hidden_display_df.drop(columns=["삭제 여부"])

                    st.dataframe(hidden_display_df, use_container_width=True, hide_index=True, height=320)
                    hidden_ids = hidden_df["id"].dropna().astype(int).tolist() if "id" in hidden_df.columns else []
                    restore_ids = st.multiselect(
                        "복구할 숨김 기록 번호",
                        hidden_ids,
                        key=f"admin_restore_ids_{table_name}_{hidden_scope}",
                        placeholder="선택해 주세요.",
                    )

                    rcol1, rcol2 = st.columns(2)
                    with rcol1:
                        if st.button(
                            "선택한 숨김 기록 복구",
                            key=f"admin_restore_selected_{table_name}_{hidden_scope}",
                            disabled=not restore_ids,
                        ):
                            for record_id in restore_ids:
                                restore_record(table_name, record_id)
                            st.success(f"선택한 숨김 기록 {len(restore_ids)}건을 다시 활성화했습니다.")
                            st.rerun()

                    with rcol2:
                        restore_all_confirm = st.checkbox(
                            "현재 표시된 숨김 기록 전체를 복구합니다.",
                            key=f"admin_restore_all_confirm_{table_name}_{hidden_scope}",
                        )
                        if st.button(
                            f"표시된 숨김 기록 {len(hidden_ids)}건 전체 복구",
                            key=f"admin_restore_all_{table_name}_{hidden_scope}",
                            disabled=(not hidden_ids or not restore_all_confirm),
                        ):
                            for record_id in hidden_ids:
                                restore_record(table_name, record_id)
                            st.success(f"표시된 숨김 기록 {len(hidden_ids)}건을 다시 활성화했습니다.")
                            st.rerun()

                    if table_name == "subscribers":
                        st.caption("회원 관리에서 복구하면 해당 회원의 활성 상태도 함께 복구되어 다시 로그인할 수 있습니다.")
            with admin_console_tabs[1]:
                render_admin_notice_manager()

            with admin_console_tabs[2]:
                render_admin_popup_manager()
