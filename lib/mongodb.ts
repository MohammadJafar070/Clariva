import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;

let cached = (global as any).mongoose;

if (!cached) {
  cached = (global as any).mongoose = { conn: null, promise: null };
}

export async function connectDB() {
  try {
    if (!MONGODB_URI) {
      console.warn("MONGODB_URI missing");
      return null;
    }

    if (cached.conn) return cached.conn;

    if (!cached.promise) {
      cached.promise = mongoose.connect(MONGODB_URI).then((m) => m.connection);
    }

    cached.conn = await cached.promise;
    return cached.conn;
  } catch (err) {
    console.error("DB CONNECTION ERROR:", err);
    return null;
  }
}
