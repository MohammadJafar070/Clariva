import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Conversation from "@/lib/models/conversation";

export async function GET() {
  try {
    await connectDB();
    const conversations = await Conversation.find()
      .sort({ createdAt: -1 })
      .limit(50);
    return NextResponse.json(conversations);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch conversations" },
      { status: 500 },
    );
  }
}
