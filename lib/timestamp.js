// src/timestamp.ts
var DEFAULT_PRESET = "monthday";
var PRESETS = ["time", "monthday", "datetime"];
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
export {
  DEFAULT_PRESET,
  PRESETS,
  formatStamp,
  hasTrailingStamp,
  isSlashCommand,
  normalizePreset,
  stampFor,
  textOf,
  trailingStampRe
};
