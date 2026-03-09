import Container from "@/components/Container";

export default function SecurityPolicyPage() {
  return (
    <Container className="py-16">
      <section className="max-w-4xl space-y-10">
        <header>
          <h1 className="text-4xl font-semibold text-[#10243F]">Security and confidentiality</h1>
          <p className="mt-4 text-slate-700">
            Accretive is built for the confidentiality requirements of legal practice in New Zealand. This page sets out
            how we handle client materials, how workspaces are isolated, and the current compliance position — alongside
            the New Zealand legal context for AI use.
          </p>
        </header>

        <section className="rounded-panel border border-[#bcd3f7] bg-[#f4f8ff] p-5 md:p-6">
          <h2 className="text-base font-semibold uppercase tracking-[0.08em] text-[#355f95]">Summary</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-700 md:text-base">
            <li>Matter isolation: documents uploaded to one matter are not accessible from another, even within the same firm account.</li>
            <li>Encryption: client materials are protected in transit (TLS) and at rest (AES-256).</li>
            <li>No model training: Accretive does not use uploaded documents to train models or improve its systems.</li>
            <li>Human review: lawyers remain responsible for checking and approving every output before use.</li>
          </ul>
        </section>

        <section className="rounded-panel border border-[#d7e4fb] bg-white p-6 md:p-8">
          <h2 className="text-2xl font-semibold text-[#10243F]">Document confidentiality</h2>
          <p className="mt-3 text-slate-700">
            Documents you upload to Accretive are used only for the purpose of completing the drafting task you have
            initiated. They are not shared with other users, other matters, or other firms.
          </p>
          <p className="mt-3 text-slate-700">
            Accretive does not use your documents to train models or improve its systems. Your precedents remain yours.
          </p>
        </section>

        <section className="rounded-panel border border-[#d7e4fb] bg-white p-6 md:p-8">
          <h2 className="text-2xl font-semibold text-[#10243F]">Matter separation</h2>
          <p className="mt-3 text-slate-700">
            Each drafting task operates within its own isolated workspace. Documents from one matter are not accessible
            from another, even within the same firm account. This applies to uploaded files, deal context, and generated
            output.
          </p>
        </section>

        <section className="rounded-panel border border-[#d7e4fb] bg-white p-6 md:p-8">
          <h2 className="text-2xl font-semibold text-[#10243F]">Encryption</h2>
          <p className="mt-3 text-slate-700">
            Documents are encrypted in transit and at rest. All connections to the Accretive platform use TLS.
            Stored documents are encrypted using AES-256. Encryption keys are managed separately from the data they
            protect.
          </p>
        </section>

        <section className="rounded-panel border border-[#d7e4fb] bg-white p-6 md:p-8">
          <h2 className="text-2xl font-semibold text-[#10243F]">User access and permissions</h2>
          <p className="mt-3 text-slate-700">
            Access to the Accretive platform is controlled at the firm level. Each user account is individual and
            requires authentication. Document access within the platform is scoped to the matter in which documents
            were uploaded.
          </p>
          <p className="mt-3 text-slate-700">
            Administrators can manage which users have access to the platform and review activity within their
            firm&apos;s account.
          </p>
        </section>

        <section className="rounded-panel border border-[#d7e4fb] bg-white p-6 md:p-8">
          <h2 className="text-2xl font-semibold text-[#10243F]">Audit visibility</h2>
          <p className="mt-3 text-slate-700">
            The platform maintains a record of activity within each workspace: when documents were uploaded, when the
            drafting task was run, and when output was generated. This record is available to firm administrators and
            is intended to support internal oversight of how the platform is being used.
          </p>
        </section>

        <section className="rounded-panel border border-[#d7e4fb] bg-white p-6 md:p-8">
          <h2 className="text-2xl font-semibold text-[#10243F]">Document retention</h2>
          <p className="mt-3 text-slate-700">
            Accretive does not retain document content indefinitely. Uploaded materials and generated output are
            available within your workspace for the duration of the active matter. Firms can request deletion of
            workspace data at any time.
          </p>
        </section>

        <section className="rounded-panel border border-[#d7e4fb] bg-white p-6 md:p-8">
          <h2 className="text-2xl font-semibold text-[#10243F]">NZ legal context: Core duties when using AI</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-slate-700">
            <li>
              The{" "}
              <a
                href="https://www.legislation.govt.nz/act/public/2006/0001/latest/DLM364946.html"
                target="_blank"
                rel="noreferrer"
                className="text-[#355f95] underline decoration-[#355f95]/70 underline-offset-2 hover:text-[#10243F]"
              >
                Lawyers and Conveyancers Act 2006, section 4
              </a>{" "}
              requires lawyers to uphold the rule of law, act independently, meet fiduciary duties, and protect client interests.
            </li>
            <li>
              The{" "}
              <a
                href="https://www.legislation.govt.nz/regulation/public/2008/0214/latest/DLM1437890.html"
                target="_blank"
                rel="noreferrer"
                className="text-[#355f95] underline decoration-[#355f95]/70 underline-offset-2 hover:text-[#10243F]"
              >
                RCCC Chapter 8
              </a>{" "}
              sets strict confidentiality obligations, including the duty to hold client information in strict confidence.
            </li>
            <li>
              Under{" "}
              <a
                href="https://www.legislation.govt.nz/regulation/public/2008/0214/latest/DLM1437893.html"
                target="_blank"
                rel="noreferrer"
                className="text-[#355f95] underline decoration-[#355f95]/70 underline-offset-2 hover:text-[#10243F]"
              >
                rule 8.1
              </a>
              , the duty of confidence starts at proposed retainer stage and continues indefinitely.
            </li>
            <li>
              Lawyers still carry responsibility for competence and conduct, including RCCC rules on competence (r 3), misleading
              conduct (r 10.9), and duties to the court (r 13.1), as reflected in NZLS and judiciary AI guidance.
            </li>
          </ul>
        </section>

        <section className="rounded-panel border border-[#d7e4fb] bg-white p-6 md:p-8">
          <h2 className="text-2xl font-semibold text-[#10243F]">NZLS guidance for lawyers using AI</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-slate-700">
            <li>
              The NZ Law Society’s{" "}
              <a
                href="https://www.lawsociety.org.nz/professional-practice/rules-and-maintaining-professional-standards/generative-ai-guidance-for-lawyers/"
                target="_blank"
                rel="noreferrer"
                className="text-[#355f95] underline decoration-[#355f95]/70 underline-offset-2 hover:text-[#10243F]"
              >
                Generative AI guidance
              </a>{" "}
              confirms there is no single NZ AI statute yet, but existing professional and legal duties fully apply.
            </li>
            <li>Lawyers remain responsible for outputs, including citation and factual accuracy, even where AI is used.</li>
            <li>
              The guidance highlights confidentiality, privilege, privacy, and supervision risk when using external AI tools, and
              includes a practical checklist for implementation.
            </li>
            <li>
              NZLS materials expressly connect AI risk back to RCCC obligations, including competence, fidelity to the court, and
              proper supervision of legal practice.
            </li>
          </ul>
        </section>

        <section className="rounded-panel border border-[#d7e4fb] bg-white p-6 md:p-8">
          <h2 className="text-2xl font-semibold text-[#10243F]">High Court and Supreme Court guidance on AI</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-slate-700">
            <li>
              The Courts of New Zealand have issued{" "}
              <a
                href="https://www.courtsofnz.govt.nz/going-to-court/practice-directions/practice-guidelines/all-benches/guidelines-for-use-of-generative-artificial-intelligence-in-courts-and-tribunals"
                target="_blank"
                rel="noreferrer"
                className="text-[#355f95] underline decoration-[#355f95]/70 underline-offset-2 hover:text-[#10243F]"
              >
                all-benches Gen AI guidelines
              </a>{" "}
              for lawyers.
            </li>
            <li>
              The lawyers’ guideline document explicitly states it applies to the Senior Courts including the Supreme Court and
              High Court (see page 7 of the PDF).
            </li>
            <li>
              The court guidance requires caution on confidentiality, suppression, and privilege, and reinforces counsel’s duty to
              verify citations and factual content before filing.
            </li>
            <li>
              Disclosure of AI use is not automatically required in every case, but courts/tribunals may request or require it.
            </li>
          </ul>
        </section>

        <section className="rounded-panel border border-[#d7e4fb] bg-white p-6 md:p-8">
          <h2 className="text-2xl font-semibold text-[#10243F]">Current product security baseline</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-slate-700">
            <li>Session-based authentication and signed cookies for dashboard/API access.</li>
            <li>Owner and organisation checks on templates, draft jobs, and document retrieval routes.</li>
            <li>Server-side validation for key submission flows (demo requests and draft-job inputs).</li>
            <li>Document privacy controls in schema and migrations, including documents-table RLS migration.</li>
          </ul>
        </section>

        <section className="rounded-panel border border-amber-400/40 bg-amber-500/10 p-6 md:p-8">
          <h2 className="text-2xl font-semibold text-[#10243F]">Compliance roadmap: ISO 27001, SOC 2, ISO 42001</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-slate-700">
            <li>
              <span className="font-semibold">ISO/IEC 27001:</span> building a formal ISMS program around access control, risk
              treatment, incident response, supplier assurance, and policy governance.
            </li>
            <li>
              <span className="font-semibold">SOC 2:</span> aligning controls and evidence collection to Trust Services Criteria
              (security first, then availability/confidentiality as scoped).
            </li>
            <li>
              <span className="font-semibold">ISO/IEC 42001:</span> establishing AI-specific governance for model use,
              human-in-the-loop review, transparency, and AI risk management.
            </li>
            <li>
              These are active roadmap targets. Formal certification/attestation has not yet been claimed on this page.
            </li>
          </ul>
        </section>

        <p className="text-xs text-slate-400">
          This page is an implementation and guidance summary for product transparency. It is not legal advice.
        </p>
      </section>
    </Container>
  );
}
