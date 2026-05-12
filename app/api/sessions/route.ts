import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Session from "@/lib/models/session";

export const runtime = "nodejs";

// GET sessions
export async function GET() {
  try {
    await connectDB();

    const sessions = await Session.find({})
      .sort({ updatedAt: -1 })
      .limit(30)
      .lean();

    return NextResponse.json({
      success: true,
      sessions,
    });
  } catch (error: any) {
    console.error("GET SESSION ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 },
    );
  }
}

// CREATE session
export async function POST(req: NextRequest) {
  try {
    console.log("POST /api/sessions");

    await connectDB();

    const body = await req.json();

    console.log("BODY:", body);

    // SAFE VALIDATION
    const title = typeof body.title === "string" ? body.title : "New Chat";

    const messages = Array.isArray(body.messages)
      ? body.messages.filter(
          (m: any) =>
            m &&
            (m.role === "user" || m.role === "assistant") &&
            typeof m.content === "string",
        )
      : [];

    console.log("VALIDATED");

    const session = await Session.create({
      title,
      messages,
    });

    console.log("SESSION CREATED");

    return NextResponse.json({
      success: true,
      session,
    });
  } catch (error: any) {
    console.error("POST SESSION ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        error: error.message,
        stack: error.stack,
      },
      { status: 500 },
    );
  }
}
