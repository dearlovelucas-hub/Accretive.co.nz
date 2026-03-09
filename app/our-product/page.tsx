import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Container from "@/components/Container";
import UploadDemo from "@/components/UploadDemo";
import DemoRequestForm from "@/components/DemoRequestForm";
import { getAuthCookieName, parseSessionToken } from "@/lib/server/auth";

const workflowSteps = [
  { heading: "Upload your documents", body: "Drag and drop your precedent template and supporting transaction documents into the workspace. Word DOCX and PDF files are accepted." },
  { heading: "Add deal context", body: "Provide any additional transaction details — party names, key dates, commercial elections — that may not appear in the uploaded documents." },
  { heading: "The platform reads and identifies", body: "Accretive reads the transaction documents and maps the relevant information to the fields and drafting logic in your template, including conditional clauses." },
  { heading: "Missing information is flagged", body: "If the uploaded documents do not contain enough detail to complete a particular field, the platform asks before proceeding." },
  { heading: "Your document is returned", body: "You receive a completed Word document with all changes tracked. Review every amendment before the document leaves the firm." }
];

const documentWorkflows = [
  { title: "Board and Shareholder Resolutions", body: "Standard board resolutions approving transactions, security, and corporate steps. Shareholder resolutions for matters requiring member approval. Conditional drafting — sole director or multi-director forms — applied automatically." },
  { title: "Directors' Certificates", body: "Solvency certificates and other confirmations. The platform identifies the signing structure and selects the correct form — including whether to apply singular or plural director language throughout." },
  { title: "Disclosure Letters", body: "Qualified disclosure letters populated with specific disclosures drawn from the uploaded transaction materials and deal context provided by the solicitor." },
  { title: "Loan and Security Documentation", body: "Facility letters, disclosure schedules, security documents, and ancillary certificates. Party details and security descriptions applied consistently across the full suite." },
  { title: "Schedules and Annexures", body: "Transaction schedules requiring consistent population across multiple documents. Property descriptions, party details, and commercial terms applied from a single set of transaction inputs." },
  { title: "Ancillary Transaction Documents", body: "Settlement statements, condition satisfaction notices, and execution materials. Prepared from the same deal context used across the rest of the transaction suite." }
];

const securityBullets = [
  "Every matter workspace is isolated — documents from one matter are not accessible from another, even within the same firm account.",
  "Documents are encrypted in transit using TLS and at rest using AES-256.",
  "Access is controlled at the firm level. Each user account is individual and requires authentication.",
  "The platform does not use uploaded documents to train models or improve its systems. Your precedents remain yours."
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
        <h1 className="text-4xl font-semibold text-[#10243F]">The Accretive platform</h1>
        <p className="mt-4 text-lg text-slate-700">
          A workspace for preparing transactional documents from your firm&apos;s existing precedents.
        </p>
        <p className="mt-3 text-slate-700">
          You bring your own template documents and transaction materials. The platform reads them and returns a populated
          Word file. There is no configuration required — Accretive reads your precedent as-is and identifies the fields,
          conditional logic, and variable clauses within it.
        </p>
      </section>

      <UploadDemo />

      <section className="rounded-panel border border-[#d7e4fb] bg-white p-6 shadow-panel md:p-8">
        <h2 className="text-2xl font-semibold text-[#10243F]">How the drafting workflow operates</h2>
        <ol className="mt-6 space-y-4 text-slate-700">
          {workflowSteps.map((step, index) => (
            <li key={step.heading} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#355f95] text-xs text-[#355f95]">
                  {index + 1}
                </span>
                <div>
                  <p className="font-medium text-slate-800">{step.heading}</p>
                  <p className="mt-1 text-sm text-slate-600">{step.body}</p>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="rounded-panel border border-[#d7e4fb] bg-white p-6 shadow-panel md:p-8">
        <h2 className="text-2xl font-semibold text-[#10243F]">Typical document workflows</h2>
        <p className="mt-3 text-slate-700">
          Accretive is designed for the types of documents that appear regularly in commercial, property, and finance
          transactions.
        </p>
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          {documentWorkflows.map((doc) => (
            <article key={doc.title} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="font-medium text-slate-800">{doc.title}</p>
              <p className="mt-2 text-sm text-slate-600">{doc.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-panel border border-[#d7e4fb] bg-white p-6 shadow-panel md:p-8">
        <h2 className="text-2xl font-semibold text-[#10243F]">The output</h2>
        <p className="mt-3 text-slate-700">
          Every document produced by Accretive is returned in Word DOCX format with tracked changes visible. You can see
          exactly what has been amended before the document is sent or executed.
        </p>
        <p className="mt-3 text-slate-700">
          Accretive produces a first draft, adjusted to the transaction. Your lawyers review and approve it. The platform
          does not produce a finalised, execution-ready document.
        </p>
      </section>

      <section className="rounded-panel border border-[#d7e4fb] bg-white p-6 shadow-panel md:p-8">
        <h2 className="text-2xl font-semibold text-[#10243F]">Confidentiality</h2>
        <ul className="mt-4 space-y-3 text-slate-700">
          {securityBullets.map((bullet) => (
            <li key={bullet} className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
              {bullet}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-slate-600">
          Full details on security, matter isolation, encryption, and access controls are available on our{" "}
          <a href="/security" className="text-[#355f95] underline underline-offset-2 hover:text-[#10243F]">
            Security page
          </a>
          .
        </p>
      </section>

      <section id="request-demo" className="rounded-panel border border-[#d7e4fb] bg-white p-6 shadow-panel md:p-8">
        <header className="max-w-3xl">
          <h2 className="text-2xl font-semibold text-[#10243F]">Book a walkthrough</h2>
          <p className="mt-3 text-slate-700">
            We offer a structured walkthrough using documents representative of your practice. No configuration is
            required in advance.
          </p>
        </header>

        <div className="mt-8">
          <DemoRequestForm />
        </div>
      </section>
    </Container>
  );
}
