import { Page } from 'playwright';
import { logger } from '../utils/logUtils';
import { uploadZipModal } from './uploadZipModal';
import { CaptchaAction } from './captchaAction';
import { clickSaveButton } from './clickSaveCheck';

/**
 * Mahsulot ma'lumotlari interfeysi
 */
export interface CheckData {
  chek_raqam?: string;
  mahsulot_nomi?: string;
  maxsulot_nomi?: string;
  product_name?: string;
  Mahsulot?: string;
  Nomi?: string;
  miqdor?: number | string;
  amount?: number | string;
  Miqdor?: number | string;
  Миқдор?: number | string;
  mxik?: string;
  MXIK?: string;
  'МХИК коди'?: string;
  unit?: string;
  ulchov?: string;
  'Ўлчов бирлиги'?: string;
  bir_birlik?: number | string;
}

/**
 * String similarity calculator (Python'dagi SequenceMatcher)
 */
class SequenceMatcher {
  static ratio(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) {
      return 1.0;
    }

    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  private static levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1, // deletion
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }
}

/**
 * O'lchov birligini normalize qilish
 */
function normalizeUnitName(unitName: string | null | undefined): string {
  if (!unitName) return '';

  let text = String(unitName).trim().toLowerCase();

  // Kirill -> Lotin konversiya
  const cyrillicToLatin: Record<string, string> = {
    а: 'a',
    б: 'b',
    в: 'v',
    г: 'g',
    д: 'd',
    е: 'e',
    ё: 'e',
    ж: 'j',
    з: 'z',
    и: 'i',
    й: 'y',
    к: 'k',
    л: 'l',
    м: 'm',
    н: 'n',
    о: 'o',
    п: 'p',
    р: 'r',
    с: 's',
    т: 't',
    у: 'u',
    ф: 'f',
    х: 'x',
    ц: 'ts',
    ч: 'ch',
    ш: 'sh',
    щ: 'shch',
    ъ: '',
    ы: 'i',
    ь: '',
    э: 'e',
    ю: 'yu',
    я: 'ya',
    ў: 'o',
    қ: 'q',
    ғ: 'g',
    ҳ: 'h',
  };

  let result = '';
  for (const char of text) {
    result += cyrillicToLatin[char] || char;
  }

  // Qisqartmalar
  result = result
    .replace(/gramm/g, 'g')
    .replace(/gram/g, 'g')
    .replace(/milligram/g, 'mg')
    .replace(/milligr/g, 'mg')
    .replace(/kilogramm/g, 'kg')
    .replace(/kilogr/g, 'kg')
    .replace(/litr/g, 'l')
    .replace(/liter/g, 'l')
    .replace(/millilitr/g, 'ml')
    .replace(/milliliter/g, 'ml')
    .replace(/donasi/g, 'dona')
    .replace(/dona-dona/g, 'dona')
    .replace(/tabletka/g, 'tabl')
    .replace(/tablet/g, 'tabl')
    .replace(/kapsula/g, 'kaps')
    .replace(/capsule/g, 'kaps');

  // Bo'sh joylarni normalize qilish
  result = result.replace(/\s+/g, ' ').trim();

  // Maxsus belgilarni tozalash
  result = result.replace(/["`']/g, '');
  result = result.replace(/\( /g, '(').replace(/ \)/g, ')');

  return result;
}

/**
 * Mahsulot nomini normalize qilish
 */
function normalizeProductName(name: string | null | undefined): string {
  if (!name) return '';

  let text = String(name).trim().toLowerCase();

  // Kirill -> Lotin
  const cyrillicToLatin: Record<string, string> = {
    а: 'a',
    б: 'b',
    в: 'v',
    г: 'g',
    д: 'd',
    е: 'e',
    ё: 'e',
    ж: 'j',
    з: 'z',
    и: 'i',
    й: 'y',
    к: 'k',
    л: 'l',
    м: 'm',
    н: 'n',
    о: 'o',
    п: 'p',
    р: 'r',
    с: 's',
    т: 't',
    у: 'u',
    ф: 'f',
    х: 'x',
    ц: 'ts',
    ч: 'ch',
    ш: 'sh',
    щ: 'shch',
    ъ: '',
    ы: 'i',
    ь: '',
    э: 'e',
    ю: 'yu',
    я: 'ya',
    ў: 'o',
    қ: 'q',
    ғ: 'g',
    ҳ: 'h',
  };

  let result = '';
  for (const char of text) {
    result += cyrillicToLatin[char] || char;
  }

  return result.trim();
}

/**
 * Fuzzy matching - o'xshashlikni tekshirish
 */
function fuzzyMatchUnits(
  normalizedDb: string,
  normalizedWeb: string,
  threshold: number = 0.85,
): boolean {
  const similarity = SequenceMatcher.ratio(normalizedDb, normalizedWeb);
  return similarity >= threshold;
}

/**
 * Field Filler Action - Asosiy forma to'ldirish
 */
export class FieldFillerAction {
  constructor(private page: Page) {}

  /**
   * Asosiy funksiya - chekni to'ldirish va saqlash
   */
  async execute(data: CheckData, captchaApiKey?: string): Promise<boolean> {
    try {
      // Mahsulot nomini olish
      const productName =
        data.mahsulot_nomi ||
        data.maxsulot_nomi ||
        data.product_name ||
        data.Mahsulot ||
        data.Nomi;

      if (!productName) {
        logger.error('❌ Mahsulot nomi topilmadi!');
        return false;
      }

      const chekRaqam = data.chek_raqam
        ? String(data.chek_raqam).trim()
        : undefined;

      logger.info('\n' + '='.repeat(60));
      logger.info('📝 CHEK TAHRIRLASH BOSHLANDI');
      if (chekRaqam) {
        logger.info(`🔢 CHEK: ${chekRaqam}`);
      }
      logger.info(`📦 MAHSULOT: ${productName}`);
      logger.info('='.repeat(60) + '\n');

      // 1. Mahsulot qatorini topish
      const rowIndex = await this.findAndHighlightProductRow(productName);

      if (rowIndex === null) {
        logger.error('❌ Mahsulot qatori topilmadi!');
        return false;
      }

      await this.page.waitForTimeout(500);

      // 2. Ma'lumotlarni olish
      const amount = data.miqdor || data.amount || data.Miqdor || data.Миқдор;
      const mxikCode = data.mxik || data.MXIK || data['МХИК коди'];
      const unitName = data.unit || data.ulchov || data['Ўлчов бирлиги'];

      if (!amount || !mxikCode || !unitName) {
        logger.error("❌ Miqdor, MXIK yoki o'lchov birligi topilmadi!");
        logger.info(`   Miqdor: ${amount}`);
        logger.info(`   MXIK: ${mxikCode}`);
        logger.info(`   O'lchov: ${unitName}`);
        return false;
      }

      logger.info('\n' + '='.repeat(60));
      logger.info(`🔧 QATOR #${rowIndex} UCHUN MA'LUMOTLAR TO'LDIRISH`);
      logger.info('='.repeat(60));

      // 3. MIQDORNI O'ZGARTIRISH (MXIK dan oldin!)
      logger.info(`\n🔢 MIQDOR: ${amount}`);
      const amountOk = await this.setAmountForRow(rowIndex, String(amount));

      if (!amountOk) {
        logger.warn("⚠️ Miqdor o'zgartirilmadi, lekin davom etamiz...");
      }

      await this.page.waitForTimeout(300);

      // 4. MXIK tanlash
      logger.info(`\n📋 MXIK: ${mxikCode}`);
      const mxikOk = await this.selectMxikCodeForRow(
        rowIndex,
        String(mxikCode),
      );

      if (!mxikOk) {
        logger.error('❌ MXIK tanlanmadi!');
        return false;
      }

      await this.page.waitForTimeout(300);

      // 5. O'lchov birligi tanlash
      logger.info(`\n📏 O'lchov: ${unitName}`);
      const unitOk = await this.selectUnitNameForRow(
        rowIndex,
        String(unitName),
      );

      if (!unitOk) {
        logger.error("❌ O'lchov birligi tanlanmadi!");
        return false;
      }

      logger.info("\n✅ Barcha ma'lumotlar to'ldirildi!");

      // 6. ZIP fayl yuklash
      logger.info('\n📦 ZIP fayl yuklanmoqda...');
      await this.page.waitForTimeout(300);

      const zipOk = await uploadZipModal(this.page, 'C:\\lll_ha', 1);
      if (!zipOk) {
        logger.warn('⚠️ ZIP fayl yuklanmadi, davom etamiz...');
      }

      // 7. CAPTCHA yechish va DARHOL saqlash
      logger.info('\n🤖 Captcha yechish boshlandi...');
      await this.page.waitForTimeout(200);

      if (!captchaApiKey) {
        logger.error('❌ CAPTCHA API key berilmagan!');
        return false;
      }

      const captchaAction = new CaptchaAction({ apiKey: captchaApiKey });
      const captchaOk = await captchaAction.solveCaptcha(this.page);

      if (captchaOk) {
        logger.info('✅ Captcha yechildi, DARHOL saqlanyapti...');
        await this.page.waitForTimeout(100);

        // Saqlash tugmasini darhol bosish
        const saveOk = await clickSaveButton(
          this.page,
          chekRaqam,
          1,
          captchaApiKey,
        );

        if (saveOk) {
          logger.info('\n✅✅✅ CHEK MUVAFFAQIYATLI SAQLANDI! ✅✅✅');
          if (chekRaqam) {
            logger.info(`✅ Chek #${chekRaqam} - TAYYOR`);
          }
          await this.page.waitForTimeout(1000);
          return true;
        } else {
          logger.error('\n❌ Saqlashda muammo!');
          return false;
        }
      } else {
        logger.error('❌ Captcha yechishda xato!');
        return false;
      }
    } catch (error) {
      logger.error('\n❌ KRITIK XATO:', error);
      return false;
    }
  }

  /**
   * Mahsulot qatorini topish va highlight qilish
   */
  private async findAndHighlightProductRow(
    productName: string,
  ): Promise<number | null> {
    try {
      logger.info(`\n🔍 Qidirilayotgan mahsulot: '${productName}'`);

      // Mahsulot nomini normalize qilish
      const normalizedTarget = normalizeProductName(productName);

      // Barcha qatorlarni topish
      const rows = await this.page
        .locator("xpath=//tr[contains(@class, 'ant-table-row')]")
        .all();

      logger.info(`📊 Jami ${rows.length} ta qator mavjud`);

      let bestMatch: any = null;
      let bestSimilarity = 0;
      let bestIdx: number | null = null;

      // Har bir qatorni tekshirish
      for (let idx = 0; idx < rows.length; idx++) {
        try {
          const row = rows[idx];

          // 2-chi td ichidagi mahsulot nomini olish
          const nameCells = await row.locator('xpath=.//td[2]').all();
          if (nameCells.length === 0) continue;

          const rowProductName = await nameCells[0].textContent();
          if (!rowProductName) continue;

          const rowNameTrimmed = rowProductName.trim().toLowerCase();
          const normalizedRow = normalizeProductName(rowNameTrimmed);

          // 1. To'liq moslik
          if (normalizedRow === normalizedTarget) {
            bestMatch = row;
            bestIdx = idx;
            bestSimilarity = 1.0;
            break;
          }

          // 2. Qisman moslik
          let similarity = SequenceMatcher.ratio(
            normalizedTarget,
            normalizedRow,
          );

          // 3. Ichida mavjudligini tekshirish
          if (
            normalizedTarget.includes(normalizedRow) ||
            normalizedRow.includes(normalizedTarget)
          ) {
            similarity = Math.max(similarity, 0.9);
          }

          // 4. So'zlar bo'yicha moslik
          const targetWords = new Set(normalizedTarget.split(/\s+/));
          const rowWords = new Set(normalizedRow.split(/\s+/));
          const intersection = new Set(
            [...targetWords].filter((x) => rowWords.has(x)),
          );
          const wordMatch = intersection.size / Math.max(targetWords.size, 1);
          similarity = Math.max(similarity, wordMatch);

          if (similarity > bestSimilarity) {
            bestSimilarity = similarity;
            bestMatch = row;
            bestIdx = idx;
          }

          logger.info(
            `   ${idx + 1}. ${rowProductName.trim()} - moslik: ${(
              similarity * 100
            ).toFixed(0)}%`,
          );
        } catch {
          continue;
        }
      }

      // Eng yaxshi moslikni tanlash (kamida 70% moslik)
      if (bestMatch && bestSimilarity >= 0.7) {
        logger.info('');
        logger.info(
          `✅✅✅ TOPILDI! (Moslik: ${(bestSimilarity * 100).toFixed(
            0,
          )}%) ✅✅✅`,
        );
        logger.info(`📍 Qator #${bestIdx! + 1}`);
        logger.info('');

        // Qatorni ko'rinadigan qilish
        await bestMatch.scrollIntoViewIfNeeded();
        await this.page.waitForTimeout(500);

        // Qatorni highlight qilish
        await bestMatch.evaluate((el: HTMLElement) => {
          el.style.backgroundColor = '#fff3cd';
          el.style.border = '3px solid #ff6b00';
        });

        logger.info(
          `🎯 Qator #${bestIdx! + 1} belgilandi va highlight qilindi!`,
        );

        return bestIdx; // 0-indexed
      }

      // Topilmasa
      logger.error(
        `\n❌ '${productName}' mahsuloti topilmadi yoki moslik darajasi past!`,
      );
      return null;
    } catch (error) {
      logger.error('❌ Qator qidirishda xato:', error);
      return null;
    }
  }

  /**
   * Aniq qator uchun miqdorni o'zgartirish
   */
  private async setAmountForRow(
    rowIndex: number,
    amountValue: string,
  ): Promise<boolean> {
    try {
      logger.info(`🔢 Qator #${rowIndex} uchun miqdor: ${amountValue}`);

      // Aniq qator uchun input topish
      const amountInputXpath = `//input[@name='restore.${rowIndex}.amount']`;
      const amountInput = this.page
        .locator(`xpath=${amountInputXpath}`)
        .first();

      await amountInput.waitFor({ state: 'visible', timeout: 10000 });

      // JavaScript orqali tez o'zgartirish
      await amountInput.evaluate((el: HTMLInputElement, value: string) => {
        el.scrollIntoView({ block: 'center' });
        el.focus();
        el.select();
        el.value = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.blur();
      }, amountValue);

      logger.info(`✅ Miqdor o'zgartirildi: ${amountValue}`);
      return true;
    } catch (error) {
      logger.error(`❌ Miqdor o'zgartirishda xato:`, error);
      return false;
    }
  }

  /**
   * Aniq qator uchun MXIK kodini tanlash
   */
  private async selectMxikCodeForRow(
    rowIndex: number,
    mxikValue: string,
  ): Promise<boolean> {
    try {
      logger.info(`🔄 Qator #${rowIndex} uchun MXIK tanlash boshlandi...`);

      // Aniq qator uchun select topish
      const selectXpath = `//div[contains(@class,'ant-select') and @name='restore.${rowIndex}.productCode']`;
      const mxikSelect = this.page.locator(`xpath=${selectXpath}`).first();

      await mxikSelect.waitFor({ state: 'visible', timeout: 12000 });

      // Selectni ochish
      await mxikSelect.scrollIntoViewIfNeeded();
      await this.page.waitForTimeout(300);

      await mxikSelect.evaluate((el) => (el as HTMLElement).click());
      logger.info(`📂 Qator #${rowIndex} MXIK dropdown ochildi`);
      await this.page.waitForTimeout(500);

      // Input topish
      const inputXpath = `${selectXpath}//input[contains(@class,'ant-select-selection-search-input')]`;
      const inputBox = this.page.locator(`xpath=${inputXpath}`).first();

      await inputBox.waitFor({ state: 'visible', timeout: 3000 });
      await inputBox.focus();
      await this.page.waitForTimeout(200);

      // Qiymat yozish
      await inputBox.evaluate((el: HTMLInputElement) => {
        el.value = '';
      });
      await this.page.waitForTimeout(200);

      const mxikStr = String(mxikValue).trim();
      await inputBox.type(mxikStr);
      logger.info(`⌨️ MXIK yozildi: ${mxikStr}`);

      await this.page.waitForTimeout(800);

      // Dropdown topish
      const dropdown = await this.findVisibleDropdown();

      if (!dropdown) {
        logger.error('❌ Dropdown topilmadi');
        return false;
      }

      logger.info('✅ Dropdown topildi');

      // Variantlarni topish
      const options = await dropdown
        .locator('.//div[contains(@class,"ant-select-item-option-content")]')
        .all();

      logger.info(`📋 ${options.length} ta variant topildi`);

      if (options.length === 0) {
        logger.error('❌ MXIK variantlari topilmadi');
        return false;
      }

      // To'g'ri variantni topish
      let matched: any = null;
      let matchedText = '';

      for (const opt of options) {
        try {
          const optText = await opt.textContent();
          if (!optText) continue;

          const trimmed = optText.trim();

          // To'liq moslik
          if (trimmed === mxikStr || trimmed.startsWith(mxikStr + ' ')) {
            matched = opt;
            matchedText = trimmed;
            logger.info(`✅ TO'LIQ MOS: ${trimmed}`);
            break;
          }

          // Ichida mavjud
          if (trimmed.includes(mxikStr)) {
            if (!matched) {
              matched = opt;
              matchedText = trimmed;
            }
          }
        } catch {
          continue;
        }
      }

      // Agar topilmasa - birinchi variant
      if (!matched && options.length > 0) {
        matched = options[0];
        matchedText = (await matched.textContent()) || '';
        logger.warn('⚠️ Mos kelish topilmadi, birinchi variant tanlanadi');
      }

      if (!matched) {
        logger.error('❌ Hech qanday MXIK varianti tanlanmadi');
        return false;
      }

      // Variantni tanlash
      logger.info('🎯 Tanlanyapti...');

      await matched.scrollIntoViewIfNeeded();
      await this.page.waitForTimeout(300);

      await matched.evaluate((el: HTMLElement) => el.click());
      logger.info('✅ MXIK tanlandi!');

      await this.page.waitForTimeout(500);

      return true;
    } catch (error) {
      logger.error('❌ MXIK xatosi:', error);

      // Screenshot
      try {
        await this.page.screenshot({
          path: `screenshots/mxik_error_${Date.now()}.png`,
        });
      } catch {
        // Ignore
      }

      return false;
    }
  }

  /**
   * Aniq qator uchun o'lchov birligini tanlash (Virtual scroll bilan!)
   */
  private async selectUnitNameForRow(
    rowIndex: number,
    unitValue: string,
  ): Promise<boolean> {
    try {
      logger.info(`🔄 Qator #${rowIndex} uchun o'lchov birligi tanlash...`);

      // Select topish
      const selectXpath = `//div[contains(@class,'ant-select') and @name='restore.${rowIndex}.unitName']`;
      const unitSelect = this.page.locator(`xpath=${selectXpath}`).first();

      await unitSelect.waitFor({ state: 'visible', timeout: 12000 });
      await unitSelect.scrollIntoViewIfNeeded();

      // Selectni ochish
      try {
        await unitSelect.click();
      } catch {
        await unitSelect.evaluate((el) => (el as HTMLElement).click());
      }

      logger.info(`📂 Qator #${rowIndex} o'lchov dropdown ochildi`);
      await this.page.waitForTimeout(500);

      // Target normalizatsiya
      const target = normalizeUnitName(unitValue);
      logger.info(`🎯 Target: '${target}'`);

      // Dropdown topish
      const dropdown = await this.findVisibleDropdown();
      if (!dropdown) {
        logger.error('❌ Dropdown topilmadi');
        return false;
      }

      // Scroll area topish
      let scrollArea = null;
      try {
        scrollArea = await dropdown.locator('.rc-virtual-list-holder').first();
        await scrollArea.waitFor({ state: 'attached', timeout: 2000 });
      } catch {
        try {
          scrollArea = await dropdown.locator('.rc-virtual-list').first();
        } catch {
          scrollArea = dropdown;
        }
      }

      // Virtual scroll bilan qidirish
      const uniqueSet = new Set<string>();
      let noChangeRounds = 0;
      let bestMatch: { element: any; text: string; similarity: number } | null =
        null;

      while (true) {
        // Hozirgi variantlarni tekshirish
        const options = await dropdown
          .locator('.//div[contains(@class,"ant-select-item-option-content")]')
          .all();

        for (const opt of options) {
          try {
            const webText = ((await opt.textContent()) || '').trim();
            if (!webText || uniqueSet.has(webText)) continue;

            uniqueSet.add(webText);

            const normalizedWeb = normalizeUnitName(webText);

            // To'liq moslik
            if (normalizedWeb === target) {
              logger.info(`✅ TOPILDI: '${webText}'`);

              await opt.scrollIntoViewIfNeeded();
              await this.page.waitForTimeout(180);

              try {
                await opt.click();
              } catch {
                await opt.evaluate((el: HTMLElement) => el.click());
              }

              return true;
            }

            // Fuzzy match
            const similarity = SequenceMatcher.ratio(target, normalizedWeb);
            if (!bestMatch || similarity > bestMatch.similarity) {
              bestMatch = { element: opt, text: webText, similarity };
            }
          } catch {
            continue;
          }
        }

        // Scroll qilish
        const beforeScroll = await scrollArea.evaluate(
          (el: any) => el.scrollTop,
        );

        await scrollArea.evaluate((el: any) => {
          el.scrollTop += 300;
        });

        await this.page.waitForTimeout(450);

        const afterScroll = await scrollArea.evaluate(
          (el: any) => el.scrollTop,
        );

        if (afterScroll === beforeScroll) {
          noChangeRounds++;
        } else {
          noChangeRounds = 0;
        }

        // Chiqish shartlari
        if (noChangeRounds >= 20 || uniqueSet.size > 5000) {
          break;
        }
      }

      // Fuzzy match (85% va undan yuqori)
      if (bestMatch && bestMatch.similarity >= 0.85) {
        logger.info(
          `⚡ FUZZY MATCH: '${bestMatch.text}' (${(
            bestMatch.similarity * 100
          ).toFixed(0)}%)`,
        );

        await bestMatch.element.scrollIntoViewIfNeeded();
        await this.page.waitForTimeout(180);

        try {
          await bestMatch.element.click();
        } catch {
          await bestMatch.element.evaluate((el: HTMLElement) => el.click());
        }

        return true;
      }

      logger.error(`❌ TOPILMADI: '${unitValue}'`);
      return false;
    } catch (error) {
      logger.error("❌ O'lchov birligi xatosi:", error);
      return false;
    }
  }

  /**
   * Ko'rinuvchi dropdownni topish
   */
  private async findVisibleDropdown(): Promise<any | null> {
    const dropdownXpath =
      "//div[contains(@class,'ant-select-dropdown') and not(contains(@class,'ant-select-dropdown-hidden'))]";

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const dropdowns = await this.page
          .locator(`xpath=${dropdownXpath}`)
          .all();

        for (const dd of dropdowns) {
          try {
            const isVisible = await dd.isVisible();
            if (isVisible) {
              return dd;
            }
          } catch {
            continue;
          }
        }

        await this.page.waitForTimeout(300);
      } catch {
        await this.page.waitForTimeout(300);
      }
    }

    return null;
  }
}

/**
 * Tez funksiya - chekni to'ldirish
 */
export async function fillEditCheckFields(
  page: Page,
  data: CheckData,
  captchaApiKey: string,
): Promise<boolean> {
  const action = new FieldFillerAction(page);
  return action.execute(data, captchaApiKey);
}
