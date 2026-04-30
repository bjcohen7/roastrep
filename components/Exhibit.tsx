import { C } from "@/lib/constants";
import type { CaseStudy } from "@/lib/types";

type ExhibitProps = {
  data: CaseStudy;
  isOpen: boolean;
  onToggle: () => void;
};

const fontDisplay = "var(--font-fraunces), serif";
const fontMono = "var(--font-jetbrains-mono), monospace";
const fontBody = "var(--font-instrument-serif), serif";

export default function Exhibit({ data, isOpen, onToggle }: ExhibitProps) {
  return (
    <div className="rr-exhibit transition-colors" style={{ borderBottom: `1px solid ${C.ruleSoft}` }}>
      <button
        onClick={onToggle}
        className="w-full text-left py-4 transition-colors"
        style={{
          background: "transparent",
          border: "none",
          padding: "16px 4px",
          cursor: "pointer",
          fontFamily: "inherit",
          color: "inherit"
        }}
      >
        <div className="text-[10px] tracking-[0.26em] uppercase mb-1.5" style={{ fontFamily: fontMono, color: C.seal }}>
          {data.category}
        </div>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3
              className="mb-0.5"
              style={{
                fontFamily: fontDisplay,
                fontStyle: "italic",
                fontSize: "clamp(18px, 4.4vw, 24px)",
                fontVariationSettings: "'SOFT' 100, 'opsz' 144",
                color: C.ink,
                letterSpacing: "-0.01em",
                lineHeight: 1.15
              }}
            >
              {data.title}
            </h3>
            <div className="text-xs sm:text-sm truncate" style={{ fontFamily: fontMono, color: C.inkSoft }}>
              {data.asset}
            </div>
          </div>
          <div
            className="flex-shrink-0 flex items-center justify-center"
            style={{
              fontFamily: fontMono,
              fontSize: 18,
              color: C.inkMute,
              width: 22,
              height: 22,
              lineHeight: 1,
              transform: isOpen ? "rotate(45deg)" : "rotate(0)",
              transition: "transform 0.25s ease"
            }}
          >
            +
          </div>
        </div>
        <div className="text-xs sm:text-sm mt-2" style={{ fontFamily: fontMono, color: C.seal }}>
          {data.counterfactual}
        </div>
      </button>

      {isOpen && (
        <div className="rr-expand pb-5 px-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4 p-4" style={{ background: C.paperSoft, border: `1px solid ${C.ruleSoft}` }}>
            <LedgerRow label="Acquired" date={data.acquired.date} price={data.acquired.price} usd={data.acquired.usd} />
            <LedgerRow label="Disposed" date={data.disposed.date} price={data.disposed.price} usd={data.disposed.usd} />
          </div>

          <div className="text-sm leading-relaxed mb-3" style={{ fontFamily: fontBody, color: C.ink }}>
            <span className="text-[10px] tracking-[0.28em] uppercase mr-2" style={{ fontFamily: fontMono, color: C.inkMute }}>
              Aftermath
            </span>
            {data.aftermath}
          </div>

          <p
            className="leading-relaxed pl-4 italic"
            style={{
              fontFamily: fontBody,
              fontSize: "1rem",
              color: C.inkSoft,
              borderLeft: `2px solid ${C.rule}`
            }}
          >
            {data.commentary}
          </p>

          <div className="mt-3 text-[10px] tracking-[0.28em] uppercase" style={{ fontFamily: fontMono, color: C.inkMute }}>
            Severity · {data.severity}
          </div>
        </div>
      )}
    </div>
  );
}

function LedgerRow({ label, date, price, usd }: { label: string; date: string; price: string; usd: string }) {
  return (
    <div>
      <div className="text-[9px] tracking-[0.32em] uppercase mb-1" style={{ fontFamily: fontMono, color: C.inkMute }}>
        {label}
      </div>
      <div className="text-sm" style={{ fontFamily: fontMono, color: C.ink }}>
        {date}
      </div>
      <div className="text-sm" style={{ fontFamily: fontMono, color: C.inkSoft }}>
        {price} {usd && usd !== "—" && <span>· {usd}</span>}
      </div>
    </div>
  );
}
