import { DEFAULT_SHARE_BASE_URL } from "@/lib/constants";
import { getCachedJson, setCachedJson } from "@/lib/cache";
import { parseSubjectIdentifier } from "@/lib/ens";
import type { AuditReport, CaseStudy, SeverityRating, Summary } from "@/lib/types";
import { deterministicCaseNumber, sha1, shortAddress } from "@/lib/utils";

const AUDIT_TTL_SECONDS = 60 * 60 * 24;
const AUDIT_SCHEMA_VERSION = "2026-04-30-fun-mode";
const CASE_NUMERALS = ["I", "II", "III", "IV", "V", "VI"];
const EXHIBIT_LETTERS = ["A", "B", "C", "D", "E", "F"];

const CATEGORY_POOL = [
  "Paper Hands",
  "Top-Tick Specialist",
  "Diamond Hands Disaster",
  "Connoisseur of Rugpulls",
  "Narrative Overexposure",
  "Gas Fee Martyrdom",
  "Exit Liquidity Services",
  "Chronically Early, Heroically Wrong"
] as const;

const TITLE_POOL = [
  "Peak Euphoria, Duly Purchased",
  "Conviction Without Adult Supervision",
  "A Highly Personal War on Timing",
  "Liquidity for Strangers",
  "The Market Was Informed. The Subject Was Not.",
  "A Triumph of Confidence Over Evidence",
  "Price Discovery, Performed Poorly",
  "The Dignity Left Before the Position Did"
] as const;

const COLLECTION_POOL = [
  "Moonbirds",
  "Pudgy Penguins",
  "Azuki",
  "Doodles",
  "Quirkies",
  "Killabears",
  "Goblintown",
  "Milady",
  "y00ts",
  "Checks",
  "Mfers",
  "OnChain Monkey"
] as const;

const COMMENTARY_POOL = [
  "The Bureau appreciates the subject's commitment to being wrong with full emotional conviction.",
  "This office has reviewed the file and concluded that timing was treated as a decorative concept.",
  "The subject appears to have mistaken public enthusiasm for personal confirmation.",
  "There is a difference between risk tolerance and theatrical self-harm. The file does not consistently observe it.",
  "The Bureau recognizes a pattern of buying as though someone else had already checked the numbers.",
  "The chain recorded the transaction faithfully. It could not explain it persuasively.",
  "The subject behaved as though the market owed them a sequel. It did not.",
  "This was less an investment process than a series of dramatic entrances into the wrong room."
] as const;

const AFTERMATH_POOL = [
  "The position immediately began behaving in a manner the Bureau would describe as educational.",
  "Subsequent market action transformed a bad idea into an archival specimen.",
  "Within weeks, the chart acquired the tone of a professional reprimand.",
  "The subject's exposure matured into a conversation best held in low light.",
  "Any temporary dignity attached to the trade has since been withdrawn.",
  "What followed was not illegal, merely embarrassing."
] as const;

const COUNTERFACTUAL_POOL = [
  "Had the subject exercised restraint, the file would contain less comedy and more capital.",
  "In a more supervised universe, this position would have remained theoretical.",
  "A modest delay, a smaller size, or one competent friend would likely have improved the outcome.",
  "The Bureau observes that several avoidable decisions were treated as destiny.",
  "There was, at multiple points, a quieter and less humiliating option."
] as const;

const SEVERITY_POOL = [
  "Utterly Moronic",
  "Tragic",
  "Not Recoverable",
  "Narratively Insolvent",
  "Spiritually Leveraged",
  "Procedurally Embarrassing",
  "Regrettably Competent",
  "Overconfident",
  "Underobserved",
  "Excessively Online"
] as const;

const HEADLINE_POOL = [
  "The Bureau reviewed the file and found repeated enthusiasm unaccompanied by discipline.",
  "The subject traded as though embarrassment were tax-deductible.",
  "The Bureau confirms that confidence was present, though not consistently attached to evidence.",
  "The subject appears to have treated market tops as a recurring invitation.",
  "The file suggests a working relationship with impulse and an adversarial one with timing.",
  "The Bureau found enough avoidable decisions to classify the record as recreationally unsound."
] as const;

const LOSS_POOL = [
  "Material underperformance remains very much on file.",
  "The surviving evidence supports several independent counts of preventable clownery.",
  "Administrative review indicates the subject was repeatedly available to be exit liquidity.",
  "The Bureau declines to quantify the psychic cost, though the financial cost was not modest.",
  "No criminality observed. Judgment, however, remains under active suspicion."
] as const;

