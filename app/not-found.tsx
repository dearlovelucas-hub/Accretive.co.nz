import Container from "@/components/Container";
import Link from "next/link";

export default function NotFound() {
  return (
    <Container className="py-20 text-center">
      <h1 className="text-3xl font-semibold text-white">Whoops! You got lost among the weeds</h1>
      <p className="mt-4 text-slate-200">
        Redirect yourself to the bigger picture{" "}
        <Link href="/" className="underline decoration-mist/70 underline-offset-2 hover:text-white">
          here
        </Link>
      </p>
      <Link
        href="/"
        className="mt-6 inline-block rounded-full border border-mist/70 px-5 py-2 text-sm text-white transition hover:bg-white/10"
      >
        Return home
      </Link>
    </Container>
  );
}
