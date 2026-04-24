import streamlit as st
import pandas as pd

st.title("Job Showcase")

jobs_df = pd.read_csv("data/jobs.csv")

for _, job in jobs_df.iterrows():
    with st.container():
        st.subheader(job['title'])
        st.write(f"**Description:** {job['description']}")
        st.write(f"**Requirements:** {job['requirements']}")
        st.write(f"**Salary:** ${job['salary']}")
        if st.button(f"Apply for {job['title']}", key=int(job['id'])):
            st.session_state.selected_job = job['id']
            st.switch_page("pages/apply.py")