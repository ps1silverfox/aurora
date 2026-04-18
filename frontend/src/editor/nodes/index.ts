export { HeadingNode, QuoteNode } from '@lexical/rich-text';
export { ListNode, ListItemNode } from '@lexical/list';
export { CodeNode, CodeHighlightNode } from '@lexical/code';
export { DividerNode, $createDividerNode, $isDividerNode } from './DividerNode';

import type { Klass, LexicalNode } from 'lexical';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { ListNode, ListItemNode } from '@lexical/list';
import { CodeNode, CodeHighlightNode } from '@lexical/code';
import { DividerNode } from './DividerNode';

export const ALL_EDITOR_NODES: ReadonlyArray<Klass<LexicalNode>> = [
  HeadingNode,
  QuoteNode,
  ListNode,
  ListItemNode,
  CodeNode,
  CodeHighlightNode,
  DividerNode,
];
