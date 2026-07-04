# JobSearch Agent

一个面向个人求职的 AI 岗位搜索代理。它把简历、岗位搜索、BOSS 直聘页面同步、岗位匹配分析和学习补强建议放到同一个控制台里，适合作为求职作品集项目和个人投递辅助工具。

## 功能亮点

- 岗位搜索控制台：按关键词、城市、区县、岗位类型、经验要求生成候选岗位。
- BOSS 页面同步：通过浏览器扩展或导入脚本，把当前 BOSS 页面上的真实岗位导入本地面板。
- 自动监控面板：使用最近一次搜索条件，定时刷新并把新增岗位推送到最近搜索列表。
- 简历岗位匹配：上传或粘贴简历后，分析更适合的岗位方向、技能缺口、学习路径和推荐公司。
- 本地/AI 双模式：没有 AI API 时也能使用本地规则生成候选和分析；配置 DeepSeek 后可获得更自然的建议。
- 高德找公司入口：岗位卡片提供公司地图搜索入口，方便核验公司位置和真实性。
- 前后端测试：React/Vitest 测试覆盖主要 UI 与 API 封装，后端提供 FastAPI 接口。

## 技术栈

- Backend: Python 3.11, FastAPI, SQLite, Playwright
- Frontend: React 18, TypeScript, Vite, Vitest
- AI: DeepSeek API 可选，本地规则兜底
- Browser Helper: Chrome/Chromium Manifest V3 扩展

## 项目结构

```text
JobSearch-Agent/
├── main_api.py                    # FastAPI 后端入口
├── src/                           # 搜索、筛选、AI 分析和数据库工具
├── web/                           # React 前端控制台
├── boss-collector-extension/      # BOSS 页面岗位导入扩展源码
├── tests/                         # 后端与前端相关测试
├── docs/                          # API、部署、上传检查文档
├── .env.example                   # 环境变量模板
├── Dockerfile                     # 后端容器部署入口
└── DEPLOYMENT.md                  # Cloud Run 等部署参考
```

## 快速开始

### 1. 克隆项目

```bash
git clone https://github.com/yuhui-web/JobSearch-Agent.git
cd JobSearch-Agent
```

### 2. 后端环境

推荐使用虚拟环境：

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

如果你使用 `uv`：

```bash
uv sync
```

复制环境变量模板：

```bash
copy .env.example .env
```

开发环境最小配置：

```env
ENVIRONMENT=development
API_KEY=dev-local-only-change-me
ALLOWED_ORIGIN=http://127.0.0.1:5173
```

可选 DeepSeek 配置：

```env
DEEPSEEK_API_KEY=your_deepseek_key_here
DEEPSEEK_MODEL=deepseek-v4-flash
DEEPSEEK_BASE_URL=https://api.deepseek.com
```

启动后端：

```bash
uvicorn main_api:app --host 127.0.0.1 --port 8011 --reload
```

访问接口文档：

```text
http://127.0.0.1:8011/docs
```

### 3. 前端环境

```bash
cd web
npm install
```

如需自定义 API 地址，创建 `web/.env.local`：

```env
VITE_API_BASE_URL=http://127.0.0.1:8011
VITE_API_KEY=dev-local-only-change-me
```

启动前端：

```bash
npm run dev
```

打开：

```text
http://127.0.0.1:5173
```

## BOSS 直聘岗位同步

这个项目不把 BOSS 当成稳定公开 API，而是把它当成“浏览器侧捕获层”。推荐方式是：

1. 在浏览器里登录 BOSS 直聘。
2. 搜索目标岗位，例如 `python 实习`、`Java 后端实习`。
3. 使用 `boss-collector-extension/` 扩展或页面导入脚本，把当前页面岗位导入 JobSearch Agent。
4. 回到本地控制台查看岗位卡片、简历匹配和公司地图入口。

扩展源码在：

```text
boss-collector-extension/
```

如果需要打包扩展，请不要提交生成的 `.crx` 和 `.pem` 文件，它们已被 `.gitignore` 忽略。

## 常用命令

后端语法检查：

```bash
python -m py_compile main_api.py
```

前端测试：

```bash
cd web
npm test -- --run
```

前端生产构建：

```bash
cd web
npm run build
```

运行后端测试：

```bash
python -m pytest tests/test_search_history_api.py tests/test_boss_deepseek_flow.py
```

如果提示 `No module named pytest`，先安装测试依赖：

```bash
pip install pytest pytest-asyncio httpx
```

## 上线说明

这个项目可以上线，但要区分两部分：

- 前端可以部署到 Vercel、Netlify、静态服务器。
- 后端需要部署到支持 Python/FastAPI 的服务，例如 Cloud Run、Railway、Render、Fly.io 或 VPS。

生产环境必须配置：

```env
ENVIRONMENT=production
API_KEY=<strong-random-api-key>
ALLOWED_ORIGIN=<your-frontend-origin>
```

前端生产环境必须配置：

```env
VITE_API_BASE_URL=<your-backend-api-url>
VITE_API_KEY=<same-value-as-api-key>
```

注意：`ENVIRONMENT=production` 时，如果后端没有配置 `API_KEY`，应用会拒绝启动，避免把默认开发密钥用于线上环境。

## 不要上传的文件

以下内容属于本地运行数据或敏感文件，已经加入 `.gitignore`：

- `.env`
- `output/`
- `jobs/*.db`
- `*.log`
- `browser-data/`
- `*.pem`
- `*.crx`
- `web/node_modules/`
- `web/dist/`

更多检查项见：

```text
docs/GITHUB_UPLOAD_CHECKLIST.md
```

## 当前定位

这是一个个人求职辅助工具，不是代替用户投递的平台。它更适合做三件事：

1. 快速收集岗位候选。
2. 根据简历判断哪些岗位更值得投。
3. 输出技能缺口、简历补强点和学习路线。

## License

MIT
