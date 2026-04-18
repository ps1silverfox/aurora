import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $getSelection,
  $isRangeSelection,
  FORMAT_TEXT_COMMAND,
  SELECTION_CHANGE_COMMAND,
  COMMAND_PRIORITY_LOW,
} from 'lexical';
import { TOGGLE_LINK_COMMAND } from '@lexical/link';

interface ToolbarPosition {
  top: number;
  left: number;
}

export function InlineToolbarPlugin() {
  const [editor] = useLexicalComposerContext();
  const [pos, setPos] = useState<ToolbarPosition | null>(null);
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isCode, setIsCode] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);

  const updateToolbar = useCallback(() => {
    editor.getEditorState().read(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection) || selection.isCollapsed()) {
        setPos(null);
        return;
      }

      setIsBold(selection.hasFormat('bold'));
      setIsItalic(selection.hasFormat('italic'));
      setIsCode(selection.hasFormat('code'));

      const nativeSelection = window.getSelection();
      if (!nativeSelection || nativeSelection.rangeCount === 0) {
        setPos(null);
        return;
      }

      const range = nativeSelection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      setPos({
        top: rect.top + window.scrollY - 44,
        left: rect.left + window.scrollX + rect.width / 2,
      });
    });
  }, [editor]);

  useEffect(() => {
    return editor.registerCommand(SELECTION_CHANGE_COMMAND, () => {
      updateToolbar();
      return false;
    }, COMMAND_PRIORITY_LOW);
  }, [editor, updateToolbar]);

  // Hide toolbar on click outside
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setPos(null);
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, []);

  const handleLink = useCallback(() => {
    const url = window.prompt('Enter URL:');
    if (url) {
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, url);
    } else if (url === '') {
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
    }
  }, [editor]);

  if (!pos) return null;

  const toolbar = (
    <div
      ref={toolbarRef}
      className="aurora-editor__inline-toolbar"
      style={{ top: pos.top, left: pos.left, transform: 'translateX(-50%)' }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <button
        className={`aurora-editor__inline-btn${isBold ? ' active' : ''}`}
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold')}
        title="Bold (Ctrl+B)"
      >
        <strong>B</strong>
      </button>
      <button
        className={`aurora-editor__inline-btn${isItalic ? ' active' : ''}`}
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic')}
        title="Italic (Ctrl+I)"
      >
        <em>I</em>
      </button>
      <button
        className={`aurora-editor__inline-btn${isCode ? ' active' : ''}`}
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'code')}
        title="Inline code"
      >
        {'<>'}
      </button>
      <button
        className="aurora-editor__inline-btn"
        onClick={handleLink}
        title="Link"
      >
        🔗
      </button>
    </div>
  );

  return createPortal(toolbar, document.body);
}
