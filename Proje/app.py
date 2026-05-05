import streamlit as st
import pandas as pd
import base64
import os
import smtplib
import random
import string
from email.utils import parseaddr
from email.message import EmailMessage
from datetime import datetime, timedelta
from io import BytesIO
from pandas.errors import ParserError
from streamlit.errors import StreamlitSecretNotFoundError
import streamlit.components.v1 as components

# Ensure working directory is the same as the script location
os.chdir(os.path.dirname(os.path.abspath(__file__)))

st.set_page_config(
    page_title="Pentecost University CV Analyzer",
    page_icon="🎓",
    layout="wide"
)

# ── Global Premium Design System ───────────────────────────────────────────
st.markdown("""
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');

/* ── Reset & Base ── */
*, *::before, *::after { box-sizing: border-box; }
html, body, [class*="css"] {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif !important;
}

/* ── Hide Sidebar ── */
[data-testid="stSidebar"]      { display: none !important; }
[data-testid="collapsedControl"]{ display: none !important; }

/* ── App Background ── */
.stApp {
    background: linear-gradient(145deg, #f0f7f2 0%, #e8f5ec 50%, #f4faf6 100%) !important;
    min-height: 100vh;
}
[data-testid="stAppViewContainer"] { background: transparent !important; }
.block-container {
    padding-top: 1.5rem !important;
    padding-bottom: 2rem !important;
    max-width: 1200px !important;
}

/* ── Typography ── */
h1, h2, h3, h4, h5, h6 { font-family: 'Inter', sans-serif !important; }

/* ── Global Buttons ── */
[data-testid="stButton"] > button {
    font-family: 'Inter', sans-serif !important;
    font-weight: 600 !important;
    border-radius: 12px !important;
    min-height: 44px !important;
    font-size: 14px !important;
    transition: all 0.25s ease !important;
    border: 1.5px solid rgba(46,139,87,0.25) !important;
    background: white !important;
    color: #1e5f3f !important;
    box-shadow: 0 2px 8px rgba(46,139,87,0.08) !important;
    letter-spacing: 0.2px;
}
[data-testid="stButton"] > button:hover {
    transform: translateY(-2px) !important;
    box-shadow: 0 6px 20px rgba(46,139,87,0.18) !important;
    border-color: #2E8B57 !important;
    background: linear-gradient(135deg, #f0fff6, #e8f8ef) !important;
}
[data-testid="stButton"] > button[kind="primary"] {
    background: linear-gradient(135deg, #2E8B57, #3da668) !important;
    color: white !important;
    border: none !important;
    box-shadow: 0 4px 18px rgba(46,139,87,0.35) !important;
}
[data-testid="stButton"] > button[kind="primary"]:hover {
    background: linear-gradient(135deg, #236b43, #2E8B57) !important;
    box-shadow: 0 8px 28px rgba(46,139,87,0.45) !important;
}

/* ── Form Inputs ── */
[data-testid="stTextInput"] input,
[data-testid="stTextArea"] textarea,
[data-testid="stSelectbox"] > div > div {
    font-family: 'Inter', sans-serif !important;
    border-radius: 12px !important;
    border: 1.5px solid rgba(46,139,87,0.2) !important;
    background: white !important;
    color: #1a3d2b !important;
    font-size: 15px !important;
    transition: border-color 0.2s ease, box-shadow 0.2s ease !important;
}
[data-testid="stTextInput"] input:focus,
[data-testid="stTextArea"] textarea:focus {
    border-color: #2E8B57 !important;
    box-shadow: 0 0 0 3px rgba(46,139,87,0.12) !important;
}
[data-testid="stTextInput"] label p,
[data-testid="stTextArea"] label p,
[data-testid="stSelectbox"] label p,
[data-testid="stDateInput"] label p,
[data-testid="stTimeInput"] label p,
[data-testid="stFileUploader"] label p,
[data-testid="stRadio"] label p {
    color: #1e5f3f !important;
    font-weight: 600 !important;
    font-size: 14px !important;
    font-family: 'Inter', sans-serif !important;
}
[data-testid="stFileUploader"] {
    border: 2px dashed rgba(46,139,87,0.3) !important;
    border-radius: 14px !important;
    background: rgba(240,255,247,0.6) !important;
    padding: 10px !important;
}

/* ── Alerts & Messages ── */
[data-testid="stAlert"] {
    border-radius: 12px !important;
    font-family: 'Inter', sans-serif !important;
}

/* ── Dataframes ── */
[data-testid="stDataFrame"] { border-radius: 14px !important; overflow: hidden; }

/* ── Top Navigation Bar ── */
.top-nav {
    background: linear-gradient(135deg, rgba(255,255,255,0.96), rgba(240,255,248,0.94)) !important;
    padding: 14px 28px !important;
    border-radius: 18px !important;
    box-shadow: 0 4px 24px rgba(46,139,87,0.10) !important;
    margin-bottom: 20px !important;
    display: flex !important;
    align-items: center !important;
    justify-content: space-between !important;
    border: 1px solid rgba(46,139,87,0.12) !important;
    backdrop-filter: blur(12px) !important;
}
.top-nav-user {
    font-weight: 800 !important;
    color: #1e5f3f !important;
    font-size: 1.05rem !important;
    letter-spacing: 0.3px !important;
    font-family: 'Inter', sans-serif !important;
}
.nav-btn-container .stButton > button {
    border-radius: 10px !important;
    font-weight: 600 !important;
    font-size: 13px !important;
    min-height: 38px !important;
    padding: 0 14px !important;
}

/* ── Dashboard Header ── */
.dashboard-header {
    font-size: 1.9rem;
    font-weight: 800;
    color: #0f2d1e;
    margin-bottom: 24px;
    padding: 20px 28px;
    background: linear-gradient(135deg, rgba(255,255,255,0.95), rgba(240,255,248,0.9));
    border-radius: 18px;
    border-left: 5px solid #2E8B57;
    box-shadow: 0 4px 20px rgba(46,139,87,0.08);
    display: flex;
    align-items: center;
    gap: 14px;
    font-family: 'Inter', sans-serif;
}

/* ── Metric Cards ── */
.metric-container {
    display: flex;
    gap: 18px;
    margin-bottom: 28px;
    flex-wrap: wrap;
}
.metric-card {
    background: linear-gradient(135deg, rgba(255,255,255,0.98), rgba(245,255,250,0.95));
    backdrop-filter: blur(16px);
    border: 1px solid rgba(46,139,87,0.15);
    border-radius: 20px;
    padding: 28px 24px;
    flex: 1;
    min-width: 200px;
    box-shadow: 0 6px 28px rgba(46,139,87,0.08);
    text-align: center;
    transition: transform 0.3s ease, box-shadow 0.3s ease;
    position: relative;
    overflow: hidden;
}
.metric-card::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 4px;
    background: linear-gradient(90deg, #2E8B57, #4CAF50, #81C784);
    border-radius: 20px 20px 0 0;
}
.metric-card:hover {
    transform: translateY(-6px);
    box-shadow: 0 14px 40px rgba(46,139,87,0.16);
}
.metric-card h4 {
    margin: 0 0 8px 0;
    font-size: 0.78rem;
    color: #6b8f7a;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    font-weight: 700;
    font-family: 'Inter', sans-serif;
}
.metric-card h2 {
    margin: 0;
    font-size: 2.6rem;
    background: linear-gradient(135deg, #2E8B57, #4CAF50);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    font-weight: 900;
    font-family: 'Inter', sans-serif;
    line-height: 1;
}

/* ── Styled Content Cards ── */
.styled-card {
    background: linear-gradient(135deg, rgba(255,255,255,0.98), rgba(248,255,252,0.96));
    border-radius: 20px;
    padding: 28px 32px;
    box-shadow: 0 6px 30px rgba(46,139,87,0.07);
    border: 1px solid rgba(46,139,87,0.1);
    margin-bottom: 24px;
    backdrop-filter: blur(10px);
}
.styled-card h3 {
    color: #0f2d1e;
    margin-top: 0;
    margin-bottom: 20px;
    font-size: 1.25rem;
    font-weight: 700;
    font-family: 'Inter', sans-serif;
    display: flex;
    align-items: center;
    gap: 10px;
    padding-bottom: 14px;
    border-bottom: 2px solid rgba(46,139,87,0.12);
}

/* ── Status Badges ── */
.status-badge {
    padding: 5px 14px;
    border-radius: 999px;
    font-size: 0.78rem;
    font-weight: 700;
    display: inline-block;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    font-family: 'Inter', sans-serif;
}
.status-passed {
    background: rgba(76,175,80,0.12);
    color: #2e7d32;
    border: 1px solid rgba(76,175,80,0.3);
}
.status-failed {
    background: rgba(244,67,54,0.1);
    color: #c62828;
    border: 1px solid rgba(244,67,54,0.25);
}
.status-pending {
    background: rgba(255,152,0,0.1);
    color: #e65100;
    border: 1px solid rgba(255,152,0,0.28);
}

/* ── Login Panel ── */
.login-page-wrap { position: relative; min-height: 100vh; }
.login-video-bg {
    position: fixed; top: 0; left: 0;
    width: 100%; height: 100%;
    object-fit: cover; z-index: -3;
}
.login-video-dim {
    position: fixed; top: 0; left: 0;
    width: 100%; height: 100%;
    background: rgba(0,0,0,0.56); z-index: -2;
}
.login-panel {
    background: linear-gradient(135deg, rgba(255,255,255,0.18), rgba(255,255,255,0.08));
    backdrop-filter: blur(18px) saturate(150%);
    -webkit-backdrop-filter: blur(18px) saturate(150%);
    border: 1px solid rgba(255,255,255,0.32);
    padding: 32px 36px 20px 36px;
    border-radius: 24px;
    max-width: 560px;
    margin: 20px auto 18px auto;
    box-shadow: 0 20px 50px rgba(0,0,0,0.32);
}
.login-panel h3 {
    color: #f5fff9;
    text-align: center;
    margin: 0 0 12px 0;
    font-size: 32px;
    font-weight: 800;
    text-shadow: 0 2px 16px rgba(0,0,0,0.3);
    font-family: 'Inter', sans-serif;
}
.login-panel p {
    text-align: center; margin: 0;
    color: rgba(240,255,248,0.92);
    font-size: 15px; line-height: 1.5;
    font-family: 'Inter', sans-serif;
}
.login-badge {
    width: fit-content;
    margin: 0 auto 14px auto;
    padding: 6px 16px;
    border-radius: 999px;
    background: linear-gradient(120deg, rgba(185,255,223,0.28), rgba(148,230,188,0.34));
    border: 1px solid rgba(210,255,231,0.42);
    color: #e0fff0;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 1px;
    text-transform: uppercase;
    font-family: 'Inter', sans-serif;
}
.login-hint {
    margin-top: 14px; text-align: center;
    color: rgba(230,255,242,0.9);
    font-size: 13px; opacity: 0.9;
    text-shadow: 0 2px 8px rgba(0,0,0,0.25);
    font-family: 'Inter', sans-serif;
}
body[data-login-mode="true"] .block-container {
    max-width: 560px; margin-top: 6vh;
    padding-top: 1rem; padding-bottom: 1.5rem;
}
body[data-login-mode="true"] [data-testid="stTextInput"] input {
    border-radius: 14px !important;
    border: 1.5px solid rgba(200,255,228,0.75) !important;
    background: linear-gradient(120deg, rgba(10,36,24,0.65), rgba(8,26,18,0.55)) !important;
    color: #ffffff !important;
    height: 50px; font-size: 16px; font-weight: 500;
    backdrop-filter: blur(10px);
}
body[data-login-mode="true"] [data-testid="stTextInput"] input::placeholder { color: rgba(220,255,240,0.7) !important; }
body[data-login-mode="true"] [data-testid="stTextInputLabel"] p {
    color: #eafff4 !important; font-weight: 700 !important; font-size: 14px !important;
    text-shadow: 0 1px 6px rgba(0,0,0,0.4) !important;
}
body[data-login-mode="true"] [data-testid="stButton"] button {
    border-radius: 14px !important; font-weight: 700 !important; min-height: 50px !important;
}
body[data-login-mode="true"] [data-testid="stButton"] button[kind="primary"] {
    background: linear-gradient(135deg, rgba(46,139,87,0.65), rgba(56,170,107,0.55)) !important;
    border: 1px solid rgba(200,255,228,0.45) !important;
    box-shadow: 0 10px 28px rgba(20,80,50,0.35) !important;
    backdrop-filter: blur(8px) !important; color: white !important;
}
body[data-login-mode="true"] [data-testid="stButton"] button[kind="secondary"] {
    background: linear-gradient(135deg, rgba(255,255,255,0.22), rgba(255,255,255,0.12)) !important;
    color: #ebfff4 !important; border: 1px solid rgba(225,255,240,0.42) !important;
    backdrop-filter: blur(8px) !important;
}
body[data-login-mode="true"] [data-testid="stButton"] button:hover {
    transform: translateY(-2px) !important; filter: brightness(1.06) !important;
}

/* ── Signup Panel ── */
body[data-signup-mode="true"] .block-container {
    max-width: 620px; margin-top: 5vh; padding-top: 1rem; padding-bottom: 1rem;
}
body[data-signup-mode="true"] .signup-panel {
    background: linear-gradient(135deg, rgba(255,255,255,0.20), rgba(255,255,255,0.08));
    border: 1px solid rgba(255,255,255,0.38);
    border-radius: 24px; padding: 26px;
    backdrop-filter: blur(18px) saturate(140%);
    -webkit-backdrop-filter: blur(18px) saturate(140%);
    box-shadow: 0 22px 50px rgba(0,0,0,0.32);
}
body[data-signup-mode="true"] .signup-panel h3 {
    margin: 0 0 8px 0; color: #f0fff8;
    text-align: center; font-size: 30px; font-weight: 800;
    text-shadow: 0 2px 14px rgba(0,0,0,0.3);
    font-family: 'Inter', sans-serif;
}
body[data-signup-mode="true"] .signup-panel p {
    margin: 0 0 14px 0; text-align: center;
    color: rgba(240,255,248,0.95); font-size: 15px;
    font-weight: 500; text-shadow: 0 1px 8px rgba(0,0,0,0.4);
}
body[data-signup-mode="true"] [data-testid="stTextInputLabel"] p {
    color: #f0fff8 !important; font-weight: 700 !important; font-size: 14px !important;
    text-shadow: 0 1px 6px rgba(0,0,0,0.4) !important;
}
body[data-signup-mode="true"] [data-testid="stTextInput"] input {
    border-radius: 14px !important;
    border: 1.5px solid rgba(200,255,228,0.8) !important;
    background: linear-gradient(120deg, rgba(10,36,24,0.65), rgba(8,26,18,0.55)) !important;
    color: #ffffff !important; height: 50px; font-size: 15px;
    backdrop-filter: blur(10px) !important;
}
body[data-signup-mode="true"] [data-testid="stTextInput"] input::placeholder { color: rgba(220,255,240,0.7) !important; }
body[data-signup-mode="true"] [data-testid="stButton"] button {
    min-height: 50px !important; border-radius: 14px !important;
    font-weight: 700 !important; font-size: 15px !important; color: #ffffff !important;
    background: linear-gradient(135deg, rgba(30,110,72,0.65), rgba(46,160,100,0.55)) !important;
    border: 1px solid rgba(200,255,230,0.5) !important;
    backdrop-filter: blur(8px) !important;
    box-shadow: 0 6px 22px rgba(20,80,50,0.28) !important;
}
body[data-signup-mode="true"] [data-testid="stButton"] button:hover { filter: brightness(1.08) !important; }
body[data-signup-mode="true"] [data-testid="stMarkdownContainer"] p,
body[data-signup-mode="true"] [data-testid="stCaptionContainer"] { color: #f0fff8 !important; }

/* ── Job Cards ── */
.job-card {
    background: linear-gradient(135deg, rgba(255,255,255,0.98), rgba(246,255,251,0.95));
    border: 1px solid rgba(46,139,87,0.12);
    border-radius: 18px; padding: 22px 20px; margin-bottom: 18px;
    box-shadow: 0 4px 20px rgba(46,139,87,0.07);
    transition: transform 0.25s ease, box-shadow 0.25s ease;
    position: relative; overflow: hidden;
}
.job-card::before {
    content: ''; position: absolute; left: 0; top: 0; bottom: 0;
    width: 4px; background: linear-gradient(180deg, #2E8B57, #81C784);
    border-radius: 4px 0 0 4px;
}
.job-card:hover { transform: translateY(-4px); box-shadow: 0 10px 35px rgba(46,139,87,0.14); }
.job-card .job-title {
    color: #0f2d1e; font-size: 17px; font-weight: 800;
    margin: 0 0 10px 0; font-family: 'Inter', sans-serif;
}
.job-card .job-meta {
    color: #3d6b52; font-size: 13px; margin: 4px 0;
    font-family: 'Inter', sans-serif;
}
.job-card .job-body {
    color: #3a5a46; font-size: 13.5px; margin: 8px 0;
    line-height: 1.5; font-family: 'Inter', sans-serif;
}
.job-card b { color: #1e5f3f; }

/* ── Section Headers ── */
.section-title {
    font-size: 1.4rem; font-weight: 800; color: #0f2d1e;
    margin: 28px 0 16px 0; font-family: 'Inter', sans-serif;
    display: flex; align-items: center; gap: 10px;
}
.section-title::after {
    content: ''; flex: 1; height: 2px;
    background: linear-gradient(90deg, rgba(46,139,87,0.3), transparent);
    border-radius: 2px;
}

/* ── Responsive ── */
@media (max-width: 768px) {
    .block-container { padding: 0.8rem !important; }
    .dashboard-header { font-size: 1.4rem; padding: 16px 18px; }
    .metric-card { min-width: 140px; padding: 20px 16px; }
    .metric-card h2 { font-size: 2rem; }
    .styled-card { padding: 20px 18px; }
    body[data-login-mode="true"] .block-container { max-width: 92%; margin-top: 1vh; }
    body[data-signup-mode="true"] .block-container { max-width: 92%; margin-top: 1vh; }
    .login-panel { padding: 22px 18px 16px 18px; border-radius: 16px; }
    .login-panel h3 { font-size: 24px; }
}

/* ── Nav Buttons ── */
.nav-btn-container { margin-bottom: 8px; }
</style>
""", unsafe_allow_html=True)


