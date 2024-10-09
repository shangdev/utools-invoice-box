/// <reference types="vite/client" />

interface FileItem {
  name: string;
  path: string;
  status: string;
  InvoiceType?: string;
  InvoiceNum?: string;
  TotalAmount?: string;
  InvoiceDate?: string;
  InvoiceCode?: string;
}

interface Result {
  invoiceType?: string;
  code?: string;
  number?: string;
  amount?: string;
  date?: string;
  error_code?: unknown;
  error_msg?: string;
}

interface Settings {
  apiKey: string;
  secretKey: string;
}

interface OpenFileOption {
  title?: string;
  defaultPath?: string;
  buttonLabel?: string;
  filters?: { name: string; extensions: string[] }[];
  properties?: Array<"openFile" | "openDirectory" | "multiSelections" | "showHiddenFiles" | "createDirectory" | "promptToCreate" | "noResolveAliases" | "treatPackageAsDirectory" | "dontAddToRecent">;
  message?: string;
  securityScopedBookmarks?: boolean;
}

interface OptionsData {
  ofd_file?: string;
  pdf_file?: string;
  image?: string;
  verify_parameter: boolean;
}

interface Options {
  method: string;
  url: string;
  headers: Record<string, string>;
  data: OptionsData;
}

interface Window {
  preload: {
    /**
     * 打开一个文件，并返回blob对象
     * @param options 参数
     * @return 返回文件列表
     */
    openFile(options: OpenFileOption): Promise<Array<{ name: string; path: string }>>;

    /**
     * 识别发票
     * @param file 文件
     * @returns 识别结果
     */
    recognizeInvoice: (name: string, path: string) => Promise<Result>;
    exportExcel: (data: any[]) => Promise<ArrayBuffer>;
    getSettings: () => Promise<Settings>;
    saveSettings: (settings: Settings) => Promise<void>;
  };
}
