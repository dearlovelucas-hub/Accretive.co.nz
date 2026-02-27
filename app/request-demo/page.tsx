import Container from "@/components/Container";
import DemoRequestForm from "@/components/DemoRequestForm";

export default function RequestDemoPage() {
  return (
    <Container className="py-16">
      <header className="max-w-3xl">
        <h1 className="text-4xl font-semibold text-white">Request a demo</h1>
        <p className="mt-4 text-slate-200">
          See how Accretive fits your drafting workflow while preserving the security standards law firms require.
        </p>
      </header>

      <section className="mt-10 rounded-panel border border-white/10 bg-white/5 p-6 md:p-8">
        <DemoRequestForm />
      </section>
    </Container>
  );
}
