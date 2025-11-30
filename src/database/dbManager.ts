import { Pool, PoolClient, QueryResult } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../automation/utils/logUtils';
import dotenv from 'dotenv';

dotenv.config();

export interface CheckData {
  chek_raqam: string;
  chek_summa: number;
  maxsulot_nomi?: string;
}

export interface FakturaData {
  mxik: string;
  ulchov: string;
  faktura_summa: number;
  faktura_miqdor: number;
}

export interface SelectCheckData {
  mxik: string;
  ulchov: string;
  faktura_summa: number;
  faktura_miqdor: number;
  chek_raqam: string;
  maxsulot_nomi?: string;
  chek_summa: number;
  miqdor: number;
  umumiy_chek_summa: number;
  bir_birlik: number;
}

export interface Statistics {
  total_checks: number;
  unprocessed_checks: number;
  processed_checks: number;
  total_fakturas: number;
  active_fakturas: number;
  inactive_fakturas: number;
  total_select_checks: number;
  active_select_checks: number;
  inactive_select_checks: number;
  total_checks_summa: number;
  total_unprocessed_summa: number;
  total_processed_summa: number;
  total_selected_summa: number;
  total_active_faktura_summa: number;
}

export class DbManager {
  private pool: Pool;
  private client: PoolClient | null = null;

  constructor() {
    this.pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'reacted_checks_db',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '5432',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.pool.on('error', (err) => {
      logger.error('❌ PostgreSQL pool xatosi:', err);
    });
  }

  /**
   * Database ga ulanish
   */
  async connect(): Promise<void> {
    try {
      logger.info('🔌 PostgreSQL ga ulanish...');
      this.client = await this.pool.connect();
      logger.info("✅ PostgreSQL bilan ulanish o'rnatildi");

      await this.createTables();
      await this.verifyTables();
    } catch (error) {
      logger.error('❌ Database ga ulanishda xato:', error);
      throw error;
    }
  }

  /**
   * Schema fayldan jadvallarni yaratish
   */
  private async createTables(): Promise<void> {
    try {
      logger.info('📦 Jadvallar yaratilmoqda...');

      const schemaPath = path.join(__dirname, 'schema.sql');

      if (!fs.existsSync(schemaPath)) {
        logger.warning('⚠️ schema.sql fayli topilmadi, manual yaratiladi...');
        await this.createTablesManually();
        return;
      }

      const schema = fs.readFileSync(schemaPath, 'utf-8');
      await this.client!.query(schema);

      logger.info('✅ Jadvallar muvaffaqiyatli yaratildi');
    } catch (error) {
      logger.error('❌ Jadvallarni yaratishda xato:', error);
      throw error;
    }
  }

  /**
   * Manual jadval yaratish (schema.sql bo'lmasa)
   */
  private async createTablesManually(): Promise<void> {
    const queries = [
      'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";',

      `CREATE TABLE IF NOT EXISTS checks (
                id SERIAL PRIMARY KEY,
                uuid UUID DEFAULT uuid_generate_v4() UNIQUE,
                chek_raqam VARCHAR(100) NOT NULL,
                chek_summa DECIMAL(15, 2) NOT NULL,
                maxsulot_nomi TEXT,
                processed BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );`,

      `CREATE TABLE IF NOT EXISTS faktura (
                id SERIAL PRIMARY KEY,
                uuid UUID DEFAULT uuid_generate_v4() UNIQUE,
                mxik VARCHAR(100) NOT NULL,
                ulchov VARCHAR(500) NOT NULL,
                faktura_summa DECIMAL(15, 2) NOT NULL,
                faktura_miqdor DECIMAL(15, 8) NOT NULL,
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );`,

      `CREATE TABLE IF NOT EXISTS select_checks (
                id SERIAL PRIMARY KEY,
                uuid UUID DEFAULT uuid_generate_v4() UNIQUE,
                mxik VARCHAR(100) NOT NULL,
                ulchov VARCHAR(500) NOT NULL,
                faktura_summa DECIMAL(15, 2) NOT NULL,
                faktura_miqdor DECIMAL(15, 8) NOT NULL,
                chek_raqam VARCHAR(100) NOT NULL,
                maxsulot_nomi TEXT,
                chek_summa DECIMAL(15, 2) NOT NULL,
                miqdor DECIMAL(15, 8) NOT NULL,
                umumiy_chek_summa DECIMAL(15, 2) NOT NULL,
                bir_birlik DECIMAL(15, 2) NOT NULL,
                is_active BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );`,

      'CREATE INDEX IF NOT EXISTS idx_checks_chek_raqam ON checks(chek_raqam);',
      'CREATE INDEX IF NOT EXISTS idx_checks_processed ON checks(processed);',
      'CREATE INDEX IF NOT EXISTS idx_faktura_mxik ON faktura(mxik);',
      'CREATE INDEX IF NOT EXISTS idx_faktura_is_active ON faktura(is_active);',
      'CREATE INDEX IF NOT EXISTS idx_select_checks_mxik ON select_checks(mxik);',
    ];

    for (const query of queries) {
      await this.client!.query(query);
    }
  }

