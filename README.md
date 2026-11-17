# Retirement Outcome Illustrator

Monte Carlo projection of retirement savings and drawdown.

Standalone app: a Next.js front end over a Python (FastAPI) calculation engine, deployed as one Vercel project. Part of a five-app actuarial & quant portfolio.

## Run locally

```bash
uv sync
cd api && uv run uvicorn main:app --reload   # http://127.0.0.1:8000/api/docs
cd web 2>/dev/null; npm install && npm run dev        # http://localhost:3000
uv run pytest -q
```

## Deploy

```bash
vercel --prod
```

The engine lives under `api/basis/`; the serverless entrypoint is `api/index.py`.

MIT licensed. Mortality data where used is public (SOA / ELT); illustrative basis only.
