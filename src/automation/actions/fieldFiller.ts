import { Page, Locator } from 'playwright';
import { logger } from '../utils/logUtils';

/**
 * CheckData interface - Database'dan keladigan ma'lumotlar
 */
export interface CheckData {
  chek_raqam?: string | number;
  maxsulot_nomi?: string;
  product_name?: string;
  mxik?: string;
  mxik_code?: string;
  ulchov?: string;
  unit?: string;
  miqdor?: string | number;
  amount?: string | number;
  chek_summa?: string | number;
  summa?: string | number;
  bir_birlik?: string | number;
  price?: string | number;
}

/**
 * Kirill-Lotin konversiya mapping
 */
const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e',
  ж: 'j', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm',
  н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', 
  ф: 'f', х: 'x', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch', 
  ъ: '', ы: 'i',ь: '', э: 'e', ю: 'yu', я: 'ya',
  // Bosh harflar
  А: 'A', Б: 'B', В: 'V', Г: 'G', Д: 'D', Е: 'E',
  Ё: 'E', Ж: 'J', З: 'Z', И: 'I', Й: 'Y', К: 'K',
  Л: 'L', М: 'M', Н: 'N', О: 'O', П: 'P', Р: 'R',
  С: 'S', Т: 'T', У: 'U', Ф: 'F', Х: 'X', Ц: 'Ts',
  Ч: 'Ch', Ш: 'Sh', Щ: 'Shch', Ъ: '', Ы: 'I', Ь: '',
  Э: 'E', Ю: 'Yu', Я: 'Ya',
};

/**
 * O'lchov birlik normalizatsiya mapping
 */
const UNIT_MAPPINGS: Record<string, string[]> = {
  штука: ['шт', 'штук', 'штука', 'dona', 'дона', 'piece', 'pcs'],
  килограмм: ['кг', 'kg', 'килограмм', 'kilogram', 'кило'],
  литр: ['л', 'lt', 'litr', 'литр', 'liter'],
  метр: ['м', 'm', 'metr', 'метр', 'meter'],
  упаковка: ['уп', 'упак', 'упаковка', 'qadoq', 'package', 'pack'],
  комплект: ['компл', 'комплект', 'komplekt', 'set'],
  грамм: ['г', 'гр', 'gr', 'gram', 'грамм'],
};

/**
 * Matnni normalize qilish (kirill -> lotin)
 */
function normalizeText(text: string): string {
  if (!text) return '';

  let result = text.toLowerCase().trim();

  // Kirill harflarni lotinga o'zgartirish
  for (const [cyrillic, latin] of Object.entries(CYRILLIC_TO_LATIN)) {
    result = result.replace(
      new RegExp(cyrillic.toLowerCase(), 'g'),
      latin.toLowerCase(),
    );
  }

  // Ortiqcha bo'shliqlarni olib tashlash
  result = result.replace(/\s+/g, ' ');

  return result;
}

/**
 * O'lchov birlikni normalize qilish
 */
function normalizeUnit(unit: string): string {
  if (!unit) return '';

  const normalized = normalizeText(unit);

  // Mapping orqali standart nomga o'zgartirish
  for (const [standard, variants] of Object.entries(UNIT_MAPPINGS)) {
    if (variants.some((v) => normalized.includes(normalizeText(v)))) {
      return standard;
    }
  }

  return normalized;
}

/**
 * Fuzzy match - ikki matnni solishtirish (0-1 oralig'ida)
 */
function fuzzyMatch(str1: string, str2: string): number {
  const s1 = normalizeText(str1);
  const s2 = normalizeText(str2);

  if (s1 === s2) return 1;
  if (!s1 || !s2) return 0;

  // To'liq mos kelish
  if (s1.includes(s2) || s2.includes(s1)) {
    return 0.9;
  }

  // Levenshtein distance
  const len1 = s1.length;
  const len2 = s2.length;

  const matrix: number[][] = [];

  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }

  const distance = matrix[len1][len2];
  const maxLen = Math.max(len1, len2);

  return 1 - distance / maxLen;
}

