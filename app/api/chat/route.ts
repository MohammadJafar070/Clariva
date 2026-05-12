import { NextRequest } from "next/server";
import Groq from "groq-sdk";
import Conversation from "@/lib/models/conversation";
import { connectDB } from "@/lib/mongodb";
import { rateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

interface HistoryMessage {
  role: "user" | "assistant";
  content: string;
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") || "unknown";

    const allowed = rateLimit(ip, 20, 60000);

    if (!allowed) {
      return new Response(
        JSON.stringify({
          error: "Too many requests",
        }),
        { status: 429 },
      );
    }

    await connectDB();

    const {
      question,
      history = [],
    }: {
      question: string;
      history: HistoryMessage[];
    } = await req.json();

    if (!question) {
      return new Response(
        JSON.stringify({
          error: "Question is required",
        }),
        { status: 400 },
      );
    }

    const encoder = new TextEncoder();

    const messages = [
      {
        role: "system" as const,
        content:
          "You are a helpful AI support assistant. Give concise and accurate answers.",
      },

      ...history.map((h) => ({
        role: h.role,
        content: h.content,
      })),

      {
        role: "user" as const,
        content: question,
      },
    ];

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const groqStream = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages,
            stream: true,
            max_tokens: 512,
          });

          let fullAnswer = "";

          for await (const chunk of groqStream) {
            const text = chunk.choices?.[0]?.delta?.content || "";

            if (text) {
              fullAnswer += text;

              controller.enqueue(
                encoder.encode(
                  JSON.stringify({
                    type: "text",
                    data: text,
                  }) + "\n",
                ),
              );
            }
          }

          // Save conversation
          try {
            await Conversation.create({
              question,
              answer: fullAnswer,
              confidence: "general",
              topScore: 0,
              sources: [],
            });
          } catch (dbErr) {
            console.error("DB SAVE ERROR:", dbErr);
          }

          // Suggestions
          try {
            const suggest = await groq.chat.completions.create({
              model: "llama-3.3-70b-versatile",
              messages: [
                {
                  role: "user",
                  content: `
Suggest 3 short follow-up questions.

Return ONLY a JSON array.

Question:
${question}

Answer:
${fullAnswer.substring(0, 200)}
                    `,
                },
              ],
              max_tokens: 100,
            });

            const raw = suggest.choices?.[0]?.message?.content || "[]";

            const cleaned = raw
              .replace(/```json/g, "")
              .replace(/```/g, "")
              .trim();

            let suggestions: string[] = [];

            try {
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
            console.error("Suggestions error:", err);
          }
        } catch (err) {
          console.error("STREAM ERROR:", err);

          controller.enqueue(
            encoder.encode(
              JSON.stringify({
                type: "error",
                data: "Chat failed",
              }) + "\n",
            ),
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("CHAT API ERROR:", error);

    return new Response(
      JSON.stringify({
        error: "Internal server error",
      }),
      { status: 500 },
    );
  }
}
