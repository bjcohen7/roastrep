"use client";

import { useEffect, useState } from "react";

import ShareCardPreview from "@/components/ShareCardPreview";
import { C, SHARE_TEXT_VARIANTS } from "@/lib/constants";

type ShareModalProps = {
  subject: string;
  subjectSlug: string;
  rating: string;
  label: string;
  outlook: string;
  headline: string;
  caseNumber: string;
  shareBaseUrl: string;
  tweetVariantIdx: number;
  setTweetVariantIdx: React.Dispatch<React.SetStateAction<number>>;
  onClose: () => void;
};

const fontDisplay = "var(--font-fraunces), serif";
const fontMono = "var(--font-jetbrains-mono), monospace";
const fontBody = "var(--font-instrument-serif), serif";

export default function ShareModal({
  subject,
  subjectSlug,
  rating,
  label,
  outlook,
  headline,
  caseNumber,
  shareBaseUrl,
  tweetVariantIdx,
  setTweetVariantIdx,
  onClose
}: ShareModalProps) {
  const [copied, setCopied] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [editableText, setEditableText] = useState(SHARE_TEXT_VARIANTS[tweetVariantIdx](rating));
  const encodedSubjectSlug = encodeURIComponent(subjectSlug);
  const normalizedBaseUrl = shareBaseUrl.startsWith("http") ? shareBaseUrl : `https://${shareBaseUrl}`;
  const fullUrl = `${normalizedBaseUrl}/${encodedSubjectSlug}`;
  const ogImageUrl = `${normalizedBaseUrl}/api/og/${encodedSubjectSlug}`;

  useEffect(() => {
    setEditableText(SHARE_TEXT_VARIANTS[tweetVariantIdx](rating));
  }, [tweetVariantIdx, rating]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const composed = `${editableText}\n\n${fullUrl}`;
  const tweetIntent = `https://twitter.com/intent/tweet?text=${encodeURIComponent(editableText)}&url=${encodeURIComponent(fullUrl)}`;
  const cycleTweet = () => setTweetVariantIdx((value) => (value + 1) % SHARE_TEXT_VARIANTS.length);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {}
  }

  async function copyCaptionAndLink() {
    try {
      await navigator.clipboard.writeText(composed);
      setCopiedAll(true);
      window.setTimeout(() => setCopiedAll(false), 1800);
    } catch {}
  }

  async function downloadCard() {
    try {
      setDownloading(true);
      const response = await fetch(ogImageUrl, { cache: "no-store" });
      if (!response.ok) throw new Error("Download failed");
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = blobUrl;
      anchor.download = `roast-report-${subjectSlug.replace(/[^a-zA-Z0-9.-]+/g, "-")}.png`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(ogImageUrl, "_blank", "noopener");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div
      className="rr-fadein fixed inset-0 z-[60] flex items-start sm:items-center justify-center px-4 py-6 sm:py-10 overflow-y-auto"
      style={{
        background: "rgba(20, 16, 10, 0.72)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)"
      }}
      onClick={onClose}
    >
      <div
        className="rr-modal-in w-full max-w-xl relative"
        onClick={(event) => event.stopPropagation()}
        style={{
          background: C.paper,
          border: `1px solid ${C.ink}`,
          padding: "20px 20px 22px"
        }}
      >
        <button
          onClick={onClose}
          className="absolute right-3 top-3 w-8 h-8 flex items-center justify-center"
          style={{
            fontFamily: fontMono,
            color: C.ink,
            fontSize: 16,
            background: "transparent",
            border: "none",
            cursor: "pointer"
          }}
          aria-label="Close"
        >
          ×
        </button>

        <div className="text-[10px] tracking-[0.28em] uppercase mb-1" style={{ fontFamily: fontMono, color: C.inkMute }}>
          For Publication
        </div>
        <div
          className="mb-4"
          style={{
            fontFamily: fontDisplay,
            fontStyle: "italic",
            fontSize: "clamp(22px, 5vw, 30px)",
            fontVariationSettings: "'SOFT' 100, 'opsz' 144",
            color: C.ink,
            letterSpacing: "-0.01em",
            lineHeight: 1
          }}
        >
          Publish the Findings
        </div>

        <div className="mb-4">
          <ShareCardPreview
            subject={subject}
            rating={rating}
            label={label}
            outlook={outlook}
            headline={headline}
            caseNumber={caseNumber}
            shareBaseUrl={normalizedBaseUrl.replace(/^https?:\/\//, "")}
          />
        </div>

        <div className="mb-4">
          <div className="text-[9px] tracking-[0.28em] uppercase mb-1" style={{ fontFamily: fontMono, color: C.inkMute }}>
            Permalink
          </div>
          <button
            onClick={copyLink}
            className="rr-btn-ghost w-full text-left px-3 py-2.5 transition-colors flex items-center justify-between"
            style={{
              fontFamily: fontMono,
              fontSize: 12,
              color: C.ink,
              background: C.paperSoft,
              border: `1px solid ${C.ruleSoft}`,
              cursor: "pointer"
            }}
          >
            <span className="truncate mr-3">{fullUrl.replace(/^https?:\/\//, "")}</span>
            <span className="text-[9px] tracking-[0.28em] uppercase flex-shrink-0" style={{ color: copied ? C.seal : C.inkMute }}>
              {copied ? "Copied" : "Copy"}
            </span>
          </button>
        </div>

        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <div className="text-[9px] tracking-[0.28em] uppercase" style={{ fontFamily: fontMono, color: C.inkMute }}>
              Caption
            </div>
            <button
              onClick={cycleTweet}
              className="rr-btn-ghost text-[9px] tracking-[0.28em] uppercase px-2 py-1 transition-colors"
              style={{
                fontFamily: fontMono,
                color: C.inkSoft,
                background: "transparent",
                border: "none",
                cursor: "pointer"
              }}
            >
              ↻ Try another
            </button>
          </div>
          <textarea
            value={editableText}
            onChange={(event) => setEditableText(event.target.value)}
            rows={6}
            className="rr-textarea w-full px-3 py-2.5"
            style={{
              fontFamily: fontMono,
              fontSize: 12.5,
              lineHeight: 1.5,
              color: C.ink,
              background: C.paperSoft,
              border: `1px solid ${C.ruleSoft}`
            }}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <button
            onClick={() => window.open(tweetIntent, "_blank", "noopener")}
            className="rr-btn-dark py-3.5 text-[10px] tracking-[0.3em] uppercase transition-colors flex items-center justify-center gap-2"
            style={{
              fontFamily: fontMono,
              background: C.ink,
              color: C.paper,
              border: `1.5px solid ${C.ink}`
            }}
          >
            <span>Post to 𝕏</span>
          </button>
          <button
            onClick={copyCaptionAndLink}
            className="rr-btn py-3.5 text-[10px] tracking-[0.3em] uppercase transition-colors flex items-center justify-center gap-2"
            style={{
              fontFamily: fontMono,
              background: C.paper,
              color: C.ink,
              border: `1.5px solid ${C.ink}`
            }}
          >
            <span>{copiedAll ? "Copied Caption" : "Copy Caption + Link"}</span>
          </button>
          <button
            onClick={downloadCard}
            className="rr-btn py-3.5 text-[10px] tracking-[0.3em] uppercase transition-colors flex items-center justify-center gap-2"
            style={{
              fontFamily: fontMono,
              background: C.paper,
              color: C.ink,
              border: `1.5px solid ${C.ink}`
            }}
          >
            <span>{downloading ? "Preparing Card" : "Download Card PNG"}</span>
          </button>
        </div>

        <div
          className="mt-4 pt-3 text-[9px] italic leading-relaxed"
          style={{
            fontFamily: fontBody,
            color: C.inkMute,
            borderTop: `1px solid ${C.ruleSoft}`
          }}
        >
          The card preview reflects the 1200×630 image rendered server-side via Vercel OG when the permalink is shared.
        </div>
      </div>
    </div>
  );
}
