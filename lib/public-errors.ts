const SAFE_AUDIT_ERRORS = [
  "The Bureau does not audit foreign jurisdictions. This office covers Ethereum only.",
  "Subject identifier is malformed. Provide a valid wallet (0x…) or ENS name (name.eth).",
  "ENS name did not resolve to a wallet address.",
  "Burn addresses are not eligible for audit.",
  "Address is invalid.",
  "Contract addresses are not eligible for audit. Please submit an EOA or ENS name.",
  "Rate limit exceeded.",
  "The Bureau's upstream services took too long to respond. Please try again shortly."
] as const;

const DEFAULT_PUBLIC_AUDIT_ERROR =
  "The Bureau could not complete this review at present. Please try again shortly.";

export function toPublicAuditError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  return SAFE_AUDIT_ERRORS.includes(message as (typeof SAFE_AUDIT_ERRORS)[number])
    ? message
    : DEFAULT_PUBLIC_AUDIT_ERROR;
}
