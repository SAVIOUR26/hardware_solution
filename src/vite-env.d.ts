/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEV_SERVER_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Electron API types
interface Window {
  api: {
    returns: {
      create: (data: any) => Promise<any>;
      get: (id: number) => Promise<any>;
      list: (filters?: any) => Promise<any>;
      updateRefundStatus: (params: any) => Promise<any>;
      getReturnableItems: (invoiceId: number) => Promise<any>;
      getInvoiceReturns: (invoiceId: number) => Promise<any>;
    };
    [key: string]: any;
  };
}
