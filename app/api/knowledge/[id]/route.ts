import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Entry from "@/lib/models/entry";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await connectDB();
    const { id } = await params;
    console.log("Deleting:", id);

    const entry = await Entry.findByIdAndDelete(id);
    console.log("Result:", entry);

    if (!entry) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Entry deleted" }, { status: 200 });
  } catch (error) {
    console.error("Delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete entry" },
      { status: 500 },
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await connectDB();
    const { id } = await params; 

    const body = await req.json();
    const { question, answer, category } = body;

    if (!question || !answer) {
      return NextResponse.json(
        { error: "Question and answer are required" },
        { status: 400 },
      );
    }

    const entry = await Entry.findByIdAndUpdate(
      id,
      { question, answer, category },
      { new: true },
    );

    if (!entry) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    return NextResponse.json(entry, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update entry" },
      { status: 500 },
    );
  }
}
