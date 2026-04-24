import pdfplumber
import spacy
from sklearn.metrics.pairwise import cosine_similarity

def extract_text_from_pdf(pdf_path):
    """Extract text from a PDF file."""
    with pdfplumber.open(pdf_path) as pdf:
        text = ""
        for page in pdf.pages:
            text += page.extract_text() or ""
    return text

def compute_similarity(cv_text, job_text):
    """Compute cosine similarity between CV text and job requirements."""
    nlp = spacy.load('en_core_web_sm')
    cv_doc = nlp(cv_text.lower())
    job_doc = nlp(job_text.lower())
    cv_vector = cv_doc.vector.reshape(1, -1)
    job_vector = job_doc.vector.reshape(1, -1)
    similarity = cosine_similarity(cv_vector, job_vector)[0][0]
    return similarity