def safe_read_csv(path, fallback_columns=None):
    """Read CSV safely and avoid crashing on malformed rows."""
    try:
        return pd.read_csv(path)
    except ParserError:
        # Keep app alive if a single bad line exists.
        cleaned = pd.read_csv(path, engine="python", on_bad_lines="skip")
        if fallback_columns:
            for col in fallback_columns:
                if col not in cleaned.columns:
                    cleaned[col] = ""
            cleaned = cleaned[fallback_columns]
        return cleaned


def ensure_file_ends_with_newline(path):
    """Append newline if file does not end with one."""
    if not os.path.exists(path) or os.path.getsize(path) == 0:
        return
    with open(path, "rb+") as f:
        f.seek(-1, os.SEEK_END)
        last_char = f.read(1)
        if last_char not in (b"\n", b"\r"):
            f.write(b"\n")


# Load users and jobs
users_df = safe_read_csv("data/users.csv", ["id", "username", "email", "password", "role"])
jobs_df = safe_read_csv("data/jobs.csv")

# Common data paths and defaults
APPLICATIONS_FILE = "data/applications.csv"
SIMILARITY_PASS_MARK = 0.55


def normalize_role(role_value):
    role = str(role_value).strip().lower()
    if role in {"pro-vc", "pro_vc", "provc", "vc"}:
        return "pro_vc"
    return role


def role_home_page(role):
    if role == "user":
        return "jobs"
    if role == "hr":
        return "hr_dashboard"
    if role == "pro_vc":
        return "pro_vc_dashboard"
    if role == "admin":
        return "admin_dashboard"
    return "home"


def get_applications_df():
    required_columns = [
        "id",
        "name",
        "email",
        "phone",
        "job_id",
        "cv_path",
        "image_path",
        "submitted_at",
        "similarity",
        "cv_passed",
        "interview_scheduled_at",
        "interview_meet_link",
        "interview_notes",
        "interview_passed",
        "hr_report_sent",
        "status"
    ]
    if not os.path.exists(APPLICATIONS_FILE):
        return pd.DataFrame(columns=required_columns)
    apps = safe_read_csv(APPLICATIONS_FILE, required_columns)
    for col in required_columns:
        if col not in apps.columns:
            apps[col] = ""
    return apps[required_columns]


def save_applications_df(apps_df):
    apps_df.to_csv(APPLICATIONS_FILE, index=False)


def bool_series(values):
    return values.fillna("").astype(str).str.lower().isin(["true", "1", "yes"])


def escape_pdf_text(value):
    return str(value).replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def build_simple_pdf(report_title, lines):
    """Generate a lightweight printable PDF without external dependencies."""
    content_stream = "BT\n/F1 12 Tf\n50 790 Td\n"
    title = escape_pdf_text(report_title)
    content_stream += f"({title}) Tj\n0 -20 Td\n"
    for line in lines:
        safe_line = escape_pdf_text(line)
        content_stream += f"({safe_line}) Tj\n0 -14 Td\n"
    content_stream += "ET"
    content_bytes = content_stream.encode("latin-1", errors="replace")

    objects = []
    objects.append(b"1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n")
    objects.append(b"2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n")
    objects.append(
        b"3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj\n"
    )
    objects.append(b"4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n")
    objects.append(
        f"5 0 obj << /Length {len(content_bytes)} >> stream\n".encode("latin-1")
        + content_bytes
        + b"\nendstream endobj\n"
    )

    output = BytesIO()
    output.write(b"%PDF-1.4\n")
    offsets = [0]
    for obj in objects:
        offsets.append(output.tell())
        output.write(obj)

    xref_start = output.tell()
    output.write(f"xref\n0 {len(objects)+1}\n".encode("latin-1"))
    output.write(b"0000000000 65535 f \n")
    for off in offsets[1:]:
        output.write(f"{off:010d} 00000 n \n".encode("latin-1"))
    output.write(
        f"trailer << /Size {len(objects)+1} /Root 1 0 R >>\nstartxref\n{xref_start}\n%%EOF".encode("latin-1")
    )
    return output.getvalue()


