import { connectDB } from "@/lib/mongodb";
import { generateEmbedding } from "@/lib/embeddings";
import Entry, { IEntry } from "./models/entry";

export interface SearchResult {
  question: string;
  answer: string;
  category: string;
  score: number;
}

export interface RAGResult {
  results: SearchResult[];
  confidence: "high" | "low" | "none";
  topScore: number;
  searchType: "vector" | "text";
}

export async function searchKnowledgeBase(query: string): Promise<RAGResult> {
  await connectDB();

  try {
    const queryEmbedding = await generateEmbedding(query);

    const vectorResults = await Entry.aggregate([
      {
        $vectorSearch: {
          index: "vector_index",
          path: "embedding",
          queryVector: queryEmbedding,
          numCandidates: 10,
          limit: 3,
        },
      },
      {
        $addFields: {
          score: { $meta: "vectorSearchScore" },
        },
      },
    ]);

    if (vectorResults.length > 0) {
      const mapped: SearchResult[] = vectorResults.map((entry) => ({
        question: entry.question,
        answer: entry.answer,
        category: entry.category,
        score: entry.score,
      }));

      const topScore = mapped[0].score;

      let confidence: "high" | "low" | "none";
      if (topScore >= 0.85) {
        confidence = "high";
      } else if (topScore >= 0.70) {
        confidence = "low";
      } else {
        confidence = "none";
      }

      return { results: mapped, confidence, topScore, searchType: "vector" };
    }
  } catch (err) {
    console.log("Vector search failed, falling back to text search", err);
  }

  // Step 2 — Fallback to text search
  const textResults = await Entry.find(
    { $text: { $search: query } },
    { score: { $meta: "textScore" } },
  )
    .sort({ score: { $meta: "textScore" } })
    .limit(3)
    .lean<IEntry[]>();

  const mapped: SearchResult[] = textResults.map((entry) => ({
    question: entry.question,
    answer: entry.answer,
    category: entry.category,
    score: (entry as any).score,
  }));

  const topScore = mapped.length > 0 ? mapped[0].score : 0;

  let confidence: "high" | "low" | "none";
  if (topScore >= 0.5) {
    confidence = "high";
  } else if (topScore >= 0.3) {
    confidence = "low";
  } else {
    confidence = "none";
  }

  return { results: mapped, confidence, topScore, searchType: "text" };
}
