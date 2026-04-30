import { createPublicClient, fallback, getAddress, http, isAddress } from "viem";
import { mainnet } from "viem/chains";
import { normalize } from "viem/ens";

import { BURN_ADDRESSES } from "@/lib/constants";
import { getEnv } from "@/lib/env";

const publicClient = createPublicClient({
  chain: mainnet,
  transport: fallback([
    http(getEnv("ETH_RPC_URL", "https://cloudflare-eth.com")),
    http("https://ethereum-rpc.publicnode.com"),
    http("https://eth.llamarpc.com")
  ])
});

const ENS_GATEWAYS = ["https://ccip.ens.xyz"];
const LIKELY_NON_ETH_WALLET_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,64}$/;

export function parseSubjectIdentifier(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (/^0x[a-f0-9]{40}$/.test(normalized)) {
    return { type: "address" as const, value: getAddress(normalized) };
  }
  if (/^[a-z0-9][a-z0-9-]{0,62}\.eth$/.test(normalized)) {
    return { type: "ens" as const, value: normalized };
  }
  return null;
}

export async function resolveWalletOrEns(input: string) {
  const parsed = parseSubjectIdentifier(input);
  if (!parsed) {
    if (LIKELY_NON_ETH_WALLET_REGEX.test(input.trim())) {
      throw new Error("The Bureau does not audit foreign jurisdictions. This office covers Ethereum only.");
    }
    throw new Error("Subject identifier is malformed. Provide a valid wallet (0x…) or ENS name (name.eth).");
  }

  if (parsed.type === "address") {
    await assertAuditEligible(parsed.value);
  const ensName = await publicClient.getEnsName({ address: parsed.value });
  return {
      inputType: parsed.type,
      address: parsed.value,
      ensName
    };
  }

  const normalizedName = normalize(parsed.value);
  const address = await tryResolveEnsAddress(normalizedName);
  if (!address) {
    throw new Error("ENS name did not resolve to a wallet address.");
  }
  const checksumAddress = getAddress(address);
  await assertAuditEligible(checksumAddress);

  return {
    inputType: parsed.type,
    address: checksumAddress,
    ensName: parsed.value
  };
}

export async function assertAuditEligible(address: string) {
  const lowercase = address.toLowerCase();
  if (BURN_ADDRESSES.has(lowercase)) {
    throw new Error("Burn addresses are not eligible for audit.");
  }
  if (!isAddress(address)) {
    throw new Error("Address is invalid.");
  }
  const bytecode = await publicClient.getBytecode({ address });
  if (bytecode && bytecode !== "0x" && !isDelegatedEoaBytecode(bytecode)) {
    throw new Error("Contract addresses are not eligible for audit. Please submit an EOA or ENS name.");
  }
}

export async function reverseResolve(address: string) {
  try {
    return await publicClient.getEnsName({
      address: getAddress(address),
      gatewayUrls: ENS_GATEWAYS
    });
  } catch {
    return publicClient.getEnsName({ address: getAddress(address) });
  }
}

async function tryResolveEnsAddress(name: string) {
  try {
    return await publicClient.getEnsAddress({
      name,
      gatewayUrls: ENS_GATEWAYS
    });
  } catch {
    return publicClient.getEnsAddress({ name });
  }
}

function isDelegatedEoaBytecode(bytecode: `0x${string}`) {
  return /^0xef0100[a-fA-F0-9]{40}$/.test(bytecode);
}
