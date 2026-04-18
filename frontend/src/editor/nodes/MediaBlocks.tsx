import React, { useCallback, useRef, useState } from 'react';
import { DecoratorNode, type LexicalNode, type NodeKey, type SerializedLexicalNode } from 'lexical';
import { useLexicalNodeSelection } from '@lexical/react/useLexicalNodeSelection';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';

// ─── Shared settings panel ────────────────────────────────────────────────────

interface SettingsPanelProps {
  onClose: () => void;
  children: React.ReactNode;
}

function SettingsPanel({ onClose, children }: SettingsPanelProps) {
  return (
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
        <strong style={{ fontSize: 12, color: '#555' }}>Block settings</strong>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }}
        >
          ×
        </button>
      </div>
      {children}
    </div>
  );
}

// ─── ImageBlockNode ───────────────────────────────────────────────────────────

export type ImageAlignment = 'left' | 'center' | 'right';

export interface SerializedImageBlockNode extends SerializedLexicalNode {
  src: string;
  alt: string;
  alignment: ImageAlignment;
}

function ImageBlockComponent({ nodeKey }: { nodeKey: NodeKey }) {
  const [editor] = useLexicalComposerContext();
  const [isSelected] = useLexicalNodeSelection(nodeKey);
  const [showSettings, setShowSettings] = useState(false);

  const getNode = useCallback(
    () =>
      editor.getEditorState().read(() => {
        const node = editor.getEditorState()._nodeMap.get(nodeKey);
        return node instanceof ImageBlockNode ? node : null;
      }),
    [editor, nodeKey],
  );

  const node = getNode();
  const src = node?.__src ?? '';
  const alt = node?.__alt ?? '';
  const alignment = node?.__alignment ?? 'center';

  const updateField = useCallback(
    (field: 'src' | 'alt' | 'alignment', value: string) => {
      editor.update(() => {
        const n = editor.getEditorState()._nodeMap.get(nodeKey);
        if (!(n instanceof ImageBlockNode)) return;
        const writable = n.getWritable();
        if (field === 'src') writable.__src = value;
        else if (field === 'alt') writable.__alt = value;
        else writable.__alignment = value as ImageAlignment;
      });
    },
    [editor, nodeKey],
  );

  const alignStyle: React.CSSProperties =
    alignment === 'center'
      ? { display: 'block', margin: '0 auto' }
      : alignment === 'right'
        ? { display: 'block', marginLeft: 'auto' }
        : { display: 'block' };

  return (
    <div
      style={{ position: 'relative', outline: isSelected ? '2px solid #4f8ef7' : 'none', cursor: 'pointer' }}
      onClick={() => setShowSettings((v) => !v)}
    >
      {src ? (
        <img
          src={src}
          alt={alt}
          style={{ ...alignStyle, maxWidth: '100%', borderRadius: 2 }}
        />
      ) : (
        <div
          style={{
            background: '#f4f4f4',
            border: '2px dashed #ccc',
            borderRadius: 4,
            padding: '24px',
            textAlign: 'center',
            color: '#888',
            fontSize: 13,
          }}
        >
          Click to add image URL
        </div>
      )}

      {showSettings && (
        <SettingsPanel onClose={() => setShowSettings(false)}>
          <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>
            Image URL
            <input
              style={{ display: 'block', width: '100%', fontSize: 12, marginTop: 2, padding: '2px 4px' }}
              defaultValue={src}
              onBlur={(e) => updateField('src', e.currentTarget.value)}
            />
          </label>
          <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>
            Alt text
            <input
              style={{ display: 'block', width: '100%', fontSize: 12, marginTop: 2, padding: '2px 4px' }}
              defaultValue={alt}
              onBlur={(e) => updateField('alt', e.currentTarget.value)}
            />
          </label>
          <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>
            Alignment
            <select
              style={{ display: 'block', width: '100%', fontSize: 12, marginTop: 2 }}
              defaultValue={alignment}
              onChange={(e) => updateField('alignment', e.currentTarget.value)}
            >
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </label>
        </SettingsPanel>
      )}
    </div>
  );
}

export class ImageBlockNode extends DecoratorNode<React.ReactElement> {
  __src: string;
  __alt: string;
  __alignment: ImageAlignment;

  static getType(): string {
    return 'image-block';
  }

  static clone(node: ImageBlockNode): ImageBlockNode {
    return new ImageBlockNode(node.__src, node.__alt, node.__alignment, node.__key);
  }

  static importJSON(json: SerializedImageBlockNode): ImageBlockNode {
    return new ImageBlockNode(json.src, json.alt, json.alignment);
  }

  constructor(src = '', alt = '', alignment: ImageAlignment = 'center', key?: NodeKey) {
    super(key);
    this.__src = src;
    this.__alt = alt;
    this.__alignment = alignment;
  }

