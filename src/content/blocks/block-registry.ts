import { z } from 'zod';
import { type Result, ok, err } from '../../common/result';
import { ValidationError } from '../../common/errors';
import { textSchema } from './schemas/text';
import { headingSchema } from './schemas/heading';
import { imageSchema } from './schemas/image';
import { videoSchema } from './schemas/video';
import { quoteSchema } from './schemas/quote';
import { listSchema } from './schemas/list';
import { tableSchema } from './schemas/table';
import { codeSchema } from './schemas/code';
import { separatorSchema } from './schemas/separator';
import { columnsSchema } from './schemas/columns';
import { sectionSchema } from './schemas/section';
import { tabsSchema } from './schemas/tabs';
import { accordionSchema } from './schemas/accordion';
import { chartSchema } from './schemas/chart';
import { kpiCardSchema } from './schemas/kpi_card';
import { dataTableSchema } from './schemas/data_table';
import { embedYoutubeSchema } from './schemas/embed_youtube';
import { embedVimeoSchema } from './schemas/embed_vimeo';
import { embedIframeSchema } from './schemas/embed_iframe';
import { reusableSchema } from './schemas/reusable';

const registry: Record<string, z.ZodType> = {
  text: textSchema,
  heading: headingSchema,
  image: imageSchema,
  video: videoSchema,
  quote: quoteSchema,
  list: listSchema,
  table: tableSchema,
  code: codeSchema,
  separator: separatorSchema,
  columns: columnsSchema,
  section: sectionSchema,
  tabs: tabsSchema,
  accordion: accordionSchema,
  chart: chartSchema,
  kpi_card: kpiCardSchema,
  data_table: dataTableSchema,
  embed_youtube: embedYoutubeSchema,
  embed_vimeo: embedVimeoSchema,
  embed_iframe: embedIframeSchema,
  reusable: reusableSchema,
};

export function validateBlock(type: string, content: unknown): Result<void, ValidationError> {
  const schema = registry[type];
  if (!schema) {
    return err(new ValidationError(`Unknown block type: ${type}`));
  }

  const parsed = schema.safeParse(content);
  if (!parsed.success) {
    return err(new ValidationError(`Invalid content for block type "${type}"`, { issues: parsed.error.issues }));
  }

  return ok(undefined);
}
