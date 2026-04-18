import { useCallback } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $createParagraphNode,
  $getSelection,
  $isRangeSelection,
  FORMAT_TEXT_COMMAND,
  UNDO_COMMAND,
  REDO_COMMAND,
  type RangeSelection,
} from 'lexical';
import { $setBlocksType } from '@lexical/selection';
import { $createHeadingNode, $createQuoteNode } from '@lexical/rich-text';
import { $createListNode } from '@lexical/list';
import { $createCodeNode } from '@lexical/code';
import { $createDividerNode } from './nodes/DividerNode';

interface ToolbarProps {
  onPreview?: () => void;
  previewOpen?: boolean;
}

export function Toolbar({ onPreview, previewOpen }: ToolbarProps) {
  const [editor] = useLexicalComposerContext();

  const withRangeSelection = useCallback(
    (fn: (sel: RangeSelection) => void) => {
      editor.update(() => {
        const sel = $getSelection();
        if ($isRangeSelection(sel)) fn(sel);
      });
    },
    [editor],
  );

  return (
    <div className="aurora-editor__toolbar" role="toolbar" aria-label="Editor toolbar">
      <button
        className="aurora-editor__toolbar-btn"
        onMouseDown={(e) => { e.preventDefault(); editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold'); }}
        title="Bold (Ctrl+B)"
      >
        <strong>B</strong>
      </button>
      <button
        className="aurora-editor__toolbar-btn"
        onMouseDown={(e) => { e.preventDefault(); editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic'); }}
        title="Italic (Ctrl+I)"
      >
        <em>I</em>
      </button>
      <span className="aurora-editor__toolbar-sep" />
      <button className="aurora-editor__toolbar-btn" onMouseDown={(e) => { e.preventDefault(); withRangeSelection((sel) => $setBlocksType(sel, $createParagraphNode)); }} title="Paragraph">P</button>
      <button className="aurora-editor__toolbar-btn" onMouseDown={(e) => { e.preventDefault(); withRangeSelection((sel) => $setBlocksType(sel, () => $createHeadingNode('h1'))); }} title="Heading 1">H1</button>
      <button className="aurora-editor__toolbar-btn" onMouseDown={(e) => { e.preventDefault(); withRangeSelection((sel) => $setBlocksType(sel, () => $createHeadingNode('h2'))); }} title="Heading 2">H2</button>
      <button className="aurora-editor__toolbar-btn" onMouseDown={(e) => { e.preventDefault(); withRangeSelection((sel) => $setBlocksType(sel, () => $createHeadingNode('h3'))); }} title="Heading 3">H3</button>
      <span className="aurora-editor__toolbar-sep" />
      <button className="aurora-editor__toolbar-btn" onMouseDown={(e) => { e.preventDefault(); withRangeSelection((sel) => $setBlocksType(sel, $createQuoteNode)); }} title="Quote">❝</button>
      <button className="aurora-editor__toolbar-btn" onMouseDown={(e) => { e.preventDefault(); withRangeSelection((sel) => $setBlocksType(sel, () => $createListNode('bullet'))); }} title="Bullet list">•–</button>
      <button className="aurora-editor__toolbar-btn" onMouseDown={(e) => { e.preventDefault(); withRangeSelection((sel) => $setBlocksType(sel, () => $createListNode('number'))); }} title="Numbered list">1.</button>
      <button className="aurora-editor__toolbar-btn" onMouseDown={(e) => { e.preventDefault(); withRangeSelection((sel) => $setBlocksType(sel, $createCodeNode)); }} title="Code block">{'</>'}</button>
      <button className="aurora-editor__toolbar-btn" onMouseDown={(e) => { e.preventDefault(); withRangeSelection((sel) => { const d = $createDividerNode(); sel.insertNodes([d]); }); }} title="Divider">—</button>
      <span className="aurora-editor__toolbar-sep" />
      <button className="aurora-editor__toolbar-btn" onMouseDown={(e) => { e.preventDefault(); editor.dispatchCommand(UNDO_COMMAND, undefined); }} title="Undo (Ctrl+Z)">↩</button>
      <button className="aurora-editor__toolbar-btn" onMouseDown={(e) => { e.preventDefault(); editor.dispatchCommand(REDO_COMMAND, undefined); }} title="Redo (Ctrl+Shift+Z)">↪</button>
      {onPreview && (
        <>
          <span className="aurora-editor__toolbar-sep" />
          <button
            className={`aurora-editor__toolbar-btn${previewOpen ? ' active' : ''}`}
            onMouseDown={(e) => { e.preventDefault(); onPreview(); }}
            title="Preview"
          >
            Preview
          </button>
        </>
      )}
    </div>
  );
}
