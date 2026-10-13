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
`https://knock.timidan.xyz`, and HTTP localhost ports. Error responses close the
HTTP connection so rejected bodies cannot corrupt a later request through the
proxy. No Caddy configuration change is required.

## Public RPC: read-only

The public JSON-RPC allows these 18 read methods and rejects everything else,
including `eth_sendTransaction`, `eth_sendRawTransaction` and every `anvil_*` and
`evm_*` method:

`eth_chainId`, `eth_blockNumber`, `eth_getBlockByNumber`, `eth_getBlockByHash`,
`eth_call`, `eth_estimateGas`, `eth_gasPrice`, `eth_maxPriorityFeePerGas`,
`eth_feeHistory`, `eth_getBalance`, `eth_getCode`, `eth_getLogs`,
`eth_getTransactionCount`, `eth_getTransactionReceipt`, `eth_getTransactionByHash`,
`eth_getStorageAt`, `net_version`, `web3_clientVersion`.

The app only sends `eth_call` here (`ownerOf` and `balanceOf` after a grant).
`/holder` is the only writer, and it talks to anvil directly.

Limits:

- **Size:** bodies up to 200 KB, and batches of up to 50 calls.
- **Rate:** 30 calls per second per IP, with a burst of 60. Every call in a batch
  counts.
- **Upstream:** at most 8 requests in flight to anvil. A request waits up to 5
  seconds for a slot, then gets a 503.
- **Deadlines:** a request body must arrive within 10 seconds in total. A stalled
  or idle connection closes after 150 seconds. That is longer than Caddy's upstream
  keep-alive, so Caddy closes idle connections first.
- **Gas:** `eth_call` and `eth_estimateGas` run with at most 5,000,000 gas. The
  filter sets that limit when gas is missing and lowers higher values to it.
- **Logs:** `eth_getLogs` needs two hex block numbers at most 2,000 blocks apart,
  or head tags on both sides (`latest`, or no range). `earliest` to `latest` and
  other mixed ranges are rejected.
- **IP addresses:** the holder limits store an HMAC of the IP, keyed by a random
  secret made at start-up. `reset.sh` recreates the container nightly, so the
  secret changes every day.

Check the filter without a network: `python3 test_rpc_filter.py`.

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

The read-only hardening on 13 Oct changed only `rpc-filter.py` and restarted only
`knock-rpc`. The file was written in place, so the bind-mounted inode stayed the
same. Backups:

- `rpc-filter.py.bak-20261013T183801Z` (before the hardening)
- `rpc-filter.py.bak-20261013T185013Z` (hardened, but still allowing `eth_sendRawTransaction`)

To roll back, write a backup over the live file in place (`cat <backup> > rpc-filter.py`)
and run `docker restart knock-rpc`. After each step, `eth_chainId` and the app's
`eth_call` batch answered and `eth_sendTransaction` and `anvil_setBalance` were
rejected; after the second step, `eth_sendRawTransaction` was rejected too. A fresh
`/holder` grant also succeeded each time, and the CORS headers were unchanged.
