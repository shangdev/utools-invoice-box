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
    vat_invoice: "增值税发票",
    taxi_receipt: "出租车票",
    train_ticket: "火车票",
    quota_invoice: "定额发票",
    air_ticket: "飞机行程单",
    printed_invoice: "机打发票",
    bus_ticket: "汽车票",
    toll_invoice: "过路过桥费发票",
    ferry_ticket: "船票",
    taxi_online_ticket: "网约车行程单",
    limit_invoice: "限额发票",
    shopping_receipt: "购物小票",
    pos_invoice: "POS小票",
    others: "其他",
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
 * @param name 文件名
 * @param path 文件路径
 * @param imgBase64 截图base64
 * @returns 识别结果
 */
const recognizeInvoice = async (name: String, path: String, imgBase64: string, templateSign: string = ""): Promise<Result> => {
  // 请求参数
  let options: Options = {
    method: "POST",
    url: templateSign
      ? "https://aip.baidubce.com/rest/2.0/solution/v1/iocr/recognise/finance?access_token=" + (await getAccessToken())
      : "https://aip.baidubce.com/rest/2.0/ocr/v1/multiple_invoice?access_token=" + (await getAccessToken()),
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    data: {
      verify_parameter: false,
    },
  };

  if (templateSign) {
    options.data.templateSign = templateSign;
  }

  if (imgBase64) {
    options.data.image = imgBase64;
  } else {
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
  }

  let result = await axios(options);
  if (result.data.words_result) {
    const invoices: any[] = [];
    result.data.words_result.forEach((item: any) => {
      const data = item.result;
      if (item.type === "others" || item.type === "limit_invoice" || item.type === "shopping_receipt" || item.type === "pos_invoice") {
        throw new Error("不支持的发票文件类型");
      }

      let code = data.InvoiceCode?.[0].word;
      let number = data.InvoiceNum?.[0].word;
      let amount = data.AmountInFiguers?.[0].word;
      let date = data.InvoiceDate?.[0].word;
      let invoiceType = getInvoiceType(item.type);
      switch (item.type) {
        case "vat_invoice":
        case "roll_normal_invoice":
        case "printed_invoice":
          invoiceType = data.InvoiceType[0].word;
          break;
        case "taxi_receipt":
          date = data.Date[0].word;
          amount = data.TotalFare[0].word;
          break;
        case "train_ticket":
          number = data.invoice_num[0].word;
          date = data.invoice_date[0].word;
          amount = data.ticket_rates[0].word;
          break;
        case "quota_invoice":
          code = data.invoice_code[0].word;
          number = data.invoice_num[0].word;
          amount = data.invoice_rate[0].word;
          break;
        case "air_ticket":
          number = data.ticket_number[0].word;
          date = data.date[0].word;
          amount = data.ticket_rates[0].word;
          break;
        case "bus_ticket":
          date = data.InvoiceTime[0].word;
          amount = data.Amount[0].word;
          break;
        case "toll_invoice":
          date = data.OutDate[0].word;
          amount = data.TotalAmount[0].word;
          break;
        case "ferry_ticket":
          invoiceType = data.InvoiceType[0].word;
          date = data.Date[0].word;
          amount = data.Amount[0].word;
          break;
        case "motor_vehicle_invoice":
          code = data["printed-daima"][0].word;
          number = data["printed-haoma"][0].word;
          date = data.date[0].word;
          amount = data["price-tax-small"][0].word;
          break;
        case "used_vehicle_invoice":
          code = data.invoice_code[0].word;
          number = data.invoice_num[0].word;
          date = data.date[0].word;
          amount = data.small_price[0].word;
          break;
        case "taxi_online_ticket":
          date = data.application_date[0].word;
          amount = data.total_fare[0].word;
          break;
        default:
          break;
      }

      invoices.push({
        invoiceType,
        code,
        number,
        amount,
        date,
      });
    });

    return invoices[0];
  } else if (result.data.data.ret) {
    let code = "";
    let number = "";
    let amount = "";
    let date = "";
    result.data.data.ret.map((item: any) => {
      if (item.word_name === "invoice_code") {
        code = item.word;
      } else if (item.word_name === "invoice_num") {
        number = item.word;
      } else if (item.word_name === "total_amount") {
        amount = item.word;
      } else if (item.word_name === "invoice_date") {
        date = item.word;
      }
    });

    return {
      invoiceType: result.data.data.templateName,
      code,
      number,
      amount,
      date,
    };
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
  recognizeInvoice: (name: string, path: string, imgBase64: string, templateSign: string): Promise<Result> => {
    return recognizeInvoice(name, path, imgBase64, templateSign);
  },
  exportExcel: (data: any) => {
    return exportExcel(data);
  },
  getSettings: async () => {
    return utools.dbStorage.getItem("settings") || { secretKey: "", apiKey: "", iOCR: [] };
  },
  saveSettings: async (settings: Settings) => {
    // 确保传递的对象是一个简单的 JSON 对象
    const settingsToSave = {
      apiKey: settings.apiKey,
      secretKey: settings.secretKey,
      iOCR: settings.iOCR,
    };
    utools.dbStorage.setItem("settings", settingsToSave);
  },
};
