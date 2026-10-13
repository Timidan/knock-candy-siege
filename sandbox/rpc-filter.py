#!/usr/bin/env python3
"""A small JSON-RPC filter in front of the sandbox's anvil fork.

The fork runs with --auto-impersonate so the /holder helper below can hand a guest a real Chog and $CHOG.
This filter is what makes that safe to expose: public RPC is read-only (no sends of any kind, no anvil_/evm_
admin calls), every call in a batch pays rate, upstream work, simulation gas and log ranges are bounded, and
it adds the CORS headers the browser requires. /holder talks to the fork directly. Standard library only; the
sandbox is reset nightly, so simplicity beats throughput.

  python3 rpc-filter.py --listen 0.0.0.0:8545 --upstream http://127.0.0.1:8546
"""
import argparse, hashlib, hmac, json, os, re, secrets, ssl, threading, time, urllib.request
from pathlib import Path
from urllib.parse import urlsplit
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ALLOWED = {
    # reads only; /holder below is the sandbox's only writer, and it talks to anvil directly
    'eth_chainId', 'eth_blockNumber', 'eth_getBlockByNumber', 'eth_getBlockByHash', 'eth_call', 'eth_estimateGas',
    'eth_gasPrice', 'eth_maxPriorityFeePerGas', 'eth_feeHistory', 'eth_getBalance', 'eth_getCode', 'eth_getLogs',
    'eth_getTransactionCount', 'eth_getTransactionReceipt', 'eth_getTransactionByHash', 'eth_getStorageAt',
    'net_version', 'web3_clientVersion',
}
MAX_BODY = 200_000            # bytes; a 16 KB multicall is the app's largest request
MAX_BATCH = 50
RATE = 30                     # calls per second per IP (each call in a batch counts), with a burst of 60
BURST = 60
MAX_LOG_SPAN = 2000           # blocks per eth_getLogs
MAX_CALL_GAS = 5_000_000      # eth_call/eth_estimateGas; the app's reads use under 30k
MAX_UPSTREAM = 8              # public RPC requests in flight to anvil at once
UPSTREAM_WAIT = 5             # seconds a request may queue for one of those slots
BODY_DEADLINE = 10            # seconds to receive a whole request body
# Keys the stored IP hashes. Per process: reset.sh recreates the container nightly, so it rotates daily.
IP_SALT = secrets.token_bytes(32)

buckets = {}
lock = threading.Lock()
holder_lock = threading.Lock()
upstream_slots = threading.BoundedSemaphore(MAX_UPSTREAM)
CHOG_NFT = '0xc96d31F8626c6D03Fae5dCD3d61e3FB9F4a73763'
CHOG_TOKEN = '0x350035555E10d9AfAF1566AaebfCeD5BA6C27777'
# Large liquidity holder, impersonated ONLY on the local anvil fork.
CHOG_DONOR = '0x116e7D070f1888B81E1E0324F56d6746B2D7d8f1'
HOLDER_AMOUNT = 1000 * 10 ** 18
# Chogs whose cap or shirt carries crude text (same list as app/src/siege/data/crudeChogs.ts); never handed to judges at random.
CRUDE_TEXT_CHOGS = frozenset(int(n) for n in '6,9,13,16,23,24,25,28,35,44,54,59,61,74,77,82,94,95,96,98,101,108,110,119,129,144,152,153,160,161,171,172,174,179,180,200,217,220,236,242,244,245,251,253,257,265,266,268,274,276,287,288,296,299,302,306,311,316,331,332,333,334,350,351,352,355,359,371,386,396,398,402,404,410,445,451,452,458,464,472,478,481,485,486,489,502,511,519,527,546,554,555,565,571,574,592,601,603,605,607,617,622,623,628,637,638,641,642,654,666,672,678,680,697,707,717,720,721,725,726,731,736,737,740,749,755,758,763,774,785,788,789,795,823,845,849,852,854,867,873,879,887,897,908,909,915,916,920,939,941,944,950,967,994,995,1027,1032,1037,1040,1044,1046,1050,1056,1057,1059,1068,1071,1072,1089,1094,1105,1107,1109,1120,1132,1136,1141,1144,1152,1156,1178,1184,1193,1208,1223,1231,1236,1244,1253,1263,1266,1267,1269,1280,1284,1293,1295,1305,1306,1309,1315,1321,1325,1328,1330,1333,1340,1344,1354,1357,1358,1361,1363,1365,1371,1379,1396,1397,1406,1407,1413,1421,1423,1436,1437,1441,1446,1448,1471,1476,1477,1494,1499,1505,1507,1516,1518,1529,1530,1537,1538,1541,1546,1554,1562,1580,1582,1586,1587,1604,1616,1621,1626,1633,1643,1646,1649,1651,1655,1676,1682,1688,1703,1706,1713,1716,1717,1724,1729,1734,1736,1739,1741,1744,1759,1762,1766,1771,1776,1778,1782,1787,1795,1814,1825,1844,1846,1849,1851,1854,1860,1864,1866,1868,1876,1896,1898,1907,1908,1909,1918,1922,1925,1930,1932,1933,1935,1945,1946,1957,1961,1965'.split(','))


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
        ip_hash = hmac.new(IP_SALT, ip.encode(), hashlib.sha256).hexdigest()
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
            candidates = [n for n in range(1, supply + 1) if n not in reserved and n not in CRUDE_TEXT_CHOGS]
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


