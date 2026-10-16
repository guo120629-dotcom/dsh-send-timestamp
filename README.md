# @local/dsh-send-timestamp

在 dsh Web 客户端的聊天输入框工具栏右侧加一个「时间戳」开关。开启后，你提交的每条消息后面会跟一条**只带时间戳的隐藏消息**：对话界面里看不到它，但会话记录里存着、送交模型时也在。

```
对话界面：  你： 帮我看下这个报错

会话记录与模型收到：
  你： 帮我看下这个报错
  （隐藏）[10-16 10:23:45]
```

## 行为

| 规则 | 取值 |
|---|---|
| 默认格式 | `[MM-DD HH:mm:ss]`（月-日 + 时:分:秒，24 小时制，本地时间，各段补零） |
| 预设 `time` | `[HH:mm:ss]`（纯时间） |
| 预设 `datetime` | `YYYY-MM-DD HH:mm:ss`（带年份，不带方括号） |
| 预设回落 | 非法/缺省的 `preset` 一律归一化为默认的 `monthday` |
| **开关粒度** | **逐会话**。`sessions[sessionId]` 优先；该会话从没被用户动过开关时，回落到全局 `enabled`。⇒ 在一个对话里关掉**不会**影响其他对话 |
| 会话 id 来源 | Host 侧 `agent.session.id`（`Session.id` 取 `header.id`）；Client 侧取自槽位 standard props 的 `sessionId` |
| 开关落盘 | settings 路径写 `sessions` dict（Host 端 `Schema.dict(Schema.boolean())` + `.volatile()`）；兜底路径写 localStorage 的 `dsh-send-timestamp:sessions` JSON 表 |
| 预设粒度 | **全局**（格式偏好，不逐会话） |
| 注入形态 | **不改写用户原文**：时间戳作为一条独立合成消息追加在批次末尾 |
| 是否显示 | **不在对话框显示**。合成消息的 `source.kind !== 'user'`，Chat 侧经 `contextMessage()` 归为 `context` 节点；而 `isVisibleChatNode()` 会隐藏不含 `tool-addition`/`tool-removal` 块的 context 节点。用户气泡里只有原话，模型与持久会话记录里照样有时间 |
| 去重 | 末尾已是**当前预设同格式**的时间戳时不追加 |
| 斜杠命令 | `/` 开头（含前导空白）不追加 |
| 取时间时机 | `agent/pre-step` 回调里 `new Date()`，绝不在模块加载时取 |
| 触发条件 | 仅当这一批消息里存在 `role === 'user' && source.kind === 'user'` 的那条时才注入（纯插件上下文步骤不注入） |
| 消息身份 | 合成消息 `id` 用 `crypto.randomUUID()`，发布前 `deepFreeze`（`@deepseek-ai/dsh-brand` 的 `brandString` 是编译期空操作，故与官方 `createUserMessage` 等价） |
| 空文本 | 无 text 片段的纯附件消息不追加 |

## 结构

```
package.json      bundle 声明：dsh.bundle.patch + dsh.client
cordis.patch.yml  - insert: 一行插件行；id `send-timestamp` 同时是设置命名空间
src/timestamp.ts  纯函数：格式化 / 追加 / 去重 / 斜杠判定（host 与 client 共用）
src/index.ts      host：Config（volatile）+ agent/pre-step 监听
src/client/index.tsx    client：槽位注册 + 按钮组件
src/client/toggle.ts    开关持久化的唯一接缝
src/client/styles.ts    主题 token 样式
scripts/build.mjs esbuild 构建
test/             node --test 单元测试与冒烟测试
lib/              构建产物（index.js / client.js / timestamp.js）
```

## 构建与测试

```bash
npm install
npm run build      # → lib/index.js、lib/timestamp.js、lib/client.js
npm test           # → node --test "test/*.test.mjs"
```

构建产物形态：

- `lib/index.js`：ESM，`platform: node`，`@deepseek-ai/schemastery` 保持 external（profile 内已存在）。
- `lib/client.js`：esbuild 的 CJS 产物（`external: ['react']`，classic JSX）包进官方 `window.__ModuleLoader__.load({ id: '<npm 包名>', factory })` 外壳。
- `lib/timestamp.js`：纯函数层的独立 ESM 产物，供测试直接 import。

## 持久化

开关与预设走 **dsh 插件设置（profile 配置）**：Host 端 `Config` 用 `@deepseek-ai/schemastery` 声明，两个字段都 `.volatile()`——设置子系统只把 volatile 字段投影成条目表单，没有 volatile 字段的条目会被 `describe()` 整体跳过。Client 端通过 `ctx.configForms.get('send-timestamp')` 读取与写入（`entryId` 就是 `cordis.patch.yml` 里那一行的 `id`）。

`src/client/toggle.ts` 是唯一接缝：优先 `configForms`，其次第三方 `settingsScope`（`@linxin666/dsh-client-ui-web-ui-settings` 的兼容面），都不可用时退回 `localStorage`（键 `dsh-send-timestamp:enabled` / `dsh-send-timestamp:preset`）。任何一步失败都只降级、不抛错——组件抛错会让整条槽位条目变空白。

手动改默认值可直接编辑 profile 的 `cordis.patch.yml`：

```yaml
- id: send-timestamp
  name: '@local/dsh-send-timestamp'
  config: { enabled: true, preset: 'datetime' }
```

## 为什么改写发生在 Host 端

客户端**没有**任何 pre-submit 拦截点：Enter、发送按钮、`inputActions.submit()` 三条入口全部汇入 `SessionInputShell.submit(mode, source)`，且 `inputActions` 只暴露
`captureInsertion` / `insertText` / `setDraft` / `addAttachments` / `removeAttachment` / `pruneAttachments` / `submit` 七个方法，没有 `send` / `steer`。

唯一官方改写点是 `agent/pre-step` waterfall 的 `decision.messages`——它就是即将落库并送交模型的消息数组。改写时必须：

1. 先 `await next()`，并且不拥有决策；
2. `reject` / `signal.aborted` 原样放行；
3. **spread 决策对象**（`{ ...decision, messages }`），否则 `startsRequestSeries` 等字段会丢；
4. 消息对象是深冻结的且新铸了 id，所以只做浅拷贝并替换 `content`：`{ ...structuredClone(m), content }`，保留 `id` / `role` / `source`。

本插件不 import 任何 `@deepseek-ai/*` 包（`schemastery` 除外），也不 import `dsh-llm`——那些包不在 profile 的 `node_modules` 里。

## 已知边界

- 时间戳追加在 `decision.messages` 上，而该数组正是随后 `session.append("user/message", ...)` 落库并送交模型的内容，因此落库的与模型看到的都是带时间戳的版本；输入框在**提交后立即清空**，所以界面上不会出现「你输入原文 vs 会话里带时间戳」的分叉。
- 未在真实浏览器里验证的部分：按钮的实际渲染位置与外观、`configForms` 写入是否真能落到 Host 的 profile 文档（依赖运行时服务在场）。
- 设置卡片刻意未实现：官方 `settings.plugin.item` 槽位在 0.2 已删除，现役落点是 `plugins.bundle.config`（key = 包名）或 `settings.plugins.tab`。开关本身就在输入框工具栏里，不需要卡片。