  /**
   * Jadvallar mavjudligini tekshirish
   */
  private async verifyTables(): Promise<void> {
    const result = await this.client!.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('checks', 'faktura', 'select_checks')
        `);

    const tables = result.rows.map((row) => row.table_name);
    logger.info(`📋 Mavjud jadvallar: ${tables.join(', ')}`);

    if (tables.length < 3) {
      throw new Error("Ba'zi jadvallar yaratilmadi!");
    }
  }

  /**
   * Checks tableiga ma'lumot qo'shish
   */
  async insertCheck(data: CheckData): Promise<void> {
    const query = `
            INSERT INTO checks (chek_raqam, chek_summa, maxsulot_nomi)
            VALUES ($1, $2, $3)
        `;

    await this.client!.query(query, [
      data.chek_raqam,
      data.chek_summa,
      data.maxsulot_nomi,
    ]);
  }

  /**
   * Ko'plab cheklar qo'shish
   */
  async insertChecks(checks: CheckData[]): Promise<number> {
    let inserted = 0;

    for (const check of checks) {
      try {
        await this.insertCheck(check);
        inserted++;
      } catch (error: any) {
        logger.warning(`⚠️ Chek kiritilmadi: ${error.message}`);
      }
    }

    logger.info(`✅ ${inserted}/${checks.length} ta chek kiritildi`);
    return inserted;
  }

  /**
   * Faktura tableiga ma'lumot qo'shish
   */
  async insertFaktura(data: FakturaData): Promise<void> {
    const query = `
            INSERT INTO faktura (mxik, ulchov, faktura_summa, faktura_miqdor)
            VALUES ($1, $2, $3, $4)
        `;

    await this.client!.query(query, [
      data.mxik,
      data.ulchov,
      data.faktura_summa,
      data.faktura_miqdor,
    ]);
  }

  /**
   * Ko'plab fakturalar qo'shish
   */
  async insertFakturas(fakturas: FakturaData[]): Promise<number> {
    let inserted = 0;

    for (const faktura of fakturas) {
      try {
        await this.insertFaktura(faktura);
        inserted++;
      } catch (error: any) {
        logger.warning(`⚠️ Faktura kiritilmadi: ${error.message}`);
      }
    }

    logger.info(`✅ ${inserted}/${fakturas.length} ta faktura kiritildi`);
    return inserted;
  }

  /**
   * Select_checks tableiga ma'lumot qo'shish
   */
  async insertSelectCheck(data: SelectCheckData): Promise<void> {
    const query = `
            INSERT INTO select_checks (
                mxik, ulchov, faktura_summa, faktura_miqdor,
                chek_raqam, maxsulot_nomi, chek_summa, miqdor,
                umumiy_chek_summa, bir_birlik
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `;

    await this.client!.query(query, [
      data.mxik,
      data.ulchov,
      data.faktura_summa,
      data.faktura_miqdor,
      data.chek_raqam,
      data.maxsulot_nomi,
      data.chek_summa,
      data.miqdor,
      data.umumiy_chek_summa,
      data.bir_birlik,
    ]);
  }

  /**
   * Statistikani olish
   */
  async getStatistics(): Promise<Statistics> {
    const result = await this.client!.query('SELECT * FROM statistics');
    return result.rows[0];
  }

  /**
   * Chekni processed qilish
   */
  async markCheckAsProcessed(chek_raqam: string): Promise<void> {
    await this.client!.query(
      'UPDATE checks SET processed = true WHERE chek_raqam = $1',
      [chek_raqam],
    );
  }

  /**
   * Barcha jadvallarni tozalash
   */
  async clearAllTables(): Promise<void> {
    logger.warning('🗑️ Barcha jadvallar tozalanmoqda...');

    await this.client!.query(
      'TRUNCATE TABLE select_checks, checks, faktura RESTART IDENTITY CASCADE',
    );

    logger.info('✅ Jadvallar tozalandi');
  }

  /**
   * Ulanishni yopish
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      this.client.release();
      this.client = null;
    }
    await this.pool.end();
    logger.info('🔌 Database ulanishi yopildi');
  }

  /**
   * Query bajarish
   */
  async query<T extends QueryResult = any>(
    sql: string,
    params?: any[],
  ): Promise<QueryResult<T>> {
    return this.pool.query<T>(sql, params);
  }
}
