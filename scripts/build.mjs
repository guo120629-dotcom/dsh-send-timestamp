/**
 * 构建脚本：产出三个文件。
 * - lib/index.js       host 半侧（ESM，@deepseek-ai/schemastery 保持 external）
 * - lib/client.js      浏览器半侧（CJS 核心 + 官方 __ModuleLoader__ 外壳）
 * - lib/timestamp.js   纯函数层（供 `node --test` 直接 import 做单元测试）
 */
import { build } from 'esbuild'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outdir = resolve(root, 'lib')
const PKG_NAME = '@local/dsh-send-timestamp'

const shared = {
  bundle: true,
  logLevel: 'info',
  legalComments: 'none',
}

/** 官方模板 client.js / 参考插件 client.js 第 1-31 行的外壳形态。 */
function wrapClientModule(body) {
  const indented = body
    .split('\n')
    .map((line) => (line.length > 0 ? `    ${line}` : line))
    .join('\n')
  return [
    'window.__ModuleLoader__.load({',
    `  id: ${JSON.stringify(PKG_NAME)},`,
    '  factory: (require) => {',
    '    var module = { exports: {} };',
    '    var exports = module.exports;',
    indented,
    '    return module.exports;',
    '  },',
    '});',
    '',
  ].join('\n')
}

async function main() {
  await mkdir(outdir, { recursive: true })

  // 1) host 入口：ESM + node 平台，只有 schemastery 留在外部。
  await build({
    ...shared,
    entryPoints: [resolve(root, 'src/index.ts')],
    outfile: resolve(outdir, 'index.js'),
    format: 'esm',
    platform: 'node',
    target: 'node18',
    external: ['@deepseek-ai/schemastery'],
  })

  // 2) 纯函数层：无外部依赖，测试直接 import。
  await build({
    ...shared,
    entryPoints: [resolve(root, 'src/timestamp.ts')],
    outfile: resolve(outdir, 'timestamp.js'),
    format: 'esm',
    platform: 'neutral',
    target: 'es2020',
  })

  // 3) 浏览器半侧：CJS 核心（react 由模块表的 require 提供），再包进外壳。
  const clientResult = await build({
    ...shared,
    entryPoints: [resolve(root, 'src/client/index.tsx')],
    write: false,
    format: 'cjs',
    platform: 'browser',
    target: 'es2020',
    // classic JSX：React.createElement，由 external 的 require('react') 提供。
    jsx: 'transform',
    external: ['react'],
  })
  const clientBody = clientResult.outputFiles[0].text
  await writeFile(resolve(outdir, 'client.js'), wrapClientModule(clientBody), 'utf8')

  console.log('built: lib/index.js, lib/timestamp.js, lib/client.js')
}

await main()
