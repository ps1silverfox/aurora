import { useEffect, useRef, useState } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { serializeToBlocks, type Block } from '../serializer';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

const AUTOSAVE_DELAY_MS = 30_000;

interface AutosavePluginProps {
  onSave: (blocks: Block[]) => Promise<void>;
  disabled?: boolean;
}

export function AutosavePlugin({ onSave, disabled }: AutosavePluginProps) {
  const [editor] = useLexicalComposerContext();
  const [status, setStatus] = useState<SaveStatus>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (disabled) return;

    return editor.registerUpdateListener(({ editorState, dirtyElements, dirtyLeaves }) => {
      const isDirty = dirtyElements.size > 0 || dirtyLeaves.size > 0;
      if (!isDirty) return;

      if (timerRef.current) clearTimeout(timerRef.current);

      setStatus('idle');
      timerRef.current = setTimeout(() => {
        setStatus('saving');
        const blocks = serializeToBlocks(editorState);
        onSave(blocks)
          .then(() => setStatus('saved'))
          .catch(() => setStatus('error'));
      }, AUTOSAVE_DELAY_MS);
    });
  }, [editor, onSave, disabled]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (status === 'idle') return null;

  return (
    <div className="aurora-editor__autosave-status" aria-live="polite">
      {status === 'saving' && 'Saving…'}
      {status === 'saved' && 'Saved'}
      {status === 'error' && 'Save failed'}
    </div>
  );
}
