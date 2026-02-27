"use client";

import { useState } from "react";
import Container from "@/components/Container";
import Hero from "@/components/Hero";
import FeatureGrid from "@/components/FeatureGrid";
import Modal from "@/components/Modal";

const documentTypes = [
  "Board and Shareholder Resolutions",
  "Compliance Certificates",
  "Subscription Agreements",
  "Accession Deeds",
  "Property documentation",
  "Loan and Security documentation"
];

const valueAddItems = [
  { label: "Rewording and formatting documents", type: "cross" as const },
  { label: "Misspellings and grammar errors", type: "cross" as const },
  { label: "Negotiation and commercial judgment", type: "tick" as const },
  { label: "Client communication and risk framing", type: "tick" as const }
];

export default function HomePage() {
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);

  return (
    <Container className="pb-20">
      <Hero onWatchDemo={() => setIsDemoModalOpen(true)} />

      <section className="-mt-24 rounded-panel border border-white/10 bg-white/5 p-6 md:-mt-28 md:p-8">
        <p className="text-sm uppercase tracking-[0.12em] text-mist">Built for growing law firms</p>
        <h2 className="mt-3 text-3xl font-semibold text-white md:text-4xl">
          Streamline drafting of high-frequency legal documents
        </h2>
        <p className="mt-4 max-w-3xl text-slate-200">
          Accretive turns your precedent documents and transaction inputs into first drafts within minutes, with consistent structure
          and clean execution. Your team spends less time on repeat drafting and more time where legal judgment matters most.
        </p>
      </section>

      <section className="py-16">
        <h3 className="text-2xl font-semibold text-white">Popular document workflows</h3>
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          {documentTypes.map((docType) => (
            <article key={docType} className="rounded-panel border border-white/10 bg-slate-950/40 p-5">
              <p className="text-slate-100">{docType}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 rounded-panel border border-white/10 bg-white/5 p-6 md:grid-cols-2 md:p-8">
        <div>
          <h3 className="text-2xl font-semibold text-white">Reduce routine drafting</h3>
          <p className="mt-3 text-slate-200">
            Let Accretive handle repetitive drafting mechanics so your lawyers can focus on client outcomes, negotiation, and
            strategic advice.
          </p>
        </div>
        <ul className="space-y-3">
          {valueAddItems.map((item) => (
            <li key={item.label} className="rounded-lg border border-white/10 bg-slate-950/40 px-4 py-3 text-slate-100">
              <span className="inline-flex items-center gap-2">
                <span
                  className={item.type === "tick" ? "text-emerald-300" : "text-rose-300"}
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

      <section className="mt-8 rounded-panel border border-mist/30 bg-mist/10 p-6 md:p-8">
        <h3 className="text-2xl font-semibold text-white">Draft faster. Advise better.</h3>
        <p className="mt-3 max-w-3xl text-slate-100">
          Accretive helps legal teams move from rough drafts to high-quality legal documents quickly, ensuring your focus is on client outcomes and strategic advice.
        </p>
      </section>

      <Modal isOpen={isDemoModalOpen} onClose={() => setIsDemoModalOpen(false)} title="Demo Video">
        <div className="rounded-lg border border-white/10 bg-slate-900/70 p-8">
          <div className="flex aspect-video items-center justify-center rounded-md border border-dashed border-white/20 bg-slate-950/40 text-slate-300">
            Demo video coming soon
          </div>
        </div>
      </Modal>
    </Container>
  );
}
