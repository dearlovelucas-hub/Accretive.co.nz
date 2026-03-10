"use client";

import { useEffect } from "react";

const floatingBoxes = [
  { top: "8%", left: "7%", size: 74, color: "bg-[#7f9fd1]/20", duration: 17, delay: -3, rotate: -7 },
  { top: "18%", left: "82%", size: 58, color: "bg-[#f3b96f]/22", duration: 15, delay: -8, rotate: 9 },
  { top: "42%", left: "10%", size: 46, color: "bg-[#355f95]/24", duration: 13, delay: -5, rotate: 6 },
  { top: "56%", left: "88%", size: 82, color: "bg-[#8caad7]/20", duration: 19, delay: -11, rotate: -10 },
  { top: "70%", left: "18%", size: 62, color: "bg-[#ffc374]/18", duration: 14, delay: -2, rotate: 5 },
  { top: "84%", left: "78%", size: 50, color: "bg-[#5177b0]/20", duration: 12, delay: -7, rotate: 8 }
];

export default function FrontendBackdrop() {
  useEffect(() => {
    let frameId: number | null = null;

    const updateScrollVars = () => {
      frameId = null;
      const root = document.documentElement;
      const scrollTop = window.scrollY;
      const maxScroll = Math.max(1, root.scrollHeight - window.innerHeight);
      const progress = Math.min(1, scrollTop / maxScroll);

      root.style.setProperty("--scroll-offset", `${scrollTop.toFixed(2)}px`);
      root.style.setProperty("--scroll-progress", progress.toFixed(4));
    };

    const requestFrame = () => {
      if (frameId !== null) {
        return;
      }
      frameId = window.requestAnimationFrame(updateScrollVars);
    };

    requestFrame();
    window.addEventListener("scroll", requestFrame, { passive: true });
    window.addEventListener("resize", requestFrame);

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
      document.documentElement.style.removeProperty("--scroll-offset");
      document.documentElement.style.removeProperty("--scroll-progress");
      window.removeEventListener("scroll", requestFrame);
      window.removeEventListener("resize", requestFrame);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_10%,rgba(120,151,205,0.25),transparent_42%),radial-gradient(circle_at_88%_2%,rgba(251,192,109,0.16),transparent_36%)]" />

      <div
        className="frontend-pattern-primary absolute inset-[-16%] opacity-80"
        style={{ transform: "translate3d(0, calc(var(--scroll-offset, 0px) * -0.14), 0)" }}
      />
      <div
        className="frontend-pattern-secondary absolute inset-[-14%] opacity-70"
        style={{ transform: "translate3d(0, calc(var(--scroll-offset, 0px) * -0.06), 0)" }}
      />

      {floatingBoxes.map((box, index) => (
        <div
          key={`${box.top}-${box.left}-${index}`}
          className="absolute"
          style={{
            top: box.top,
            left: box.left,
            width: `${box.size}px`,
            height: `${box.size}px`,
            transform: `rotate(${box.rotate}deg)`
          }}
        >
          <span
            className={`floating-backdrop-box block h-full w-full rounded-[0.9rem] border border-white/45 ${box.color} shadow-[0_18px_50px_rgba(10,25,46,0.14)] backdrop-blur-[1px]`}
            style={{ animationDuration: `${box.duration}s`, animationDelay: `${box.delay}s` }}
          />
        </div>
      ))}
    </div>
  );
}
