import { BrowserManager } from '../../automation/utils/browserManager';
import { LoginAction } from '../../automation/actions/loginAction';
import { InvoiceAction } from '../../automation/actions/invoiceAction';
import invoiceManager from '../../database/invoiceManager';
import { logger } from '../../logs/logger.service';
import { CreateInvoiceRequest, InvoiceResponse } from './invoiceTypes';

export class InvoiceService {
  private browserManager: BrowserManager | null = null;

  /**
   * Invoice yaratish (to'liq jarayon)
   */
  async createInvoice(
    request: CreateInvoiceRequest,
    credentials: { tin: string; password: string }
  ): Promise<InvoiceResponse> {
    let invoiceId: number | null = null;

    try {
      logger.info('🚀 Starting invoice creation service...');

      // 1. DB da invoice record yaratish
      invoiceId = await invoiceManager.createInvoice({
        contract_number: request.contractNumber,
        contract_date: request.contractDate,
        seller_tin: request.sellerTin,
        status: 'pending',
      });

      // 2. Browser ochish
      this.browserManager = new BrowserManager();
      const page = await this.browserManager.initialize(false);

      // 3. Tax site'ga o'tish
      const taxSiteUrl = process.env.TAX_SITE_URL || 'https://my.soliq.uz';
      await page.goto(taxSiteUrl);

      // 4. Login
      await invoiceManager.updateInvoiceStatus(invoiceId, 'processing');

      const loginAction = new LoginAction(page);
      const loggedIn = await loginAction.login(credentials);

      if (!loggedIn) {
        throw new Error('Login failed');
      }

      // Cookies saqlash
      await this.browserManager.saveCookies();

      // 5. Invoice yaratish
      const invoiceAction = new InvoiceAction(page);

      const invoiceData = {
        contractNumber: request.contractNumber,
        contractDate: request.contractDate,
        sellerTin: request.sellerTin,
        products: request.products.map(p => ({
          mxik: p.mxik,
          name: p.name,
          measureUnit: p.measureUnit,
          quantity: p.quantity,
          price: p.price,
          vatRate: p.vatRate,
        })),
      };

      const created = await invoiceAction.createInvoice(invoiceData);

      if (!created) {
        throw new Error('Invoice creation failed on tax site');
      }

      // 6. Mahsulotlarni DB ga saqlash
      const totalAmount = request.products.reduce(
        (sum, p) => sum + p.quantity * p.price,
        0
      );

      const vatAmount = request.products.reduce(
        (sum, p) => sum + (p.quantity * p.price * p.vatRate) / 100,
        0
      );

      await invoiceManager.addInvoiceProducts(
        request.products.map(p => ({
          invoice_id: invoiceId!,
          mxik: p.mxik,
          product_name: p.name,
          measure_unit: p.measureUnit,
          quantity: p.quantity,
          price: p.price,
          vat_rate: p.vatRate,
          total_amount: p.quantity * p.price,
        }))
      );

      // 7. Status yangilash
      await invoiceManager.updateInvoiceStatus(invoiceId, 'completed');

      logger.info('🎉 Invoice creation completed successfully', { invoiceId });

      return {
        success: true,
        message: 'Invoice created successfully',
        invoiceId,
        data: {
          contractNumber: request.contractNumber,
          totalAmount,
          vatAmount,
          productsCount: request.products.length,
        },
      };
    } catch (error: any) {
      logger.error('❌ Invoice creation service error', { error: error.message });

      if (invoiceId) {
        await invoiceManager.updateInvoiceStatus(invoiceId, 'failed', error.message);
      }

      return {
        success: false,
        message: error.message || 'Invoice creation failed',
      };
    } finally {
      if (this.browserManager) {
        await this.browserManager.close();
      }
    }
  }

  /**
   * Invoice ma'lumotlarini olish
   */
  async getInvoice(invoiceId: number) {
    try {
      const invoice = await invoiceManager.getInvoiceById(invoiceId);
      
      if (!invoice) {
        return { success: false, message: 'Invoice not found' };
      }

      const products = await invoiceManager.getInvoiceProducts(invoiceId);

      return {
        success: true,
        data: {
          invoice,
          products,
        },
      };
    } catch (error: any) {
      logger.error('❌ Get invoice error', { error: error.message });
      return { success: false, message: error.message };
    }
  }

  /**
   * Barcha invoicelar
   */
  async getAllInvoices(limit: number = 100, offset: number = 0) {
    try {
      const invoices = await invoiceManager.getAllInvoices(limit, offset);

      return {
        success: true,
        data: invoices,
        count: invoices.length,
      };
    } catch (error: any) {
      logger.error('❌ Get all invoices error', { error: error.message });
      return { success: false, message: error.message };
    }
  }
}

export default new InvoiceService();