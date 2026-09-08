const assert = require('node:assert/strict')
const http = require('node:http')
const test = require('node:test')

const { createApp } = require('./index')

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      resolve(`http://127.0.0.1:${port}`)
    })
  })
}

function close(server) {
  return new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
}

test('relay is read-only, health-checked, and rate-limited', async (t) => {
  const upstream = http.createServer((_request, response) => {
    response.setHeader('content-type', 'application/json')
    response.end(JSON.stringify({ jsonrpc: '2.0', id: 1, result: 123 }))
  })
  const upstreamUrl = await listen(upstream)
  const app = createApp({ rpcUrl: upstreamUrl, rateLimitMax: 10 })
  const relay = app.listen(0, '127.0.0.1')
  await new Promise((resolve) => relay.once('listening', resolve))
  const relayUrl = `http://127.0.0.1:${relay.address().port}`
  t.after(async () => {
    await close(relay)
    await close(upstream)
  })

  const health = await fetch(`${relayUrl}/health`, {
    headers: { origin: 'http://localhost:5173' },
  })
  assert.equal(health.status, 200)
  assert.equal(health.headers.get('access-control-allow-origin'), 'http://localhost:5173')
  assert.equal((await health.json()).upstream, 'ok')

  const read = await fetch(`${relayUrl}/relay`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 'read', method: 'getSlot', params: [] }),
  })
  assert.equal(read.status, 200)
  assert.equal((await read.json()).result, 123)

  const write = await fetch(`${relayUrl}/relay`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', method: 'sendTransaction', params: ['signed'] }),
  })
  assert.equal(write.status, 400)

  const oversized = await fetch(`${relayUrl}/relay`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', method: 'getSlot', params: ['x'.repeat(70_000)] }),
  })
  assert.equal(oversized.status, 413)

  const limited = createApp({ rpcUrl: upstreamUrl, rateLimitMax: 1 })
  const limitedServer = limited.listen(0, '127.0.0.1')
  await new Promise((resolve) => limitedServer.once('listening', resolve))
  const limitedUrl = `http://127.0.0.1:${limitedServer.address().port}`
  t.after(() => close(limitedServer))
  assert.equal((await fetch(`${limitedUrl}/health`)).status, 200)
  assert.equal((await fetch(`${limitedUrl}/health`)).status, 429)
})

test('relay rejects invalid JSON-RPC envelopes and oversized upstream responses', async (t) => {
  const upstream = http.createServer((_request, response) => {
    response.setHeader('content-type', 'application/json')
    response.end(JSON.stringify({ jsonrpc: '2.0', id: 1, result: 'x'.repeat(128) }))
  })
  const upstreamUrl = await listen(upstream)
  const app = createApp({ rpcUrl: upstreamUrl, maxResponseBytes: 64 })
  const relay = app.listen(0, '127.0.0.1')
  await new Promise((resolve) => relay.once('listening', resolve))
  const relayUrl = `http://127.0.0.1:${relay.address().port}`
  t.after(async () => {
    await close(relay)
    await close(upstream)
  })

  const invalid = await fetch(`${relayUrl}/relay`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ method: 'getSlot', params: [] }),
  })
  assert.equal(invalid.status, 400)

  const oversized = await fetch(`${relayUrl}/relay`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', method: 'getSlot', params: [] }),
  })
  assert.equal(oversized.status, 502)
})

test('health reports an unavailable upstream', async (t) => {
  const app = createApp({ rpcUrl: 'http://127.0.0.1:1', timeoutMs: 50 })
  const server = app.listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  t.after(() => close(server))
  const response = await fetch(`http://127.0.0.1:${server.address().port}/health`)
  assert.equal(response.status, 503)
  assert.equal((await response.json()).upstream, 'unavailable')
})
