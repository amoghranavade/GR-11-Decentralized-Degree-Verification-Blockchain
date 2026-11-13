# Frontend

The interim demo frontend uses React, Ethers.js and MetaMask to exercise the deployed contracts.

## Local setup

From the repository root:

```bash
npm run frontend:install
```

Start a persistent Hardhat node:

```bash
npm run node
```

In another terminal, deploy the contracts and generate `frontend/public/deployment.json`:

```bash
npm run deploy:local
```

Start the frontend:

```bash
npm run frontend
```

Open the Vite URL, connect MetaMask to `http://127.0.0.1:8545` with chain ID `31337`, and import only the local test accounts printed by Hardhat. Never fund those accounts with real assets.

Use separate local accounts for the administrator, university, student and employer. Capture the university and student addresses in the setup panel, then switch the connected account before each role performs its action.

## Amoy

After deploying with `npm run deploy:amoy`, the generated deployment file points the same frontend to Polygon Amoy. The connected MetaMask network must match chain ID `80002`.
