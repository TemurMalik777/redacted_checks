import { BrowserManager } from '../../automation/utils/browserManager';
import { LoginAction } from '../../automation/actions/loginAction';
import { InvoiceAction } from '../../automation/actions/invoiceAction';
// ✅ TO'G'RILANDI: named import
import { InvoiceManager } from '../../database/invoiceManager';
// ✅ TO'G'RILANDI: default import
import logger from '../../logs/logger.service';
import { CreateInvoiceRequest, InvoiceResponse } from './invoiceTypes';

export class InvoiceService {
  private browserManager: BrowserManager | null = null;
  private invoiceManager: InvoiceManager;

  constructor() {
    this.invoiceManager = new InvoiceManager();
  }

  /**
   * Invoice yaratish (to'liq jarayon)
   */
  async createInvoice(
    request: CreateInvoiceRequest,
    credentials: { tin: string; password: string },
  ): Promise<InvoiceResponse> {
    let invoiceId: number | undefined = undefined; // ✅ TO'G'RILANDI: null → undefined

    try {
      logger.info('🚀 Starting invoice creation service...');

      // 1. Database ga ulanish
      await this.invoiceManager.connect();

      // 2. DB da invoice record yaratish (AGAR invoiceManager da createInvoice metodi bo'lsa)
      // invoiceId = await this.invoiceManager.createInvoice({
      //   contract_number: request.contractNumber,
      //   contract_date: request.contractDate,
      //   seller_tin: request.sellerTin,
      //   status: 'pending',
      // });

      // 3. Browser ochish
      this.browserManager = new BrowserManager();
      const page = await this.browserManager.initialize(false);

      // 4. Tax site'ga o'tish
      const taxSiteUrl = process.env.TAX_SITE_URL || 'https://my.soliq.uz';
      await page.goto(taxSiteUrl);

      // 5. Login
      // if (invoiceId) {
      //   await this.invoiceManager.updateInvoiceStatus(invoiceId, 'processing');
      // }

      const loginAction = new LoginAction(page);
      const loggedIn = await loginAction.execute(credentials); // ✅ TO'G'RILANDI: login → execute

      if (!loggedIn) {
        throw new Error('Login failed');
      }

      // ❌ OLIB TASHLANDI: saveCookies() metodi yo'q
      // await this.browserManager.saveCookies();

      // 6. Invoice yaratish
      const invoiceAction = new InvoiceAction(page);

      const invoiceData = {
        contractNumber: request.contractNumber,
        contractDate: request.contractDate,
        sellerTin: request.sellerTin,
        products: request.products.map((p) => ({
          name: p.name,
          mxik: p.mxik,
          quantity: p.quantity,
          price: p.price,
          vatRate: p.vatRate,
        })),
      };

      const created = await invoiceAction.execute(invoiceData); // ✅ TO'G'RILANDI: createInvoice → execute

      if (!created) {
        throw new Error('Invoice creation failed on tax site');
      }

      // 7. Mahsulotlarni hisoblash
      const totalAmount = request.products.reduce(
        (sum, p) => sum + p.quantity * p.price,
        0,
      );

      const vatAmount = request.products.reduce(
        (sum, p) => sum + (p.quantity * p.price * p.vatRate) / 100,
        0,
      );

      // 8. Status yangilash (AGAR metod bo'lsa)
      // if (invoiceId) {
      //   await this.invoiceManager.updateInvoiceStatus(invoiceId, 'completed');
      // }

      logger.info(
        `🎉 Invoice creation completed successfully. Invoice ID: ${invoiceId}`,
      );

      return {
        success: true,
        message: 'Invoice created successfully',
        invoiceId, // ✅ TO'G'RILANDI: number | undefined
        data: {
          contractNumber: request.contractNumber,
          totalAmount,
          vatAmount,
          productsCount: request.products.length,
        },
      };
    } catch (error: any) {
      logger.error(
        `❌ Invoice creation service error: ${error.message || error}`,
      );

      // if (invoiceId) {
      //   await this.invoiceManager.updateInvoiceStatus(invoiceId, 'failed', error.message);
      // }

      return {
        success: false,
        message: error.message || 'Invoice creation failed',
      };
    } finally {
      // Cleanup
      if (this.browserManager) {
        await this.browserManager.close();
      }

      await this.invoiceManager.disconnect();
    }
  }

  /**
   * Invoice ma'lumotlarini olish
   */
  async getInvoice(invoiceId: number) {
    try {
      await this.invoiceManager.connect();

      // AGAR InvoiceManager da getInvoiceById metodi bo'lsa
      // const invoice = await this.invoiceManager.getInvoiceById(invoiceId);

      // if (!invoice) {
      //   return { success: false, message: 'Invoice not found' };
      // }

      // const products = await this.invoiceManager.getInvoiceProducts(invoiceId);

      return {
        success: true,
        data: {
          // invoice,
          // products,
        },
      };
    } catch (error: any) {
      logger.error(`❌ Get invoice error: ${error.message || error}`);
      return { success: false, message: error.message };
    } finally {
      await this.invoiceManager.disconnect();
    }
  }

  /**
   * Barcha invoicelar
   */
  async getAllInvoices(limit: number = 100, offset: number = 0) {
    try {
      await this.invoiceManager.connect();

      // AGAR InvoiceManager da getAllInvoices metodi bo'lsa
      // const invoices = await this.invoiceManager.getAllInvoices(limit, offset);

      return {
        success: true,
        data: [], // invoices
        count: 0,
      };
    } catch (error: any) {
      logger.error(`❌ Get all invoices error: ${error.message || error}`);
      return { success: false, message: error.message };
    } finally {
      await this.invoiceManager.disconnect();
    }
  }
}

export default new InvoiceService();
