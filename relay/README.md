# Candy Bank relay

This folder is the outbound-only OpenShip Compose service for **Knock: Candy Siege**.
The retired street-event watcher is gone. The relay polls Candy Bank every 10 seconds,
processes up to 20 queued claims sequentially, and sends **300 KNOCK followed by
0.0005 test ETH** on Robinhood Chain Testnet (46630). It confirms both receipts and
the token Transfer event before reporting the KNOCK transaction hash to the Worker.

Worker: https://candy-bank.timidan-knock.workers.dev
Token: `0x2Ae41145A6acB58d4457c49df27ab6BFEF618492`
Payer: `0xF86700Fe4ea98658558893f468A1BcdCDa6b76f7`

## Lead deployment on OpenShip

The service has **not** been redeployed as part of this change.

1. Upload this `relay/` folder (including `package-lock.json`) to the existing
   OpenShip project `knock-relay` and retain its `relay-state` volume.
2. Set `BANK_URL` to the Worker URL above and `BANK_TOKEN` as an OpenShip secret,
   loaded privately from the repository's `.env.bank` (mode 600, gitignored).
   Keep the existing `RELAY_KEY` secret unchanged. Do not read `.env.relay`, print
   secrets, or copy the signing key to this machine.
3. Compose sets `RELAY_STATE=/state/candy-bank-state.json`. This is a new record;
   the old street watcher state is left intact. Remove obsolete `KNOCK_RPC`,
   `KNOCK_CONTRACT`, `RELAY_FROM_BLOCK`, and `REWARD_*` variables if present.
4. Ensure the existing volume's `/state` directory is writable by UID/GID 1000
   (`node`). New volumes get this ownership from the image; an older root-owned
   volume may need the bounded command below, run in the deployment's Compose
   directory with its environment already loaded:
   `docker compose run --rm --no-deps --user root relay chown node:node /state`
5. Redeploy **one** relay instance. It needs no inbound ports. Check logs for
   `payer ready; maximum 60 grants/hour`, then verify a real claim's `paid` status
   and both chain receipts. Live payment verification remains for the lead.

## Payment safeguards

- One address per Worker lifetime, including failed claims; failures are terminal.
- At most 60 new grants per rolling hour, recorded across restarts.
- Low KNOCK/ETH reserves pause the queue. ETH reserve includes both gift and gas.
- Local records skip paid addresses. If state is absent and the recipient holds
  at least 300 KNOCK, historical Transfer logs from the approved payer must prove
  at least 300 was received before it is skipped. Queries start at the verified
  token deployment block 133099671 in bounded ranges. RPC errors fail closed.
- Each exact signed transaction is saved atomically before broadcast; interrupted
  work reuses the same hash/nonce. Never delete the state to retry a payout.
- Uncertain submitted transactions pause payments across restarts for operator
  reconciliation. A failed claim can have a partial payout: inspect both saved
  transaction hashes before any manual action. A successful payout whose Worker
  acknowledgement failed remains paid locally and only retries acknowledgement.
- Run exactly one payer. Do not use its wallet elsewhere while it is running.
- The persistent state must be writable; errors and logs never dump credentials.

`app/scripts/relay.mjs` is an identical copy for compatibility with the existing
app script path. Keep it synchronized with this file.

## Dry run (no signing key required)

Queue a **fresh test address** with `POST /claim {"address":"0x..."}`, then from
the repository root:

```sh
DRY=1 DRY_ADDRESS=0x... node --env-file=.env.bank relay/relay.mjs
```

Run `npm ci --prefix relay --omit=dev` first if needed. Dry mode reads the real
queue once, targets only `DRY_ADDRESS`, prints the intended amounts, and calls
`/done` with a dry-run error. It never reads `RELAY_KEY`, signs, sends, or writes
local payment state. The test address is permanently `failed` and cannot pay.
A test address outside the first 20 queued claims must wait its turn.
