import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ROOT_MODELS,
  SCOPED_MODELS,
  SYSTEM_ONLY_MODELS,
  classifyModel,
} from '../../src/tenants/tenant-scope';

const schema = readFileSync(join(process.cwd(), 'prisma/schema.prisma'), 'utf8');

function parseModels(source: string): Map<string, string[]> {
  const models = new Map<string, string[]>();
  for (const m of source.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)) {
    const fields = m[2]
      .split('\n')
      .map((line) => line.trim().split(/\s+/)[0])
      .filter((f) => f && !f.startsWith('//') && !f.startsWith('@@'));
    models.set(m[1], fields);
  }
  return models;
}

const models = parseModels(schema);

describe('tenant model classification', () => {
  it('parses the schema', () => {
    expect(models.size).toBeGreaterThan(0);
  });

  it('classifies every model in the schema (nothing is forgotten)', () => {
    const unclassified = [...models.keys()].filter((name) => !classifyModel(name));
    expect(unclassified).toEqual([]);
  });

  it('marks every model that has a tenantId column as scoped', () => {
    const missing = [...models.entries()]
      .filter(([, fields]) => fields.includes('tenantId'))
      .map(([name]) => name)
      .filter((name) => classifyModel(name) !== 'scoped');
    expect(missing).toEqual([]);
  });

  it('only lists scoped models that really have a tenantId column', () => {
    const wrong = SCOPED_MODELS.filter((name) => !models.get(name)?.includes('tenantId'));
    expect(wrong).toEqual([]);
  });

  it('has no stale entries in any list', () => {
    const all = [...SCOPED_MODELS, ...ROOT_MODELS, ...SYSTEM_ONLY_MODELS];
    expect(all.filter((name) => !models.has(name))).toEqual([]);
  });
});