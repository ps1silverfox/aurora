import { validateBlock } from './block-registry';
import { isOk, isErr } from '../../common/result';

describe('validateBlock', () => {
  describe('unknown block type', () => {
    it('returns error for unregistered type', () => {
      const result = validateBlock('nonexistent_block', {});
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.message).toContain('Unknown block type');
      }
    });
  });

  describe('text block', () => {
    it('passes with valid html content', () => {
      expect(isOk(validateBlock('text', { html: '<p>Hello</p>' }))).toBe(true);
    });

    it('fails when html is missing', () => {
      expect(isErr(validateBlock('text', {}))).toBe(true);
    });

    it('fails when html is not a string', () => {
      expect(isErr(validateBlock('text', { html: 42 }))).toBe(true);
    });
  });

  describe('heading block', () => {
    it('passes with valid level 1-6', () => {
      expect(isOk(validateBlock('heading', { text: 'Title', level: 1 }))).toBe(true);
      expect(isOk(validateBlock('heading', { text: 'Title', level: 6 }))).toBe(true);
    });

    it('fails with invalid level', () => {
      expect(isErr(validateBlock('heading', { text: 'Title', level: 7 }))).toBe(true);
      expect(isErr(validateBlock('heading', { text: 'Title', level: 0 }))).toBe(true);
    });

    it('fails when text is missing', () => {
      expect(isErr(validateBlock('heading', { level: 2 }))).toBe(true);
    });
  });

  describe('image block', () => {
    it('passes with required fields', () => {
      expect(isOk(validateBlock('image', { mediaId: 'abc', alt: 'An image' }))).toBe(true);
    });

    it('passes with optional caption and alignment', () => {
      expect(
        isOk(
          validateBlock('image', {
            mediaId: 'abc',
            alt: 'Alt',
            caption: 'Caption',
            alignment: 'center',
          }),
        ),
      ).toBe(true);
    });

    it('fails with invalid alignment', () => {
      expect(isErr(validateBlock('image', { mediaId: 'abc', alt: 'Alt', alignment: 'diagonal' }))).toBe(true);
    });

    it('fails when mediaId is missing', () => {
      expect(isErr(validateBlock('image', { alt: 'Alt' }))).toBe(true);
    });
  });

  describe('video block', () => {
    it('passes with mediaId', () => {
      expect(isOk(validateBlock('video', { mediaId: 'vid-123' }))).toBe(true);
    });

    it('fails without mediaId', () => {
      expect(isErr(validateBlock('video', {}))).toBe(true);
    });
  });

  describe('quote block', () => {
    it('passes with text only', () => {
      expect(isOk(validateBlock('quote', { text: 'To be or not to be' }))).toBe(true);
    });

    it('passes with optional attribution', () => {
      expect(
        isOk(validateBlock('quote', { text: 'To be or not to be', attribution: 'Shakespeare' })),
      ).toBe(true);
    });

    it('fails without text', () => {
      expect(isErr(validateBlock('quote', {}))).toBe(true);
    });
  });

  describe('list block', () => {
    it('passes with items array and ordered flag', () => {
      expect(isOk(validateBlock('list', { items: ['a', 'b'], ordered: true }))).toBe(true);
    });

    it('fails with non-array items', () => {
      expect(isErr(validateBlock('list', { items: 'a,b', ordered: false }))).toBe(true);
    });

    it('fails with non-string items', () => {
      expect(isErr(validateBlock('list', { items: [1, 2], ordered: false }))).toBe(true);
    });
  });

  describe('table block', () => {
    it('passes with headers and rows', () => {
      expect(
        isOk(validateBlock('table', { headers: ['Name', 'Age'], rows: [['Alice', '30']] })),
      ).toBe(true);
    });

    it('fails with non-2D rows', () => {
      expect(
        isErr(validateBlock('table', { headers: ['Name'], rows: ['Alice'] })),
      ).toBe(true);
    });
  });

  describe('code block', () => {
    it('passes with code string', () => {
      expect(isOk(validateBlock('code', { code: 'console.log("hi")' }))).toBe(true);
    });

    it('passes with optional language', () => {
      expect(isOk(validateBlock('code', { code: 'print()', language: 'python' }))).toBe(true);
    });

    it('fails without code', () => {
      expect(isErr(validateBlock('code', { language: 'js' }))).toBe(true);
    });
  });

  describe('separator block', () => {
    it('passes with empty content', () => {
      expect(isOk(validateBlock('separator', {}))).toBe(true);
    });
  });

  describe('columns block', () => {
    it('passes with column count', () => {
      expect(isOk(validateBlock('columns', { columns: 2 }))).toBe(true);
    });

    it('fails without columns', () => {
      expect(isErr(validateBlock('columns', {}))).toBe(true);
    });
  });

  describe('section block', () => {
    it('passes with empty content', () => {
      expect(isOk(validateBlock('section', {}))).toBe(true);
    });

    it('passes with optional fields', () => {
      expect(
        isOk(validateBlock('section', { background: '#fff', padding: '2rem' })),
      ).toBe(true);
    });
  });

  describe('tabs block', () => {
    it('passes with tabs array', () => {
      expect(
        isOk(
          validateBlock('tabs', {
            tabs: [{ label: 'Tab 1', blockIds: ['id-1'] }],
          }),
        ),
      ).toBe(true);
    });

    it('fails without tabs', () => {
      expect(isErr(validateBlock('tabs', {}))).toBe(true);
    });
  });

  describe('accordion block', () => {
    it('passes with items array', () => {
      expect(
        isOk(
          validateBlock('accordion', {
            items: [{ title: 'FAQ', blockIds: ['id-1'] }],
          }),
        ),
      ).toBe(true);
    });

    it('fails without items', () => {
      expect(isErr(validateBlock('accordion', {}))).toBe(true);
    });
  });

  describe('chart block', () => {
    it('passes with required fields', () => {
      expect(
        isOk(validateBlock('chart', { queryId: 'q1', chartType: 'bar' })),
      ).toBe(true);
    });

    it('fails with invalid chartType', () => {
      expect(
        isErr(validateBlock('chart', { queryId: 'q1', chartType: 'radar' })),
      ).toBe(true);
    });

    it('fails without queryId', () => {
      expect(isErr(validateBlock('chart', { chartType: 'bar' }))).toBe(true);
    });
  });

  describe('kpi_card block', () => {
    it('passes with required fields', () => {
      expect(
        isOk(validateBlock('kpi_card', { queryId: 'q1', metric: 'total_sales', label: 'Sales' })),
      ).toBe(true);
    });

    it('fails without metric', () => {
      expect(isErr(validateBlock('kpi_card', { queryId: 'q1', label: 'Sales' }))).toBe(true);
    });
  });

  describe('data_table block', () => {
    it('passes with queryId only', () => {
      expect(isOk(validateBlock('data_table', { queryId: 'q1' }))).toBe(true);
    });

    it('passes with optional columns and pageSize', () => {
      expect(
        isOk(validateBlock('data_table', { queryId: 'q1', columns: ['a', 'b'], pageSize: 25 })),
      ).toBe(true);
    });
  });

  describe('embed_youtube block', () => {
    it('passes with videoId', () => {
      expect(isOk(validateBlock('embed_youtube', { videoId: 'dQw4w9WgXcQ' }))).toBe(true);
    });

    it('fails without videoId', () => {
      expect(isErr(validateBlock('embed_youtube', {}))).toBe(true);
    });
  });

  describe('embed_vimeo block', () => {
    it('passes with videoId', () => {
      expect(isOk(validateBlock('embed_vimeo', { videoId: '123456' }))).toBe(true);
    });

    it('fails without videoId', () => {
      expect(isErr(validateBlock('embed_vimeo', {}))).toBe(true);
    });
  });

  describe('embed_iframe block', () => {
    it('passes with url', () => {
      expect(isOk(validateBlock('embed_iframe', { url: 'https://example.com' }))).toBe(true);
    });

    it('fails without url', () => {
      expect(isErr(validateBlock('embed_iframe', {}))).toBe(true);
    });
  });

  describe('reusable block', () => {
    it('passes with templateId', () => {
      expect(isOk(validateBlock('reusable', { templateId: 'tmpl-1' }))).toBe(true);
    });

    it('passes with optional detached flag', () => {
      expect(
        isOk(validateBlock('reusable', { templateId: 'tmpl-1', detached: true })),
      ).toBe(true);
    });

    it('fails without templateId', () => {
      expect(isErr(validateBlock('reusable', {}))).toBe(true);
    });
  });
});
