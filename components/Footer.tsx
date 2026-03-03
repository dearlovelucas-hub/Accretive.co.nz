import Link from "next/link";
import Container from "@/components/Container";

export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white py-8">
      <Container className="flex flex-col gap-3 text-sm text-slate-600 md:flex-row md:items-center md:justify-between">
        <p>Accretive - Draft with structure. Advise with confidence.</p>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <Link href="/privacy-policy" className="transition hover:text-[#0B1F4D]">
            Privacy Policy
          </Link>
          <Link href="/security-policy" className="transition hover:text-[#0B1F4D]">
            Security Policy
          </Link>
          <Link href="/terms-of-service" className="transition hover:text-[#0B1F4D]">
            Terms of Service
          </Link>
        </div>
        <p>© {new Date().getFullYear()} Accretive. All rights reserved.</p>
      </Container>
    </footer>
  );
}
