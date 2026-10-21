# Token Inspector

本地运行的中文 Token 诊断页面。所有 Token 处理发生在浏览器内，静态服务器不接收凭据。

## 运行

需要 Node.js 20.19+（20.x）或 22.12+。在本目录运行：

```sh
npm ci
npm run dev
```

打开终端显示的 `http://127.0.0.1:5173`。首次安装依赖需要网络；运行和解析不依赖外网。

日常使用构建后的静态页面：

```sh
npm run build
npm run preview
```

打开 `http://127.0.0.1:4173`。两个服务仅监听回环地址，端口被占用时明确失败。停止服务使用 Ctrl+C。不要用 `--host 0.0.0.0` 对外开放。

## 能力与限制

- 单个 JWT 解码，Header / Payload / 中文解释；输入支持 Bearer 前缀，最大 64 KiB UTF-8。
- Entra ID v1/v2 常见字段解释；发行方识别是未验证的域名线索，不是身份认证。
- 紧凑 JWE 公开 Header 展示，不解密、不验证加密参数或完整性。
- 不透明或其他未知 Token 提示限制。Entra Refresh Token 只能由 Microsoft identity platform 读取。
- 使用本机时钟展示 UTC 时间与声明时间诊断；缺失 exp 不代表永不过期。
- 不能仅凭字符串确定 Access / Refresh / ID Token 用途。不支持签名验证、Token 刷新、实际 API 调用或服务端撤销检查。

不上传 Token、不自动读取剪贴板、不记录凭据、不使用 localStorage/sessionStorage、无历史记录、无远程资源。清空按钮移除页面输入与结果，但不承诺擦除浏览器进程内存；请使用可信本机与浏览器，警惕浏览器扩展和共享屏幕。

## 模块

- `src/core.ts`：格式分类、jose 解码、时间诊断、统一 `InspectionResult`。
- `src/providers.ts`：普通模块注册的厂商解释器，目前仅 Entra ID。
- `src/main.ts`：页面交互；所有不可信字段通过 textContent 渲染。
- 页面及 CSS：单页响应式界面，没有后端、路由、数据库或 CDN。

## 验证

```sh
npm test
npm run typecheck
npm run build
npx playwright install chromium
npx playwright test
```

浏览器安装需一次性下载。端到端测试自动启动本地预览，拦截外部请求，并在浏览器离线状态下验证解析、XSS 文本展示及清空行为。测试只使用合成数据，截图位于被忽略的 `test-results/`。

如果本机设置了 HTTP 代理，测试前应将 `127.0.0.1,localhost` 加入 `NO_PROXY`（PowerShell：`$env:NO_PROXY='127.0.0.1,localhost'`），避免本地服务健康检查被转发给代理。

参考：
- https://learn.microsoft.com/en-us/entra/identity-platform/access-tokens
- https://learn.microsoft.com/en-us/entra/identity-platform/refresh-tokens
- https://github.com/panva/jose

总结：用于开发诊断，不可作为认证或授权判断组件。
