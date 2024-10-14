# ai-invoice

本插件基于 `https://github.com/QC2168/utools-plugin-template.git` 插件开发模板

99% 的代码都是由 Cursor 辅助完成

## ✨ 特性

- 🌈 发票识别，支持 pdf，图片
- ⚡ 发票导出为 excel

## 百度 AI 平台申请 ApiKey 和 SecretKey

常量 APP_ID 在百度智能云控制台中创建，常量 API_KEY 与 SECRET_KEY 是在创建完毕应用后，系统分配给用户的，均为字符串，用于标识用户，为访问做签名验证，可在 AI 服务控制台中的应用列表中查看。详见：https://ai.baidu.com/ai-doc/OCR/dk3iqnq51

## Roadmap

- [ ] 支持从邮件导入发票
- [ ] 短信/网址识别

## 🥩 开始使用

### 🔗 克隆项目

```bash
git clone https://github.com/shangdev/ai-invoice
```

### 🔧 安装依赖

> 推荐使用`pnpm`包管理工具，如果您还没有安装可以执行`npm install -g pnpm`进行安装

```bash
pnpm install
```

### 🛫 启动项目

```bash
pnpm dev
```

### 📦 打包项目

```bash
pnpm build
node install.js
```

> 执行`build`命令时，会将插件直接构建成`upx`包，开发者无需在`utools`开发者工具中二次构建 🚀

## 🍭 最后

如果您有更好的想法，欢迎提交`issue`或者`pr` 🥰🥰

如果您觉得这个项目对您有帮助，可以点击右上角的`star`按钮支持一下我，谢谢您~ 😘😘
