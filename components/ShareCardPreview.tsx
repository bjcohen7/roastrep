import { C } from "@/lib/constants";

type ShareCardPreviewProps = {
  subject: string;
  rating: string;
  label: string;
  outlook: string;
  headline: string;
  caseNumber: string;
  shareBaseUrl?: string;
};

const fontDisplay = "var(--font-fraunces), serif";
const fontMono = "var(--font-jetbrains-mono), monospace";
const fontBody = "var(--font-instrument-serif), serif";

export default function ShareCardPreview({
  subject,
  rating,
  label,
  outlook,
  headline,
  caseNumber,
  shareBaseUrl = "theroastreport.xyz"
}: ShareCardPreviewProps) {
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: "1.91 / 1",
        background: `radial-gradient(ellipse at top left, ${C.paperSoft} 0%, ${C.paperDeep} 100%)`,
        border: `1px solid ${C.ruleSoft}`,
        overflow: "hidden",
        padding: "4.2% 4.5%",
        display: "flex",
        flexDirection: "column",
        boxShadow: `0 1px 0 ${C.rule}, 0 12px 30px -12px rgba(20,16,10,0.25)`
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontFamily: fontMono,
          fontSize: "calc(0.6em + 0.18vw)",
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: C.inkSoft,
          paddingBottom: 6,
          borderBottom: `1px solid ${C.rule}`
        }}
      >
        <span>Est. 2026</span>
        <span>Case №{caseNumber}</span>
      </div>

      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          gap: "5%",
          minHeight: 0,
          paddingTop: "3%"
        }}
      >
        <div style={{ flex: "0 0 auto" }}>
          <div
            style={{
              fontFamily: fontDisplay,
              fontStyle: "italic",
              fontSize: "clamp(48px, 13vw, 110px)",
              fontVariationSettings: "'SOFT' 60, 'opsz' 144",
              lineHeight: 0.85,
              color: C.ink,
              letterSpacing: "-0.04em"
            }}
          >
            {rating}
          </div>
          <div
            style={{
              fontFamily: fontMono,
              fontSize: "clamp(7px, 1.1vw, 10px)",
              letterSpacing: "0.26em",
              textTransform: "uppercase",
              color: C.seal,
              marginTop: 6,
              fontWeight: 500
            }}
          >
            {label} · Outlook {outlook}
          </div>
        </div>

        <div
          style={{
            flex: 1,
            paddingLeft: "5%",
            borderLeft: `1px solid ${C.rule}`,
            minWidth: 0
          }}
        >
          <div
            style={{
              fontFamily: fontMono,
              fontSize: "clamp(7px, 1.1vw, 10px)",
              letterSpacing: "0.26em",
              textTransform: "uppercase",
              color: C.inkMute,
              marginBottom: 4
            }}
          >
            Final Assessment of
          </div>
          <div
            style={{
              fontFamily: fontDisplay,
              fontStyle: "italic",
              fontSize: "clamp(14px, 3.2vw, 26px)",
              fontVariationSettings: "'SOFT' 100, 'opsz' 144",
              color: C.ink,
              letterSpacing: "-0.01em",
              lineHeight: 1.05,
              marginBottom: "5%",
              wordBreak: "break-word"
            }}
          >
            {subject}
          </div>

          <div
            style={{
              borderLeft: `2px solid ${C.seal}`,
              paddingLeft: "4%",
              fontFamily: fontBody,
              fontStyle: "italic",
              fontSize: "clamp(10px, 1.7vw, 14px)",
              lineHeight: 1.35,
              color: C.ink,
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
              overflow: "hidden"
            }}
          >
            "{headline}"
          </div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontFamily: fontMono,
          fontSize: "clamp(7px, 1vw, 10px)",
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: C.inkSoft,
          paddingTop: 6,
          borderTop: `1px solid ${C.rule}`
        }}
      >
        <span
          style={{
            fontFamily: fontDisplay,
            fontStyle: "italic",
            letterSpacing: "0.02em",
            textTransform: "none",
            fontSize: "clamp(11px, 1.6vw, 14px)",
            color: C.ink
          }}
        >
          The Roast Report
        </span>
        <span>{shareBaseUrl}</span>
      </div>
    </div>
  );
}
