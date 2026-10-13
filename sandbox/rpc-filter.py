#!/usr/bin/env python3
"""A small JSON-RPC filter in front of the sandbox's anvil fork.

Judges and visitors play as any Chog on a public copy of Monad, so the fork runs with --auto-impersonate.
This filter is what makes that safe to expose: it allows only the methods the app needs, caps request size
and rate, and adds the CORS headers the browser requires. Standard library only; the sandbox is reset
nightly, so simplicity beats throughput.

  python3 rpc-filter.py --listen 0.0.0.0:8545 --upstream http://127.0.0.1:8546
"""
import argparse, hashlib, json, os, re, secrets, ssl, threading, time, urllib.request
from pathlib import Path
from urllib.parse import urlsplit
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ALLOWED = {
    # reads
    'eth_chainId', 'eth_blockNumber', 'eth_getBlockByNumber', 'eth_getBlockByHash', 'eth_call', 'eth_estimateGas',
    'eth_gasPrice', 'eth_maxPriorityFeePerGas', 'eth_feeHistory', 'eth_getBalance', 'eth_getCode', 'eth_getLogs',
    'eth_getTransactionCount', 'eth_getTransactionReceipt', 'eth_getTransactionByHash', 'eth_getStorageAt',
    'net_version', 'web3_clientVersion',
    # writes the app makes on a fork: impersonated sends, raw sends from play keys, gas money, Next night
    'eth_sendTransaction', 'eth_sendRawTransaction', 'anvil_setBalance', 'evm_increaseTime', 'evm_mine',
}
MAX_BODY = 200_000            # bytes; a 16 KB multicall is the app's largest request
MAX_BATCH = 50
RATE = 30                     # requests per second per IP, with a burst of 60
BURST = 60
MAX_SET_BALANCE = 10 ** 22    # 10,000 MON of play money per call is plenty
MAX_TIME_JUMP = 2 * 86400     # Next night jumps one day; allow two
MAX_MINE = 10

buckets = {}
lock = threading.Lock()
holder_lock = threading.Lock()
CHOG_NFT = '0xc96d31F8626c6D03Fae5dCD3d61e3FB9F4a73763'
CHOG_TOKEN = '0x350035555E10d9AfAF1566AaebfCeD5BA6C27777'
# Large liquidity holder, impersonated ONLY on the local anvil fork.
CHOG_DONOR = '0x116e7D070f1888B81E1E0324F56d6746B2D7d8f1'
HOLDER_AMOUNT = 1000 * 10 ** 18


def origin_allowed(origin):
    return (re.fullmatch(r'https://([a-z0-9-]+\.)?knock-ej6\.pages\.dev', origin) or
            origin == 'https://knock.timidan.xyz' or re.fullmatch(r'http://localhost(:\d+)?', origin))


def word(value):
    return (value[2:] if isinstance(value, str) else hex(value)[2:]).zfill(64)


def fork_rpc(upstream, method, params):
    # Never allow privileged calls to be redirected to a public/mainnet RPC.
    if urlsplit(upstream).hostname not in ('127.0.0.1', 'localhost', 'knock-anvil'):
        raise RuntimeError('holder endpoint requires local anvil')
    req = urllib.request.Request(upstream, data=json.dumps({'jsonrpc': '2.0', 'id': 1, 'method': method, 'params': params}).encode(),
                                 headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=30) as response:
        result = json.load(response)
    if 'error' in result:
        raise RuntimeError('fork RPC failed')
    return result['result']