/**
 * Modal ichida qatorlarni qidirish va mahsulot nomiga mos qatorni topish
 */
async function findProductRow(
  page: Page,
  productName: string,
  timeout: number = 10000,
): Promise<{ rowIndex: number; rowElement: Locator } | null> {
  try {
    logger.info(`\n🔍 Mahsulot qidirilmoqda: '${productName}'`);

    const targetName = normalizeText(productName);

    // Barcha qatorlarni topish
    const rows = page.locator('tr.ant-table-row');
    const rowCount = await rows.count();

    logger.info(`📊 Jami ${rowCount} ta qator mavjud`);

    if (rowCount === 0) {
      logger.warn('⚠️ Jadvalda qatorlar topilmadi');
      return null;
    }

    let bestMatch: {
      rowIndex: number;
      rowElement: Locator;
      similarity: number;
    } | null = null;

    // Har bir qatorni tekshirish
    for (let idx = 0; idx < rowCount; idx++) {
      try {
        const row = rows.nth(idx);

        // 2-chi td ichidagi mahsulot nomini olish
        const nameCell = row.locator('td:nth-child(2)');
        const cellText = await nameCell.textContent();

        if (!cellText) continue;

        const rowProductName = normalizeText(cellText);

        logger.info(`   ${idx + 1}. Tekshirilmoqda: '${cellText.trim()}'`);

        // Moslik darajasini hisoblash
        const similarity = fuzzyMatch(targetName, rowProductName);

        if (similarity > 0.7) {
          // 70% dan yuqori moslik
          if (!bestMatch || similarity > bestMatch.similarity) {
            bestMatch = { rowIndex: idx, rowElement: row, similarity };
          }
        }

        // To'liq mos kelsa, darhol qaytarish
        if (similarity >= 0.95) {
          logger.info(
            `✅✅✅ TOPILDI! Qator #${idx + 1}: '${cellText.trim()}'`,
          );
          logger.info(`🎯 Moslik darajasi: ${(similarity * 100).toFixed(1)}%`);

          // Qatorni ko'rinadigan qilish
          await row.scrollIntoViewIfNeeded();
          await page.waitForTimeout(300);

          // Qatorni highlight qilish
          await row.evaluate((el) => {
            (el as HTMLElement).style.backgroundColor = '#fff3cd';
            (el as HTMLElement).style.border = '3px solid #ff6b00';
          });

          return { rowIndex: idx, rowElement: row };
        }
      } catch (error) {
        continue;
      }
    }

    // Eng yaxshi moslikni qaytarish
    if (bestMatch) {
      logger.info(`✅ Eng yaxshi moslik: Qator #${bestMatch.rowIndex + 1}`);
      logger.info(
        `🎯 Moslik darajasi: ${(bestMatch.similarity * 100).toFixed(1)}%`,
      );

      await bestMatch.rowElement.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);

      await bestMatch.rowElement.evaluate((el) => {
        (el as HTMLElement).style.backgroundColor = '#fff3cd';
        (el as HTMLElement).style.border = '3px solid #ff6b00';
      });

      return { rowIndex: bestMatch.rowIndex, rowElement: bestMatch.rowElement };
    }

    logger.error(`❌ '${productName}' mahsuloti topilmadi!`);
    return null;
  } catch (error) {
    logger.error('❌ Qator qidirishda xato:', error);
    return null;
  }
}

/**
 * Input maydoniga qiymat kiritish (React uchun)
 */
