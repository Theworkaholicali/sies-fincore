import { useEffect, useState } from "react";

const SYMBOLS = ["\u20B9", "%", "\u20B9", "+", "\u20B9", "$", "\u20B9", "\u2211"];

export default function StartupLoader({ onDone }) {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setStage(1), 250),
      setTimeout(() => setStage(2), 900),
      setTimeout(() => setStage(3), 1500),
      setTimeout(() => onDone && onDone(), 2500),
    ];
    return () => timers.forEach(clearTimeout);
  }, [onDone]);

  return (
    <div
      data-testid="startup-loader"
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden"
      style={{ background: "#0B0F17" }}
    >
      {/* floating finance particles */}
      <div className="pointer-events-none absolute inset-0">
        {SYMBOLS.map((s, i) => (
          <span
            key={i}
            className="absolute num text-slate-600/40 select-none"
            style={{
              left: `${8 + i * 11}%`,
              bottom: "18%",
              fontSize: `${14 + (i % 3) * 8}px`,
              animation: `fc-float ${3.2 + (i % 4) * 0.6}s ease-in-out ${i * 0.3}s infinite`,
            }}
          >
            {s}
          </span>
        ))}
      </div>

      {/* flowing transaction line */}
      <svg
        className="pointer-events-none absolute left-0 right-0 top-1/2 -translate-y-1/2 opacity-40"
        viewBox="0 0 800 200"
        preserveAspectRatio="none"
        style={{ height: 200, width: "100%" }}
      >
        <path
          d="M0 140 C 120 60, 200 180, 320 110 S 520 40, 640 120 S 760 90, 800 70"
          fill="none"
          stroke="#F97316"
          strokeWidth="2"
          strokeDasharray="1200"
          strokeDashoffset="1200"
          style={{ animation: "fc-draw 1.8s ease forwards 0.4s" }}
        />
      </svg>

      <div className="relative flex flex-col items-center">
        <div
          className={`transition-all duration-700 ${
            stage >= 1 ? "opacity-100 scale-100" : "opacity-0 scale-90"
          }`}
        >
          <div className="rounded-2xl bg-white p-4 shadow-2xl ring-1 ring-white/10">
            <img
              src="/sies-logo.jpg"
              alt="SIES College"
              className="h-16 w-auto"
            />
          </div>
        </div>

        {stage >= 2 && (
          <div className="fc-anim-up mt-7 text-center">
            <h1 className="text-3xl font-bold tracking-tight text-white">
              SIES <span className="text-brand">FinCore</span>
            </h1>
            <p className="mt-1.5 text-sm text-slate-400">
              Institutional Financial Intelligence Platform
            </p>
          </div>
        )}

        {stage >= 3 && (
          <div className="fc-anim-fade mt-8 h-0.5 w-56 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-brand"
              style={{ animation: "fc-progress 0.9s ease forwards" }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
