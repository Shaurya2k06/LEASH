import { useEffect, useState } from 'react'

const getPhantom = () => {
  if (typeof window === 'undefined') return null
  return window.phantom?.solana || window.solana || null
}

const shorten = (address) => `${address.slice(0, 4)}…${address.slice(-4)}`

export default function WalletConnectButton() {
  const [address, setAddress] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const provider = getPhantom()
    if (!provider) return undefined

    const sync = (publicKey = provider.publicKey) => {
      setAddress(publicKey?.toString?.() || null)
    }
    const onConnect = () => sync()
    const onDisconnect = () => setAddress(null)
    const onAccountChanged = (publicKey) => sync(publicKey)

    sync()
    provider.on?.('connect', onConnect)
    provider.on?.('disconnect', onDisconnect)
    provider.on?.('accountChanged', onAccountChanged)

    return () => {
      provider.removeListener?.('connect', onConnect)
      provider.removeListener?.('disconnect', onDisconnect)
      provider.removeListener?.('accountChanged', onAccountChanged)
    }
  }, [])

  const connect = async () => {
    const provider = getPhantom()
    setError('')
    if (!provider || provider.isPhantom !== true) {
      setError('Install Phantom to connect.')
      return
    }

    try {
      const response = await provider.connect()
      setAddress(response.publicKey.toString())
    } catch (connectionError) {
      if (connectionError?.code !== 4001) setError('Connection was not completed.')
    }
  }

  const disconnect = async () => {
    try {
      await getPhantom()?.disconnect?.()
    } finally {
      setAddress(null)
    }
  }

  return (
    <span className="wallet-connect-wrap">
      <button
        type="button"
        className="leash-btn-secondary wallet-connect-btn"
        onClick={address ? disconnect : connect}
        title={address ? 'Disconnect Phantom wallet' : 'Connect Phantom wallet'}
      >
        {address ? `Phantom ${shorten(address)}` : 'Connect Phantom'}
      </button>
      {error && <span className="wallet-connect-error" role="status">{error}</span>}
    </span>
  )
}
