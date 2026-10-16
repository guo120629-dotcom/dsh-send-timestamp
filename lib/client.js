window.__ModuleLoader__.load({
  id: "@local/dsh-send-timestamp",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    "use strict";
    var __create = Object.create;
    var __defProp = Object.defineProperty;
    var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
    var __getOwnPropNames = Object.getOwnPropertyNames;
    var __getProtoOf = Object.getPrototypeOf;
    var __hasOwnProp = Object.prototype.hasOwnProperty;
    var __export = (target, all) => {
      for (var name2 in all)
        __defProp(target, name2, { get: all[name2], enumerable: true });
    };
    var __copyProps = (to, from, except, desc) => {
      if (from && typeof from === "object" || typeof from === "function") {
        for (let key of __getOwnPropNames(from))
          if (!__hasOwnProp.call(to, key) && key !== except)
            __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
      }
      return to;
    };
    var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
      // If the importer is in node compatibility mode or this is not an ESM
      // file that has been converted to a CommonJS file using a Babel-
      // compatible transform (i.e. "__esModule" has not been set), then set
      // "default" to the CommonJS "module.exports" for node compatibility.
      isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
      mod
    ));
    var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

    // src/client/index.tsx
    var index_exports = {};
    __export(index_exports, {
      apply: () => apply,
      inject: () => inject,
      name: () => name
    });
    module.exports = __toCommonJS(index_exports);
    var React = __toESM(require("react"), 1);

    // locale/en.json
    var en_default = {
      "button.label": "Timestamp",
      "button.titleOn": "On: this conversation gets a timestamp (not shown in the bubble)",
      "button.titleOff": "Off: this conversation gets no timestamp (other conversations are unaffected)",
      "hint.localOnly": "Settings service unavailable \u2014 kept in this browser only",
      "preset.time": "[HH:mm:ss]",
      "preset.monthday": "[MM-DD HH:mm:ss]",
      "preset.datetime": "YYYY-MM-DD HH:mm:ss"
    };

    // locale/zh.json
    var zh_default = {
      "button.label": "\u65F6\u95F4\u6233",
      "button.titleOn": "\u5DF2\u5F00\u542F\uFF1A\u672C\u5BF9\u8BDD\u53D1\u9001\u65F6\u8FFD\u52A0\u5F53\u524D\u65F6\u95F4\uFF08\u4E0D\u663E\u793A\u5728\u6C14\u6CE1\u91CC\uFF09",
      "button.titleOff": "\u5DF2\u5173\u95ED\uFF1A\u672C\u5BF9\u8BDD\u4E0D\u8FFD\u52A0\u65F6\u95F4\u6233\uFF08\u5176\u4ED6\u5BF9\u8BDD\u4E0D\u53D7\u5F71\u54CD\uFF09",
      "hint.localOnly": "\u8BBE\u7F6E\u670D\u52A1\u4E0D\u53EF\u7528\uFF0C\u4EC5\u5728\u672C\u5730\u6D4F\u89C8\u5668\u4FDD\u5B58",
      "preset.time": "[HH:mm:ss]",
      "preset.monthday": "[MM-DD HH:mm:ss]",
      "preset.datetime": "YYYY-MM-DD HH:mm:ss"
    };

    // src/client/styles.ts
    var buttonStyle = {
      display: "inline-flex",
      alignItems: "center",
      gap: 4,
      padding: "4px 10px",
      fontSize: 12,
      lineHeight: "18px",
      borderRadius: "var(--dsw-radius-sm, 6px)",
      border: "1px solid var(--dsw-alias-border-l3, rgba(128, 128, 128, 0.35))",
      background: "var(--dsw-alias-button-tool-bar-fill, transparent)",
      color: "var(--dsw-alias-label-primary, inherit)",
      cursor: "pointer",
      whiteSpace: "nowrap"
    };
    var activeStyle = {
      background: "var(--dsw-alias-button-tool-bar-hover, var(--dsw-alias-interactive-bg-hover, rgba(128, 128, 128, 0.16)))",
      borderColor: "var(--dsw-alias-border-l4, rgba(128, 128, 128, 0.5))"
    };
    var inactiveStyle = {
      color: "var(--dsw-alias-label-secondary, inherit)"
    };
    var focusRing = "var(--dsw-focus-ring-color, #4f7cf7)";

    // src/timestamp.ts
    var DEFAULT_PRESET = "monthday";
    function normalizePreset(value) {
      return value === "time" || value === "monthday" || value === "datetime" ? value : DEFAULT_PRESET;
    }

    // src/client/toggle.ts
    var NAMESPACE = "send-timestamp";
    var ENABLED_KEY = "dsh-send-timestamp:enabled";
    var PRESET_KEY = "dsh-send-timestamp:preset";
    var SESSIONS_KEY = "dsh-send-timestamp:sessions";
    function warn(message, error) {
      try {
        console.warn(`[${NAMESPACE}] ${message}`, error ?? "");
      } catch {
      }
    }
    function storage() {
      try {
        return typeof localStorage === "undefined" ? null : localStorage;
      } catch {
        return null;
      }
    }
    function readLocalSessions() {
      const store = storage();
      if (store === null) return {};
      try {
        const raw = store.getItem(SESSIONS_KEY);
        const parsed = raw === null ? null : JSON.parse(raw);
        return parsed !== null && typeof parsed === "object" ? parsed : {};
      } catch (error) {
        warn("localStorage \u8BFB\u53D6\u9010\u4F1A\u8BDD\u8868\u5931\u8D25", error);
        return {};
      }
    }
    function writeLocalSessions(map) {
      const store = storage();
      if (store === null) return;
      try {
        store.setItem(SESSIONS_KEY, JSON.stringify(map));
      } catch (error) {
        warn("localStorage \u5199\u5165\u9010\u4F1A\u8BDD\u8868\u5931\u8D25", error);
      }
    }
    function readLocalGlobalEnabled() {
      const store = storage();
      if (store === null) return false;
      try {
        return store.getItem(ENABLED_KEY) === "1";
      } catch (error) {
        warn("localStorage \u8BFB\u53D6\u5168\u5C40\u5F00\u5173\u5931\u8D25", error);
        return false;
      }
    }
    function readLocalPreset() {
      const store = storage();
      if (store === null) return DEFAULT_PRESET;
      try {
        return normalizePreset(store.getItem(PRESET_KEY));
      } catch (error) {
        warn("localStorage \u8BFB\u53D6\u9884\u8BBE\u5931\u8D25", error);
        return DEFAULT_PRESET;
      }
    }
    function writeLocalEnabled(sessionId, next) {
      const store = storage();
      if (store === null) return;
      try {
        if (sessionId !== null) {
          const map = readLocalSessions();
          map[sessionId] = next;
          writeLocalSessions(map);
          return;
        }
        store.setItem(ENABLED_KEY, next ? "1" : "0");
      } catch (error) {
        warn("localStorage \u5199\u5165\u5F00\u5173\u5931\u8D25", error);
      }
    }
    function writeLocalPreset(next) {
      const store = storage();
      if (store === null) return;
      try {
        store.setItem(PRESET_KEY, next);
      } catch (error) {
        warn("localStorage \u5199\u5165\u9884\u8BBE\u5931\u8D25", error);
      }
    }
    function localEnabledFor(sessionId) {
      if (sessionId !== null) {
        const map = readLocalSessions();
        if (typeof map[sessionId] === "boolean") return map[sessionId];
      }
      return readLocalGlobalEnabled();
    }
    function createToggleStore(ctx) {
      const listeners = /* @__PURE__ */ new Set();
      let face = null;
      let faceUnsubscribe = null;
      function refresh() {
        for (const listener of [...listeners]) {
          try {
            listener();
          } catch (error) {
            warn("\u8BA2\u9605\u8005\u56DE\u8C03\u629B\u9519", error);
          }
        }
      }
      function settingsState(sessionId) {
        const current = face;
        if (current === null) return null;
        let snap;
        try {
          snap = current.getSnapshot();
        } catch (error) {
          warn("settings \u5FEB\u7167\u8BFB\u53D6\u5931\u8D25\uFF0C\u6539\u7528\u672C\u5730\u515C\u5E95", error);
          return null;
        }
        if (snap == null || snap.status === "unavailable") return null;
        const value = snap.value ?? {};
        const map = value.sessions !== null && typeof value.sessions === "object" ? value.sessions : {};
        const own = sessionId !== null ? map[sessionId] : void 0;
        const enabled = typeof own === "boolean" ? own : typeof value.enabled === "boolean" ? value.enabled : false;
        return { enabled, preset: normalizePreset(value.preset) };
      }
      function settle(result, field) {
        if (result != null && typeof result.then === "function") {
          ;
          result.then(
            (ok) => {
              if (ok === false) warn(`settings \u62D2\u7EDD\u4E86 ${field} \u5199\u5165\uFF0C\u5DF2\u4FDD\u7559\u672C\u5730\u503C`);
              refresh();
            },
            (error) => warn(`settings \u5199\u5165 ${field} \u5931\u8D25\uFF0C\u5DF2\u4FDD\u7559\u672C\u5730\u503C`, error)
          );
        }
      }
      function attach(kind, service) {
        if (face !== null || service == null) return;
        let bound = null;
        try {
          if (kind === "configForms" && typeof service.get === "function") bound = service.get(NAMESPACE);
          else if (typeof service.bind === "function") bound = service.bind({ namespace: NAMESPACE });
        } catch (error) {
          warn(`${kind} \u7ED1\u5B9A\u547D\u540D\u7A7A\u95F4\u5931\u8D25\uFF0C\u6539\u7528\u672C\u5730\u515C\u5E95`, error);
          return;
        }
        if (bound == null || typeof bound.getSnapshot !== "function") return;
        face = bound;
        if (typeof bound.subscribe === "function") {
          try {
            const off = bound.subscribe(() => refresh());
            if (typeof off === "function") faceUnsubscribe = off;
          } catch (error) {
            warn(`${kind} \u8BA2\u9605\u5931\u8D25`, error);
          }
        }
        refresh();
      }
      return {
        snapshotFor(sessionId) {
          const local = { enabled: localEnabledFor(sessionId), preset: readLocalPreset() };
          const remote = settingsState(sessionId);
          if (remote === null) return { ...local, available: false };
          writeLocalEnabled(sessionId, remote.enabled);
          writeLocalPreset(remote.preset);
          return { ...remote, available: true };
        },
        subscribe(listener) {
          listeners.add(listener);
          return () => {
            listeners.delete(listener);
          };
        },
        setEnabledFor(sessionId, next) {
          writeLocalEnabled(sessionId, next);
          const current = face;
          if (current !== null && typeof current.set === "function") {
            try {
              if (sessionId === null) {
                settle(current.set("enabled", next), "enabled");
              } else {
                let snap = null;
                try {
                  snap = current.getSnapshot();
                } catch (error) {
                  warn("\u8BFB\u53D6\u9010\u4F1A\u8BDD\u8868\u5931\u8D25\uFF0C\u4EC5\u5199\u5165\u672C\u5730", error);
                }
                const value = snap?.value ?? {};
                const map = value.sessions !== null && typeof value.sessions === "object" ? { ...value.sessions } : {};
                map[sessionId] = next;
                settle(current.set("sessions", map), "sessions");
              }
            } catch (error) {
              warn("settings \u5199\u5165\u5F00\u5173\u629B\u9519\uFF0C\u5DF2\u4FDD\u7559\u672C\u5730\u503C", error);
            }
          }
          refresh();
        },
        setPreset(next) {
          const value = normalizePreset(next);
          writeLocalPreset(value);
          const current = face;
          if (current !== null && typeof current.set === "function") {
            try {
              settle(current.set("preset", value), "preset");
            } catch (error) {
              warn("settings \u5199\u5165\u9884\u8BBE\u629B\u9519\uFF0C\u5DF2\u4FDD\u7559\u672C\u5730\u503C", error);
            }
          }
          refresh();
        },
        attach,
        dispose() {
          listeners.clear();
          if (faceUnsubscribe !== null) {
            try {
              faceUnsubscribe();
            } catch (error) {
              warn("\u53D6\u6D88 settings \u8BA2\u9605\u5931\u8D25", error);
            }
            faceUnsubscribe = null;
          }
          face = null;
        }
      };
    }

    // src/client/index.tsx
    var name = "dsh-send-timestamp-client";
    var inject = ["slots"];
    var DICTS = { zh: zh_default, en: en_default };
    function pickDict() {
      const lang = typeof navigator !== "undefined" && typeof navigator.language === "string" ? navigator.language : "zh";
      return lang.toLowerCase().startsWith("zh") ? DICTS.zh : DICTS.en;
    }
    function ClockIcon() {
      return /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 16 16", width: 13, height: 13, "aria-hidden": "true", style: { display: "block" } }, /* @__PURE__ */ React.createElement("circle", { cx: "8", cy: "8", r: "6.4", fill: "none", stroke: "currentColor", strokeWidth: "1.4" }), /* @__PURE__ */ React.createElement("path", { d: "M8 4.4V8.3L10.9 10", fill: "none", stroke: "currentColor", strokeWidth: "1.4", strokeLinecap: "round" }));
    }
    function presetLabel(dict, preset) {
      if (preset === "datetime") return dict["preset.datetime"];
      if (preset === "monthday") return dict["preset.monthday"];
      return dict["preset.time"];
    }
    function createToggleButton(store) {
      return function SendTimestampToggle(props) {
        const sessionId = typeof props?.sessionId === "string" ? props.sessionId : null;
        const [state, setState] = React.useState(() => store.snapshotFor(sessionId));
        React.useEffect(() => {
          setState(store.snapshotFor(sessionId));
          return store.subscribe(() => setState(store.snapshotFor(sessionId)));
        }, [sessionId]);
        const dict = pickDict();
        const label = dict["button.label"];
        let title = state.enabled ? dict["button.titleOn"] : dict["button.titleOff"];
        title = `${title} \xB7 ${presetLabel(dict, state.preset)}`;
        if (!state.available) title = `${title} \xB7 ${dict["hint.localOnly"]}`;
        const style = {
          ...buttonStyle,
          ...state.enabled ? activeStyle : inactiveStyle
        };
        return /* @__PURE__ */ React.createElement(
          "button",
          {
            type: "button",
            className: "dsh-send-timestamp-btn",
            role: "switch",
            "aria-checked": state.enabled,
            "aria-label": label,
            title,
            style,
            onFocus: (event) => {
              event.currentTarget.style.outline = `2px solid ${focusRing}`;
            },
            onBlur: (event) => {
              event.currentTarget.style.outline = "none";
            },
            onClick: () => {
              store.setEnabledFor(sessionId, !state.enabled);
            }
          },
          /* @__PURE__ */ React.createElement(ClockIcon, null),
          /* @__PURE__ */ React.createElement("span", null, label)
        );
      };
    }
    function apply(ctx) {
      const store = createToggleStore(ctx);
      ctx.effect(() => () => store.dispose());
      ctx.inject(["configForms"], (scopeCtx) => {
        store.attach("configForms", scopeCtx.configForms);
      });
      ctx.inject(["settingsScope"], (scopeCtx) => {
        store.attach("settingsScope", scopeCtx.settingsScope);
      });
      ctx.slots.inject(
        "conversation.input.right",
        () => ctx.slots.register(
          {
            name: "conversation.input.right",
            // 该槽 kind = list ⇒ id 必填；order 20 让本按钮排在 prompt-optimizer(30) 左侧。
            id: "send-timestamp",
            order: 20
          },
          createToggleButton(store)
        )
      );
    }

    return module.exports;
  },
});
