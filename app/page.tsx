"use client";

import { useState } from "react";
import Link from "next/link";
import Container from "@/components/Container";
import Hero from "@/components/Hero";
import FeatureGrid from "@/components/FeatureGrid";
import Modal from "@/components/Modal";

const documentTypes = [
  { title: "Board and Shareholder Resolutions", description: "Conditional drafting applied automatically — sole director or two-director forms selected based on transaction context." },
  { title: "Directors' Certificates", description: "Solvency and confirmation certificates populated with company details, director names, and execution structure." },
  { title: "Disclosure Letters", description: "Standard disclosure letters incorporating specific disclosures drawn from uploaded transaction materials." },
  { title: "Loan and Security Documentation", description: "Facility letters, security documents, and ancillary certificates populated consistently across the full suite." },
  { title: "Schedules and Annexures", description: "Transaction schedules requiring consistent party and property details applied across multiple documents." },
  { title: "Ancillary Transaction Documents", description: "Settlement statements, condition satisfaction notices, and execution materials prepared from deal context." }
];

const valueAddItems = [
  { label: "Populating precedent templates with transaction-specific details", type: "cross" as const },
  { label: "Applying drafting elections across resolutions and certificates", type: "cross" as const },
  { label: "Legal judgment, negotiation strategy, and advice to clients", type: "tick" as const },
  { label: "Substantive review and sign-off before execution", type: "tick" as const }
];

export default function HomePage() {
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);

  return (
    <div className="relative overflow-hidden bg-gradient-to-b from-[#eef4ff] via-[#f8fbff] to-white">
      <div className="pointer-events-none absolute -left-28 top-16 h-80 w-80 rounded-full bg-[#c7dcff]/45 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 top-40 h-72 w-72 rounded-full bg-[#b5d0ff]/35 blur-3xl" />

      <Container className="relative pb-20 text-[#10243F]">
        <Hero onWatchDemo={() => setIsDemoModalOpen(true)} />

        <section className="-mt-24 rounded-panel border border-[#d5e3fb] bg-white/90 p-6 shadow-panel md:-mt-28 md:p-8">
          <p className="text-sm uppercase tracking-[0.12em] text-[#355f95]">Built for growing law firms</p>
          <h2 className="mt-3 text-3xl font-semibold text-[#10243F] md:text-4xl">
            Drafting support built for transactional practice
          </h2>
          <p className="mt-4 max-w-3xl text-slate-700">
            Accretive is a drafting platform for law firms. You upload your precedent template and the relevant transaction
            documents. Accretive reads those materials, identifies the transaction details, and populates your template
            accordingly. The output is a Word document — adjusted to the matter, returned to you for review before execution.
          </p>
          <p className="mt-3 max-w-3xl text-slate-700">
            The platform assists your lawyers. It does not exercise legal judgment on your behalf.
          </p>
        </section>

        <section className="py-16">
          <h3 className="text-2xl font-semibold text-[#10243F]">Document types</h3>
          <p className="mt-2 text-slate-700">Typical workflows across commercial, property, and finance transactions.</p>
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            {documentTypes.map((doc) => (
              <article
                key={doc.title}
                className="rounded-panel border border-[#d7e4fb] bg-gradient-to-b from-white to-[#f6f9ff] p-5 shadow-[0_10px_24px_rgba(16,36,63,0.08)]"
              >
                <p className="font-medium text-slate-800">{doc.title}</p>
                <p className="mt-2 text-sm text-slate-600">{doc.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 rounded-panel border border-[#d7e4fb] bg-white p-6 shadow-panel md:grid-cols-2 md:p-8">
          <div>
            <h3 className="text-2xl font-semibold text-[#10243F]">Where Accretive helps — and where it doesn&apos;t</h3>
            <p className="mt-3 text-slate-700">
              Accretive handles the mechanical work of applying transaction details to your firm&apos;s precedents. Your lawyers
              retain responsibility for reviewing, advising, and approving every document before it leaves the firm.
            </p>
          </div>
          <ul className="space-y-3">
            {valueAddItems.map((item) => (
              <li key={item.label} className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-slate-700">
                <span className="inline-flex items-center gap-2">
                  <span
                    className={item.type === "tick" ? "text-emerald-600" : "text-rose-500"}
                    aria-hidden="true"
                  >
                    {item.type === "tick" ? "✓" : "✕"}
                  </span>
                  {item.label}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <FeatureGrid />

        <section className="mt-8 rounded-panel border border-[#bcd3f7] bg-gradient-to-r from-[#dce8fb] to-[#ebf3ff] p-6 text-center md:p-8">
          <h3 className="text-2xl font-semibold text-[#10243F]">See how it works with your own precedents</h3>
          <p className="mt-2 text-sm text-slate-700">
            We offer a structured walkthrough using documents representative of your practice. No configuration required in advance.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/request-demo"
              className="rounded-full border border-[#10243F] bg-[#10243F] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#0d1d33] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#10243F]"
            >
              Book a walkthrough
            </Link>
            <button
              type="button"
              onClick={() => setIsDemoModalOpen(true)}
              className="rounded-full border border-[#355f95] bg-white px-5 py-2 text-sm font-semibold text-[#10243F] transition hover:bg-[#eef4ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#355f95]"
            >
              See a workflow demo
            </button>
          </div>
        </section>

        <Modal isOpen={isDemoModalOpen} onClose={() => setIsDemoModalOpen(false)} title="Demo Video">
          <div className="rounded-lg border border-[#d7e4fb] bg-[#f8fbff] p-8">
            <div className="flex aspect-video items-center justify-center rounded-md border border-dashed border-slate-300 bg-white text-slate-500">
              Demo video coming soon
            </div>
          </div>
        </Modal>
      </Container>
    </div>
  );
}
