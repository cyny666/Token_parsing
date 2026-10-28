# Token Inspector

本地运行的中文 Token 诊断页面。所有 Token 解码和密码学验证发生在浏览器内，静态服务器不接收凭据。

界面参考 jwt.io 的解码器布局：左侧 Encoded Token，右侧 Decoded Header / Payload。输入后自动解析，JWT 三段分别着色；右侧支持 JSON 高亮与中文字段解释切换，以及点击复制 Header / Payload。复制内容会进入系统剪贴板，清空页面不会清除系统剪贴板。摘要与诊断位于输入区下方的折叠面板。

## 用途入口

- 提供 Access Token / ID Token / Refresh Token 三个标签页，默认 Access Token；可点击或使用左右方向键、Home / End 切换。
- Access 与 ID 复用现有 JWT/JWE/不透明格式处理、中文字段解释与验签能力。ID 入口不新增 nonce、预期受众等用途专属校验；平台字段说明仍是通用知识，不代表适用于所有 ID Token。
- Refresh 可实验性解析原始 `1.<描述段>.<不透明载荷>` 的公开描述段：仅版本 1、规范 Base64URL、解码后恰好 40 字节，按 .NET GUID 字节序提取 Tenant ID / Client ID，并匹配已知应用名。显示前缀/尾部 Hex 与不透明载荷字节数，不解释前缀/尾部语义。其他版本、长度或编码异常时停止解释，不尝试套用其他布局。
- 这来自公开研究的 PRT 样例观察，不是微软保证的通用 RT/PRT 规范；结果始终标为“实验性 / 未验证”，不确认输入真实性、租户身份、用户、权限、有效期或实际可用性。不解析外层 PRT Cookie，不解密载荷、不提供复制结果、不验签、不下载公钥、不执行刷新或换票请求。其他输入保留原有格式/限制提示。
- 入口是用户选择的用途，不是工具自动识别或确认的用途；仅凭字符串格式不能确定 Access / ID / Refresh。
- 切换到另一入口即清空 Token、手动密钥、结果及内存公钥缓存，取消待执行解析与验签。不会分别保存各入口凭据，不改变已有手动算法选择策略。

## 自动验签

- 默认自动模式：全球云 Entra v1/v2 的 RS256 JWT 根据精确发行方格式和 `kid` 自动下载微软 JWKS，并在本地验签。仅 GET `https://login.microsoftonline.com/{tenant}/discovery/keys` 或 `.../discovery/v2.0/keys`；不携带 Token、Authorization、Cookie 或 Referrer，不跟随重定向。
- 此模式需要联网。微软可见本机 IP 和公开发行方租户 ID。网络/CORS/超时或缺少匹配公钥时显示“未验证”，不伪报“签名不匹配”。其他发行方和主权云请使用手动模式，不访问 Token 内的 `jku`、`x5u` 或任意发行方地址。
- 手动密钥模式完全离线：输入可信 SPKI PEM 公钥、X.509 证书或公开 JWK/JWKS；不接受私钥。也支持 HS256/384/512 原文或 Base64 共享密钥，按算法要求至少 32/48/64 字节。算法需独立选择，不能由 Token 自动降低验签策略。
- 支持 RS256/384/512、PS256/384/512、ES256/384/512、EdDSA 与 HS256/384/512。浏览器须支持所选 Web Crypto 算法。
- Access / ID 入口输入 Token、密钥、算法变化后自动验签；无须点击验证按钮。清空或切换入口时移除 Token、密钥及内存公钥缓存。异步旧结果不会覆盖新输入；Refresh 入口禁用验签。
- 仅做签名/MAC 匹配，不等于完整 Token 有效性验证：过期时间单独显示，不校验预期发行方/受众、撤销或 API 权限。手动密钥来源、证书信任链需自行确认。自动模式从已知微软来源取公钥，但不将其等同于完整租户授权验证。
- 公钥仅在页面内存缓存 5 分钟，最多 8 个发行方。若密钥轮换造成找不到 `kid`，清空页面后重试可重新取公钥。不在磁盘存储 Token、共享密钥或公钥缓存。

## 运行

需要 Node.js 20.19+（20.x）或 22.12+。在本目录运行：

```sh
npm ci
npm run dev
```

打开终端显示的 `http://127.0.0.1:5173`。首次安装依赖需要网络；解码与手动验签不依赖外网，自动获取微软公钥需要联网。

日常使用构建后的静态页面：

```sh
npm run build
npm run preview
```

打开 `http://127.0.0.1:4173`。两个服务仅监听回环地址，端口被占用时明确失败。停止服务使用 Ctrl+C。不要用 `--host 0.0.0.0` 对外开放。

## 能力与限制

