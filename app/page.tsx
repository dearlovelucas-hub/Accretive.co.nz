"use client";

import { useState } from "react";
import Container from "@/components/Container";
import Hero from "@/components/Hero";
import FeatureGrid from "@/components/FeatureGrid";
import Modal from "@/components/Modal";

export default function HomePage() {
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);

  return (
    <Container>
      <Hero onWatchDemo={() => setIsDemoModalOpen(true)} />
      <FeatureGrid />

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
