import { NextResponse } from "next/server.js";
import { requireOrgMembership, requireRole } from "@/lib/server/authorization";
import { DemoRequestMailerError, sendDemoRequestEmail } from "@/lib/server/demoRequestMailer";
import { createDemoRequest, listDemoRequests } from "@/lib/server/demoRequestsStore";
import { validateDemoRequest } from "@/lib/server/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = validateDemoRequest(body);

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    const record = await createDemoRequest(result.data);

    try {
      await sendDemoRequestEmail(record);
      return NextResponse.json({ id: record.id, submittedAt: record.submittedAt, notificationStatus: "sent" }, { status: 201 });
    } catch (error) {
      if (error instanceof DemoRequestMailerError && error.code === "not_configured") {
        console.warn("demo-request-email-not-configured");
        return NextResponse.json(
          {
            id: record.id,
            submittedAt: record.submittedAt,
            notificationStatus: "not_configured",
            warning: "Request submitted. Email delivery is not configured yet."
          },
          { status: 201 }
        );
      }

      if (error instanceof DemoRequestMailerError && error.code === "invalid_api_key") {
        console.warn("demo-request-email-invalid-api-key");
        return NextResponse.json(
          {
            id: record.id,
            submittedAt: record.submittedAt,
            notificationStatus: "failed",
            warning: "Request submitted, but email delivery failed due to an invalid mail API key."
          },
          { status: 201 }
        );
      }

      console.error("demo-request-email-send-failed", error);
      return NextResponse.json(
        {
          id: record.id,
          submittedAt: record.submittedAt,
          notificationStatus: "failed",
          warning: "Request submitted, but we could not send the notification email."
        },
        { status: 201 }
      );
    }
  } catch (error) {
    console.error("demo-request-submit-failed", error);
    return NextResponse.json({ error: "Unable to process request." }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const auth = await requireOrgMembership(request);
  if (!auth.ok) {
    return auth.response;
  }
  const role = requireRole(auth.value, ["admin"]);
  if (!role.ok) {
    return role.response;
  }

  return NextResponse.json({ items: await listDemoRequests() }, { status: 200 });
}