def jobs_with_classification(jobs_df):
    jobs = jobs_df.copy()
    faculty_values = []
    department_values = []
    for _, row in jobs.iterrows():
        text = f"{row.get('title', '')} {row.get('description', '')}".lower()
        if "comput" in text or "ict" in text or "systems" in text:
            faculty_values.append("Faculty of Computing")
            department_values.append("Computing / ICT")
        elif "account" in text or "market" in text or "finance" in text or "audit" in text or "procurement" in text:
            faculty_values.append("Business School")
            department_values.append("Business / Finance")
        elif "nursing" in text or "health" in text or "laboratory" in text:
            faculty_values.append("Faculty of Health Sciences")
            department_values.append("Health and Clinical")
        elif "theology" in text or "biblical" in text:
            faculty_values.append("Faculty of Theology")
            department_values.append("Theology")
        elif "education" in text or "counsel" in text:
            faculty_values.append("Faculty of Education")
            department_values.append("Education and Counseling")
        elif "engineering" in text or "science" in text:
            faculty_values.append("Faculty of Engineering and Science")
            department_values.append("Engineering / Science")
        elif "library" in text:
            faculty_values.append("Library Services")
            department_values.append("University Library")
        elif "admission" in text or "examination" in text or "registr" in text:
            faculty_values.append("Academic Affairs")
            department_values.append("Admissions and Exams")
        elif "human resource" in text or "administrative assistant" in text or "admin" in text:
            faculty_values.append("Central Administration")
            department_values.append("HR and Admin")
        elif "public relations" in text or "quality assurance" in text:
            faculty_values.append("Corporate Services")
            department_values.append("PR and Quality Assurance")
        elif "estate" in text or "security" in text:
            faculty_values.append("Operations and Facilities")
            department_values.append("Estate and Security")
        elif "sports" in text or "student affairs" in text:
            faculty_values.append("Student Affairs")
            department_values.append("Student Life")
        else:
            faculty_values.append("General University Services")
            department_values.append("General")
    jobs["faculty"] = faculty_values
    jobs["department"] = department_values
    return jobs


# Session state
if 'logged_in' not in st.session_state:
    st.session_state.logged_in = False
if 'user_role' not in st.session_state:
    st.session_state.user_role = None
if 'username' not in st.session_state:
    st.session_state.username = None

# Function to login
def login(username, password):
    u = str(username).strip()
    p = str(password).strip()
    match_df = users_df[
        (users_df['username'].astype(str).str.strip() == u) & 
        (users_df['password'].astype(str).str.strip() == p)
    ]
    if not match_df.empty:
        st.session_state.logged_in = True
        st.session_state.user_role = normalize_role(match_df['role'].iloc[0])
        st.session_state.username = match_df['username'].iloc[0]
        st.session_state.page = role_home_page(st.session_state.user_role)
        st.session_state.show_login = False
        st.rerun()
    else:
        st.error("Invalid credentials")

# Function to create account
def create_account(username, email, password):
    latest_users = safe_read_csv("data/users.csv", ["id", "username", "email", "password", "role"])
    if username in latest_users['username'].values:
        st.error("Username already exists")
        return
    if email in latest_users['email'].values:
        st.error("Email already exists")
        return
    if latest_users.empty or latest_users["id"].isna().all():
        next_id = 1
    else:
        next_id = int(pd.to_numeric(latest_users["id"], errors="coerce").dropna().max()) + 1

    new_user = pd.DataFrame({
        "id": [next_id],
        "username": [username],
        "email": [email],
        "password": [password],
        "role": ["user"]
    })
    ensure_file_ends_with_newline("data/users.csv")
    new_user.to_csv("data/users.csv", mode='a', header=False, index=False)
    st.success("Account created! Please login.")
    sent, message = send_signup_confirmation_email(email, username)
    if sent:
        st.info("A confirmation email has been sent to your address.")
    else:
        st.warning(f"Account created, but email notification was not sent: {message}")
        st.caption(
            "Configure SMTP via environment variables or Streamlit secrets "
            "(SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM)."
        )


def send_signup_confirmation_email(recipient_email, username):
    """Send account creation confirmation email using SMTP settings."""
    recipient_parsed = parseaddr(recipient_email)[1]
    if "@" not in recipient_parsed:
        return False, "invalid recipient email address"

    try:
        smtp_host = st.secrets["smtp"]["host"]
        smtp_port_raw = str(st.secrets["smtp"]["port"])
        smtp_user = st.secrets["smtp"]["user"]
        smtp_password = st.secrets["smtp"]["password"]
        smtp_from = st.secrets["smtp"].get("from", smtp_user)
        use_ssl_raw = str(st.secrets["smtp"].get("use_ssl", False)).lower()
        use_starttls_raw = str(st.secrets["smtp"].get("use_starttls", True)).lower()
    except Exception:
        smtp_host = os.getenv("SMTP_HOST")
        smtp_port_raw = os.getenv("SMTP_PORT", "587")
        smtp_user = os.getenv("SMTP_USER")
        smtp_password = os.getenv("SMTP_PASSWORD")
        smtp_from = os.getenv("SMTP_FROM", smtp_user if smtp_user else "")
        use_ssl_raw = os.getenv("SMTP_USE_SSL", "false").lower()
        use_starttls_raw = os.getenv("SMTP_USE_STARTTLS", "true").lower()
    use_ssl = use_ssl_raw in {"1", "true", "yes", "on"}
    use_starttls = use_starttls_raw in {"1", "true", "yes", "on"}

    if not all([smtp_host, smtp_port_raw, smtp_user, smtp_password, smtp_from]):
        return False, "SMTP settings are not configured"
    try:
        smtp_port = int(smtp_port_raw)
    except ValueError:
        return False, "invalid SMTP_PORT value"

    msg = EmailMessage()
    msg["Subject"] = "Your Pentecost Recruiter account is ready"
    msg["From"] = smtp_from
    msg["To"] = recipient_parsed
    msg.set_content(
        f"Hello {username},\n\n"
        "Your account has been created successfully on Pentecost University Recruiter.\n"
        "You can now log in and continue your application journey.\n\n"
        "If this wasn't you, please contact support.\n\n"
        "Regards,\nPentecost University Recruiter"
    )

    try:
        smtp_cls = smtplib.SMTP_SSL if use_ssl else smtplib.SMTP
        with smtp_cls(smtp_host, smtp_port, timeout=20) as server:
            server.ehlo()
            if use_starttls and not use_ssl:
                server.starttls()
                server.ehlo()
            server.login(smtp_user, smtp_password)
            server.send_message(msg)
        return True, "sent"
    except Exception as exc:
        return False, f"{type(exc).__name__}: {exc}"


def send_signup_verification_code_email(recipient_email, username, verification_code):
    """Send OTP code for signup verification."""
    recipient_parsed = parseaddr(recipient_email)[1]
    if "@" not in recipient_parsed:
        return False, "invalid recipient email address"

    _secrets_exc = ""
    try:
        smtp_host = st.secrets["smtp"]["host"]
        smtp_port_raw = str(st.secrets["smtp"]["port"])
        smtp_user = st.secrets["smtp"]["user"]
        smtp_password = st.secrets["smtp"]["password"]
        smtp_from = st.secrets["smtp"].get("from", smtp_user)
        use_ssl_raw = str(st.secrets["smtp"].get("use_ssl", False)).lower()
        use_starttls_raw = str(st.secrets["smtp"].get("use_starttls", True)).lower()
    except Exception as _e:
        _secrets_exc = f"{type(_e).__name__}: {_e}"
        smtp_host = os.getenv("SMTP_HOST")
        smtp_port_raw = os.getenv("SMTP_PORT", "587")
        smtp_user = os.getenv("SMTP_USER")
        smtp_password = os.getenv("SMTP_PASSWORD")
        smtp_from = os.getenv("SMTP_FROM", smtp_user if smtp_user else "")
        use_ssl_raw = os.getenv("SMTP_USE_SSL", "false").lower()
        use_starttls_raw = os.getenv("SMTP_USE_STARTTLS", "true").lower()
    use_ssl = use_ssl_raw in {"1", "true", "yes", "on"}
    use_starttls = use_starttls_raw in {"1", "true", "yes", "on"}

    if not all([smtp_host, smtp_port_raw, smtp_user, smtp_password, smtp_from]):
        detail = f" (secrets error: {_secrets_exc})" if _secrets_exc else ""
        return False, f"SMTP settings are not configured{detail}"
    try:
        smtp_port = int(smtp_port_raw)
    except ValueError:
        return False, "invalid SMTP_PORT value"

    msg = EmailMessage()
    msg["Subject"] = "Verify your Pentecost Recruiter signup"
    msg["From"] = smtp_from
    msg["To"] = recipient_parsed
    msg.set_content(
        f"Hello {username},\n\n"
        "Use the verification code below to complete your signup:\n\n"
        f"{verification_code}\n\n"
        "This code expires in 10 minutes.\n\n"
        "Regards,\nPentecost University Recruiter"
    )

    try:
        smtp_cls = smtplib.SMTP_SSL if use_ssl else smtplib.SMTP
        with smtp_cls(smtp_host, smtp_port, timeout=20) as server:
            server.ehlo()
            if use_starttls and not use_ssl:
                server.starttls()
                server.ehlo()
            server.login(smtp_user, smtp_password)
            server.send_message(msg)
        return True, "sent"
    except Exception as exc:
        return False, f"{type(exc).__name__}: {exc}"


def resolve_asset_path(candidates):
    """Return first existing file path from candidates."""
    for path in candidates:
        if os.path.exists(path):
            return path
    return None


def render_login_video_bg(video_path):
    """Render an inline HTML5 video as the login page background."""
    try:
        with open(video_path, "rb") as video_file:
            video_b64 = base64.b64encode(video_file.read()).decode("utf-8")
    except Exception:
        return

    st.markdown(
        f"""
        <div class="login-page-wrap">
            <video class="login-video-bg" autoplay muted loop playsinline>
                <source src="data:video/mp4;base64,{video_b64}" type="video/mp4">
            </video>
            <div class="login-video-dim"></div>
        </div>
        """,
        unsafe_allow_html=True
    )


