import { Injectable, Inject } from '@nestjs/common';
import { DB_SERVICE, IDbService } from '../db/db.interface';
import { NotFoundError } from '../common/errors';

export interface BlockTemplate {
  id: string;
  name: string;
  blockType: string;
  content: Record<string, unknown>;
  createdBy: string | null;
  createdAt: Date;
}

export interface CreateBlockTemplateDto {
  name: string;
  blockType: string;
  content: Record<string, unknown>;
}

function rowToTemplate(row: Record<string, unknown>): BlockTemplate {
  return {
    id: (row['ID'] as Buffer | string).toString('hex').replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5'),
    name: row['NAME'] as string,
    blockType: row['BLOCK_TYPE'] as string,
    content: JSON.parse(row['CONTENT'] as string) as Record<string, unknown>,
    createdBy: row['CREATED_BY'] != null
      ? (row['CREATED_BY'] as Buffer | string).toString('hex').replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5')
      : null,
    createdAt: new Date(row['CREATED_AT'] as string),
  };
}

@Injectable()
export class BlockTemplatesService {
  constructor(@Inject(DB_SERVICE) private readonly db: IDbService) {}

  async list(): Promise<BlockTemplate[]> {
    const rows = await this.db.query<Record<string, unknown>>(
      'SELECT ID, NAME, BLOCK_TYPE, CONTENT, CREATED_BY, CREATED_AT FROM BLOCK_TEMPLATES ORDER BY CREATED_AT DESC',
    );
    return rows.map(rowToTemplate);
  }

  async create(dto: CreateBlockTemplateDto, createdBy: string): Promise<BlockTemplate> {
    const id = crypto.randomUUID();
    const rawId = id.replace(/-/g, '');
    const rawCreatedBy = createdBy.replace(/-/g, '');
    await this.db.execute(
      `INSERT INTO BLOCK_TEMPLATES (ID, NAME, BLOCK_TYPE, CONTENT, CREATED_BY)
       VALUES (HEXTORAW(:id), :name, :blockType, :content, HEXTORAW(:createdBy))`,
      { id: rawId, name: dto.name, blockType: dto.blockType, content: JSON.stringify(dto.content), createdBy: rawCreatedBy },
    );
    return {
      id,
      name: dto.name,
      blockType: dto.blockType,
      content: dto.content,
      createdBy,
      createdAt: new Date(),
    };
  }

  async delete(id: string): Promise<void> {
    const rawId = id.replace(/-/g, '');
    const rows = await this.db.query<Record<string, unknown>>(
      'SELECT ID FROM BLOCK_TEMPLATES WHERE ID = HEXTORAW(:id)',
      { id: rawId },
    );
    if (rows.length === 0) throw new NotFoundError(`Block template ${id} not found`);
    await this.db.execute('DELETE FROM BLOCK_TEMPLATES WHERE ID = HEXTORAW(:id)', { id: rawId });
  }

  async findById(id: string): Promise<BlockTemplate | null> {
    const rawId = id.replace(/-/g, '');
    const rows = await this.db.query<Record<string, unknown>>(
      'SELECT ID, NAME, BLOCK_TYPE, CONTENT, CREATED_BY, CREATED_AT FROM BLOCK_TEMPLATES WHERE ID = HEXTORAW(:id)',
      { id: rawId },
    );
    const row = rows[0];
    return row != null ? rowToTemplate(row) : null;
  }
}
