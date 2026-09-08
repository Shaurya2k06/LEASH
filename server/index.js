require('dotenv').config()

const cors = require('cors')
const express = require('express')

const app = express()
const port = Number(process.env.PORT || 8787)
const rpcUrl = process.env.SOLANA_RPC_URL || 'https://rpc.magicblock.app/devnet'
const relayMethods = new Set([
  'getAccountInfo',
  'getLatestBlockhash',
  'getSignatureStatuses',
  'getSlot',
  'getTransaction',
  'sendTransaction',
])

app.use(cors())
app.use(express.json({ limit: '1mb' }))
app.get('/health', (_request, response) => {
  response.json({ service: 'leash-relay', status: 'ok', authoritative: false, transportOnly: true })
})

app.post('/relay', async (request, response) => {
  const { method, params = [] } = request.body || {}
  if (!relayMethods.has(method) || !Array.isArray(params)) {
    return response.status(400).json({ error: 'Only allowlisted JSON-RPC transport methods are accepted.' })
  }
  try {
    const upstream = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    })
    const body = await upstream.json()
    return response.status(upstream.ok && !body.error ? 200 : 502).json(body)
  } catch (error) {
    return response.status(502).json({ error: error.message })
  }
})

app.listen(port, () => {
  console.log(`LEASH transport relay listening on http://localhost:${port}`)
})
