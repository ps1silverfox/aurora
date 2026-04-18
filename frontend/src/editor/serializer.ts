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
import { $createImageBlockNode, $createVideoBlockNode, $isImageBlockNode, $isVideoBlockNode } from './nodes/MediaBlocks';
import {
  $createColumnsBlockNode,
  $createSectionBlockNode,
  $createTabsBlockNode,
  $createAccordionBlockNode,
  $isColumnsBlockNode,
  $isSectionBlockNode,
  $isTabsBlockNode,
  $isAccordionBlockNode,
  type ColumnCount,
  type TabItem,
  type AccordionItem,
} from './nodes/LayoutBlocks';
import { $isTableBlockNode, TableBlockNode } from './nodes/TableBlock';
import { $createEmbedBlockNode, $isEmbedBlockNode } from './nodes/EmbedBlocks';
import { $createReusableBlockNode, $isReusableBlockNode } from './nodes/ReusableBlock';

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

  if ($isImageBlockNode(node)) {
    return { type: 'image', content: { url: node.__src, alt: node.__alt, alignment: node.__alignment } };
  }

  if ($isVideoBlockNode(node)) {
    return { type: 'video', content: { url: node.__src, poster: node.__poster } };
  }

  if ($isColumnsBlockNode(node)) {
    return { type: 'columns', content: { columns: node.__columns, content: node.__content } };
  }

  if ($isSectionBlockNode(node)) {
    return { type: 'section', content: { title: node.__title, content: node.__content } };
  }

  if ($isTabsBlockNode(node)) {
    return { type: 'tabs', content: { tabs: node.__tabs } };
  }

  if ($isAccordionBlockNode(node)) {
    return { type: 'accordion', content: { items: node.__items } };
  }

  if ($isTableBlockNode(node)) {
    return {
      type: 'table',
      content: { rows: node.__rows, cols: node.__cols, cells: node.__cells, headerRow: node.__headerRow, striped: node.__striped },
    };
  }

  if ($isEmbedBlockNode(node)) {
    return { type: 'embed', content: { url: node.__url, height: node.__height, caption: node.__caption } };
  }

  if ($isReusableBlockNode(node)) {
    return {
      type: 'reusable',
      content: {
        templateId: node.__templateId,
        name: node.__name,
        blockType: node.__blockType,
        content: node.__content,
        detached: node.__detached,
      },
    };
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
    case 'image': {
      const { url, alt, alignment } = block.content as { url: string; alt: string; alignment: string };
      return $createImageBlockNode(url, alt, alignment as 'left' | 'center' | 'right');
    }
    case 'video': {
      const { url, poster } = block.content as { url: string; poster: string };
      return $createVideoBlockNode(url, poster);
    }
    case 'columns': {
      const { columns, content } = block.content as { columns: ColumnCount; content: string[] };
      const colNode = $createColumnsBlockNode(columns);
      colNode.__content = content;
      return colNode;
    }
    case 'section': {
      const { title, content } = block.content as { title: string; content: string };
      return $createSectionBlockNode(title, content);
    }
    case 'tabs': {
      const { tabs } = block.content as { tabs: TabItem[] };
      return $createTabsBlockNode(tabs);
    }
    case 'accordion': {
      const { items } = block.content as { items: AccordionItem[] };
      return $createAccordionBlockNode(items);
    }
    case 'table': {
      const { rows, cols, cells, headerRow, striped } = block.content as {
        rows: number; cols: number; cells: string[][]; headerRow: boolean; striped: boolean;
      };
      return new TableBlockNode(rows, cols, cells, headerRow, striped);
    }
    case 'embed': {
      const { url, height, caption } = block.content as { url: string; height: number; caption: string };
      return $createEmbedBlockNode(url, height, caption);
    }
    case 'reusable': {
      const { templateId, name, blockType, content, detached } = block.content as {
        templateId: string; name: string; blockType: string; content: Record<string, unknown>; detached: boolean;
      };
      return $createReusableBlockNode(templateId, name, blockType, content, detached);
    }
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
