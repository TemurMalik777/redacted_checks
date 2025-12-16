// src/captcha/solver_captchas.ts

import axios from 'axios';
import { Page } from 'playwright';

const API_KEY = process.env.CAPTCHA_SOLVER_API_KEY || process.env.API_KEY;
const POLL_INTERVAL = 5000; // 5 sekund
const POLL_RETRIES = 25;

interface CaptchaInResponse {
  status: number;
  request: string;
}

interface CaptchaResultResponse {
  status: number;
  request: string;
}

/**
 * 2Captcha orqali captcha yechish (Playwright bilan)
 * @param page Playwright Page instance
 * @param logPanel Log function (optional)
 * @returns true - muvaffaqiyatli, false - xatolik
 */
export async function solveCaptcha(
  page: Page,
  logPanel?: (message: string) => void
): Promise<boolean> {
  const log = (msg: string) => {
    if (logPanel) logPanel(msg);
    else console.log(msg);
  };

  try {
    log('🔍 CAPTCHA topilmoqda...');

    // ✅ Playwright locator ishlatish
    let captchaEl;
    try {
      captchaEl = page.locator(".ant-modal-body img[src^='data:image']").first();
      await captchaEl.waitFor({ state: 'visible', timeout: 5000 });
    } catch {
      captchaEl = page.locator('.ant-modal-body img').first();
      await captchaEl.waitFor({ state: 'visible', timeout: 5000 });
    }

    log('📷 Captcha elementi topildi, base64 olinmoqda...');

    // ✅ src atributidan base64 olish
    const srcData = await captchaEl.getAttribute('src');
    let b64Image: string;

    if (srcData && srcData.includes('base64,')) {
      b64Image = srcData.split('base64,')[1];
    } else {
      log('⚠️ Captcha base64 topilmadi, screenshot usuliga o\'tamiz.');
      const captchaPng = await captchaEl.screenshot({ type: 'png' });
      b64Image = captchaPng.toString('base64');
    }

    // 2Captcha ga yuborish
    const sendResponse = await axios.post<CaptchaInResponse>(
      'http://2captcha.com/in.php',
      new URLSearchParams({
        key: API_KEY!,
        method: 'base64',
        body: b64Image,
        json: '1',
      }),
      { timeout: 30000 }
    );

    const sendData = sendResponse.data;

    if (sendData.status !== 1) {
      log(`❌ 2Captcha in.php xato: ${sendData.request}`);
      return false;
    }

    const reqId = sendData.request;
    log(`📤 Captcha yuborildi (id=${reqId}), yechim kutilmoqda...`);

    // Polling - yechimni kutish
    for (let i = 0; i < POLL_RETRIES; i++) {
      await page.waitForTimeout(POLL_INTERVAL);

      const resultResponse = await axios.get<CaptchaResultResponse>(
        'http://2captcha.com/res.php',
        {
          params: {
            key: API_KEY!,
            action: 'get',
            id: reqId,
            json: 1,
          },
          timeout: 30000,
        }
      );

      const result = resultResponse.data;

      if (result.status === 1) {
        const captchaText = result.request;
        log(`✅ Captcha yechildi: ${captchaText}`);

        try {
          // ✅ Playwright fill ishlatish
          const inputEl = page.locator('input[name="captchaValue"]');
          await inputEl.waitFor({ state: 'visible', timeout: 3000 });
          await inputEl.clear();
          await inputEl.fill(captchaText);
          log('✍️ Captcha qiymati yozildi.');
          return true;
        } catch (e) {
          log(`⚠️ Captcha input topilmadi yoki yozilmadi: ${e}`);
          return false;
        }
      }

      if (result.request && result.request.includes('ERROR')) {
        log(`❌ 2Captcha xato: ${result.request}`);
        return false;
      }

      log(`⌛ Kutilmoqda... (${i + 1}/${POLL_RETRIES})`);
    }

    log('⚠️ Captcha yechimiga vaqt tugadi (timeout).');
    return false;
  } catch (e) {
    log(`❌ solveCaptcha funksiyasida xatolik: ${e}`);
    return false;
  }
}