import streamlit as st
import pandas as pd
import os

st.set_page_config(
    page_title="Pentecost University CV Analyzer",
    page_icon="🎓",
    layout="wide"
)

# Custom CSS for professional look
st.markdown("""
<style>
    .main {
        background-color: #f5f5f5;
    }
    .stButton>button {
        background-color: #4CAF50;
        color: white;
        border: none;
        padding: 10px 20px;
        text-align: center;
        text-decoration: none;
        display: inline-block;
        font-size: 16px;
        margin: 4px 2px;
        cursor: pointer;
        border-radius: 4px;
    }
    .stTextInput>div>div>input {
        border-radius: 4px;
    }
    .welcome-header {
        text-align: center;
        font-size: 2em;
        color: #2E8B57;
    }
</style>
""", unsafe_allow_html=True)

# Load users
users_df = pd.read_csv("data/users.csv")

# Session state
if 'logged_in' not in st.session_state:
    st.session_state.logged_in = False
if 'user_role' not in st.session_state:
    st.session_state.user_role = None
if 'username' not in st.session_state:
    st.session_state.username = None

# Function to login
def login(username, password):
    user = users_df[(users_df['username'] == username) & (users_df['password'] == password)]
    if not user.empty:
        st.session_state.logged_in = True
        st.session_state.user_role = user['role'].iloc[0]
        st.session_state.username = username
        st.rerun()
    else:
        st.error("Invalid credentials")

# Function to create account
def create_account(username, email, password):
    if username in users_df['username'].values:
        st.error("Username already exists")
        return
    if email in users_df['email'].values:
        st.error("Email already exists")
        return
    new_user = pd.DataFrame({
        "id": [users_df['id'].max() + 1],
        "username": [username],
        "email": [email],
        "password": [password],
        "role": ["user"]
    })
    new_user.to_csv("data/users.csv", mode='a', header=False, index=False)
    st.success("Account created! Please login.")

# Main app
if not st.session_state.logged_in:
    st.markdown('<h1 class="welcome-header">Welcome to Pentecost University</h1>', unsafe_allow_html=True)
    st.image("https://www.pentecostuniversity.edu.gh/wp-content/uploads/2020/07/puclogo.png", width=300)
    st.write("An automated system for CV analysis and job matching at Pentecost University.")

    st.markdown("### Key Features:")
    col1, col2, col3 = st.columns(3)
    with col1:
        st.markdown("**Job Showcase**")
        st.write("Browse available positions tailored to your skills.")
    with col2:
        st.markdown("**Smart Matching**")
        st.write("AI-powered cosine similarity ranking for job-CV matching.")
    with col3:
        st.markdown("**Secure Dashboards**")
        st.write("Role-based access for admins, HR, VC, and more.")

    tab1, tab2 = st.tabs(["Login", "Create Account"])

    with tab1:
        st.subheader("Login to Your Account")
        username = st.text_input("Username")
        password = st.text_input("Password", type="password")
        if st.button("Login"):
            login(username, password)

    with tab2:
        st.subheader("Create New Account")
        new_username = st.text_input("Username", key="new_user")
        new_email = st.text_input("Email", key="new_email")
        new_password = st.text_input("Password", type="password", key="new_pass")
        if st.button("Create Account"):
            create_account(new_username, new_email, new_password)

