import {
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

function ArchitectureNode({ data }) {
  return (
    <div className={`architecture-flow-node ${data.tone}`}>
      <Handle type="target" position={Position.Left} />
      <div className="architecture-flow-node-title">{data.title}</div>
      <p>{data.description}</p>
      <Handle type="source" position={Position.Right} />
    </div>
  )
}

const nodeTypes = { architecture: ArchitectureNode }

const edgeDefaults = {
  type: 'smoothstep',
  markerEnd: { type: MarkerType.ArrowClosed, color: '#7d9698' },
  style: { stroke: '#7d9698', strokeWidth: 1.5 },
}

export default function ArchitectureMatrix({ programId }) {
  const nodes = [
    {
      id: 'agents',
      type: 'architecture',
      position: { x: 0, y: 80 },
      data: { tone: 'ingress', title: 'Agent swarms', description: 'Untrusted permit requests' },
    },
    {
      id: 'operator',
      type: 'architecture',
      position: { x: 0, y: 230 },
      data: { tone: 'ingress', title: 'Operator / MCP', description: 'Public audit access' },
    },
    {
      id: 'relay',
      type: 'architecture',
      position: { x: 270, y: 155 },
      data: { tone: 'ingress', title: 'Read-only relay', description: 'Rate-limited routing' },
    },
    {
      id: 'tee',
      type: 'architecture',
      position: { x: 540, y: 155 },
      data: { tone: 'private', title: 'MagicBlock TEE PER', description: 'Private policy execution' },
    },
    {
      id: 'policy',
      type: 'architecture',
      position: { x: 820, y: 30 },
      data: { tone: 'private', title: 'SecretPolicy', description: 'Private budget constraints' },
    },
    {
      id: 'ledger',
      type: 'architecture',
      position: { x: 820, y: 155 },
      data: { tone: 'private', title: 'SessionLedger', description: 'Per-agent isolation' },
    },
    {
      id: 'action',
      type: 'architecture',
      position: { x: 820, y: 280 },
      data: { tone: 'settlement', title: 'SPL Magic Action', description: 'Atomic settlement' },
    },
    {
      id: 'terminal',
      type: 'architecture',
      position: { x: 1090, y: 155 },
      data: { tone: 'settlement', title: 'TerminalMarker PDA', description: 'Spent or expired' },
    },
    {
      id: 'solana',
      type: 'architecture',
      position: { x: 1360, y: 155 },
      data: {
        tone: 'settlement',
        title: 'Solana consensus',
        description: programId ? `Devnet · ${programId.slice(0, 8)}…${programId.slice(-4)}` : 'Devnet program',
      },
    },
  ]

  const edges = [
    { id: 'agents-relay', source: 'agents', target: 'relay', label: 'permit request', ...edgeDefaults },
    { id: 'operator-relay', source: 'operator', target: 'relay', label: 'read-only query', ...edgeDefaults },
    { id: 'relay-tee', source: 'relay', target: 'tee', label: 'authenticated route', ...edgeDefaults },
    { id: 'tee-policy', source: 'tee', target: 'policy', label: 'evaluate', ...edgeDefaults },
    { id: 'tee-ledger', source: 'tee', target: 'ledger', label: 'isolate', ...edgeDefaults },
    { id: 'tee-action', source: 'tee', target: 'action', label: 'authorize', ...edgeDefaults },
    { id: 'action-terminal', source: 'action', target: 'terminal', label: 'settle once', ...edgeDefaults },
    { id: 'terminal-solana', source: 'terminal', target: 'solana', label: 'public marker', ...edgeDefaults },
  ]

  return (
    <section className="leash-section" id="architecture">
      <div className="section-header-wrap" data-aos="fade-up">
        <h2 className="section-title">Confidential execution architecture.</h2>
        <p className="section-desc">
          A directed path from agent intent through private policy enforcement to public settlement,
          with sensitive state kept inside the MagicBlock TEE.
        </p>
      </div>

      <div className="architecture-flow-shell" data-aos="fade-up" data-aos-delay="100">
        <div className="architecture-flow-canvas">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.16, minZoom: 0.45, maxZoom: 1 }}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            panOnScroll
            zoomOnDoubleClick={false}
            proOptions={{ hideAttribution: false }}
          >
            <Background color="#aab8b3" gap={24} size={1} />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>
      </div>
    </section>
  )
}
