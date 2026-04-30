import { NextRequest, NextResponse } from "next/server";

import { getAuditReport } from "@/lib/audit";
import { consumeRateLimit } from "@/lib/cache";
import { toPublicAuditError } from "@/lib/public-errors";

type RouteContext = {
  params: Promise<{ wallet: string }>;
};

/** Maximum time (ms) the audit route is allowed to run before returning a timeout error. */
const ROUTE_TIMEOUT_MS = 22_000;

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const rate = await consumeRateLimit(`rate:audit:${ip}`, 10, 60 * 60);
    const rateHeaders = {
      "X-RateLimit-Limit": "10",
      "X-RateLimit-Remaining": String(rate.remaining)
    };

    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded." },
        { status: 429, headers: rateHeaders }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const refresh = searchParams.get("refresh") === "1";

    try {
      const { wallet } = await params;

      const report = await Promise.race([
        getAuditReport(wallet, { refresh }),
        rejectAfterTimeout(ROUTE_TIMEOUT_MS)
      ]);

      return NextResponse.json(report, {
        headers: {
          ...rateHeaders,
          "Cache-Control": refresh ? "no-store" : "public, s-maxage=300, stale-while-revalidate=86400"
        }
      });
    } catch (error) {
      const message = toPublicAuditError(error);
      const status = isTimeoutError(error) ? 504 : 400;
      return NextResponse.json(
        { error: message },
        { status, headers: rateHeaders }
      );
    }
  } catch (outerError) {
    // Catch-all: if anything above throws (e.g. rate-limit infra failure), still return JSON.
    console.error("[audit route] Unhandled error:", outerError);
    return NextResponse.json(
      { error: "The Bureau could not complete this review at present. Please try again shortly." },
      { status: 500 }
    );
  }
}

class RouteTimeoutError extends Error {
  constructor() {
    super("The Bureau's upstream services took too long to respond. Please try again shortly.");
    this.name = "RouteTimeoutError";
  }
}

function rejectAfterTimeout(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new RouteTimeoutError()), ms);
  });
}

function isTimeoutError(error: unknown): boolean {
  return error instanceof RouteTimeoutError;
}
