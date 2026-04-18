import React from 'react';
import { DecoratorNode, type LexicalNode, type NodeKey, type SerializedLexicalNode } from 'lexical';

export type SerializedDividerNode = SerializedLexicalNode;

export class DividerNode extends DecoratorNode<React.ReactElement> {
  static getType(): string {
    return 'divider';
  }

  static clone(node: DividerNode): DividerNode {
    return new DividerNode(node.__key);
  }

  static importJSON(_json: SerializedDividerNode): DividerNode {
    return $createDividerNode();
  }

  constructor(key?: NodeKey) {
    super(key);
  }

  exportJSON(): SerializedDividerNode {
    return { ...super.exportJSON(), type: 'divider', version: 1 };
  }

  createDOM(): HTMLElement {
    return document.createElement('div');
  }

  updateDOM(): boolean {
    return false;
  }

  isInline(): boolean {
    return false;
  }

  decorate(): React.ReactElement {
    return <hr className="aurora-editor__divider" />;
  }
}

export function $createDividerNode(): DividerNode {
  return new DividerNode();
}

export function $isDividerNode(node: LexicalNode | null | undefined): node is DividerNode {
  return node instanceof DividerNode;
}