const BLURB_POOL = [
  "The file reflects a subject with energy, confidence, and only intermittent contact with prudence.",
  "The Bureau notes recurring self-inflicted damage softened only slightly by occasional accidental competence.",
  "This record does not support optimism. It barely supports shoes indoors.",
  "The subject's conduct remains difficult to defend in accounting terms or in polite company.",
  "The file contains enough heat, noise, and improvisation to justify continued concern."
] as const;

const GRADE_POOL = ["F", "F-", "D+", "D", "D-", "C+", "C", "C-", "B", "B-"] as const;

export async function getCachedAuditReport(subject: string) {
  const cacheKey = getCacheKey(subject);
  return getCachedJson<AuditReport>(cacheKey);
}

export async function getAuditReport(subject: string, options?: { refresh?: boolean }) {
  const cacheKey = getCacheKey(subject);

  if (!options?.refresh) {
    const cached = await getCachedJson<AuditReport>(cacheKey);
    if (cached) return cached;
  }

  const report = buildFunReport(subject);
  await setCachedJson(cacheKey, report, AUDIT_TTL_SECONDS);
  return report;
}

export function auditVersionHash(report: AuditReport) {
  return sha1(
    `${AUDIT_SCHEMA_VERSION}:${report.wallet}:${report.generatedAt}:${report.caseStudies
      .map((caseStudy) => `${caseStudy.id}:${caseStudy.title}`)
      .join("|")}`
  );
}

function getCacheKey(subject: string) {
  const parsed = parseSubjectIdentifier(subject);
  if (parsed) {
    return `audit:${AUDIT_SCHEMA_VERSION}:${parsed.value.toLowerCase()}`;
  }

  if (/^[1-9A-HJ-NP-Za-km-z]{32,64}$/.test(subject.trim())) {
    throw new Error("The Bureau does not audit foreign jurisdictions. This office covers Ethereum only.");
  }

  throw new Error("Subject identifier is malformed. Provide a valid wallet (0x…) or ENS name (name.eth).");
}

function buildFunReport(subject: string): AuditReport {
  const parsed = parseSubjectIdentifier(subject);
  if (!parsed) {
    throw new Error("Subject identifier is malformed. Provide a valid wallet (0x…) or ENS name (name.eth).");
  }

  const canonicalSubject = parsed.value;
  const displayName = parsed.type === "ens" ? parsed.value : shortAddress(parsed.value);
  const random = createRng(canonicalSubject.toLowerCase());
  const grade = pick(random, GRADE_POOL);
  const label = pick(random, labelPoolForGrade(grade));
  const outlook = grade.startsWith("B")
    ? pick(random, ["Stable", "Guarded", "Smug"] as const)
    : pick(random, ["Negative", "Stable", "Bleak"] as const);
  const caseCount = 3 + Math.floor(random() * 3);
  const caseStudies = Array.from({ length: caseCount }, (_, index) => buildCaseStudy(random, index));
  const summary = buildSummary(random, caseStudies.length);
  const severityRating = buildSeverityRating(random, grade, label, outlook);
  const headlineFinding = {
    text: maybeSpecialHeadline(random, caseStudies) ?? pick(random, HEADLINE_POOL),
    loss: pick(random, LOSS_POOL)
  };

  return {
    wallet: canonicalSubject,
    displayName,
    caseNumber: deterministicCaseNumber(canonicalSubject.toLowerCase()),
    generatedAt: new Date().toISOString(),
    summary,
    caseStudies,
    severityRating,
    headlineFinding,
    shareBaseUrl: DEFAULT_SHARE_BASE_URL
  };
}

function buildCaseStudy(random: () => number, index: number): CaseStudy {
  const category = pick(random, CATEGORY_POOL);
  const collection = pick(random, COLLECTION_POOL);
  const tokenId = 1 + Math.floor(random() * 9999);
  const asset = `${collection} #${tokenId}`;
  const buyPrice = round(0.08 + random() * 4.2, 2);
  const sellPrice = round(Math.max(0.01, buyPrice * (0.12 + random() * 1.9)), 2);
  const buyUsd = round(buyPrice * (1700 + random() * 2500), 0);
  const sellUsd = round(sellPrice * (1700 + random() * 2500), 0);
  const title = specialTitleForCollection(collection) ?? pick(random, TITLE_POOL);
  const commentary = specialCommentaryForCollection(collection) ?? pick(random, COMMENTARY_POOL);

  return {
    id: CASE_NUMERALS[index] ?? String(index + 1),
    category: `Exhibit ${EXHIBIT_LETTERS[index] ?? String.fromCharCode(65 + index)} · ${category}`,
    title,
    asset,
    acquired: {
      date: randomDate(random),
      price: `${buyPrice} ETH`,
      usd: `$${buyUsd.toLocaleString()}`
    },
    disposed: {
      date: randomDate(random),
      price: `${sellPrice} ETH`,
      usd: `$${sellUsd.toLocaleString()}`
    },
    aftermath: pick(random, AFTERMATH_POOL),
    counterfactual: pick(random, COUNTERFACTUAL_POOL),
    commentary,
    severity: pick(random, SEVERITY_POOL)
  };
}

