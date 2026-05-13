export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Session from "@/lib/models/session";

// GET single session
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await connectDB();

    const { id } = await params;

    const session = await Session.findById(id);

    if (!session) {
      return NextResponse.json(
        {
          success: false,
          error: "Session not found",
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      session,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch session",
      },
      { status: 500 },
    );
  }
}

// PUT update session messages
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await connectDB();
    const { id } = await params;
    const { messages, title } = await req.json();
    const session = await Session.findByIdAndUpdate(
      id,
      { messages, title },
      { new: true },
    );
    return NextResponse.json({
      success: true,
      session,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to update session",
      },
      { status: 500 },
    );
  }
}

// DELETE session
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await connectDB();
    const { id } = await params;
    await Session.findByIdAndDelete(id);
    return NextResponse.json({
      success: true,
      message: "Session deleted",
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete session",
      },
      { status: 500 },
    );
  }
}