def holder_grant(upstream, state_path, address, ip):
    """Serialize and persist reservations so retries/restarts never grant twice."""
    with holder_lock:
        path = Path(state_path)
        state = json.loads(path.read_text()) if path.exists() else {'claims': {}, 'ips': {}}
        previous = state['claims'].get(address)
        if previous:
            if previous['state'] == 'paid':
                return 200, {'chogId': previous['chogId']}
            return 409, {'error': 'Grant already attempted; available again after nightly reset'}
        now = time.time()
        ip_hash = hashlib.sha256(ip.encode()).hexdigest()
        state['ips'] = {key: [t for t in times if t > now - 3600] for key, times in state['ips'].items() if any(t > now - 3600 for t in times)}
        if len(state['ips'].get(ip_hash, [])) >= 5:
            return 429, {'error': 'Holder limit reached (5 per hour per IP)'}

        def save():
            path.parent.mkdir(parents=True, exist_ok=True)
            temporary = str(path) + '.tmp'
            with open(temporary, 'w') as output:
                json.dump(state, output)
                output.flush()
                os.fsync(output.fileno())
            os.replace(temporary, path)

        def rpc(method, params):
            return fork_rpc(upstream, method, params)

        def read(contract, data):
            return rpc('eth_call', [{'to': contract, 'data': data}, 'latest'])

        def send(sender, contract, data):
            rpc('anvil_impersonateAccount', [sender])
            try:
                gas = int(rpc('eth_getBalance', [sender, 'latest']), 16)
                if gas < 10 ** 18:
                    rpc('anvil_setBalance', [sender, hex(10 ** 18)])
                tx = rpc('eth_sendTransaction', [{'from': sender, 'to': contract, 'data': data, 'gas': hex(300_000)}])
                for _ in range(60):
                    receipt = rpc('eth_getTransactionReceipt', [tx])
                    if receipt:
                        if receipt['status'] != '0x1':
                            raise RuntimeError('fork transfer reverted')
                        return
                    time.sleep(0.2)
                raise RuntimeError('fork transfer receipt unavailable')
            finally:
                rpc('anvil_stopImpersonatingAccount', [sender])

        # Reserve before making chain calls; uncertain failures cannot be retried.
        record = {'state': 'granting'}
        state['claims'][address] = record
        state['ips'].setdefault(ip_hash, []).append(now)
        save()
        try:
            # This method only exists on anvil; chain ID alone cannot distinguish a fork.
            rpc('anvil_nodeInfo', [])
            if address == CHOG_DONOR.lower() or int(read(CHOG_TOKEN, '0x70a08231' + word(CHOG_DONOR)), 16) < HOLDER_AMOUNT:
                raise RuntimeError('fork donor unavailable')
            supply = int(read(CHOG_NFT, '0x18160ddd'), 16)
            reserved = {claim.get('chogId') for claim in state['claims'].values()}
            candidates = [n for n in range(1, supply + 1) if n not in reserved]
            if not candidates:
                raise RuntimeError('no unassigned Chogs on this fork')
            chog_id = secrets.choice(candidates)
            owner = '0x' + read(CHOG_NFT, '0x6352211e' + word(chog_id))[-40:]
            record['chogId'] = chog_id
            save()
            before = int(read(CHOG_TOKEN, '0x70a08231' + word(address)), 16)
            send(owner, CHOG_NFT, '0x23b872dd' + word(owner) + word(address) + word(chog_id))
            send(CHOG_DONOR, CHOG_TOKEN, '0xa9059cbb' + word(address) + word(HOLDER_AMOUNT))
            gas = int(rpc('eth_getBalance', [address, 'latest']), 16)
            rpc('anvil_setBalance', [address, hex(gas + 10 ** 18)])
            if ('0x' + read(CHOG_NFT, '0x6352211e' + word(chog_id))[-40:]).lower() != address:
                raise RuntimeError('NFT verification failed')
            if int(read(CHOG_TOKEN, '0x70a08231' + word(address)), 16) < before + HOLDER_AMOUNT:
                raise RuntimeError('CHOG verification failed')
            record['state'] = 'paid'
            save()
            return 200, {'chogId': chog_id}
        except Exception:
            record['state'] = 'failed'
            save()
            return 502, {'error': 'Fork grant failed; available again after nightly reset'}


def allowed_by_rate(ip):
    now = time.monotonic()
    with lock:
        tokens, last = buckets.get(ip, (BURST, now))
        tokens = min(BURST, tokens + (now - last) * RATE)
        if tokens < 1:
            buckets[ip] = (tokens, now)
            return False
        buckets[ip] = (tokens - 1, now)
        if len(buckets) > 50_000:
            buckets.clear()
        return True


def check(call):
    """Returns an error message, or None when the call may pass."""
    if not isinstance(call, dict):
        return 'bad request'
    method = call.get('method')
    params = call.get('params') or []
    if method not in ALLOWED:
        return f'method not allowed in the sandbox: {method}'
    if method == 'anvil_setBalance':
        try:
            if int(str(params[1]), 0) > MAX_SET_BALANCE:
                return 'too much play money'
        except (IndexError, ValueError, TypeError):
            return 'bad params'
    if method == 'evm_increaseTime':
        try:
            if int(str(params[0]), 0) > MAX_TIME_JUMP:
                return 'time jump too large'
        except (IndexError, ValueError, TypeError):
            return 'bad params'
    if method == 'evm_mine':
        blocks = params[0].get('blocks', 1) if params and isinstance(params[0], dict) else 1
        if int(blocks) > MAX_MINE:
            return 'too many blocks'
    if method == 'eth_getLogs':
        try:
            span = params[0]
            start, end = span.get('fromBlock'), span.get('toBlock')
            if isinstance(start, str) and isinstance(end, str) and start.startswith('0x') and end.startswith('0x') and int(end, 16) - int(start, 16) > 2000:
                return 'log range too large'
        except (IndexError, AttributeError):
            return 'bad params'
    return None


