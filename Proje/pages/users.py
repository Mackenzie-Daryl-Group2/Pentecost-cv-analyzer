import streamlit as st
import pandas as pd
import os

st.title("User Profiles")

# Assume user is logged in, for demo, show all or ask for email
email = st.text_input("Enter your email to view applications")

if email:
    if os.path.exists("data/applications.csv"):
        apps_df = pd.read_csv("data/applications.csv")
        user_apps = apps_df[apps_df['email'] == email]
        if not user_apps.empty:
            st.dataframe(user_apps)
        else:
            st.write("No applications found.")
    else:
        st.write("No applications yet.")
else:
    st.write("Please enter your email.")