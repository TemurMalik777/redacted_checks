// Bu faylda soliq.uz saytidagi barcha selectorlar
// Sayt yangilanganda faqat shu faylni o'zgartirish kerak

export const LOGIN_SELECTORS = {
  tinInput: 'input[name="tin"]',
  passwordInput: 'input[name="password"]',
  captchaImage: 'img.captcha-image',
  captchaInput: 'input[name="captcha"]',
  loginButton: 'button[type="submit"]',
  errorMessage: '.error-message',
  dashboardContainer: '.dashboard-container',
};

export const INVOICE_SELECTORS = {
  // Shartnoma ma'lumotlari
  contractNumber: 'input[name="contract_number"]',
  contractDate: 'input[name="contract_date"]',
  sellerTinInput: 'input[name="seller_tin"]',
  sellerSearchButton: 'button[type="search"]',
  
  // Mahsulot qo'shish
  addProductButton: 'button.add-product',
  mxikSearchInput: 'input[name="mxik_search"]',
  mxikSearchButton: 'button.mxik-search',
  productTableRow: (mxik: string) => `tr[data-mxik="${mxik}"]`,
  
  // Mahsulot ma'lumotlari
  quantityInput: 'input[name="quantity"]',
  priceInput: 'input[name="price"]',
  vatRateSelect: 'select[name="vat_rate"]',
  confirmProductButton: 'button.confirm-product',
  
  // Saqlash
  submitButton: 'button[type="submit"]',
  successMessage: '.success-message',
  errorMessage: '.error-message',
};

export const NAVIGATION_SELECTORS = {
  mainMenu: '.main-menu',
  invoicesLink: 'a[href*="/invoices"]',
  createInvoiceLink: 'a[href*="/invoice/create"]',
  logoutButton: 'button.logout',
};