async function setInputValue(
  page: Page,
  selector: string,
  value: string | number,
  fieldName: string,
): Promise<boolean> {
  try {
    const input = page.locator(selector).first();
    const count = await input.count();

    if (count === 0) {
      logger.warn(`⚠️ ${fieldName} input topilmadi: ${selector}`);
      return false;
    }

    // Avvalgi qiymatni tozalash
    await input.clear();
    await page.waitForTimeout(200);

    // Yangi qiymat kiritish (React uchun)
    await input.evaluate((el: HTMLInputElement, newValue: string) => {
      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value',
      )?.set;

      if (nativeSetter) {
        nativeSetter.call(el, newValue);
      } else {
        el.value = newValue;
      }

      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, String(value));

    await page.waitForTimeout(300);

    // Tekshirish
    const currentValue = await input.inputValue();
    if (currentValue === String(value)) {
      logger.info(`✅ ${fieldName} = ${value}`);
      return true;
    }

    // Qayta urinish - oddiy fill bilan
    await input.fill(String(value));
    await page.waitForTimeout(200);

    logger.info(`✅ ${fieldName} = ${value} (retry)`);
    return true;
  } catch (error) {
    logger.error(`❌ ${fieldName} kiritishda xato:`, error);
    return false;
  }
}

/**
 * Summa va Miqdor maydonlarini to'ldirish
 * KETMA-KETLIK: 1) Summa 2) Miqdor
 */
async function fillQuantityAndAmount(
  page: Page,
  rowIndex: number,
  data: CheckData,
): Promise<boolean> {
  try {
    logger.info("\n📝 Summa va Miqdor to'ldirilmoqda...");

    // 1️⃣ SUMMA (chek_summa/summa/price/bir_birlik) - AVVAL
    const summa =
      data.chek_summa || data.summa || data.price || data.bir_birlik;
    if (summa) {
      const summaSelectors = [
        `input[name="restore.${rowIndex}.price"]`,
        `input[name="restore[${rowIndex}].price"]`,
        `tr.ant-table-row:nth-child(${rowIndex + 1}) input[name*="price"]`,
      ];

      for (const selector of summaSelectors) {
        const filled = await setInputValue(page, selector, summa, 'Summa');
        if (filled) break;
      }
    }

    // 2️⃣ MIQDOR (amount/miqdor) - KEYIN
    const miqdor = data.miqdor || data.amount;
    if (miqdor) {
      // Qator uchun miqdor input
      const miqdorSelectors = [
        `input[name="restore.${rowIndex}.amount"]`,
        `input[name="restore[${rowIndex}].amount"]`,
        `tr.ant-table-row:nth-child(${rowIndex + 1}) input[name*="amount"]`,
      ];

      for (const selector of miqdorSelectors) {
        const filled = await setInputValue(page, selector, miqdor, 'Miqdor');
        if (filled) break;
      }
    }

    return true;
  } catch (error) {
    logger.error("❌ Summa/Miqdor to'ldirishda xato:", error);
    return false;
  }
}

/**
 * MXIK kodni tanlash (dropdown)
 */
