import React, { useState } from 'react';
import { DecoratorNode, type LexicalNode, type NodeKey, type SerializedLexicalNode } from 'lexical';
import { useLexicalNodeSelection } from '@lexical/react/useLexicalNodeSelection';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';

// ─── Shared settings panel ────────────────────────────────────────────────────

function SettingsPanel({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
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
        minWidth: 260,
        maxHeight: 360,
        overflowY: 'auto',
        boxShadow: '0 2px 8px rgba(0,0,0,.15)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <strong style={{ fontSize: 12, color: '#555' }}>Block settings</strong>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }}>
          ×
        </button>
      </div>
      {children}
    </div>
  );
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, marginBottom: 6 };
const inputStyle: React.CSSProperties = { display: 'block', width: '100%', fontSize: 12, marginTop: 2, padding: '2px 4px' };
const textareaStyle: React.CSSProperties = { ...inputStyle, height: 60, resize: 'vertical' };

// ─── ColumnsBlockNode ─────────────────────────────────────────────────────────

export type ColumnCount = 2 | 3;

export interface SerializedColumnsBlockNode extends SerializedLexicalNode {
  columns: ColumnCount;
  content: string[];
}

function ColumnsBlockComponent({ nodeKey }: { nodeKey: NodeKey }) {
  const [editor] = useLexicalComposerContext();
  const [isSelected] = useLexicalNodeSelection(nodeKey);
  const [showSettings, setShowSettings] = useState(false);

  const getNode = () =>
    editor.getEditorState().read(() => {
      const node = editor.getEditorState()._nodeMap.get(nodeKey);
      return node instanceof ColumnsBlockNode ? node : null;
    });

  const node = getNode();
  const columns = node?.__columns ?? 2;
  const content = node?.__content ?? Array<string>(columns).fill('');

  const update = (patch: Partial<{ columns: ColumnCount; content: string[] }>) => {
    editor.update(() => {
      const n = editor.getEditorState()._nodeMap.get(nodeKey);
      if (!(n instanceof ColumnsBlockNode)) return;
      const w = n.getWritable();
      if (patch.columns !== undefined) {
        w.__columns = patch.columns;
        w.__content = Array<string>(patch.columns).fill('');
      }
      if (patch.content !== undefined) w.__content = patch.content;
    });
  };

  const colWidth = `${Math.floor(100 / columns)}%`;

  return (
    <div style={{ position: 'relative', outline: isSelected ? '2px solid #4f8ef7' : 'none' }}>
      <div
        style={{ display: 'flex', gap: 8, cursor: 'pointer' }}
        onClick={() => setShowSettings((v) => !v)}
      >
        {Array.from({ length: columns }, (_, i) => (
          <div
            key={i}
            style={{
              width: colWidth,
              minHeight: 60,
              background: '#f9f9f9',
              border: '1px dashed #ccc',
              borderRadius: 3,
              padding: 8,
              fontSize: 12,
              color: '#666',
              whiteSpace: 'pre-wrap',
            }}
          >
            {content[i] || `Column ${i + 1}`}
          </div>
        ))}
      </div>

      {showSettings && (
        <SettingsPanel onClose={() => setShowSettings(false)}>
          <label style={labelStyle}>
            Column count
            <select
              style={inputStyle}
              defaultValue={columns}
              onChange={(e) => update({ columns: parseInt(e.currentTarget.value) as ColumnCount })}
            >
              <option value={2}>2 columns</option>
              <option value={3}>3 columns</option>
            </select>
          </label>
          {Array.from({ length: columns }, (_, i) => (
            <label key={i} style={labelStyle}>
              Column {i + 1} content
              <textarea
                style={textareaStyle}
                defaultValue={content[i]}
                onBlur={(e) => {
                  const updated = [...content];
                  updated[i] = e.currentTarget.value;
                  update({ content: updated });
                }}
              />
            </label>
          ))}
        </SettingsPanel>
      )}
    </div>
  );
}

export class ColumnsBlockNode extends DecoratorNode<React.ReactElement> {
  __columns: ColumnCount;
  __content: string[];

  static getType(): string { return 'columns-block'; }

  static clone(node: ColumnsBlockNode): ColumnsBlockNode {
    return new ColumnsBlockNode(node.__columns, [...node.__content], node.__key);
  }

  static importJSON(json: SerializedColumnsBlockNode): ColumnsBlockNode {
    return new ColumnsBlockNode(json.columns, json.content);
  }

  constructor(columns: ColumnCount = 2, content: string[] = ['', ''], key?: NodeKey) {
    super(key);
    this.__columns = columns;
    this.__content = content;
  }

  exportJSON(): SerializedColumnsBlockNode {
    return { ...super.exportJSON(), type: 'columns-block', version: 1, columns: this.__columns, content: this.__content };
  }