else:
    # Sidebar for navigation
    st.sidebar.title("Navigation")
    st.sidebar.write(f"Logged in as: {st.session_state.username} ({st.session_state.user_role})")

    if st.sidebar.button("Home"):
        st.session_state.page = "home"
    if st.session_state.user_role == "user":
        if st.sidebar.button("Available Jobs"):
            st.session_state.page = "jobs"
        if st.sidebar.button("Apply for Job"):
            st.session_state.page = "apply"
        if st.sidebar.button("My Applications"):
            st.session_state.page = "my_apps"
    elif st.session_state.user_role in ["admin", "hr", "vc", "registrar"]:
        if st.sidebar.button("Dashboard"):
            st.session_state.page = "dashboard"

    if st.sidebar.button("Logout"):
        st.session_state.logged_in = False
        st.session_state.user_role = None
        st.session_state.username = None
        st.rerun()

    # Page content
    if 'page' not in st.session_state:
        st.session_state.page = "home"

    if st.session_state.page == "home":
        st.title("Home")
        st.write(f"Welcome back, {st.session_state.username}!")
        if st.session_state.user_role == "user":
            st.write("Explore available jobs and submit your applications.")
        else:
            st.write("Access your administrative dashboard.")

    elif st.session_state.page == "jobs":
        # Jobs page
        st.title("Available Jobs")
        jobs_df = pd.read_csv("data/jobs.csv")
        for _, job in jobs_df.iterrows():
            with st.container():
                st.subheader(job['title'])
                st.write(f"**Description:** {job['description']}")
                st.write(f"**Requirements:** {job['requirements']}")
                st.write(f"**Salary:** ${job['salary']}")
                if st.button(f"Apply for {job['title']}", key=int(job['id'])):
                    st.session_state.selected_job = job['id']
                    st.session_state.page = "apply"
                    st.rerun()

    elif st.session_state.page == "apply":
        # Apply page
        st.title("Apply for Job")
        if 'selected_job' not in st.session_state:
            st.error("Please select a job first.")
        else:
            job_id = st.session_state.selected_job
            jobs_df = pd.read_csv("data/jobs.csv")
            job = jobs_df[jobs_df['id'] == job_id].iloc[0]
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

                    applications_file = "data/applications.csv"
                    if not os.path.exists(applications_file):
                        pd.DataFrame(columns=["id", "name", "email", "phone", "job_id", "cv_path", "image_path", "submitted_at", "similarity"]).to_csv(applications_file, index=False)

                    new_app = pd.DataFrame({
                        "id": [app_id],
                        "name": [name],
                        "email": [email],
                        "phone": [phone],
                        "job_id": [job_id],
                        "cv_path": [cv_path],
                        "image_path": [image_path],
                        "submitted_at": [datetime.now().isoformat()],
                        "similarity": [similarity]
                    })
                    new_app.to_csv(applications_file, mode='a', header=False, index=False)

                    st.success("Application submitted successfully!")
                    st.write(f"CV-Job Similarity Score: {similarity:.2f}")
                    # Send SMS notification
                    from utils.sms import send_sms
                    send_sms(phone, f"Your application for {job['title']} has been submitted. Similarity score: {similarity:.2f}")

    elif st.session_state.page == "my_apps":
        st.title("My Applications")
        user_email = users_df[users_df['username'] == st.session_state.username]['email'].iloc[0]
        if os.path.exists("data/applications.csv"):
            apps_df = pd.read_csv("data/applications.csv")
            user_apps = apps_df[apps_df['email'] == user_email]
            st.dataframe(user_apps)
        else:
            st.write("No applications yet.")

    elif st.session_state.page == "dashboard":
        st.title(f"{st.session_state.user_role.upper()} Dashboard")
        if st.session_state.user_role == "admin":
            st.subheader("Applications")
            if os.path.exists("data/applications.csv"):
                apps_df = pd.read_csv("data/applications.csv")
                st.dataframe(apps_df)
            st.subheader("Jobs")
            jobs_df = pd.read_csv("data/jobs.csv")
            st.dataframe(jobs_df)
        elif st.session_state.user_role == "hr":
            st.subheader("Ranked Applications")
            if os.path.exists("data/applications.csv"):
                apps_df = pd.read_csv("data/applications.csv")
                apps_df = apps_df.sort_values('similarity', ascending=False)
                st.dataframe(apps_df)
                selected_app_id = st.selectbox("Select Applicant for Interview", apps_df['id'].tolist())
                if st.button("Start Video Interview"):
                    st.write(f"Starting video interview with {apps_df[apps_df['id']==selected_app_id]['name'].iloc[0]}")
                    import streamlit_webrtc as webrtc
                    webrtc.webrtc_streamer(key=f"interview_{selected_app_id}")
        elif st.session_state.user_role == "vc":
            st.subheader("Applicant Reviews")
            if os.path.exists("data/applications.csv"):
                apps_df = pd.read_csv("data/applications.csv")
                jobs_df = pd.read_csv("data/jobs.csv")
                for _, app in apps_df.iterrows():
                    with st.container():
                        col1, col2 = st.columns([1, 3])
                        with col1:
                            if os.path.exists(app['image_path']):
                                st.image(app['image_path'], width=100)
                        with col2:
                            job_title = jobs_df[jobs_df['id'] == app['job_id']]['title'].iloc[0]
                            st.subheader(f"{app['name']} - {job_title}")
                            st.write(f"Similarity: {app['similarity']:.2f}")
                            with st.expander("View CV"):
                                from utils.cv_processor import extract_text_from_pdf
                                cv_text = extract_text_from_pdf(app['cv_path'])
                                st.text_area("CV Content", cv_text, height=200)
                            if st.button(f"Approve {app['name']}", key=app['id']):
                                st.success("Approved!")
                                from utils.sms import send_sms
                                app_phone = apps_df[apps_df['id'] == app['id']]['phone'].iloc[0]
                                send_sms(app_phone, "Congratulations! Your application has been approved by the VC.")
        elif st.session_state.user_role == "registrar":
            st.subheader("Student Applications")
            if os.path.exists("data/applications.csv"):
                apps_df = pd.read_csv("data/applications.csv")
                st.dataframe(apps_df)