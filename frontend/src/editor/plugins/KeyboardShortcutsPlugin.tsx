import { useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { KEY_DOWN_COMMAND, COMMAND_PRIORITY_LOW } from 'lexical';

interface KeyboardShortcutsPluginProps {
  onSave?: () => void;
}

export function KeyboardShortcutsPlugin({ onSave }: KeyboardShortcutsPluginProps) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerCommand(
      KEY_DOWN_COMMAND,
      (event: KeyboardEvent) => {
        if ((event.ctrlKey || event.metaKey) && event.key === 's') {
          event.preventDefault();
          onSave?.();
          return true;
        }
        return false;
      },
      COMMAND_PRIORITY_LOW,
    );
  }, [editor, onSave]);

  return null;
}
