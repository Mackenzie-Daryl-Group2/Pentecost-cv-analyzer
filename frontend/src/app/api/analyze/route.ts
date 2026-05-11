import { NextRequest, NextResponse } from 'next/server';


// Helper function to extract words and compute term frequency
function getTermFrequency(text: string) {
  // Remove common stop words for better matching
  const stopWords = new Set(["i", "me", "my", "myself", "we", "our", "ours", "ourselves", "you", "your", "yours", "yourself", "yourselves", "he", "him", "his", "himself", "she", "her", "hers", "herself", "it", "its", "itself", "they", "them", "their", "theirs", "themselves", "what", "which", "who", "whom", "this", "that", "these", "those", "am", "is", "are", "was", "were", "be", "been", "being", "have", "has", "had", "having", "do", "does", "did", "doing", "a", "an", "the", "and", "but", "if", "or", "because", "as", "until", "while", "of", "at", "by", "for", "with", "about", "against", "between", "into", "through", "during", "before", "after", "above", "below", "to", "from", "up", "down", "in", "out", "on", "off", "over", "under", "again", "further", "then", "once", "here", "there", "when", "where", "why", "how", "all", "any", "both", "each", "few", "more", "most", "other", "some", "such", "no", "nor", "not", "only", "own", "same", "so", "than", "too", "very", "s", "t", "can", "will", "just", "don", "should", "now"]);
  
  const words = text.toLowerCase().match(/\b[a-z]{2,}\b/g) || [];
  const tf: Record<string, number> = {};
  
  words.forEach(word => {
    if (!stopWords.has(word)) {
      tf[word] = (tf[word] || 0) + 1;
    }
  });
  
  return tf;
}

// Compute Cosine Similarity between two term frequency dictionaries
function computeCosineSimilarity(text1: string, text2: string) {
  const tf1 = getTermFrequency(text1);
  const tf2 = getTermFrequency(text2);
  
  const allWords = new Set([...Object.keys(tf1), ...Object.keys(tf2)]);
  let dotProduct = 0;
  let mag1 = 0;
  let mag2 = 0;
  
  for (const word of allWords) {
    const v1 = tf1[word] || 0;
    const v2 = tf2[word] || 0;
    dotProduct += v1 * v2;
    mag1 += v1 * v1;
    mag2 += v2 * v2;
  }
  
  if (mag1 === 0 || mag2 === 0) return 0;
  return dotProduct / (Math.sqrt(mag1) * Math.sqrt(mag2));
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const cvFile = formData.get('cv_file') as File;
    const jobDescription = formData.get('job_description') as string;

    if (!cvFile || !jobDescription) {
      return NextResponse.json({ error: "Missing CV file or job description", similarity: 0 }, { status: 400 });
    }

    // Convert the uploaded file to a Buffer for pdf-parse
    const arrayBuffer = await cvFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Extract text from PDF using dynamic import to bypass Turbopack CJS issues
    const pdfParseModule = await import('pdf-parse');
    const pdfParse = (pdfParseModule as any).default || pdfParseModule;
    const pdfData = await pdfParse(buffer);
    const cvText = pdfData.text;

    const cvTextClean = (cvText || "").trim();
    const jobTextClean = (jobDescription || "").trim();

    if (!cvTextClean || !jobTextClean) {
      return NextResponse.json({ similarity: 0.0, error: "Empty text detected" });
    }

    // Compute similarity using our custom TF-IDF/Cosine Similarity implementation
    const similarity = computeCosineSimilarity(cvTextClean, jobTextClean);

    return NextResponse.json({
      similarity: similarity,
      status: "success"
    });

  } catch (error: any) {
    console.error("Analysis Error:", error);
    return NextResponse.json({ error: error.message || "An error occurred", status: "failed" }, { status: 500 });
  }
}
