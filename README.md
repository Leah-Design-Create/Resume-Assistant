<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/a0abca51-744b-4e60-8157-09d5a4f8e751

## Run Locally

**Prerequisites:** Node.js

1. 安装依赖：`npm install`
2. 在项目根目录创建 `.env`（可复制 `.env.example`），并设置：
   - `DASHSCOPE_API_KEY`：阿里云百炼 API Key（通义千问 Qwen-Plus，聊天功能必填）
3. **同时启动后端与前端**（推荐）：
   - `npm run dev:all`
   - 或分别开两个终端：`npm run server`（端口 3001）、`npm run dev`（端口 3000）
4. 仅启动前端：`npm run dev`（需先启动后端，否则聊天会报错）

前端通过 Vite 代理将 `/api` 请求转发到后端 `http://localhost:3001`，实现前后端联通。

## 简历存储与后台管理

- **存储方式**：简历数据保存在项目根目录的 **`data/resumes.json`** 文件中（JSON 文件，不是数据库）。适合个人或小规模使用；数据可随时用编辑器打开查看或备份。
- **后台管理**：启动后端后，在浏览器打开 **http://localhost:3001/admin**，可查看所有简历、删除、或上传 PDF 识别入库。

## 通过链接分享给不同 HR

- 选好某份简历后，地址栏会自动带上 `?resumeId=xxx`。点击标题旁的 **链接图标** 可复制当前页面链接。
- 把该链接发给 HR，对方打开后会自动定位到这份简历，只看到该候选人的信息和对话。
- 不同简历对应不同链接，插入多份简历后分别复制链接即可分发给不同 HR。

## 头像识别（PDF 简历证件照）

上传 PDF 时，会先用**前端 face-api.js** 在第一页图上检测人脸框，把框坐标发给后端裁剪头像；若前端未检测到人脸或模型未加载，则回退到**服务端通义千问 VL** 识别人脸中心再裁剪。需安装依赖：`npm install`（含 `face-api.js`）。前端模型从 CDN 加载，无需本地放置权重文件。