async function selectMXIK(
  page: Page,
  rowIndex: number,
  mxikCode: string,
): Promise<boolean> {
  try {
    logger.info(`\n📦 MXIK kod tanlanmoqda: ${mxikCode}`);

    // MXIK input/select ni topish
    const mxikSelectors = [
      `input[name="restore.${rowIndex}.productCode"]`,
      `input[name="restore[${rowIndex}].productCode"]`,
      `.ant-select-selection-search-input[id*="productCode"]`,
      `tr.ant-table-row:nth-child(${rowIndex + 1}) .ant-select`,
    ];

    let mxikInput: Locator | null = null;

    for (const selector of mxikSelectors) {
      const element = page.locator(selector).first();
      const count = await element.count();

      if (count > 0) {
        mxikInput = element;
        logger.info(`✅ MXIK input topildi: ${selector}`);
        break;
      }
    }

    if (!mxikInput) {
      // Alternativ - birinchi qator ichidagi select
      mxikInput = page
        .locator(
          `tr.ant-table-row:nth-child(${
            rowIndex + 1
          }) td:nth-child(3) .ant-select`,
        )
        .first();
      const count = await mxikInput.count();

      if (count === 0) {
        logger.error('❌ MXIK input topilmadi');
        return false;
      }
    }

    // Dropdown ochish uchun bosish
    await mxikInput.click();
    await page.waitForTimeout(500);

    // MXIK kodni kiritish
    await page.keyboard.type(mxikCode, { delay: 50 });
    await page.waitForTimeout(1000);

    // Dropdown'dan tanlash
    const dropdownOption = page
      .locator(`.ant-select-dropdown .ant-select-item:has-text("${mxikCode}")`)
      .first();
    const optionCount = await dropdownOption.count();

    if (optionCount > 0) {
      await dropdownOption.click();
      logger.info(`✅ MXIK kod tanlandi: ${mxikCode}`);
      await page.waitForTimeout(500);
      return true;
    }

    // Alternativ - birinchi variantni tanlash
    const firstOption = page
      .locator('.ant-select-dropdown .ant-select-item')
      .first();
    const firstOptionCount = await firstOption.count();

    if (firstOptionCount > 0) {
      await firstOption.click();
      logger.info(`✅ MXIK kod tanlandi (birinchi variant)`);
      await page.waitForTimeout(500);
      return true;
    }

    // Enter bosish
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    logger.info(`✅ MXIK kod kiritildi: ${mxikCode}`);
    return true;
  } catch (error) {
    logger.error('❌ MXIK tanlashda xato:', error);
    return false;
  }
}

/**
 * O'lchov birlikni tanlash
 */
async function selectUnit(
  page: Page,
  rowIndex: number,
  unitName: string,
): Promise<boolean> {
  try {
    logger.info(`\n📏 O'lchov birligi tanlanmoqda: ${unitName}`);

    const normalizedUnit = normalizeUnit(unitName);

    // O'lchov birlik select ni topish
    const unitSelectors = [
      `select[name="restore.${rowIndex}.unitId"]`,
      `select[name="restore[${rowIndex}].unitId"]`,
      `tr.ant-table-row:nth-child(${rowIndex + 1}) select[name*="unit"]`,
      `tr.ant-table-row:nth-child(${rowIndex + 1}) td:nth-child(4) select`,
    ];

    let unitSelect: Locator | null = null;

    for (const selector of unitSelectors) {
      const element = page.locator(selector).first();
      const count = await element.count();

      if (count > 0) {
        unitSelect = element;
        logger.info(`✅ O'lchov birligi select topildi: ${selector}`);
        break;
      }
    }

    if (!unitSelect) {
      // Ant Design Select bo'lishi mumkin
      unitSelect = page
        .locator(`tr.ant-table-row:nth-child(${rowIndex + 1}) .ant-select`)
        .last();
      const count = await unitSelect.count();

      if (count === 0) {
        logger.warn("⚠️ O'lchov birligi select topilmadi");
        return false;
      }
    }

    // Native select bo'lsa
    const tagName = await unitSelect.evaluate((el) => el.tagName.toLowerCase());

    if (tagName === 'select') {
      // Option larni olish
      const options = unitSelect.locator('option');
      const optionCount = await options.count();

      for (let i = 0; i < optionCount; i++) {
        const option = options.nth(i);
        const optionText = await option.textContent();

        if (
          optionText &&
          fuzzyMatch(normalizedUnit, normalizeText(optionText)) > 0.7
        ) {
          const optionValue = await option.getAttribute('value');
          await unitSelect.selectOption({ value: optionValue || '' });
          logger.info(`✅ O'lchov birligi tanlandi: ${optionText}`);
          return true;
        }
      }

      // Topilmasa birinchisini tanlash
      await unitSelect.selectOption({ index: 1 });
      logger.info("✅ O'lchov birligi tanlandi (default)");
      return true;
    }

    // Ant Design Select
    await unitSelect.click();
    await page.waitForTimeout(500);

    // Dropdown'dan qidirish
    const dropdownOptions = page.locator(
      '.ant-select-dropdown .ant-select-item',
    );
    const dropdownCount = await dropdownOptions.count();

    for (let i = 0; i < dropdownCount; i++) {
      const option = dropdownOptions.nth(i);
      const optionText = await option.textContent();

      if (
        optionText &&
        fuzzyMatch(normalizedUnit, normalizeText(optionText)) > 0.6
      ) {
        await option.click();
        logger.info(`✅ O'lchov birligi tanlandi: ${optionText}`);
        await page.waitForTimeout(300);
        return true;
      }
    }

    // Topilmasa birinchisini tanlash
    if (dropdownCount > 0) {
      await dropdownOptions.first().click();
      logger.info("✅ O'lchov birligi tanlandi (first option)");
      return true;
    }

    await page.keyboard.press('Escape');
    return false;
  } catch (error) {
    logger.error("❌ O'lchov birligi tanlashda xato:", error);
    return false;
  }
}

