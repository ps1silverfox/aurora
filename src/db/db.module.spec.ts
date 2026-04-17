import { Test } from '@nestjs/testing';
import { CsvDriver } from './csv.driver';
import { DB_SERVICE, IDbService } from './db.interface';
import { DbModule } from './db.module';
import { OracleDriver } from './oracle.driver';

describe('DbModule.forRoot()', () => {
  let originalDriver: string | undefined;

  beforeEach(() => {
    originalDriver = process.env['DB_DRIVER'];
    jest.spyOn(CsvDriver.prototype, 'onModuleInit').mockResolvedValue(undefined);
    jest.spyOn(OracleDriver.prototype, 'onModuleInit').mockResolvedValue(undefined);
    jest.spyOn(OracleDriver.prototype, 'onModuleDestroy').mockResolvedValue(undefined);
  });

  afterEach(() => {
    if (originalDriver === undefined) {
      delete process.env['DB_DRIVER'];
    } else {
      process.env['DB_DRIVER'] = originalDriver;
    }
    jest.restoreAllMocks();
  });

  it('provides CsvDriver when DB_DRIVER is unset', async () => {
    delete process.env['DB_DRIVER'];
    const module = await Test.createTestingModule({
      imports: [DbModule.forRoot()],
    }).compile();
    await module.init();

    const driver = module.get<IDbService>(DB_SERVICE);
    expect(driver).toBeInstanceOf(CsvDriver);
    await module.close();
  });

  it('provides CsvDriver when DB_DRIVER=csv', async () => {
    process.env['DB_DRIVER'] = 'csv';
    const module = await Test.createTestingModule({
      imports: [DbModule.forRoot()],
    }).compile();
    await module.init();

    const driver = module.get<IDbService>(DB_SERVICE);
    expect(driver).toBeInstanceOf(CsvDriver);
    await module.close();
  });

  it('provides OracleDriver when DB_DRIVER=oracle', async () => {
    process.env['DB_DRIVER'] = 'oracle';
    const module = await Test.createTestingModule({
      imports: [DbModule.forRoot()],
    }).compile();
    await module.init();

    const driver = module.get<IDbService>(DB_SERVICE);
    expect(driver).toBeInstanceOf(OracleDriver);
    await module.close();
  });
});

describe('CsvDriver', () => {
  let driver: CsvDriver;

  beforeEach(async () => {
    driver = new CsvDriver();
    // onModuleInit loads CSV files — skip for unit tests (no fixture files)
    await driver.onModuleInit();
  });

  it('returns empty array for unknown table', async () => {
    const rows = await driver.query('SELECT * FROM NONEXISTENT');
    expect(rows).toEqual([]);
  });

  it('inserts and queries a row', async () => {
    await driver.execute(
      'INSERT INTO USERS (ID, NAME, EMAIL) VALUES (:id, :name, :email)',
      { id: '1', name: 'Alice', email: 'alice@example.com' },
    );
    const rows = await driver.query<{ ID: string; NAME: string }>(
      'SELECT * FROM USERS WHERE ID = :id',
      { id: '1' },
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ ID: '1', NAME: 'Alice' });
  });

  it('updates matching rows', async () => {
    await driver.execute('INSERT INTO ITEMS (ID, STATUS) VALUES (:id, :status)', {
      id: '10',
      status: 'pending',
    });
    await driver.execute('UPDATE ITEMS SET STATUS = :status WHERE ID = :id', {
      status: 'done',
      id: '10',
    });
    const rows = await driver.query<{ STATUS: string }>(
      'SELECT * FROM ITEMS WHERE ID = :id',
      { id: '10' },
    );
    expect(rows[0]?.STATUS).toBe('done');
  });

  it('deletes matching rows', async () => {
    await driver.execute('INSERT INTO TAGS (ID, NAME) VALUES (:id, :name)', {
      id: '99',
      name: 'old',
    });
    await driver.execute('DELETE FROM TAGS WHERE ID = :id', { id: '99' });
    expect(driver.getTable('TAGS')).toHaveLength(0);
  });

  it('executeBatch inserts multiple rows', async () => {
    await driver.executeBatch('INSERT INTO ROLES (ID, NAME) VALUES (:id, :name)', [
      { id: '1', name: 'admin' },
      { id: '2', name: 'editor' },
    ]);
    expect(driver.getTable('ROLES')).toHaveLength(2);
  });

  it('ignores DDL statements without throwing', async () => {
    await expect(
      driver.execute('CREATE TABLE FOO (ID NUMBER PRIMARY KEY)'),
    ).resolves.toBeUndefined();
  });
});
