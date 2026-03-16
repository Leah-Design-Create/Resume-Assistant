# 方式一：免费部署（Vercel 前端 + Render 后端）

部署后：前端在 Vercel，后端在 Render，**完全免费**。  
注意：Render 免费档约 15 分钟无人访问会休眠，HR 第一次打开链接可能要等 **30 秒～1 分钟** 唤醒，之后一段时间内访问会很快。

---

## 一、先把代码放到 GitHub

1. 在 [GitHub](https://github.com) 新建一个仓库（如 `resume-bot`）。
2. 在本地项目目录执行（若已用过 git 可跳过初始化）：
   ```bash
   git init
   git add .
   git commit -m "init"
   git branch -M main
   git remote add origin https://github.com/你的用户名/resume-bot.git
   git push -u origin main
   ```
3. 确保仓库里有 `.env.example`，**不要**把 `.env` 推上去（里面是密钥）。

---

## 二、部署后端到 Render

1. 打开 [Render](https://render.com)，用 GitHub 登录。
2. 点击 **New** → **Web Service**。
3. **Connect** 你的 GitHub 仓库（如 `resume-bot`），选该仓库后点 **Connect**。
4. 配置：
   - **Name**：随便起名，如 `resume-bot-api`。
   - **Region**：选离你或 HR 近的（如 Singapore）。
   - **Branch**：`main`。
   - **Runtime**：`Node`。
   - **Build Command**：`npm install`（默认即可）。
   - **Start Command**：`npm start`（用项目里的 start 脚本）。
   - **Instance Type**：选 **Free**。
5. 点 **Advanced**，在 **Environment Variables** 里添加（必填）：
   - `DASHSCOPE_API_KEY` = 你的阿里云百炼 API Key
   - `DASHSCOPE_MODEL` = `qwen-plus`（或你用的模型）
   - `FRONTEND_ORIGIN` = 先填 `https://your-app.vercel.app`，等 Vercel 部署好后改成你的**真实前端地址**（见下面第三步）。
6. **（推荐）添加 PostgreSQL 以持久化简历数据**：否则 Render 休眠/重启后 `data/` 会清空，分享链接可能变回默认简历。
   - 在 Render 同一账号下点击 **New** → **PostgreSQL**，创建免费数据库（如 `resume-bot-db`）。
   - 创建完成后在数据库详情页复制 **Internal Database URL**（或 **External Database URL**，若 Web Service 与 DB 不在同一区域可用 External）。
   - 回到你的 Web Service → **Environment**，添加变量：`DATABASE_URL` = 粘贴该 URL。
   - 保存后 Render 会重新部署，之后简历与 PDF 会存入数据库，重启后数据不丢失。
7. 点 **Create Web Service**，等部署完成。
8. 在 Render 面板顶部会看到你的服务地址，例如：  
   `https://resume-bot-api.onrender.com`  
   **复制这个地址**，后面 Vercel 要用（不要带末尾斜杠）。

---

## 三、部署前端到 Vercel

1. 打开 [Vercel](https://vercel.com)，用 GitHub 登录。
2. 点击 **Add New** → **Project**，导入**同一个** GitHub 仓库（如 `resume-bot`）。
3. 在配置页：
   - **Framework Preset**：选 **Vite**（或保持自动检测）。
   - **Root Directory**：不填（项目根目录）。
   - **Build Command**：`npm run build`（默认即可）。
   - **Output Directory**：`dist`（Vite 默认）。
4. 点 **Environment Variables**，添加一条：
   - **Name**：`VITE_API_URL`  
   - **Value**：填你在 Render 得到的后端地址并加上 `/api`，例如  
     `https://resume-bot-api.onrender.com/api`
5. 点 **Deploy**，等构建完成。
6. 部署成功后，Vercel 会给你一个地址，例如：  
   `https://resume-bot-xxx.vercel.app`  
   **这就是你的“简历机器人”访问地址**，可以发给 HR。

---

## 四、把前端地址填回 Render（CORS）

1. 回到 Render 你的 Web Service → **Environment**。
2. 找到 `FRONTEND_ORIGIN`，把值改成你在 Vercel 得到的**前端地址**，例如：  
   `https://resume-bot-xxx.vercel.app`  
   （不要末尾斜杠）
3. 保存后 Render 会自动重新部署一次，等完成即可。

---

## 五、使用方式

- 你打开 **Vercel 的前端地址**（如 `https://resume-bot-xxx.vercel.app`）。
- 添加/管理简历：在前端标题下拉框里可「添加简历」「上传 PDF 简历」「上传头像」；或打开 **后端地址 + /admin**（如 `https://resume-bot-api.onrender.com/admin`）上传 PDF、管理简历。
- 选好某份简历后，点右上角 **三个点** → **复制链接**，把链接发给 HR。HR 点开为**仅看模式**（无法切换简历、无法添加/上传/删除），只能查看该简历并对话。

---

## 注意事项

1. **休眠**：Render 免费服务约 15 分钟无访问会休眠，HR 首次打开可能要等 30 秒～1 分钟，属正常现象。
2. **数据**：若未配置 `DATABASE_URL`，免费实例重启或长时间休眠后，`data/` 里的文件有可能被清空，分享链接可能变回默认简历。**配置 Render 的 PostgreSQL 并设置 `DATABASE_URL` 后，简历与 PDF 会持久化到数据库，不再丢失。** 详细步骤见 [docs/配置数据库持久化.md](docs/配置数据库持久化.md)。
3. **密钥**：`DASHSCOPE_API_KEY` 等只填在 Render 的 Environment Variables 里，不要写进代码或提交到 GitHub。

按上述步骤做完后，就是「插入不同简历 → 复制当前链接给 HR → 他们点开网址看到对应简历的机器人页面」的完全免费部署方式。
