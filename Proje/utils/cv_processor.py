import pdfplumber
import spacy
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.feature_extraction.text import TfidfVectorizer


_NLP = None


def _get_nlp():
    """Load spaCy model once; fallback to blank English tokenizer."""
    global _NLP
    if _NLP is not None:
        return _NLP
    try:
        _NLP = spacy.load("en_core_web_sm")
    except OSError:
        _NLP = spacy.blank("en")
    return _NLP

def extract_text_from_pdf(pdf_path):
    """Extract text from a PDF file."""
    with pdfplumber.open(pdf_path) as pdf:
        text = ""
        for page in pdf.pages:
            text += page.extract_text() or ""
    return text

def compute_similarity(cv_text, job_text):
    """Compute cosine similarity between CV text and job requirements."""
    cv_text = (cv_text or "").strip().lower()
    job_text = (job_text or "").strip().lower()
    if not cv_text or not job_text:
        return 0.0

    nlp = _get_nlp()
    cv_doc = nlp(cv_text)
    job_doc = nlp(job_text)

    # Use spaCy vectors when available; otherwise fallback to TF-IDF cosine.
    has_vectors = getattr(nlp.vocab, "vectors_length", 0) > 0
    if has_vectors and cv_doc.vector.any() and job_doc.vector.any():
        cv_vector = cv_doc.vector.reshape(1, -1)
        job_vector = job_doc.vector.reshape(1, -1)
        return float(cosine_similarity(cv_vector, job_vector)[0][0])

    tfidf = TfidfVectorizer(stop_words="english")
    matrix = tfidf.fit_transform([cv_text, job_text])
    return float(cosine_similarity(matrix[0:1], matrix[1:2])[0][0])