import type { CaseStudy, HeadlineFinding, RawFinding, SeverityRating, Summary } from "@/lib/types";
import { formatDate, formatNative, formatUsd } from "@/lib/utils";

const USE_MOCK_COMMENTARY = process.env.USE_MOCK_COMMENTARY !== "false";

const PROTOTYPE_COPY: Record<
  RawFinding["key"],
  Pick<CaseStudy, "title" | "commentary" | "severity">
> = {
  paper_hands: {
    title: "An Untimely Departure",
    commentary:
      "The subject realized a 9× return and considered the matter closed. The Bureau has reviewed the timestamp and confirms the sale occurred well before the asset's reasonable maturity.",
    severity: "Egregious"
  },
  top_tick: {
    title: "Acquisition at the Local Maximum",
    commentary:
      "A study in conviction. The subject committed at peak euphoria and surrendered well into resignation. The Bureau commends the consistency of the conviction, if not its direction.",
    severity: "Concerning"
  },
  diamond_hands: {
    title: "Held With Conviction. To Zero.",
    commentary:
      "A textbook case of conviction divorced from thesis. The Bureau notes the subject continues to display this asset in their wallet, which is its own form of testimony.",
    severity: "Embarrassing"
  },
  rugpull: {
    title: "A Discerning Palate",
    commentary:
      "The subject demonstrates an unusually refined nose for projects that vanish within a fortnight. The Bureau has not encountered a hit rate of this caliber in recent memory.",
    severity: "Specialist-Grade"
  },
  gas_martyrdom: {
    title: "An Offering to the Network",
    commentary:
      "The Bureau is not a religious organization. We have, however, lit a candle.",
    severity: "Devotional"
  },
  notable_competence: {
    title: "An Inconvenient Triumph",
    commentary:
      "The Bureau is obligated, in the interest of completeness, to acknowledge that on this single occasion the subject behaved with apparent intentionality. It will not be discussed further.",
    severity: "Begrudging"
  }
};

const CATEGORY_LABEL: Record<RawFinding["key"], string> = {
  paper_hands: "Paper Hands",
  top_tick: "Top-Tick Specialist",
  diamond_hands: "Diamond Hands Disaster",
  rugpull: "Connoisseur of Rugpulls",
  gas_martyrdom: "Gas Fee Martyrdom",
  notable_competence: "Notable Competence"
};

export async function generateCommentary(input: {
  wallet: string;
  displayName: string;
  rawFindings: RawFinding[];
  summary: Summary;
}): Promise<{
  caseStudies: CaseStudy[];
  headlineFinding: HeadlineFinding;
  severityRating: SeverityRating;
}> {
  if (USE_MOCK_COMMENTARY) {
    return buildMockCommentary(input.rawFindings, input.summary);
  }

  throw new Error("Live Anthropic mode is disabled in this environment.");
}

function buildMockCommentary(rawFindings: RawFinding[], summary: Summary) {
  const caseStudies = rawFindings.map((finding, index) => {
    const numeral = ["I", "II", "III", "IV", "V", "VI"][index] ?? String(index + 1);
    const exhibit = String.fromCharCode(65 + index);
    const prototype = PROTOTYPE_COPY[finding.key];

    return {
      id: numeral,
      category: `Exhibit ${exhibit} · ${CATEGORY_LABEL[finding.key]}`,
      title: prototype.title,
      asset: finding.asset,
      acquired: {
        date: finding.acquisition.date,
        price: finding.acquisition.displayPrice,
        usd: formatUsd(finding.acquisition.priceUsd)
      },
      disposed: {
        date: finding.disposition.date,
        price: finding.disposition.displayPrice,
        usd: formatUsd(finding.disposition.priceUsd)
      },
      aftermath: buildAftermath(finding),
      counterfactual: buildCounterfactual(finding),
      commentary: prototype.commentary,
      severity: prototype.severity
    } satisfies CaseStudy;
  });

  const headlineSource = rawFindings[0];
  const headlineFinding = headlineSource
    ? {
        text: buildHeadline(headlineSource),
        loss: buildCounterfactual(headlineSource)
      }
    : {
        text: "The Bureau found sufficient cause for procedural concern.",
        loss: "Material underperformance remains on file."
      };

  return {
    caseStudies,
    headlineFinding,
    severityRating: deriveMockRating(rawFindings.length, summary)
  };
}

