export const EVIDENCE_HOLD_MS = 4200

const statusText = (gate) => (gate?.status === 'passed' ? 'VERIFIED' : 'UNAVAILABLE')

const boolText = (value) => (value ? 'YES' : 'NO')

export function createEvidenceBeats(evidence) {
  const privacy = evidence?.gates?.privacy
  const settlement = evidence?.gates?.settlement
  const expiry = evidence?.gates?.expiry
  const race = evidence?.gates?.race
  const program = evidence?.program
  const unavailable = !evidence

  return [
    {
      id: 'privacy',
      label: 'Privacy',
      eyebrow: 'Sibling read gate · TEE PER',
      title: unavailable ? 'Evidence is not available.' : 'Private state stays private.',
      body: unavailable
        ? 'The browser received no sanitized evidence manifest. Run the live gates and publish their results before making a claim.'
        : 'The live sibling-read gate verified that an enrolled agent can read its own ledger while sibling direct, batch, subscription, transaction, and simulation paths reveal no private bytes.',
      quote: unavailable
        ? 'No gate artifact loaded.'
        : `Base secret bytes: ${boolText(privacy?.baseLedgerSecretBytes)} · sibling direct read: ${boolText(privacy?.siblingDirectVisible)}`,
      stamp: statusText(privacy),
      artifact: {
        kind: 'message',
        heading: 'Privacy Gate Artifact',
        lines: [
          { k: 'Own ledger visible', v: boolText(privacy?.ownLedgerVisible) },
          { k: 'Base secret bytes', v: boolText(privacy?.baseLedgerSecretBytes) },
          { k: 'Sibling direct / batch', v: `${boolText(privacy?.siblingDirectVisible)} / ${boolText(privacy?.siblingBatchVisible)}` },
          { k: 'Simulation secret bytes', v: boolText(privacy?.siblingSimulationSecretBytes) },
        ],
      },
    },
    {
      id: 'settlement',
      label: 'Settlement',
      eyebrow: 'Authenticated action · rollback and retry',
      title: unavailable ? 'Settlement evidence is waiting.' : 'Payment failure remains retryable.',
      body: unavailable
        ? 'No current settlement artifact is available to the public operator view.'
        : 'The settlement gate exercised an underfunded SPL action, verified that the private reservation survived, repaired the source vault, retried once, and rejected replay.',
      quote: unavailable
        ? 'No gate artifact loaded.'
        : `Reservation preserved: ${boolText(settlement?.failedActionPreservedReservation)} · paid once: ${boolText(settlement?.retryPaidOnce)}`,
      stamp: statusText(settlement),
      artifact: {
        kind: 'authority',
        heading: 'Settlement Gate Artifact',
        lines: [
          { k: 'Failed action preserved', v: boolText(settlement?.failedActionPreservedReservation) },
          { k: 'Retry paid once', v: boolText(settlement?.retryPaidOnce) },
          { k: 'Replay rejected', v: boolText(settlement?.replayRejected) },
          { k: 'Receipt secret fields', v: `${boolText(settlement?.publicReceiptHasAmount)} amount / ${boolText(settlement?.publicReceiptHasDigest)} digest` },
        ],
      },
    },
    {
      id: 'expiry',
      label: 'Expiry',
      eyebrow: 'Expiry gate · payment exclusion',
      title: unavailable ? 'Expiry evidence is waiting.' : 'Expiry and payment are mutually exclusive.',
      body: unavailable
        ? 'No current expiry artifact is available to the public operator view.'
        : 'The expiry gate published an expired terminal, rejected a later settlement, and rejected replay while keeping private receipt data out of the public account.',
      quote: unavailable
        ? 'No gate artifact loaded.'
        : `Terminal published: ${boolText(expiry?.expiredTerminalPublished)} · settlement after expiry: ${boolText(expiry?.settlementAfterExpiryRejected)}`,
      stamp: statusText(expiry),
      artifact: {
        kind: 'receipt',
        heading: 'Expiry Gate Artifact',
        lines: [
          { k: 'Expired terminal published', v: boolText(expiry?.expiredTerminalPublished) },
          { k: 'Settlement excluded', v: boolText(expiry?.settlementAfterExpiryRejected) },
          { k: 'Expiry replay rejected', v: boolText(expiry?.expiryReplayRejected) },
          { k: 'Receipt secret fields', v: `${boolText(expiry?.publicReceiptHasAmount)} amount / ${boolText(expiry?.publicReceiptHasDigest)} digest` },
        ],
      },
    },
    {
      id: 'race',
      label: 'Race',
      eyebrow: 'Budget race · twenty private sessions',
      title: unavailable ? 'Race evidence is waiting.' : 'Atomic reservation picks one winner.',
      body: unavailable
        ? 'No current race artifact is available to the public operator view.'
        : 'Twenty concurrent private sessions competed for one remaining budget unit. The live gate recorded one reservation and nineteen rejected attempts without budget drift.',
      quote: unavailable
        ? 'No gate artifact loaded.'
        : `${race?.successfulReservations ?? '—'} winner · ${race?.losingReservations ?? '—'} rejected · exact budget: ${boolText(race?.exactBudgetPreserved)}`,
      stamp: statusText(race),
      artifact: {
        kind: 'offer',
        heading: 'Race Gate Artifact',
        lines: [
          { k: 'Contenders', v: race?.contenders ?? '—' },
          { k: 'Successful reservations', v: race?.successfulReservations ?? '—' },
          { k: 'Losing reservations', v: race?.losingReservations ?? '—' },
          { k: 'Exact budget preserved', v: boolText(race?.exactBudgetPreserved) },
        ],
      },
    },
    {
      id: 'deployment',
      label: 'Deployment',
      eyebrow: 'Public binary · Solana devnet',
      title: unavailable ? 'Deployment evidence is waiting.' : 'The deployed binary is identified.',
      body: unavailable
        ? 'No deployment manifest is available to compare against the browser configuration.'
        : 'The public manifest records the exact program binary hash and deployment slot used by the live gate run. The browser still checks current RPC health independently.',
      quote: unavailable
        ? 'No evidence manifest loaded.'
        : `Program ${program?.id || '—'} · deployed in slot ${program?.deployedInSlot ?? '—'}`,
      stamp: evidence?.status === 'passed' ? 'VERIFIED' : 'UNAVAILABLE',
      artifact: {
        kind: 'contract',
        heading: 'Deployment Manifest',
        lines: [
          { k: 'Network', v: evidence?.network || '—' },
          { k: 'Program', v: program?.id || '—' },
          { k: 'Binary SHA-256', v: program?.binarySha256 ? `${program.binarySha256.slice(0, 12)}…` : '—' },
          { k: 'Gate revision', v: evidence?.verifiedAt || '—' },
        ],
      },
    },
  ]
}

export function nextEvidenceIndex(index, length) {
  return ((index % length) + length) % length
}
