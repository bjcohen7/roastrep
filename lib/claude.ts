import type { CaseStudy, HeadlineFinding, RawFinding, SeverityRating, Summary } from "@/lib/types";
import { formatDate, formatNative, formatUsd } from "@/lib/utils";

const USE_MOCK_COMMENTARY = process.env.USE_MOCK_COMMENTARY !== "false";
const COMMENTARY_PROVIDER = process.env.COMMENTARY_PROVIDER ?? "openai";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? "gpt-5-mini";

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
                "You write satirical NFT audit reports in the voice of the Bureau of Onchain Affairs. This is a comedy product, and the copy should feel brutal, precise, and funny while remaining formally written. Always write in the third person about 'the subject'. The tone is dry, bureaucratic, disdainful, and ruthlessly specific. The humor should land through exactness, understatement, and institutional disappointment. Be harsher than polite product copy, but do not use slurs, threats, gore, or hate. No crypto-bro slang. No emojis. No exclamation points. Avoid therapy-speak, motivational language, or softeners like 'unfortunately' and 'it appears the subject may have'. Prefer lines that read like a disappointed auditor documenting unforced errors. Return valid JSON only. No markdown fences or prefatory text."
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
                  "Use a credit-rating style grade like DDD−, CC+, BB, or B+.",
                  "Keep category, asset, acquired, and disposed fields unchanged from the reference examples.",
                  "Rewrite title, aftermath, counterfactual, commentary, severity, headlineFinding, and severityRating.blurb in the Bureau voice.",
                  "Make the copy feel more savage and more specific than a normal brand voice.",
                  "Avoid repeating the exact same titles across different wallets when the facts differ.",
                  "Verdict labels such as 'Utterly Moronic', 'Tragic', and 'Not Recoverable' are acceptable.",
                  "If the facts are thin, say so in a cutting way rather than sounding apologetic.",
                  "If any finding references Quirkies, explicitly mock that fact. 'Unfortunately they had a Quirkies.' is an acceptable sentence.",
                  "If any finding references Killabears, briefly acknowledge it as a rare positive or civilized choice without becoming sincere."
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

      return {
        id: numeral,
        category: `Exhibit ${exhibit} · ${CATEGORY_LABEL[finding.key]}`,
        title: buildTitle(finding),
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
        commentary: buildCommentary(finding),
        severity: buildSeverity(finding)
      } satisfies CaseStudy;
    });

    return {
      caseStudies,
      headlineFinding: {
        text: "The Bureau located only a modest NFT file for the subject. This is less a defense than an absence of evidence.",
        loss: "Available activity was insufficient to prove catastrophe, though not to rule out amateurism."
      },
      severityRating: {
        grade: "B+",
        label: "Thin File",
        outlook: "Stable",
        blurb:
          "The Bureau's file on this subject is thinner than expected. The available record suggests either restraint, inactivity, or the administrative good fortune of having fewer mistakes on file."
      }
    };
  }

  const caseStudies = rawFindings.map((finding, index) => {
    const numeral = ["I", "II", "III", "IV", "V", "VI"][index] ?? String(index + 1);
    const exhibit = String.fromCharCode(65 + index);

    return {
      id: numeral,
      category: `Exhibit ${exhibit} · ${CATEGORY_LABEL[finding.key]}`,
      title: buildTitle(finding),
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
      commentary: buildCommentary(finding),
      severity: buildSeverity(finding)
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
  if (isQuirkiesFinding(finding)) {
    return `Unfortunately they had a Quirkies. The Bureau regrets that this phrase is evidentiary rather than metaphorical.`;
  }
  if (isKillabearsFinding(finding)) {
    return `Against expectation, the subject at one point held a Killabears. The Bureau acknowledges this with visible reluctance.`;
  }
  if (finding.key === "paper_hands") {
    return `On ${finding.disposition.date}, the subject sold ${finding.asset} for ${finding.disposition.displayPrice} and then watched the remaining upside belong to someone better adjusted.`;
  }
  if (finding.key === "top_tick") {
    return `The subject acquired ${finding.asset} on ${finding.acquisition.date} at what appears, in the record, to have been the worst available moment.`;
  }
  if (finding.key === "diamond_hands") {
    return `The subject continues to hold ${finding.asset}, apparently under the impression that neglect is an investment framework.`;
  }
  if (finding.key === "rugpull") {
    return `The Bureau has reviewed ${finding.asset} and confirms the subject once again financed an orderly disappearance.`;
  }
  if (finding.key === "notable_competence") {
    return `In a regrettable administrative development, the subject executed one trade with visible competence.`;
  }
  return `The Bureau has tabulated the subject's transaction fees and regrets to confirm that the network benefited more than the subject did.`;
}

function buildTitle(finding: RawFinding) {
  if (isQuirkiesFinding(finding)) {
    return "Unfortunately They Had a Quirkies";
  }
  if (isKillabearsFinding(finding)) {
    return "A Rarely Defensible Preference";
  }
  if (finding.key === "paper_hands") {
    return `Premature Exit from ${shortAsset(finding.asset)}`;
  }
  if (finding.key === "top_tick") {
    return `Peak Euphoria, Duly Purchased`;
  }
  if (finding.key === "diamond_hands") {
    return `Conviction Without Adult Supervision`;
  }
  if (finding.key === "rugpull") {
    return `Counterparty Selection Failure`;
  }
  if (finding.key === "gas_martyrdom") {
    return `An Offering to the Network`;
  }
  return `A Disturbing Moment of Competence`;
}

function buildAftermath(finding: RawFinding) {
  if (isQuirkiesFinding(finding)) {
    return `The record confirms the subject at one point held ${finding.asset}. The Bureau was not improved by learning this.`;
  }
  if (isKillabearsFinding(finding)) {
    return `The subject's file contains ${finding.asset}, which the Bureau is professionally obligated to rank above the usual landfill inventory.`;
  }
  if (finding.key === "paper_hands") {
    return `Asset later reached approximately ${formatNative(toNumber(finding.facts.peakNative) ?? 0)}. The subject had already excused themself from the upside.`;
  }
  if (finding.key === "top_tick") {
    return `The subject entered near the collection's local maximum and subsequently learned what a market sounds like after the music stops.`;
  }
  if (finding.key === "diamond_hands") {
    return `Current floor: ${formatNative(toNumber(finding.facts.currentFloorNative) ?? 0)}. The position remains open, either out of hope or administrative neglect.`;
  }
  if (finding.key === "rugpull") {
    const inactivityDays = toNumber(finding.facts.inactivityDays) ?? 0;
    return `Collection activity has been dormant for approximately ${Math.round(inactivityDays)} days and the floor is now functionally ceremonial.`;
  }
  if (finding.key === "gas_martyrdom") {
    return `Single-day record: ${formatNative(toNumber(finding.facts.singleDayHighNative) ?? 0)} on ${String(finding.facts.singleDayDate ?? "file")}. The chain appears grateful.`;
  }
  return `The subject acquired and disposed the asset within a window that the Bureau is professionally obligated to acknowledge as competent.`;
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
  const severityScore =
    caseCount * 2 +
    summary.rugCount * 3 +
    summary.heldToZeroCount * 2 +
    (summary.realizedPnl.startsWith("-") ? 2 : 0) +
    (summary.unrealizedPnl.startsWith("-") ? 1 : 0) +
    (summary.gasSpent !== "0 ETH" ? 1 : 0);

  if (severityScore >= 9) {
    return {
      grade: "DDD−",
      label: "Utterly Moronic",
      outlook: "Negative",
      blurb:
        "The subject's onchain conduct, taken in totality, falls beneath the threshold of ordinary embarrassment and into a more durable administrative concern. The outlook remains negative."
    };
  }

  if (severityScore >= 6) {
    return {
      grade: "CC+",
      label: "Tragic",
      outlook: "Negative",
      blurb:
        "The Bureau observes repeated lapses in judgment, weak exit discipline, and a pattern of avoidable humiliation insufficiently offset by luck."
    };
  }

  if (summary.bestSingleTrade.startsWith("+") || summary.bestSingleTrade.includes("ETH")) {
    return {
      grade: "BB",
      label: "Not Recoverable",
      outlook: "Stable",
      blurb:
        "The file contains cause for concern, though not without isolated signs that the subject occasionally found the correct door and then tried not to make eye contact with it."
    };
  }

  return {
    grade: "B",
    label: "Concerningly Amateur",
    outlook: "Stable",
    blurb:
      "The Bureau cannot yet justify a harsher classification, but the available record is not one of confidence, discipline, or refined taste."
  };
}

function buildCommentary(finding: RawFinding) {
  if (isQuirkiesFinding(finding)) {
    return "Unfortunately they had a Quirkies. The Bureau recognizes that markets are imperfect, but some outcomes still feel unnecessarily personal.";
  }
  if (isKillabearsFinding(finding)) {
    return "The Bureau is not eager to offer praise, but the presence of a Killabears suggests the subject briefly wandered into something almost respectable before resuming ordinary conduct.";
  }
  if (finding.key === "paper_hands") {
    return "The subject appears to have encountered a gain, become frightened by its existence, and liquidated the position before the market delivered its more humiliating sequel. The Bureau has seen panic mistaken for prudence before.";
  }
  if (finding.key === "top_tick") {
    return "The subject purchased into full public enthusiasm, thereby performing the useful social function of providing liquidity to people leaving with dignity. The Bureau does not consider this a sustainable specialty.";
  }
  if (finding.key === "diamond_hands") {
    return "This is a textbook case of stubbornness dressed in the language of conviction. The subject continues to hold the asset, which now serves primarily as a decorative record of delayed acceptance.";
  }
  if (finding.key === "rugpull") {
    return "The subject demonstrates a disquieting ability to discover projects moments before they become cautionary tales. The Bureau would hesitate to call it talent, though the repetition is difficult to ignore.";
  }
  if (finding.key === "gas_martyrdom") {
    return "The Bureau is not a religious organization. It is, however, willing to recognize when a subject has converted capital into smoke with unusual devotion.";
  }
  return "The Bureau is obliged, in the interest of accuracy, to acknowledge a single instance in which the subject behaved like a person in possession of a plan. We do not expect this to become a trend.";
}

function buildSeverity(finding: RawFinding) {
  if (isKillabearsFinding(finding)) return "Reluctantly Positive";
  if (finding.key === "paper_hands") return "Humiliating";
  if (finding.key === "top_tick") return "Self-Inflicted";
  if (finding.key === "diamond_hands") return "Lingering";
  if (finding.key === "rugpull") return "Advanced";
  if (finding.key === "gas_martyrdom") return "Devotional";
  return "Annoyingly Positive";
}

function shortAsset(asset: string) {
  return asset.length > 34 ? `${asset.slice(0, 34).trim()}…` : asset;
}

function isQuirkiesFinding(finding: RawFinding) {
  return `${finding.asset} ${finding.collectionName ?? ""}`.toLowerCase().includes("quirkies");
}

function isKillabearsFinding(finding: RawFinding) {
  return `${finding.asset} ${finding.collectionName ?? ""}`.toLowerCase().includes("killabears");
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
