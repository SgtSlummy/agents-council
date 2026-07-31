import type { OccultStatusResponse } from "../types";

type OccultReadingsPanelProps = {
  status: OccultStatusResponse | null;
};

export function OccultReadingsPanel({ status }: OccultReadingsPanelProps) {
  if (!status?.enabled) {
    return null;
  }

  return (
    <section className="occult-readings-panel" aria-label="Tarot Router readings">
      <header className="occult-readings-header">
        <div>
          <span className="occult-eyebrow">Tarot Router</span>
          <h3>Active Readings</h3>
        </div>
        <div className="occult-health">
          <span className={`occult-state occult-state-${status.observability.bridge.status}`}>
            Bridge {status.observability.bridge.status}
          </span>
          <span className="occult-contract">
            Contract {status.contract_version}
            {status.observability.nodes.average_invocation_latency_ms === null
              ? ""
              : ` / avg ${status.observability.nodes.average_invocation_latency_ms} ms`}
          </span>
        </div>
      </header>

      {status.readings.length === 0 ? (
        <p className="occult-empty">No Tarot readings are attached to this Council session.</p>
      ) : (
        <div className="occult-reading-list">
          {status.readings.map((reading) => (
            <article key={reading.reading_id} className="occult-reading-card">
              <header>
                <div>
                  <strong>{reading.spread_id}</strong>
                  <span>Version {reading.spread_version}</span>
                </div>
                <span className={`occult-state occult-state-${reading.state}`}>{reading.state}</span>
              </header>

              <div className="occult-node-list">
                {reading.nodes.map((node) => (
                  <div key={node.node_id} className="occult-node">
                    <div>
                      <strong>{node.node_id}</strong>
                      <span className="occult-pairing">
                        {node.major_arcana}
                        {node.minor_arcana ? ` + ${node.minor_arcana}` : " + awaiting Minor Arcana"}
                      </span>
                    </div>
                    <span className={`occult-node-state occult-node-state-${node.state}`}>
                      {node.state} / attempt {node.attempt}
                    </span>
                    {node.error ? (
                      <p className="occult-error" role="alert">
                        {node.error.code}: {node.error.message}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>

              {reading.approvals.length > 0 ? (
                <fieldset className="occult-approvals">
                  <legend>Reading approvals</legend>
                  {reading.approvals.map((approval) => (
                    <span key={approval.approval_id} className={`occult-approval occult-approval-${approval.state}`}>
                      {approval.node_id}: {approval.state}
                      {approval.resolved_by ? ` by ${approval.resolved_by}` : ""}
                    </span>
                  ))}
                </fieldset>
              ) : null}

              {reading.outcome_error ? (
                <p className="occult-error" role="alert">
                  {reading.outcome_error.code}: {reading.outcome_error.message}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
