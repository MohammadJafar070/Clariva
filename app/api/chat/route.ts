import { NextRequest } from "next/server";
import Groq from "groq-sdk";
import { searchKnowledgeBase } from "@/lib/rag";
import Conversation from "@/lib/models/conversation";
import { generateEmbedding } from "@/lib/embeddings";
import Entry from "@/lib/models/entry";
import { rateLimit } from "@/lib/rateLimit";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

interface HistoryMessage {
  role: "user" | "assistant";
  content: string;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") || "unknown";
  const allowed = rateLimit(ip, 20, 60000); // 20 requests per minute

  if (!allowed) {
    return new Response(
      JSON.stringify({ error: "Too many requests. Please wait a moment." }),
      { status: 429 },
    );
  }
  try {
    const {
      question,
      history = [],
    }: { question: string; history: HistoryMessage[] } = await req.json();

    if (!question) {
      return new Response(JSON.stringify({ error: "Question is required" }), {
        status: 400,
      });
    }

    const { results, confidence, topScore } =
      await searchKnowledgeBase(question);

    const encoder = new TextEncoder();

    let systemPrompt = "";
    let answerMode: "knowledge_base" | "hybrid" | "general" = "general";

    if (confidence === "high") {
      answerMode = "knowledge_base";
      const context = results
        .map(
          (r, i) =>
            `Source ${i + 1} [${r.category}]:
         Q: ${r.question}
         A: ${r.answer}`,
        )
        .join("\n\n");

      systemPrompt = `You are a helpful customer support assistant.
Use the knowledge base below to answer the customer's question.
If the knowledge base does NOT contain enough information to fully answer the question, use your general knowledge to give a complete answer.
Never say "not in my knowledge base" — always try to give a helpful answer.
Keep conversation history in mind for follow-up questions.

KNOWLEDGE BASE:
${context}`;
    } else if (confidence === "low") {
      answerMode = "hybrid";
      const context = results
        .map(
          (r, i) =>
            `Source ${i + 1} [${r.category}]:
         Q: ${r.question}
         A: ${r.answer}`,
        )
        .join("\n\n");

      systemPrompt = `You are a helpful customer support assistant.
You have some partial information from the knowledge base below.
Use it combined with your general knowledge to give a complete and accurate answer.
Be helpful and thorough.
Keep conversation history in mind for follow-up questions.

PARTIAL KNOWLEDGE BASE:
${context}`;
    } else {
      answerMode = "general";
      systemPrompt = `You are a helpful customer support assistant with broad general knowledge.
Answer the customer's question accurately and completely using your general knowledge.
Be helpful, clear and thorough.
At the end add on a new line: "💡 For accurate company-specific information, contact support@company.com"
Keep conversation history in mind for follow-up questions.`;
    }

    const messages = [
      ...history.map((h) => ({ role: h.role, content: h.content })),
      { role: "user" as const, content: question },
    ];

    const stream = new ReadableStream({
      async start(controller) {
        try {
          controller.enqueue(
            encoder.encode(
              JSON.stringify({
                type: "sources",
                data: results,
                confidence,
                topScore,
                answerMode,
              }) + "\n",
            ),
          );

          const groqStream = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [{ role: "system", content: systemPrompt }, ...messages],
            max_tokens: 512,
            stream: true,
          });

          let fullAnswer = "";

          for await (const chunk of groqStream) {
            const text = chunk.choices[0]?.delta?.content || "";
            if (text) {
              fullAnswer += text;
              controller.enqueue(
                encoder.encode(
                  JSON.stringify({ type: "text", data: text }) + "\n",
                ),
              );
              await new Promise((resolve) => setTimeout(resolve, 20));
            }
          }

          // Save to conversations
          await Conversation.create({
            question,
            answer: fullAnswer,
            confidence,
            topScore,
            sources: results,
          });

          // Auto-save to knowledge base if general AI answer
          if (answerMode === "general" || answerMode === "hybrid") {
            console.log("🔍 Attempting auto-save for:", question);

            const noteIndex = fullAnswer.indexOf("💡");
            const cleanAnswer =
              noteIndex !== -1
                ? fullAnswer.substring(0, noteIndex).trim()
                : fullAnswer.trim();

            console.log("📝 Clean answer length:", cleanAnswer.length);

            try {
              const embedding = await generateEmbedding(question);
              console.log("✅ Embedding generated, length:", embedding.length);

              const existing = await Entry.findOne({
                question: { $regex: question, $options: "i" },
              });

              console.log("🔎 Existing entry found:", !!existing);

              if (!existing) {
                const saved = await Entry.create({
                  question,
                  answer: cleanAnswer,
                  category: "Auto-generated",
                  embedding,
                });

                console.log("💾 Saved to DB:", saved._id);

                controller.enqueue(
                  encoder.encode(
                    JSON.stringify({
                      type: "auto_saved",
                      data: { question, category: "Auto-generated" },
                    }) + "\n",
                  ),
                );
              } else {
                console.log("⏭️ Skipped — entry already exists");
              }
            } catch (err) {
              console.error("❌ Auto-save failed:", err);
            }
          }
          let suggestions: string[] = [];
          try {
            const suggestResponse = await groq.chat.completions.create({
              model: "llama-3.3-70b-versatile",
              messages: [
                {
                  role: "user",
                  content: `Based on this Q&A, suggest 3 short follow-up questions the user might ask next.
Return ONLY a JSON array of strings. No explanation.
Q: ${question}
A: ${fullAnswer.substring(0, 200)}
Example: ["How do I apply?", "What are the fees?", "Can I cancel?"]`,
                },
              ],
              max_tokens: 150,
            });
            const raw = suggestResponse.choices[0].message.content || "[]";
            const cleaned = raw.replace(/```json|```/g, "").trim();
            suggestions = JSON.parse(cleaned);
          } catch {
            suggestions = [];
          }
          if (suggestions.length > 0) {
            controller.enqueue(
              encoder.encode(
                JSON.stringify({
                  type: "suggestions",
                  data: suggestions,
                }) + "\n",
              ),
            );
          }
        } catch (err) {
          console.error("Stream error:", err);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: "Something went wrong" }), {
      status: 500,
    });
  }
}
