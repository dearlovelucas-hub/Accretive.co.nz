import Container from "@/components/Container";

export default function NzResponsibleAiGuidanceArticlePage() {
  return (
    <Container className="py-16">
      <article className="mx-auto max-w-4xl rounded-panel border border-[#d7e4fb] bg-white p-6 shadow-panel md:p-10">
        <header>
          <h1 className="text-4xl font-semibold text-[#10243F]">
            New Zealand&apos;s Responsible AI Guidance for Businesses: What Legal and Tech Leaders Need to Know
          </h1>
          <p className="mt-3 text-sm uppercase tracking-[0.1em] text-[#355f95]">Published July 2025 | MBIE | AI &amp; Law Insights</p>
        </header>

        <div className="mt-8 space-y-6 text-[1.04rem] leading-8 text-slate-700">
          <p>
            New Zealand&apos;s Ministry of Business, Innovation and Employment (MBIE) has released its <em>Responsible AI Guidance
            for Businesses</em>, a voluntary but substantive framework aimed at helping NZ businesses adopt and deploy AI in a
            trustworthy, legally sound manner. For firms operating at the intersection of AI and law, this document deserves close
            attention.
          </p>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-[#10243F]">The Framework at a Glance</h2>
            <p>
              The Guidance adopts a proportionate, risk-based approach, consistent with international initiatives like the OECD AI
              Principles and the EU AI Act, and is structured around three layers:
            </p>
            <ol className="list-decimal space-y-2 pl-6">
              <li>
                <span className="font-medium">Understanding your &quot;why&quot;</span>: clarifying purpose, principles, and objectives before
                deploying any AI system.
              </li>
              <li>
                <span className="font-medium">Good business foundations</span>: governance, legal compliance, procurement,
                cybersecurity, privacy, and stakeholder engagement.
              </li>
              <li>
                <span className="font-medium">AI system-specific considerations</span>: data quality, model integrity, GenAI
                inputs/outputs, and human-in-the-loop decision-making.
              </li>
            </ol>
            <p>
              It is non-binding and intentionally technology-neutral, covering everything from legacy rule-based systems to large
              language models.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-[#10243F]">Key Legal Obligations Flagged</h2>
            <p>
              The Guidance maps a range of existing NZ legislation onto AI risk scenarios, a practically useful exercise for
              compliance teams. Businesses should be aware of exposure under:
            </p>
            <ul className="list-disc space-y-2 pl-6">
              <li>
                <span className="font-medium">Privacy Act 2020</span>: any AI system processing personal data triggers obligations
                under the Information Privacy Principles, including the mandatory appointment of a privacy officer.
              </li>
              <li>
                <span className="font-medium">Fair Trading Act 1986</span>: AI-generated content, pricing tools, and chatbots that
                mislead consumers create liability.
              </li>
              <li>
                <span className="font-medium">Commerce Act 1986</span>: algorithmic pricing tools that pool competitor data can
                constitute cartel conduct, even without direct communication between parties.
              </li>
              <li>
                <span className="font-medium">Human Rights Act 1993 / Bill of Rights Act 1990</span>: AI systems that produce
                discriminatory outcomes in hiring, lending, or service delivery carry real legal risk, particularly where bias is
                embedded in training data.
              </li>
              <li>
                <span className="font-medium">Copyright Act 1994</span>: training data sourcing, output ownership, and
                GenAI-generated content all raise unresolved IP questions requiring active management.
              </li>
              <li>
                <span className="font-medium">Harmful Digital Communications Act 2015</span>: deepfakes and AI-generated abusive
                content carry takedown obligations.
              </li>
            </ul>
            <p>
              The Guidance also flags the relevance of international regimes, particularly the EU AI Act and GDPR, for businesses
              operating across borders.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-[#10243F]">Governance and Accountability</h2>
            <p>
              The Guidance recommends assembling cross-functional AI governance teams spanning legal, privacy, security, data
              science, HR, and communications. For smaller firms, this may mean assigning AI governance responsibilities as a
              portfolio rather than a dedicated role.
            </p>
            <p>Critical governance expectations include:</p>
            <ul className="list-disc space-y-2 pl-6">
              <li>Documented AI policies aligned with existing data, security, and privacy frameworks</li>
              <li>Clear accountability structures across the AI lifecycle</li>
              <li>Regular risk inventories using a structured Identify to Assess to Manage to Record to Review cycle</li>
              <li>Contingency and exit strategies for AI system failure or vendor change</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-[#10243F]">GenAI-Specific Risks</h2>
            <p>
              The Guidance dedicates significant attention to generative AI, flagging several concerns directly relevant to legal
              and professional services:
            </p>
            <ul className="list-disc space-y-2 pl-6">
              <li>
                <span className="font-medium">Hallucinations</span>: LLM outputs should be verified against primary sources before
                use in client work.
              </li>
              <li>
                <span className="font-medium">Prompt data exposure</span>: information entered into public or free GenAI tools may
                be shared with developers or surfaced in future outputs.
              </li>
              <li>
                <span className="font-medium">IP ownership uncertainty</span>: outputs may lack commercial protection, may infringe
                existing copyright, or may replicate protected works without attribution.
              </li>
              <li>
                <span className="font-medium">Prompt injection</span>: adversarial inputs can manipulate LLM behaviour, a security
                risk in AI-assisted legal research or document review tools.
              </li>
              <li>
                <span className="font-medium">Maori data and matauranga Maori</span>: AI systems touching Maori content require
                culturally informed governance and, in many cases, direct community engagement.
              </li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-[#10243F]">Human-in-the-Loop Requirements</h2>
            <p>
              The Guidance draws a clear line between low-risk AI and high-stakes decisions affecting money, health, law, or
              employment, where human review is not optional. It warns against automation bias, the tendency to accept AI outputs
              uncritically, which undermines oversight.
            </p>
            <p>
              For legaltech applications, contract analysis, due diligence, regulatory research, and risk scoring, a robust
              human-in-the-loop framework is both a compliance expectation and a professional obligation.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-[#10243F]">Procurement Considerations</h2>
            <p>Before deploying a third-party AI system, the Guidance recommends assessing:</p>
            <ul className="list-disc space-y-2 pl-6">
              <li>Where operational and input data is stored, and which jurisdiction governs it</li>
              <li>Model performance metrics, including accuracy and bias testing results</li>
              <li>Ownership of inputs and outputs under supplier terms of service</li>
              <li>Vendor lock-in risk and data portability</li>
              <li>Whether training data meets ethical and legal sourcing standards</li>
            </ul>
            <p>The AI Forum NZ&apos;s procurement guides and AI model cards are referenced as due diligence tools.</p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-[#10243F]">Ethical Data Sourcing and Copyright</h2>
            <p>
              For businesses developing or fine-tuning AI models, the Guidance addresses the growing importance of licensed
              training data. Options include direct licensing deals with publishers, collective licensing schemes (including an
              anticipated New Zealand scheme from Copyright Licensing NZ later in 2025), and emerging fair marketplaces.
            </p>
            <p>
              Models trained exclusively on licensed data, such as Adobe Firefly and Te Hiku&apos;s te reo Maori ASR model, are cited
              as examples of best practice.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-[#10243F]">Bottom Line for AI Legaltech Firms</h2>
            <p>
              This Guidance does not create new law, but it crystallises regulatory expectations and provides a defensible
              framework for responsible AI deployment. For firms advising clients on AI adoption, or deploying AI in their own
              practice, it offers:
            </p>
            <ul className="list-disc space-y-2 pl-6">
              <li>A structured compliance checklist mapped to existing NZ legislation</li>
              <li>Scenario-based illustrations of where AI can generate legal and reputational liability</li>
              <li>Practical governance templates adaptable to firm size and risk appetite</li>
              <li>
                Clear signposting to international standards (ISO/IEC 42001, NIST AI RMF, EU AI Act) for clients operating
                globally
              </li>
            </ul>
            <p>
              The full Guidance, checklists, and supplementary resources are available at{" "}
              <a
                href="https://www.mbie.govt.nz"
                target="_blank"
                rel="noreferrer"
                className="text-[#355f95] underline decoration-[#355f95]/70 underline-offset-2 hover:text-[#10243F]"
              >
                mbie.govt.nz
              </a>
              .
            </p>
          </section>

          <p className="border-t border-slate-200 pt-6 text-sm text-slate-600">
            This summary is provided for informational purposes only and does not constitute legal advice. Businesses should seek
            independent legal counsel regarding their specific obligations under applicable legislation.
          </p>
        </div>
      </article>
    </Container>
  );
}
