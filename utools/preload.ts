// 您可以在进行窗口交互
// utools文档
const { readFileSync, writeFileSync } = require("fs");
const { basename, extname, join } = require("path");
const XLSX = require("xlsx");
const mime = require("mime-types");
const axios = require("axios");

// https://www.u.tools/docs/developer/api.html#%E7%AA%97%E5%8F%A3%E4%BA%A4%E4%BA%92

/**
 * 获取文件base64编码
 * @param string  path 文件路径
 * @return string base64编码信息，不带文件头
 */
function getFileContentAsBase64(path: String) {
  try {
    return readFileSync(path, { encoding: "base64" });
  } catch (err) {
    throw new Error(err as string);
  }
}

/**
 * 使用 AK，SK 生成鉴权签名（Access Token）
 * @return string 鉴权签名信息（Access Token）
 */
function getAccessToken() {
  const settings = utools.dbStorage.getItem("settings") as Settings;
  if (!settings || !settings.apiKey || !settings.secretKey) {
    throw new Error("请先设置 API Key 和 Secret Key");
  }

  let options = {
    method: "POST",
    url: "https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=" + settings.apiKey + "&client_secret=" + settings.secretKey,
  };
  return new Promise((resolve, reject) => {
    axios(options)
      .then((res: any) => {
        resolve(res.data.access_token);
      })
      .catch((error: any) => {
        reject(error);
      });
  });
}

/**
 * 获取发票类型
 * @param type 发票类型
 * @returns 发票类型
 */
function getInvoiceType(type: string): string {
  const invoiceTypes: { [key: string]: string } = {
    special_vat_invoice: "增值税专用发票",
    elec_special_vat_invoice: "增值税电子专票",
    normal_invoice: "增值税普通发票",
    elec_normal_invoice: "增值税普通发票（电子）",
    roll_normal_invoice: "增值税普通发票（卷式）",
    elec_invoice_special: "全电发票（专用发票）",
    elec_invoice_normal: "全电发票（普通发票）",
    toll_elec_normal_invoice: "通行费增值税电子普通发票",
    special_freight_transport_invoice: "货运运输业增值税专用发票",
    motor_vehicle_invoice: "机动车销售发票",
    used_vehicle_invoice: "二手车销售发票",
    blockchain_invoice: "区块链发票",
    printed_elec_invoice: "通用机打电子发票",
  };

  return invoiceTypes[type] || "unknown_invoice_type"; // 默认返回未知类型
}

/**
 * 打开文件
 * @param options 参数
 * @returns 文件列表
 */
async function openFile(options: OpenFileOption): Promise<Array<{ name: string; path: string }>> {
  const paths = utools.showOpenDialog(options);
  if (!paths) return [];

  const files = [];
  for (const path of paths) {
    const name = basename(path);
    files.push({
      name,
      path,
    });
  }

  return files;
}

/**
 * 识别发票
 * @param file 文件
 * @returns 识别结果
 */
const recognizeInvoice = async (name: String, path: String): Promise<Result> => {
  // 请求参数
  let options = {
    method: "POST",
    url: "https://aip.baidubce.com/rest/2.0/ocr/v1/multiple_invoice?access_token=" + (await getAccessToken()),
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    data: {
      image: "",
      pdf_file: "",
      ofd_file: "",
      verify_parameter: true,
    },
  };

  const extension = extname(name).toLowerCase();
  if (extension === ".pdf") {
    options.data.pdf_file = getFileContentAsBase64(path);
  } else if (extension === ".jpg" || extension === ".png" || extension === ".jpeg" || extension === ".bmp") {
    options.data.image = getFileContentAsBase64(path);
  } else if (extension === ".ofd") {
    options.data.ofd_file = getFileContentAsBase64(path);
  } else {
    throw new Error("不支持的文件类型：" + extension);
  }

  let result = await axios(options);
  if (result.data.words_result) {
    const invoices: any[] = [];
    result.data.words_result.forEach((item: any) => {
      const data = item.result;
      if (item.type === "others") {
        throw new Error("不支持的发票文件类型");
      }

      invoices.push({
        invoiceType: getInvoiceType(data.invoice_type[0].word),
        code: data.invoice_code[0].word,
        number: data.invoice_num[0].word,
        amount: data.total_amount[0].word,
        date: data.invoice_date[0].word,
      });
    });

    return invoices[0];
  }

  throw new Error(result.data.error_msg || "识别失败");
};

/**
 * 导出 Excel
 * @param data 数据
 * @returns 文件内容
 */
const exportExcel = (data: any) => {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(data);

  // 定义列宽
  const columnWidths = [{ wch: 6 }, { wch: 21 }, { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 15 }];
  worksheet["!cols"] = columnWidths;

  XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");

  // 生成 Excel 文件内容
  const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });

  // 保存文件
  const savepath = utools.showSaveDialog({
    title: "另存为",
    defaultPath: join(utools.getPath("downloads"), `导出发票明细_${Date.now()}.xlsx`),
    buttonLabel: "保存",
    filters: [{ name: "Excel 文件", extensions: ["xlsx"] }],
  });
  if (savepath) {
    writeFileSync(savepath, excelBuffer);
  }

  return excelBuffer;
};

window.preload = {
  openFile: (options: OpenFileOption) => {
    return openFile(options);
  },
  recognizeInvoice: (name: string, path: string): Promise<Result> => {
    return recognizeInvoice(name, path);
  },
  exportExcel: (data: any) => {
    return exportExcel(data);
  },
  getSettings: async () => {
    return utools.dbStorage.getItem("settings") || { secretKey: "", apiKey: "" };
  },
  saveSettings: async (settings: Settings) => {
    // 确保传递的对象是一个简单的 JSON 对象
    const settingsToSave = {
      apiKey: settings.apiKey,
      secretKey: settings.secretKey,
    };
    utools.dbStorage.setItem("settings", settingsToSave);
  },
};
