import mongoose, { Schema, Document } from "mongoose";

export interface IEntry extends Document {
  _id: mongoose.Types.ObjectId;
  question: string;
  answer: string;
  category: string;
  embedding: number[];
  createdAt: Date;
  updatedAt: Date;
}

const EntrySchema = new Schema<IEntry>(
  {
    question: {
      type: String,
      required: true,
      trim: true,
    },
    answer: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
      default: "General",
    },
    embedding: {
      type: [Number],
      default: [],
    },
  },
  { timestamps: true },
);

EntrySchema.index({ question: "text", answer: "text" });

const Entry =
  mongoose.models.Entry || mongoose.model<IEntry>("Entry", EntrySchema);

export default Entry;
