import { ImageResponse } from "@vercel/og";

import { getAuditReport, auditVersionHash } from "@/lib/audit";
import { C } from "@/lib/constants";

export const runtime = "edge";

type RouteContext = {
  params: Promise<{ wallet: string }>;
};

export async function GET(request: Request, { params }: RouteContext) {
  const { wallet } = await params;
  const report = await getAuditReport(wallet);
  const version = auditVersionHash(report);

  const [frauncesFont, monoFont] = await Promise.all([
    fetch(new URL("/fonts/fraunces-italic.woff", request.url)).then((response) => response.arrayBuffer()),
    fetch(new URL("/fonts/jetbrains-mono.woff", request.url)).then((response) => response.arrayBuffer())
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          display: "flex",
          flexDirection: "column",
          background: `radial-gradient(circle at top left, ${C.paperSoft} 0%, ${C.paperDeep} 100%)`,
          color: C.ink,
          padding: "34px 42px",
          position: "relative"
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontFamily: "JetBrains Mono",
            fontSize: 14,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: C.inkSoft,
            borderBottom: `1px solid ${C.rule}`,
            paddingBottom: 12
          }}
        >
          <span>Est. 2026</span>
          <span>Case №{report.caseNumber}</span>
        </div>

        <div style={{ display: "flex", flex: 1, alignItems: "center", gap: 48 }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                fontFamily: "Fraunces",
                fontStyle: "italic",
                fontSize: 152,
                lineHeight: 0.82,
                letterSpacing: "-0.04em"
              }}
            >
              {report.severityRating.grade}
            </div>
            <div
              style={{
                fontFamily: "JetBrains Mono",
                fontSize: 16,
                letterSpacing: "0.26em",
                textTransform: "uppercase",
                color: C.seal,
                marginTop: 12
              }}
            >
              {report.severityRating.label} · Outlook {report.severityRating.outlook}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              borderLeft: `1px solid ${C.rule}`,
              paddingLeft: 42,
              flex: 1
            }}
          >
            <div
              style={{
                fontFamily: "JetBrains Mono",
                fontSize: 14,
                letterSpacing: "0.26em",
                textTransform: "uppercase",
                color: C.inkMute,
                marginBottom: 8
              }}
            >
              Final Assessment of
            </div>
            <div
              style={{
                fontFamily: "Fraunces",
                fontStyle: "italic",
                fontSize: 44,
                lineHeight: 1.02,
                marginBottom: 24
              }}
            >
              {report.displayName}
            </div>
            <div
              style={{
                display: "flex",
                borderLeft: `3px solid ${C.seal}`,
                paddingLeft: 22,
                fontSize: 28,
                lineHeight: 1.3,
                fontStyle: "italic"
              }}
            >
              "{report.headlineFinding.text}"
            </div>
            <div
              style={{
                display: "flex",
                marginTop: 18,
                fontFamily: "JetBrains Mono",
                fontSize: 16,
                color: C.inkSoft
              }}
            >
              {report.headlineFinding.loss}
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderTop: `1px solid ${C.rule}`,
            paddingTop: 12,
            fontFamily: "JetBrains Mono",
            fontSize: 14,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: C.inkSoft
          }}
        >
          <div style={{ display: "flex", fontFamily: "Fraunces", fontSize: 20, letterSpacing: "0.02em", textTransform: "none", fontStyle: "italic" }}>
            The Roast Report
          </div>
          <div style={{ display: "flex" }}>{report.shareBaseUrl.replace(/^https?:\/\//, "")}</div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        "Cache-Control": `public, max-age=31536000, immutable`,
        ETag: version
      },
      fonts: [
        {
          name: "Fraunces",
          data: frauncesFont,
          weight: 400,
          style: "italic"
        },
        {
          name: "JetBrains Mono",
          data: monoFont,
          weight: 400,
          style: "normal"
        }
      ]
    }
  );
}
