# 简历机器人 (Resume Assistant)

基于 AI 的智能简历展示与对话助手。支持上传 PDF 简历、自动解析与头像裁剪，并通过链接分享给不同 HR，对方可针对单份简历与 AI 对话了解候选人信息。

## 功能特点

- **简历管理**：上传 PDF 简历，自动解析内容并存入本地 JSON；支持在后台查看、删除
- **AI 对话**：基于通义千问的聊天，针对当前简历回答候选人背景、项目、技能等问题
- **链接分享**：每份简历对应唯一链接（`?resumeId=xxx`），复制链接发给 HR 即可单独查看该候选人并对话
- **头像识别**：上传 PDF 时自动识别人脸/证件照并裁剪为头像（前端 face-api.js + 服务端通义千问 VL 兜底）

## 技术栈

- **前端**：React 19、Vite、Tailwind CSS、MUI、Motion
- **后端**：Node.js、Express、TypeScript
- **AI**：阿里云百炼 DashScope（通义千问文本 + 视觉模型）
- **简历解析**：pdf-parse、pdfjs-dist；头像裁剪：sharp、face-api.js

## 环境要求

- **Node.js**（建议 18+）
- 阿里云百炼 API Key（[获取地址](https://bailian.console.aliyun.com/#/api-key)）

## 快速开始

### 1. 克隆并安装依赖

```bash
git clone <你的仓库地址>
cd 简历机器人
npm install
```

### 2. 配置环境变量

在项目根目录创建 `.env` 文件（可复制 `.env.example` 后修改），至少配置：

| 变量名 | 说明 | 必填 |
|--------|------|------|
| `DASHSCOPE_API_KEY` | 阿里云百炼 API Key | ✅ |
| `DASHSCOPE_MODEL` | 文本模型，如 `qwen-plus` | 可选，默认 qwen-plus |
| `DASHSCOPE_VL_MODEL` | 视觉模型（PDF 人脸识别），如 `qwen-vl-max` | 可选 |
| `PORT` | 后端端口，默认 3001 | 可选 |
| `FRONTEND_ORIGIN` | 前端地址，开发时 `http://localhost:3000` | 可选 |

### 3. 启动项目

**推荐：前后端一起启动**

```bash
npm run dev:all
```

或分别启动：

- 终端 1：`npm run server`（后端，端口 3001）
- 终端 2：`npm run dev`（前端，端口 3000）

前端通过 Vite 代理将 `/api` 转发到后端，无需额外配置。

- 访问前端：<http://localhost:3000>
- 访问后台管理：<http://localhost:3001/admin>

## 数据存储

- 简历数据保存在项目根目录 **`data/resumes.json`**（JSON 文件，非数据库）
- 适合个人或小规模使用，可直接用编辑器查看或备份
- 后台管理页可查看所有简历、删除、上传 PDF 识别入库

## 通过链接分享给 HR

1. 在应用中选中某份简历，地址栏会带上 `?resumeId=xxx`
2. 点击标题旁的 **链接图标** 复制当前页面链接
3. 将链接发给 HR，对方打开后只会看到该候选人的简历与对话
4. 多份简历对应多个链接，可分别复制后分发给不同 HR

## 头像识别（PDF 证件照）

- 上传 PDF 时，优先用前端 **face-api.js** 在第一页检测人脸框，将坐标发给后端裁剪头像
- 若前端未检测到人脸或模型未加载，则回退到服务端 **通义千问 VL** 识别人脸中心再裁剪
- face-api.js 模型从 CDN 加载，无需在本地放置权重文件

## 脚本说明

| 命令 | 说明 |
|------|------|
| `npm run dev` | 仅启动前端（需先启动后端，否则聊天报错） |
| `npm run server` | 仅启动后端 |
| `npm run dev:all` | 同时启动前端与后端 |
| `npm run build` | 构建前端产物 |
| `npm run preview` | 预览构建结果 |
| `npm run lint` | TypeScript 检查 |

## 许可证

可按需自行添加（如 MIT）。