/**
 * Modalni chapdan o'ngga scroll qilish
 */
async function scrollModalHorizontally(page: Page): Promise<void> {
  try {
    logger.info("📜 Modal chapdan o'ngga scroll qilinmoqda...");

    // Modal body ni topish
    const modalBody = page.locator('.ant-modal-body').first();
    const count = await modalBody.count();

    if (count > 0) {
      // Scroll qilish
      await modalBody.evaluate((el) => {
        el.scrollLeft = el.scrollWidth;
      });

      await page.waitForTimeout(500);
      logger.info('✅ Modal scroll qilindi');
    }

    // Alternativ - table container
    const tableContainer = page.locator('.ant-table-body').first();
    const tableCount = await tableContainer.count();

    if (tableCount > 0) {
      await tableContainer.evaluate((el) => {
        el.scrollLeft = el.scrollWidth;
      });

      await page.waitForTimeout(500);
    }
  } catch (error) {
    logger.warn('⚠️ Modal scroll qilishda xato:', error);
  }
}

/**
 * ZIP fayl yuklash
 */
async function uploadZipFile(
  page: Page,
  zipFolderPath: string = 'C:\\lll_ha',
): Promise<boolean> {
  try {
    logger.info('\n📦 ZIP fayl yuklanmoqda...');

    // Upload input ni topish
    const uploadInputSelectors = [
      'input[type="file"]',
      '.ant-upload input[type="file"]',
      'input[accept=".zip"]',
      'input[accept="application/zip"]',
    ];

    let uploadInput: Locator | null = null;

    for (const selector of uploadInputSelectors) {
      const element = page.locator(selector).first();
      const count = await element.count();

      if (count > 0) {
        uploadInput = element;
        logger.info(`✅ Upload input topildi: ${selector}`);
        break;
      }
    }

    if (!uploadInput) {
      logger.warn('⚠️ Upload input topilmadi');
      return false;
    }

    // ZIP faylni topish (birinchi topilgan)
    // Node.js da fs moduli kerak, bu yerda path ni to'g'ridan-to'g'ri ishlatamiz
    const zipPath = `${zipFolderPath}\\file.zip`;

    // Fayl yuklash
    await uploadInput.setInputFiles(zipPath);

    await page.waitForTimeout(2000);

    // Yuklash muvaffaqiyatligini tekshirish
    const successMessage = page.locator(
      '.ant-message-success, .ant-upload-list-item-done',
    );
    const successCount = await successMessage.count();

    if (successCount > 0) {
      logger.info('✅ ZIP fayl muvaffaqiyatli yuklandi');
      return true;
    }

    logger.info('✅ ZIP fayl yuklandi (tekshiruvsiz)');
    return true;
  } catch (error) {
    logger.error('❌ ZIP yuklashda xato:', error);
    return false;
  }
}

