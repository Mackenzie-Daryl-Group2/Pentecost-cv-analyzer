import streamlit as st
import pandas as pd
import os
import uuid
from datetime import datetime
from utils.cv_processor import extract_text_from_pdf, compute_similarity

st.title("Apply for Job")

if 'selected_job' not in st.session_state:
    st.error("Please select a job first.")
    st.stop()

job_id = st.session_state.selected_job

# Load job details
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
        # Generate unique ID
        app_id = str(uuid.uuid4())

        # Save files
        cv_path = f"data/cvs/{app_id}.pdf"
        os.makedirs("data/cvs", exist_ok=True)
        with open(cv_path, "wb") as f:
            f.write(cv_file.getbuffer())

        image_path = f"data/images/{app_id}.jpg"
        os.makedirs("data/images", exist_ok=True)
        with open(image_path, "wb") as f:
            f.write(photo_file.getbuffer())

        # Extract CV text and compute similarity
        cv_text = extract_text_from_pdf(cv_path)
        job_req = job['requirements']
        similarity = compute_similarity(cv_text, job_req)

        # Save to CSV
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

        # TODO: Send SMS notification