  exportJSON(): SerializedImageBlockNode {
    return {
      ...super.exportJSON(),
      type: 'image-block',
      version: 1,
      src: this.__src,
      alt: this.__alt,
      alignment: this.__alignment,
    };
  }

  createDOM(): HTMLElement {
    const el = document.createElement('div');
    el.className = 'aurora-editor__image-block';
    return el;
  }

  updateDOM(): boolean {
    return false;
  }

  isInline(): boolean {
    return false;
  }

  decorate(): React.ReactElement {
    return <ImageBlockComponent nodeKey={this.__key} />;
  }
}

export function $createImageBlockNode(src = '', alt = '', alignment: ImageAlignment = 'center'): ImageBlockNode {
  return new ImageBlockNode(src, alt, alignment);
}

export function $isImageBlockNode(node: LexicalNode | null | undefined): node is ImageBlockNode {
  return node instanceof ImageBlockNode;
}

// ─── VideoBlockNode ───────────────────────────────────────────────────────────

export interface SerializedVideoBlockNode extends SerializedLexicalNode {
  src: string;
  poster: string;
}

function VideoBlockComponent({ nodeKey }: { nodeKey: NodeKey }) {
  const [editor] = useLexicalComposerContext();
  const [isSelected] = useLexicalNodeSelection(nodeKey);
  const [showSettings, setShowSettings] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const getNode = useCallback(
    () =>
      editor.getEditorState().read(() => {
        const node = editor.getEditorState()._nodeMap.get(nodeKey);
        return node instanceof VideoBlockNode ? node : null;
      }),
    [editor, nodeKey],
  );

  const node = getNode();
  const src = node?.__src ?? '';
  const poster = node?.__poster ?? '';

  const updateField = useCallback(
    (field: 'src' | 'poster', value: string) => {
      editor.update(() => {
        const n = editor.getEditorState()._nodeMap.get(nodeKey);
        if (!(n instanceof VideoBlockNode)) return;
        const writable = n.getWritable();
        if (field === 'src') writable.__src = value;
        else writable.__poster = value;
      });
    },
    [editor, nodeKey],
  );

  return (
    <div
      style={{ position: 'relative', outline: isSelected ? '2px solid #4f8ef7' : 'none', cursor: 'pointer' }}
      onClick={() => setShowSettings((v) => !v)}
    >
      {src ? (
        <video
          ref={videoRef}
          src={src}
          poster={poster || undefined}
          controls
          style={{ display: 'block', maxWidth: '100%', borderRadius: 2 }}
        />
      ) : (
        <div
          style={{
            background: '#f4f4f4',
            border: '2px dashed #ccc',
            borderRadius: 4,
            padding: '24px',
            textAlign: 'center',
            color: '#888',
            fontSize: 13,
          }}
        >
          Click to add video URL
        </div>
      )}

      {showSettings && (
        <SettingsPanel onClose={() => setShowSettings(false)}>
          <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>
            Video URL
            <input
              style={{ display: 'block', width: '100%', fontSize: 12, marginTop: 2, padding: '2px 4px' }}
              defaultValue={src}
              onBlur={(e) => updateField('src', e.currentTarget.value)}
            />
          </label>
          <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>
            Poster image URL (optional)
            <input
              style={{ display: 'block', width: '100%', fontSize: 12, marginTop: 2, padding: '2px 4px' }}
              defaultValue={poster}
              onBlur={(e) => updateField('poster', e.currentTarget.value)}
            />
          </label>
        </SettingsPanel>
      )}
    </div>
  );
}

export class VideoBlockNode extends DecoratorNode<React.ReactElement> {
  __src: string;
  __poster: string;

  static getType(): string {
    return 'video-block';
  }

  static clone(node: VideoBlockNode): VideoBlockNode {
    return new VideoBlockNode(node.__src, node.__poster, node.__key);
  }

  static importJSON(json: SerializedVideoBlockNode): VideoBlockNode {
    return new VideoBlockNode(json.src, json.poster);
  }

  constructor(src = '', poster = '', key?: NodeKey) {
    super(key);
    this.__src = src;
    this.__poster = poster;
  }

  exportJSON(): SerializedVideoBlockNode {
    return {
      ...super.exportJSON(),
      type: 'video-block',
      version: 1,
      src: this.__src,
      poster: this.__poster,
    };
  }

  createDOM(): HTMLElement {
    const el = document.createElement('div');
    el.className = 'aurora-editor__video-block';
    return el;
  }

  updateDOM(): boolean {
    return false;
  }

  isInline(): boolean {
    return false;
  }

  decorate(): React.ReactElement {
    return <VideoBlockComponent nodeKey={this.__key} />;
  }
}

export function $createVideoBlockNode(src = '', poster = ''): VideoBlockNode {
  return new VideoBlockNode(src, poster);
}

export function $isVideoBlockNode(node: LexicalNode | null | undefined): node is VideoBlockNode {
  return node instanceof VideoBlockNode;
}
