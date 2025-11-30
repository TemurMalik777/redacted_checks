export interface CreateInvoiceRequest {
  contractNumber: string;
  contractDate: string;
  sellerTin: string;
  products: InvoiceProductRequest[];
}

export interface InvoiceProductRequest {
  mxik: string;
  name: string;
  measureUnit: string;
  quantity: number;
  price: number;
  vatRate: number;
}

export interface InvoiceResponse {
  success: boolean;
  message: string;
  invoiceId?: number;
  data?: {
    contractNumber: string;
    totalAmount: number;
    vatAmount: number;
    productsCount: number;
  };
}

export interface InvoiceListResponse {
  success: boolean;
  data?: any[];
  count?: number;
  message?: string;
}