require('dotenv').config()

const cors = require('cors')
const express = require('express')

const app = express()
const port = Number(process.env.PORT || 8787)

app.use(cors())
app.get('/health', (_request, response) => {
  response.json({ service: 'blackout-relay', status: 'ok', authoritative: false })
})

app.listen(port, () => {
  console.log(`BLACKOUT relay listening on http://localhost:${port}`)
})
