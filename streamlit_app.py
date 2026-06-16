# -*- coding: utf-8 -*-
# 교사의 발견_현장 업무 자동화 파일럿 서비스
# 실행: streamlit run streamlit_app.py

import re
import html
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
import streamlit.components.v1 as components
from PIL import Image, ImageEnhance
from streamlit_javascript import st_javascript

try:
    import altair as alt
except Exception:
    alt = None

from manual_automation_app import rank_images

st.set_page_config(page_title="교사의 발견", page_icon="🌿", layout="wide", initial_sidebar_state="collapsed")

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
    --witti-blue:#2563EB;
    --witti-blue-2:#3BA7FF;
    --witti-blue-soft:#EAF3FF;
    --witti-green-soft:#E8F8EF;
    --witti-green:#188B55;
    --witti-yellow-soft:#FFF6DD;
    --witti-shadow:0 12px 32px rgba(15, 23, 42, 0.06);
    --witti-shadow-soft:0 8px 22px rgba(15, 23, 42, 0.045);
}

html, body, [class*="css"] {
    font-family: 'Pretendard', 'SUIT', 'Noto Sans KR', 'Malgun Gothic', sans-serif !important;
}

#MainMenu, footer, header[data-testid="stHeader"] {
    visibility: hidden;
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

/* 입력 요소 */
.stTextInput input,
.stTextArea textarea,
div[data-baseweb="select"] > div,
.stMultiSelect div[data-baseweb="select"] > div {
    border-radius: 12px !important;
    border-color: #DCE5F0 !important;
    background-color: #FFFFFF !important;
    box-shadow: none !important;
}

.stTextInput input:focus,
.stTextArea textarea:focus {
    border-color: #93C5FD !important;
    box-shadow: 0 0 0 3px rgba(37,99,235,0.10) !important;
}

