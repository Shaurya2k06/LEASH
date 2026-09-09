# LEASH operator view

This Vite app polls public Solana health and calls the trusted demo worker for
fresh attack-gate and lifecycle runs. It never receives signing credentials or
private account state; only sanitized live progress and outcomes reach the
browser.

```sh
npm install
npm run dev
```

Optional Vite variables:

- `VITE_SOLANA_RPC_URL`
- `VITE_PROGRAM_ID`
- `VITE_RELAY_URL`
- `VITE_DEMO_API_URL`
