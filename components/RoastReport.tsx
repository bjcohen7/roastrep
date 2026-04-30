"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import Exhibit from "@/components/Exhibit";
import ShareModal from "@/components/ShareModal";
import { AUDIT_PHASES, C, EMPTY_HEADLINE_STATS, EMPTY_SECONDARY_STATS, ENS_AUDIT_PHASES } from "@/lib/constants";
import type { AuditReport, AuditStage } from "@/lib/types";
import { deterministicCaseNumber, shortAddress } from "@/lib/utils";

type RoastReportProps = {
  initialStage?: AuditStage;
  initialSubject?: string;
  initialError?: string;
  report?: AuditReport | null;
};

const fontDisplay = "var(--font-fraunces), serif";
const fontMono = "var(--font-jetbrains-mono), monospace";
const fontBody = "var(--font-instrument-serif), serif";
const ANALYSIS_STEP_DELAYS = [700, 780, 860, 920, 980, 1040, 1100, 1160, 1220] as const;
const ANALYSIS_REDIRECT_DELAY = 1240;
const BEN_WALLET_EASTER_EGGS = new Set([
  "0x6d53c339d2f0ef9698e77ff5bc55961bd53e2c5b",
  "0xfebb6f14d86d596c49321318bb83987b373b6c9c"
]);
const LIKELY_NON_ETH_WALLET_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,64}$/;

function normalizeReport(report: AuditReport | null, fallbackSubject: string): AuditReport | null {
  if (!report) return null;

  const wallet = typeof report.wallet === "string" && report.wallet.trim() ? report.wallet : fallbackSubject;
  const displayName =
    typeof report.displayName === "string" && report.displayName.trim()
      ? report.displayName
      : (wallet ? shortAddress(wallet) : "Unknown Subject");

  return {
    ...report,
    wallet,
    displayName,
    caseNumber:
      typeof report.caseNumber === "string" && report.caseNumber.trim()
        ? report.caseNumber
        : deterministicCaseNumber(wallet.toLowerCase()),
    generatedAt:
      typeof report.generatedAt === "string" && report.generatedAt.trim()
        ? report.generatedAt
        : new Date().toISOString(),
    summary: {
      periodStart: report.summary?.periodStart ?? "Jan 2021",
      periodEnd: report.summary?.periodEnd ?? "Present",
      txnCount: typeof report.summary?.txnCount === "number" ? report.summary.txnCount : 0,
      realizedPnl: report.summary?.realizedPnl ?? "—",
      unrealizedPnl: report.summary?.unrealizedPnl ?? "—",
      rugCount: typeof report.summary?.rugCount === "number" ? report.summary.rugCount : 0,
      heldToZeroCount: typeof report.summary?.heldToZeroCount === "number" ? report.summary.heldToZeroCount : 0,
      gasSpent: report.summary?.gasSpent ?? "—",
      bestSingleTrade: report.summary?.bestSingleTrade ?? "—",
      worstSingleTrade: report.summary?.worstSingleTrade ?? "—"
    },
    caseStudies: Array.isArray(report.caseStudies)
      ? report.caseStudies.map((caseStudy, index) => ({
          id: caseStudy?.id ?? String(index + 1),
          category: caseStudy?.category ?? `Exhibit ${String.fromCharCode(65 + index)}`,
          title: caseStudy?.title ?? "Record Incomplete",
          asset: caseStudy?.asset ?? "Unspecified asset",
          acquired: {
            date: caseStudy?.acquired?.date ?? "Undated",
            price: caseStudy?.acquired?.price ?? "—",
            usd: caseStudy?.acquired?.usd ?? "—"
          },
          disposed: {
            date: caseStudy?.disposed?.date ?? "Undated",
            price: caseStudy?.disposed?.price ?? "—",
            usd: caseStudy?.disposed?.usd ?? "—"
          },
          aftermath: caseStudy?.aftermath ?? "The supporting record arrived in compromised condition.",
          counterfactual: caseStudy?.counterfactual ?? "Counterfactual upside unavailable.",
          commentary: caseStudy?.commentary ?? "The Bureau declines to invent facts where the file has already failed.",
          severity: caseStudy?.severity ?? "Administrative"
        }))
      : [],
    severityRating: {
      grade: report.severityRating?.grade ?? "C",
      label: report.severityRating?.label ?? "Under Review",
      outlook: report.severityRating?.outlook ?? "Stable",
      blurb:
        report.severityRating?.blurb ??
        "The Bureau encountered an irregular file and has elected to present the surviving findings without overpromising precision."
    },
    headlineFinding: {
      text: report.headlineFinding?.text ?? "The Bureau located irregularities in the subject's file.",
      loss: report.headlineFinding?.loss ?? "Some portion of the evidence remains too embarrassing to summarize cleanly."
    },
    shareBaseUrl:
      typeof report.shareBaseUrl === "string" && report.shareBaseUrl.trim()
        ? report.shareBaseUrl
        : "roastreport.fun"
  };
}

