import React, { useState } from 'react';
import { DecoratorNode, type LexicalNode, type NodeKey, type SerializedLexicalNode } from 'lexical';
import { useLexicalNodeSelection } from '@lexical/react/useLexicalNodeSelection';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SerializedTableBlockNode extends SerializedLexicalNode {
  rows: number;
  cols: number;
  cells: string[][];
  headerRow: boolean;
  striped: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeEmptyTable(rows: number, cols: number): string[][] {
  return Array.from({ length: rows }, () => Array<string>(cols).fill(''));
}

function resizeTable(cells: string[][], rows: number, cols: number): string[][] {
  const result: string[][] = [];
  for (let r = 0; r < rows; r++) {
    const existing = cells[r] ?? [];
    const row: string[] = [];
    for (let c = 0; c < cols; c++) {
      row.push(existing[c] ?? '');
    }
    result.push(row);
  }
  return result;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, marginBottom: 6 };
const inputStyle: React.CSSProperties = { display: 'block', width: '100%', fontSize: 12, marginTop: 2, padding: '2px 4px' };

function SettingsRow({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>{children}</div>;
}

// ─── Component ───────────────────────────────────────────────────────────────

function TableBlockComponent({ nodeKey }: { nodeKey: NodeKey }) {
  const [editor] = useLexicalComposerContext();
  const [isSelected] = useLexicalNodeSelection(nodeKey);
  const [showSettings, setShowSettings] = useState(false);

  const getNode = () =>
    editor.getEditorState().read(() => {
      const n = editor.getEditorState()._nodeMap.get(nodeKey);
      return n instanceof TableBlockNode ? n : null;
    });

  const node = getNode();
  const rows = node?.__rows ?? 3;
  const cols = node?.__cols ?? 3;
  const cells = node?.__cells ?? makeEmptyTable(rows, cols);
  const headerRow = node?.__headerRow ?? true;
  const striped = node?.__striped ?? false;

  const update = (patch: Partial<{ rows: number; cols: number; cells: string[][]; headerRow: boolean; striped: boolean }>) => {
    editor.update(() => {
      const n = editor.getEditorState()._nodeMap.get(nodeKey);
      if (!(n instanceof TableBlockNode)) return;
      const w = n.getWritable();
      if (patch.rows !== undefined || patch.cols !== undefined) {
        const newRows = patch.rows ?? w.__rows;
        const newCols = patch.cols ?? w.__cols;
        w.__rows = newRows;
        w.__cols = newCols;
        w.__cells = resizeTable(w.__cells, newRows, newCols);
      }
      if (patch.cells !== undefined) w.__cells = patch.cells;
      if (patch.headerRow !== undefined) w.__headerRow = patch.headerRow;
      if (patch.striped !== undefined) w.__striped = patch.striped;
    });
  };

  const addRow = () => update({ rows: rows + 1 });
  const removeRow = () => rows > 1 && update({ rows: rows - 1 });
  const addCol = () => update({ cols: cols + 1 });
  const removeCol = () => cols > 1 && update({ cols: cols - 1 });

  const setCellValue = (r: number, c: number, val: string) => {
    const updated = cells.map((row, ri) => row.map((cell, ci) => (ri === r && ci === c ? val : cell)));
    update({ cells: updated });
  };

  const cellBaseStyle = (r: number): React.CSSProperties => ({
    padding: '4px 6px',
    border: '1px solid #ddd',
    fontSize: 12,
    minWidth: 60,
    background: headerRow && r === 0
      ? '#f0f0f0'
      : striped && r % 2 === 1
        ? '#fafafa'
        : '#fff',
    fontWeight: headerRow && r === 0 ? 600 : 400,
  });

  return (
    <div style={{ position: 'relative', outline: isSelected ? '2px solid #4f8ef7' : 'none' }}>
      <div
        style={{ overflowX: 'auto', cursor: 'pointer' }}
        onClick={() => setShowSettings((v) => !v)}
      >
        <table style={{ borderCollapse: 'collapse', width: '100%', tableLayout: 'fixed' }}>
          <tbody>
            {cells.map((row, r) => (
              <tr key={r}>
                {row.map((cell, c) => (
                  <td key={c} style={cellBaseStyle(r)}>
                    {cell || <span style={{ color: '#bbb' }}>{headerRow && r === 0 ? `H${c + 1}` : `R${r}C${c + 1}`}</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
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
            maxHeight: 420,
            overflowY: 'auto',
            boxShadow: '0 2px 8px rgba(0,0,0,.15)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <strong style={{ fontSize: 12, color: '#555' }}>Table settings</strong>
            <button onClick={() => setShowSettings(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }}>×</button>
          </div>

          <SettingsRow>
            <label style={labelStyle}>
              Rows
              <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
                <button onClick={removeRow} style={{ padding: '2px 8px' }}>−</button>
                <span style={{ fontSize: 12, lineHeight: '24px', minWidth: 20, textAlign: 'center' }}>{rows}</span>
                <button onClick={addRow} style={{ padding: '2px 8px' }}>+</button>
              </div>
            </label>
            <label style={labelStyle}>
              Cols
              <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
                <button onClick={removeCol} style={{ padding: '2px 8px' }}>−</button>
                <span style={{ fontSize: 12, lineHeight: '24px', minWidth: 20, textAlign: 'center' }}>{cols}</span>
                <button onClick={addCol} style={{ padding: '2px 8px' }}>+</button>
              </div>
            </label>
          </SettingsRow>

          <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <input type="checkbox" checked={headerRow} onChange={(e) => update({ headerRow: e.currentTarget.checked })} />
            Header row
          </label>
          <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <input type="checkbox" checked={striped} onChange={(e) => update({ striped: e.currentTarget.checked })} />
            Striped rows
          </label>

          <div style={{ fontSize: 11, color: '#888', marginBottom: 6 }}>Cell content</div>
          {cells.map((row, r) => (
            <div key={r} style={{ marginBottom: 4 }}>
              {row.map((cell, c) => (
                <input
                  key={c}
                  style={{ ...inputStyle, display: 'inline-block', width: `${Math.floor(100 / cols) - 2}%`, marginRight: '2%' }}
                  defaultValue={cell}
                  placeholder={headerRow && r === 0 ? `H${c + 1}` : `R${r}C${c + 1}`}
                  onBlur={(e) => setCellValue(r, c, e.currentTarget.value)}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Node ─────────────────────────────────────────────────────────────────────

export class TableBlockNode extends DecoratorNode<React.ReactElement> {
  __rows: number;
  __cols: number;
  __cells: string[][];
  __headerRow: boolean;
  __striped: boolean;

  static getType(): string { return 'table-block'; }

  static clone(node: TableBlockNode): TableBlockNode {
    return new TableBlockNode(node.__rows, node.__cols, node.__cells.map((r) => [...r]), node.__headerRow, node.__striped, node.__key);
  }

  static importJSON(json: SerializedTableBlockNode): TableBlockNode {
    return new TableBlockNode(json.rows, json.cols, json.cells, json.headerRow, json.striped);
  }

  constructor(rows = 3, cols = 3, cells?: string[][], headerRow = true, striped = false, key?: NodeKey) {
    super(key);
    this.__rows = rows;
    this.__cols = cols;
    this.__cells = cells ?? makeEmptyTable(rows, cols);
    this.__headerRow = headerRow;
    this.__striped = striped;
  }

  exportJSON(): SerializedTableBlockNode {
    return {
      ...super.exportJSON(),
      type: 'table-block',
      version: 1,
      rows: this.__rows,
      cols: this.__cols,
      cells: this.__cells,
      headerRow: this.__headerRow,
      striped: this.__striped,
    };
  }

  createDOM(): HTMLElement {
    const el = document.createElement('div');
    el.className = 'aurora-editor__table-block';
    return el;
  }

  updateDOM(): boolean { return false; }
  isInline(): boolean { return false; }
  decorate(): React.ReactElement { return <TableBlockComponent nodeKey={this.__key} />; }
}

export function $createTableBlockNode(rows = 3, cols = 3): TableBlockNode {
  return new TableBlockNode(rows, cols);
}

export function $isTableBlockNode(node: LexicalNode | null | undefined): node is TableBlockNode {
  return node instanceof TableBlockNode;
}
