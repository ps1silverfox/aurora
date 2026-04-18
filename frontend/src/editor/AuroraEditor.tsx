import React, { useCallback, useEffect, useRef, useState } from 'react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import {
  $getRoot,
  type EditorState,
} from 'lexical';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { ALL_EDITOR_NODES } from './nodes';
import { serializeToBlocks, deserializeFromBlocks, type Block } from './serializer';
import { Toolbar } from './Toolbar';
import { BlockSettingsSidebar } from './BlockSettingsSidebar';
import { KeyboardShortcutsPlugin } from './plugins/KeyboardShortcutsPlugin';
import { AutosavePlugin } from './plugins/AutosavePlugin';
import { InlineToolbarPlugin } from './plugins/InlineToolbarPlugin';

export interface AuroraEditorProps {
  initialBlocks?: Block[];
  pageId?: string;
  onChange?: (blocks: Block[]) => void;
  onSave?: (blocks: Block[]) => Promise<void>;
  placeholder?: string;
}

// ─── Block drag handle (sortable) ─────────────────────────────────────────────

interface SortableDragHandleProps {
  id: string;
  top: number;
}

function SortableDragHandle({ id, top }: SortableDragHandleProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style: React.CSSProperties = {
    position: 'absolute',
    top,
    left: 0,
    width: 20,
    height: 24,
    cursor: isDragging ? 'grabbing' : 'grab',
    opacity: isDragging ? 0.4 : 0.5,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : 1,
    userSelect: 'none',
    fontSize: 14,
    color: '#666',
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} title="Drag to reorder block">
      ⠿
    </div>
  );
}

// ─── Block reorder plugin ──────────────────────────────────────────────────────

interface BlockReorderPluginProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
}

function BlockReorderPlugin({ containerRef }: BlockReorderPluginProps) {
  const [editor] = useLexicalComposerContext();
  const [blockKeys, setBlockKeys] = useState<string[]>([]);
  const [handlePositions, setHandlePositions] = useState<Map<string, number>>(new Map());

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        setBlockKeys($getRoot().getChildrenKeys());
      });
    });
  }, [editor]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const containerTop = container.getBoundingClientRect().top;
    const positions = new Map<string, number>();

    for (const key of blockKeys) {
      const el = editor.getElementByKey(key);
      if (el) {
        positions.set(key, el.getBoundingClientRect().top - containerTop + container.scrollTop);
      }
    }

    setHandlePositions(positions);
  }, [blockKeys, editor, containerRef]);

  const handleDragEnd = useCallback(
    ({ active, over }: DragEndEvent) => {
      if (!over || active.id === over.id) return;

      const oldIndex = blockKeys.indexOf(active.id as string);
      const newIndex = blockKeys.indexOf(over.id as string);
      if (oldIndex === -1 || newIndex === -1) return;

      const newOrder = arrayMove(blockKeys, oldIndex, newIndex);

      editor.update(() => {
        const root = $getRoot();
        const children = root.getChildren();
        const nodeByKey = new Map(children.map((n) => [n.getKey(), n]));

        for (const child of [...children]) child.remove();
        for (const key of newOrder) {
          const node = nodeByKey.get(key);
          if (node) root.append(node);
        }
      });
    },
    [blockKeys, editor],
  );

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <SortableContext items={blockKeys} strategy={verticalListSortingStrategy}>
        {blockKeys.map((key) => (
          <SortableDragHandle key={key} id={key} top={handlePositions.get(key) ?? 0} />
        ))}
      </SortableContext>
    </DndContext>
  );
}

// ─── InitialStatePlugin ───────────────────────────────────────────────────────

function InitialStatePlugin({ blocks }: { blocks: Block[] }) {
  const [editor] = useLexicalComposerContext();
  const applied = useRef(false);

  useEffect(() => {
    if (applied.current || blocks.length === 0) return;
    applied.current = true;
    deserializeFromBlocks(editor, blocks);
  }, [editor, blocks]);

  return null;
}

// ─── AuroraEditor ─────────────────────────────────────────────────────────────

export function AuroraEditor({
  initialBlocks = [],
  pageId,
  onChange,
  onSave,
  placeholder = 'Start writing…',
}: AuroraEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const initialConfig = {
    namespace: 'AuroraEditor',
    nodes: [...ALL_EDITOR_NODES],
    onError: (error: Error) => {
      console.error('[AuroraEditor]', error);
    },
  };

  const handleChange = useCallback(
    (editorState: EditorState) => {
      onChange?.(serializeToBlocks(editorState));
    },
    [onChange],
  );

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div className="aurora-editor">
        <Toolbar
          onPreview={pageId ? () => setPreviewOpen((v) => !v) : undefined}
          previewOpen={previewOpen}
        />
        <div className="aurora-editor__body">
          <div
            ref={containerRef}
            className="aurora-editor__canvas"
            style={{ position: 'relative', paddingLeft: 28 }}
          >
            <BlockReorderPlugin containerRef={containerRef} />
            <RichTextPlugin
              contentEditable={
                <ContentEditable className="aurora-editor__content" aria-label="Editor content" />
              }
              placeholder={
                <div className="aurora-editor__placeholder">{placeholder}</div>
              }
              ErrorBoundary={LexicalErrorBoundary}
            />
          </div>
          <BlockSettingsSidebar
            pageId={pageId}
            showPreview={previewOpen}
            onPreviewClose={() => setPreviewOpen(false)}
          />
        </div>
        <HistoryPlugin />
        <ListPlugin />
        <LinkPlugin />
        <InlineToolbarPlugin />
        {onSave && <KeyboardShortcutsPlugin onSave={() => { void onSave([]); }} />}
        {onSave && <AutosavePlugin onSave={onSave} />}
        {onChange && <OnChangePlugin onChange={handleChange} />}
        {initialBlocks.length > 0 && <InitialStatePlugin blocks={initialBlocks} />}
      </div>
    </LexicalComposer>
  );
}
