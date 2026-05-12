import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Conversation from "@/lib/models/conversation";

export async function GET(req: NextRequest) {
  try {
    await connectDB();

    const { searchParams } = new URL(req.url);
    const range = searchParams.get("range") || "7"; // days
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - parseInt(range));

    const matchDate = { createdAt: { $gte: daysAgo } };

    const total = await Conversation.countDocuments(matchDate);

    const allTime = await Conversation.countDocuments();

    const [high, low, none] = await Promise.all([
      Conversation.countDocuments({ ...matchDate, confidence: "high" }),
      Conversation.countDocuments({ ...matchDate, confidence: "low" }),
      Conversation.countDocuments({ ...matchDate, confidence: "none" }),
    ]);

    const answerRate = total > 0 ? Math.round((high / total) * 100) : 0;

    const perDay = await Conversation.aggregate([
      { $match: matchDate },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          count: { $sum: 1 },
          high: { $sum: { $cond: [{ $eq: ["$confidence", "high"] }, 1, 0] } },
          low: { $sum: { $cond: [{ $eq: ["$confidence", "low"] }, 1, 0] } },
          none: { $sum: { $cond: [{ $eq: ["$confidence", "none"] }, 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const topQuestions = await Conversation.aggregate([
      { $match: matchDate },
      {
        $group: {
          _id: "$question",
          count: { $sum: 1 },
          confidence: { $last: "$confidence" },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 8 },
    ]);

    const categoryBreakdown = await Conversation.aggregate([
      { $match: matchDate },
      { $unwind: { path: "$sources", preserveNullAndEmptyArrays: false } },
      {
        $group: {
          _id: "$sources.category",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 8 },
    ]);

    const unanswered = await Conversation.find({
      ...matchDate,
      confidence: "none",
    })
      .select("question createdAt")
      .sort({ createdAt: -1 })
      .limit(10);

    const hourly = await Conversation.aggregate([
      { $match: matchDate },
      {
        $group: {
          _id: { $hour: "$createdAt" },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return NextResponse.json({
      total,
      allTime,
      answerRate,
      confidence: { high, low, none },
      perDay,
      topQuestions,
      categoryBreakdown,
      unanswered,
      hourly,
      range,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 },
    );
  }
}
