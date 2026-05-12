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

// CREATE session
export async function POST(req: NextRequest) {
  try {
    await connectDB();

    const body = await req.json();

    const session = await Session.create({
      title: body.title || "New Chat",
      messages: body.messages || [],
    });

    return NextResponse.json({
      success: true,
      session,
    });
  } catch (error) {
    console.error("CREATE SESSION ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to create session",
      },
      { status: 500 },
    );
  }
}