.stButton > button, .stDownloadButton > button {
    min-height: 42px;
    border-radius: 12px !important;
    font-weight: 800 !important;
    border: 1px solid #2563EB !important;
    background: linear-gradient(135deg, #2563EB 0%, #38BDF8 100%) !important;
    color: white !important;
    box-shadow: 0 9px 20px rgba(37,99,235,0.16);
}

.stButton > button:hover, .stDownloadButton > button:hover {
    filter: brightness(0.98);
    transform: translateY(-1px);
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
    color: var(--witti-navy);
    background-color:#F1F8FF;
    border: 1px solid #CFE4FF;
    padding:20px;
    border-radius:18px;
    line-height:1.85;
    white-space:pre-wrap;
    box-shadow: var(--witti-shadow-soft);
}

.result-card-gray {
    color: var(--witti-text);
    background-color:#FFFFFF;
    border: 1px solid var(--witti-line);
    padding:20px;
    border-radius:18px;
    line-height:1.85;
    white-space:pre-wrap;
    box-shadow: var(--witti-shadow-soft);
    margin: 10px 0;
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

@media (max-width: 768px) {
    .block-container {
        padding-top: 1.1rem;
        padding-left: 1rem;
        padding-right: 1rem;
        max-width: 100%;
    }

    .app-hero {
        padding: 20px 18px;
        border-radius: 20px;
    }

    .app-hero h1 {
        font-size: 27px !important;
    }

    h1 { font-size: 30px !important; line-height:1.25 !important; }
    h2 { font-size: 23px !important; }
    h3 { font-size: 20px !important; }
    h4 { font-size: 18px !important; }

    label, p { font-size: 15px !important; line-height: 1.55 !important; }
    textarea, input, select { font-size: 16px !important; }

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


WITTI_SITE_URL = "https://witti.kr/"
WITTI_SITE_LABEL = "교사의 발견 플랫폼"
WITTI_CONTACT_EMAIL = "witti7942@gmail.com"
WITTI_CONTACT_LABEL = "자동화 플랫폼 사용 문의"
WITTI_CONTACT_MAILTO = "mailto:witti7942@gmail.com?subject=%5B%EA%B5%90%EC%82%AC%EC%9D%98%20%EB%B0%9C%EA%B2%AC%5D%20%EC%9E%90%EB%8F%99%ED%99%94%20%ED%94%8C%EB%9E%AB%ED%8F%BC%20%EC%82%AC%EC%9A%A9%20%EB%AC%B8%EC%9D%98"
APP_VERSION = "2026-06-17-no-output-links-ui-clean-v1"


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
    """문장 출력 시 URL과 이메일을 클릭 가능한 링크로 변환합니다."""
    escaped = html.escape(text or "")
    escaped_site = html.escape(WITTI_SITE_URL)
    escaped_email = html.escape(WITTI_CONTACT_EMAIL)
    escaped_mailto = html.escape(WITTI_CONTACT_MAILTO, quote=True)
    escaped = escaped.replace(
        escaped_site,
        f'<a href="{escaped_site}" target="_blank" rel="noopener noreferrer">{escaped_site}</a>'
    )
    escaped = escaped.replace(
        escaped_email,
        f'<a href="{escaped_mailto}">{escaped_email}</a>'
    )
    return escaped.replace("\n", "<br>")


def render_platform_guide():
    st.markdown(
        f"""
        <div class="small-guide">
        🔗 {WITTI_SITE_LABEL}: <a href="{WITTI_SITE_URL}" target="_blank" rel="noopener noreferrer">{WITTI_SITE_URL}</a><br>
        ✉️ {WITTI_CONTACT_LABEL}: <a href="{WITTI_CONTACT_MAILTO}">{WITTI_CONTACT_EMAIL}</a>
        </div>
        """,
        unsafe_allow_html=True,
    )


def render_generated_phrase(idx: int, text: str):
    st.markdown(
        f"<div class='result-card-gray'><strong>{idx}.</strong><br>{text_to_html_with_links(text)}</div>",
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


st.markdown(f"""
<!-- APP_VERSION: {APP_VERSION} -->
<div class="app-hero">
    <div class="app-eyebrow">🌿 교사의 발견</div>
    <h1>현장 업무 자동화 파일럿 서비스</h1>
    <p>사진 선별, 문구 생성, 알림장 작성, 기록 관리를 한 화면에서 정리할 수 있도록 구성했습니다.</p>
    <div class="hero-links">
        <a class="hero-link" href="{WITTI_SITE_URL}" target="_blank" rel="noopener noreferrer">🔗 {WITTI_SITE_LABEL}</a>
        <a class="hero-link" href="{WITTI_CONTACT_MAILTO}">✉️ {WITTI_CONTACT_LABEL}</a>
    </div>
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
    st.markdown(
        f"""
        <div class="small-guide" style="margin-top:10px; padding:12px 14px;">
        🔗 {WITTI_SITE_LABEL}: <a href="{WITTI_SITE_URL}" target="_blank" rel="noopener noreferrer">{WITTI_SITE_URL}</a><br>
        ✉️ {WITTI_CONTACT_LABEL}: <a href="{WITTI_CONTACT_MAILTO}">{WITTI_CONTACT_EMAIL}</a>
        </div>
        """,
        unsafe_allow_html=True,
    )

force_sidebar_collapsed_on_first_load()
apply_sidebar_open_hint()

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
    """연령에 비해 과성숙한 표현을 부드럽게 치환합니다."""
    age = normalize_age(age)
    replacements = AGE_SENSITIVE_REPLACEMENTS.get(age, {})
    for old, new in replacements.items():
        text = text.replace(old, new)
    text = re.sub(r"\s+", " ", text).strip()
    return text


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
        "기본생활": "도움을 받아 편안한 일과를 경험하고, 먹기·쉬기·배변 등 기본생활의 리듬을 알아가는 과정과 연결됩니다.",
        "신체운동": "감각 자극에 반응하고, 몸을 움직이며 신체를 탐색하는 경험과 연결됩니다.",
        "신체운동·건강": "편안한 일과와 감각·신체 움직임을 통해 건강한 생활의 기초를 경험하는 과정과 연결됩니다.",
        "의사소통": "표정, 몸짓, 울음, 옹알이와 말소리로 의사를 나타내고 주변 소리에 관심을 갖는 경험과 연결됩니다.",
        "사회관계": "교사와 친숙한 사람에게 안정감을 느끼고, 또래가 있는 공간에 관심을 보이는 경험과 연결됩니다.",
        "예술경험": "소리, 리듬, 색, 촉감에 감각적으로 반응하며 아름다움을 느끼는 경험과 연결됩니다.",
        "자연탐구": "보고 듣고 만지는 감각 경험을 통해 주변 사물과 자연에 관심을 갖는 과정과 연결됩니다.",
    },
    "1세": {
        "기본생활": "도움을 받으며 일과에 익숙해지고, 먹기·씻기·쉬기·배변 의사를 조금씩 나타내는 과정과 연결됩니다.",
        "신체운동": "감각으로 주변을 탐색하고, 대소근육을 사용해 기본 움직임을 시도하는 경험과 연결됩니다.",
        "신체운동·건강": "일상생활의 안정감과 신체 움직임을 바탕으로 건강하고 안전한 생활을 경험하는 과정과 연결됩니다.",
        "의사소통": "표정, 몸짓, 말소리, 간단한 말로 관심과 요구를 나타내는 경험과 연결됩니다.",
        "사회관계": "친숙한 사람과 안정적인 관계를 맺고, 또래의 행동에 관심을 보이는 경험과 연결됩니다.",
        "예술경험": "소리와 리듬, 미술 재료의 촉감, 모방 행동을 즐기는 경험과 연결됩니다.",
        "자연탐구": "친숙한 사물과 자연을 감각으로 반복해서 탐색하는 경험과 연결됩니다.",
    },
    "2세": {
        "기본생활": "자신의 몸과 일과에 관심을 가지고, 건강하고 안전한 생활습관의 기초를 형성하는 과정과 연결됩니다.",
        "신체운동": "감각과 신체를 인식하고, 대소근육을 조절하며 신체활동을 즐기는 경험과 연결됩니다.",
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


def make_diary_message(
    restructured_text: str,
    teacher_tone: str,
    daily_scope: str,
    record_type: str,
    age: str | None = "2세",
) -> str:
    """연령별 DIARY_MESSAGE_BANK에서 문장 2개를 뽑아 붙입니다."""
    age = normalize_age(age)
    age_bank = DIARY_MESSAGE_BANK_BY_AGE.get(age, DIARY_MESSAGE_BANK_BY_AGE["2세"])
    type_bank = age_bank.get(record_type) or age_bank.get("알림장용", {})
    sentence_bank = type_bank.get(teacher_tone, [])
    selected = random.sample(sentence_bank, k=min(2, len(sentence_bank))) if sentence_bank else []
    selected_text = "\n".join([f"- {age_sanitize(s, age)}" for s in selected])
    return age_sanitize(f"{restructured_text}\n\n{selected_text}".strip(), age)


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
STANDARD_AREAS = ["기본생활", "신체운동", "의사소통", "사회관계", "예술경험", "자연탐구"]
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


def make_diary_message(
    restructured_text: str,
    teacher_tone: str,
    daily_scope: str,
    record_type: str,
    age: str | None = "2세",
) -> str:
    age = normalize_age(age)
    bank = GENERAL_DIARY_MESSAGE_BANK.get(record_type, GENERAL_DIARY_MESSAGE_BANK["알림장용"]).get(teacher_tone, [])
    selected = random.sample(bank, k=min(2, len(bank))) if bank else []
    selected_text = "\n".join([f"- {age_sanitize(s, age)}" for s in selected])
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
    return [
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
    ]



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
        "사회관계": "친구와 역할과 규칙을 조율하고 공동의 놀이 목표를 만들어가며 협력하는 과정과 연결됩니다.",
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
        get_child_action_options(age_group),
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
            template_bank = get_observation_template_bank(observation_type, age_group)
            selected_sentences = random.sample(template_bank, k=min(3, len(template_bank)))
            st.success("상황별 문구가 생성되었습니다.")

            for idx, sentence in enumerate(selected_sentences, start=1):
                base_sentence = sentence.format(keyword=play_keyword, action=child_action, child=child_label)

                if observation_type == "알림장용":
                    final_result = f"{base_sentence} {AGE_NOTICE[age_group]} {get_parent_template(parent_type, age_group)}"
                elif observation_type == "관찰 기록용":
                    final_result = f"{base_sentence} {get_development_record(development_area, age_group, note=True)}"
                elif observation_type == "서술형 일지용":
                    final_result = f"{base_sentence} {get_curriculum_record(curriculum_area, age_group, note=True)} {get_development_record(development_area, age_group, note=True)}"
                elif observation_type == "기관 홍보용":
                    final_result = f"{base_sentence} {get_curriculum_record(curriculum_area, age_group)} {get_development_record(development_area, age_group)}"
                else:
                    final_result = f"{base_sentence} {AGE_NOTICE[age_group]}"

                final_result = age_sanitize(final_result, age_group)
                render_generated_phrase(idx, final_result)

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

    diary_age_group = st.selectbox(
        "연령 선택",
        ["- 선택 -", "0세", "1세", "2세", "3세", "4세", "5세"],
        key="diary_age_group"
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
        elif diary_age_group == "- 선택 -":
            st.warning("연령을 선택해 주세요.")
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