def error(call, message):
    return {'jsonrpc': '2.0', 'id': call.get('id') if isinstance(call, dict) else None, 'error': {'code': -32601, 'message': message}}


class Handler(BaseHTTPRequestHandler):
    upstream = 'http://127.0.0.1:8546'
    holder_state = 'holder-state/claims.json'
    protocol_version = 'HTTP/1.1'

    def cors(self):
        origin = self.headers.get('Origin', '')
        if origin_allowed(origin):
            self.send_header('Access-Control-Allow-Origin', origin)
        self.send_header('Vary', 'Origin')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'content-type')
        self.send_header('Access-Control-Max-Age', '86400')

    def reply(self, status, body):
        data = json.dumps(body).encode()
        self.send_response(status)
        if status >= 400:
            # Early rejections may leave an unread POST body. Do not let the
            # proxy reuse that connection and parse the body as another request.
            self.close_connection = True
            self.send_header('Connection', 'close')
        self.cors()
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_OPTIONS(self):
        origin = self.headers.get('Origin')
        if origin and not origin_allowed(origin):
            return self.reply(403, {'error': 'Origin not allowed'})
        self.send_response(204)
        self.cors()
        self.send_header('Content-Length', '0')
        self.end_headers()

    def do_GET(self):
        self.reply(200, {'sandbox': 'Knock: Candy Siege', 'rpc': 'POST JSON-RPC here', 'holder': 'POST /holder {address}', 'resets': 'nightly at 00:05 UTC'})

    def do_POST(self):
        origin = self.headers.get('Origin')
        if origin and not origin_allowed(origin):
            return self.reply(403, {'error': 'Origin not allowed'})
        ip = self.headers.get('CF-Connecting-IP') or self.client_address[0]
        if not allowed_by_rate(ip):
            return self.reply(429, error({}, 'slow down'))
        try:
            length = int(self.headers.get('Content-Length') or 0)
            if length < 0:
                raise ValueError()
        except ValueError:
            return self.reply(400, error({}, 'bad content length'))
        if length > MAX_BODY:
            return self.reply(413, error({}, 'request too large'))
        try:
            payload = json.loads(self.rfile.read(length))
        except ValueError:
            return self.reply(400, error({}, 'bad json'))
        if self.path == '/holder':
            address = payload.get('address') if isinstance(payload, dict) else None
            if not isinstance(address, str) or not re.fullmatch(r'0x[0-9a-fA-F]{40}', address) or int(address, 16) == 0:
                return self.reply(400, {'error': 'Invalid address'})
            try:
                status, body = holder_grant(self.upstream, self.holder_state, address.lower(), ip)
                return self.reply(status, body)
            except Exception:
                return self.reply(503, {'error': 'Holder service unavailable'})
        calls = payload if isinstance(payload, list) else [payload]
        if len(calls) > MAX_BATCH:
            return self.reply(413, error({}, 'batch too large'))
        verdicts = [check(call) for call in calls]
        passing = [call for call, verdict in zip(calls, verdicts) if verdict is None]
        answers = {}
        if passing:
            req = urllib.request.Request(self.upstream, data=json.dumps(passing).encode(), headers={'Content-Type': 'application/json'})
            try:
                with urllib.request.urlopen(req, timeout=60) as response:
                    for answer in json.loads(response.read()):
                        answers[json.dumps(answer.get('id'))] = answer
            except Exception as exc:  # anvil down or mid-reset
                return self.reply(502, error({}, f'sandbox chain unavailable: {type(exc).__name__}'))
        results = [answers.get(json.dumps(call.get('id')), error(call, 'no answer')) if verdict is None else error(call, verdict)
                   for call, verdict in zip(calls, verdicts)]
        self.reply(200, results if isinstance(payload, list) else results[0])

    def log_message(self, fmt, *args):
        pass  # quiet; anvil logs the chain side


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--listen', default='127.0.0.1:8545')
    parser.add_argument('--upstream', default='http://127.0.0.1:8546')
    parser.add_argument('--holder-state', default='holder-state/claims.json')
    parser.add_argument('--cert'); parser.add_argument('--key')
    args = parser.parse_args()
    Handler.upstream = args.upstream
    Handler.holder_state = args.holder_state
    host, port = args.listen.rsplit(':', 1)
    print(f'rpc-filter: {args.listen} -> {args.upstream}, {len(ALLOWED)} methods allowed', flush=True)
    server = ThreadingHTTPServer((host, int(port)), Handler)
    if args.cert:
        context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        context.load_cert_chain(args.cert, args.key)
        server.socket = context.wrap_socket(server.socket, server_side=True)
    server.serve_forever()