/**
 * CAPTCHA yechish (2Captcha API orqali)
 */
async function solveCaptcha(page: Page, apiKey: string): Promise<boolean> {
  try {
    logger.info('\n🤖 CAPTCHA yechish boshlandi...');

    // CAPTCHA rasmini topish
    const captchaImageSelectors = [
      'img[src*="captcha"]',
      '.captcha-image img',
      'img[alt*="captcha" i]',
      '.ant-modal img[src*="base64"]',
    ];

    let captchaImage: Locator | null = null;

    for (const selector of captchaImageSelectors) {
      const element = page.locator(selector).first();
      const count = await element.count();

      if (count > 0) {
        captchaImage = element;
        logger.info(`✅ CAPTCHA rasmi topildi: ${selector}`);
        break;
      }
    }

    if (!captchaImage) {
      logger.warn('⚠️ CAPTCHA rasmi topilmadi');
      return false;
    }

    // Rasmni base64 formatda olish
    const imageSrc = await captchaImage.getAttribute('src');

    if (!imageSrc) {
      logger.error('❌ CAPTCHA rasm manzili topilmadi');
      return false;
    }

    let base64Image: string;

    if (imageSrc.startsWith('data:image')) {
      // Allaqachon base64
      base64Image = imageSrc.split(',')[1];
    } else {
      // URL dan yuklab olish kerak
      const imageBuffer = await page.evaluate(async (src: string) => {
        const response = await fetch(src);
        const blob = await response.blob();
        return new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      }, imageSrc);

      base64Image = imageBuffer.split(',')[1];
    }

    // 2Captcha API ga yuborish
    logger.info('📤 CAPTCHA 2Captcha API ga yuborilmoqda...');

    // API request (fetch orqali)
    const createTaskResponse = await page.evaluate(
      async ({
        apiKey,
        base64Image,
      }: {
        apiKey: string;
        base64Image: string;
      }) => {
        const response = await fetch('https://2captcha.com/in.php', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            key: apiKey,
            method: 'base64',
            body: base64Image,
            json: '1',
          }),
        });

        return response.json();
      },
      { apiKey, base64Image },
    );

    if (createTaskResponse.status !== 1) {
      logger.error(`❌ 2Captcha xato: ${createTaskResponse.request}`);
      return false;
    }

    const taskId = createTaskResponse.request;
    logger.info(`📋 Task ID: ${taskId}`);

    // Natijani kutish (polling)
    let captchaText = '';
    const maxAttempts = 30; // 30 * 2 = 60 sekund

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await page.waitForTimeout(2000);

      const resultResponse = await page.evaluate(
        async ({ apiKey, taskId }: { apiKey: string; taskId: string }) => {
          const response = await fetch(
            `https://2captcha.com/res.php?key=${apiKey}&action=get&id=${taskId}&json=1`,
          );
          return response.json();
        },
        { apiKey, taskId },
      );

      if (resultResponse.status === 1) {
        captchaText = resultResponse.request;
        break;
      }

      if (resultResponse.request !== 'CAPCHA_NOT_READY') {
        logger.error(`❌ 2Captcha xato: ${resultResponse.request}`);
        return false;
      }

      logger.info(`⏳ CAPTCHA yechilmoqda... (${attempt + 1}/${maxAttempts})`);
    }

    if (!captchaText) {
      logger.error('❌ CAPTCHA yechilmadi (timeout)');
      return false;
    }

    logger.info(`✅ CAPTCHA yechildi: ${captchaText}`);

    // CAPTCHA inputiga kiritish
    const captchaInputSelectors = [
      'input[name="captcha"]',
      'input[placeholder*="captcha" i]',
      'input[placeholder*="код" i]',
      '.captcha-input input',
    ];

    for (const selector of captchaInputSelectors) {
      const input = page.locator(selector).first();
      const count = await input.count();

      if (count > 0) {
        await input.fill(captchaText);
        logger.info('✅ CAPTCHA kiritildi');
        await page.waitForTimeout(500);
        return true;
      }
    }

    logger.error('❌ CAPTCHA input topilmadi');
    return false;
  } catch (error) {
    logger.error('❌ CAPTCHA yechishda xato:', error);
    return false;
  }
}

