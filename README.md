# Agent Terminal Clarity · 终端清晰

深色主题里，不必盯着字重找重点：**标题亮黄、强调暖金、代码/路径紫色、正文灰白**。用于 Pi Desktop、Codex/ChatGPT 桌面端和 ZCode。

不换壁纸，不改侧栏，不统一覆盖字体或字号；保留原来的代码块语法配色、输入框、权限卡和操作按钮。

## Windows 使用

从 [Releases](https://github.com/chosenperson/agent-terminal-clarity/releases) 下载 ZIP，解压整个目录。Codex/ZCode 需要 **Node.js 22 或更新版本**，无需 `npm install`。首次使用前请检查源码。

### Codex / ChatGPT 桌面端

1. 保存工作并**完全退出**桌面端，包括后台进程。
2. 双击 `START-CODEX.cmd`。
3. 打开一条现有回复。旧消息直接套用配色，不用重新生成。

### ZCode

保存工作并完全退出 ZCode，双击 `START-ZCODE.cmd`，然后打开原有对话。不会修改已有 ZCode 提示词增强补丁、模型配置或会话数据。

启动器用正常窗口启动客户端，不关闭任何已运行程序。已经由本工具启动的实例可重复点击 START：窗口会显示到前台，并复用已有 watcher；普通启动、没有主题端口的实例仍需先完全退出。端口被其他程序占用或 Node 版本过低时会停止并说明原因。使用自定义安装位置：

```powershell
powershell -NoProfile -File .\launch.ps1 -App zcode -AppPath "D:\Apps\ZCode\ZCode.exe"
```

如果系统执行策略阻止脚本，请保留报错并由你决定处理方式；脚本不会改执行策略、提权或自动绕过限制。

### Pi Desktop

在「扩展 → … → 安装插件包」导入 Release 内的 `terminal-clarity-1.0.0.piplug`，再在「设置 → 常规 → 主题」选择 **终端清晰 · Pi CLI**。

Pi 使用原生 `ui.theme` 主题能力，不需要 Node 或调试端口。0.20.1 要求的入口文件只导出空对象，CSS 由宿主加载。

## 恢复原样

- Codex：双击 `RESTORE-CODEX.cmd`。
- ZCode：双击 `RESTORE-ZCODE.cmd`。
- Pi：在设置里选回「深色」或原来的主题。

恢复命令通知主题 watcher 退出，并移除它自己的样式。若程序已关闭，内存样式已经消失。

**关闭调试端口**：完全退出相应桌面端，再用官方普通快捷方式启动。恢复 CSS 不会让一个正在运行的 Chromium 自动关闭调试端口。

启动器不创建计划任务、服务或开机启动。之后想继续使用配色，仍用本目录的 START 入口启动。

## 安全与工作方式

Codex/ZCode 通过各自的**仅回环地址** CDP 端口注入 CSS，端口分别为 `127.0.0.1:29471`、`127.0.0.1:29472`。CDP 本身具有完整页面调试能力；同机其他进程可能连接它，因此只在信任的本机环境使用，不要映射或转发到网络。

- 不修改官方安装包、ASAR、签名、认证、模型配置或聊天数据。
- 只执行插入/移除一个固定 ID 样式元素的脚本，不读取对话正文或发送模型请求。
- 不注入 HTTP 本地预览网站，不使用外部图片、远程 CSS 或网络字体。
- watcher 每三秒处理新页面/重载；完全退出应用后，连续 30 秒无法连接则自行结束。
- 运行日志只含状态计数和连接错误，位于 `%LOCALAPPDATA%\AgentTerminalClarity`；启动错误另存到 `<客户端>-launch.log`。CMD 出错后保留窗口并返回失败退出码，不把 pause 成功误报为启动成功。
- 异常崩溃可能留下 `codex.lock` / `zcode.lock`。文件内容是 watcher PID；确认该 PID 已不存在后，才移除对应 lock，不要结束不明进程。

## 兼容与验证

| 客户端 | 适配依据 | 本次验证 |
|---|---|---|
| Pi Desktop 0.20.1 | 原生主题插件与 `.prose-chat` | 已安装启用，真实旧回复目视验收通过 |
| Codex/ChatGPT Desktop 26.1016.8622.0 | 本机 CSS 资源版本 26.1016.62342，`_MarkdownContent_` 和 Markdown 数据属性 | 安装资源检查；离线渲染/传输测试。需退出当前客户端后启动，完成真实会话验收 |
| ZCode 3.16.2.8769 | 本机 3.16.2 Markdown 容器类与开源 `MessageResponse` | 1.0.1 已实际拉起客户端，打开旧回复目视确认配色；START 重复启动显示窗口并复用 watcher 已通过 |

这不是官方插件接口。桌面端将来更改文档 URL、主题标记或 Markdown DOM 时可能需要适配；启动成功或 CSS 传输成功，不等于新版本已完成视觉验收。若没有变化，查看日志中的 roots 计数和主题明暗设置。

不强制切换到深色主题；浅色模式不着色。

## 为什么不用现成整套换肤

- [OpenAI 官方外观设置](https://learn.chatgpt.com/docs/reference/settings)：支持界面主题色和字体，未提供正文强调元素独立配色项。
- [CDXTheme](https://github.com/croath/CDX-Theme)：已有跨平台主题管理器与运行时 CSS；适合希望管理整套皮肤的人。
- [Cobalt Gold](https://github.com/chainshieldai/codex-cobalt-gold-theme)：已有 Markdown 配色和本机 CDP 方案。本项目沿用其不改安装包的技术路线，缩小到语义配色，并适配当前 Codex DOM 与 ZCode。
- [ZCode 外观设计](https://github.com/zai-org/ZCode/blob/main/docs/ui/settings-appearance.md)：原生设置管理明暗、字号和代码主题；正文重点配色由本项目的 CSS 处理。

## 开发

`themes/*.css` 是可直接修改的样式；修改生成器时运行：

```powershell
node build-themes.mjs
node --test test-runtime.mjs
powershell -NoProfile -File .\launch.ps1 -App codex -Action Check
```

改 CSS 后先恢复 watcher，再从 START 入口重新启动。运行中的应用不必关闭时，可手动执行 `node runtime.mjs --app codex --watch` 重新加载样式；仅限已经通过本启动器开放相应端口的实例。

MIT License。只分发本项目源码和 Pi 主题，不分发客户端程序或用户数据。
