import assert from 'node:assert/strict';
import test from 'node:test';

import { coerceArguments, defineTool, parametersToJsonSchema, specToJsonSchema } from '../lib/tool-kit.js';

test('specToJsonSchema：标量/枚举/默认值', () => {
  const schema = specToJsonSchema({ type: 'string', description: 'x', enum: ['a', 'b'], default: 'a' });
  assert.deepEqual(schema, { type: 'string', description: 'x', enum: ['a', 'b'], default: 'a' });
});

test('specToJsonSchema：嵌套 object 的 required', () => {
  const schema = specToJsonSchema({
    type: 'object',
    properties: {
      a: { type: 'string', required: true },
      b: { type: 'integer' },
    },
    additionalProperties: false,
  });
  assert.deepEqual(schema.required, ['a']);
  assert.equal(schema.additionalProperties, false);
});

test('parametersToJsonSchema：根 object 的 required 汇总', () => {
  const schema = parametersToJsonSchema({
    mod: { type: 'string', required: true },
    all: { type: 'boolean' },
  });
  assert.equal(schema.type, 'object');
  assert.deepEqual(schema.required, ['mod']);
  assert.equal(schema.additionalProperties, false);
});

test('coerceArguments：字符串数字/布尔被归一，多余字段被丢弃', () => {
  const schema = parametersToJsonSchema({
    count: { type: 'integer' },
    flag: { type: 'boolean' },
    name: { type: 'string' },
  });
  assert.deepEqual(coerceArguments(schema, { count: '5', flag: 'true', name: 42, extra: 'x' }), {
    count: 5,
    flag: true,
    name: '42',
  });
});

test('coerceArguments：缺必填报错', () => {
  const schema = parametersToJsonSchema({ mod: { type: 'string', required: true } });
  assert.throws(() => coerceArguments(schema, {}), /缺少必填参数 mod/);
});

test('defineTool：compile 后 execute 收到的参数已归一', async () => {
  const seen = [];
  const tool = defineTool({
    name: 'demo_tool',
    description: 'demo',
    parameters: { limit: { type: 'integer' } },
    output: { schema: { type: 'object', properties: { text: { type: 'string', required: true } } }, render: () => [] },
    async execute(args) {
      seen.push(args);
      return { text: 'ok' };
    },
  });
  const result = await tool.execute({ limit: '7' }, {});
  assert.deepEqual(result, { text: 'ok' });
  assert.deepEqual(seen, [{ limit: 7 }]);
  assert.equal(tool.parameters.type, 'object');
});

test('defineTool：保留 run_code 名字会报错', () => {
  assert.throws(
    () => defineTool({
      name: 'run_code',
      description: 'x',
      output: { schema: { type: 'object' }, render: () => [] },
      execute: async () => ({}),
    }),
    /run_code/,
  );
});
