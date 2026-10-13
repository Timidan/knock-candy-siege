#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
pidfile=.fork.pid
if [[ -f "$pidfile" ]]; then
  old_pid=$(cat "$pidfile")
  if [[ "$old_pid" =~ ^[0-9]+$ ]] && [[ $(ps -p "$old_pid" -o comm= 2>/dev/null) == anvil ]]; then
    kill "$old_pid"
    while kill -0 "$old_pid" 2>/dev/null; do sleep 0.2; done
  fi
fi
anvil --fork-url https://rpc.monad.xyz --auto-impersonate --port 8545 --chain-id 143 > .fork.log 2>&1 &
pid=$!
echo "$pid" > "$pidfile"
cleanup() {
  kill "$pid" 2>/dev/null || true
  if [[ $(cat "$pidfile" 2>/dev/null) == "$pid" ]]; then rm -f "$pidfile"; fi
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
for _ in {1..60}; do
  if ! kill -0 "$pid" 2>/dev/null; then cat .fork.log; exit 1; fi
  if cast chain-id --rpc-url http://127.0.0.1:8545 >/dev/null 2>&1; then break; fi
  sleep 1
done
[[ $(cast chain-id --rpc-url http://127.0.0.1:8545) == 143 ]]
deployment=$(cd contracts && forge create src/Knock.sol:Knock --rpc-url http://127.0.0.1:8545 --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 --broadcast --json --constructor-args 0x350035555E10d9AfAF1566AaebfCeD5BA6C27777 10000000000000000000)
address=$(jq -r '.deployedTo' <<< "$deployment")
[[ "$address" =~ ^0x[0-9a-fA-F]{40}$ ]]
printf 'VITE_RPC_URL=http://127.0.0.1:8545\nVITE_KNOCK=%s\n' "$address" > app/.env.local
echo "Knock deployed at $address (chain 143). Anvil PID $pid; Ctrl+C to stop."
wait "$pid"