function buildSummary(random: () => number, caseCount: number): Summary {
  const realized = maybeSignedEth(random, 0.4, 18);
  const unrealized = maybeSignedEth(random, 0.2, 22);
  const best = maybePositiveEth(random, 0.4, 9);
  const worst = maybeSignedEth(random, 0.05, 12);

  return {
    periodStart: "Jan 2021",
    periodEnd: "Apr 2026",
    txnCount: 9 + Math.floor(random() * 87),
    realizedPnl: realized,
    unrealizedPnl: unrealized,
    rugCount: Math.floor(random() * Math.max(caseCount, 2)),
    heldToZeroCount: Math.floor(random() * Math.max(caseCount + 1, 3)),
    gasSpent: `${round(0.2 + random() * 8.4, 2)} ETH`,
    bestSingleTrade: best,
    worstSingleTrade: worst
  };
}

function buildSeverityRating(
  random: () => number,
  grade: string,
  label: string,
  outlook: string
): SeverityRating {
  return {
    grade,
    label,
    outlook,
    blurb: pick(random, BLURB_POOL)
  };
}

function labelPoolForGrade(grade: string) {
  if (grade.startsWith("F")) {
    return ["Utterly Moronic", "Tragic", "Financially Cursed", "Spiritually Leveraged"] as const;
  }
  if (grade.startsWith("D")) {
    return ["Not Recoverable", "Procedurally Embarrassing", "Under Supervision", "Narratively Insolvent"] as const;
  }
  if (grade.startsWith("C")) {
    return ["Concerning", "Unconvincing", "Overconfident", "Suspiciously Busy"] as const;
  }
  return ["Regrettably Competent", "Annoyingly Lucky", "Barely Civilized", "Not Entirely Hopeless"] as const;
}

function maybeSpecialHeadline(random: () => number, caseStudies: CaseStudy[]) {
  if (caseStudies.some((caseStudy) => caseStudy.asset.toLowerCase().includes("quirkies"))) {
    return "Unfortunately they had a Quirkies. The Bureau regrets that this sentence remains evidentiary.";
  }
  if (caseStudies.some((caseStudy) => caseStudy.asset.toLowerCase().includes("killabears"))) {
    return "Against expectation, the subject briefly displayed signs of taste by touching a Killabears.";
  }
  return random() > 0.5 ? null : pick(random, HEADLINE_POOL);
}

function specialTitleForCollection(collection: string) {
  if (collection === "Quirkies") return "Unfortunately They Had a Quirkies";
  if (collection === "Killabears") return "A Rarely Defensible Preference";
  return null;
}

function specialCommentaryForCollection(collection: string) {
  if (collection === "Quirkies") {
    return "Unfortunately they had a Quirkies. The Bureau appreciates that not every chapter of a life can be explained.";
  }
  if (collection === "Killabears") {
    return "The Bureau is not eager to offer praise, but this is at least adjacent to discernment.";
  }
  return null;
}

function randomDate(random: () => number) {
  const year = 2021 + Math.floor(random() * 6);
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
  const month = monthNames[Math.floor(random() * monthNames.length)];
  const day = 1 + Math.floor(random() * 28);
  return `${month} ${day}, ${year}`;
}

function maybeSignedEth(random: () => number, min: number, max: number) {
  const value = round(min + random() * max, 2);
  const sign = random() > 0.72 ? "" : "-";
  return `${sign}${value} ETH`;
}

function maybePositiveEth(random: () => number, min: number, max: number) {
  const value = round(min + random() * max, 2);
  return `+${value} ETH`;
}

function round(value: number, precision: number) {
  const power = 10 ** precision;
  return Math.round(value * power) / power;
}

function pick<T>(random: () => number, items: readonly T[]): T {
  return items[Math.floor(random() * items.length)] ?? items[0];
}

function createRng(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let index = 0; index < seed.length; index += 1) {
    h = Math.imul(h ^ seed.charCodeAt(index), 3432918353);
    h = (h << 13) | (h >>> 19);
  }

  return function random() {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}
