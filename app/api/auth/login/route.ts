import { NextResponse } from "next/server.js";
import {
  createSessionToken,
  getAuthCookieName,
  getSessionTtlSeconds,
  shouldUseSecureCookies,
  verifyUserCredentials
} from "@/lib/server/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { username?: string; password?: string };
    const username = String(body?.username ?? "").trim();
    const password = String(body?.password ?? "");

    if (!username || !password) {
      return NextResponse.json({ error: "Username and password are required." }, { status: 400 });
    }

    const user = await verifyUserCredentials(username, password);
    if (!user) {
      return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
    }

    const token = createSessionToken({
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role
    });

    const response = NextResponse.json(
      {
        user: {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          role: user.role
        }
      },
      { status: 200 }
    );

    response.cookies.set({
      name: getAuthCookieName(),
      value: token,
      httpOnly: true,
      secure: shouldUseSecureCookies(request),
      sameSite: "lax",
      path: "/",
      maxAge: getSessionTtlSeconds()
    });

    return response;
  } catch {
    return NextResponse.json({ error: "Unable to sign in." }, { status: 500 });
  }
}
