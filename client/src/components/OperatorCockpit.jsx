import { useCallback, useEffect, useState } from "react";
import DemoProofTape from "./DemoProofTape";
import WalletConnectButton from "./WalletConnectButton";

function ExplorerLink({ href, children }) {
  return (
    <a className="demo-proof-link" href={href} target="_blank" rel="noreferrer">
      {children} ↗
    </a>
  );
}

const gateRowsFor = (gates) => {
  const result = (gate, passed) => {
    if (gate?.status === "passed") return passed(gate);
    if (gate?.status === "running") return "EXECUTING…";
    if (gate?.status === "failed") return "FAILED";
    return "RUN LIVE";
  };
  return [
    {
      id: "privacy",
      label: "Sibling read privacy",
      detail: "Direct, batch, subscription, transaction, and simulation paths",
      result: result(gates.privacy, () => "DENIED"),
      source: gates.privacy?.generatedAt || "Not run in this worker session",
      proof: gates.privacy,
    },
    {
      id: "settlement",
      label: "Settlement rollback / retry",
      detail: "Underfunded action preserves reservation; retry pays once",
      result: result(gates.settlement, () => "PRESERVED"),
      source: gates.settlement?.generatedAt || "Not run in this worker session",
      proof: gates.settlement,
    },
    {
      id: "expiry",
      label: "Expiry payment exclusion",
      detail: "Expired terminal blocks settlement and replay",
      result: result(gates.expiry, () => "REJECTED"),
      source: gates.expiry?.generatedAt || "Not run in this worker session",
      proof: gates.expiry,
    },
    {
      id: "race",
      label: "Twenty-agent budget race",
      detail: "Concurrent sessions competing for one remaining unit",
      result: result(
        gates.race,
        (gate) =>
          `${gate.successfulReservations} WON / ${gate.losingReservations} REJECTED`,
      ),
      source: gates.race?.generatedAt || "Not run in this worker session",
      proof: gates.race,
    },
  ];
};