def render_login_video_bg_js(video_path):
    """Inject video background into parent DOM using JavaScript."""
    try:
        with open(video_path, "rb") as video_file:
            video_b64 = base64.b64encode(video_file.read()).decode("utf-8")
    except Exception:
        return

    components.html(
        f"""
        <script>
            (function () {{
                const doc = window.parent.document;
                const oldVideo = doc.getElementById("login-video-bg");
                const oldDim = doc.getElementById("login-video-dim");
                if (oldVideo) oldVideo.remove();
                if (oldDim) oldDim.remove();

                const video = doc.createElement("video");
                video.id = "login-video-bg";
                video.autoplay = true;
                video.muted = true;
                video.loop = true;
                video.playsInline = true;
                video.setAttribute("playsinline", "");
                video.style.position = "fixed";
                video.style.top = "0";
                video.style.left = "0";
                video.style.width = "100vw";
                video.style.height = "100vh";
                video.style.objectFit = "contain";
                video.style.backgroundColor = "#000";
                video.style.objectPosition = "center center";
                video.style.zIndex = "-3";
                video.style.pointerEvents = "none";
                video.innerHTML = '<source src="data:video/mp4;base64,{video_b64}" type="video/mp4">';

                const dim = doc.createElement("div");
                dim.id = "login-video-dim";
                dim.style.position = "fixed";
                dim.style.top = "0";
                dim.style.left = "0";
                dim.style.width = "100vw";
                dim.style.height = "100vh";
                dim.style.background = "rgba(0, 0, 0, 0.56)";
                dim.style.zIndex = "-2";
                dim.style.pointerEvents = "none";

                const app = doc.querySelector('[data-testid="stAppViewContainer"]');
                if (app) {{
                    app.style.background = "transparent";
                }}
                const main = doc.querySelector(".stApp");
                if (main) {{
                    main.style.background = "transparent";
                }}
                doc.body.style.backgroundColor = "#000";
                doc.body.setAttribute("data-login-mode", "true");

                doc.body.prepend(dim);
                doc.body.prepend(video);

                // Ensure playback starts on reruns.
                const playPromise = video.play();
                if (playPromise && typeof playPromise.catch === "function") {{
                    playPromise.catch(() => {{}});
                }}
            }})();
        </script>
        """,
        height=0
    )


def render_login_image_bg_js(image_path):
    """Inject an image background into parent DOM using JavaScript."""
    try:
        with open(image_path, "rb") as image_file:
            image_b64 = base64.b64encode(image_file.read()).decode("utf-8")
    except Exception:
        return

    components.html(
        f"""
        <script>
            (function () {{
                const doc = window.parent.document;
                const oldImg = doc.getElementById("login-image-bg");
                const oldDim = doc.getElementById("login-image-dim");
                if (oldImg) oldImg.remove();
                if (oldDim) oldDim.remove();

                const bg = doc.createElement("div");
                bg.id = "login-image-bg";
                bg.style.position = "fixed";
                bg.style.top = "0";
                bg.style.left = "0";
                bg.style.width = "100vw";
                bg.style.height = "100vh";
                bg.style.backgroundImage = "url('data:image/jpeg;base64,{image_b64}')";
                bg.style.backgroundRepeat = "no-repeat";
                bg.style.backgroundPosition = "center center";
                bg.style.backgroundSize = "cover";
                bg.style.zIndex = "-3";
                bg.style.pointerEvents = "none";

                const dim = doc.createElement("div");
                dim.id = "login-image-dim";
                dim.style.position = "fixed";
                dim.style.top = "0";
                dim.style.left = "0";
                dim.style.width = "100vw";
                dim.style.height = "100vh";
                dim.style.background = "rgba(0, 0, 0, 0.56)";
                dim.style.zIndex = "-2";
                dim.style.pointerEvents = "none";

                const app = doc.querySelector('[data-testid="stAppViewContainer"]');
                if (app) {{
                    app.style.background = "transparent";
                }}
                const main = doc.querySelector(".stApp");
                if (main) {{
                    main.style.background = "transparent";
                }}
                doc.body.style.backgroundColor = "#000";
                doc.body.setAttribute("data-login-mode", "true");

                doc.body.prepend(dim);
                doc.body.prepend(bg);
            }})();
        </script>
        """,
        height=0
    )


def clear_login_video_bg_js():
    """Remove injected video background when leaving login page."""
    components.html(
        """
        <script>
            (function () {
                const doc = window.parent.document;
                const oldVideo = doc.getElementById("login-video-bg");
                const oldDim = doc.getElementById("login-video-dim");
                const oldImg = doc.getElementById("login-image-bg");
                const oldImgDim = doc.getElementById("login-image-dim");
                if (oldVideo) oldVideo.remove();
                if (oldDim) oldDim.remove();
                if (oldImg) oldImg.remove();
                if (oldImgDim) oldImgDim.remove();
                doc.body.removeAttribute("data-login-mode");
            })();
        </script>
        """,
        height=0
    )


def render_home_watermark_js(image_path):
    """Show a subtle logo watermark on the public homepage."""
    try:
        with open(image_path, "rb") as image_file:
            image_b64 = base64.b64encode(image_file.read()).decode("utf-8")
    except Exception:
        return

    components.html(
        f"""
        <script>
            (function () {{
                const doc = window.parent.document;
                const oldMark = doc.getElementById("home-logo-watermark");
                if (oldMark) oldMark.remove();

                const mark = doc.createElement("div");
                mark.id = "home-logo-watermark";
                mark.style.position = "fixed";
                mark.style.top = "0";
                mark.style.left = "0";
                mark.style.width = "100vw";
                mark.style.height = "100vh";
                mark.style.pointerEvents = "none";
                mark.style.zIndex = "-1";
                mark.style.backgroundImage = "url('data:image/jpeg;base64,{image_b64}')";
                mark.style.backgroundRepeat = "no-repeat";
                mark.style.backgroundPosition = "center center";
                mark.style.backgroundSize = "min(56vw, 560px)";
                mark.style.opacity = "0.18";
                mark.style.filter = "grayscale(10%)";

                const app = doc.querySelector('[data-testid="stAppViewContainer"]');
                if (app) {{
                    app.style.background = "transparent";
                }}
                const main = doc.querySelector(".stApp");
                if (main) {{
                    main.style.background = "transparent";
                }}
                doc.body.style.backgroundColor = "#eef2ef";
                doc.body.prepend(mark);
                doc.body.setAttribute("data-home-mode", "true");
            }})();
        </script>
        """,
        height=0
    )


def clear_home_watermark_js():
    """Remove homepage watermark when navigating away."""
    components.html(
        """
        <script>
            (function () {
                const doc = window.parent.document;
                const oldMark = doc.getElementById("home-logo-watermark");
                if (oldMark) oldMark.remove();
                doc.body.removeAttribute("data-home-mode");
                const app = doc.querySelector('[data-testid="stAppViewContainer"]');
                if (app) {{
                    app.style.background = "";
                }}
                const main = doc.querySelector(".stApp");
                if (main) {{
                    main.style.background = "";
                }}
                doc.body.style.backgroundColor = "";
            })();
        </script>
        """,
        height=0
    )


def render_signup_background_js(image_path):
    """Render school background image for signup page."""
    try:
        with open(image_path, "rb") as image_file:
            image_b64 = base64.b64encode(image_file.read()).decode("utf-8")
    except Exception:
        return

    components.html(
        f"""
        <script>
            (function () {{
                const doc = window.parent.document;
                const oldBg = doc.getElementById("signup-bg-image");
                const oldDim = doc.getElementById("signup-bg-dim");
                if (oldBg) oldBg.remove();
                if (oldDim) oldDim.remove();

                const bg = doc.createElement("div");
                bg.id = "signup-bg-image";
                bg.style.position = "fixed";
                bg.style.top = "0";
                bg.style.left = "0";
                bg.style.width = "100vw";
                bg.style.height = "100vh";
                bg.style.backgroundImage = "url('data:image/jpeg;base64,{image_b64}')";
                bg.style.backgroundPosition = "center center";
                bg.style.backgroundRepeat = "no-repeat";
                bg.style.backgroundSize = "cover";
                bg.style.zIndex = "-3";
                bg.style.pointerEvents = "none";

                const dim = doc.createElement("div");
                dim.id = "signup-bg-dim";
                dim.style.position = "fixed";
                dim.style.top = "0";
                dim.style.left = "0";
                dim.style.width = "100vw";
                dim.style.height = "100vh";
                dim.style.background = "rgba(0, 0, 0, 0.45)";
                dim.style.zIndex = "-2";
                dim.style.pointerEvents = "none";

                const app = doc.querySelector('[data-testid="stAppViewContainer"]');
                if (app) {{
                    app.style.background = "transparent";
                }}
                const main = doc.querySelector(".stApp");
                if (main) {{
                    main.style.background = "transparent";
                }}
                doc.body.style.backgroundColor = "#0a1d14";
                doc.body.setAttribute("data-signup-mode", "true");
                doc.body.prepend(dim);
                doc.body.prepend(bg);
            }})();
        </script>
        """,
        height=0
    )


def clear_signup_background_js():
    """Remove signup background image when leaving signup page."""
    components.html(
        """
        <script>
            (function () {
                const doc = window.parent.document;
                const oldBg = doc.getElementById("signup-bg-image");
                const oldDim = doc.getElementById("signup-bg-dim");
                if (oldBg) oldBg.remove();
                if (oldDim) oldDim.remove();
                doc.body.removeAttribute("data-signup-mode");
            })();
        </script>
        """,
        height=0
    )

