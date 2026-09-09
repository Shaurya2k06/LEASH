import { useCallback, useEffect, useState } from "react";

const phaseLabel = {
  base: "BASE",
  private: "TEE / PRIVATE",
  tee: "TEE",
  public: "PUBLIC",
};

function ExternalLink({ href, children }) {
  return (
    <a className="demo-proof-link" href={href} target="_blank" rel="noreferrer">
      {children} ↗
    </a>
  );
}

export default function DemoProofTape({ demoApiUrl }) {
  const [run, setRun] = useState({ status: "loading", steps: [] });
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!demoApiUrl) {
      setRun({ status: "configuration-required", steps: [] });
      setError("VITE_DEMO_API_URL is not configured.");
      return;
    }
    try {
      const response = await fetch(`${demoApiUrl}/demo`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok)
        throw new Error(
          body.error || `Demo worker failed (${response.status})`,
        );
      setRun(body);
    } catch (requestError) {
      setError(requestError.message);
    }
  }, [demoApiUrl]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial worker state fetch
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (run.status !== "running") return undefined;
    const timer = window.setInterval(refresh, 750);
    return () => window.clearInterval(timer);
  }, [refresh, run.status]);

  const start = async () => {
    setError("");
    setSelectedIndex(null);
    try {
      const response = await fetch(`${demoApiUrl}/demo`, { method: "POST" });
      const body = await response.json();
      if (response.status === 409) {
        setRun(body);
        return;
      }
      if (!response.ok) {
        const retry = body.retryAfterMs
          ? ` Try again in ${Math.ceil(body.retryAfterMs / 1000)}s.`
          : "";
        throw new Error(
          `${body.error || `Demo worker failed (${response.status})`}${retry}`,
        );
      }
      setRun(body);
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const steps = run.steps || [];
  const activeIndex = Math.min(
    selectedIndex ?? Math.max(steps.length - 1, 0),
    Math.max(steps.length - 1, 0),
  );
  const activeStep = steps[activeIndex];
  const running = run.status === "running";
  const passed = run.status === "passed";

  return (
    <section className="demo-proof-section" id="live-demo">
      <div className="demo-proof-header">
        <div>
          <h2 className="section-title">
            Execute the authenticated settlement.
          </h2>
          <p className="section-desc">
            Starting this lifecycle creates fresh accounts and submits real
            devnet transactions. A step appears only after the worker confirms
            it.
          </p>
        </div>
        <div
          className={`demo-proof-status ${passed ? "is-passed" : ""} ${running ? "is-running" : ""}`}
        >
          <span className="demo-proof-status-dot" />
          {run.status.toUpperCase().replaceAll("-", " ")}
        </div>
      </div>

      {error && <p className="demo-proof-error">{error}</p>}

      <div className="demo-proof-controls">
        <button
          type="button"
          className="leash-btn-primary"
          onClick={start}
          disabled={running || !demoApiUrl}
        >
          {running
            ? "Executing live…"
            : passed
              ? "Run another lifecycle"
              : "Run live lifecycle"}
        </button>
        {selectedIndex !== null && steps.length > 0 && (
          <button
            type="button"
            className="leash-btn-secondary"
            onClick={() => setSelectedIndex(null)}
          >
            Follow latest step
          </button>
        )}
        <span className="demo-proof-position">
          {steps.length} CONFIRMED STEPS
        </span>
      </div>

      {running && steps.length === 0 && (
        <div className="demo-proof-waiting">
          Worker started · waiting for the first confirmed devnet step…
        </div>
      )}

      {steps.length > 0 && (
        <>
          <div
            className="demo-proof-path"
            aria-label="Live demo lifecycle steps"
          >
            {steps.map((step, index) => (
              <button
                type="button"
                key={`${step.id}-${index}`}
                className={`demo-proof-node ${index === activeIndex ? "is-active" : ""} ${index < steps.length - 1 || passed ? "is-complete" : ""}`}
                onClick={() => setSelectedIndex(index)}
                aria-label={`Open confirmed step ${index + 1}: ${step.label}`}
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                <small>{step.label}</small>
              </button>
            ))}
          </div>

          {activeStep && (
            <article
              className={`demo-proof-active-step demo-proof-step-${activeStep.phase}`}
            >
              <div className="demo-proof-step-heading">
                <div>
                  <span className="demo-proof-phase">
                    {phaseLabel[activeStep.phase] || activeStep.phase}
                  </span>
                  <h3>{activeStep.label}</h3>
                </div>
                <span className="demo-proof-check">✓ CONFIRMED LIVE</span>
              </div>
              {activeStep.detail && <p>{activeStep.detail}</p>}
              <div className="demo-proof-links">
                {activeStep.explorerUrl && (
                  <ExternalLink href={activeStep.explorerUrl}>
                    Explorer transaction
                  </ExternalLink>
                )}
                {(activeStep.relatedSignatures || []).map((related) => (
                  <ExternalLink
                    key={related.signature}
                    href={related.explorerUrl}
                  >
                    {related.label}
                  </ExternalLink>
                ))}
                {(activeStep.accounts || []).map((account) => (
                  <ExternalLink
                    key={account.address}
                    href={account.explorerUrl}
                  >
                    Account {account.address.slice(0, 6)}…
                  </ExternalLink>
                ))}
              </div>
            </article>
          )}
        </>
      )}

      {run.program?.explorerUrl && (
        <div className="demo-proof-footer">
          <span className="leash-micro">
            RUN {run.runId} · PROGRAM {run.program.id}
          </span>
          <ExternalLink href={run.program.explorerUrl}>
            Open program account
          </ExternalLink>
        </div>
      )}
    </section>
  );
}
