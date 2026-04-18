import React, { useState } from 'react';
import { DecoratorNode, type LexicalNode, type NodeKey, type SerializedLexicalNode } from 'lexical';
import { useLexicalNodeSelection } from '@lexical/react/useLexicalNodeSelection';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';

// ─── URL transformation ───────────────────────────────────────────────────────

export type EmbedProvider = 'youtube' | 'vimeo' | 'codesandbox' | 'stackblitz' | 'generic';

function detectProvider(url: string): EmbedProvider {
  if (/youtube\.com\/watch|youtu\.be\//.test(url)) return 'youtube';
  if (/vimeo\.com\/\d+/.test(url)) return 'vimeo';
  if (/codesandbox\.io\/(s|embed)\//.test(url)) return 'codesandbox';
  if (/stackblitz\.com\/(edit|run)\//.test(url)) return 'stackblitz';
  return 'generic';
}

export function getEmbedUrl(url: string): string {
  const provider = detectProvider(url);

  if (provider === 'youtube') {
    const ytShort = url.match(/youtu\.be\/([^?&]+)/);
    if (ytShort) return `https://www.youtube.com/embed/${ytShort[1]}`;
    const ytWatch = url.match(/[?&]v=([^&]+)/);
    if (ytWatch) return `https://www.youtube.com/embed/${ytWatch[1]}`;
    return url;
  }

  if (provider === 'vimeo') {
    const vimeoId = url.match(/vimeo\.com\/(\d+)/);
    if (vimeoId) return `https://player.vimeo.com/video/${vimeoId[1]}`;
    return url;
  }

  if (provider === 'codesandbox') {
    return url.replace('/s/', '/embed/');
  }

  if (provider === 'stackblitz') {
    const sep = url.includes('?') ? '&' : '?';
    return url.includes('embed=1') ? url : `${url}${sep}embed=1`;
  }

  return url;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SerializedEmbedBlockNode extends SerializedLexicalNode {
  url: string;
  height: number;
  caption: string;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, marginBottom: 6 };
const inputStyle: React.CSSProperties = { display: 'block', width: '100%', fontSize: 12, marginTop: 2, padding: '2px 4px' };

// ─── Component ───────────────────────────────────────────────────────────────

function EmbedBlockComponent({ nodeKey }: { nodeKey: NodeKey }) {
  const [editor] = useLexicalComposerContext();
  const [isSelected] = useLexicalNodeSelection(nodeKey);
  const [showSettings, setShowSettings] = useState(false);

  const getNode = () =>
    editor.getEditorState().read(() => {
      const n = editor.getEditorState()._nodeMap.get(nodeKey);
      return n instanceof EmbedBlockNode ? n : null;
    });

  const node = getNode();
  const url = node?.__url ?? '';
  const height = node?.__height ?? 400;
  const caption = node?.__caption ?? '';
  const provider = detectProvider(url);
  const embedUrl = url ? getEmbedUrl(url) : '';

  const update = (patch: Partial<{ url: string; height: number; caption: string }>) => {
    editor.update(() => {
      const n = editor.getEditorState()._nodeMap.get(nodeKey);
      if (!(n instanceof EmbedBlockNode)) return;
      const w = n.getWritable();
      if (patch.url !== undefined) w.__url = patch.url;
      if (patch.height !== undefined) w.__height = patch.height;
      if (patch.caption !== undefined) w.__caption = patch.caption;
    });
  };

  const providerLabels: Record<EmbedProvider, string> = {
    youtube: 'YouTube',
    vimeo: 'Vimeo',
    codesandbox: 'CodeSandbox',
    stackblitz: 'StackBlitz',
    generic: 'Embed',
  };

  return (
    <div style={{ position: 'relative', outline: isSelected ? '2px solid #4f8ef7' : 'none' }}>
      <div
        style={{ cursor: 'pointer' }}
        onClick={() => setShowSettings((v) => !v)}
      >
        {embedUrl ? (
          <iframe
            src={embedUrl}
            style={{ width: '100%', height, border: 'none', borderRadius: 3 }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title={caption || providerLabels[provider]}
          />
        ) : (
          <div
            style={{
              height,
              background: '#f5f5f5',
              border: '2px dashed #ddd',
              borderRadius: 3,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              color: '#999',
            }}
          >
            Click to add embed URL
          </div>
        )}
        {caption && (
          <div style={{ fontSize: 11, color: '#888', textAlign: 'center', marginTop: 4, fontStyle: 'italic' }}>
            {caption}
          </div>
        )}
      </div>

      {showSettings && (
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
            minWidth: 280,
            boxShadow: '0 2px 8px rgba(0,0,0,.15)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <strong style={{ fontSize: 12, color: '#555' }}>
              {url ? providerLabels[provider] : 'Embed settings'}
            </strong>
            <button onClick={() => setShowSettings(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }}>×</button>
          </div>
          <label style={labelStyle}>
            URL (YouTube, Vimeo, CodeSandbox, StackBlitz, or iframe)
            <input
              style={inputStyle}
              defaultValue={url}
              placeholder="https://www.youtube.com/watch?v=..."
              onBlur={(e) => update({ url: e.currentTarget.value.trim() })}
            />
          </label>
          <label style={labelStyle}>
            Height (px)
            <input
              type="number"
              style={inputStyle}
              defaultValue={height}
              min={100}
              max={1200}
              onBlur={(e) => update({ height: parseInt(e.currentTarget.value) || 400 })}
            />
          </label>
          <label style={labelStyle}>
            Caption
            <input
              style={inputStyle}
              defaultValue={caption}
              onBlur={(e) => update({ caption: e.currentTarget.value })}
            />
          </label>
        </div>
      )}
    </div>
  );
}

// ─── Node ─────────────────────────────────────────────────────────────────────

export class EmbedBlockNode extends DecoratorNode<React.ReactElement> {
  __url: string;
  __height: number;
  __caption: string;

  static getType(): string { return 'embed-block'; }

  static clone(node: EmbedBlockNode): EmbedBlockNode {
    return new EmbedBlockNode(node.__url, node.__height, node.__caption, node.__key);
  }

  static importJSON(json: SerializedEmbedBlockNode): EmbedBlockNode {
    return new EmbedBlockNode(json.url, json.height, json.caption);
  }

  constructor(url = '', height = 400, caption = '', key?: NodeKey) {
    super(key);
    this.__url = url;
    this.__height = height;
    this.__caption = caption;
  }

  exportJSON(): SerializedEmbedBlockNode {
    return { ...super.exportJSON(), type: 'embed-block', version: 1, url: this.__url, height: this.__height, caption: this.__caption };
  }

  createDOM(): HTMLElement {
    const el = document.createElement('div');
    el.className = 'aurora-editor__embed-block';
    return el;
  }

  updateDOM(): boolean { return false; }
  isInline(): boolean { return false; }
  decorate(): React.ReactElement { return <EmbedBlockComponent nodeKey={this.__key} />; }
}

export function $createEmbedBlockNode(url = '', height = 400, caption = ''): EmbedBlockNode {
  return new EmbedBlockNode(url, height, caption);
}

export function $isEmbedBlockNode(node: LexicalNode | null | undefined): node is EmbedBlockNode {
  return node instanceof EmbedBlockNode;
}
