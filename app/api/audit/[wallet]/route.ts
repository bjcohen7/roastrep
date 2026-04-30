import { NextRequest, NextResponse } from "next/server";

import { getAuditReport } from "@/lib/audit";
import { consumeRateLimit } from "@/lib/cache";

type RouteContext = {
  params: Promise<{ wallet: string }>;
};

export async function GET(request: NextRequest, { params }: RouteContext) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rate = await consumeRateLimit(`rate:audit:${ip}`, 10, 60 * 60);
  if (!rate.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded." }, { status: 429 });
  }

  const searchParams = request.nextUrl.searchParams;
  const refresh = searchParams.get("refresh") === "1";

  try {
    const { wallet } = await params;
    const report = await getAuditReport(wallet, { refresh });
    return NextResponse.json(report, {
      headers: {
        "Cache-Control": refresh ? "no-store" : "public, s-maxage=300, stale-while-revalidate=86400"
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Audit failed." },
      { status: 400 }
    );
  }
}
