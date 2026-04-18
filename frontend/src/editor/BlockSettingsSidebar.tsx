import { useEffect, useState } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getNodeByKey, $getRoot, $getSelection, $isNodeSelection } from 'lexical';

interface BlockInfo {
  key: string;
  type: string;
  index: number;
  total: number;
}

interface BlockSettingsSidebarProps {
  pageId?: string;
  onPreviewClose?: () => void;
  showPreview?: boolean;
}

export function BlockSettingsSidebar({ pageId, showPreview, onPreviewClose }: BlockSettingsSidebarProps) {
  const [editor] = useLexicalComposerContext();
  const [selectedBlock, setSelectedBlock] = useState<BlockInfo | null>(null);

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const selection = $getSelection();
        if ($isNodeSelection(selection)) {
          const nodes = selection.getNodes();
          if (nodes.length === 1) {
            const node = nodes[0];
            const root = $getRoot();
            const children = root.getChildren();
            const index = children.findIndex((c) => c.getKey() === node.getKey());
            setSelectedBlock({
              key: node.getKey(),
              type: node.getType(),
              index,
              total: children.length,
            });
            return;
          }
        }
        setSelectedBlock(null);
      });
    });
  }, [editor]);

  const moveBlock = (direction: 'up' | 'down') => {
    if (!selectedBlock) return;
    editor.update(() => {
      const node = $getNodeByKey(selectedBlock.key);
      if (!node) return;
      if (direction === 'up') {
        const prev = node.getPreviousSibling();
        if (prev) prev.insertBefore(node);
      } else {
        const next = node.getNextSibling();
        if (next) next.insertAfter(node);
      }
    });
  };

  const deleteBlock = () => {
    if (!selectedBlock) return;
    editor.update(() => {
      $getNodeByKey(selectedBlock.key)?.remove();
    });
    setSelectedBlock(null);
  };

  const isOpen = selectedBlock !== null || showPreview;

  return (
    <aside
      className={`aurora-editor__sidebar${isOpen ? ' aurora-editor__sidebar--open' : ''}`}
      aria-label="Block settings"
    >
      {showPreview && pageId ? (
        <div className="aurora-editor__sidebar-preview">
          <div className="aurora-editor__sidebar-header">
            <span>Preview</span>
            <button onClick={onPreviewClose} className="aurora-editor__sidebar-close" title="Close preview">✕</button>
          </div>
          <iframe
            src={`/api/v1/pages/${pageId}/preview`}
            title="Page preview"
            className="aurora-editor__preview-frame"
            sandbox="allow-same-origin allow-scripts"
          />
        </div>
      ) : selectedBlock ? (
        <div className="aurora-editor__sidebar-block">
          <div className="aurora-editor__sidebar-header">
            <span>Block settings</span>
          </div>
          <dl className="aurora-editor__sidebar-meta">
            <dt>Type</dt>
            <dd>{selectedBlock.type}</dd>
            <dt>Position</dt>
            <dd>{selectedBlock.index + 1} / {selectedBlock.total}</dd>
          </dl>
          <div className="aurora-editor__sidebar-actions">
            <button onClick={() => moveBlock('up')} disabled={selectedBlock.index === 0} title="Move block up">↑ Move up</button>
            <button onClick={() => moveBlock('down')} disabled={selectedBlock.index === selectedBlock.total - 1} title="Move block down">↓ Move down</button>
            <button onClick={deleteBlock} className="aurora-editor__sidebar-delete" title="Delete block">Delete block</button>
          </div>
        </div>
      ) : null}
    </aside>
  );
}
