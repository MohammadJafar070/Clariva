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
