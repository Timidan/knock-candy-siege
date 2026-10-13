# Candy Bank relay

This folder is the outbound-only OpenShip Compose service for **Knock: Candy Siege**.
The retired street-event watcher is gone. The relay polls Candy Bank every 10 seconds,
processes up to 20 queued claims sequentially, and sends **300 KNOCK followed by
0.0005 test ETH** on Robinhood Chain Testnet (46630). It confirms both receipts and
the token Transfer event before reporting the KNOCK transaction hash to the Worker.
Addresses with code (contracts, delegated accounts) get the KNOCK without the ETH gift.

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
   `payer ready; maximum 60 grants/hour and 200/day`, then verify a real claim's `paid` status
   and both chain receipts. Live payment verification remains for the lead.

## Payment safeguards

- One address per Worker lifetime, including failed claims. A failure after a
  payment was signed is terminal. A check that fails before anything is signed
  (for example an RPC error) leaves the claim queued; the payer retries next poll.
- At most 60 new grants per rolling hour and 200 per rolling 24 hours, counted in
  the state file before anything is signed. Losing the state file resets this
  count (the payment-history check below still blocks second grants).
- Before signing the KNOCK, the payer checks the whole grant can complete: 300
  KNOCK, the gift plus its maximum fee, the KNOCK transfer's gas, and a gas price
  at or under the 1 gwei ceiling. Otherwise payments pause and claims stay queued.
- The ETH gift is a plain transfer with an explicit 21,000 gas limit and a 1 gwei
  fee ceiling, so it costs at most 0.000021 ETH in fees. Addresses with code get
  no gift. This chain charges no L1 data gas today; if that changes, a 21,000-gas
  gift fails and the payer stops for reconciliation.
- Local records skip paid addresses. Every new address is also checked against
  the approved payer's historical Transfer logs, whatever it holds now: at least
  300 received closes the claim as paid. Queries start at the verified token
  deployment block 133099671 in 1M-block ranges. RPC errors fail closed.
- Each exact signed transaction is saved atomically before broadcast; interrupted
  work reuses the same hash/nonce. Never delete the state to retry a payout.
- Uncertain submitted transactions pause payments across restarts for operator
  reconciliation. A failed claim can still have a partial payout if the gift
  fails after the KNOCK (checks run first, so this needs a race): inspect both
  saved transaction hashes before any manual action. A successful payout whose Worker
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
queue once, targets only `DRY_ADDRESS`, and runs the same read-only checks as a
payment: payment history, recipient code, balances and the fee ceiling (not the
caps, which live in the state file). It prints the verdict, for example
`would send 300 KNOCK then 0.0005 ETH`, and calls `/done` with a dry-run error. It never reads `RELAY_KEY`, signs, sends, or writes
local payment state. The test address is permanently `failed` and cannot pay.
A test address outside the first 20 queued claims must wait its turn.