  createDOM(): HTMLElement {
    const el = document.createElement('div');
    el.className = 'aurora-editor__columns-block';
    return el;
  }

  updateDOM(): boolean { return false; }
  isInline(): boolean { return false; }
  decorate(): React.ReactElement { return <ColumnsBlockComponent nodeKey={this.__key} />; }
}

export function $createColumnsBlockNode(columns: ColumnCount = 2): ColumnsBlockNode {
  return new ColumnsBlockNode(columns, Array<string>(columns).fill(''));
}

export function $isColumnsBlockNode(node: LexicalNode | null | undefined): node is ColumnsBlockNode {
  return node instanceof ColumnsBlockNode;
}

// ─── SectionBlockNode ─────────────────────────────────────────────────────────

export interface SerializedSectionBlockNode extends SerializedLexicalNode {
  title: string;
  content: string;
}

function SectionBlockComponent({ nodeKey }: { nodeKey: NodeKey }) {
  const [editor] = useLexicalComposerContext();
  const [isSelected] = useLexicalNodeSelection(nodeKey);
  const [showSettings, setShowSettings] = useState(false);

  const getNode = () =>
    editor.getEditorState().read(() => {
      const n = editor.getEditorState()._nodeMap.get(nodeKey);
      return n instanceof SectionBlockNode ? n : null;
    });

  const node = getNode();
  const title = node?.__title ?? '';
  const content = node?.__content ?? '';

  const updateField = (field: 'title' | 'content', value: string) => {
    editor.update(() => {
      const n = editor.getEditorState()._nodeMap.get(nodeKey);
      if (!(n instanceof SectionBlockNode)) return;
      const w = n.getWritable();
      if (field === 'title') w.__title = value;
      else w.__content = value;
    });
  };

  return (
    <div
      style={{ position: 'relative', outline: isSelected ? '2px solid #4f8ef7' : 'none', cursor: 'pointer' }}
      onClick={() => setShowSettings((v) => !v)}
    >
      <section
        style={{
          border: '1px solid #e0e0e0',
          borderRadius: 4,
          padding: '12px 16px',
          background: '#fafafa',
        }}
      >
        <h4 style={{ margin: '0 0 8px', fontSize: 14, color: '#333' }}>{title || 'Section title'}</h4>
        <p style={{ margin: 0, fontSize: 13, color: '#555', whiteSpace: 'pre-wrap' }}>{content || 'Section content…'}</p>
      </section>

      {showSettings && (
        <SettingsPanel onClose={() => setShowSettings(false)}>
          <label style={labelStyle}>
            Title
            <input style={inputStyle} defaultValue={title} onBlur={(e) => updateField('title', e.currentTarget.value)} />
          </label>
          <label style={labelStyle}>
            Content
            <textarea style={textareaStyle} defaultValue={content} onBlur={(e) => updateField('content', e.currentTarget.value)} />
          </label>
        </SettingsPanel>
      )}
    </div>
  );
}

export class SectionBlockNode extends DecoratorNode<React.ReactElement> {
  __title: string;
  __content: string;

  static getType(): string { return 'section-block'; }

  static clone(node: SectionBlockNode): SectionBlockNode {
    return new SectionBlockNode(node.__title, node.__content, node.__key);
  }

  static importJSON(json: SerializedSectionBlockNode): SectionBlockNode {
    return new SectionBlockNode(json.title, json.content);
  }

  constructor(title = '', content = '', key?: NodeKey) {
    super(key);
    this.__title = title;
    this.__content = content;
  }

  exportJSON(): SerializedSectionBlockNode {
    return { ...super.exportJSON(), type: 'section-block', version: 1, title: this.__title, content: this.__content };
  }

  createDOM(): HTMLElement {
    const el = document.createElement('div');
    el.className = 'aurora-editor__section-block';
    return el;
  }

  updateDOM(): boolean { return false; }
  isInline(): boolean { return false; }
  decorate(): React.ReactElement { return <SectionBlockComponent nodeKey={this.__key} />; }
}

export function $createSectionBlockNode(title = '', content = ''): SectionBlockNode {
  return new SectionBlockNode(title, content);
}

export function $isSectionBlockNode(node: LexicalNode | null | undefined): node is SectionBlockNode {
  return node instanceof SectionBlockNode;
}

// ─── TabsBlockNode ────────────────────────────────────────────────────────────

export interface TabItem { label: string; content: string; }

export interface SerializedTabsBlockNode extends SerializedLexicalNode {
  tabs: TabItem[];
}