/**
 * Saqlash tugmasini bosish
 */
async function clickSaveButton(
  page: Page,
  maxRetries: number = 3,
): Promise<boolean> {
  try {
    logger.info('\n💾 Saqlash tugmasi bosilmoqda...');

    const saveButtonXpaths = [
      "//button[contains(.,'Сақлаш')]",
      "//button[contains(.,'Saqlash')]",
      "//button[contains(.,'Сохранить')]",
      "//button[contains(.,'Save')]",
      "//button[@type='submit']",
      '.ant-modal-footer button.ant-btn-primary',
    ];

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      logger.info(`🔄 Urinish ${attempt}/${maxRetries}...`);

      for (const xpath of saveButtonXpaths) {
        try {
          let button: Locator;

          if (xpath.startsWith('//')) {
            button = page.locator(`xpath=${xpath}`).first();
          } else {
            button = page.locator(xpath).first();
          }

          const count = await button.count();

          if (count > 0) {
            const isVisible = await button.isVisible({ timeout: 2000 });

            if (isVisible) {
              // JavaScript orqali bosish
              await button.evaluate((el) => (el as HTMLElement).click());

              logger.info('✅ Saqlash tugmasi bosildi');

              // Yuklanish indikatorini kutish
              await page.waitForTimeout(2000);

              // Muvaffaqiyat xabarini tekshirish
              const successMessage = page.locator(
                '.ant-message-success, .ant-notification-success',
              );
              const successCount = await successMessage.count();

              if (successCount > 0) {
                logger.info("✅✅✅ Ma'lumotlar muvaffaqiyatli saqlandi!");
                return true;
              }

              // Modal yopilganligini tekshirish
              await page.waitForTimeout(1000);
              const modalCount = await page.locator('.ant-modal-root').count();

              if (modalCount === 0) {
                logger.info('✅ Modal yopildi - saqlash muvaffaqiyatli');
                return true;
              }

              return true;
            }
          }
        } catch {
          continue;
        }
      }

      await page.waitForTimeout(1000);
    }

    logger.error('❌ Saqlash tugmasi topilmadi yoki bosilmadi');
    return false;
  } catch (error) {
    logger.error('❌ Saqlash tugmasini bosishda xato:', error);
    return false;
  }
}

/**
 * Modal X tugmasini bosib yopish
 */
async function closeModalByX(page: Page): Promise<boolean> {
  try {
    logger.info('❌ Modal X tugmasi orqali yopilmoqda...');

    const closeButtonSelectors = [
      '.ant-modal-close',
      'button.ant-modal-close',
      '.ant-modal-close-x',
      'button[aria-label="Close"]',
    ];

    for (const selector of closeButtonSelectors) {
      const button = page.locator(selector).first();
      const count = await button.count();

      if (count > 0) {
        await button.click();
        await page.waitForTimeout(1000);
        logger.info('✅ Modal yopildi');
        return true;
      }
    }

    // Escape tugmasini bosish
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    return true;
  } catch (error) {
    logger.error('❌ Modal yopishda xato:', error);
    return false;
  }
}

/**
 * ASOSIY FUNKSIYA - Tahrirlash oynasidagi ma'lumotlarni to'ldirish
 *
 * Jarayon:
 * 1. Mahsulot nomiga mos qatorni topish
 * 2. Miqdor va Summa ni kiritish
 * 3. Modalni o'ngga scroll qilish
 * 4. MXIK kodni tanlash
 * 5. O'lchov birligini tanlash
 * 6. ZIP faylni yuklash
 * 7. CAPTCHA yechish
 * 8. Saqlash tugmasini bosish
 */
