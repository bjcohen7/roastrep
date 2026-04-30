import type { CaseStudy, HeadlineFinding, RawFinding, SeverityRating, Summary } from "@/lib/types";
import { formatDate, formatNative, formatUsd } from "@/lib/utils";

const USE_MOCK_COMMENTARY = process.env.USE_MOCK_COMMENTARY !== "false";
const COMMENTARY_PROVIDER = process.env.COMMENTARY_PROVIDER ?? "openai";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? "gpt-5-mini";

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

  if (COMMENTARY_PROVIDER === "openai" && OPENAI_API_KEY) {
    try {
      return await generateOpenAiCommentary(input);
    } catch {
      return buildMockCommentary(input.rawFindings, input.summary);
    }
  }

  return buildMockCommentary(input.rawFindings, input.summary);
}

async function generateOpenAiCommentary(input: {
  wallet: string;
  displayName: string;
  rawFindings: RawFinding[];
  summary: Summary;
}) {
  const mockReference = buildMockCommentary(input.rawFindings, input.summary);
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      reasoning: { effort: "minimal" },
      max_output_tokens: 2200,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text:
                "You write satirical NFT audit reports in the voice of the Bureau of Onchain Affairs. Always write in the third person about 'the subject'. The tone is dry, bureaucratic, faintly aggrieved, and never explicitly mean. No crypto slang. No emojis. No exclamation points. Formal sentences. Understatement carries the punchline. Return valid JSON only. No markdown fences or prefatory text."
            }
          ]
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: JSON.stringify({
                task: "Generate commentary for a wallet audit.",
                wallet: input.wallet,
                displayName: input.displayName,
                summary: input.summary,
                findings: input.rawFindings,
                schema: {
                  caseStudies: [
                    {
                      id: "I",
                      category: "Exhibit A · Paper Hands",
                      title: "string",
                      asset: "string",
                      acquired: { date: "string", price: "string", usd: "string" },
                      disposed: { date: "string", price: "string", usd: "string" },
                      aftermath: "string",
                      counterfactual: "string",
                      commentary: "string",
                      severity: "string"
                    }
                  ],
                  headlineFinding: { text: "string", loss: "string" },
                  severityRating: { grade: "string", label: "string", outlook: "string", blurb: "string" }
                },
                instructions: [
                  "Preserve the caseStudies order and ids you are given in the reference examples.",
                  "Every wallet must get a unique headlineFinding.text.",
                  "Use a credit-rating style grade like DDD−, CC+, or BB.",
                  "Keep category, asset, acquired, and disposed fields unchanged from the reference examples.",
                  "Rewrite title, aftermath, counterfactual, commentary, severity, headlineFinding, and severityRating.blurb in the Bureau voice."
                ],
                referenceExamples: mockReference
              })
            }
          ]
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI commentary request failed (${response.status})`);
  }

  const payload = (await response.json()) as {
    output_text?: string;
    output?: Array<{
      content?: Array<{
        type?: string;
        text?: string;
      }>;
    }>;
  };

  const text =
    payload.output_text ??
    payload.output
      ?.flatMap((item) => item.content ?? [])
      .filter((item) => item.type === "output_text" || item.type === "text")
      .map((item) => item.text ?? "")
      .join("") ??
    "";

  if (!text.trim()) {
    throw new Error("OpenAI commentary response was empty.");
  }

  const parsed = JSON.parse(extractJson(text)) as {
    caseStudies: CaseStudy[];
    headlineFinding: HeadlineFinding;
    severityRating: SeverityRating;
  };

  return sanitizeOpenAiOutput(parsed, mockReference);
}

function sanitizeOpenAiOutput(
  parsed: {
    caseStudies: CaseStudy[];
    headlineFinding: HeadlineFinding;
    severityRating: SeverityRating;
  },
  fallback: {
    caseStudies: CaseStudy[];
    headlineFinding: HeadlineFinding;
    severityRating: SeverityRating;
  }
) {
  const fallbackById = new Map(fallback.caseStudies.map((caseStudy) => [caseStudy.id, caseStudy]));
  const caseStudies = fallback.caseStudies.map((fallbackCase) => {
    const candidate = parsed.caseStudies?.find((caseStudy) => caseStudy.id === fallbackCase.id) ?? fallbackById.get(fallbackCase.id);
    if (!candidate) return fallbackCase;
    return {
      ...fallbackCase,
      title: candidate.title || fallbackCase.title,
      aftermath: candidate.aftermath || fallbackCase.aftermath,
      counterfactual: candidate.counterfactual || fallbackCase.counterfactual,
      commentary: candidate.commentary || fallbackCase.commentary,
      severity: candidate.severity || fallbackCase.severity
    };
  });

  return {
    caseStudies,
    headlineFinding: {
      text: parsed.headlineFinding?.text || fallback.headlineFinding.text,
      loss: parsed.headlineFinding?.loss || fallback.headlineFinding.loss
    },
    severityRating: {
      grade: parsed.severityRating?.grade || fallback.severityRating.grade,
      label: parsed.severityRating?.label || fallback.severityRating.label,
      outlook: parsed.severityRating?.outlook || fallback.severityRating.outlook,
      blurb: parsed.severityRating?.blurb || fallback.severityRating.blurb
    }
  };
}

function extractJson(text: string) {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  throw new Error("No JSON object found in OpenAI response.");
}

function buildMockCommentary(rawFindings: RawFinding[], summary: Summary) {
  if (isLimitedFile(rawFindings, summary)) {
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

    return {
      caseStudies,
      headlineFinding: {
        text: "The Bureau located only a modest NFT file for the subject. This should not be mistaken for prudence.",
        loss: "Available evidence was insufficient to establish a broader pattern of collectible self-harm."
      },
      severityRating: {
        grade: "BB",
        label: "Recoverable",
        outlook: "Stable",
        blurb:
          "The Bureau's file on this subject is unexpectedly thin. While the record contains isolated fees and minor incidents, it does not yet support a full indictment of judgment."
      }
    };
  }

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

function isLimitedFile(rawFindings: RawFinding[], summary: Summary) {
  const nonGasFindings = rawFindings.filter((finding) => finding.key !== "gas_martyrdom");
  return summary.txnCount <= 8 && nonGasFindings.length <= 1;
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
