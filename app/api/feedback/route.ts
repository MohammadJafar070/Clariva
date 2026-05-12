export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Conversation from "@/lib/models/conversation";

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const { question, answer, feedback } = await req.json();

    // Find the most recent conversation with this questionF
    const conversation = await Conversation.findOneAndUpdate(
      { question },
      { $set: { feedback } },
      { new: true, sort: { createdAt: -1 } },
    );

    return NextResponse.json({ success: true, conversation });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to save feedback" },
      { status: 500 },
    );
  }
}
