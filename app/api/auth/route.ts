export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { password } = await req.json();

  if (password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const response = NextResponse.json({ success: true });

  response.cookies.set("admin_auth", password, {
    httpOnly: true,
    maxAge: 60 * 60,
    path: "/",
  });

  return response;
}
