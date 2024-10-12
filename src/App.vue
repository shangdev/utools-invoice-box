<template>
  <div class="container">
    <div class="content-area" id="dropZone">
      <div id="uploadInfo" v-show="!hasFiles" @click="triggerFileInput">
        <div class="upload-icon">&#x2601;</div>
        <p>点击此处选择 或 拖动 发票文件到应用内进行解析</p>
        <p>支持 PDF、PNG、JPG、JPEG、BMP、OFD 格式发票</p>
      </div>
      <table id="fileTable" v-show="hasFiles">
        <colgroup>
          <col style="width: 20%" />
          <col style="width: 15%" />
          <col style="width: 15%" />
          <col style="width: 12%" />
          <col style="width: 11%" />
          <col style="width: 10%" />
          <col style="width: 9%" />
          <col style="width: 6%" />
        </colgroup>
        <thead>
          <tr>
            <th class="file-name-column">文件名称</th>
            <th>发票类型</th>
            <th>发票代码</th>
            <th>发票号码</th>
            <th>发票金额</th>
            <th>开票日期</th>
            <th>状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(file, index) in files" :key="index">
            <td class="file-name-column">{{ file.name }}</td>
            <td>{{ file.InvoiceType || "-" }}</td>
            <td>{{ file.InvoiceCode || "-" }}</td>
            <td>{{ file.InvoiceNum || "-" }}</td>
            <td>{{ file.TotalAmount || "-" }}</td>
            <td>{{ file.InvoiceDate || "-" }}</td>
            <td :class="getStatusClass(file.status)">{{ file.status }}</td>
            <td class="delete-action" @click="removeFile(index)">删除</td>
          </tr>
          <tr class="total-row">
            <td colspan="4">合计金额</td>
            <td>{{ calculateTotalAmount() }}</td>
            <td colspan="3"></td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="button-group">
      <button class="primary" @click="openSettings">设置</button>
      <button class="secondary" @click="clearFiles">清空</button>
      <button class="primary" @click="triggerFileInput">{{ hasFiles ? "继续添加" : "上传文件" }}</button>
      <button class="primary" @click="parseFiles">一键识别</button>
      <button class="primary" @click="downloadExcel">另存为Excel</button>
    </div>
  </div>

  <!-- 设置模态框 -->
  <div v-if="showSettings" class="modal">
    <div class="modal-content">
      <h2>设置</h2>
      <div class="form-group">
        <label for="apiKey">API Key:</label>
        <input type="text" id="apiKey" v-model="settings.apiKey" />
      </div>
      <div class="form-group">
        <label for="secretKey">Secret Key:</label>
        <input type="text" id="secretKey" v-model="settings.secretKey" />
      </div>
      <div>
        <button class="primary" @click="saveSettings">保存</button>
        <button class="secondary" @click="closeSettings">取消</button>
      </div>
    </div>
  </div>

  <!-- 错误提示模态框 -->
  <div v-if="showError" class="modal">
    <div class="modal-content">
      <h2>错误</h2>
      <p>{{ errorMessage }}</p>
      <button class="primary" @click="closeError">我已知晓</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";

const files = ref<FileItem[]>([]);
const hasFiles = computed(() => files.value.length > 0);

const showSettings = ref(false);
const settings = ref<Settings>({
  secretKey: "",
  apiKey: "",
});

const showError = ref(false);
const errorMessage = ref("");

const triggerFileInput = () => {
  window.preload
    .openFile({
      title: "选择发票",
      // filters: [
      //   {
      //     name: "自定义文件",
      //     extensions: ["jpg", "png", "jpeg", "webp", "pdf", "bmp", "ofd"],
      //   },
      // ],
      properties: ["openFile", "multiSelections"],
    })
    .then((data) => {
      Array.from(data).forEach((file) => {
        files.value.push({ name: file.name, status: "待解析", path: file.path });
      });
    });
};

const removeFile = (index: number) => {
  files.value.splice(index, 1);
};

const clearFiles = () => {
  files.value = [];
};

const parseFiles = async () => {
  if (files.value.length === 0) {
    showError.value = true;
    errorMessage.value = "请上传发票文件";
    return;
  }
  for (let fileItem of files.value) {
    if (fileItem.status === "解析完成") continue;
    fileItem.status = "解析中";
    try {
      // 读取文件内容
      const result: Result = await window.preload.recognizeInvoice(fileItem.name, fileItem.path);

      // 检查 error_code 是否存在
      if ("error_code" in result) {
        throw new Error(result.error_msg);
      }

      // 保存解析结果
      fileItem.InvoiceType = result.invoiceType || "-";
      fileItem.InvoiceCode = result.code || "-";
      fileItem.InvoiceNum = result.number || "-";
      fileItem.TotalAmount = result.amount || "-";
      fileItem.InvoiceDate = result.date || "-";
      fileItem.status = "解析完成";
    } catch (error) {
      const err = error as Error;
      showError.value = true;
      errorMessage.value = `解析文件 ${fileItem.name} 时出错: ${err.message}`;
      fileItem.status = "解析失败";
    }
  }
};

