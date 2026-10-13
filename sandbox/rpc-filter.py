#!/usr/bin/env python3
"""A small JSON-RPC filter in front of the sandbox's anvil fork.

Judges and visitors play as any Chog on a public copy of Monad, so the fork runs with --auto-impersonate.
This filter is what makes that safe to expose: it allows only the methods the app needs, caps request size
and rate, and adds the CORS headers the browser requires. Standard library only; the sandbox is reset
nightly, so simplicity beats throughput.

  python3 rpc-filter.py --listen 0.0.0.0:8545 --upstream http://127.0.0.1:8546
"""
import argparse, json, ssl, threading, time, urllib.request
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
    protocol_version = 'HTTP/1.1'

    def cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'content-type')
        self.send_header('Access-Control-Max-Age', '86400')

    def reply(self, status, body):
        data = json.dumps(body).encode()
        self.send_response(status)
        self.cors()
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_OPTIONS(self):
        self.send_response(204)
        self.cors()
        self.send_header('Content-Length', '0')
        self.end_headers()

    def do_GET(self):
        self.reply(200, {'sandbox': 'Knock', 'rpc': 'POST JSON-RPC here', 'resets': 'nightly at 00:05 UTC'})

    def do_POST(self):
        ip = self.headers.get('CF-Connecting-IP') or self.client_address[0]
        if not allowed_by_rate(ip):
            return self.reply(429, error({}, 'slow down'))
        length = int(self.headers.get('Content-Length') or 0)
        if length > MAX_BODY:
            return self.reply(413, error({}, 'request too large'))
        try:
            payload = json.loads(self.rfile.read(length))
        except ValueError:
            return self.reply(400, error({}, 'bad json'))
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
    parser.add_argument('--cert'); parser.add_argument('--key')
    args = parser.parse_args()
    Handler.upstream = args.upstream
    host, port = args.listen.rsplit(':', 1)
    print(f'rpc-filter: {args.listen} -> {args.upstream}, {len(ALLOWED)} methods allowed', flush=True)
    server = ThreadingHTTPServer((host, int(port)), Handler)
    if args.cert:
        context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        context.load_cert_chain(args.cert, args.key)
        server.socket = context.wrap_socket(server.socket, server_side=True)
    server.serve_forever()
