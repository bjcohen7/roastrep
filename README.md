# The Roast Report

Satirical NFT audit app built with Next.js App Router.

## Current Status

- UI ported from the provided prototype
- Dynamic wallet route and OG image route working
- ENS resolution working
- Alchemy-backed NFT data path working
- OpenAI commentary path wired as the primary live LLM provider
- Fallback mock copy path is live, so the app still renders audits even if the LLM provider fails

## Local Setup

1. Install dependencies:

```bash
corepack pnpm install
```

2. Fill in `.env.local`:

```env
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5-mini
COMMENTARY_PROVIDER=openai
RESERVOIR_API_KEY=
ALCHEMY_API_KEY=
ETH_RPC_URL=
ETHERSCAN_API_KEY=
KV_REST_API_URL=
KV_REST_API_TOKEN=
NEXT_PUBLIC_SITE_URL=https://theroastreport.xyz
USE_MOCK_COMMENTARY=false
```

Recommended for the current setup:

- `ALCHEMY_API_KEY`: required for live NFT data in the current fallback path
- `ETH_RPC_URL`: use the Alchemy mainnet RPC URL
- `OPENAI_API_KEY`: enables live Bureau commentary generation
- `COMMENTARY_PROVIDER=openai`
- `USE_MOCK_COMMENTARY=false`

Optional for local development:

- `ANTHROPIC_API_KEY`
- `RESERVOIR_API_KEY`
- `ETHERSCAN_API_KEY`

3. Run locally:

```bash
corepack pnpm dev
```

4. Example audit:

```bash
curl 'http://localhost:3000/api/audit/vitalik.eth?refresh=1'
```

## Environment Notes

### Commentary provider

The app now prefers OpenAI for live commentary when `COMMENTARY_PROVIDER=openai` and `OPENAI_API_KEY` is present. If `USE_MOCK_COMMENTARY=true` or the OpenAI request fails, the app falls back to the built-in mock Bureau copy.

### Alchemy

Alchemy is the current primary NFT data provider in this project. Reservoir remains wired as a secondary path.

## Build

```bash
corepack pnpm build
```

## Deployment

Netlify config is included in `netlify.toml`. Set the same environment variables in Netlify before deploying.

Production note:

- `KV_REST_API_URL` and `KV_REST_API_TOKEN` are required in production.
- The app now refuses to fall back to in-memory cache and rate limiting in production so abuse protections remain shared across regions and instances.
