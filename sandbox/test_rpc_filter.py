"""Pure checks for rpc-filter.py (no network): python3 test_rpc_filter.py [path/to/rpc-filter.py]"""
import importlib.util, sys
from pathlib import Path

path = sys.argv[1] if len(sys.argv) > 1 else str(Path(__file__).with_name('rpc-filter.py'))
spec = importlib.util.spec_from_file_location('rpc_filter', path)
f = importlib.util.module_from_spec(spec)
spec.loader.exec_module(f)
call = lambda method, *params: {'jsonrpc': '2.0', 'id': 1, 'method': method, 'params': list(params)}

# Reads pass; sends of any kind and admin mutation do not.
assert f.check(call('eth_chainId')) is None
for method in ('eth_sendTransaction', 'eth_sendRawTransaction', 'anvil_setBalance', 'evm_increaseTime', 'evm_mine'):
    assert 'not allowed' in f.check(call(method, {})), method

# Simulation gas: set when missing, clamped when too high.
for tx in ({'to': '0x' + '11' * 20}, {'to': '0x' + '11' * 20, 'gas': '0xffffffffffffffff'}):
    assert f.check(call('eth_call', tx, 'latest')) is None and int(tx['gas'], 16) == f.MAX_CALL_GAS

# Log ranges: short numeric spans and head-only queries pass; earliest..latest and mixed bounds do not.
logs = lambda **span: f.check(call('eth_getLogs', span))
assert logs() is None and logs(fromBlock='0x10', toBlock='0x20') is None
assert logs(fromBlock='earliest', toBlock='latest') and logs(fromBlock='0x10') and logs(fromBlock='0x0', toBlock='0x10000')

# Every call in a batch pays: one full batch fits the burst, a second does not.
assert f.allowed_by_rate('203.0.113.9') and f.allowed_by_rate('203.0.113.9', f.MAX_BATCH - 1)
assert not f.allowed_by_rate('203.0.113.9', f.MAX_BATCH - 1)
print(f'rpc-filter checks passed ({path})')
