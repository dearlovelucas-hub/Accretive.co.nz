import Container from "@/components/Container";
import Link from "next/link";

const publishedArticles = [
  {
    title: "New Zealand's Responsible AI Guidance for Businesses: What Legal and Tech Leaders Need to Know",
    date: "July 2025",
    category: "MBIE | AI & Law Insights",
    href: "/news-and-releases/new-zealands-responsible-ai-guidance-for-businesses-what-legal-and-tech-leaders-need-to-know",
    summary:
      "A practical legal and governance read on MBIE's Responsible AI Guidance for businesses adopting AI in New Zealand."
  },
  {
    title: "What New Zealand's Law Society Guidance Really Means for Your Firm's AI Journey",
    date: "March 2024",
    category: "Insights",
    href: "/news-and-releases/what-new-zealands-law-society-guidance-really-means-for-your-firms-ai-journey",
    summary:
      "A practical reading of the Law Society's Generative AI guidance for firms assessing risk, responsibility, and rollout."
  }
];

export default function NewsAndReleasesPage() {
  return (
    <Container className="py-16">
      <section className="max-w-4xl">
        <h1 className="text-4xl font-semibold text-[#10243F]">News and Releases</h1>
        <p className="mt-4 text-slate-700">
          Keep up to date on the ever-changing guidance from regulators, government and the courts.
        </p>
      </section>

      <section className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2">
        {publishedArticles.map((item) => (
          <article key={item.title} className="rounded-panel border border-[#d7e4fb] bg-white p-6 shadow-panel">
            <p className="text-xs uppercase tracking-[0.1em] text-[#355f95]">
              {item.category} | {item.date}
            </p>
            <h2 className="mt-2 text-xl font-semibold text-[#10243F]">
              <Link href={item.href} className="hover:text-[#355f95]">
                {item.title}
              </Link>
            </h2>
            <p className="mt-3 text-sm text-slate-700">{item.summary}</p>
            <Link
              href={item.href}
              className="mt-4 inline-flex text-sm font-medium text-[#355f95] underline decoration-[#355f95]/60 underline-offset-2 hover:text-[#10243F]"
            >
              Read article
            </Link>
          </article>
        ))}
      </section>
    </Container>
  );
}
