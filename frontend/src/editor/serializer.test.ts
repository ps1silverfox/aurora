import { createEditor } from 'lexical';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { ListNode, ListItemNode } from '@lexical/list';
import { CodeNode, CodeHighlightNode } from '@lexical/code';
import { DividerNode } from './nodes/DividerNode';
import { serializeToBlocks, deserializeFromBlocks, type Block } from './serializer';

function makeEditor() {
  return createEditor({
    namespace: 'test',
    nodes: [HeadingNode, QuoteNode, ListNode, ListItemNode, CodeNode, CodeHighlightNode, DividerNode],
    onError: (e) => { throw e; },
  });
}

async function populateAndSerialize(blocks: Block[]): Promise<Block[]> {
  const editor = makeEditor();
  const el = document.createElement('div');
  editor.setRootElement(el);

  await new Promise<void>((resolve) => {
    deserializeFromBlocks(editor, blocks);
    editor.registerUpdateListener(() => resolve());
  });

  return new Promise<Block[]>((resolve) => {
    editor.getEditorState().read(() => {
      resolve(serializeToBlocks(editor.getEditorState()));
    });
  });
}

describe('serializeToBlocks', () => {
  it('returns empty array for empty editor', () => {
    const editor = makeEditor();
    const result = serializeToBlocks(editor.getEditorState());
    expect(result).toEqual([]);
  });

  it('serializes a heading block', async () => {
    const input: Block[] = [{ type: 'heading', content: { text: 'Hello World', level: 2 } }];
    const output = await populateAndSerialize(input);
    expect(output).toHaveLength(1);
    expect(output[0].type).toBe('heading');
    expect(output[0].content).toMatchObject({ text: 'Hello World', level: 2 });
  });

  it('serializes a quote block', async () => {
    const input: Block[] = [{ type: 'quote', content: { text: 'To be or not to be', attribution: '' } }];
    const output = await populateAndSerialize(input);
    expect(output).toHaveLength(1);
    expect(output[0].type).toBe('quote');
    expect((output[0].content as { text: string }).text).toBe('To be or not to be');
  });

  it('serializes a bullet list block', async () => {
    const input: Block[] = [
      { type: 'list', content: { items: ['Alpha', 'Beta', 'Gamma'], ordered: false } },
    ];
    const output = await populateAndSerialize(input);
    expect(output).toHaveLength(1);
    expect(output[0].type).toBe('list');
    const content = output[0].content as { items: string[]; ordered: boolean };
    expect(content.ordered).toBe(false);
    expect(content.items).toEqual(['Alpha', 'Beta', 'Gamma']);
  });

  it('serializes an ordered list block', async () => {
    const input: Block[] = [
      { type: 'list', content: { items: ['First', 'Second'], ordered: true } },
    ];
    const output = await populateAndSerialize(input);
    expect((output[0].content as { ordered: boolean }).ordered).toBe(true);
  });

  it('serializes a code block with language', async () => {
    const input: Block[] = [{ type: 'code', content: { code: 'const x = 1;', language: 'javascript' } }];
    const output = await populateAndSerialize(input);
    expect(output[0].type).toBe('code');
    const content = output[0].content as { code: string; language: string };
    expect(content.code).toBe('const x = 1;');
    expect(content.language).toBe('javascript');
  });

  it('serializes a separator block', async () => {
    const input: Block[] = [{ type: 'separator', content: {} }];
    const output = await populateAndSerialize(input);
    expect(output[0].type).toBe('separator');
  });

  it('serializes a text paragraph block', async () => {
    const input: Block[] = [{ type: 'text', content: { html: 'Plain paragraph text' } }];
    const output = await populateAndSerialize(input);
    expect(output[0].type).toBe('text');
    expect((output[0].content as { html: string }).html).toBe('Plain paragraph text');
  });

  it('preserves order across multiple blocks', async () => {
    const input: Block[] = [
      { type: 'heading', content: { text: 'Title', level: 1 } },
      { type: 'text', content: { html: 'Intro paragraph' } },
      { type: 'separator', content: {} },
    ];
    const output = await populateAndSerialize(input);
    expect(output).toHaveLength(3);
    expect(output[0].type).toBe('heading');
    expect(output[1].type).toBe('text');
    expect(output[2].type).toBe('separator');
  });

  // TODO: Add your own roundtrip assertions below.
  // Consider testing: heading levels 1–6, empty list items,
  // code blocks with no language, mixed block sequences.
});
