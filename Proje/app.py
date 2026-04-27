import streamlit as st
import pandas as pd

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
        font-size: 3.5em;
        color: #2E8B57;
        font-weight: bold;
        margin-top: 100px;
        margin-bottom: 50px;
    }
    .button-container {
        display: flex;
        justify-content: center;
        gap: 15px;
        margin-bottom: 40px;
    }
    .search-box {
        display: flex;
        justify-content: center;
        margin-bottom: 30px;
    }
    @keyframes pulse {
        0%, 100% {
            transform: scale(1);
            opacity: 1;
        }
        50% {
            transform: scale(1.1);
            opacity: 0.7;
        }
    }
    @keyframes float {
        0%, 100% {
            transform: translateY(0px);
        }
        50% {
            transform: translateY(-20px);
        }
    }
    @keyframes rotate {
        0% {
            transform: rotate(0deg);
        }
        100% {
            transform: rotate(360deg);
        }
    }
    .animation-container {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 20px;
        margin: 40px 0;
        height: 100px;
    }
    .animated-circle {
        width: 60px;
        height: 60px;
        border-radius: 50%;
        background: linear-gradient(135deg, #2E8B57 0%, #4CAF50 100%);
        animation: pulse 2s ease-in-out infinite;
    }
    .animated-circle:nth-child(2) {
        animation: pulse 2s ease-in-out infinite 0.3s;
        width: 40px;
        height: 40px;
    }
    .animated-circle:nth-child(3) {
        animation: pulse 2s ease-in-out infinite 0.6s;
        width: 60px;
        height: 60px;
    }
    .animated-icon {
        font-size: 48px;
        animation: float 3s ease-in-out infinite;
    }
    .login-background-container {
        position: relative;
        width: 100%;
        height: 600px;
        background: rgba(0, 0, 0, 0.5);
        border-radius: 10px;
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    .login-form-overlay {
        background: rgba(255, 255, 255, 0.95);
        padding: 40px;
        border-radius: 10px;
        width: 100%;
        max-width: 400px;
        backdrop-filter: blur(10px);
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    }
    .login-form-overlay h3 {
        color: #2E8B57;
        text-align: center;
        margin-bottom: 30px;
        font-size: 24px;
        font-weight: bold;
    }
    .login-form-overlay input {
        width: 100%;
        padding: 12px;
        margin-bottom: 15px;
        border: 2px solid #2E8B57;
        border-radius: 5px;
        font-size: 16px;
    }
    .login-form-overlay button {
        width: 100%;
        background-color: #2E8B57;
        color: white;
        padding: 12px;
        margin-bottom: 10px;
        border: none;
        border-radius: 5px;
        font-size: 16px;
        font-weight: bold;
        cursor: pointer;
        transition: background-color 0.3s ease;
    }
    .login-form-overlay button:hover {
        background-color: #1e5f3f;
    }
    .video-background {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        z-index: -1;
    }
    .page-overlay {
        background: rgba(0, 0, 0, 0.4);
        backdrop-filter: blur(3px);
    }
    .login-centered {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        min-height: 100vh;
        padding: 20px;
    }
    .login-form-box {
        background: rgba(255, 255, 255, 0.95);
        padding: 50px;
        border-radius: 15px;
        width: 100%;
        max-width: 450px;
        box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.37);
        backdrop-filter: blur(10px);
    }
    .login-form-box h2 {
        color: #2E8B57;
        text-align: center;
        margin-bottom: 30px;
        font-size: 28px;
        font-weight: bold;
    }
</style>
""", unsafe_allow_html=True)

# Load users and jobs
users_df = pd.read_csv("data/users.csv")
jobs_df = pd.read_csv("data/jobs.csv")

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
    # Initialize session states for showing forms
    if 'show_login' not in st.session_state:
        st.session_state.show_login = False
    if 'show_signup' not in st.session_state:
        st.session_state.show_signup = False
    if 'show_search' not in st.session_state:
        st.session_state.show_search = False
    
    # Main homepage with heading and buttons
    if not st.session_state.show_login and not st.session_state.show_signup and not st.session_state.show_search:
        # Welcome heading
        st.markdown('<h1 class="welcome-header">Welcome to Pentecost University Recruiter</h1>', unsafe_allow_html=True)
        
        # Buttons below heading
        col1, col2, col3, col4, col5 = st.columns([1, 1, 1, 1, 1])
        
        with col2:
            if st.button("🔐 Login", key="btn_login_home", use_container_width=True):
                st.session_state.show_login = True
                st.rerun()
        
        with col3:
            if st.button("📝 Sign Up", key="btn_signup_home", use_container_width=True):
                st.session_state.show_signup = True
                st.rerun()
        
        with col4:
            if st.button("🔍 Search", key="btn_search_home", use_container_width=True):
                st.session_state.show_search = True
                st.rerun()

        st.markdown("""
            <p style="text-align:center; max-width:700px; margin:0 auto 30px auto; color:#444; font-size:18px;">
                Quickly search available jobs by title, skills, or department. Create an account to save applications and track progress.
            </p>
        """, unsafe_allow_html=True)

        search_col1, search_col2 = st.columns([3, 1])
        with search_col1:
            search_query_home = st.text_input("Search jobs or skills", key="home_search_query", placeholder="e.g., Computer Science, Research, Administrative")
        with search_col2:
            if st.button("Search", key="btn_home_search", use_container_width=True):
                if search_query_home:
                    query = search_query_home.lower()
                    results = jobs_df[jobs_df.apply(lambda row: query in str(row['title']).lower() or query in str(row['description']).lower() or query in str(row['requirements']).lower(), axis=1)]
                    if not results.empty:
                        st.success(f"Found {len(results)} matching jobs")
                        for _, job in results.iterrows():
                            st.markdown(f"**{job['title']}**  \n{job['description']}  \nRequirements: {job['requirements']}  \nSalary: ${job['salary']}")
                    else:
                        st.warning("No matching jobs found. Try a broader term.")
                else:
                    st.warning("Please enter a search term")
    
    # Show login form
    if st.session_state.show_login:
        # Back button at top
        if st.button("← Back to Home", key="btn_back_login_top"):
            st.session_state.show_login = False
            st.rerun()
        
        st.markdown("---")
        
        st.markdown("""
            <div style="background: rgba(255, 255, 255, 0.98); padding: 35px; border-radius: 18px; max-width: 520px; margin: 0 auto 30px auto; box-shadow: 0 10px 35px rgba(0, 0, 0, 0.12);">
                <h3 style="color: #2E8B57; text-align: center; margin: 0 0 15px 0; font-size: 28px; font-weight: bold;">Login to Your Account</h3>
                <p style="text-align: center; margin: 0; color: #555; font-size: 16px;">Enter your credentials to manage applications, review jobs, and access personalized recommendations.</p>
            </div>
        """, unsafe_allow_html=True)
        
        col1, col2, col3 = st.columns([1, 1.5, 1])
        with col2:
            username = st.text_input("👤 Username", key="login_username", placeholder="Enter your username")
            password = st.text_input("🔒 Password", type="password", key="login_password", placeholder="Enter your password")
            
            col_login, col_cancel = st.columns(2)
            with col_login:
                if st.button("🔐 Login", key="btn_login_submit", use_container_width=True):
                    login(username, password)
            with col_cancel:
                if st.button("❌ Cancel", key="btn_cancel_login", use_container_width=True):
                    st.session_state.show_login = False
                    st.rerun()
    
    # Show signup form
    elif st.session_state.show_signup:
        st.markdown("### Create New Account")
        new_username = st.text_input("Username", key="signup_username")
        new_email = st.text_input("Email", key="signup_email")
        new_password = st.text_input("Password", type="password", key="signup_password")
        col_btn1, col_btn2 = st.columns([2, 1])
        with col_btn1:
            if st.button("Create Account", key="btn_signup_submit", use_container_width=True):
                create_account(new_username, new_email, new_password)
        with col_btn2:
            if st.button("Back", key="btn_back_signup"):
                st.session_state.show_signup = False
                st.rerun()
    
    # Show search form
    elif st.session_state.show_search:
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