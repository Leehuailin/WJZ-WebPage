# WJZ-WebPage — Life Gallery

一个可共享的生活相册网页，所有访客都能看到上传的照片。

## 功能

- 上传照片（支持多选、拖拽）
- 按日期、标签、关键词筛选
- 灯箱查看、编辑、删除照片
- 照片存储在云端，所有人都能看见

## 配置 Firebase（必须先完成才能使用）

本项目使用 **Firebase**（Firestore + Storage）存储照片，让所有访客共享同一份数据。

### 第一步：创建 Firebase 项目

1. 打开 [Firebase Console](https://console.firebase.google.com/)，登录 Google 账号
2. 点击「新建项目」，填写项目名称，按提示完成创建
3. 在项目首页点击「</> Web」图标，注册一个 Web 应用，复制弹出的 `firebaseConfig` 对象

### 第二步：开启 Firestore 数据库

1. 左侧菜单选择「构建 → Firestore Database」
2. 点击「创建数据库」，选择「以测试模式启动」（之后可按需收紧规则）
3. 选择离你最近的区域，点击「启用」

### 第三步：开启 Storage（图片存储）

1. 左侧菜单选择「构建 → Storage」
2. 点击「开始使用」，选择「以测试模式启动」
3. 选择区域，点击「完成」

### 第四步：填写配置

打开 `js/app.js`，找到文件顶部的 `firebaseConfig` 对象，将占位符替换为你在第一步复制的真实值：

```js
const firebaseConfig = {
  apiKey:            "你的 apiKey",
  authDomain:        "你的项目.firebaseapp.com",
  projectId:         "你的项目 ID",
  storageBucket:     "你的项目.appspot.com",
  messagingSenderId: "你的 messagingSenderId",
  appId:             "你的 appId",
};
```

保存文件后，将更改推送到 GitHub，GitHub Pages 会自动更新。

### 第五步（可选）：收紧安全规则

测试模式下任何人都可以写入数据。如果只想让你自己上传（其他人只能查看），可在 Firebase Console 中修改 Firestore 和 Storage 的安全规则，加入身份验证校验。
