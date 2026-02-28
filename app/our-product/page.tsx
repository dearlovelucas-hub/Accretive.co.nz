import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Container from "@/components/Container";
import UploadDemo from "@/components/UploadDemo";
import { getAuthCookieName, parseSessionToken } from "@/lib/server/auth";

const workflowSteps = [
  "Identify context from transaction documents and supplied deal facts.",
  "Detect required fields and decision points in the template.",
  "Ask for missing information before final generation.",
  "Populate the template and make elections, such as sole director vs directors."
];

const securityBullets = [
  "Encryption in transit and at rest for uploaded materials.",
  "Role-based access controls for drafting workspaces.",
  "Audit logging placeholders for user actions and generated outputs.",
  "Configurable data handling settings to align with firm policy."
];

export default async function ProductPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(getAuthCookieName())?.value;
  const session = parseSessionToken(token);

  if (session) {
    redirect("/dashboard/drafting");
  }

  return (
    <Container className="space-y-16 py-16">
      <section className="max-w-4xl">
        <h1 className="text-4xl font-semibold text-white">Our product</h1>
        <p className="mt-4 text-slate-200">
          Accretive helps legal teams produce first drafts faster by combining your precedent templates with matter-specific
          context from supporting documents.
        </p>
      </section>

      <UploadDemo />

      <section className="rounded-panel border border-white/10 bg-white/5 p-6 md:p-8">
        <h2 className="text-2xl font-semibold text-white">How it works</h2>
        <ol className="mt-4 space-y-3 text-slate-100">
          {workflowSteps.map((step, index) => (
            <li key={step} className="rounded-lg border border-white/10 bg-slate-950/40 p-4">
              <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full border border-mist/70 text-xs text-mist">
                {index + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </section>

      <section className="rounded-panel border border-white/10 bg-white/5 p-6 md:p-8">
        <h2 className="text-2xl font-semibold text-white">Security & governance</h2>
        <ul className="mt-4 space-y-3 text-slate-100">
          {securityBullets.map((bullet) => (
            <li key={bullet} className="rounded-lg border border-white/10 bg-slate-950/40 p-4">
              {bullet}
            </li>
          ))}
        </ul>
      </section>
    </Container>
  );
}