function buildHeadline(finding: RawFinding) {
  if (finding.key === "paper_hands") {
    return `On ${finding.disposition.date}, the subject sold ${finding.asset} for ${finding.disposition.displayPrice}. The Bureau notes the subsequent appreciation with some reluctance.`;
  }
  if (finding.key === "top_tick") {
    return `The subject acquired ${finding.asset} on ${finding.acquisition.date} at what appears, in the record, to have been an enthusiastic price.`;
  }
  if (finding.key === "diamond_hands") {
    return `The subject continues to hold ${finding.asset}, apparently in the belief that time alone constitutes a thesis.`;
  }
  if (finding.key === "rugpull") {
    return `The Bureau has reviewed ${finding.asset} and confirms the subject once again arrived before the lights went out.`;
  }
  if (finding.key === "notable_competence") {
    return `In a regrettable development for this report, the subject executed one trade with visible competence.`;
  }
  return `The Bureau has tabulated the subject's transaction fees and regrets to confirm they were non-productive.`;
}

function buildAftermath(finding: RawFinding) {
  if (finding.key === "paper_hands") {
    return `Asset later reached approximately ${formatNative(toNumber(finding.facts.peakNative) ?? 0)}. Subject exited well in advance of that development.`;
  }
  if (finding.key === "top_tick") {
    return `The subject entered near the collection's local maximum and later accepted a lower clearing price.`;
  }
  if (finding.key === "diamond_hands") {
    return `Current floor: ${formatNative(toNumber(finding.facts.currentFloorNative) ?? 0)}. The position remains open.`;
  }
  if (finding.key === "rugpull") {
    const inactivityDays = toNumber(finding.facts.inactivityDays) ?? 0;
    return `Collection activity has been dormant for approximately ${Math.round(inactivityDays)} days and the floor is now functionally negligible.`;
  }
  if (finding.key === "gas_martyrdom") {
    return `Single-day record: ${formatNative(toNumber(finding.facts.singleDayHighNative) ?? 0)} on ${String(finding.facts.singleDayDate ?? "file")}.`;
  }
  return `Subject acquired and disposed the asset within a window that the Bureau is forced to recognize as effective.`;
}

function buildCounterfactual(finding: RawFinding) {
  if (finding.key === "paper_hands") {
    return metricSentence("≈", finding.facts.forfeitedUsd, finding.facts.forfeitedNative, "in unrealized gains forfeited at peak");
  }
  if (finding.key === "top_tick") {
    return `Realized loss: ${formatMetric(finding.facts.realizedLossUsd, finding.facts.realizedLossNative, true)}.`;
  }
  if (finding.key === "diamond_hands") {
    return `Unrealized loss: ${formatMetric(finding.facts.unrealizedLossUsd, finding.facts.unrealizedLossNative, true)}.`;
  }
  if (finding.key === "rugpull") {
    return `Capital effectively stranded: ${formatMetric(finding.facts.cumulativeLossUsd, finding.facts.cumulativeLossNative, true)}.`;
  }
  if (finding.key === "notable_competence") {
    return `Realized gain: ${formatMetric(finding.facts.realizedGainUsd, finding.facts.realizedGainNative, false)}.`;
  }
  return `Equivalent value: ${formatNative(toNumber(finding.facts.singleDayHighNative) ?? 0)} committed to transaction fees.`;
}

function deriveMockRating(caseCount: number, summary: Summary): SeverityRating {
  if (caseCount >= 5) {
    return {
      grade: "DDD−",
      label: "Catastrophic",
      outlook: "Negative",
      blurb:
        "The subject's onchain conduct, taken in totality, falls below the threshold of investment-grade decision-making. The outlook remains negative pending a credible behavioural intervention."
    };
  }

  if (summary.bestSingleTrade.startsWith("+") || summary.bestSingleTrade.includes("ETH")) {
    return {
      grade: "BB",
      label: "Recoverable",
      outlook: "Stable",
      blurb:
        "The file contains cause for concern, though not without isolated signs that the subject occasionally identified the correct door by accident."
    };
  }

  return {
    grade: "CC+",
    label: "Embarrassing",
    outlook: "Negative",
    blurb:
      "The Bureau observes repeated lapses in judgment and, at present, insufficient evidence of sustained corrective behavior."
  };
}

function formatMetric(
  usd: unknown,
  native: unknown,
  negative: boolean
) {
  const usdNumber = toNumber(usd);
  if (usdNumber != null && usdNumber !== 0) {
    return formatUsd(negative ? -Math.abs(usdNumber) : usdNumber);
  }

  const nativeNumber = toNumber(native) ?? 0;
  return formatNative(negative ? -Math.abs(nativeNumber) : nativeNumber, "ETH");
}

function metricSentence(prefix: string, usd: unknown, native: unknown, suffix: string) {
  return `${prefix} ${formatMetric(usd, native, false)} ${suffix}.`;
}

function toNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}
