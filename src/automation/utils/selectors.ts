// src/automation/utils/selectors.ts

export const CHECK_SEARCH_SELECTORS = {
  // ========================================
  // MAIN PAGE ELEMENTS (1-rasm)
  // ========================================
  
  // 1. Tab tugmasi (ko'k button, chapda)
  checkInfoTab: 'button.MuiButton-root:has-text("Чек маълумотлари")',
  
  // 2. Dropdown (Онлайн ҲҚТ чеклари)
  onlineCheckDropdown: 'div[role="button"]:has-text("Онлайн ҲҚТ чеклари")',
  dropdownOption: (text: string) => `li[role="option"]:has-text("${text}")`,
  
  // 3. Fiskal modul input field
  fiscalModuleInput: 'input[placeholder*="Фискал модул рақами"]',
  
  // Alternative: Agar placeholder bo'lmasa
  fiscalModuleInputAlt: 'div:has-text("Фискал модул рақами") + div input',
  
  // 4. Date pickers (Сана дан/гача)
  dateFromInput: 'input[placeholder="Сана (дан)"]',
  dateToInput: 'input[placeholder="Сана (гача)"]',
  
  // 5. Chek raqami checkbox va filter
  checkWithFilter: 'input[type="checkbox"][name="check_filter"]',
  
  // 6. Qidiruv tugmasi (ko'k, "Қидириш")
  searchButton: 'button.MuiButton-containedPrimary:has-text("Қидириш")',
  
  // Alternative search button
  searchButtonAlt: 'button[type="button"]:has-text("Қидириш")',
  
  // ========================================
  // MODAL ELEMENTS (2-rasm)
  // ========================================
  
  // Modal container
  activationModal: 'div[role="dialog"]',
  modalTitle: 'h2:has-text("Юридик шахсларнинг онлайн назорат-касса техникаси")',
  
  // Modal tabs
  notActivatedTab: 'button:has-text("Шахсий кабинет активлаштирилмаган")',
  
  // Modal close button
  modalCloseButton: 'button[aria-label="close"]',
  
  // ========================================
  // RESULTS TABLE
  // ========================================
  
  resultsContainer: 'div.MuiPaper-root',
  resultsTable: 'table',
  tableRow: 'tbody tr',
  noResults: 'div:has-text("0 та бахо")', // "0 results"
  
  // Pagination
  paginationInfo: 'p:has-text("Фойдаланиш статистикаси")',
  backButton: 'button:has-text("Орқага")',
  
  // ========================================
  // STATISTIC SECTION (pastda)
  // ========================================
  
  statisticsText: 'p:has-text("Фойдаланиш статистикаси: 19 257 730")',
  
  // Links
  showAllConditions: 'a:has-text("Барча шарҳхқар")',
  ratingSection: 'a:has-text("Хизматни баҳоланг ва шарҳ қолдиринг")',
};

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
  contractNumber: 'input[name="contract_number"]',
  contractDate: 'input[name="contract_date"]',
  sellerTinInput: 'input[name="seller_tin"]',
  sellerSearchButton: 'button[type="search"]',
  
  addProductButton: 'button.add-product',
  mxikSearchInput: 'input[name="mxik_search"]',
  mxikSearchButton: 'button.mxik-search',
  productTableRow: (mxik: string) => `tr[data-mxik="${mxik}"]`,
  
  quantityInput: 'input[name="quantity"]',
  priceInput: 'input[name="price"]',
  vatRateSelect: 'select[name="vat_rate"]',
  confirmProductButton: 'button.confirm-product',
  
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