// src/index.ts
import { randomUUID } from "node:crypto";
import Schema from "@deepseek-ai/schemastery";

// src/timestamp.ts
var DEFAULT_PRESET = "monthday";
var pad2 = (value) => String(value).padStart(2, "0");
function normalizePreset(value) {
  return value === "time" || value === "monthday" || value === "datetime" ? value : DEFAULT_PRESET;
}
function formatStamp(now, preset) {
  const clock = `${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}`;
  const monthDay = `${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
  if (preset === "datetime") return `${now.getFullYear()}-${monthDay} ${clock}`;
  if (preset === "monthday") return `[${monthDay} ${clock}]`;
  return `[${clock}]`;
}
function trailingStampRe(preset) {
  if (preset === "datetime") return /\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
  if (preset === "monthday") return /\[\d{2}-\d{2} \d{2}:\d{2}:\d{2}\]$/;
  return /\[\d{2}:\d{2}:\d{2}\]$/;
}
function hasTrailingStamp(text, preset) {
  return trailingStampRe(preset).test(text);
}
function isSlashCommand(text) {
  return text.trimStart().startsWith("/");
}
function textOf(content) {
  if (!Array.isArray(content)) return "";
  let out = "";
  for (const part of content) {
    if (part && part.type === "text" && typeof part.text === "string") out += part.text;
  }
  return out;
}
function stampFor(text, now, preset) {
  if (text.trim() === "") return null;
  if (isSlashCommand(text)) return null;
  if (hasTrailingStamp(text, preset)) return null;
  return formatStamp(now, preset);
}

// src/index.ts
var name = "send-timestamp";
var SOURCE_KIND = name;
var Config = Schema.object({
  /** 全局默认开关；某个会话没设过自己的值时用它。 */
  enabled: Schema.boolean().default(false).volatile(),
  preset: Schema.union(["time", "monthday", "datetime"]).default(DEFAULT_PRESET).volatile(),
  /** 逐会话覆盖：`{ [sessionId]: boolean }`。只记用户真正动过开关的会话。 */
  sessions: Schema.dict(Schema.boolean()).default({}).volatile()
});
function readLive(ref, fallback) {
  if (ref !== null && typeof ref === "object" && typeof ref.get === "function") {
    const value = ref.get();
    return value ?? fallback;
  }
  return ref ?? fallback;
}
function isEnabledFor(config, sessionId) {
  const source = config;
  if (sessionId !== null) {
    const overrides = readLive(source?.sessions, null);
    if (overrides !== null && typeof overrides === "object") {
      const own = overrides[sessionId];
      if (typeof own === "boolean") return own;
    }
  }
  return readLive(source?.enabled, false);
}
function deepFreeze(value) {
  if (value !== null && typeof value === "object") {
    for (const key of Object.getOwnPropertyNames(value)) {
      deepFreeze(value[key]);
    }
    Object.freeze(value);
  }
  return value;
}
function stampMessage(text) {
  return deepFreeze({
    id: randomUUID(),
    role: "user",
    content: [{ type: "text", text }],
    source: { kind: SOURCE_KIND, form: "snapshot", sections: [{ name: SOURCE_KIND, text }] }
  });
}
function sessionIdOf(agent) {
  const session = agent?.session;
  return typeof session?.id === "string" ? session.id : null;
}
function apply(ctx, config) {
  ctx.on(
    "agent/pre-step",
    async ({ agent, signal }, next) => {
      const decision = await next();
      if (decision?.kind === "reject" || signal?.aborted) return decision;
      if (!isEnabledFor(config, sessionIdOf(agent))) return decision;
      const preset = normalizePreset(readLive(config?.preset, DEFAULT_PRESET));
      const now = /* @__PURE__ */ new Date();
      const messages = Array.isArray(decision.messages) ? decision.messages : [];
      const stamps = messages.filter((message) => message?.role === "user" && message?.source?.kind === "user").map((message) => stampFor(textOf(message.content), now, preset)).filter((stamp) => stamp !== null);
      if (stamps.length === 0) return decision;
      return { ...decision, messages: [...messages, stampMessage(stamps[stamps.length - 1])] };
    },
    { prepend: true }
  );
}
export {
  Config,
  SOURCE_KIND,
  apply,
  isEnabledFor,
  name
};
