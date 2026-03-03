"use client";

import { useState } from "react";
import Container from "@/components/Container";
import Hero from "@/components/Hero";
import FeatureGrid from "@/components/FeatureGrid";
import Modal from "@/components/Modal";

const documentTypes = [
  "Board and Shareholder Resolutions",
  "Compliance Certificates",
  "Letters and demands",
  "Disclosure letters",
  "Bulk document drafting",
  "Loan and Security documentation"
];

const valueAddItems = [
  { label: "Routine drafting, clause rewording and formatting cleanup", type: "cross" as const },
  { label: "Basic proofreading, typos and grammar corrections", type: "cross" as const },
  { label: "Negotiation strategy and commercial judgment", type: "tick" as const },
  { label: "Client communication and risk framing", type: "tick" as const }
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
            Streamline drafting of high-frequency legal documents
          </h2>
          <p className="mt-4 max-w-3xl text-slate-700">
            Accretive turns your precedent documents and transaction inputs into first drafts within minutes, with consistent
            structure and clean execution. Your team spends less time on repeat drafting and more time where legal judgment matters
            most.
          </p>
        </section>

        <section className="py-16">
          <h3 className="text-2xl font-semibold text-[#10243F]">Popular document workflows</h3>
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            {documentTypes.map((docType) => (
              <article
                key={docType}
                className="rounded-panel border border-[#d7e4fb] bg-gradient-to-b from-white to-[#f6f9ff] p-5 shadow-[0_10px_24px_rgba(16,36,63,0.08)]"
              >
                <p className="font-medium text-slate-800">{docType}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 rounded-panel border border-[#d7e4fb] bg-white p-6 shadow-panel md:grid-cols-2 md:p-8">
          <div>
            <h3 className="text-2xl font-semibold text-[#10243F]">Reduce routine drafting</h3>
            <p className="mt-3 text-slate-700">
              Let your lawyers refocus on client outcomes, negotiation and technical drafting: Accretive takes care of the mundane.
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
          <h3 className="text-2xl font-semibold text-[#10243F]">Draft with structure. Advise with confidence.</h3>
          <button
            type="button"
            onClick={() => setIsDemoModalOpen(true)}
            className="mt-4 rounded-full border border-[#10243F] bg-[#10243F] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#0d1d33] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#10243F]"
          >
            See Workflow Demo
          </button>
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
