require('dotenv').config()

const cors = require('cors')
const express = require('express')

const DEFAULT_TIMEOUT_MS = 5000
const DEFAULT_RATE_LIMIT = 60
const DEFAULT_UPSTREAM_RESPONSE_BYTES = 1024 * 1024
const relayMethods = new Set([
  'getAccountInfo',
  'getLatestBlockhash',
  'getSignatureStatuses',
  'getSlot',
  'getTransaction',
])

function createApp(options = {}) {
  const rpcUrl = options.rpcUrl || process.env.SOLANA_RPC_URL
  const fetchImpl = options.fetchImpl || fetch
  const timeoutMs = options.timeoutMs || Number(process.env.UPSTREAM_TIMEOUT_MS || DEFAULT_TIMEOUT_MS)
  const maxResponseBytes = options.maxResponseBytes || Number(process.env.UPSTREAM_RESPONSE_BYTES || DEFAULT_UPSTREAM_RESPONSE_BYTES)
  const rateLimitMax = options.rateLimitMax || Number(process.env.RELAY_RATE_LIMIT || DEFAULT_RATE_LIMIT)
  const rateLimitWindowMs = options.rateLimitWindowMs || 60_000
  const allowedOrigin = options.allowedOrigin || process.env.ALLOWED_ORIGIN || 'http://localhost:5173'
  const buckets = new Map()
  const app = express()

  app.disable('x-powered-by')
  app.use(cors({ origin: allowedOrigin }))
  app.use(express.json({ limit: '64kb', strict: true }))
  app.use((request, response, next) => {
    const now = Date.now()
    for (const [key, bucket] of buckets) {
      if (now - bucket.startedAt >= rateLimitWindowMs) buckets.delete(key)
    }
    const key = request.ip || 'unknown'
    const current = buckets.get(key)
    if (!current && buckets.size >= 10_000) {
      return response.status(429).json({ error: 'Relay rate limit capacity reached.' })
    }
    const bucket = !current || now - current.startedAt >= rateLimitWindowMs
      ? { startedAt: now, count: 0 }
      : current
    bucket.count += 1
    buckets.set(key, bucket)
    if (bucket.count > rateLimitMax) {
      return response.status(429).json({ error: 'Relay rate limit exceeded.' })
    }
    return next()
  })

  app.get('/health', async (_request, response) => {
    try {
      const { upstream, body } = await rpcRequest(
        fetchImpl,
        rpcUrl,
        'getSlot',
        [{ commitment: 'confirmed' }],
        timeoutMs,
      )
      if (!upstream.ok || body.error) {
        return response.status(503).json({
          service: 'leash-relay',
          status: 'degraded',
          upstream: 'unavailable',
          authoritative: false,
          transportOnly: true,
        })
      }
      return response.json({
        service: 'leash-relay',
        status: 'ok',
        upstream: 'ok',
        slot: body.result,
        authoritative: false,
        transportOnly: true,
      })
    } catch (_error) {
      return response.status(503).json({
        service: 'leash-relay',
        status: 'degraded',
        upstream: 'unavailable',
        authoritative: false,
        transportOnly: true,
      })
    }
  })

  app.post('/relay', async (request, response) => {
    const body = request.body
    const { jsonrpc, id = 1, method, params = [] } = body || {}
    if (
      !body || typeof body !== 'object' || Array.isArray(body) || jsonrpc !== '2.0' ||
      !relayMethods.has(method) ||
      !Array.isArray(params) ||
      (id !== null && !['number', 'string'].includes(typeof id))
    ) {
      return response.status(400).json({
        error: 'Only allowlisted read-only JSON-RPC methods are accepted.',
      })
    }
    try {
      const { upstream, body } = await rpcRequest(
        fetchImpl,
        rpcUrl,
        method,
        params,
        timeoutMs,
        id,
        maxResponseBytes,
      )
      return response.status(upstream.ok && !body.error ? 200 : 502).json(body)
    } catch (_error) {
      return response.status(502).json({ error: 'Upstream RPC unavailable.' })
    }
  })

  app.use((error, _request, response, next) => {
    if (error.type === 'entity.too.large' || error.type === 'entity.parse.failed') {
      return response.status(error.type === 'entity.too.large' ? 413 : 400).json({
        error: 'Request body is invalid or too large.',
      })
    }
    return next(error)
  })

  return app
}

async function rpcRequest(fetchImpl, rpcUrl, method, params, timeoutMs, id = 1, maxResponseBytes = DEFAULT_UPSTREAM_RESPONSE_BYTES) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const upstream = await fetchImpl(rpcUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
      signal: controller.signal,
    })
    const bytes = await upstream.arrayBuffer()
    if (bytes.byteLength > maxResponseBytes) throw new Error('Upstream response too large.')
    const body = JSON.parse(new TextDecoder().decode(bytes))
    return { upstream, body }
  } finally {
    clearTimeout(timeout)
  }
}

if (require.main === module) {
  const port = Number(process.env.PORT || 8787)
  createApp().listen(port, () => {
    console.log(`LEASH read-only relay listening on http://localhost:${port}`)
  })
}

module.exports = { createApp, relayMethods }
