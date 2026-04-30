# The Roast Report

Satirical NFT audit app built with Next.js App Router.

## Current Status

- UI ported from the provided prototype
- Dynamic wallet route and OG image route working
- ENS resolution working
- Alchemy-backed NFT data path working
- Anthropic commentary path wired, but currently blocked until the Anthropic workspace/API billing issue is resolved
- Fallback copy path is live, so the app still renders audits without Anthropic

## Local Setup

1. Install dependencies:

```bash
corepack pnpm install
```

2. Fill in `.env.local`:

```env
ANTHROPIC_API_KEY=
RESERVOIR_API_KEY=
ALCHEMY_API_KEY=
ETH_RPC_URL=
ETHERSCAN_API_KEY=
KV_REST_API_URL=
KV_REST_API_TOKEN=
NEXT_PUBLIC_SITE_URL=https://theroastreport.xyz
USE_MOCK_COMMENTARY=true
```

Recommended for the current setup:

- `ALCHEMY_API_KEY`: required for live NFT data in the current fallback path
- `ETH_RPC_URL`: use the Alchemy mainnet RPC URL
- `USE_MOCK_COMMENTARY=true`: keeps the app fully runnable while Anthropic is unavailable

Optional for now:

- `ANTHROPIC_API_KEY`
- `RESERVOIR_API_KEY`
- `ETHERSCAN_API_KEY`
- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`

3. Run locally:

```bash
corepack pnpm dev
```

4. Example audit:

```bash
curl 'http://localhost:3000/api/audit/vitalik.eth?refresh=1'
```

## Environment Notes

### Anthropic

The app is currently pinned to mock commentary mode with `USE_MOCK_COMMENTARY=true`. To restore live Anthropic commentary later, change that env var to `false`.

### Alchemy

Alchemy is the current primary NFT data provider in this project. Reservoir remains wired as a secondary path.

## Build

```bash
corepack pnpm build
```

## Deployment

Netlify config is included in `netlify.toml`. Set the same environment variables in Netlify before deploying.
