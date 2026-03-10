import type { DemoRequestRecord } from "@/lib/server/demoRequestsStore";

const DEMO_REQUEST_TO_EMAIL = "lucas@accretive.co.nz";

export class DemoRequestMailerError extends Error {
  code: "not_configured" | "invalid_api_key" | "send_failed";

  constructor(code: "not_configured" | "invalid_api_key" | "send_failed", message: string) {
    super(message);
    this.code = code;
  }
}

function buildEmailText(request: DemoRequestRecord): string {
  return [
    "A new demo request was submitted:",
    "",
    `Submitted at: ${request.submittedAt}`,
    `Full name: ${request.fullName}`,
    `Work email: ${request.email}`,
    `Organisation: ${request.organisation}`,
    `Role: ${request.role || "-"}`,
    `Practice areas: ${request.practiceAreas.join(", ") || "-"}`,
    `Firm size: ${request.firmSize || "-"}`,
    `Document types: ${request.docTypes || "-"}`,
    `Current process: ${request.currentProcess || "-"}`,
    `Security requirements: ${request.securityRequirements.join(", ") || "-"}`,
    `Notes: ${request.notes || "-"}`
  ].join("\n");
}

export async function sendDemoRequestEmail(request: DemoRequestRecord): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const fromAddress = process.env.RESEND_FROM_EMAIL?.trim() || "no-reply@accretive.co.nz";

  if (!apiKey) {
    throw new DemoRequestMailerError("not_configured", "RESEND_API_KEY is not configured.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: fromAddress,
      to: [DEMO_REQUEST_TO_EMAIL],
      subject: `New Accretive demo request: ${request.fullName} (${request.organisation})`,
      text: buildEmailText(request),
      reply_to: request.email
    })
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");

    if (response.status === 401) {
      throw new DemoRequestMailerError(
        "invalid_api_key",
        `Failed to send demo request email (${response.status}). ${details}`.trim()
      );
    }

    throw new DemoRequestMailerError(
      "send_failed",
      `Failed to send demo request email (${response.status}). ${details}`.trim()
    );
  }
}
