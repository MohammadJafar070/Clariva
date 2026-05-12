import mongoose, { Schema, Document } from "mongoose";

export interface IMessage {
  role: "user" | "assistant";
  content: string;
  answerMode?: "knowledge_base" | "hybrid" | "general";
  confidence?: "high" | "low" | "none";
}

export interface ISession extends Document {
  _id: mongoose.Types.ObjectId;
  title: string;
  messages: IMessage[];
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema = new Schema<IMessage>({
  role: { type: String, enum: ["user", "assistant"], required: true },
  content: { type: String, required: true },
  answerMode: { type: String, enum: ["knowledge_base", "hybrid", "general"] },
  confidence: { type: String, enum: ["high", "low", "none"] },
});

const SessionSchema = new Schema<ISession>(
  {
    title: { type: String, default: "New Chat" },
    messages: [MessageSchema],
  },
  { timestamps: true },
);

const Session =
  mongoose.models.Session || mongoose.model<ISession>("Session", SessionSchema);

export default Session;