# Main app
if not st.session_state.logged_in:
    # Initialize session states for showing forms
    if 'show_login' not in st.session_state:
        st.session_state.show_login = False
    if 'show_signup' not in st.session_state:
        st.session_state.show_signup = False
    if 'show_search' not in st.session_state:
        st.session_state.show_search = False
    if 'signup_verification_pending' not in st.session_state:
        st.session_state.signup_verification_pending = False
    if 'signup_verification_code' not in st.session_state:
        st.session_state.signup_verification_code = ""
    if 'signup_verification_expires' not in st.session_state:
        st.session_state.signup_verification_expires = None
    if 'pending_signup_username' not in st.session_state:
        st.session_state.pending_signup_username = ""
    if 'pending_signup_email' not in st.session_state:
        st.session_state.pending_signup_email = ""
    if 'pending_signup_password' not in st.session_state:
        st.session_state.pending_signup_password = ""
    
    # Main homepage with heading and buttons
    if not st.session_state.show_login and not st.session_state.show_signup and not st.session_state.show_search:
        render_home_watermark_js("pentecost logo.jpg")
        clear_signup_background_js()
        clear_login_video_bg_js()

        st.markdown("""
        <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700;900&display=swap');

        .hero-section {
            text-align: center;
            padding: 60px 20px 40px 20px;
            font-family: 'Inter', sans-serif;
        }
        .hero-badge {
            display: inline-block;
            background: linear-gradient(135deg, rgba(46,139,87,0.15), rgba(76,175,80,0.2));
            border: 1px solid rgba(46,139,87,0.35);
            color: #1e5f3f;
            font-size: 13px;
            font-weight: 700;
            letter-spacing: 2px;
            text-transform: uppercase;
            padding: 6px 18px;
            border-radius: 999px;
            margin-bottom: 22px;
        }
        .hero-title {
            font-size: 3.6rem;
            font-weight: 900;
            line-height: 1.12;
            color: #0f2d1e;
            margin-bottom: 18px;
            text-shadow: 0 2px 20px rgba(46,139,87,0.08);
        }
        .hero-title span {
            background: linear-gradient(135deg, #2E8B57, #4CAF50);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        .hero-sub {
            font-size: 1.15rem;
            color: #4a6b5a;
            max-width: 620px;
            margin: 0 auto 40px auto;
            line-height: 1.7;
            font-weight: 400;
        }
        .hero-btns {
            display: flex;
            justify-content: center;
            gap: 16px;
            flex-wrap: wrap;
            margin-bottom: 55px;
        }
        .hero-btn-primary {
            background: linear-gradient(135deg, #2E8B57, #4CAF50);
            color: white !important;
            padding: 14px 36px;
            border-radius: 12px;
            font-size: 16px;
            font-weight: 700;
            border: none;
            cursor: pointer;
            box-shadow: 0 8px 25px rgba(46,139,87,0.35);
            transition: all 0.3s ease;
            text-decoration: none;
        }
        .hero-btn-secondary {
            background: rgba(255,255,255,0.85);
            color: #1e5f3f !important;
            padding: 14px 36px;
            border-radius: 12px;
            font-size: 16px;
            font-weight: 700;
            border: 2px solid rgba(46,139,87,0.3);
            cursor: pointer;
            transition: all 0.3s ease;
            text-decoration: none;
            backdrop-filter: blur(8px);
        }
        .stats-bar {
            display: flex;
            justify-content: center;
            gap: 0;
            max-width: 700px;
            margin: 0 auto 55px auto;
            background: rgba(255,255,255,0.88);
            border-radius: 18px;
            border: 1px solid rgba(46,139,87,0.15);
            box-shadow: 0 8px 32px rgba(46,139,87,0.08);
            backdrop-filter: blur(12px);
            overflow: hidden;
        }
        .stat-item {
            flex: 1;
            padding: 22px 10px;
            text-align: center;
            border-right: 1px solid rgba(46,139,87,0.1);
        }
        .stat-item:last-child { border-right: none; }
        .stat-num {
            font-size: 2rem;
            font-weight: 900;
            color: #2E8B57;
            display: block;
            line-height: 1;
            margin-bottom: 4px;
        }
        .stat-label {
            font-size: 12px;
            color: #6b8f7a;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.8px;
        }
        .features-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 20px;
            max-width: 900px;
            margin: 0 auto 40px auto;
        }
        .feature-card {
            background: rgba(255,255,255,0.88);
            border: 1px solid rgba(46,139,87,0.13);
            border-radius: 18px;
            padding: 28px 22px;
            text-align: center;
            backdrop-filter: blur(10px);
            box-shadow: 0 8px 28px rgba(46,139,87,0.06);
            transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        .feature-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 16px 40px rgba(46,139,87,0.14);
        }
        .feature-icon {
            font-size: 2.4rem;
            margin-bottom: 14px;
            display: block;
        }
        .feature-title {
            font-size: 1rem;
            font-weight: 700;
            color: #0f2d1e;
            margin-bottom: 8px;
        }
        .feature-desc {
            font-size: 0.88rem;
            color: #5a7a69;
            line-height: 1.55;
        }
        .footer-note {
            text-align: center;
            color: #8aab98;
            font-size: 13px;
            padding-bottom: 30px;
        }
        @media (max-width: 768px) {
            .hero-title { font-size: 2.2rem; }
            .features-grid { grid-template-columns: 1fr; }
            .stats-bar { flex-direction: column; }
            .stat-item { border-right: none; border-bottom: 1px solid rgba(46,139,87,0.1); }
        }
        </style>

        <div class="hero-section">
            <div class="hero-badge">🎓 Pentecost University · Official Recruitment Portal</div>
            <div class="hero-title">Find Your Place at<br><span>Pentecost University</span></div>
            <div class="hero-sub">
                Apply for academic and administrative roles across our faculties and departments.
                A transparent, fast, and modern recruitment experience — built for you.
            </div>
        </div>

        <div class="stats-bar">
            <div class="stat-item">
                <span class="stat-num">50+</span>
                <span class="stat-label">Open Positions</span>
            </div>
            <div class="stat-item">
                <span class="stat-num">12</span>
                <span class="stat-label">Departments</span>
            </div>
            <div class="stat-item">
                <span class="stat-num">AI</span>
                <span class="stat-label">CV Screening</span>
            </div>
            <div class="stat-item">
                <span class="stat-num">Fast</span>
                <span class="stat-label">Review Process</span>
            </div>
        </div>

        <div class="features-grid">
            <div class="feature-card">
                <span class="feature-icon">🤖</span>
                <div class="feature-title">AI-Powered CV Analysis</div>
                <div class="feature-desc">Your CV is automatically screened and scored against the job description for accuracy and fit.</div>
            </div>
            <div class="feature-card">
                <span class="feature-icon">📅</span>
                <div class="feature-title">Automated Scheduling</div>
                <div class="feature-desc">Qualified applicants receive automatic interview invitations with Google Meet links.</div>
            </div>
            <div class="feature-card">
                <span class="feature-icon">🔒</span>
                <div class="feature-title">Secure & Verified</div>
                <div class="feature-desc">Email and SMS verification ensures every account and application is genuine and secure.</div>
            </div>
        </div>
        """, unsafe_allow_html=True)

        # Action buttons using Streamlit (so they work)
        col1, col2, col3, col4, col5 = st.columns([1.2, 1, 1, 1, 1.2])
        with col2:
            if st.button("🔐 Login", key="btn_login_home", use_container_width=True, type="primary"):
                st.session_state.show_login = True
                st.rerun()
        with col3:
            if st.button("📝 Sign Up", key="btn_signup_home", use_container_width=True):
                st.session_state.show_signup = True
                st.rerun()
        with col4:
            if st.button("🔍 Browse Jobs", key="btn_search_home", use_container_width=True):
                st.session_state.show_search = True
                st.rerun()

        st.markdown('<div class="footer-note">© 2025 Pentecost University · All applications are processed fairly and transparently.</div>', unsafe_allow_html=True)


    # Show login form
    if st.session_state.show_login:
        clear_home_watermark_js()
        clear_signup_background_js()
        render_login_image_bg_js("pent 2.jpg")

        # Back button at top
        if st.button("← Back to Home", key="btn_back_login_top"):
            st.session_state.show_login = False
            st.rerun()
        
        st.markdown("""
            <div class="login-panel">
                <div class="login-badge">Secure Access</div>
                <h3>Login to Your Account</h3>
                <p>Continue your recruitment journey with a clean, secure sign-in experience.</p>
            </div>
        """, unsafe_allow_html=True)

        username = st.text_input("👤 Username", key="login_username", placeholder="Enter your username")
        password = st.text_input("🔒 Password", type="password", key="login_password", placeholder="Enter your password")

        col_login, col_cancel = st.columns(2)
        with col_login:
            if st.button("🔐 Login", key="btn_login_submit", use_container_width=True, type="primary"):
                login(username, password)
        with col_cancel:
            if st.button("❌ Cancel", key="btn_cancel_login", use_container_width=True):
                st.session_state.show_login = False
                st.rerun()

        st.markdown('<div class="login-hint">Use your assigned username and password from registration.</div>', unsafe_allow_html=True)
    
    # Show signup form
    elif st.session_state.show_signup:
        if 'signup_step' not in st.session_state:
            st.session_state.signup_step = 1

        clear_home_watermark_js()
        clear_login_video_bg_js()
        signup_bg_path = resolve_asset_path([
            "school.jpeg"
        ])
        if signup_bg_path:
            render_signup_background_js(signup_bg_path)
            
        if st.session_state.signup_step == 1:
            st.markdown("""
                <div class="signup-panel">
                    <h3>Create New Account</h3>
                    <p>Step 1: Enter your registration details.</p>
                </div>
            """, unsafe_allow_html=True)
            
            new_username = st.text_input("Username", key="signup_username")
            new_email = st.text_input("Email", key="signup_email")
            new_password = st.text_input("Password", type="password", key="signup_password")
            col_phone_code, col_phone_num = st.columns([1, 3])
            with col_phone_code:
                all_country_codes = ["+233", "+1", "+7", "+20", "+27", "+30", "+31", "+32", "+33", "+34", "+36", "+39", "+40", "+41", "+43", "+44", "+45", "+46", "+47", "+48", "+49", "+51", "+52", "+53", "+54", "+55", "+56", "+57", "+58", "+60", "+61", "+62", "+63", "+64", "+65", "+66", "+81", "+82", "+84", "+86", "+90", "+91", "+92", "+93", "+94", "+95", "+98", "+211", "+212", "+213", "+216", "+218", "+220", "+221", "+222", "+223", "+224", "+225", "+226", "+227", "+228", "+229", "+230", "+231", "+232", "+234", "+235", "+236", "+237", "+238", "+239", "+240", "+241", "+242", "+243", "+244", "+245", "+246", "+247", "+248", "+249", "+250", "+251", "+252", "+253", "+254", "+255", "+256", "+257", "+258", "+260", "+261", "+262", "+263", "+264", "+265", "+266", "+267", "+268", "+269", "+290", "+291", "+297", "+298", "+299", "+350", "+351", "+352", "+353", "+354", "+355", "+356", "+357", "+358", "+359", "+370", "+371", "+372", "+373", "+374", "+375", "+376", "+377", "+378", "+379", "+380", "+381", "+382", "+383", "+385", "+386", "+387", "+389", "+420", "+421", "+423", "+500", "+501", "+502", "+503", "+504", "+505", "+506", "+507", "+508", "+509", "+590", "+591", "+592", "+593", "+594", "+595", "+596", "+597", "+598", "+599", "+670", "+672", "+673", "+674", "+675", "+676", "+677", "+678", "+679", "+680", "+681", "+682", "+683", "+685", "+686", "+687", "+688", "+689", "+690", "+691", "+692", "+850", "+852", "+853", "+855", "+856", "+880", "+886", "+960", "+961", "+962", "+963", "+964", "+965", "+966", "+967", "+968", "+970", "+971", "+972", "+973", "+974", "+975", "+976", "+977", "+992", "+993", "+994", "+995", "+996", "+998"]
                country_code = st.selectbox("Code", options=all_country_codes, index=0, key="signup_country_code")
            with col_phone_num:
                new_phone = st.text_input("Phone Number", key="signup_phone", placeholder="Optional for SMS")
                
            verification_method = st.radio("Send verification code via:", ["Email", "SMS"], horizontal=True)
            
            col_btn1, col_btn2 = st.columns([2, 1])
            with col_btn1:
                if st.button("Send Verification Code", key="btn_signup_send_code", use_container_width=True):
                    latest_users = safe_read_csv("data/users.csv", ["id", "username", "email", "password", "role"])
                    if not new_username or not new_email or not new_password:
                        st.error("Please fill username, email and password first.")
                    elif new_username in latest_users["username"].values:
                        st.error("Username already exists")
                    elif new_email in latest_users["email"].values:
                        st.error("Email already exists")
                    elif verification_method == "SMS" and not new_phone.strip():
                        st.error("Please enter a phone number to use SMS verification.")
                    else:
                        code = "".join(random.choices(string.digits, k=6))
                        sent = False
                        full_phone = ""
                        
                        send_error_msg = ""
                        if verification_method == "SMS":
                            # Strip leading zero if user enters 054... so +23354... is valid
                            full_phone = f"{country_code}{new_phone.strip().lstrip('0')}"
                            from utils.sms import send_sms
                            sent = send_sms(full_phone, f"Your Pentecost Recruiter verification code is {code}")
                        else:
                            sent, send_error_msg = send_signup_verification_code_email(new_email, new_username, code)

                        st.session_state.signup_verification_code = code
                        st.session_state.signup_verification_expires = (datetime.now() + timedelta(minutes=10)).isoformat()
                        st.session_state.pending_signup_username = new_username
                        st.session_state.pending_signup_email = new_email
                        st.session_state.pending_signup_password = new_password
                        st.session_state.pending_signup_phone = full_phone if verification_method == "SMS" else new_phone
                        st.session_state.signup_verification_method = verification_method

                        if not sent:
                            st.session_state.signup_verification_fallback = True
                            st.session_state.signup_send_error = send_error_msg
                        else:
                            st.session_state.signup_verification_fallback = False
                            st.session_state.signup_send_error = ""

                        st.session_state.signup_step = 2
                        st.rerun()
            with col_btn2:
                if st.button("Cancel", key="btn_cancel_signup"):
                    st.session_state.show_signup = False
                    st.session_state.signup_step = 1
                    st.rerun()

        elif st.session_state.signup_step == 2:
            st.markdown("""
                <div class="signup-panel">
                    <h3>Verify Account</h3>
                    <p>Step 2: Enter the code sent to your selected contact method.</p>
                </div>
            """, unsafe_allow_html=True)
            
            if st.session_state.get("signup_verification_method") == "SMS":
                st.info(f"Verification code sent via SMS to {st.session_state.pending_signup_phone}")
            else:
                st.info(f"Verification code sent via Email to {st.session_state.pending_signup_email}")
                
            if st.session_state.get("signup_verification_fallback", False):
                err = st.session_state.get("signup_send_error", "")
                st.warning(f"Email sending failed ({err}). Development fallback — your code is **{st.session_state.signup_verification_code}**")
                
            verification_code_input = st.text_input("Verification Code", key="signup_verification_code_input")
            
            col_btn1, col_btn2 = st.columns([2, 1])
            with col_btn1:
                if st.button("Verify & Create Account", key="btn_signup_verify_create", use_container_width=True):
                    if not verification_code_input.strip():
                        st.error("Enter the verification code.")
                    else:
                        expires_raw = st.session_state.signup_verification_expires
                        is_expired = True
                        if expires_raw:
                            try:
                                is_expired = datetime.now() > datetime.fromisoformat(expires_raw)
                            except ValueError:
                                is_expired = True
                                
                        if is_expired:
                            st.error("Verification code expired. Please go back and request a new code.")
                        elif verification_code_input.strip() != st.session_state.signup_verification_code:
                            st.error("Invalid verification code.")
                        else:
                            # Create the account
                            latest_users = safe_read_csv("data/users.csv", ["id", "username", "email", "password", "role"])
                            next_id = 1 if latest_users.empty else int(pd.to_numeric(latest_users["id"], errors="coerce").dropna().max()) + 1
                            new_user = pd.DataFrame({
                                "id": [next_id],
                                "username": [st.session_state.pending_signup_username],
                                "email": [st.session_state.pending_signup_email],
                                "password": [st.session_state.pending_signup_password],
                                "role": ["user"]
                            })
                            ensure_file_ends_with_newline("data/users.csv")
                            new_user.to_csv("data/users.csv", mode='a', header=False, index=False)
                            # Send welcome email silently
                            send_signup_confirmation_email(st.session_state.pending_signup_email, st.session_state.pending_signup_username)
                            
                            # Clean up and move to step 3
                            st.session_state.signup_verification_code = ""
                            st.session_state.signup_verification_expires = None
                            st.session_state.signup_step = 3
                            st.rerun()
            with col_btn2:
                if st.button("Back", key="btn_back_to_step1"):
                    st.session_state.signup_step = 1
                    st.rerun()
                    
        elif st.session_state.signup_step == 3:
            st.markdown("""
                <div class="signup-panel">
                    <h3>🎉 Success!</h3>
                    <p>Your account has been created successfully.</p>
                </div>
            """, unsafe_allow_html=True)
            st.success(f"Welcome, {st.session_state.pending_signup_username}! You can now log in and start applying for jobs.")
            
            if st.button("Go to Login", use_container_width=True, type="primary"):
                st.session_state.signup_step = 1
                st.session_state.pending_signup_username = ""
                st.session_state.pending_signup_email = ""
                st.session_state.pending_signup_password = ""
                st.session_state.show_signup = False
                st.session_state.show_login = True
                st.rerun()
    
    # Show search form
    elif st.session_state.show_search:
        clear_home_watermark_js()
        clear_login_video_bg_js()
        clear_signup_background_js()
        st.markdown("### Search for Jobs or Candidates")
        search_query = st.text_input("Enter search term (job title, skills, etc.)", key="search_query", placeholder="e.g., Software Engineer, Python")
        col_btn1, col_btn2 = st.columns([2, 1])
        with col_btn1:
            if st.button("Search", key="btn_search_submit", use_container_width=True):
                if search_query:
                    st.success(f"Searching for: {search_query}")
                    # Add search functionality here
                else:
                    st.warning("Please enter a search term")
        with col_btn2:
            if st.button("Back", key="btn_back_search"):
                st.session_state.show_search = False
                st.rerun()

