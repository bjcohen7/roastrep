export type AuditStage = "intake" | "analyzing" | "verdict";

export type LedgerEntry = {
  date: string;
  price: string;
  usd: string;
};

export type CaseStudy = {
  id: string;
  category: string;
  title: string;
  asset: string;
  acquired: LedgerEntry;
  disposed: LedgerEntry;
  aftermath: string;
  counterfactual: string;
  commentary: string;
  severity: string;
};

export type SummaryMetric = {
  label: string;
  value: string | number;
  negative?: boolean;
  positive?: boolean;
};

export type Summary = {
  periodStart: string;
  periodEnd: string;
  txnCount: number;
  realizedPnl: string;
  unrealizedPnl: string;
  rugCount: number;
  heldToZeroCount: number;
  gasSpent: string;
  bestSingleTrade: string;
  worstSingleTrade: string;
};

export type SeverityRating = {
  grade: string;
  label: string;
  outlook: string;
  blurb: string;
};

export type HeadlineFinding = {
  text: string;
  loss: string;
};

export type AuditReport = {
  wallet: string;
  displayName: string;
  caseNumber: string;
  generatedAt: string;
  summary: Summary;
  caseStudies: CaseStudy[];
  severityRating: SeverityRating;
  headlineFinding: HeadlineFinding;
  shareBaseUrl: string;
};

export type NormalizedTrade = {
  side: "buy" | "sell";
  txHash: string;
  contract: string;
  tokenId: string;
  collectionId: string;
  collectionName: string;
  tokenName: string;
  image?: string | null;
  timestamp: number;
  priceNative: number;
  priceUsd: number | null;
  currencySymbol: string;
  fromAddress?: string;
  toAddress?: string;
};

export type Holding = {
  contract: string;
  tokenId: string;
  collectionId: string;
  collectionName: string;
  tokenName: string;
  image?: string | null;
  acquiredTimestamp: number | null;
  acquiredPriceNative: number | null;
  acquiredPriceUsd: number | null;
  currentFloorNative: number | null;
  currentFloorUsd: number | null;
};

export type CollectionSnapshot = {
  id: string;
  name: string;
  image?: string | null;
  currentFloorNative: number | null;
  currentFloorUsd: number | null;
  volume30d: number | null;
  volumeAllTime: number | null;
  tokenCount: number | null;
};

export type CollectionFloorEvent = {
  timestamp: number;
  floorNative: number | null;
  floorUsd: number | null;
  eventType?: string;
};

export type GasSummary = {
  available: boolean;
  totalNative: number;
  totalUsd: number | null;
  singleDayHighNative: number;
  singleDayHighUsd: number | null;
  singleDayDate: string | null;
  transactionCount: number;
};

export type RawFinding = {
  key:
    | "paper_hands"
    | "top_tick"
    | "diamond_hands"
    | "rugpull"
    | "gas_martyrdom"
    | "notable_competence";
  sortValue: number;
  asset: string;
  collectionName?: string;
  acquisition: {
    date: string;
    priceNative: number | null;
    priceUsd: number | null;
    displayPrice: string;
  };
  disposition: {
    date: string;
    priceNative: number | null;
    priceUsd: number | null;
    displayPrice: string;
  };
  facts: Record<string, string | number | null>;
};
