import { NextResponse } from "next/server";
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
    return NextResponse.json({ id: record.id, submittedAt: record.submittedAt }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unable to process request." }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ items: await listDemoRequests() }, { status: 200 });
}
