import streamlit as st
import pandas as pd
import os
from utils.cv_processor import extract_text_from_pdf

st.title("VC Dashboard")

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
                st.write(f"Email: {app['email']}")
                st.write(f"Similarity: {app['similarity']:.2f}")
                with st.expander("View CV"):
                    cv_text = extract_text_from_pdf(app['cv_path'])
                    st.text_area("CV Content", cv_text, height=200)
                if st.button(f"Approve {app['name']}", key=app['id']):
                    st.success("Approved!")
else:
    st.write("No applications yet.")