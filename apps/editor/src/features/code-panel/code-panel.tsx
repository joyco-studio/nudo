import { Fragment, useMemo } from 'react'
import type { CSSProperties } from 'react'
import type { NodeId } from '@nudo-tsl/core'
import { CircleAlert } from 'lucide-react'

import { useT } from '@/i18n/use-t'
import { Button } from '@/shared/ui/button'

import type { FailedNode } from './failed-nodes'
import { highlightCode } from './highlight-code'

import './code-panel.css'

export interface CodePanelProps {
  /** The generated module; empty while `failedNodes` is not. */
  code: string
  failedNodes: readonly FailedNode[]
  /** Selects the node and brings it into view on the canvas. */
  onShowNode: (nodeId: NodeId) => void
}

type GutterStyle = CSSProperties & { readonly '--code-gutter': string }

/** The module, highlighted, one numbered line per source line. Its text is exactly the module. */
function CodeLines({ code }: { code: string }) {
  const lines = useMemo(() => highlightCode(code), [code])
  const gutter: GutterStyle = { '--code-gutter': `${String(String(lines.length).length)}ch` }
  return (
    <pre style={gutter} className="w-max min-w-full">
      {lines.map((line, lineIndex) => (
        <Fragment key={lineIndex}>
          {lineIndex > 0 && '\n'}
          <span data-code-line="">
            {line.map((token, tokenIndex) => (
              <span key={tokenIndex} data-token={token.kind}>
                {token.text}
              </span>
            ))}
          </span>
        </Fragment>
      ))}
    </pre>
  )
}

interface FailedNodeListProps {
  failedNodes: readonly FailedNode[]
  onShowNode: (nodeId: NodeId) => void
}

/** Why there is no code, and a button per failing node that finds it on the canvas. */
function FailedNodeList({ failedNodes, onShowNode }: FailedNodeListProps) {
  const t = useT()
  return (
    <div className="flex flex-col gap-2 font-sans">
      <h3 className="flex items-center gap-2 text-sm font-medium">
        <CircleAlert aria-hidden="true" className="size-4 shrink-0 text-destructive" />
        {t('code.errors.title')}
      </h3>
      <p className="text-xs text-muted-foreground">{t('code.errors.description')}</p>
      <ul className="flex flex-wrap gap-2">
        {failedNodes.map((failed) => (
          <li key={failed.nodeId}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onShowNode(failed.nodeId)
              }}
            >
              {failed.title}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * The code drawer's body: the live TSL module, or the nodes keeping it from generating. The region
 * scrolls, so it takes keyboard focus (with the quiet inset indicator) to scroll by arrow keys. It
 * is opaque, unlike the panel around it: dense code stays at its measured contrast over any node.
 */
export function CodePanel({ code, failedNodes, onShowNode }: CodePanelProps) {
  const t = useT()
  return (
    <div
      role="region"
      aria-label={t('code.region')}
      tabIndex={0}
      data-focus-ring="inset"
      className="code-view size-full overflow-auto bg-background p-3 font-mono text-xs leading-5"
    >
      {code === '' || failedNodes.length > 0 ? (
        <FailedNodeList failedNodes={failedNodes} onShowNode={onShowNode} />
      ) : (
        <CodeLines code={code} />
      )}
    </div>
  )
}