const downloadExcel = async () => {
  const fileData = files.value.map((file, index) => ({
    序号: (index + 1).toString(),
    文件名称: file.name,
    发票类型: file.InvoiceType || "-",
    发票代码: file.InvoiceCode || "-",
    发票号码: file.InvoiceNum || "-",
    发票金额: parseFloat(file.TotalAmount || "0"),
    开票日期: file.InvoiceDate || "-",
  }));

  // 添加合计行
  fileData.push({
    序号: "",
    文件名称: "合计金额",
    发票类型: "",
    发票代码: "",
    发票号码: "",
    发票金额: parseFloat(calculateTotalAmount()),
    开票日期: "",
  });

  try {
    await window.preload.exportExcel(fileData);
  } catch (error) {
    const err = error as Error;
    showError.value = true;
    errorMessage.value = `导出 Excel 失败: ${err.message}`;
  }
};

const openSettings = async () => {
  // 从 utools 获取当前设置
  const currentSettings = await window.preload.getSettings();
  settings.value = currentSettings;
  showSettings.value = true;
};

const closeSettings = () => {
  showSettings.value = false;
};

const saveSettings = async () => {
  try {
    await window.preload.saveSettings(settings.value);
    showSettings.value = false;
  } catch (error) {
    const err = error as Error;
    showError.value = true;
    errorMessage.value = `保存设置失败: ${err.message}`;
  }
};

const closeError = () => {
  showError.value = false;
};

const getStatusClass = (status: string) => {
  switch (status) {
    case "待解析":
      return "status-pending";
    case "解析完成":
      return "status-completed";
    default:
      return "";
  }
};

const calculateTotalAmount = (): string => {
  const total = files.value.reduce((sum, file) => sum + parseFloat(file.TotalAmount || "0"), 0);
  return total.toFixed(2);
};

onMounted(() => {
  const dropZone = document.getElementById("dropZone");
  if (dropZone) {
    dropZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropZone.style.backgroundColor = "#e6e6e6";
    });

    dropZone.addEventListener("dragleave", (e) => {
      e.preventDefault();
      dropZone.style.backgroundColor = "white";
    });

    dropZone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropZone.style.backgroundColor = "white";
      if (e.dataTransfer) {
        if (e.dataTransfer.files) {
          Array.from(e.dataTransfer.files).forEach((file) => {
            files.value.push({ name: file.name, status: "待解析", path: file.path });
          });
        }
      }
    });
  }
});
</script>

<style scoped>
.container {
  width: 100%;
  height: 100vh; /* 使用视口高度 */
  display: flex;
  flex-direction: column;
  background-color: white;
}

.content-area {
  flex-grow: 1;
  overflow-y: auto; /* 允许内容区域滚动 */
  padding-bottom: 74px; /* 根据按钮组的高度调整 */
}

#uploadInfo {
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  overflow-y: auto;
  text-align: center;
  cursor: pointer;
}

.upload-icon {
  font-size: 48px;
  color: #999;
  margin-bottom: 20px;
}

p {
  color: #666;
  margin-bottom: 10px;
}

#fileTable {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed; /* 添加这一行 */
}

#fileTable th,
#fileTable td {
  border: 1px solid #ddd;
  padding: 8px;
  text-align: left;
  font-size: 14px; /* 可以根据需要调整字体大小 */
  overflow-wrap: break-word;
  word-wrap: break-word;
  word-break: break-all;
}

.file-name-column {
  white-space: normal;
  word-break: break-word;
}

#fileTable th {
  background-color: #f2f2f2;
}

.button-group {
  position: fixed; /* 固定定位 */
  bottom: 0; /* 固定在底部 */
  left: 0;
  right: 0;
  padding: 20px 0;
  background-color: #f0f0f0;
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.1); /* 添加阴影效果 */
}

button {
  padding: 8px 16px;
  margin: 0 5px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.primary {
  background-color: #007bff;
  color: white;
}

.secondary {
  background-color: #6c757d;
  color: white;
}

.delete-action {
  cursor: pointer;
}

.status-pending {
  color: red;
}

.status-completed {
  color: black;
}

.modal {
  position: fixed;
  z-index: 1;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  overflow: auto;
  background-color: rgba(0, 0, 0, 0.4);
  display: flex;
  justify-content: center;
  align-items: center;
}

.modal-content {
  background-color: #fefefe;
  padding: 20px;
  border: 1px solid #888;
  width: 80%;
  max-width: 500px;
  border-radius: 5px;
}

.modal-content h2 {
  margin: 0 0 20px; /* 取消默认边距 */
}

.modal-content p {
  margin: 20px 0; /* 上下20px的间距 */
}

.form-group {
  margin-bottom: 15px;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
}

.form-group input {
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  box-sizing: border-box;
}

.modal-content button.primary {
  margin-left: 0;
}

.total-row {
  font-weight: bold;
  background-color: #f0f0f0;
}

.total-row td {
  border-top: 2px solid #ddd;
}
</style>
