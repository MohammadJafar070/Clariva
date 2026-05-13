export const runtime = "nodejs";
import { NextRequest } from "next/server";
import Groq from "groq-sdk";
import { searchKnowledgeBase } from "@/lib/rag";
import Conversation from "@/lib/models/conversation";
import Entry from "@/lib/models/entry";
import { rateLimit } from "@/lib/rateLimit";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

interface HistoryMessage {
  role: "user" | "assistant";
  content: string;
}

const greetings = [
  "hello",
  "hi",
  "hey",
  "hii",
  "helo",
  "good morning",
  "good evening",
  "good afternoon",
  "how are you",
  "whats up",
  "what's up",
  "sup",
];

export async function POST(req: NextRequest) {
  try {
    const {
      question,
      history = [],
    }: {
      question: string;
      history: HistoryMessage[];
    } = await req.json();

    if (!question) {
      return new Response(JSON.stringify({ error: "Question is required" }), {
        status: 400,
      });
    }

    const ip =
      req.headers.get("x-forwarded-for") ||
      req.headers.get("x-real-ip") ||
      "unknown";
    const allowed = rateLimit(ip, 20, 60000);
    if (!allowed) {
      return new Response(
        JSON.stringify({ error: "Too many requests. Please wait a moment." }),
        { status: 429 },
      );
    }

    const encoder = new TextEncoder();

    const isGreeting = greetings.some(
      (g) => question.toLowerCase().trim() === g,
    );

    if (isGreeting) {
      const greetingStream = new ReadableStream({
        async start(controller) {
          controller.enqueue(
            encoder.encode(
              JSON.stringify({
                type: "sources",
                data: [],
                confidence: "high",
                answerMode: "knowledge_base",
              }) + "\n",
            ),
          );
          const responses = [
            "Hello! 👋 How can I help you today?",
            "Hi there! What can I assist you with?",
            "Hey! Feel free to ask me anything about our products or services.",
          ];
          const response =
            responses[Math.floor(Math.random() * responses.length)];
          for (const char of response) {
            controller.enqueue(
              encoder.encode(
                JSON.stringify({ type: "text", data: char }) + "\n",
              ),
            );
            await new Promise((resolve) => setTimeout(resolve, 18));
          }
          controller.close();
        },
      });
      return new Response(greetingStream, {
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    const { results, confidence, topScore } =
      await searchKnowledgeBase(question);

    let systemPrompt = "";
    let answerMode: "knowledge_base" | "hybrid" | "general" = "general";

    if (confidence === "high") {
      answerMode = "knowledge_base";
      const context = results
        .map(
          (r, i) =>
            `Source ${i + 1} [${r.category}]:\nQ: ${r.question}\nA: ${r.answer}`,
        )
        .join("\n\n");
      systemPrompt = `You are a helpful customer support assistant.
Use the knowledge base below to answer accurately and completely.
If the knowledge base does NOT contain enough information, use your general knowledge.
Never say "not in my knowledge base" — always give a helpful answer.
Keep conversation history in mind for follow-up questions.

KNOWLEDGE BASE:
${context}`;
    } else if (confidence === "low") {
      answerMode = "hybrid";
      const context = results
        .map(
          (r, i) =>
            `Source ${i + 1} [${r.category}]:\nQ: ${r.question}\nA: ${r.answer}`,
        )
        .join("\n\n");
      systemPrompt = `You are a helpful customer support assistant.
Use the partial knowledge base below combined with your general knowledge to give a complete answer.
Keep conversation history in mind for follow-up questions.

PARTIAL KNOWLEDGE BASE:
${context}`;
    } else {
      answerMode = "general";
      systemPrompt = `You are a helpful customer support assistant with broad general knowledge.
Answer accurately and completely using your general knowledge.
At the end add: "💡 For accurate company-specific information, contact support@company.com"
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
            max_tokens: 1024,
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

          // Save conversation
          await Conversation.create({
            question,
            answer: fullAnswer,
            confidence,
            topScore,
            sources: results,
          });

          // Auto-save to knowledge base if general/hybrid
          if (answerMode === "general" || answerMode === "hybrid") {
            try {
              const noteIndex = fullAnswer.indexOf("💡");
              const cleanAnswer =
                noteIndex !== -1
                  ? fullAnswer.substring(0, noteIndex).trim()
                  : fullAnswer.trim();

              const existing = await Entry.findOne({
                question: { $regex: question, $options: "i" },
              });

              if (!existing) {
                await Entry.create({
                  question,
                  answer: cleanAnswer,
                  category: "Auto-generated",
                });

                controller.enqueue(
                  encoder.encode(
                    JSON.stringify({
                      type: "auto_saved",
                      data: { question, category: "Auto-generated" },
                    }) + "\n",
                  ),
                );
              }
            } catch (err) {
              console.error("Auto-save failed:", err);
            }
          }

          // Generate follow-up suggestions
          let suggestions: string[] = [];
          try {
            const suggestResponse = await groq.chat.completions.create({
              model: "llama-3.3-70b-versatile",
              messages: [
                {
                  role: "user",
                  content: `Based on this Q&A, suggest 3 short follow-up questions.
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
                JSON.stringify({ type: "suggestions", data: suggestions }) +
                  "\n",
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
