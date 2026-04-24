import streamlit as st
import pandas as pd

st.title("Admin Dashboard")

st.subheader("Applications")
if os.path.exists("data/applications.csv"):
    apps_df = pd.read_csv("data/applications.csv")
    st.dataframe(apps_df)
else:
    st.write("No applications yet.")

st.subheader("Jobs")
jobs_df = pd.read_csv("data/jobs.csv")
st.dataframe(jobs_df)

# TODO: Add functionality to add/edit jobs