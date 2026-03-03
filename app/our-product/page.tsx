import Container from "@/components/Container";
import UploadDemo from "@/components/UploadDemo";
import DemoRequestForm from "@/components/DemoRequestForm";

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

export default function ProductPage() {
  return (
    <Container className="space-y-16 py-16">
      <section className="max-w-4xl">
        <h1 className="text-4xl font-semibold text-[#10243F]">Your first call for drafting</h1>
        <p className="mt-4 text-slate-700">
          Accretive helps legal teams produce first drafts faster by combining your precedent templates with matter-specific
          context from supporting documents.
        </p>
      </section>

      <UploadDemo />

      <section id="request-demo" className="rounded-panel border border-[#d7e4fb] bg-white p-6 shadow-panel md:p-8">
        <header className="max-w-3xl">
          <h2 className="text-2xl font-semibold text-[#10243F]">Request a demo</h2>
          <p className="mt-3 text-slate-700">
            See how Accretive fits your drafting workflow while preserving the security standards law firms require.
          </p>
        </header>

        <div className="mt-8">
          <DemoRequestForm />
        </div>
      </section>

      <section className="rounded-panel border border-[#d7e4fb] bg-white p-6 shadow-panel md:p-8">
        <h2 className="text-2xl font-semibold text-[#10243F]">How it works</h2>
        <ol className="mt-4 space-y-3 text-slate-700">
          {workflowSteps.map((step, index) => (
            <li key={step} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full border border-[#355f95] text-xs text-[#355f95]">
                {index + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </section>

      <section className="rounded-panel border border-[#d7e4fb] bg-white p-6 shadow-panel md:p-8">
        <h2 className="text-2xl font-semibold text-[#10243F]">Security & governance</h2>
        <ul className="mt-4 space-y-3 text-slate-700">
          {securityBullets.map((bullet) => (
            <li key={bullet} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              {bullet}
            </li>
          ))}
        </ul>
      </section>
    </Container>
  );
}
