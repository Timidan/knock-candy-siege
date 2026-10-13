# Try as a holder

`POST https://sandbox-rpc.timidan.xyz/holder` with JSON `{"address":"0x..."}` returns
`{"chogId":1101}` (the ID is random). The caller creates/retains its guest wallet;
the endpoint never creates or receives private keys.

On the existing Monad fork it impersonates the selected NFT's current owner and
transfers the real Chog Genesis token, then impersonates the large CHOG liquidity
holder `0x116e7D070f1888B81E1E0324F56d6746B2D7d8f1` to transfer 1,000 CHOG. It adds
1 MON for gas. Receipts, ownership, and token balance are checked before success.
No mainnet writes occur. Privileged helpers only accept the local anvil upstream.

One grant per normalized address per fork; successful repeats return the original
ID without another transfer. Failed/uncertain attempts consume that address until
reset. Five attempts per IP per rolling hour. Reserved NFT IDs are not reassigned
to later guests. State lives in `holder-state/claims.json`, mounted at `/state`,
and survives filter restarts. `reset.sh` stops the filter before replacing the fork,
clears holder records, and starts it with the state mount. The nightly schedule is
unchanged; the legacy contract deployment in reset is also left intact.

Allowed browser origins: HTTPS production and preview `knock-ej6.pages.dev`,
`https://knock.timidan.xyz`, and HTTP localhost ports. The JSON-RPC method allowlist
is unchanged; internal impersonation methods remain unavailable through public RPC.
Error responses close the HTTP connection so rejected bodies cannot corrupt a later
request through the proxy. No Caddy configuration change is required.

On LuxVPS, only `~/knock-sandbox/rpc-filter.py`, `reset.sh`, and holder state were
changed, and only `knock-rpc` was recreated/restarted. The anvil fork stayed running.
Backups from this deployment:

- `rpc-filter.py.bak-20261013T084705Z` (original)
- `reset.sh.bak-20261013T084705Z` (original)
- `rpc-filter.py.bak-20261013T085400Z` (before the HTTP connection fix)
- `reset.sh.bak-20261013T090029Z` (before atomic state replacement)

Restore the two original backups to roll back. Then recreate `knock-rpc` with its
original command from the reset backup; do not run the full reset merely to roll
back the filter, since that would discard the current fork's guest state.

Verification: a fresh public grant returned Chog #1101 for
`0x0ece9e620cb00f6e6070d0506ea7e8cde4b263fd`; public RPC confirmed ownerOf,
1,000 CHOG, and 1 MON. Duplicate protection persisted across a filter restart.
CORS and the public impersonation denial passed. A local quota check rejected a
sixth hourly attempt before any fork request. The reset script passed a mocked
Docker/RPC run, including replacement of a read-only state file; the live fork
was not reset during this deployment.
