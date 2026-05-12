import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Session from "@/lib/models/session";

export async function GET() {
  try {
    await connectDB();

    const sessions = await Session.find()
      .select("title createdAt updatedAt messages")
      .sort({ updatedAt: -1 })
      .limit(30)
      .lean();

    return NextResponse.json({
      sessions: sessions || [],
    });
  } catch (error) {
    console.error("SESSIONS ERROR:", error);

    return NextResponse.json({
      sessions: [],
      error: "Failed to fetch sessions",
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    console.log("POST /api/sessions");

    await connectDB();

    const body = await req.json();

    console.log("BODY:", JSON.stringify(body));

    const messages = Array.isArray(body.messages)
      ? body.messages.filter(
          (m: any) =>
            m &&
            (m.role === "user" || m.role === "assistant") &&
            typeof m.content === "string",
        )
      : [];

    const session = await Session.create({
      title: typeof body.title === "string" ? body.title : "New Chat",
      messages,
    });

    return NextResponse.json({
      success: true,
      session,
    });
  } catch (error: any) {
    console.error("SESSION CREATE ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || "Unknown error",
      },
      { status: 500 },
    );
  }
}