else:
    clear_home_watermark_js()
    clear_login_video_bg_js()
    clear_signup_background_js()
    # Top Navigation Bar
    st.markdown(
        f'<div class="top-nav"><span class="top-nav-user">🎓 Pentecost Recruiter &nbsp;|&nbsp; Logged in as: {st.session_state.username} ({str(st.session_state.user_role).upper()})</span></div>', 
        unsafe_allow_html=True
    )
    
    st.markdown('<div class="nav-btn-container">', unsafe_allow_html=True)
    
    nav_items = ["Home"]
    if st.session_state.user_role == "user":
        nav_items.extend(["Available Jobs", "Apply for Job", "My Applications"])
    elif st.session_state.user_role == "hr":
        nav_items.append("HR Dashboard")
    elif st.session_state.user_role == "pro_vc":
        nav_items.append("PRO-VC Dashboard")
    elif st.session_state.user_role == "admin":
        nav_items.append("Admin Dashboard")
        
    if st.session_state.user_role in ["admin", "hr", "pro_vc"]:
        nav_items.append("Account Settings")
        
    nav_items.append("Logout")
    
    cols = st.columns(len(nav_items))
    
    for i, item in enumerate(nav_items):
        with cols[i]:
            if st.button(item, use_container_width=True, key=f"nav_{item}"):
                if item == "Logout":
                    st.session_state.logged_in = False
                    st.session_state.user_role = None
                    st.session_state.username = None
                    st.session_state.page = "home"
                    st.rerun()
                elif item == "Home":
                    st.session_state.page = "home"
                elif item == "Available Jobs":
                    st.session_state.page = "jobs"
                elif item == "Apply for Job":
                    st.session_state.page = "apply"
                elif item == "My Applications":
                    st.session_state.page = "my_apps"
                elif item == "HR Dashboard":
                    st.session_state.page = "hr_dashboard"
                elif item == "PRO-VC Dashboard":
                    st.session_state.page = "pro_vc_dashboard"
                elif item == "Admin Dashboard":
                    st.session_state.page = "admin_dashboard"
                elif item == "Account Settings":
                    st.session_state.page = "account_settings"

    st.markdown('</div>', unsafe_allow_html=True)

    # Page content
    if 'page' not in st.session_state:
        st.session_state.page = "home"

    if st.session_state.page == "home":
        st.markdown('<div class="dashboard-header">🏠 Welcome Home</div>', unsafe_allow_html=True)
        st.markdown(f"""
        <div class="styled-card">
            <h2>Hello, {st.session_state.username}!</h2>
            <p style="font-size: 1.1rem; color: #4a6b5a;">
                You are logged in as <b>{str(st.session_state.user_role).upper()}</b>. 
                { "Explore available jobs and submit your applications using the navigation above." if st.session_state.user_role == "user" else "Access your administrative dashboard to manage vacancies, applications, and system settings." }
            </p>
        </div>
        """, unsafe_allow_html=True)
        
        if st.session_state.user_role == "user":
            col1, col2 = st.columns(2)
            with col1:
                st.markdown('<div class="styled-card"><h3>🔍 Quick Actions</h3>', unsafe_allow_html=True)
                if st.button("Browse Available Jobs", key="home_btn_jobs", use_container_width=True, type="primary"):
                    st.session_state.page = "jobs"
                    st.rerun()
                if st.button("View My Applications", key="home_btn_apps", use_container_width=True):
                    st.session_state.page = "my_apps"
                    st.rerun()
                st.markdown('</div>', unsafe_allow_html=True)
            with col2:
                st.markdown('<div class="styled-card"><h3>📅 Interview Info</h3>', unsafe_allow_html=True)
                st.info("Check 'My Applications' for any scheduled interviews and Google Meet links.")
                st.markdown('</div>', unsafe_allow_html=True)

    elif st.session_state.page == "jobs":
        # Jobs page
        st.markdown('<div class="dashboard-header">🔍 University Job Opportunities</div>', unsafe_allow_html=True)
        st.write("Teaching and non-teaching vacancies across faculties and departments.")
        
        jobs_df = pd.read_csv("data/jobs.csv")
        jobs_df = jobs_with_classification(jobs_df)
        all_faculties = sorted(jobs_df["faculty"].dropna().unique().tolist())
        all_departments = sorted(jobs_df["department"].dropna().unique().tolist())
        
        st.markdown('<div class="styled-card">', unsafe_allow_html=True)
        col_f, col_d = st.columns(2)
        with col_f:
            selected_faculties = st.multiselect("Filter by Faculty", all_faculties)
        with col_d:
            selected_departments = st.multiselect("Filter by Department", all_departments)
        st.markdown('</div>', unsafe_allow_html=True)

        filtered_jobs = jobs_df.copy()
        if selected_faculties:
            filtered_jobs = filtered_jobs[filtered_jobs["faculty"].isin(selected_faculties)]
        if selected_departments:
            filtered_jobs = filtered_jobs[filtered_jobs["department"].isin(selected_departments)]
        if filtered_jobs.empty:
            st.warning("No jobs match selected faculty/department filters.")

        def is_lecturer_title(title_value):
            title_value = str(title_value or "").strip().lower()
            return "lecturer" in title_value or "teaching" in title_value

        teaching_df = filtered_jobs[filtered_jobs["title"].apply(is_lecturer_title)].copy()
        non_teaching_df = filtered_jobs[~filtered_jobs["title"].apply(is_lecturer_title)].copy()

        def render_jobs_grid(df, section_title):
            if df.empty:
                st.info(f"No {section_title.lower()} available for the current filters.")
                return

            st.markdown(f'<div class="section-title">{section_title}</div>', unsafe_allow_html=True)
            jobs_records = df.to_dict(orient="records")
            for row_idx in range(0, len(jobs_records), 2):
                col_left, col_right = st.columns(2)

                def render_job(job):
                    with st.container():
                        st.markdown(
                            f"""
                            <div class="job-card">
                                <div class="job-title">{job.get('title','')}</div>
                                <div class="job-meta"><b>Faculty:</b> {job.get('faculty','')} &nbsp; | &nbsp; <b>Department:</b> {job.get('department','')}</div>
                                <div class="job-body"><b>Description:</b> {job.get('description','')}</div>
                                <div class="job-body"><b>Requirements:</b> {job.get('requirements','')}</div>
                                <div class="job-meta"><b>Salary (Annual):</b> ${job.get('salary','')}</div>
                            </div>
                            """,
                            unsafe_allow_html=True
                        )

                        if st.button(
                            f"Apply for {job.get('title','')}",
                            key=f"apply_{section_title}_{job.get('id','')}",
                            use_container_width=True
                        ):
                            st.session_state.selected_job = job["id"]
                            st.session_state.page = "apply"
                            st.rerun()

                with col_left:
                    if row_idx < len(jobs_records):
                        render_job(jobs_records[row_idx])
                with col_right:
                    if row_idx + 1 < len(jobs_records):
                        render_job(jobs_records[row_idx + 1])

        render_jobs_grid(teaching_df, "Teaching (Lecturer) Jobs")
        render_jobs_grid(non_teaching_df, "Non-Lecturing / Other Jobs")

    elif st.session_state.page == "apply":
        # Apply page
        st.markdown('<div class="dashboard-header">📝 Apply for Job</div>', unsafe_allow_html=True)
        if 'selected_job' not in st.session_state:
            st.error("Please select a job first.")
        else:
            job_id = st.session_state.selected_job
            jobs_df = pd.read_csv("data/jobs.csv")
            job = jobs_df[jobs_df['id'] == job_id].iloc[0]
            st.markdown('<div class="styled-card">', unsafe_allow_html=True)
            st.subheader(f"Applying for: {job['title']}")

            with st.form("application_form"):
                name = st.text_input("Full Name")
                email = st.text_input("Email")
                phone = st.text_input("Phone Number")
                cv_file = st.file_uploader("Upload CV (PDF)", type=["pdf"])
                photo_file = st.file_uploader("Upload Photo", type=["jpg", "png", "jpeg"])
                submitted = st.form_submit_button("Submit Application")

            if submitted:
                if not name or not email or not cv_file or not photo_file:
                    st.error("Please fill all fields and upload files.")
                else:
                    from utils.cv_processor import extract_text_from_pdf, compute_similarity
                    import uuid
                    from datetime import datetime

                    app_id = str(uuid.uuid4())
                    cv_path = f"data/cvs/{app_id}.pdf"
                    os.makedirs("data/cvs", exist_ok=True)
                    with open(cv_path, "wb") as f:
                        f.write(cv_file.getbuffer())

                    image_path = f"data/images/{app_id}.jpg"
                    os.makedirs("data/images", exist_ok=True)
                    with open(image_path, "wb") as f:
                        f.write(photo_file.getbuffer())

                    cv_text = extract_text_from_pdf(cv_path)
                    job_req = job['requirements']
                    similarity = compute_similarity(cv_text, job_req)
                    is_passed = similarity >= SIMILARITY_PASS_MARK
                    
                    interview_time = ""
                    meet_link = ""
                    if is_passed:
                        interview_time = (datetime.now() + timedelta(days=3)).strftime("%Y-%m-%d %I:%M %p")
                        meet_link = "https://meet.google.com/xyz-abcd-efg"

                    apps_df = get_applications_df()
                    new_app = pd.DataFrame({
                        "id": [app_id],
                        "name": [name],
                        "email": [email],
                        "phone": [phone],
                        "job_id": [job_id],
                        "cv_path": [cv_path],
                        "image_path": [image_path],
                        "submitted_at": [datetime.now().isoformat()],
                        "similarity": [similarity],
                        "cv_passed": [str(is_passed)],
                        "interview_scheduled_at": [interview_time],
                        "interview_meet_link": [meet_link],
                        "interview_notes": [""],
                        "interview_passed": [""],
                        "hr_report_sent": ["false"],
                        "status": ["CV Passed" if is_passed else "CV Not Passed"]
                    })
                    apps_df = pd.concat([apps_df, new_app], ignore_index=True)
                    save_applications_df(apps_df)

                    from utils.sms import send_sms
                    if is_passed:
                        send_sms(phone, f"Congrats! Your CV for {job['title']} passed. Interview: {interview_time}. Link: {meet_link}")
                    else:
                        send_sms(phone, f"Your application for {job['title']} has been submitted successfully.")

                    st.session_state.just_submitted = True
                    st.session_state.page = "my_apps"
                    st.rerun()
            st.markdown('</div>', unsafe_allow_html=True)

    elif st.session_state.page == "my_apps":
        st.markdown('<div class="dashboard-header">📁 My Applications</div>', unsafe_allow_html=True)
        if st.session_state.get("just_submitted", False):
            st.success("🎉 Application submitted successfully! We will review your application and contact you shortly if you are shortlisted.")
            st.session_state.just_submitted = False
            
        user_email = users_df[users_df['username'] == st.session_state.username]['email'].iloc[0]
        if os.path.exists(APPLICATIONS_FILE):
            apps_df = pd.read_csv(APPLICATIONS_FILE)
            user_apps = apps_df[apps_df['email'] == user_email]
            
            st.markdown('<div class="styled-card"><h3>Application History</h3>', unsafe_allow_html=True)
            display_columns = ["job_id", "submitted_at", "similarity", "status", "interview_scheduled_at", "interview_meet_link"]
            available_cols = [col for col in display_columns if col in user_apps.columns]
            
            if not user_apps.empty:
                st.dataframe(user_apps[available_cols], use_container_width=True)
            else:
                st.info("You haven't applied for any jobs yet.")
            st.markdown('</div>', unsafe_allow_html=True)
        else:
            st.info("No applications yet.")

    elif st.session_state.page == "hr_dashboard":
        st.markdown('<div class="dashboard-header">👥 Human Resources Dashboard</div>', unsafe_allow_html=True)
        apps_df = get_applications_df()
        jobs_df = safe_read_csv("data/jobs.csv")
        total_jobs = len(jobs_df)
        total_apps = len(apps_df)
        passed_cvs = len(apps_df[bool_series(apps_df["cv_passed"])]) if not apps_df.empty else 0
        st.markdown(f'''
        <div class="metric-container">
            <div class="metric-card"><h4>Total Vacancies</h4><h2>{total_jobs}</h2></div>
            <div class="metric-card"><h4>Total Applications</h4><h2>{total_apps}</h2></div>
            <div class="metric-card"><h4>CV Passed Candidates</h4><h2>{passed_cvs}</h2></div>
        </div>
        ''', unsafe_allow_html=True)
        st.markdown('<div class="styled-card"><h3>➕ Create Job Vacancy</h3>', unsafe_allow_html=True)
        with st.form("create_vacancy_form"):
            vacancy_title = st.text_input("Job Title")
            vacancy_description = st.text_area("Description")
            vacancy_requirements = st.text_area("Requirements")
            vacancy_salary = st.text_input("Salary")
            vacancy_submit = st.form_submit_button("Publish Vacancy")

        if vacancy_submit:
            if not vacancy_title or not vacancy_description or not vacancy_requirements or not vacancy_salary:
                st.error("Please fill all vacancy fields.")
            else:
                jobs = safe_read_csv("data/jobs.csv")
                next_job_id = 1 if jobs.empty else int(pd.to_numeric(jobs["id"], errors="coerce").dropna().max()) + 1
                new_job = pd.DataFrame({
                    "id": [next_job_id],
                    "title": [vacancy_title],
                    "description": [vacancy_description],
                    "requirements": [vacancy_requirements],
                    "salary": [vacancy_salary]
                })
                new_job.to_csv("data/jobs.csv", mode="a", header=False, index=False)
                st.success("Vacancy published successfully.")
                st.rerun()
        st.markdown('</div>', unsafe_allow_html=True)

        st.markdown('<div class="styled-card"><h3>🗑️ Remove Job Vacancy</h3>', unsafe_allow_html=True)
        jobs_for_removal = safe_read_csv("data/jobs.csv")
        if not jobs_for_removal.empty:
            with st.form("remove_vacancy_form"):
                job_to_remove = st.selectbox(
                    "Select Job to Remove", 
                    options=jobs_for_removal['id'].astype(str) + " - " + jobs_for_removal['title']
                )
                remove_submit = st.form_submit_button("Remove Job")
            
            if remove_submit:
                job_id_to_remove = int(job_to_remove.split(" - ")[0])
                jobs_for_removal = jobs_for_removal[jobs_for_removal['id'] != job_id_to_remove]
                jobs_for_removal.to_csv("data/jobs.csv", index=False)
                st.success("Job removed successfully.")
                st.rerun()
        else:
            st.info("No active jobs to remove.")
        st.markdown('</div>', unsafe_allow_html=True)

        st.markdown('<div class="styled-card"><h3>✅ Applicants Who Passed CV Mark</h3>', unsafe_allow_html=True)
        apps_df = get_applications_df()
        jobs_df = safe_read_csv("data/jobs.csv")
        cv_passed_df = apps_df[bool_series(apps_df["cv_passed"])].copy()
        if not cv_passed_df.empty:
            cv_passed_df = cv_passed_df.sort_values("similarity", ascending=False)
            st.dataframe(cv_passed_df[["id", "name", "email", "phone", "job_id", "similarity", "status"]])

            selected_app_id = st.selectbox("Select Applicant for Interview Scheduling / Rescheduling", cv_passed_df["id"].tolist())
            
            # Fetch current details
            current_app = apps_df[apps_df["id"] == selected_app_id].iloc[0]
            current_schedule = current_app.get("interview_scheduled_at", "")
            current_link = current_app.get("interview_meet_link", "")
            current_notes = current_app.get("interview_notes", "")
            
            st.info(f"**Current Schedule**: {current_schedule if str(current_schedule).strip() else 'None'}\n\n**Current Link**: {current_link if str(current_link).strip() else 'None'}")

            col_d, col_t = st.columns(2)
            with col_d:
                interview_date = st.date_input("Interview Date")
            with col_t:
                interview_time = st.time_input("Interview Time")
                
            new_meet_link = st.text_input("Google Meet Link", value=str(current_link) if str(current_link).strip() else "https://meet.google.com/")
            interview_notes = st.text_area("Interview Notes / Venue", value=str(current_notes) if str(current_notes).strip() else "")

            if st.button("Schedule / Reschedule Interview", key="btn_hr_schedule"):
                schedule_str = f"{interview_date} {interview_time}"
                apps_df.loc[apps_df["id"] == selected_app_id, "interview_scheduled_at"] = schedule_str
                apps_df.loc[apps_df["id"] == selected_app_id, "interview_meet_link"] = new_meet_link
                apps_df.loc[apps_df["id"] == selected_app_id, "interview_notes"] = interview_notes
                apps_df.loc[apps_df["id"] == selected_app_id, "status"] = "Interview Scheduled"
                save_applications_df(apps_df)
                
                from utils.sms import send_sms
                phone = current_app['phone']
                job_id = current_app['job_id']
                j_df = safe_read_csv("data/jobs.csv")
                j_title = j_df[j_df['id'] == job_id]['title'].iloc[0] if not j_df[j_df['id'] == job_id].empty else "your application"
                
                msg = f"Interview Update: Your interview for {j_title} is set for {schedule_str}. Link: {new_meet_link}"
                send_sms(phone, msg)
                
                st.success("Interview scheduled successfully and applicant notified via SMS.")
                st.rerun()

        else:
            st.info("No applicant has passed the CV mark yet.")
        st.markdown('</div>', unsafe_allow_html=True)

        st.markdown('<div class="styled-card"><h3>🎯 Interview Results & Reports</h3>', unsafe_allow_html=True)
        scheduled_df = apps_df[apps_df["interview_scheduled_at"].astype(str).str.strip() != ""].copy()
        if not scheduled_df.empty:
            chosen_id = st.selectbox("Select Interviewed Applicant", scheduled_df["id"].tolist(), key="hr_interview_result")
            result = st.radio("Interview Result", ["Passed", "Failed"], horizontal=True)
            if st.button("Submit Interview Result and Send Report"):
                passed = result == "Passed"
                apps_df.loc[apps_df["id"] == chosen_id, "interview_passed"] = str(passed).lower()
                apps_df.loc[apps_df["id"] == chosen_id, "hr_report_sent"] = "true" if passed else "false"
                apps_df.loc[apps_df["id"] == chosen_id, "status"] = "Interview Passed" if passed else "Interview Failed"
                save_applications_df(apps_df)
                st.success("Report submitted. PRO-VC dashboard has been updated.")
                st.rerun()
        else:
            st.info("No interviews scheduled yet.")
        st.markdown('</div>', unsafe_allow_html=True)

        st.markdown('<div class="styled-card"><h3>📂 All Applications</h3>', unsafe_allow_html=True)
        st.dataframe(apps_df.sort_values("submitted_at", ascending=False), use_container_width=True)
        hr_report_df = apps_df[
            bool_series(apps_df["cv_passed"]) &
            bool_series(apps_df["interview_passed"])
        ][["id", "name", "email", "phone", "job_id", "similarity", "interview_scheduled_at", "status"]]
        report_lines = ["HR Final Report (CV + Interview Passed)", ""]
        if hr_report_df.empty:
            report_lines.append("No passed applicants yet.")
        else:
            for _, rec in hr_report_df.iterrows():
                report_lines.append(
                    f"{rec['name']} | {rec['email']} | Job ID {rec['job_id']} | Similarity {float(rec['similarity']):.2f} | {rec['status']}"
                )
        hr_pdf = build_simple_pdf("HR Final Report", report_lines)
        st.download_button(
            "Download HR Printable PDF Report",
            data=hr_pdf,
            file_name="hr_final_report.pdf",
            mime="application/pdf"
        )
        st.markdown('</div>', unsafe_allow_html=True)

    elif st.session_state.page == "pro_vc_dashboard":
        st.markdown('<div class="dashboard-header">🏛️ PRO-VC Dashboard</div>', unsafe_allow_html=True)
        apps_df = get_applications_df()
        jobs_df = safe_read_csv("data/jobs.csv")
        scheduled_df = apps_df[apps_df["interview_scheduled_at"].astype(str).str.strip() != ""]
        report_df = apps_df[
            bool_series(apps_df["cv_passed"]) &
            bool_series(apps_df["interview_passed"]) &
            bool_series(apps_df["hr_report_sent"])
        ]
        
        st.markdown(f'''
        <div class="metric-container">
            <div class="metric-card"><h4>Pending Interviews</h4><h2>{len(scheduled_df)}</h2></div>
            <div class="metric-card"><h4>Final Reports</h4><h2>{len(report_df)}</h2></div>
            <div class="metric-card"><h4>Active Vacancies</h4><h2>{len(jobs_df)}</h2></div>
        </div>
        ''', unsafe_allow_html=True)

        st.markdown('<div class="styled-card"><h3>📋 Jobs Published by HR</h3>', unsafe_allow_html=True)
        st.dataframe(jobs_df, use_container_width=True)
        st.markdown('</div>', unsafe_allow_html=True)

        st.markdown('<div class="styled-card"><h3>📅 Applicants Scheduled for Interview</h3>', unsafe_allow_html=True)
        scheduled_df = apps_df[apps_df["interview_scheduled_at"].astype(str).str.strip() != ""]
        if not scheduled_df.empty:
            st.dataframe(scheduled_df[["id", "name", "email", "phone", "job_id", "interview_scheduled_at", "interview_notes", "status"]], use_container_width=True)
        else:
            st.info("No interview schedule has been added by HR yet.")
        st.markdown('</div>', unsafe_allow_html=True)

        st.markdown('<div class="styled-card"><h3>✅ HR Report: Passed CV and Interview</h3>', unsafe_allow_html=True)
        report_df = apps_df[
            bool_series(apps_df["cv_passed"]) &
            bool_series(apps_df["interview_passed"]) &
            bool_series(apps_df["hr_report_sent"])
        ]
        if not report_df.empty:
            st.dataframe(report_df[["id", "name", "email", "phone", "job_id", "similarity", "interview_scheduled_at", "status"]])
        else:
            st.info("No final passed candidates report from HR yet.")
        pro_vc_lines = ["PRO-VC Report: Passed CV and Interview", ""]
        if report_df.empty:
            pro_vc_lines.append("No records available.")
        else:
            for _, rec in report_df.iterrows():
                pro_vc_lines.append(
                    f"{rec['name']} | {rec['email']} | Job ID {rec['job_id']} | Similarity {float(rec['similarity']):.2f} | {rec['status']}"
                )
        pro_vc_pdf = build_simple_pdf("PRO-VC Recruitment Report", pro_vc_lines)
        st.download_button(
            "Download PRO-VC Printable PDF Report",
            data=pro_vc_pdf,
            file_name="pro_vc_report.pdf",
            mime="application/pdf"
        )
        st.markdown('</div>', unsafe_allow_html=True)

    elif st.session_state.page == "admin_dashboard":
        st.markdown('<div class="dashboard-header">⚙️ System Administrator</div>', unsafe_allow_html=True)
        apps_df = get_applications_df()
        jobs_df = safe_read_csv("data/jobs.csv")
        users_df_all = safe_read_csv("data/users.csv")
        
        st.markdown(f'''
        <div class="metric-container">
            <div class="metric-card"><h4>Total Users</h4><h2>{len(users_df_all)}</h2></div>
            <div class="metric-card"><h4>Total Vacancies</h4><h2>{len(jobs_df)}</h2></div>
            <div class="metric-card"><h4>Total Applications</h4><h2>{len(apps_df)}</h2></div>
        </div>
        ''', unsafe_allow_html=True)

        st.markdown('<div class="styled-card"><h3>👥 User Management</h3>', unsafe_allow_html=True)
        
        st.markdown('<div class="section-title">Current System Users</div>', unsafe_allow_html=True)
        display_users = users_df_all[["id", "username", "email", "role"]].copy() if not users_df_all.empty else pd.DataFrame()
        st.dataframe(display_users, use_container_width=True)
        
        col1, col2 = st.columns(2)
        with col1:
            st.markdown('<div class="section-title">Add New User</div>', unsafe_allow_html=True)
            with st.form("admin_add_user"):
                new_u_name = st.text_input("Username")
                new_u_email = st.text_input("Email")
                new_u_pass = st.text_input("Password", type="password")
                new_u_role = st.selectbox("Role", ["user", "hr", "pro_vc", "admin"])
                submit_new = st.form_submit_button("Create User")
                if submit_new:
                    if not new_u_name or not new_u_email or not new_u_pass:
                        st.error("Fill all fields")
                    elif new_u_name in users_df_all["username"].values:
                        st.error("Username already exists")
                    elif new_u_email in users_df_all["email"].values:
                        st.error("Email already exists")
                    else:
                        next_id = 1 if users_df_all.empty or users_df_all["id"].isna().all() else int(pd.to_numeric(users_df_all["id"], errors="coerce").dropna().max()) + 1
                        new_user_row = pd.DataFrame({
                            "id": [next_id],
                            "username": [new_u_name],
                            "email": [new_u_email],
                            "password": [new_u_pass],
                            "role": [new_u_role]
                        })
                        ensure_file_ends_with_newline("data/users.csv")
                        new_user_row.to_csv("data/users.csv", mode='a', header=False, index=False)
                        st.success(f"User {new_u_name} created successfully!")
                        st.rerun()

        with col2:
            st.markdown('<div class="section-title">Edit User Credentials</div>', unsafe_allow_html=True)
            with st.form("admin_edit_user"):
                if not users_df_all.empty:
                    edit_u_name = st.selectbox("Select User", users_df_all["username"].tolist())
                else:
                    edit_u_name = None
                new_role = st.selectbox("New Role", ["user", "hr", "pro_vc", "admin"])
                reset_pass = st.text_input("New Password (leave blank to keep current)", type="password")
                submit_edit = st.form_submit_button("Update User")
                if submit_edit and edit_u_name:
                    users_df_all.loc[users_df_all["username"] == edit_u_name, "role"] = new_role
                    if reset_pass:
                        users_df_all.loc[users_df_all["username"] == edit_u_name, "password"] = reset_pass
                    users_df_all.to_csv("data/users.csv", index=False)
                    st.success(f"User {edit_u_name} updated successfully!")
                    st.rerun()
                    
        st.markdown('</div>', unsafe_allow_html=True)

        st.markdown('<div class="styled-card"><h3>🏢 All Jobs</h3>', unsafe_allow_html=True)
        st.dataframe(jobs_df, use_container_width=True)
        st.markdown('</div>', unsafe_allow_html=True)
        
        st.markdown('<div class="styled-card"><h3>📁 All Applications</h3>', unsafe_allow_html=True)
        st.dataframe(apps_df, use_container_width=True)
        st.markdown('</div>', unsafe_allow_html=True)

    elif st.session_state.page == "account_settings" and st.session_state.user_role in ["admin", "hr", "pro_vc"]:
        st.markdown('<div class="dashboard-header">⚙️ Account Settings</div>', unsafe_allow_html=True)
        st.markdown('<div class="styled-card"><h3>Update Credentials</h3>', unsafe_allow_html=True)
        
        current_users = safe_read_csv("data/users.csv", ["id", "username", "email", "password", "role"])
        user_row = current_users[current_users["username"] == st.session_state.username]
        current_email = user_row["email"].iloc[0] if not user_row.empty else ""
        
        with st.form("update_account_form"):
            new_email = st.text_input("New Email", value=current_email)
            new_password = st.text_input("New Password", type="password")
            confirm_password = st.text_input("Confirm New Password", type="password")
            submit_update = st.form_submit_button("Update Account")
            
        if submit_update:
            if not new_email or not new_password or not confirm_password:
                st.error("Please fill in all fields.")
            elif new_password != confirm_password:
                st.error("Passwords do not match.")
            else:
                other_users = current_users[current_users["username"] != st.session_state.username]
                if new_email in other_users["email"].values:
                    st.error("This email is already in use by another account.")
                else:
                    current_users.loc[current_users["username"] == st.session_state.username, "email"] = new_email
                    current_users.loc[current_users["username"] == st.session_state.username, "password"] = new_password
                    ensure_file_ends_with_newline("data/users.csv")
                    current_users.to_csv("data/users.csv", index=False)
                    st.success("Account updated successfully! Your new credentials will be required on your next login.")
        st.markdown('</div>', unsafe_allow_html=True)