export default function OperatorCockpit({
  runtime,
  programId,
  rpcUrl,
  evidence,
  evidenceError,
  onRefresh,
  onBackToLanding,
  onOpenDemo,
  demoApiUrl,
}) {
  const [liveGates, setLiveGates] = useState({});
  const [gateError, setGateError] = useState("");
  const gates = gateRowsFor(liveGates);
  const passedCount = Object.values(liveGates).filter(
    (gate) => gate.status === "passed",
  ).length;
  const race = liveGates.race;
  const gateRunning = Object.values(liveGates).some(
    (gate) => gate.status === "running",
  );

  const refreshGates = useCallback(async () => {
    if (!demoApiUrl) return;
    try {
      const response = await fetch(`${demoApiUrl}/gates`, {
        cache: "no-store",
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(
          body.error || `Gate worker failed (${response.status})`,
        );
      setLiveGates(body);
    } catch (requestError) {
      setGateError(requestError.message);
    }
  }, [demoApiUrl]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial worker state fetch
    refreshGates();
  }, [refreshGates]);

  useEffect(() => {
    if (!gateRunning) return undefined;
    const timer = window.setInterval(refreshGates, 1_000);
    return () => window.clearInterval(timer);
  }, [gateRunning, refreshGates]);

  const runGate = async (gate) => {
    setGateError("");
    try {
      const response = await fetch(`${demoApiUrl}/gates/${gate}`, {
        method: "POST",
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(
          body.error || `Gate worker failed (${response.status})`,
        );
      setLiveGates((current) => ({ ...current, [gate]: body }));
    } catch (requestError) {
      setGateError(requestError.message);
    }
  };

  return (
    <main className="leash-page" style={{ minHeight: "100vh" }}>
      <div className="leash-shell">
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "16px",
            padding: "24px 0",
            borderBottom: "1px solid var(--border-strong)",
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            className="leash-btn-secondary"
            onClick={onBackToLanding}
          >
            ← Back to landing
          </button>
          <span className="logo-text">LEASH · Operator</span>
          <WalletConnectButton />
          <button
            type="button"
            className="leash-btn-primary"
            onClick={onOpenDemo}
          >
            Live lifecycle ↵
          </button>
          <button
            type="button"
            className="theme-switch-btn"
            onClick={onRefresh}
          >
            ↻ Refresh public runtime
          </button>
        </header>

        <section style={{ padding: "64px 0 32px" }}>
          <h1 className="section-title">
            Kernel health & live auditing.
          </h1>
          <p className="section-desc" style={{ maxWidth: "720px" }}>
            This view reads public RPC health and a sanitized evidence manifest.
            It never fetches private policy/session state or runs a transaction.
          </p>
        </section>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "12px",
            marginBottom: "40px",
          }}
          aria-label="Runtime metrics"
        >
          {[
            ["RPC health", runtime.state],
            ["Base slot", runtime.slot],
            ["Gate evidence", `${passedCount}/4`],
            [
              "Race",
              race
                ? `${race.successfulReservations} / ${race.contenders}`
                : "—",
            ],
          ].map(([label, value]) => (
            <div
              key={label}
              style={{
                padding: "20px",
                border: "1px solid var(--border-strong)",
                background: "var(--bg-card)",
              }}
            >
              <span className="leash-micro">{label}</span>
              <strong
                style={{
                  display: "block",
                  marginTop: "10px",
                  fontSize: "24px",
                  color: "var(--ink-primary)",
                }}
              >
                {value}
              </strong>
            </div>
          ))}
        </section>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: "24px",
            marginBottom: "40px",
          }}
        >
          <article
            style={{
              padding: "24px",
              border: "1px solid var(--border-strong)",
              background: "var(--bg-card)",
            }}
          >
            <h2 style={{ margin: "0 0 20px" }}>Devnet program</h2>
            <dl
              style={{
                display: "grid",
                gap: "12px",
                margin: 0,
                fontFamily: "var(--font-mono)",
                fontSize: "12px",
              }}
            >
              <div>
                <dt className="leash-micro">Program ID</dt>
                <dd style={{ wordBreak: "break-all", margin: "4px 0 0" }}>
                  {programId || "—"}
                </dd>
              </div>
              <div>
                <dt className="leash-micro">RPC</dt>
                <dd style={{ wordBreak: "break-all", margin: "4px 0 0" }}>
                  {rpcUrl || "—"}
                </dd>
              </div>
              <div>
                <dt className="leash-micro">Executable</dt>
                <dd style={{ margin: "4px 0 0" }}>{runtime.deployed}</dd>
              </div>
              <div>
                <dt className="leash-micro">Relay</dt>
                <dd style={{ margin: "4px 0 0" }}>{runtime.relay}</dd>
              </div>
            </dl>
          </article>

          <article
            style={{
              padding: "24px",
              border: "1px solid var(--border-strong)",
              background: "var(--bg-card)",
            }}
          >
            <h2 style={{ margin: "0 0 20px" }}>
              {evidence ? "Loaded from live gate run" : "Not loaded"}
            </h2>
            <dl
              style={{
                display: "grid",
                gap: "12px",
                margin: 0,
                fontFamily: "var(--font-mono)",
                fontSize: "12px",
              }}
            >
              <div>
                <dt className="leash-micro">Verified at</dt>
                <dd style={{ margin: "4px 0 0" }}>
                  {evidence?.verifiedAt || "—"}
                </dd>
              </div>
              <div>
                <dt className="leash-micro">Binary SHA-256</dt>
                <dd style={{ wordBreak: "break-all", margin: "4px 0 0" }}>
                  {evidence?.program?.binarySha256 || "—"}
                </dd>
              </div>
              <div>
                <dt className="leash-micro">Deployment slot</dt>
                <dd style={{ margin: "4px 0 0" }}>
                  {evidence?.program?.deployedInSlot ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="leash-micro">Sources</dt>
                <dd style={{ margin: "4px 0 0" }}>
                  {evidence?.sources?.length ?? 0} sanitized artifacts
                </dd>
              </div>
            </dl>
          </article>
        </section>

        <section
          style={{
            padding: "24px",
            border: "1px solid var(--border-strong)",
            background: "var(--bg-card)",
            marginBottom: "64px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "16px",
              alignItems: "baseline",
              flexWrap: "wrap",
            }}
          >
            <h2 style={{ margin: "0 0 4px" }}>Execute invariant gates</h2>
          </div>

          {evidenceError && (
            <p
              style={{
                color: "var(--accent-amber)",
                fontFamily: "var(--font-mono)",
                fontSize: "12px",
              }}
            >
              Evidence unavailable: {evidenceError}
            </p>
          )}
          {gateError && (
            <p
              style={{
                color: "var(--accent-amber)",
                fontFamily: "var(--font-mono)",
                fontSize: "12px",
              }}
            >
              Gate error: {gateError}
            </p>
          )}

          <div style={{ display: "grid", gap: "10px", marginTop: "20px" }}>
            {gates.map((gate) => (
              <div key={gate.id}>
                <button
                  type="button"
                  onClick={() => runGate(gate.id)}
                  disabled={gateRunning || !demoApiUrl}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1fr) auto",
                    gap: "16px",
                    alignItems: "center",
                    width: "100%",
                    padding: "16px",
                    textAlign: "left",
                    border: "1px solid var(--border-hairline)",
                    background: "var(--bg-canvas)",
                    color: "var(--ink-primary)",
                    cursor:
                      gateRunning || !demoApiUrl ? "not-allowed" : "pointer",
                  }}
                >
                  <span>
                    <strong style={{ display: "block" }}>{gate.label}</strong>
                    <small
                      style={{
                        display: "block",
                        marginTop: "4px",
                        color: "var(--ink-secondary)",
                      }}
                    >
                      {gate.detail} · {gate.source}
                    </small>
                  </span>
                  <strong>{gate.result}</strong>
                </button>
                {gate.proof?.status === "passed" && (
                  <div
                    className="demo-proof-links"
                    style={{ padding: "10px 16px", background: "var(--bg-card)" }}
                  >
                    {(gate.proof.transactions || []).slice(0, 6).map((transaction) => (
                      <ExplorerLink
                        key={transaction.signature}
                        href={transaction.explorerUrl}
                      >
                        {transaction.label}
                      </ExplorerLink>
                    ))}
                    {(gate.proof.accounts || []).map((account) => (
                      <ExplorerLink key={account.address} href={account.explorerUrl}>
                        {account.label}
                      </ExplorerLink>
                    ))}
                    {gate.proof.transactions?.length > 6 && (
                      <span className="leash-micro">
                        +{gate.proof.transactions.length - 6} more transaction links in worker result
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        <DemoProofTape demoApiUrl={demoApiUrl} />
      </div>
    </main>
  );
}
