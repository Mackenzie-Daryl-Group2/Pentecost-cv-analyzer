from fastapi import FastAPI, UploadFile, File, Form
from typing import Optional
import pdfplumber
import spacy
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.feature_extraction.text import TfidfVectorizer
import io

app = FastAPI()

_NLP = None

def get_nlp():
    global _NLP
    if _NLP is not None:
        return _NLP
    try:
        # Try loading the model, fallback to blank if not found
        _NLP = spacy.load("en_core_web_sm")
    except Exception:
        _NLP = spacy.blank("en")
    return _NLP

def extract_text_from_pdf(file_bytes):
    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        text = ""
        for page in pdf.pages:
            text += page.extract_text() or ""
    return text

@app.post("/api/analyze")
async def analyze_cv(
    cv_file: UploadFile = File(...),
    job_description: str = Form(...)
):
    try:
        cv_bytes = await cv_file.read()
        cv_text = extract_text_from_pdf(cv_bytes)
        
        cv_text_clean = (cv_text or "").strip().lower()
        job_text_clean = (job_description or "").strip().lower()
        
        if not cv_text_clean or not job_text_clean:
            return {"similarity": 0.0, "error": "Empty text detected"}

        nlp = get_nlp()
        cv_doc = nlp(cv_text_clean)
        job_doc = nlp(job_text_clean)

        # Compute similarity
        # Fallback to TF-IDF if vectors are missing
        has_vectors = getattr(nlp.vocab, "vectors_length", 0) > 0
        if has_vectors and cv_doc.vector.any() and job_doc.vector.any():
            cv_vector = cv_doc.vector.reshape(1, -1)
            job_vector = job_doc.vector.reshape(1, -1)
            similarity = float(cosine_similarity(cv_vector, job_vector)[0][0])
        else:
            tfidf = TfidfVectorizer(stop_words="english")
            matrix = tfidf.fit_transform([cv_text_clean, job_text_clean])
            similarity = float(cosine_similarity(matrix[0:1], matrix[1:2])[0][0])

        return {
            "similarity": similarity,
            "cv_text_preview": cv_text[:500] + "..." if len(cv_text) > 500 else cv_text,
            "status": "success"
        }
    except Exception as e:
        return {"error": str(e), "status": "failed"}

# Entry point for Vercel
@app.get("/api/health")
def health_check():
    return {"status": "healthy"}
