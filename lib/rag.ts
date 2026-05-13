import { connectDB } from "@/lib/mongodb";
import Entry, { IEntry } from "@/lib/models/entry";

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
  searchType: "text";
}

export async function searchKnowledgeBase(query: string): Promise<RAGResult> {
  await connectDB();

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
  if (topScore >= 1) {
    confidence = "high";
  } else if (topScore >= 0.5) {
    confidence = "low";
  } else {
    confidence = "none";
  }

  return { results: mapped, confidence, topScore, searchType: "text" };
}
