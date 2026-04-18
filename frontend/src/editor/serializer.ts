import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $isParagraphNode,
  type EditorState,
  type LexicalEditor,
  type LexicalNode,
} from 'lexical';
import {
  $createHeadingNode,
  $createQuoteNode,
  $isHeadingNode,
  $isQuoteNode,
  type HeadingTagType,
} from '@lexical/rich-text';
import { $createListNode, $createListItemNode, $isListNode, $isListItemNode } from '@lexical/list';
import { $createCodeNode, $isCodeNode } from '@lexical/code';
import { $createDividerNode, $isDividerNode } from './nodes/DividerNode';

export interface Block {
  type: string;
  content: Record<string, unknown>;
}

function serializeNode(node: LexicalNode): Block | null {
  if ($isHeadingNode(node)) {
    const tag = node.getTag();
    const level = parseInt(tag.charAt(1)) as 1 | 2 | 3 | 4 | 5 | 6;
    return { type: 'heading', content: { text: node.getTextContent(), level } };
  }

  if ($isQuoteNode(node)) {
    return { type: 'quote', content: { text: node.getTextContent(), attribution: '' } };
  }

  if ($isListNode(node)) {
    const ordered = node.getListType() === 'number';
    const items = node
      .getChildren()
      .filter($isListItemNode)
      .map((item) => item.getTextContent());
    return { type: 'list', content: { items, ordered } };
  }

  if ($isCodeNode(node)) {
    return { type: 'code', content: { code: node.getTextContent(), language: node.getLanguage() ?? 'plaintext' } };
  }

  if ($isDividerNode(node)) {
    return { type: 'separator', content: {} };
  }

  if ($isParagraphNode(node)) {
    return { type: 'text', content: { html: node.getTextContent() } };
  }

  return null;
}

export function serializeToBlocks(editorState: EditorState): Block[] {
  const blocks: Block[] = [];
  editorState.read(() => {
    const root = $getRoot();
    for (const node of root.getChildren()) {
      const block = serializeNode(node);
      if (block !== null) blocks.push(block);
    }
  });
  return blocks;
}

function deserializeBlock(block: Block): LexicalNode | null {
  switch (block.type) {
    case 'heading': {
      const { text, level } = block.content as { text: string; level: 1 | 2 | 3 | 4 | 5 | 6 };
      const tag: HeadingTagType = `h${level}`;
      const node = $createHeadingNode(tag);
      node.append($createTextNode(text));
      return node;
    }
    case 'quote': {
      const { text } = block.content as { text: string };
      const node = $createQuoteNode();
      node.append($createTextNode(text));
      return node;
    }
    case 'list': {
      const { items, ordered } = block.content as { items: string[]; ordered: boolean };
      const listNode = $createListNode(ordered ? 'number' : 'bullet');
      for (const item of items) {
        const itemNode = $createListItemNode();
        itemNode.append($createTextNode(item));
        listNode.append(itemNode);
      }
      return listNode;
    }
    case 'code': {
      const { code, language } = block.content as { code: string; language?: string };
      const node = $createCodeNode(language);
      node.append($createTextNode(code));
      return node;
    }
    case 'separator':
      return $createDividerNode();
    case 'text':
    default: {
      const { html } = block.content as { html: string };
      const node = $createParagraphNode();
      node.append($createTextNode(html ?? ''));
      return node;
    }
  }
}

export function deserializeFromBlocks(editor: LexicalEditor, blocks: Block[]): void {
  editor.update(() => {
    const root = $getRoot();
    root.clear();
    for (const block of blocks) {
      const node = deserializeBlock(block);
      if (node !== null) root.append(node);
    }
  });
}