- 单个 JWT 解码，Header / Payload / 中文解释；输入支持 Bearer 前缀，最大 64 KiB UTF-8。
- Entra ID v1/v2 字段含义解释与取值匹配（amr 认证方法、appidacr/azpacr 客户端认证方式、ver 与发行方格式、消费者租户 GUID、scp/roles 数量、xms_cc cp1、groups overage 等）；发行方识别是未验证的域名线索，不是身份认证。
- 权限解释先按 `aud` 选择资源字典。首版仅收录 Microsoft Graph 的 GUID 与 `https://graph.microsoft.com`（可带末尾 `/`）精确别名；缺失、多值、类型异常、其他资源或仅匹配到应用名时，保留原始 JSON，不套用 Graph 描述或高危规则。
- Access 入口的 `scp` 按委托范围解释；`roles` 仅在声明 `idtyp=app` 且完全没有 `scp` 时，按“应用权限线索（未验证）”选择应用权限字典。其余 `roles` 视为应用角色/未确定上下文，保留原值；`idtyp=app` 与 `scp` 同时出现时提示线索冲突，两类值都不套表。ID 入口不套用 API 权限字典。`wids` 单独标为目录角色 RoleTemplateID，保留 GUID，不与 API 权限混用。
- Graph 委托和应用权限使用不同描述，仅对该类型下已收录的精确值生成说明及风险标记；未收录值不按名称前缀猜测。中文说明来自微软 MIT 许可的公开权限元数据，筛选范围限于原有知识表中的名称；它是本地静态快照，不是完整、实时的权限目录，也不代表租户实际授权。
- azp/appid 与 aud 仍匹配已知第一方应用名与 API 名，FOCI/BroCi 客户端维持原有标记；这些标记与权限资源字典分开处理，不是身份认证。
- 紧凑 JWE 公开 Header 展示，不解密、不验证加密参数或完整性。
- 不透明或其他未知 Token 提示限制。Entra Refresh Token 的加密内容只能由 Microsoft identity platform 读取；Refresh 页的公开描述段解析不是密文解密。
- 使用本机时钟展示 UTC 时间与声明时间诊断；缺失 exp 不代表永不过期。
- 不能仅凭字符串确定 Access / Refresh / ID Token 用途；用途标签页不改变这一限制。不支持 Token 刷新、实际 API 调用或服务端撤销检查。

不上传 Token、不自动读取剪贴板、不记录凭据、不使用 localStorage/sessionStorage、无历史记录或外部脚本。自动验签仅下载公开微软密钥；切换手动模式可完全离线。清空按钮移除页面输入与结果，但不承诺擦除浏览器进程内存；请使用可信本机与浏览器，警惕浏览器扩展和共享屏幕。

## 模块

- `src/core.ts`：格式分类、jose 解码、时间诊断、统一 `InspectionResult`。
- `src/providers.ts`：普通模块注册的厂商解释器，目前仅 Entra ID；提供全部官方声明的中文解释与常见取值匹配。
- `src/permissions.ts`：aud 与权限类型上下文、精确权限匹配、第一方客户端和受众名称匹配。
- `src/graph-permissions.ts`：按委托/应用类型分开的 Graph 中文权限描述快照；来源与 MIT 许可见 `THIRD_PARTY_NOTICES.txt`，运行时不联网更新。
- `src/main.ts`：用途切换、公共输入事件及解析调度；切换即清空状态。
- `src/modes/`：Access、ID、Refresh 的独立入口定义；Access / ID 共享底层解析，Refresh 仅传递格式与实验性公开元数据，不传递解码声明。
- `src/refresh-structure.ts`：实验性描述段布局检查、Base64URL 解码与 .NET GUID 转换；无密文解密或联网功能。
- `src/decoder.ts`：共享的解码展示、复制与验签交互；所有不可信字段通过 textContent 渲染，Refresh 模式阻止验签调度。
- `src/verification.ts`：基于 jose/Web Crypto 的独立验签、可信微软公钥下载、输入策略与内存缓存。
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
- https://insinuator.net/2026/10/token-theft-in-microsoft-entra-id-part-3-of-4-token-protection/ （研究样例布局，并非通用格式规范）
- https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-oapxbc/f775b7dc-9638-490b-8d71-a968ef2311bf （PRT 结构为实现细节）
- https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-oapxbc/8dc82e94-89cf-4f74-96aa-236ce585cd2e （Windows Broker 客户端 ID）
- https://learn.microsoft.com/en-us/entra/identity-platform/access-tokens
- https://learn.microsoft.com/en-us/entra/identity-platform/refresh-tokens
- https://learn.microsoft.com/en-us/graph/permissions-reference
- https://github.com/zh54321/GraphPreConsentExplorer
- https://github.com/panva/jose

总结：用于开发诊断，不可作为认证或授权判断组件。
