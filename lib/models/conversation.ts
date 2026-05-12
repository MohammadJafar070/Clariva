import mongoose, { Schema, Document, Model } from "mongoose";

export interface IConversation extends Document {
  question: string;
  answer: string;
  confidence: "high" | "low" | "none";
  topScore: number;
  feedback?: "good" | "bad" | null;
  sources: {
    question: string;
    answer: string;
    category: string;
    score: number;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

const ConversationSchema = new Schema<IConversation>(
  {
    question: { type: String, required: true },
    answer: { type: String, required: true },
    confidence: {
      type: String,
      enum: ["high", "low", "none"],
      required: true,
    },
    topScore: { type: Number, default: 0 },
    feedback: {
      type: String,
      enum: ["good", "bad", null],
      default: null,
    },
    sources: [
      {
        question: String,
        answer: String,
        category: String,
        score: Number,
      },
    ],
  },
  { timestamps: true },
);

const Conversation =
  mongoose.models?.Conversation ??
  mongoose.model("Conversation", ConversationSchema);

export default Conversation;
