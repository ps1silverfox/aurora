import React, { useState } from 'react';
import { DecoratorNode, type LexicalNode, type NodeKey, type SerializedLexicalNode } from 'lexical';
import { useLexicalNodeSelection } from '@lexical/react/useLexicalNodeSelection';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SerializedReusableBlockNode extends SerializedLexicalNode {
  templateId: string;
  name: string;
  blockType: string;
  content: Record<string, unknown>;
  detached: boolean;
}

// ─── Component ───────────────────────────────────────────────────────────────

function ReusableBlockComponent({ nodeKey }: { nodeKey: NodeKey }) {
  const [editor] = useLexicalComposerContext();
  const [isSelected] = useLexicalNodeSelection(nodeKey);
  const [showSettings, setShowSettings] = useState(false);

  const getNode = () =>
    editor.getEditorState().read(() => {
      const node = editor.getEditorState()._nodeMap.get(nodeKey);
      return node instanceof ReusableBlockNode ? node : null;
    });

  const node = getNode();
  if (!node) return null;

  const { name, blockType, content, detached } = node;

  function handleDetach() {
    editor.update(() => {
      const n = editor.getEditorState()._nodeMap.get(nodeKey);
      if (n instanceof ReusableBlockNode) {
        const w = n.getWritable();
        w.__detached = true;
      }
    });
    setShowSettings(false);
  }

  return (
    <div
      style={{
        position: 'relative',
        border: isSelected ? '2px solid #4f46e5' : '2px dashed #a5b4fc',
        borderRadius: 6,
        padding: '10px 14px',
        margin: '4px 0',
        background: detached ? '#fff' : '#f5f3ff',
      }}
    >
      {!detached && (
        <div style={{ fontSize: 11, color: '#7c3aed', marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
          <span>Template: <strong>{name}</strong> ({blockType})</span>
          <button
            onClick={() => setShowSettings((v) => !v)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#7c3aed' }}
          >
            ⚙
          </button>
        </div>
      )}
      {detached && (
        <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6 }}>
          Detached block ({blockType})
        </div>
      )}

      <pre style={{ margin: 0, fontSize: 12, color: '#374151', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        {JSON.stringify(content, null, 2)}
      </pre>

      {showSettings && !detached && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            background: '#fff',
            border: '1px solid #ddd',
            borderRadius: 4,
            padding: '8px 12px',
            zIndex: 200,
            minWidth: 220,
            boxShadow: '0 2px 8px rgba(0,0,0,.15)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <strong style={{ fontSize: 12, color: '#555' }}>Template options</strong>
            <button
              onClick={() => setShowSettings(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }}
            >
              ×
            </button>
          </div>
          <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 8px' }}>
            Detaching creates an independent copy. Changes won&apos;t affect the template.
          </p>
          <button
            onClick={handleDetach}
            style={{
              background: '#4f46e5',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              padding: '4px 10px',
              fontSize: 12,
              cursor: 'pointer',
              width: '100%',
            }}
          >
            Detach &amp; edit
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Node ─────────────────────────────────────────────────────────────────────

export class ReusableBlockNode extends DecoratorNode<React.ReactElement> {
  __templateId: string;
  __name: string;
  __blockType: string;
  __content: Record<string, unknown>;
  __detached: boolean;

  static getType() {
    return 'reusable-block';
  }

  static clone(node: ReusableBlockNode): ReusableBlockNode {
    return new ReusableBlockNode(node.__templateId, node.__name, node.__blockType, node.__content, node.__detached, node.__key);
  }

  constructor(
    templateId: string,
    name: string,
    blockType: string,
    content: Record<string, unknown>,
    detached = false,
    key?: NodeKey,
  ) {
    super(key);
    this.__templateId = templateId;
    this.__name = name;
    this.__blockType = blockType;
    this.__content = content;
    this.__detached = detached;
  }

  get templateId() { return this.getLatest().__templateId; }
  get name() { return this.getLatest().__name; }
  get blockType() { return this.getLatest().__blockType; }
  get content() { return this.getLatest().__content; }
  get detached() { return this.getLatest().__detached; }

  static importJSON(data: SerializedReusableBlockNode): ReusableBlockNode {
    return new ReusableBlockNode(data.templateId, data.name, data.blockType, data.content, data.detached);
  }

  exportJSON(): SerializedReusableBlockNode {
    return {
      type: 'reusable-block',
      version: 1,
      templateId: this.__templateId,
      name: this.__name,
      blockType: this.__blockType,
      content: this.__content,
      detached: this.__detached,
    };
  }

  createDOM(): HTMLElement {
    const div = document.createElement('div');
    div.style.display = 'contents';
    return div;
  }

  updateDOM(): false {
    return false;
  }

  decorate(): React.ReactElement {
    return <ReusableBlockComponent nodeKey={this.__key} />;
  }
}

export function $createReusableBlockNode(
  templateId: string,
  name: string,
  blockType: string,
  content: Record<string, unknown>,
  detached = false,
): ReusableBlockNode {
  return new ReusableBlockNode(templateId, name, blockType, content, detached);
}

export function $isReusableBlockNode(node: LexicalNode | null | undefined): node is ReusableBlockNode {
  return node instanceof ReusableBlockNode;
}
