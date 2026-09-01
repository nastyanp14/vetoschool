import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { cachedQuery, clearQueryCache } from './queryCache';

function sourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(file);
    if (!/\.(ts|tsx)$/.test(entry.name) || /\.(test|spec)\.(ts|tsx)$/.test(entry.name)) return [];
    return [file];
  });
}

describe('PostgREST egress guardrails', () => {
  it('does not use wildcard selects in browser code', () => {
    const violations = sourceFiles(path.join(process.cwd(), 'src')).flatMap(file => {
      const source = fs.readFileSync(file, 'utf8');
      return /\.select\(\s*['"`]\s*\*/.test(source) ? [path.relative(process.cwd(), file)] : [];
    });
    expect(violations).toEqual([]);
  });

  it('does not restore the known infinite Supabase polling loops', () => {
    const criticalFiles = [
      'src/pages/Dashboard.tsx',
      'src/pages/TeacherDashboard.tsx',
      'src/components/LiveLessonMonitor.tsx',
      'src/components/InteractiveLessonRoom.tsx',
      'src/pages/PaymentResult.tsx',
    ];
    const banned = [
      'setInterval(() => void refreshStudentData',
      'setInterval(() => void refresh()',
      'setInterval(loadSessions',
      'setInterval(checkHints',
      'setInterval(() => void loadPaymentProfile',
    ];
    const violations = criticalFiles.flatMap(file => {
      const source = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
      return banned.filter(pattern => source.includes(pattern)).map(pattern => `${file}: ${pattern}`);
    });
    expect(violations).toEqual([]);
  });

  it('deduplicates concurrent reads and reuses fresh cached results', async () => {
    clearQueryCache();
    let calls = 0;
    const load = async () => {
      calls += 1;
      await Promise.resolve();
      return ['ok'];
    };

    const [first, second] = await Promise.all([
      cachedQuery('egress-test', 60_000, load),
      cachedQuery('egress-test', 60_000, load),
    ]);
    const third = await cachedQuery('egress-test', 60_000, load);

    expect(first).toEqual(['ok']);
    expect(second).toEqual(['ok']);
    expect(third).toEqual(['ok']);
    expect(calls).toBe(1);
    clearQueryCache();
  });
});
