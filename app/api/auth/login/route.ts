import { NextResponse } from "next/server.js";
import {
  createSessionToken,
  getAuthCookieName,
  getSessionTtlSeconds,
  shouldUseSecureCookies,
  verifyUserCredentials
} from "@/lib/server/auth";
import {
  clearLoginRateLimit,
  getClientIpAddress,
  getLoginRateLimitState,
  recordLoginFailure
} from "@/lib/server/loginRateLimit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { username?: string; password?: string };
    const username = String(body?.username ?? "").trim();
    const password = String(body?.password ?? "");
    const ipAddress = getClientIpAddress(request);

    if (!username || !password) {
      return NextResponse.json({ error: "Username and password are required." }, { status: 400 });
    }

    const rateLimitState = getLoginRateLimitState({ username, ipAddress });
    if (rateLimitState.limited) {
      return NextResponse.json(
        { error: "Too many failed login attempts. Please retry later." },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimitState.retryAfterSeconds)
          }
        }
      );
    }

    const user = await verifyUserCredentials(username, password);
    if (!user) {
      const failureState = recordLoginFailure({ username, ipAddress });
      if (failureState.limited) {
        return NextResponse.json(
          { error: "Too many failed login attempts. Please retry later." },
          {
            status: 429,
            headers: {
              "Retry-After": String(failureState.retryAfterSeconds)
            }
          }
        );
      }
      return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
    }

    clearLoginRateLimit({ username, ipAddress });

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
