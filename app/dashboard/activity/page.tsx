"use client";

import { useEffect, useState } from "react";

type ActivityItem = {
  id: string;
  text: string;
  occurredAt: string;
};

function formatRelativeTime(iso: string): string {
  const timestamp = Date.parse(iso);
  if (Number.isNaN(timestamp)) {
    return "Unknown time";
  }

  const diffMs = timestamp - Date.now();
  const diffSeconds = Math.round(diffMs / 1000);

  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const absoluteSeconds = Math.abs(diffSeconds);

  if (absoluteSeconds < 60) {
    return rtf.format(diffSeconds, "second");
  }

  const diffMinutes = Math.round(diffSeconds / 60);
  if (Math.abs(diffMinutes) < 60) {
    return rtf.format(diffMinutes, "minute");
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) {
    return rtf.format(diffHours, "hour");
  }

  const diffDays = Math.round(diffHours / 24);
  return rtf.format(diffDays, "day");
}

export default function ActivityPage() {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadActivity() {
      try {
        setError("");
        setIsLoading(true);

        const response = await fetch("/api/activity");
        const body = (await response.json().catch(() => null)) as { items?: ActivityItem[]; error?: string } | null;

        if (!response.ok) {
          if (mounted) {
            setError(body?.error ?? "Unable to load activity.");
          }
          return;
        }

        if (mounted) {
          setItems(body?.items ?? []);
        }
      } catch {
        if (mounted) {
          setError("Unable to load activity.");
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    void loadActivity();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <section className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.12em] text-[#355f95]">Workspace</p>
        <h1 className="text-2xl font-semibold text-[#10243F]">Activity</h1>
        <p className="mt-2 text-sm text-slate-700">Recent matter, template, and generated-output events.</p>
      </div>

      {error && <p className="rounded-panel border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {isLoading ? (
        <p className="rounded-panel border border-[#d7e4fb] bg-[#f8fbff] p-4 text-sm text-slate-600">Loading activity...</p>
      ) : items.length === 0 ? (
        <p className="rounded-panel border border-[#d7e4fb] bg-[#f8fbff] p-4 text-sm text-slate-600">
          No activity yet. Create a matter, attach inputs, or upload a template to see events here.
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li
              key={item.id}
              className="rounded-panel border border-[#d7e4fb] bg-gradient-to-b from-white to-[#f8fbff] p-4 shadow-[0_10px_24px_rgba(16,36,63,0.06)]"
            >
              <p className="text-sm text-slate-900">{item.text}</p>
              <p className="mt-1 text-xs text-slate-600">{formatRelativeTime(item.occurredAt)}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