export default function RoastReport({
  initialStage = "intake",
  initialSubject = "",
  initialError = "",
  report = null
}: RoastReportProps) {
  const router = useRouter();
  const safeReport = normalizeReport(report, initialSubject);
  const [input, setInput] = useState(initialSubject);
  const [stage, setStage] = useState<AuditStage>(safeReport ? "verdict" : initialStage);
  const [error, setError] = useState(initialError);
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [analysisTarget, setAnalysisTarget] = useState("");
  const [analysisStatus, setAnalysisStatus] = useState<"idle" | "pending" | "ready" | "failed">("idle");
  const [analysisError, setAnalysisError] = useState("");
  const [resolvedAddress, setResolvedAddress] = useState(safeReport?.wallet ?? "");
  const [resolvedEns, setResolvedEns] = useState(safeReport?.displayName?.endsWith(".eth") ? safeReport.displayName : "");
  const [showShare, setShowShare] = useState(false);
  const [tweetVariantIdx, setTweetVariantIdx] = useState(0);
  const [expandedExhibit, setExpandedExhibit] = useState<string | null>(null);
  const [showAllStats, setShowAllStats] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const caseNumber = safeReport?.caseNumber ?? deterministicCaseNumber((resolvedAddress || input || "placeholder").toLowerCase());
  const subjectName = safeReport?.displayName ?? resolvedEns ?? (resolvedAddress ? shortAddress(resolvedAddress) : "");
  const reportDisplayName = safeReport?.displayName;
  const subjectSlug =
    reportDisplayName?.endsWith(".eth")
      ? reportDisplayName
      : (safeReport?.wallet ?? resolvedEns ?? resolvedAddress);

  const summary = safeReport?.summary;
  const headlineStats = summary ? EMPTY_HEADLINE_STATS(summary) : [];
  const secondaryStats = summary ? EMPTY_SECONDARY_STATS(summary) : [];
  const isEnsSubject = Boolean(resolvedEns || input.trim().toLowerCase().endsWith(".eth"));
  const auditPhases = isEnsSubject ? ENS_AUDIT_PHASES : AUDIT_PHASES;
  const showBenGif = Boolean(safeReport?.wallet && BEN_WALLET_EASTER_EGGS.has(safeReport.wallet.toLowerCase()));

  useEffect(() => {
    if (stage !== "analyzing") return;
    if (!analysisTarget) return;

    let cancelled = false;
    const controller = new AbortController();

    setAnalysisStatus("pending");
    setAnalysisError("");

    fetch(`/api/audit/${encodeURIComponent(analysisTarget)}`, {
      method: "GET",
      signal: controller.signal,
      cache: "no-store"
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (cancelled) return;

        if (!response.ok) {
          const publicError =
            typeof payload?.error === "string" && payload.error.trim()
              ? payload.error
              : "The Bureau could not complete this review at present. Please try again shortly.";
          setAnalysisStatus("failed");
          setAnalysisError(publicError);
          return;
        }

        setAnalysisStatus("ready");
      })
      .catch((fetchError) => {
        if (cancelled || fetchError?.name === "AbortError") return;
        setAnalysisStatus("failed");
        setAnalysisError("The Bureau could not complete this review at present. Please try again shortly.");
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [stage, analysisTarget]);

  useEffect(() => {
    if (stage !== "analyzing") return;
    if (phaseIdx >= auditPhases.length) {
      if (analysisStatus === "failed") {
        const timeout = window.setTimeout(() => {
          setStage("intake");
          setError(analysisError || "The Bureau could not complete this review at present. Please try again shortly.");
          setPhaseIdx(0);
          setAnalysisTarget("");
          setAnalysisStatus("idle");
          setAnalysisError("");
        }, 400);
        return () => window.clearTimeout(timeout);
      }

      if (analysisStatus !== "ready") return;

      const timeout = window.setTimeout(() => {
        router.push(`/${encodeURIComponent(analysisTarget)}`);
      }, ANALYSIS_REDIRECT_DELAY);
      return () => window.clearTimeout(timeout);
    }
    const stepDelay = ANALYSIS_STEP_DELAYS[Math.min(phaseIdx, ANALYSIS_STEP_DELAYS.length - 1)] ?? 420;
    const timeout = window.setTimeout(() => setPhaseIdx((value) => value + 1), stepDelay);
    return () => window.clearTimeout(timeout);
  }, [stage, phaseIdx, router, auditPhases.length, analysisStatus, analysisError, analysisTarget]);

  useEffect(() => {
    if (!showShare) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [showShare]);

  const css = useMemo(
    () => `
    @keyframes blink { 0%, 60% { opacity: 1; } 60.1%, 100% { opacity: 0; } }
    @keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes expand { from { opacity: 0; max-height: 0; } to { opacity: 1; max-height: 1200px; } }
    @keyframes stamp {
      0% { opacity: 0; transform: scale(1.6) rotate(-12deg); }
      60% { opacity: 1; transform: scale(0.95) rotate(-12deg); }
      100% { opacity: 1; transform: scale(1) rotate(-12deg); }
    }
    @keyframes scan { from { transform: translateY(-100%); } to { transform: translateY(100%); } }
    .rr-fadeup { animation: fadeUp 0.7s cubic-bezier(.2,.7,.2,1) both; }
    .rr-fadein { animation: fadeIn 0.25s ease-out both; }
    .rr-modal-in { animation: fadeUp 0.35s cubic-bezier(.2,.7,.2,1) both; }
    .rr-expand { animation: expand 0.4s cubic-bezier(.2,.7,.2,1) both; overflow: hidden; }
    .rr-caret::after { content: "▌"; margin-left: 2px; animation: blink 1.1s steps(1) infinite; color: ${C.seal}; font-weight: 300; }
    .rr-stamp { animation: stamp 0.5s cubic-bezier(.3,1.4,.5,1) both; }
    .rr-scan { position: absolute; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, transparent, ${C.seal}, transparent); opacity: 0.35; animation: scan 2.4s linear infinite; }
    .rr-grain { position: fixed; inset: 0; pointer-events: none; z-index: 50; mix-blend-mode: multiply; opacity: 0.18; background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%25' height='100%25' filter='url(%23n)' opacity='0.6'/></svg>"); }
    .rr-input::placeholder { color: ${C.rule}; font-style: italic; }
    .rr-input:focus { outline: none; }
    .rr-btn { transition: background-color 180ms ease, color 180ms ease, transform 180ms ease, box-shadow 180ms ease, letter-spacing 180ms ease; }
    .rr-btn:hover {
      background: ${C.ink};
      color: ${C.paper};
      transform: translateY(-1px);
      box-shadow: 0 10px 24px rgba(33, 24, 20, 0.14);
      letter-spacing: 0.36em;
    }
    .rr-btn:active { transform: translateY(1px); }
    .rr-btn-dark:hover { background: ${C.paper}; color: ${C.ink}; }
    .rr-btn-ghost:hover { background: rgba(0,0,0,0.04); }
    .rr-exhibit:hover { background: rgba(0,0,0,0.02); }
    .rr-textarea { resize: none; }
    .rr-textarea:focus { outline: 1px solid ${C.ink}; outline-offset: 2px; }
  `,
    []
  );

  function validate(value: string) {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return null;
    if (/^0x[a-f0-9]{40}$/.test(normalized)) return { type: "address" as const, value: normalized };
    if (/^[a-z0-9][a-z0-9-]{0,62}\.eth$/.test(normalized)) return { type: "ens" as const, value: normalized };
    if (LIKELY_NON_ETH_WALLET_REGEX.test(value.trim())) return { type: "unsupported" as const, value: value.trim() };
    return null;
  }

  function handleSubmit() {
    setError("");
    const result = validate(input);
    if (!result) {
      setError("Subject identifier is malformed. Provide a valid wallet (0x…) or ENS name (name.eth).");
      return;
    }
    if (result.type === "unsupported") {
      setError("The Bureau does not audit foreign jurisdictions. This office covers Ethereum only.");
      return;
    }
    if (result.type === "ens") {
      setResolvedEns(result.value);
      setResolvedAddress("");
    } else {
      setResolvedEns("");
      setResolvedAddress(result.value);
    }
    setStage("analyzing");
    setPhaseIdx(0);
    setAnalysisTarget(result.value);
    setAnalysisStatus("idle");
    setAnalysisError("");
  }

  function reset() {
    setStage("intake");
    setInput("");
    setError("");
    setPhaseIdx(0);
    setAnalysisTarget("");
    setAnalysisStatus("idle");
    setAnalysisError("");
    setResolvedAddress("");
    setResolvedEns("");
    setExpandedExhibit(null);
    setShowAllStats(false);
    window.setTimeout(() => inputRef.current?.focus(), 100);
  }

  function openShare() {
    setTweetVariantIdx(Math.floor(Math.random() * 4));
    setShowShare(true);
  }

  return (
    <div
      className="min-h-screen w-full flex items-start justify-center px-4 sm:px-5 py-6 sm:py-10 relative"
      style={{
        background: `radial-gradient(ellipse at top, ${C.paper} 0%, ${C.paperDeep} 100%)`,
        fontFamily: fontBody,
        color: C.ink
      }}
    >
      <style>{css}</style>
      <div className="rr-grain" />
      <div className="w-full max-w-3xl relative">
        <div
          className="flex items-center justify-between text-[9px] sm:text-[10px] tracking-[0.22em] uppercase pb-3 mb-6 sm:mb-8 rr-fadeup"
          style={{
            borderBottom: `1px solid ${C.rule}`,
            fontFamily: fontMono,
            color: C.inkSoft,
            letterSpacing: "0.18em"
          }}
        >
          <span>Est. 2026</span>
          <span className="hidden sm:inline">Bureau of Onchain Affairs</span>
          <span>Case №{caseNumber}</span>
        </div>

        {stage === "intake" && (
          <div className="rr-fadeup">
            <div className="text-center mb-2">
              <div style={{ fontFamily: fontDisplay, fontSize: "clamp(48px, 11vw, 92px)", fontWeight: 400, fontStyle: "italic", fontVariationSettings: "'SOFT' 100, 'opsz' 144", lineHeight: 0.95, letterSpacing: "-0.02em" }}>
                The Roast
              </div>
              <div style={{ fontFamily: fontDisplay, fontSize: "clamp(48px, 11vw, 92px)", fontWeight: 400, fontStyle: "italic", fontVariationSettings: "'SOFT' 100, 'opsz' 144", lineHeight: 0.95, letterSpacing: "-0.02em", marginTop: "-0.05em" }}>
                Report
              </div>
            </div>

            <div className="text-center mt-6 mb-2 text-[11px] tracking-[0.32em] uppercase" style={{ fontFamily: fontMono, color: C.inkSoft }}>
              Forensic Audit of Onchain Conduct
            </div>
            <div className="text-center mb-10 text-[10px] tracking-[0.28em] uppercase" style={{ fontFamily: fontMono, color: C.inkMute }}>
              Period of review · Jan 2021 – Apr 2026
            </div>

            <div className="flex items-center justify-center gap-4 mb-10">
              <div style={{ height: 1, flex: 1, maxWidth: 110, background: C.rule }} />
              <span style={{ fontFamily: fontDisplay, fontStyle: "italic", fontSize: 22, color: C.rule }}>§</span>
              <div style={{ height: 1, flex: 1, maxWidth: 110, background: C.rule }} />
            </div>

            <div className="max-w-md mx-auto">
              <label className="block text-[10px] tracking-[0.28em] uppercase mb-3" style={{ fontFamily: fontMono, color: C.inkSoft }}>
                Subject Identifier
              </label>
              <div style={{ borderBottom: `1.5px solid ${C.ink}`, paddingBottom: 8 }}>
                <input
                  ref={inputRef}
                  type="text"
                  autoFocus
                  spellCheck={false}
                  autoComplete="off"
                  value={input}
                  onChange={(event) => {
                    setInput(event.target.value);
                    if (error) setError("");
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") handleSubmit();
                  }}
                  placeholder="0x.... or ENS"
                  className="rr-input w-full bg-transparent text-base sm:text-lg"
                  style={{ fontFamily: fontMono, color: C.ink, border: "none", padding: 0 }}
                />
              </div>

              {error && <div className="mt-3 text-xs italic rr-fadeup" style={{ color: C.seal, fontFamily: fontBody }}>{error}</div>}

              <button
                onClick={handleSubmit}
                disabled={!input.trim()}
                className="rr-btn w-full mt-8 py-4 text-[11px] tracking-[0.32em] uppercase transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ fontFamily: fontMono, background: C.paper, color: C.ink, border: `1.5px solid ${C.ink}`, fontWeight: 500 }}
              >
                Submit for Extended Review
              </button>

              <p className="mt-8 text-xs italic text-center leading-relaxed px-4" style={{ color: C.inkSoft, fontFamily: fontBody }}>
                By submitting, the subject consents to a thorough,
                <br />
                unflattering review of all onchain activity since 2021.
              </p>
            </div>
          </div>
        )}

        {stage === "analyzing" && (
          <div className="rr-fadeup">
            <div className="text-center text-[10px] tracking-[0.28em] uppercase mb-8" style={{ fontFamily: fontMono, color: C.inkSoft }}>
              File Opened · Subject under review
            </div>
            <div className="text-center mb-3" style={{ fontFamily: fontDisplay, fontStyle: "italic", fontSize: "clamp(28px, 6vw, 44px)", fontVariationSettings: "'SOFT' 100, 'opsz' 144", lineHeight: 1.1, letterSpacing: "-0.01em" }}>
              {resolvedEns || input.trim()}
            </div>
            {resolvedEns && <div className="text-center text-xs mb-10" style={{ fontFamily: fontMono, color: C.inkSoft }}>ENS record under verification</div>}
            {!resolvedEns && <div className="mb-10" />}

            <div className="relative max-w-md mx-auto p-6 sm:p-8 overflow-hidden" style={{ border: `1px solid ${C.rule}`, background: "rgba(255,255,255,0.25)" }}>
              <div className="rr-scan" />
              <div className="text-[10px] tracking-[0.28em] uppercase mb-5" style={{ fontFamily: fontMono, color: C.inkSoft }}>
                Audit Log
              </div>
              <ul className="space-y-2.5">
                {auditPhases.map((phase, index) => {
                  const done = index < phaseIdx;
                  const active = index === phaseIdx;
                  const pending = index > phaseIdx;
                  return (
                    <li
                      key={phase}
                      className="flex items-start gap-3 text-sm"
                      style={{
                        fontFamily: fontMono,
                        color: pending ? C.rule : C.ink,
                        opacity: pending ? 0.5 : 1,
                        transition: "opacity 0.3s, color 0.3s"
                      }}
                    >
                      <span style={{ color: done ? C.seal : active ? C.ink : C.rule, width: 14, flexShrink: 0 }}>
                        {done ? "✓" : active ? "›" : "·"}
                      </span>
                      <span className={active ? "rr-caret" : ""}>{phase}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}

        {stage === "verdict" && safeReport && (
          <div className="rr-fadeup relative">
            <div
              className="rr-stamp absolute right-1 sm:right-6 -top-1 sm:top-2 pointer-events-none select-none"
              style={{ border: `2.5px solid ${C.seal}`, color: C.seal, padding: "5px 9px", fontFamily: fontMono, fontSize: 9, letterSpacing: "0.2em", fontWeight: 500, opacity: 0.78 }}
            >
              REVIEWED
            </div>

            <a
              href="/"
              className="mb-2"
              style={{
                display: "inline-block",
                fontFamily: fontDisplay,
                fontStyle: "italic",
                fontSize: "clamp(18px, 3vw, 24px)",
                fontVariationSettings: "'SOFT' 100, 'opsz' 144",
                color: C.seal,
                letterSpacing: "-0.01em",
                textDecoration: "none"
              }}
            >
              RoastReport.fun
            </a>

            <div className="text-[9px] sm:text-[10px] tracking-[0.28em] uppercase mb-3" style={{ fontFamily: fontMono, color: C.inkSoft }}>
              Findings · Case №{safeReport.caseNumber}
            </div>

            <h1 className="leading-none mb-2" style={{ fontFamily: fontDisplay, fontStyle: "italic", fontSize: "clamp(36px, 8.5vw, 68px)", fontVariationSettings: "'SOFT' 100, 'opsz' 144", color: C.ink, letterSpacing: "-0.02em" }}>
              The Verdict
            </h1>
            <div className="text-xs sm:text-sm mb-1" style={{ fontFamily: fontMono, color: C.inkSoft }}>
              Subject · {safeReport.displayName}
            </div>
            <div className="text-[10px] sm:text-xs mb-6" style={{ fontFamily: fontMono, color: C.inkMute }}>
              Period · {safeReport.summary.periodStart} – {safeReport.summary.periodEnd}
            </div>

            <div className="mb-5 p-5 sm:p-8" style={{ background: C.ink, color: C.paper }}>
              <div className="text-[9px] sm:text-[10px] tracking-[0.28em] uppercase mb-4" style={{ fontFamily: fontMono, color: C.ruleSoft }}>
                Final Assessment
              </div>

              <div className="flex items-baseline gap-4 sm:gap-6 flex-wrap">
                <div style={{ fontFamily: fontDisplay, fontStyle: "italic", fontSize: "clamp(64px, 18vw, 120px)", fontVariationSettings: "'SOFT' 60, 'opsz' 144", lineHeight: 0.85, color: C.paper, letterSpacing: "-0.04em" }}>
                  {safeReport.severityRating.grade}
                </div>
                <div>
                  <div style={{ fontFamily: fontDisplay, fontStyle: "italic", fontSize: "clamp(20px, 5vw, 28px)", color: C.paper, lineHeight: 1 }}>
                    {safeReport.severityRating.label}
                  </div>
                  <div className="text-[9px] sm:text-[10px] tracking-[0.28em] uppercase mt-1.5" style={{ fontFamily: fontMono, color: C.ruleSoft }}>
                    Outlook · {safeReport.severityRating.outlook}
                  </div>
                </div>
              </div>

              <div className="my-5 sm:my-7" style={{ height: 1, background: C.ruleSoft, opacity: 0.25 }} />

              <div className="text-[9px] sm:text-[10px] tracking-[0.28em] uppercase mb-3" style={{ fontFamily: fontMono, color: C.ruleSoft }}>
                Headline Finding
              </div>
              <p style={{ fontFamily: fontDisplay, fontStyle: "italic", fontSize: "clamp(17px, 4.2vw, 24px)", fontVariationSettings: "'SOFT' 100, 'opsz' 144", lineHeight: 1.25, color: C.paper, letterSpacing: "-0.01em" }}>
                {safeReport.headlineFinding.text}
              </p>
              <div className="mt-3 text-xs sm:text-sm" style={{ fontFamily: fontMono, color: C.ruleSoft }}>
                {safeReport.headlineFinding.loss}
              </div>
            </div>

            {showBenGif && (
              <div
                className="mb-8 p-4 sm:p-5"
                style={{
                  background: C.paperSoft,
                  border: `1px solid ${C.ruleSoft}`
                }}
              >
                <div
                  className="text-[9px] sm:text-[10px] tracking-[0.28em] uppercase mb-3"
                  style={{ fontFamily: fontMono, color: C.seal }}
                >
                  Supplemental Finding
                </div>
                <img
                  src="/easter-eggs/jack-nicholson-yes.gif"
                  alt="Jack Nicholson nodding yes"
                  className="w-full h-auto block mb-3"
                  style={{ border: `1px solid ${C.ruleSoft}` }}
                />
                <div
                  style={{
                    fontFamily: fontDisplay,
                    fontStyle: "italic",
                    fontSize: "clamp(18px, 4vw, 24px)",
                    color: C.ink,
                    letterSpacing: "-0.01em"
                  }}
                >
                  The Bureau recognizes the subject and has elected, reluctantly, to let him cook.
                </div>
                <div
                  className="mt-2 text-xs sm:text-sm"
                  style={{ fontFamily: fontMono, color: C.inkSoft, lineHeight: 1.6 }}
                >
                  Internal note: yes, it is him. Please be normal about it.
                </div>
              </div>
            )}

            <button
              onClick={openShare}
              className="rr-btn-dark w-full mb-10 py-4 text-[11px] tracking-[0.32em] uppercase transition-colors duration-200 flex items-center justify-center gap-2"
              style={{ fontFamily: fontMono, background: C.ink, color: C.paper, border: `1.5px solid ${C.ink}`, fontWeight: 500 }}
            >
              <span>Publish the Findings</span>
              <span style={{ fontSize: 14 }}>→</span>
            </button>

            <div className="mb-10">
              <div className="text-[10px] tracking-[0.28em] uppercase mb-4 pb-2" style={{ fontFamily: fontMono, color: C.inkMute, borderBottom: `1px solid ${C.rule}` }}>
                Summary
              </div>
              <div className="grid grid-cols-2 gap-x-5 gap-y-4">
                {headlineStats.map((item) => <Stat key={item.label} {...item} />)}
                {showAllStats && secondaryStats.map((item) => <div key={item.label} className="rr-fadeup"><Stat {...item} /></div>)}
              </div>
              <button
                onClick={() => setShowAllStats((value) => !value)}
                className="rr-btn-ghost mt-4 text-[10px] tracking-[0.28em] uppercase py-1 transition-colors"
                style={{ fontFamily: fontMono, color: C.inkMute, background: "transparent", border: "none", cursor: "pointer" }}
              >
                {showAllStats ? "− Hide details" : "+ Show all metrics"}
              </button>
            </div>

            <div className="mb-10">
              <div className="text-[10px] tracking-[0.28em] uppercase mb-4 pb-2 flex items-center justify-between" style={{ fontFamily: fontMono, color: C.inkMute, borderBottom: `1px solid ${C.rule}` }}>
                <span>The Exhibits</span>
                <span style={{ fontSize: 9 }}>{safeReport.caseStudies.length} cases · tap to read</span>
              </div>
              <div className="space-y-2">
                {safeReport.caseStudies.map((caseStudy) => (
                  <Exhibit
                    key={caseStudy.id}
                    data={caseStudy}
                    isOpen={expandedExhibit === caseStudy.id}
                    onToggle={() => setExpandedExhibit(expandedExhibit === caseStudy.id ? null : caseStudy.id)}
                  />
                ))}
              </div>
            </div>

            <p className="leading-relaxed text-base sm:text-lg italic mb-10 max-w-2xl" style={{ fontFamily: fontBody, color: C.inkSoft }}>
              {safeReport.severityRating.blurb}
            </p>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={openShare}
                className="rr-btn-dark py-3 px-5 text-[11px] tracking-[0.3em] uppercase transition-colors duration-200"
                style={{ fontFamily: fontMono, background: C.ink, color: C.paper, border: `1.5px solid ${C.ink}` }}
              >
                Publish
              </button>
              <button
                onClick={reset}
                className="rr-btn py-3 px-5 text-[11px] tracking-[0.3em] uppercase transition-colors duration-200"
                style={{ fontFamily: fontMono, background: C.paper, color: C.ink, border: `1.5px solid ${C.ink}` }}
              >
                Audit Another Wallet
              </button>
            </div>
          </div>
        )}

        <div
          className="mt-12 sm:mt-16 pt-4 flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-0 text-[9px] tracking-[0.28em] uppercase"
          style={{ borderTop: `1px solid ${C.rule}`, fontFamily: fontMono, color: C.rule }}
        >
          <span>Confidential</span>
          <a
            href="https://x.com/mr_benft"
            target="_blank"
            rel="noreferrer"
            style={{ color: C.rule, textDecoration: "none" }}
          >
            A @mr_benft Production
          </a>
          <span>Folio I/I</span>
        </div>
      </div>

      {showShare && safeReport && (
        <ShareModal
          subject={safeReport.displayName}
          subjectSlug={subjectSlug}
          rating={safeReport.severityRating.grade}
          label={safeReport.severityRating.label}
          outlook={safeReport.severityRating.outlook}
          headline={safeReport.headlineFinding.text}
          caseNumber={safeReport.caseNumber}
          shareBaseUrl={safeReport.shareBaseUrl}
          tweetVariantIdx={tweetVariantIdx}
          setTweetVariantIdx={setTweetVariantIdx}
          onClose={() => setShowShare(false)}
        />
        )}

        {stage === "analyzing" && phaseIdx >= auditPhases.length && analysisStatus === "pending" && (
          <div className="mt-6 text-center text-xs italic rr-fadein" style={{ color: C.inkSoft, fontFamily: fontBody }}>
            The Bureau has finished its ceremonial checklist and is waiting on the chain to produce the receipts.
          </div>
        )}
      </div>
  );
}

function Stat({ label, value, negative, positive }: { label: string; value: string | number; negative?: boolean; positive?: boolean }) {
  const color = negative ? C.seal : positive ? C.gold : C.ink;
  return (
    <div>
      <div className="text-[10px] tracking-[0.26em] uppercase mb-1" style={{ fontFamily: fontMono, color: C.inkMute }}>
        {label}
      </div>
      <div style={{ fontFamily: fontDisplay, fontStyle: "italic", fontSize: "clamp(18px, 4vw, 24px)", color, letterSpacing: "-0.01em", lineHeight: 1.15 }}>
        {value}
      </div>
    </div>
  );
}
