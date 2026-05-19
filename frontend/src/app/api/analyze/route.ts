import { NextRequest, NextResponse } from 'next/server';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const runtime = "nodejs";

function installPdfDomPolyfills() {
  const globalScope = globalThis as any;

  if (!globalScope.DOMMatrix) {
    globalScope.DOMMatrix = class DOMMatrix {
      a = 1;
      b = 0;
      c = 0;
      d = 1;
      e = 0;
      f = 0;

      constructor(init?: number[] | string) {
        if (Array.isArray(init)) {
          [this.a, this.b, this.c, this.d, this.e, this.f] = [
            Number(init[0] ?? 1),
            Number(init[1] ?? 0),
            Number(init[2] ?? 0),
            Number(init[3] ?? 1),
            Number(init[4] ?? 0),
            Number(init[5] ?? 0),
          ];
        }
      }

      multiply() {
        return this;
      }

      translate() {
        return this;
      }

      scale() {
        return this;
      }

      rotate() {
        return this;
      }
    };
  }

  if (!globalScope.ImageData) {
    globalScope.ImageData = class ImageData {
      data: Uint8ClampedArray;
      width: number;
      height: number;

      constructor(data: Uint8ClampedArray | number, width: number, height?: number) {
        this.width = typeof data === "number" ? data : width;
        this.height = typeof data === "number" ? width : Number(height || 0);
        this.data = data instanceof Uint8ClampedArray ? data : new Uint8ClampedArray(this.width * this.height * 4);
      }
    };
  }

  if (!globalScope.Path2D) {
    globalScope.Path2D = class Path2D {};
  }
}

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

    // pdf-parse v2 exposes a PDFParse class instead of the old default function.
    installPdfDomPolyfills();
    const { PDFParse } = await import('pdf-parse');
    const workerPath = join(process.cwd(), "node_modules", "pdf-parse", "dist", "pdf-parse", "esm", "pdf.worker.mjs");
    PDFParse.setWorker(pathToFileURL(workerPath).href);
    const parser = new PDFParse({ data: buffer });
    let cvText = "";
    try {
      const pdfData = await parser.getText();
      cvText = pdfData.text;
    } finally {
      await parser.destroy();
    }

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
