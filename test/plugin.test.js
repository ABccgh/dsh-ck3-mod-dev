import assert from 'node:assert/strict';
import test from 'node:test';

import { createDeps, createTools, installGlobalToolMask } from '../lib/index.js';
import { normalizeConfig } from '../lib/config.js';

/**
 * 造一个最小 Cordis 上下文替身。
 * @param {string[]} globalTools - `tools.schemas()` 返回的全局工具名。
 * @param {{ restrictThrows?: boolean }} [options] - 行为选项。
 * @returns {Record<string, any>} ctx 替身。
 */
function makeCtx(globalTools, options = {}) {
  const registered = new Map();
  const restricted = [];
  return {
    registered,
    restricted,
    tools: {
      register(definition) {
        if (registered.has(definition.name)) throw new Error(`duplicate tool: ${definition.name}`);
        registered.set(definition.name, definition);
        return () => registered.delete(definition.name);
      },
      schemas() {
        return globalTools.map((toolName) => ({ name: toolName, description: '', parameters: {} }));
      },
      restrict(filter) {
        if (options.restrictThrows === true) throw new Error('restrict failed');
        restricted.push(filter);
        return () => {};
      },
    },
    effect(callback) {
      const disposer = callback();
      return typeof disposer === 'function' ? disposer : () => {};
    },
    setTimeout(callback) {
      callback();
      return 0;
    },
    logger: {
      info() {},
      warn() {},
    },
  };
}

const BASE_CONFIG = {
  workspaceRoot: 'C:\\tmp\\ws',
  userDir: 'C:\\tmp\\user',
  gameRoot: 'C:\\tmp\\game',
};

test('apply 注册 8 个 ck3mod_* 工具', async () => {
  const ctx = makeCtx(['ck3wiki_search', 'steam_status']);
  await import('../lib/index.js').then((module) => module.apply(ctx, BASE_CONFIG, { run: async () => ({ code: 0, out: '' }) }));

  const names = [...ctx.registered.keys()].sort();
  assert.deepEqual(names, [
    'ck3mod_build',
    'ck3mod_check',
    'ck3mod_deploy',
    'ck3mod_headless',
    'ck3mod_logs',
    'ck3mod_status',
    'ck3mod_vanilla',
    'ck3mod_workshop',
  ]);
});

test('apply 返回 undefined（Cordis 会把返回值当 effect）', async () => {
  const ctx = makeCtx([]);
  const module = await import('../lib/index.js');
  const result = await module.apply(ctx, BASE_CONFIG, { run: async () => ({ code: 0, out: '' }) });
  assert.equal(result, undefined);
});

test('全局工具屏蔽：保留 ck3wiki_/steam_，其余进 deny', async () => {
  const ctx = makeCtx([
    'ck3wiki_search',
    'ck3wiki_page',
    'steam_status',
    'steam_games',
    'prts_page',
    'mcp__github__get_me',
    'terminal_open',
    'run_code',
  ]);
  const config = normalizeConfig({ ...BASE_CONFIG, allowGlobalToolPrefixes: ['ck3wiki_', 'steam_'] });

  const mask = installGlobalToolMask(ctx, config);
  assert.equal(mask.skip, false);

  // 立即一次 + 2 秒后的补调（mock 的 setTimeout 同步执行）→ 至少一次；deny 列表相同。
  assert.ok(ctx.restricted.length >= 1);
  const deny = ctx.restricted[0].deny;
  assert.ok(!deny.includes('ck3wiki_search'));
  assert.ok(!deny.includes('steam_games'));
  assert.ok(deny.includes('prts_page'));
  assert.ok(deny.includes('mcp__github__get_me'));
  assert.ok(deny.includes('terminal_open'));
  assert.ok(!deny.includes('run_code'));
  assert.deepEqual(mask.deny().sort(), deny.slice().sort());
});

test('全局工具屏蔽：白名单为空时跳过', () => {
  const ctx = makeCtx(['prts_page']);
  const config = normalizeConfig({ ...BASE_CONFIG, allowGlobalToolPrefixes: [] });
  const mask = installGlobalToolMask(ctx, config);
  assert.equal(mask.skip, true);
  assert.equal(ctx.restricted.length, 0);
});

test('全局工具屏蔽：restrict 抛错被吞掉，不连累插件', () => {
  const ctx = makeCtx(['prts_page'], { restrictThrows: true });
  const config = normalizeConfig(BASE_CONFIG);
  assert.doesNotThrow(() => installGlobalToolMask(ctx, config));
  assert.equal(ctx.restricted.length, 0);
});

test('createDeps / createTools：8 个工具的参数 schema 都是 object', () => {
  const config = normalizeConfig(BASE_CONFIG);
  const deps = createDeps(config, { run: async () => ({ code: 0, out: '' }) });
  const tools = createTools(deps);
  assert.equal(tools.length, 8);
  for (const tool of tools) {
    assert.equal(tool.parameters.type, 'object');
    assert.equal(tool.parameters.additionalProperties, false);
    assert.equal(typeof tool.description, 'string');
    assert.ok(tool.description.length > 10);
    assert.equal(typeof tool.execute, 'function');
  }
});
