# Pentecost University CV Analyzer

A professional Streamlit-based application for automated CV analysis and job matching at Pentecost University.

## Features

- **User Registration & Login**: Secure account creation and role-based access
- **Job Showcase**: Browse available positions with detailed descriptions
- **Intelligent CV Matching**: AI-powered cosine similarity ranking using spaCy and scikit-learn
- **Application Management**: Upload CVs and photos, track submissions
- **Role-Based Dashboards**:
  - **Admin**: Manage jobs and view all applications
  - **HR**: Review ranked applicants and schedule interviews
  - **VC**: View applicant photos, CVs, and approve candidates
  - **Registrar**: Access student application records
- **SMS Notifications**: Push notifications via Twilio API
- **Video Interviews**: Integrated video calling using streamlit-webrtc

## Screenshots

[Add screenshots here after deployment]

## Local Setup

1. Clone the repository
2. Create a virtual environment: `python -m venv .venv`
3. Activate: `.venv\Scripts\activate` (Windows)
4. Install dependencies: `pip install -r requirements.txt`
5. Download spaCy model: `python -m spacy download en_core_web_sm`
6. Run the app: `streamlit run app.py`

## Deployment on Streamlit Cloud

1. Push this code to a public GitHub repository
2. Visit [share.streamlit.io](https://share.streamlit.io)
3. Connect your GitHub account and select the repository
4. Set the main file path to `app.py`
5. Click Deploy

## Configuration

### Users
Predefined users are in `data/users.csv`. Default passwords are "password" - change them for production.

### SMS Setup
1. Sign up for Twilio account
2. Get Account SID, Auth Token, and phone number
3. Update `utils/sms.py` with your credentials

### Video Calling
Video calling is ready to use with streamlit-webrtc. No additional setup required.

## Project Structure

```
├── app.py                 # Main application
├── requirements.txt       # Dependencies
├── README.md             # This file
├── data/
│   ├── users.csv         # User accounts
│   ├── jobs.csv          # Job listings
│   ├── applications.csv  # Submitted applications
│   ├── cvs/              # Uploaded CVs
│   └── images/           # Uploaded photos
├── pages/                # Legacy pages (integrated into app.py)
└── utils/
    ├── cv_processor.py   # CV text extraction and similarity
    └── sms.py            # SMS notification functions
```

## Technologies Used

- **Streamlit**: Web app framework
- **spaCy**: NLP for CV processing
- **scikit-learn**: Cosine similarity calculation
- **pdfplumber**: PDF text extraction
- **Twilio**: SMS API
- **streamlit-webrtc**: Video calling
- **Pandas**: Data handling

## Contributing

Feel free to submit issues and pull requests.

## License

[Add license if needed]