export async function fillEditCheckFields(
  page: Page,
  data: CheckData,
  captchaApiKey: string,
  zipFolderPath: string = 'C:\\lll_ha',
): Promise<boolean> {
  try {
    logger.info('\n' + '='.repeat(60));
    logger.info("📝 TAHRIRLASH OYNASI TO'LDIRILMOQDA");
    logger.info('='.repeat(60));

    const chekRaqam = data.chek_raqam ? String(data.chek_raqam).trim() : '';
    const productName = data.maxsulot_nomi || data.product_name || '';
    const mxikCode = data.mxik || data.mxik_code || '';
    const unitName = data.ulchov || data.unit || '';

    logger.info(`📋 Chek: ${chekRaqam}`);
    logger.info(`📦 Mahsulot: ${productName}`);
    logger.info(`🔢 MXIK: ${mxikCode}`);
    logger.info(`📏 O'lchov: ${unitName}`);

    // Modal ochilganligini tekshirish
    await page.waitForTimeout(1000);

    // 1️⃣ MAHSULOT QATORINI TOPISH
    let rowIndex = 0;

    if (productName) {
      logger.info('\n1️⃣ Mahsulot qatori qidirilmoqda...');
      const rowResult = await findProductRow(page, productName);

      if (rowResult) {
        rowIndex = rowResult.rowIndex;
        logger.info(`✅ Qator topildi: #${rowIndex + 1}`);
      } else {
        logger.warn('⚠️ Mahsulot topilmadi, birinchi qator ishlatiladi');
        rowIndex = 0;
      }
    }

    // 2️⃣ MIQDOR VA SUMMA TO'LDIRISH
    logger.info("\n2️⃣ Miqdor va Summa to'ldirilmoqda...");
    await fillQuantityAndAmount(page, rowIndex, data);

    // 3️⃣ MODALNI O'NGGA SCROLL QILISH
    logger.info('\n3️⃣ Modal scroll qilinmoqda...');
    await scrollModalHorizontally(page);

    // 4️⃣ MXIK KOD TANLASH
    if (mxikCode) {
      logger.info('\n4️⃣ MXIK kod tanlanmoqda...');
      await selectMXIK(page, rowIndex, mxikCode);
    }

    // 5️⃣ O'LCHOV BIRLIGI TANLASH
    if (unitName) {
      logger.info("\n5️⃣ O'lchov birligi tanlanmoqda...");
      await selectUnit(page, rowIndex, unitName);
    }

    // 6️⃣ ZIP FAYL YUKLASH
    logger.info('\n6️⃣ ZIP fayl yuklanmoqda...');
    await uploadZipFile(page, zipFolderPath);

    // 7️⃣ CAPTCHA YECHISH
    logger.info('\n7️⃣ CAPTCHA yechilmoqda...');
    const captchaSolved = await solveCaptcha(page, captchaApiKey);

    if (!captchaSolved) {
      logger.error('❌ CAPTCHA yechilmadi - saqlash mumkin emas');
      await closeModalByX(page);
      return false;
    }

    // 8️⃣ SAQLASH TUGMASINI BOSISH
    logger.info('\n8️⃣ Saqlash tugmasi bosilmoqda...');
    const saved = await clickSaveButton(page);

    if (saved) {
      logger.info('\n' + '='.repeat(60));
      logger.info('✅✅✅ CHEK MUVAFFAQIYATLI SAQLANDI! ✅✅✅');
      logger.info('='.repeat(60) + '\n');
      return true;
    } else {
      logger.error('\n❌❌❌ SAQLASHDA MUAMMO! ❌❌❌\n');
      await closeModalByX(page);
      return false;
    }
  } catch (error) {
    logger.error('❌ KRITIK XATO:', error);
    await closeModalByX(page);
    return false;
  }
}
