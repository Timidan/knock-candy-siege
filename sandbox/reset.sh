#!/bin/sh
# Resets the Knock sandbox: a fresh copy of Monad mainnet, then the Knock contract deployed at its fixed address.
# Runs nightly from cron, at boot, and by hand. No root needed: anvil runs in docker, the filter in python.
set -eu
cd "$(dirname "$0")"
DEPLOYER=0x5aDb0c6B6e5E4d5A0a3F1C8B2e7d9A4c1b3E6f90   # a fresh address: nonce 0 on mainnet, so the contract address never changes
CHOG_TOKEN=0x350035555E10d9AfAF1566AaebfCeD5BA6C27777
CLEAN_FEE=10000000000000000000                        # 10 $CHOG, as on the builder's test chain
UPSTREAM=http://127.0.0.1:8546
rpc() { curl -s -m 120 -H 'content-type: application/json' --data "$1" $UPSTREAM; }

# Stop grants while the fork is being replaced.
docker rm -f knock-rpc >/dev/null 2>&1 || true
docker rm -f knock-anvil >/dev/null 2>&1 || true
docker run -d --name knock-anvil --restart unless-stopped --network public_proxy -p 127.0.0.1:8546:8546 --memory 3g \
  ghcr.io/foundry-rs/foundry:v1.7.1 \
  "anvil --fork-url https://rpc.monad.xyz --chain-id 143 --port 8546 --host 0.0.0.0 --auto-impersonate --silent --disable-code-size-limit" >/dev/null
for i in $(seq 1 60); do rpc '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}' | grep -q '"0x8f"' && break; sleep 2; done
rpc '{"jsonrpc":"2.0","id":1,"method":"anvil_setBalance","params":["'$DEPLOYER'","0x3635C9ADC5DEA00000"]}' >/dev/null
ARGS=$(printf '%064s%064x' "${CHOG_TOKEN#0x}" "$CLEAN_FEE" | tr ' ' 0)
DATA="$(cat Knock.bin)$ARGS"
HASH=$(rpc '{"jsonrpc":"2.0","id":1,"method":"eth_sendTransaction","params":[{"from":"'$DEPLOYER'","data":"'$DATA'","gas":"0x5B8D80"}]}' | sed 's/.*"result":"\([^"]*\)".*/\1/')
sleep 2
ADDRESS=$(rpc '{"jsonrpc":"2.0","id":1,"method":"eth_getTransactionReceipt","params":["'$HASH'"]}' | sed 's/.*"contractAddress":"\([^"]*\)".*/\1/')
echo "$(date -u +%FT%TZ) sandbox reset: Knock at $ADDRESS (tx $HASH)"
# The filter runs as a container on the edge proxy's network; Caddy routes sandbox-rpc.timidan.xyz to it.
mkdir -p holder-state
# The container may own the old file; agentops owns the directory and can replace it.
printf '%s\n' '{"claims":{},"ips":{}}' > holder-state/claims.reset.json
mv -f holder-state/claims.reset.json holder-state/claims.json
docker run -d --name knock-rpc --restart unless-stopped --network public_proxy --memory 256m \
  -v "$PWD/rpc-filter.py:/app/rpc-filter.py:ro" -v "$PWD/holder-state:/state" python:3.9-alpine \
  python3 /app/rpc-filter.py --listen 0.0.0.0:8545 --upstream http://knock-anvil:8546 --holder-state /state/claims.json >/dev/null