def allowed_by_rate(ip, cost=1):
    now = time.monotonic()
    with lock:
        tokens, last = buckets.get(ip, (BURST, now))
        tokens = min(BURST, tokens + (now - last) * RATE)
        if tokens < cost:
            buckets[ip] = (tokens, now)
            return False
        buckets[ip] = (tokens - cost, now)
        if len(buckets) > 50_000:
            buckets.clear()
        return True


def quantity(value):
    """A JSON-RPC hex quantity as an int; anything else raises ValueError."""
    if isinstance(value, str) and value.startswith('0x'):
        return int(value, 16)
    raise ValueError(value)


def log_block(tag):
    """An eth_getLogs bound as a number, or None for the head (anvil's safe/finalized trail it by at most 64)."""
    if tag in (None, 'latest', 'pending', 'safe', 'finalized'):
        return None
    return 0 if tag == 'earliest' else quantity(tag)


def check(call):
    """Returns an error message, or None when the call may pass. Caps simulation gas in place."""
    if not isinstance(call, dict):
        return 'bad request'
    method = call.get('method')
    params = call.get('params') or []
    if method not in ALLOWED:
        return f'method not allowed in the sandbox: {method}'
    try:
        if method in ('eth_call', 'eth_estimateGas'):
            tx, gas = params[0], params[0].get('gas')
            tx['gas'] = hex(MAX_CALL_GAS if gas is None else min(quantity(gas), MAX_CALL_GAS))
        if method == 'eth_getLogs':
            start, end = log_block(params[0].get('fromBlock')), log_block(params[0].get('toBlock'))
            # A head tag on one side only (earliest..latest, N..latest) has no span we can check here.
            if (start is None) != (end is None):
                return 'log range needs hex fromBlock and toBlock'
            if start is not None and end - start > MAX_LOG_SPAN:
                return 'log range too large'
    except (IndexError, KeyError, AttributeError, ValueError, TypeError):
        return 'bad params'
    return None


def error(call, message):
    return {'jsonrpc': '2.0', 'id': call.get('id') if isinstance(call, dict) else None, 'error': {'code': -32601, 'message': message}}


class Handler(BaseHTTPRequestHandler):
    upstream = 'http://127.0.0.1:8546'
    holder_state = 'holder-state/claims.json'
    protocol_version = 'HTTP/1.1'
    # Per socket read/write, so a stalled or idle connection frees its thread. Longer than Caddy's 2-minute
    # upstream keep-alive, so Caddy drops idle pooled connections first and never reuses one we just closed.
    timeout = 150

    def read_body(self, length):
        """Reads the body within BODY_DEADLINE in total, not per recv, so a trickling sender can't hold the thread."""
        deadline = time.monotonic() + BODY_DEADLINE
        body = bytearray()
        while len(body) < length:
            left = deadline - time.monotonic()
            if left <= 0:
                raise TimeoutError('body deadline')
            self.connection.settimeout(left)
            chunk = self.rfile.read1(length - len(body))
            if not chunk:
                raise ConnectionError('client closed')
            body += chunk
        self.connection.settimeout(self.timeout)
        return bytes(body)

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
            body = self.read_body(length)
        except OSError:  # deadline passed or the client left: drop the connection, nothing to answer
            self.close_connection = True
            return
        try:
            payload = json.loads(body)
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
        # Every call pays a token; the first was paid before the body was read.
        if len(calls) > 1 and not allowed_by_rate(ip, len(calls) - 1):
            return self.reply(429, error({}, 'slow down'))
        verdicts = [check(call) for call in calls]
        passing = [call for call, verdict in zip(calls, verdicts) if verdict is None]
        answers = {}
        if passing:
            if not upstream_slots.acquire(timeout=UPSTREAM_WAIT):
                return self.reply(503, error({}, 'sandbox busy, try again'))
            req = urllib.request.Request(self.upstream, data=json.dumps(passing).encode(), headers={'Content-Type': 'application/json'})
            try:
                with urllib.request.urlopen(req, timeout=60) as response:
                    for answer in json.loads(response.read()):
                        answers[json.dumps(answer.get('id'))] = answer
            except Exception as exc:  # anvil down or mid-reset
                return self.reply(502, error({}, f'sandbox chain unavailable: {type(exc).__name__}'))
            finally:
                upstream_slots.release()
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
