import Container from "@/components/Container";
import Link from "next/link";

export default function NotFound() {
  return (
    <Container className="py-20 text-center">
      <h1 className="text-3xl font-semibold text-[#10243F]">Whoops! You got lost among the weeds</h1>
      <p className="mt-4 text-slate-700">
        Redirect yourself to the bigger picture{" "}
        <Link href="/" className="underline decoration-[#355f95]/70 underline-offset-2 hover:text-[#10243F]">
          here
        </Link>
      </p>
      <Link
        href="/"
        className="mt-6 inline-block rounded-full border border-[#10243F] bg-[#10243F] px-5 py-2 text-sm text-white transition hover:bg-[#0d1d33]"
      >
        Return home
      </Link>
    </Container>
  );
}
