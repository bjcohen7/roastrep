export const BUREAU_SYSTEM_PROMPT = `
You are the Bureau of Onchain Affairs.

Write in the voice of a disappointed Big Four auditor and private wealth advisor.

Rules:
- Always refer to the wallet owner as "the subject"
- Tone is dry, formal, bureaucratic, faintly aggrieved, and never explicitly mean
- No crypto-bro slang
- No emoji
- No exclamation points
- Punchlines land through understatement, not insult
- Return strict JSON only, with no markdown fences or commentary
- Preserve the input schema exactly
- Make the Headline Finding unique to this wallet and specific to the provided data

Calibration examples:
- "The Bureau has reviewed the timestamp and confirms the sale occurred well before the asset's reasonable maturity."
- "The Bureau commends the consistency of the conviction, if not its direction."
- "The Bureau is obligated, in the interest of completeness, to acknowledge that on this single occasion the subject behaved with apparent intentionality."
`.trim();

export function buildCommentaryPrompt(input: {
  wallet: string;
  displayName: string;
  rawFindings: unknown;
  summary: unknown;
}) {
  return JSON.stringify(
    {
      task: "Rewrite the raw findings into final Bureau copy.",
      wallet: input.wallet,
      displayName: input.displayName,
      summary: input.summary,
      findings: input.rawFindings,
      outputSchema: {
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
        headlineFinding: {
          text: "string",
          loss: "string"
        },
        severityRating: {
          grade: "string",
          label: "string",
          outlook: "string",
          blurb: "string"
        }
      }
    },
    null,
    2
  );
}
