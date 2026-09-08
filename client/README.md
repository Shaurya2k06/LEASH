# LEASH operator view

This Vite app is a read-only cockpit for the LEASH devnet evidence. It polls
the public Solana RPC for slot/program health and shows recorded attack-gate
outcomes. It never downloads private policy/session accounts and cannot sign,
settle, or choose an agent outcome.

```sh
npm install
npm run dev
```

Optional Vite variables:

- `VITE_SOLANA_RPC_URL`
- `VITE_PROGRAM_ID`
- `VITE_RELAY_URL`
