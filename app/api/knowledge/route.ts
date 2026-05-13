export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Entry, { IEntry } from "@/lib/models/entry";

export async function GET() {
  try {
    await connectDB();
    const entries = await Entry.find().sort({ createdAt: -1 });
    return NextResponse.json(entries, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch entries" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const body: Partial<IEntry> = await req.json();
    const { question, answer, category } = body;

    if (!question || !answer) {
      return NextResponse.json(
        { error: "Question and answer are required" },
        { status: 400 },
      );
    }

    const entry = await Entry.create({ question, answer, category });
    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create entry" },
      { status: 500 },
    );
  }
}
