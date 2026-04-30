import { ImageResponse } from "next/og";

import { C } from "@/lib/constants";

export async function GET(request: Request) {
  const baseUrl = new URL(request.url).origin;
  const [frauncesFont, monoFont] = await Promise.all([
    fetch(`${baseUrl}/fonts/fraunces-italic.woff`).then((r) => r.arrayBuffer()),
    fetch(`${baseUrl}/fonts/jetbrains-mono.woff`).then((r) => r.arrayBuffer())
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: `radial-gradient(circle at top left, ${C.paperSoft} 0%, ${C.paperDeep} 100%)`,
          color: C.ink,
          padding: "34px 42px"
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
          <span>Bureau of Onchain Affairs</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontFamily: "Fraunces",
              fontStyle: "italic",
              fontSize: 118,
              lineHeight: 0.88,
              letterSpacing: "-0.05em"
            }}
          >
            The Roast
          </div>
          <div
            style={{
              display: "flex",
              fontFamily: "Fraunces",
              fontStyle: "italic",
              fontSize: 118,
              lineHeight: 0.88,
              letterSpacing: "-0.05em"
            }}
          >
            Report
          </div>

          <div
            style={{
              display: "flex",
              marginTop: 28,
              fontFamily: "JetBrains Mono",
              fontSize: 18,
              letterSpacing: "0.28em",
              textTransform: "uppercase",
              color: C.seal
            }}
          >
            Forensic Audit of Onchain Conduct
          </div>

          <div
            style={{
              display: "flex",
              marginTop: 22,
              maxWidth: 820,
              borderLeft: `3px solid ${C.seal}`,
              paddingLeft: 22,
              fontFamily: "Fraunces",
              fontStyle: "italic",
              fontSize: 32,
              lineHeight: 1.25
            }}
          >
            Submit a wallet. Receive a dry, overfunded institutional response to indefensible NFT behavior.
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
          <div style={{ display: "flex", fontFamily: "Fraunces", fontSize: 20, textTransform: "none", fontStyle: "italic", letterSpacing: "0.02em" }}>
            RoastReport.fun
          </div>
          <div style={{ display: "flex" }}>Wallets reviewed since 2021</div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable"
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
