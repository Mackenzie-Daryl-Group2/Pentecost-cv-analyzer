import streamlit as st
import pandas as pd
import os

st.title("Registrar Dashboard")

st.subheader("Student Applications")
if os.path.exists("data/applications.csv"):
    apps_df = pd.read_csv("data/applications.csv")
    st.dataframe(apps_df)
else:
    st.write("No applications yet.")

# TODO: Additional registrar functions