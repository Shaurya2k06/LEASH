import { useCallback, useEffect, useState } from 'react'
import './leash.css'
import LeashLandingPage from './LeashLandingPage'
import OperatorCockpit from './components/OperatorCockpit'
import { scrollToTarget } from './lib/lenis'

const programId = import.meta.env.VITE_PROGRAM_ID || ''
const rpcUrl = import.meta.env.VITE_SOLANA_RPC_URL || ''
const relayUrl = import.meta.env.VITE_RELAY_URL || ''

async function rpc(method, params = []) {
  if (!rpcUrl) throw new Error('VITE_SOLANA_RPC_URL is not configured')
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })
  const body = await response.json()
  if (!response.ok || body.error) {
    throw new Error(body.error?.message || `RPC request failed (${response.status})`)
  }
  return body.result
}

function routeFor(pathname) {
  return pathname === '/dashboard' || pathname.startsWith('/dashboard/') || pathname === '/demo' ? 'dashboard' : 'landing'
}

export default function App() {
  const [route, setRoute] = useState(() => routeFor(window.location.pathname))
  const [runtime, setRuntime] = useState({
    state: 'CHECKING',
    slot: '—',
    deployed: '—',
    relay: '—',
    error: '',
  })
  const [evidence, setEvidence] = useState(null)
  const [evidenceError, setEvidenceError] = useState('')
  const [demo, setDemo] = useState(null)
  const [demoError, setDemoError] = useState('')

  const navigate = useCallback((target) => {
    const [pathname, hash] = target.split('#')
    window.history.pushState({}, '', target)
    setRoute(routeFor(pathname))
    window.scrollTo({ top: 0, behavior: 'auto' })
    if (hash) requestAnimationFrame(() => scrollToTarget(`#${hash}`, -80))
  }, [])

  useEffect(() => {
    const onPopState = () => setRoute(routeFor(window.location.pathname))
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => {
    if (window.location.pathname === '/demo') {
      window.history.replaceState({}, '', '/dashboard#live-demo')
    }
    if (window.location.hash) requestAnimationFrame(() => scrollToTarget(window.location.hash, -80))
  }, [])

  const refresh = useCallback(async () => {
    setRuntime((current) => ({ ...current, state: 'CHECKING', error: '' }))
    setEvidenceError('')
    setDemoError('')
    if (!programId || !rpcUrl || !relayUrl) {
      setEvidence(null)
      setDemo(null)
      setEvidenceError('Public client configuration is incomplete.')
      setRuntime({
        state: 'CONFIG MISSING',
        slot: '—',
        deployed: '—',
        relay: '—',
        error: 'Set VITE_SOLANA_RPC_URL, VITE_PROGRAM_ID, and VITE_RELAY_URL.',
      })
      return
    }

    const [slotResult, accountResult, relayResult, evidenceResult, demoResult] = await Promise.allSettled([
      rpc('getSlot', [{ commitment: 'confirmed' }]),
      rpc('getAccountInfo', [programId, { encoding: 'base64', commitment: 'confirmed' }]),
      fetch(`${relayUrl}/health`).then((response) => {
        if (!response.ok) throw new Error(`Relay health failed (${response.status})`)
        return true
      }),
      fetch('/evidence.json', { cache: 'no-store' }).then(async (response) => {
        if (!response.ok) throw new Error(`Evidence manifest failed (${response.status})`)
        return response.json()
      }),
      fetch('/demo.json', { cache: 'no-store' }).then(async (response) => {
        if (!response.ok) throw new Error(`Demo artifact failed (${response.status})`)
        return response.json()
      }),
    ])

    const slot = slotResult.status === 'fulfilled' ? slotResult.value : null
    const account = accountResult.status === 'fulfilled' ? accountResult.value : null
    const relay = relayResult.status === 'fulfilled' && relayResult.value
    // Only slot + account are meaningful health checks; relay is optional infrastructure
    const coreErrors = [slotResult, accountResult]
      .filter((result) => result.status === 'rejected')
      .map((result) => result.reason?.message || String(result.reason))
    setRuntime({
      state: coreErrors.length === 0 && account?.value?.executable ? 'READY' : 'DEGRADED',
      slot: typeof slot === 'number' ? slot.toLocaleString() : '—',
      deployed: account?.value?.executable ? 'YES' : 'NO',
      relay: relay ? 'READY' : 'OFFLINE',
      error: coreErrors.join(' · '),
    })
    if (evidenceResult.status === 'fulfilled') {
      const manifest = evidenceResult.value
      if (manifest.program?.id !== programId) {
        setEvidence(null)
        setEvidenceError('Evidence manifest program does not match VITE_PROGRAM_ID.')
      } else {
        setEvidence(manifest)
      }
    } else {
      setEvidence(null)
      setEvidenceError(evidenceResult.reason?.message || String(evidenceResult.reason))
    }
    if (demoResult.status === 'fulfilled') {
      const artifact = demoResult.value
      if (artifact.program?.id !== programId) {
        setDemo(null)
        setDemoError('Demo artifact program does not match VITE_PROGRAM_ID.')
      } else {
        setDemo(artifact)
      }
    } else {
      setDemo(null)
      setDemoError(demoResult.reason?.message || String(demoResult.reason))
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial external health/evidence fetch
    refresh()
  }, [refresh])

  if (route === 'dashboard') {
    return (
      <OperatorCockpit
        runtime={runtime}
        programId={programId}
        rpcUrl={rpcUrl}
        evidence={evidence}
        evidenceError={evidenceError}
        demo={demo}
        demoError={demoError}
        onRefresh={refresh}
        onBackToLanding={() => navigate('/')}
        onOpenDemo={() => navigate('/dashboard#live-demo')}
      />
    )
  }

  return (
    <LeashLandingPage
      onOpenCockpit={() => navigate('/dashboard')}
      onOpenDemo={() => navigate('/dashboard#live-demo')}
      runtime={runtime}
      onRefresh={refresh}
      programId={programId}
      evidence={evidence}
      evidenceError={evidenceError}
    />
  )
}
