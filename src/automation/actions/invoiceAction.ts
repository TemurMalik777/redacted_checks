import { Page } from 'playwright';
import { INVOICE_SELECTORS, NAVIGATION_SELECTORS } from '../utils/selectors';
import { AutomationHelpers } from '../utils/helper';

export interface ProductData {
  name: string;
  mxik: string;
  quantity: number;
  price: number;
  vatRate: number;
}

export interface InvoiceData {
  contractNumber: string;
  contractDate: string;
  sellerTin: string;
  products: ProductData[];
}

export class InvoiceAction {
  constructor(private page: Page) {}

  async execute(data: InvoiceData): Promise<boolean> {
    try {
      console.log('📄 Creating invoice...');

      // Invoice yaratish sahifasiga o'tish
      await this.navigateToInvoiceCreation();

      // Shartnoma ma'lumotlarini to'ldirish
      await this.fillContractDetails(data);

      // Mahsulotlarni qo'shish
      for (const product of data.products) {
        const success = await this.addProduct(product);
        if (!success) {
          console.error(`❌ Failed to add product: ${product.name}`);
          return false;
        }
      }

      // Invoice ni saqlash
      const saved = await this.saveInvoice();

      if (saved) {
        console.log('✅ Invoice created successfully');
      }

      return saved;
    } catch (error) {
      console.error('❌ Invoice creation error:', error);
      return false;
    }
  }

  private async navigateToInvoiceCreation(): Promise<void> {
    // Invoice yaratish sahifasiga o'tish
    await AutomationHelpers.safeClick(this.page, NAVIGATION_SELECTORS.createInvoiceLink);
    await this.page.waitForLoadState('networkidle');
  }

  private async fillContractDetails(data: InvoiceData): Promise<void> {
    // Shartnoma raqami
    await AutomationHelpers.safeFill(
      this.page,
      INVOICE_SELECTORS.contractNumber,
      data.contractNumber
    );

    await AutomationHelpers.randomDelay();

    // Shartnoma sanasi
    await AutomationHelpers.safeFill(
      this.page,
      INVOICE_SELECTORS.contractDate,
      data.contractDate
    );

    await AutomationHelpers.randomDelay();

    // Sotuvchi STIR
    await AutomationHelpers.safeFill(
      this.page,
      INVOICE_SELECTORS.sellerTinInput,
      data.sellerTin
    );

    await AutomationHelpers.randomDelay();

    // Sotuvchi qidirish
    await AutomationHelpers.safeClick(
      this.page,
      INVOICE_SELECTORS.sellerSearchButton
    );

    await this.page.waitForTimeout(2000);
  }

  private async addProduct(product: ProductData): Promise<boolean> {
    try {
      console.log(`  ➕ Adding product: ${product.name}`);

      // Mahsulot qo'shish tugmasini bosish
      await AutomationHelpers.safeClick(
        this.page,
        INVOICE_SELECTORS.addProductButton
      );

      await AutomationHelpers.randomDelay();

      // MXIK kodi orqali qidirish
      await AutomationHelpers.safeFill(
        this.page,
        INVOICE_SELECTORS.mxikSearchInput,
        product.mxik
      );

      await AutomationHelpers.randomDelay();

      // Qidirish tugmasini bosish
      await AutomationHelpers.safeClick(
        this.page,
        INVOICE_SELECTORS.mxikSearchButton
      );

      await this.page.waitForTimeout(1500);

      // Natijadan tanlash
      const productRow = INVOICE_SELECTORS.productTableRow(product.mxik);
      const productFound = await AutomationHelpers.elementExists(this.page, productRow);

      if (!productFound) {
        console.error(`❌ Product not found by MXIK: ${product.mxik}`);
        return false;
      }

      await AutomationHelpers.safeClick(this.page, productRow);
      await AutomationHelpers.randomDelay();

      // Miqdor
      await AutomationHelpers.safeFill(
        this.page,
        INVOICE_SELECTORS.quantityInput,
        product.quantity.toString()
      );

      await AutomationHelpers.randomDelay();

      // Narx
      await AutomationHelpers.safeFill(
        this.page,
        INVOICE_SELECTORS.priceInput,
        product.price.toString()
      );

      await AutomationHelpers.randomDelay();

      // QQS stavkasi
      await this.page.selectOption(
        INVOICE_SELECTORS.vatRateSelect,
        product.vatRate.toString()
      );

      await AutomationHelpers.randomDelay();

      // Tasdiqlash
      await AutomationHelpers.safeClick(
        this.page,
        INVOICE_SELECTORS.confirmProductButton
      );

      await this.page.waitForTimeout(1000);

      console.log(`  ✅ Product added: ${product.name}`);
      return true;
    } catch (error) {
      console.error(`  ❌ Error adding product: ${product.name}`, error);
      return false;
    }
  }

  private async saveInvoice(): Promise<boolean> {
    try {
      // Saqlash tugmasini bosish
      await AutomationHelpers.safeClick(
        this.page,
        INVOICE_SELECTORS.submitButton
      );

      await this.page.waitForLoadState('networkidle');

      // Success message tekshirish
      const success = await AutomationHelpers.elementExists(
        this.page,
        INVOICE_SELECTORS.successMessage
      );

      return success;
    } catch (error) {
      console.error('❌ Save invoice error:', error);
      return false;
    }
  }
}