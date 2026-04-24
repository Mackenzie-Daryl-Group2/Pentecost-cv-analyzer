import streamlit as st
import pandas as pd
import os

st.title("HR Dashboard")

st.subheader("All Applications")
if os.path.exists("data/applications.csv"):
    apps_df = pd.read_csv("data/applications.csv")
    # Sort by similarity descending
    apps_df = apps_df.sort_values('similarity', ascending=False)
    st.dataframe(apps_df)

    # Select an applicant for interview
    selected_app = st.selectbox("Select Applicant for Interview", apps_df['id'].tolist())
    if st.button("Schedule Interview"):
        # TODO: Schedule interview, send SMS
        st.success("Interview scheduled.")
else:
    st.write("No applications yet.")