function TabsBlockComponent({ nodeKey }: { nodeKey: NodeKey }) {
  const [editor] = useLexicalComposerContext();
  const [isSelected] = useLexicalNodeSelection(nodeKey);
  const [showSettings, setShowSettings] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  const getNode = () =>
    editor.getEditorState().read(() => {
      const n = editor.getEditorState()._nodeMap.get(nodeKey);
      return n instanceof TabsBlockNode ? n : null;
    });

  const node = getNode();
  const tabs: TabItem[] = node?.__tabs ?? [{ label: 'Tab 1', content: '' }];

  const updateTabs = (updated: TabItem[]) => {
    editor.update(() => {
      const n = editor.getEditorState()._nodeMap.get(nodeKey);
      if (!(n instanceof TabsBlockNode)) return;
      n.getWritable().__tabs = updated;
    });
  };

  const addTab = () => updateTabs([...tabs, { label: `Tab ${tabs.length + 1}`, content: '' }]);

  const removeTab = (i: number) => {
    const next = tabs.filter((_, idx) => idx !== i);
    updateTabs(next.length ? next : [{ label: 'Tab 1', content: '' }]);
    setActiveTab(0);
  };

  return (
    <div
      style={{ position: 'relative', outline: isSelected ? '2px solid #4f8ef7' : 'none', cursor: 'pointer' }}
      onClick={() => setShowSettings((v) => !v)}
    >
      <div style={{ borderBottom: '1px solid #ddd', display: 'flex', gap: 0 }}>
        {tabs.map((tab, i) => (
          <button
            key={i}
            onClick={(e) => { e.stopPropagation(); setActiveTab(i); }}
            style={{
              padding: '4px 12px',
              fontSize: 12,
              border: 'none',
              borderBottom: i === activeTab ? '2px solid #4f8ef7' : '2px solid transparent',
              background: 'none',
              cursor: 'pointer',
              fontWeight: i === activeTab ? 600 : 400,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div style={{ padding: '8px 12px', minHeight: 40, fontSize: 12, color: '#555', whiteSpace: 'pre-wrap' }}>
        {tabs[activeTab]?.content || 'Tab content…'}
      </div>

      {showSettings && (
        <SettingsPanel onClose={() => setShowSettings(false)}>
          {tabs.map((tab, i) => (
            <div key={i} style={{ marginBottom: 10, borderBottom: '1px solid #eee', paddingBottom: 8 }}>
              <label style={labelStyle}>
                Tab {i + 1} label
                <input
                  style={inputStyle}
                  defaultValue={tab.label}
                  onBlur={(e) => {
                    const updated = [...tabs];
                    updated[i] = { ...updated[i]!, label: e.currentTarget.value };
                    updateTabs(updated);
                  }}
                />
              </label>
              <label style={labelStyle}>
                Content
                <textarea
                  style={textareaStyle}
                  defaultValue={tab.content}
                  onBlur={(e) => {
                    const updated = [...tabs];
                    updated[i] = { ...updated[i]!, content: e.currentTarget.value };
                    updateTabs(updated);
                  }}
                />
              </label>
              <button onClick={() => removeTab(i)} style={{ fontSize: 11, color: '#c00', background: 'none', border: 'none', cursor: 'pointer' }}>
                Remove tab
              </button>
            </div>
          ))}
          <button onClick={addTab} style={{ fontSize: 12, color: '#4f8ef7', background: 'none', border: 'none', cursor: 'pointer' }}>
            + Add tab
          </button>
        </SettingsPanel>
      )}
    </div>
  );
}

export class TabsBlockNode extends DecoratorNode<React.ReactElement> {
  __tabs: TabItem[];

  static getType(): string { return 'tabs-block'; }

  static clone(node: TabsBlockNode): TabsBlockNode {
    return new TabsBlockNode([...node.__tabs], node.__key);
  }

  static importJSON(json: SerializedTabsBlockNode): TabsBlockNode {
    return new TabsBlockNode(json.tabs);
  }

  constructor(tabs: TabItem[] = [{ label: 'Tab 1', content: '' }], key?: NodeKey) {
    super(key);
    this.__tabs = tabs;
  }

  exportJSON(): SerializedTabsBlockNode {
    return { ...super.exportJSON(), type: 'tabs-block', version: 1, tabs: this.__tabs };
  }

  createDOM(): HTMLElement {
    const el = document.createElement('div');
    el.className = 'aurora-editor__tabs-block';
    return el;
  }

  updateDOM(): boolean { return false; }
  isInline(): boolean { return false; }
  decorate(): React.ReactElement { return <TabsBlockComponent nodeKey={this.__key} />; }
}

export function $createTabsBlockNode(tabs?: TabItem[]): TabsBlockNode {
  return new TabsBlockNode(tabs);
}

export function $isTabsBlockNode(node: LexicalNode | null | undefined): node is TabsBlockNode {
  return node instanceof TabsBlockNode;
}

// ─── AccordionBlockNode ───────────────────────────────────────────────────────

export interface AccordionItem { title: string; content: string; }

export interface SerializedAccordionBlockNode extends SerializedLexicalNode {
  items: AccordionItem[];
}

function AccordionBlockComponent({ nodeKey }: { nodeKey: NodeKey }) {
  const [editor] = useLexicalComposerContext();
  const [isSelected] = useLexicalNodeSelection(nodeKey);
  const [showSettings, setShowSettings] = useState(false);
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  const getNode = () =>
    editor.getEditorState().read(() => {
      const n = editor.getEditorState()._nodeMap.get(nodeKey);
      return n instanceof AccordionBlockNode ? n : null;
    });

  const node = getNode();
  const items: AccordionItem[] = node?.__items ?? [{ title: 'Item 1', content: '' }];

  const updateItems = (updated: AccordionItem[]) => {
    editor.update(() => {
      const n = editor.getEditorState()._nodeMap.get(nodeKey);
      if (!(n instanceof AccordionBlockNode)) return;
      n.getWritable().__items = updated;
    });
  };

  const addItem = () => updateItems([...items, { title: `Item ${items.length + 1}`, content: '' }]);

  const removeItem = (i: number) => {
    const next = items.filter((_, idx) => idx !== i);
    updateItems(next.length ? next : [{ title: 'Item 1', content: '' }]);
    setOpenIdx(null);
  };

  return (
    <div
      style={{ position: 'relative', outline: isSelected ? '2px solid #4f8ef7' : 'none', cursor: 'pointer' }}
      onClick={() => setShowSettings((v) => !v)}
    >
      {items.map((item, i) => (
        <div key={i} style={{ borderBottom: '1px solid #e0e0e0' }}>
          <button
            onClick={(e) => { e.stopPropagation(); setOpenIdx(openIdx === i ? null : i); }}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              width: '100%',
              padding: '8px 12px',
              fontSize: 13,
              fontWeight: 500,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            {item.title || `Item ${i + 1}`}
            <span>{openIdx === i ? '▲' : '▼'}</span>
          </button>
          {openIdx === i && (
            <div style={{ padding: '4px 12px 12px', fontSize: 12, color: '#555', whiteSpace: 'pre-wrap' }}>
              {item.content || 'Content…'}
            </div>
          )}
        </div>
      ))}

      {showSettings && (
        <SettingsPanel onClose={() => setShowSettings(false)}>
          {items.map((item, i) => (
            <div key={i} style={{ marginBottom: 10, borderBottom: '1px solid #eee', paddingBottom: 8 }}>
              <label style={labelStyle}>
                Item {i + 1} title
                <input
                  style={inputStyle}
                  defaultValue={item.title}
                  onBlur={(e) => {
                    const updated = [...items];
                    updated[i] = { ...updated[i]!, title: e.currentTarget.value };
                    updateItems(updated);
                  }}
                />
              </label>
              <label style={labelStyle}>
                Content
                <textarea
                  style={textareaStyle}
                  defaultValue={item.content}
                  onBlur={(e) => {
                    const updated = [...items];
                    updated[i] = { ...updated[i]!, content: e.currentTarget.value };
                    updateItems(updated);
                  }}
                />
              </label>
              <button onClick={() => removeItem(i)} style={{ fontSize: 11, color: '#c00', background: 'none', border: 'none', cursor: 'pointer' }}>
                Remove item
              </button>
            </div>
          ))}
          <button onClick={addItem} style={{ fontSize: 12, color: '#4f8ef7', background: 'none', border: 'none', cursor: 'pointer' }}>
            + Add item
          </button>
        </SettingsPanel>
      )}
    </div>
  );
}

export class AccordionBlockNode extends DecoratorNode<React.ReactElement> {
  __items: AccordionItem[];

  static getType(): string { return 'accordion-block'; }

  static clone(node: AccordionBlockNode): AccordionBlockNode {
    return new AccordionBlockNode([...node.__items], node.__key);
  }

  static importJSON(json: SerializedAccordionBlockNode): AccordionBlockNode {
    return new AccordionBlockNode(json.items);
  }

  constructor(items: AccordionItem[] = [{ title: 'Item 1', content: '' }], key?: NodeKey) {
    super(key);
    this.__items = items;
  }

  exportJSON(): SerializedAccordionBlockNode {
    return { ...super.exportJSON(), type: 'accordion-block', version: 1, items: this.__items };
  }

  createDOM(): HTMLElement {
    const el = document.createElement('div');
    el.className = 'aurora-editor__accordion-block';
    return el;
  }

  updateDOM(): boolean { return false; }
  isInline(): boolean { return false; }
  decorate(): React.ReactElement { return <AccordionBlockComponent nodeKey={this.__key} />; }
}

export function $createAccordionBlockNode(items?: AccordionItem[]): AccordionBlockNode {
  return new AccordionBlockNode(items);
}

export function $isAccordionBlockNode(node: LexicalNode | null | undefined): node is AccordionBlockNode {
  return node instanceof AccordionBlockNode;
}
