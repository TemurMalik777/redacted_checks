import * as XLSX from 'xlsx';
import { logger } from '../automation/utils/logUtils';

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

export interface ExcelReadResult {
  checks: CheckData[];
  fakturas: FakturaData[];
}

/**
 * String yoki number ni Decimal (number) ga aylantiradi
 */
function parseNumber(value: any): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'number') {
    return value;
  }

  let str = String(value).trim();

  if (str === '') {
    return null;
  }

  // Bo'sh joylarni olib tashlash
  str = str.replace(/\u00A0/g, '');
  str = str.replace(/\s/g, '');

  // Vergul va nuqtani to'g'rilash
  if (str.includes(',') && !str.includes('.')) {
    str = str.replace(',', '.');
  } else {
    str = str.replace(/,/g, '');
  }

  try {
    const num = parseFloat(str);
    return isNaN(num) ? null : num;
  } catch (error) {
    return null;
  }
}

/**
 * Excel faylni o'qish va checks + fakturas qaytarish
 */
export function readExcel(filePath: string): ExcelReadResult {
  logger.info(`📂 Excel fayl o'qilmoqda: ${filePath}`);

  // Excel faylni o'qish
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  // JSON ga aylantirish
  const rawData = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: null,
  }) as any[][];

  if (rawData.length < 2) {
    logger.error('❌ Excel faylda ma\'lumot yo\'q');
    return { checks: [], fakturas: [] };
  }

  // Headerlarni olish va normalizatsiya qilish
  const headers = rawData[0].map((h: any) =>
    String(h || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_'),
  );

  logger.info(`📋 Topilgan ustunlar: ${headers.join(', ')}`);

  const expectedHeaders = [
    'chek_raqam',
    'chek_summa',
    'maxsulot_nomi',
    'mxik',
    'ulchov',
    'faktura_summa',
    'faktura_miqdor',
  ];

  // Indekslarni topish
  const getIndex = (name: string) => headers.indexOf(name);

  const checks: CheckData[] = [];
  const fakturas: FakturaData[] = [];

  let validCount = 0;
  let skipCount = 0;

  // Ma'lumotlarni o'qish (2-qatordan boshlab)
  for (let i = 1; i < rawData.length; i++) {
    const row = rawData[i];

    // Bo'sh qatorni o'tkazib yuborish
    if (!row || row.every((cell) => cell === null || cell === undefined)) {
      continue;
    }

    const chekRaqam = row[getIndex('chek_raqam')];
    const chekSummaRaw = row[getIndex('chek_summa')];
    const maxsulotNomi = row[getIndex('maxsulot_nomi')];
    const mxik = row[getIndex('mxik')];
    const ulchov = row[getIndex('ulchov')];
    const fakturaSummaRaw = row[getIndex('faktura_summa')];
    const fakturaMiqdorRaw = row[getIndex('faktura_miqdor')];

    // Chek raqam va summa majburiy
    if (!chekRaqam || !chekSummaRaw) {
      skipCount++;
      continue;
    }

    const chekSumma = parseNumber(chekSummaRaw);
    const fakturaSumma = parseNumber(fakturaSummaRaw);
    const fakturaMiqdor = parseNumber(fakturaMiqdorRaw);

    if (chekSumma === null) {
      skipCount++;
      continue;
    }

    // Check ma'lumotlarini qo'shish
    checks.push({
      chek_raqam: String(chekRaqam).trim(),
      chek_summa: chekSumma,
      maxsulot_nomi: maxsulotNomi ? String(maxsulotNomi).trim() : undefined,
    });

    // Faktura ma'lumotlarini qo'shish (duplicate bilan)
    if (mxik && ulchov && fakturaSumma !== null && fakturaMiqdor !== null) {
      fakturas.push({
        mxik: String(mxik).trim(),
        ulchov: String(ulchov).trim(),
        faktura_summa: fakturaSumma,
        faktura_miqdor: fakturaMiqdor,
      });
    }

    validCount++;
  }

  logger.info('📊 Excel fayldan:');
  logger.info(`  ✅ ${validCount} ta qator o'qildi`);
  logger.info(`  ⚠️  O'tkazib yuborildi: ${skipCount}`);
  logger.info(`  📦 ${checks.length} ta chek`);
  logger.info(`  📋 ${fakturas.length} ta faktura (duplicate bilan)`);

  return { checks, fakturas };
}