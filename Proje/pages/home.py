import streamlit as st

st.title("Welcome to Pentecost University CV Analyzer")
st.write("An automated system for CV analysis and job matching.")

st.markdown("""
### Features:
- **Job Showcase**: Browse available positions
- **Apply for Jobs**: Submit your CV and application
- **Admin Dashboard**: Manage the system
- **HR Dashboard**: Review applicants
- **VC Dashboard**: View applicant details
- **Registrar Dashboard**: Manage student records
- **User Profiles**: View and edit profiles
""")

if st.button("Get Started"):
    st.switch_page("pages/jobs.py")