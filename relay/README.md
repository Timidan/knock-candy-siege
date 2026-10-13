# Knock relay (deploy folder)
Deployed to OpenShip as a Compose project. `relay.mjs` is a copy of `app/scripts/relay.mjs`; copy it again after changing the original.
Env (set in OpenShip, RELAY_KEY as a secret): KNOCK_RPC, KNOCK_CONTRACT, RELAY_FROM_BLOCK, RELAY_KEY. Until KNOCK_CONTRACT is set the relay just waits.
