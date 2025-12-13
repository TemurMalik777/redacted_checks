// src/captcha/solver_captchas.ts

import axios from 'axios';
import { WebDriver, By, until } from 'selenium-webdriver';

const API_KEY = process.env.CAPTCHA_SOLVER_API_KEY || process.env.API_KEY;
const POLL_INTERVAL = 5000; // 5 sekund (milliseconds)
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
 * 2Captcha orqali captcha yechish
 * @param driver Selenium WebDriver instance
 * @param logPanel Log function (optional)
 * @returns true - muvaffaqiyatli, false - xatolik
 */
export async function solveCaptcha(
  driver: WebDriver,
  logPanel?: (message: string) => void
): Promise<boolean> {
  const log = (msg: string) => {
    if (logPanel) logPanel(msg);
    else console.log(msg);
  };

  try {
    log('🔍 CAPTCHA topilmoqda...');

    // Captcha elementini topish
    let captchaEl;
    try {
      captchaEl = await driver.findElement(
        By.css(".ant-modal-body img[src^='data:image']")
      );
    } catch {
      captchaEl = await driver.findElement(By.css('.ant-modal-body img'));
    }

    log('📷 Captcha elementi topildi, base64 olinmoqda...');

    // src atributidan base64 olish
    const srcData = await captchaEl.getAttribute('src');
    let b64Image: string;

    if (srcData && srcData.includes('base64,')) {
      b64Image = srcData.split('base64,')[1];
    } else {
      log('⚠️ Captcha base64 topilmadi, screenshot usuliga o\'tamiz.');
      const captchaPng = await captchaEl.takeScreenshot();
      b64Image = captchaPng; // Already in base64
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
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));

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
          const inputEl = await driver.findElement(By.name('captchaValue'));
          await inputEl.clear();
          await inputEl.sendKeys(captchaText);
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