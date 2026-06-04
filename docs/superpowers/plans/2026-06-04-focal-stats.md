# Focal-Stats Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 读取 SD 卡/任意文件夹照片的 EXIF，统计最常用焦段并给出镜头建议；一套 TypeScript 核心同时驱动本地 CLI 和部署在 GitHub Pages 的网页版。

**Architecture:** npm workspaces 单仓库。`packages/core` 是纯逻辑（EXIF 解析 + 归一 + 分桶 + 聚合 + 洞察 + 配置），不碰 fs/DOM；`packages/cli` 用 Node `fs` 读文件头字节，`packages/web` 用浏览器 `File.slice` 在 Web Worker 里读，两者都把 `ArrayBuffer` 交给 core。

**Tech Stack:** TypeScript (strict)、npm workspaces、exifreader、Vitest、tsup（CLI 打包）、Vite（web 构建 + Pages 部署）、GitHub Actions。

---

## File Structure

```
focal-stats/
├─ package.json                    # workspaces 根
├─ tsconfig.base.json
├─ vitest.config.ts
├─ .gitignore
├─ packages/
│  ├─ core/
│  │  ├─ package.json
│  │  └─ src/
│  │     ├─ types.ts               # 全部 interface
│  │     ├─ config.ts              # DEFAULT_CONFIG / validateConfig / parseConfig
│  │     ├─ exif.ts                # mapTags(纯) + extractExif(包 exifreader)
│  │     ├─ normalize.ts           # normalizeFocal
│  │     ├─ bucket.ts              # bucketize
│  │     ├─ aggregate.ts           # aggregate
│  │     ├─ insights.ts            # generateInsights
│  │     ├─ index.ts               # analyze 门面 + 重导出
│  │     └─ *.test.ts              # 各模块单测
│  ├─ cli/
│  │  ├─ package.json
│  │  └─ src/
│  │     ├─ args.ts                # parseCliArgs
│  │     ├─ scan.ts                # listPhotoFiles / readHeader
│  │     ├─ pool.ts                # mapPool 并发
│  │     ├─ render.ts              # renderText 终端图表
│  │     ├─ export.ts              # toJson / toCsv / toHtml
│  │     ├─ index.ts               # main / bin
│  │     └─ *.test.ts
│  └─ web/
│     ├─ package.json
│     ├─ vite.config.ts
│     ├─ index.html
│     └─ src/
│        ├─ chart.ts               # barChartSvg(纯)
│        ├─ settings.ts            # serializeConfig / parseStoredConfig(纯)
│        ├─ worker.ts              # Web Worker：解析文件
│        ├─ main.ts                # DOM 装配
│        └─ *.test.ts
└─ .github/workflows/ci.yml        # 测试 + 部署 Pages
```

**重要边界**：core 仅依赖 `exifreader`，不 import `node:*` 或 DOM API。平台相关的"读文件头字节"由 cli/web 各自实现。

---

## Phase 0 — 仓库脚手架

### Task 0: 初始化 monorepo

**Files:**
- Create: `package.json`, `tsconfig.base.json`, `vitest.config.ts`, `.gitignore`
- Create: `packages/core/package.json`, `packages/cli/package.json`, `packages/web/package.json`

- [ ] **Step 1: 写根 `package.json`**

```json
{
  "name": "focal-stats-monorepo",
  "private": true,
  "type": "module",
  "workspaces": ["packages/*"],
  "scripts": {
    "test": "vitest run",
    "build:cli": "tsup --config packages/cli/tsup.config.ts",
    "build:web": "vite build packages/web"
  }
}
```

- [ ] **Step 2: 写 `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "declaration": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "verbatimModuleSyntax": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable", "WebWorker"],
    "types": []
  }
}
```

- [ ] **Step 3: 写 `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['packages/**/*.test.ts'],
    coverage: { include: ['packages/*/src/**/*.ts'], exclude: ['**/*.test.ts'] },
  },
});
```

- [ ] **Step 4: 写 `.gitignore`**

```
node_modules/
dist/
coverage/
*.log
.DS_Store
```

- [ ] **Step 5: 写三个子包 `package.json`**

`packages/core/package.json`:
```json
{
  "name": "@focal-stats/core",
  "version": "0.1.0",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": { ".": "./src/index.ts" }
}
```

`packages/cli/package.json`:
```json
{
  "name": "@focal-stats/cli",
  "version": "0.1.0",
  "type": "module",
  "bin": { "focal-stats": "./dist/index.js" },
  "dependencies": { "@focal-stats/core": "*" }
}
```

`packages/web/package.json`:
```json
{
  "name": "@focal-stats/web",
  "version": "0.1.0",
  "type": "module",
  "dependencies": { "@focal-stats/core": "*" }
}
```

- [ ] **Step 6: 安装依赖（由 npm 写入解析后的版本号）**

Run:
```bash
cd focal-stats
npm install -D typescript vitest @vitest/coverage-v8 tsup vite
npm install exifreader -w @focal-stats/core
npm install -D piexifjs sharp -w @focal-stats/core
```
Expected: `node_modules/` 生成，`package-lock.json` 出现，无 error。
（`piexifjs` + `sharp` 仅用于本地生成测试夹具，生成后夹具二进制进版本库，CI 不再依赖它们运行。）

- [ ] **Step 7: 冒烟测试 vitest 能跑**

Run: `npx vitest run`
Expected: "No test files found" 或 0 passed（无报错即可）。

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: scaffold npm workspaces monorepo"
```

---

## Phase 1 — core（纯逻辑，TDD 重点）

### Task 1: 类型定义 `types.ts`

**Files:**
- Create: `packages/core/src/types.ts`

- [ ] **Step 1: 写类型（无需测试，类型由后续任务的测试间接覆盖）**

```ts
export interface PhotoExif {
  name: string;
  focalLength: number | null;
  focalLength35mm: number | null;
  lensModel: string | null;
  cameraMake: string | null;
  cameraModel: string | null;
  fNumber: number | null;
}

export interface SkippedFile {
  name: string;
  reason: 'no-exif' | 'no-focal-length' | 'parse-error' | 'read-error';
}

export interface Bucket {
  label: string;
  min: number;
  max: number;
  count: number;
  percentage: number;
}

export interface GroupStat {
  key: string;
  count: number;
  topFocal: number;
}

export interface Insight {
  type: 'most-used' | 'prime-suggestion' | 'concentration';
  message: string;
  data?: Record<string, unknown>;
}

export interface FocalStats {
  mode: 'raw' | 'equiv35';
  total: number;
  scanned: number;
  equivFallbackCount: number;
  skipped: SkippedFile[];
  buckets: Bucket[];
  exact: { focal: number; count: number }[];
  topFocal: { focal: number; count: number; percentage: number }[];
  byLens: GroupStat[];
  byCamera: GroupStat[];
  insights: Insight[];
}

export interface AnalyzeConfig {
  mode: 'raw' | 'equiv35';
  bucketBoundaries: number[];
  filterLens: string | null;
  filterCamera: string | null;
  primeThreshold: number;
  topN: number;
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/core/src/types.ts
git commit -m "feat(core): add domain types"
```

---

### Task 2: 配置 `config.ts`

**Files:**
- Create: `packages/core/src/config.ts`
- Test: `packages/core/src/config.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, parseConfig, validateConfig } from './config';

describe('config', () => {
  it('默认配置合法', () => {
    expect(() => validateConfig(DEFAULT_CONFIG)).not.toThrow();
    expect(DEFAULT_CONFIG.mode).toBe('equiv35');
    expect(DEFAULT_CONFIG.topN).toBe(3);
  });

  it('parseConfig 合并 partial 到默认值', () => {
    const c = parseConfig({ topN: 5, filterLens: '24-70' });
    expect(c.topN).toBe(5);
    expect(c.filterLens).toBe('24-70');
    expect(c.mode).toBe('equiv35');
  });

  it('分桶边界非升序抛错', () => {
    expect(() => parseConfig({ bucketBoundaries: [24, 16] })).toThrow(/升序/);
  });

  it('primeThreshold 越界抛错', () => {
    expect(() => parseConfig({ primeThreshold: 1.5 })).toThrow(/primeThreshold/);
  });

  it('topN 非正整数抛错', () => {
    expect(() => parseConfig({ topN: 0 })).toThrow(/topN/);
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run packages/core/src/config.test.ts`
Expected: FAIL（`config` 模块不存在）。

- [ ] **Step 3: 实现 `config.ts`**

```ts
import type { AnalyzeConfig } from './types';

export const DEFAULT_CONFIG: AnalyzeConfig = {
  mode: 'equiv35',
  bucketBoundaries: [16, 24, 35, 50, 70, 100, 200],
  filterLens: null,
  filterCamera: null,
  primeThreshold: 0.6,
  topN: 3,
};

export function validateConfig(config: AnalyzeConfig): void {
  const b = config.bucketBoundaries;
  if (b.length === 0) throw new Error('bucketBoundaries 不能为空');
  for (let i = 1; i < b.length; i++) {
    if (b[i] <= b[i - 1]) {
      throw new Error(`bucketBoundaries 必须严格升序，发现 ${b[i - 1]} >= ${b[i]}`);
    }
  }
  if (b.some((x) => x <= 0)) throw new Error('bucketBoundaries 必须为正数');
  if (config.primeThreshold < 0 || config.primeThreshold > 1) {
    throw new Error(`primeThreshold 必须在 0–1 之间，收到 ${config.primeThreshold}`);
  }
  if (!Number.isInteger(config.topN) || config.topN < 1) {
    throw new Error(`topN 必须为正整数，收到 ${config.topN}`);
  }
  if (config.mode !== 'raw' && config.mode !== 'equiv35') {
    throw new Error("mode 必须是 'raw' 或 'equiv35'");
  }
}

export function parseConfig(partial: Partial<AnalyzeConfig>): AnalyzeConfig {
  const config: AnalyzeConfig = { ...DEFAULT_CONFIG, ...partial };
  validateConfig(config);
  return config;
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run packages/core/src/config.test.ts`
Expected: PASS（5 个用例）。

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/config.ts packages/core/src/config.test.ts
git commit -m "feat(core): config defaults + validation"
```

---

### Task 3: 归一 `normalize.ts`

**Files:**
- Create: `packages/core/src/normalize.ts`
- Test: `packages/core/src/normalize.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
import { describe, expect, it } from 'vitest';
import { normalizeFocal } from './normalize';
import type { PhotoExif } from './types';

const base: PhotoExif = {
  name: 'a.jpg', focalLength: 35, focalLength35mm: 52,
  lensModel: null, cameraMake: null, cameraModel: null, fNumber: null,
};

describe('normalizeFocal', () => {
  it('raw 模式取原始焦距', () => {
    expect(normalizeFocal(base, 'raw')).toEqual({ focal: 35, fellBack: false });
  });
  it('equiv35 模式取等效焦距', () => {
    expect(normalizeFocal(base, 'equiv35')).toEqual({ focal: 52, fellBack: false });
  });
  it('equiv35 缺失时回退原始并标记 fellBack', () => {
    expect(normalizeFocal({ ...base, focalLength35mm: null }, 'equiv35'))
      .toEqual({ focal: 35, fellBack: true });
  });
  it('两者都缺返回 null', () => {
    expect(normalizeFocal({ ...base, focalLength: null, focalLength35mm: null }, 'equiv35'))
      .toEqual({ focal: null, fellBack: false });
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run packages/core/src/normalize.test.ts`
Expected: FAIL。

- [ ] **Step 3: 实现 `normalize.ts`**

```ts
import type { PhotoExif } from './types';

export function normalizeFocal(
  photo: PhotoExif,
  mode: 'raw' | 'equiv35',
): { focal: number | null; fellBack: boolean } {
  if (mode === 'raw') return { focal: photo.focalLength, fellBack: false };
  if (photo.focalLength35mm != null) return { focal: photo.focalLength35mm, fellBack: false };
  return { focal: photo.focalLength, fellBack: photo.focalLength != null };
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run packages/core/src/normalize.test.ts`
Expected: PASS（4 个用例）。

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/normalize.ts packages/core/src/normalize.test.ts
git commit -m "feat(core): normalizeFocal with 35mm fallback"
```

---

### Task 4: 分桶 `bucket.ts`

**Files:**
- Create: `packages/core/src/bucket.ts`
- Test: `packages/core/src/bucket.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
import { describe, expect, it } from 'vitest';
import { bucketize } from './bucket';

describe('bucketize', () => {
  it('按边界分桶并算百分比', () => {
    const buckets = bucketize([10, 20, 20, 300], [16, 24, 200]);
    // 边界 [16,24,200] → 桶 [0,16),[16,24),[24,200),[200,∞)
    expect(buckets.map((b) => b.label)).toEqual(['0–16', '16–24', '24–200', '200+']);
    expect(buckets.map((b) => b.count)).toEqual([1, 2, 0, 1]);
    expect(buckets[1].percentage).toBe(50);
  });
  it('空输入百分比为 0 不除零', () => {
    const buckets = bucketize([], [24]);
    expect(buckets.every((b) => b.percentage === 0 && b.count === 0)).toBe(true);
  });
  it('边界值归入右侧桶（左闭右开）', () => {
    const buckets = bucketize([24], [24]);
    expect(buckets[0].count).toBe(0); // [0,24)
    expect(buckets[1].count).toBe(1); // [24,∞)
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run packages/core/src/bucket.test.ts`
Expected: FAIL。

- [ ] **Step 3: 实现 `bucket.ts`（不可变，无原地修改）**

```ts
import type { Bucket } from './types';

export function bucketize(values: number[], boundaries: number[]): Bucket[] {
  const edges = [0, ...boundaries, Infinity];
  const total = values.length;
  return edges.slice(0, -1).map((min, i) => {
    const max = edges[i + 1];
    const count = values.filter((v) => v >= min && v < max).length;
    return {
      label: max === Infinity ? `${min}+` : `${min}–${max}`,
      min,
      max,
      count,
      percentage: total === 0 ? 0 : Math.round((count / total) * 1000) / 10,
    };
  });
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run packages/core/src/bucket.test.ts`
Expected: PASS（3 个用例）。

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/bucket.ts packages/core/src/bucket.test.ts
git commit -m "feat(core): bucketize focal lengths"
```

---

### Task 5: 聚合 `aggregate.ts`

**Files:**
- Create: `packages/core/src/aggregate.ts`
- Test: `packages/core/src/aggregate.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
import { describe, expect, it } from 'vitest';
import { aggregate } from './aggregate';
import { DEFAULT_CONFIG } from './config';
import type { PhotoExif } from './types';

function photo(p: Partial<PhotoExif>): PhotoExif {
  return {
    name: 'x', focalLength: null, focalLength35mm: null,
    lensModel: null, cameraMake: null, cameraModel: null, fNumber: null, ...p,
  };
}

describe('aggregate', () => {
  const photos = [
    photo({ name: '1', focalLength35mm: 35, lensModel: 'A', cameraModel: 'C1' }),
    photo({ name: '2', focalLength35mm: 35, lensModel: 'A', cameraModel: 'C1' }),
    photo({ name: '3', focalLength35mm: 50, lensModel: 'B', cameraModel: 'C2' }),
    photo({ name: '4', focalLength: null, focalLength35mm: null }), // 无焦段
  ];

  it('统计 total 与跳过', () => {
    const s = aggregate(photos, DEFAULT_CONFIG);
    expect(s.total).toBe(3);
    expect(s.skipped).toEqual([{ name: '4', reason: 'no-focal-length' }]);
    expect(s.scanned).toBe(4);
  });

  it('topFocal 降序且带百分比', () => {
    const s = aggregate(photos, DEFAULT_CONFIG);
    expect(s.topFocal[0]).toEqual({ focal: 35, count: 2, percentage: 66.7 });
  });

  it('按镜头分组', () => {
    const s = aggregate(photos, DEFAULT_CONFIG);
    expect(s.byLens).toEqual([
      { key: 'A', count: 2, topFocal: 35 },
      { key: 'B', count: 1, topFocal: 50 },
    ]);
  });

  it('filterLens 子串筛选', () => {
    const s = aggregate(photos, { ...DEFAULT_CONFIG, filterLens: 'a' });
    expect(s.total).toBe(2);
  });

  it('equiv35 缺失计入 equivFallbackCount', () => {
    const p = [photo({ name: '1', focalLength: 35, focalLength35mm: null })];
    const s = aggregate(p, DEFAULT_CONFIG);
    expect(s.equivFallbackCount).toBe(1);
    expect(s.total).toBe(1);
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run packages/core/src/aggregate.test.ts`
Expected: FAIL。

- [ ] **Step 3: 实现 `aggregate.ts`**

```ts
import type { AnalyzeConfig, FocalStats, GroupStat, PhotoExif, SkippedFile } from './types';
import { bucketize } from './bucket';
import { normalizeFocal } from './normalize';

function matchesFilter(value: string | null, filter: string | null): boolean {
  if (filter == null || filter === '') return true;
  if (value == null) return false;
  return value.toLowerCase().includes(filter.toLowerCase());
}

function countTop(focals: number[]): { focal: number; count: number }[] {
  const map = new Map<number, number>();
  for (const f of focals) map.set(f, (map.get(f) ?? 0) + 1);
  return [...map.entries()]
    .map(([focal, count]) => ({ focal, count }))
    .sort((a, b) => b.count - a.count || a.focal - b.focal);
}

function groupBy(entries: { key: string | null; focal: number }[]): GroupStat[] {
  const map = new Map<string, number[]>();
  for (const e of entries) {
    const key = e.key ?? '未知';
    map.set(key, [...(map.get(key) ?? []), e.focal]);
  }
  return [...map.entries()]
    .map(([key, focals]) => ({ key, count: focals.length, topFocal: countTop(focals)[0].focal }))
    .sort((a, b) => b.count - a.count);
}

export function aggregate(
  photos: PhotoExif[],
  config: AnalyzeConfig,
): Omit<FocalStats, 'insights'> {
  const filtered = photos.filter(
    (p) =>
      matchesFilter(p.lensModel, config.filterLens) &&
      matchesFilter(p.cameraModel, config.filterCamera),
  );

  const usable: { focal: number; lens: string | null; camera: string | null }[] = [];
  const skipped: SkippedFile[] = [];
  let equivFallbackCount = 0;

  for (const p of filtered) {
    const { focal, fellBack } = normalizeFocal(p, config.mode);
    if (focal == null) {
      skipped.push({ name: p.name, reason: 'no-focal-length' });
      continue;
    }
    if (fellBack) equivFallbackCount++;
    usable.push({ focal, lens: p.lensModel, camera: p.cameraModel });
  }

  const total = usable.length;
  const focals = usable.map((u) => u.focal);
  const exact = countTop(focals);
  const pct = (count: number) => (total === 0 ? 0 : Math.round((count / total) * 1000) / 10);

  return {
    mode: config.mode,
    total,
    scanned: photos.length,
    equivFallbackCount,
    skipped,
    buckets: bucketize(focals, config.bucketBoundaries),
    exact,
    topFocal: exact.slice(0, config.topN).map((e) => ({ ...e, percentage: pct(e.count) })),
    byLens: groupBy(usable.map((u) => ({ key: u.lens, focal: u.focal }))),
    byCamera: groupBy(usable.map((u) => ({ key: u.camera, focal: u.focal }))),
  };
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run packages/core/src/aggregate.test.ts`
Expected: PASS（5 个用例）。

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/aggregate.ts packages/core/src/aggregate.test.ts
git commit -m "feat(core): aggregate stats with filters and grouping"
```

---

### Task 6: 洞察 `insights.ts`

**Files:**
- Create: `packages/core/src/insights.ts`
- Test: `packages/core/src/insights.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
import { describe, expect, it } from 'vitest';
import { generateInsights } from './insights';
import { DEFAULT_CONFIG } from './config';
import { aggregate } from './aggregate';
import type { PhotoExif } from './types';

function photo(focal: number): PhotoExif {
  return {
    name: 'x', focalLength: focal, focalLength35mm: focal,
    lensModel: null, cameraMake: null, cameraModel: null, fNumber: null,
  };
}

describe('generateInsights', () => {
  it('集中度高时给定焦建议', () => {
    const stats = aggregate(Array.from({ length: 10 }, () => photo(35)), DEFAULT_CONFIG);
    const ins = generateInsights(stats, DEFAULT_CONFIG);
    expect(ins.some((i) => i.type === 'most-used')).toBe(true);
    expect(ins.some((i) => i.type === 'prime-suggestion')).toBe(true);
  });

  it('分布分散时不给定焦建议', () => {
    const photos = [photo(16), photo(24), photo(50), photo(85), photo(135), photo(300)];
    const stats = aggregate(photos, DEFAULT_CONFIG);
    const ins = generateInsights(stats, DEFAULT_CONFIG);
    expect(ins.some((i) => i.type === 'prime-suggestion')).toBe(false);
    expect(ins.some((i) => i.type === 'concentration')).toBe(true);
  });

  it('空数据返回提示', () => {
    const stats = aggregate([], DEFAULT_CONFIG);
    const ins = generateInsights(stats, DEFAULT_CONFIG);
    expect(ins[0].message).toMatch(/未发现/);
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run packages/core/src/insights.test.ts`
Expected: FAIL。

- [ ] **Step 3: 实现 `insights.ts`**

```ts
import type { AnalyzeConfig, FocalStats, Insight } from './types';

export function generateInsights(
  stats: Omit<FocalStats, 'insights'>,
  config: AnalyzeConfig,
): Insight[] {
  if (stats.total === 0) {
    return [{ type: 'most-used', message: '未发现任何含焦段信息的照片。' }];
  }

  const insights: Insight[] = [];
  const unit = stats.mode === 'equiv35' ? 'mm 等效' : 'mm';
  const top = stats.topFocal[0];
  insights.push({
    type: 'most-used',
    message: `最常用焦段：${top.focal}${unit}（${top.count} 张，占 ${top.percentage}%）。`,
    data: { focal: top.focal, count: top.count },
  });

  const topBucket = [...stats.buckets].sort((a, b) => b.count - a.count)[0];
  if (topBucket && topBucket.percentage / 100 >= config.primeThreshold) {
    const mid =
      topBucket.max === Infinity
        ? topBucket.min
        : Math.round((topBucket.min + topBucket.max) / 2);
    insights.push({
      type: 'prime-suggestion',
      message: `${topBucket.percentage}% 的照片落在 ${topBucket.label}${unit} 区间 → 适合一支约 ${mid}mm 定焦。`,
      data: { bucket: topBucket.label, percentage: topBucket.percentage },
    });
  } else {
    insights.push({
      type: 'concentration',
      message: `焦段分布较分散（最高单桶 ${topBucket?.percentage ?? 0}%，低于阈值 ${Math.round(
        config.primeThreshold * 100,
      )}%）→ 变焦更适合你。`,
    });
  }

  if (stats.equivFallbackCount > 0) {
    insights.push({
      type: 'concentration',
      message: `注意：${stats.equivFallbackCount} 张照片无 35mm 等效信息，已按原始焦距计入。`,
    });
  }

  return insights;
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run packages/core/src/insights.test.ts`
Expected: PASS（3 个用例）。

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/insights.ts packages/core/src/insights.test.ts
git commit -m "feat(core): generate insights and prime-lens suggestion"
```

---

### Task 7: EXIF 提取 `exif.ts`

**Files:**
- Create: `packages/core/src/exif.ts`
- Test: `packages/core/src/exif.test.ts`
- Create (脚本+夹具): `packages/core/test/make-fixture.mjs`, `packages/core/test/fixtures/sample.jpg`

- [ ] **Step 1: 写 `mapTags` 的纯单测（用假 tag 对象，无需真实文件）**

```ts
import { describe, expect, it } from 'vitest';
import { mapTags } from './exif';

describe('mapTags', () => {
  it('从 description/value 提取并四舍五入焦距', () => {
    const tags = {
      FocalLength: { description: '35 mm', value: [350, 10] },
      FocalLengthIn35mmFilm: { value: 52 },
      LensModel: { description: 'FE 35mm F1.8' },
      Make: { description: 'SONY' },
      Model: { description: 'ILCE-7M3' },
      FNumber: { description: 'f/1.8', value: [18, 10] },
    };
    expect(mapTags(tags, 'a.arw')).toEqual({
      name: 'a.arw',
      focalLength: 35,
      focalLength35mm: 52,
      lensModel: 'FE 35mm F1.8',
      cameraMake: 'SONY',
      cameraModel: 'ILCE-7M3',
      fNumber: 1.8,
    });
  });

  it('缺失字段返回 null', () => {
    expect(mapTags({}, 'b.jpg')).toEqual({
      name: 'b.jpg', focalLength: null, focalLength35mm: null,
      lensModel: null, cameraMake: null, cameraModel: null, fNumber: null,
    });
  });

  it('支持 FocalLengthIn35mmFormat 别名', () => {
    const photo = mapTags({ FocalLengthIn35mmFormat: { value: 75 } }, 'c.jpg');
    expect(photo.focalLength35mm).toBe(75);
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run packages/core/src/exif.test.ts`
Expected: FAIL（`exif` 模块不存在）。

- [ ] **Step 3: 实现 `exif.ts`**

```ts
import ExifReader from 'exifreader';
import type { PhotoExif, SkippedFile } from './types';

type Tag = { value?: unknown; description?: unknown } | undefined;
type Tags = Record<string, Tag>;

function num(tag: Tag): number | null {
  if (!tag) return null;
  const v = tag.value;
  if (typeof v === 'number') return v;
  if (Array.isArray(v) && v.length === 2 && typeof v[0] === 'number' && typeof v[1] === 'number') {
    return v[1] === 0 ? null : v[0] / v[1];
  }
  if (typeof v === 'string' && !Number.isNaN(parseFloat(v))) return parseFloat(v);
  if (typeof tag.description === 'string' && !Number.isNaN(parseFloat(tag.description))) {
    return parseFloat(tag.description);
  }
  return null;
}

function str(tag: Tag): string | null {
  if (!tag) return null;
  if (typeof tag.description === 'string' && tag.description.length > 0) return tag.description;
  if (typeof tag.value === 'string' && tag.value.length > 0) return tag.value;
  if (Array.isArray(tag.value)) return tag.value.join(' ').trim() || null;
  return null;
}

const round = (n: number | null): number | null => (n == null ? null : Math.round(n));

export function mapTags(tags: Tags, name: string): PhotoExif {
  return {
    name,
    focalLength: round(num(tags.FocalLength)),
    focalLength35mm: round(num(tags.FocalLengthIn35mmFilm) ?? num(tags.FocalLengthIn35mmFormat)),
    lensModel: str(tags.LensModel) ?? str(tags.Lens),
    cameraMake: str(tags.Make),
    cameraModel: str(tags.Model),
    fNumber: num(tags.FNumber),
  };
}

export function extractExif(buffer: ArrayBuffer, name: string): PhotoExif | SkippedFile {
  let tags: Tags;
  try {
    tags = ExifReader.load(buffer) as unknown as Tags;
  } catch {
    return { name, reason: 'parse-error' };
  }
  if (!tags || Object.keys(tags).length === 0) return { name, reason: 'no-exif' };
  return mapTags(tags, name);
}
```

- [ ] **Step 4: 运行确认 `mapTags` 通过**

Run: `npx vitest run packages/core/src/exif.test.ts`
Expected: PASS（3 个 mapTags 用例）。

- [ ] **Step 5: 写夹具生成脚本（用 piexifjs 把已知 EXIF 写进最小 JPEG）**

`packages/core/test/make-fixture.mjs`:
```js
import { writeFileSync } from 'node:fs';
import sharp from 'sharp';
import piexif from 'piexifjs';

// 用 sharp 生成一张真实的 16x16 JPEG（避免手写不可靠的字节）
const jpegBuf = await sharp({
  create: { width: 16, height: 16, channels: 3, background: { r: 200, g: 30, b: 30 } },
})
  .jpeg()
  .toBuffer();

// 用 piexifjs 写入一组已知 EXIF；常量名取自 piexif.ImageIFD / piexif.ExifIFD 表，
// 若某常量名在你的 piexifjs 版本中不同，按其文档调整即可。
const exifObj = {
  '0th': { [piexif.ImageIFD.Make]: 'SONY', [piexif.ImageIFD.Model]: 'ILCE-7M3' },
  Exif: {
    [piexif.ExifIFD.FocalLength]: [35, 1],
    [piexif.ExifIFD.FocalLengthIn35mmFilm]: 52,
    [piexif.ExifIFD.FNumber]: [18, 10],
  },
};
const withExif = piexif.insert(piexif.dump(exifObj), jpegBuf.toString('binary'));
writeFileSync(new URL('./fixtures/sample.jpg', import.meta.url), Buffer.from(withExif, 'binary'));
console.log('wrote fixtures/sample.jpg');
```

- [ ] **Step 6: 生成夹具并提交（二进制夹具进版本库）**

Run:
```bash
mkdir -p packages/core/test/fixtures
node packages/core/test/make-fixture.mjs
```
Expected: 输出 `wrote fixtures/sample.jpg`，文件生成。生成后用 `node -e "import('exifreader').then(async m=>{const {readFileSync}=await import('node:fs');console.log((await m.default.load(readFileSync('packages/core/test/fixtures/sample.jpg'))).FocalLengthIn35mmFilm)})"` 可快速确认夹具确实带 EXIF（应打印含 52 的对象）。

- [ ] **Step 7: 追加 `extractExif` 集成测试**

在 `packages/core/src/exif.test.ts` 末尾追加：
```ts
import { readFileSync } from 'node:fs';
import { extractExif } from './exif';

describe('extractExif (集成)', () => {
  it('读取夹具 JPEG 的焦距', () => {
    const buf = readFileSync(new URL('../test/fixtures/sample.jpg', import.meta.url));
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    const r = extractExif(ab, 'sample.jpg');
    expect('reason' in r).toBe(false);
    if (!('reason' in r)) {
      expect(r.focalLength).toBe(35);
      expect(r.focalLength35mm).toBe(52);
      expect(r.cameraModel).toBe('ILCE-7M3');
    }
  });

  it('非图片数据返回 no-exif 或 parse-error', () => {
    const r = extractExif(new TextEncoder().encode('not an image').buffer, 'x.txt');
    expect('reason' in r).toBe(true);
  });
});
```

- [ ] **Step 8: 运行确认全部通过**

Run: `npx vitest run packages/core/src/exif.test.ts`
Expected: PASS（5 个用例）。

- [ ] **Step 9: Commit**

```bash
git add packages/core/src/exif.ts packages/core/src/exif.test.ts packages/core/test/
git commit -m "feat(core): EXIF extraction via exifreader + fixture test"
```

---

### Task 8: 门面 `index.ts`

**Files:**
- Create: `packages/core/src/index.ts`
- Test: `packages/core/src/index.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
import { describe, expect, it } from 'vitest';
import { analyze, DEFAULT_CONFIG } from './index';
import type { PhotoExif, SkippedFile } from './index';

const p = (focal: number): PhotoExif => ({
  name: 'x', focalLength: focal, focalLength35mm: focal,
  lensModel: null, cameraMake: null, cameraModel: null, fNumber: null,
});

describe('analyze', () => {
  it('合并提取期跳过文件并产出洞察', () => {
    const pre: SkippedFile[] = [{ name: 'broken.cr2', reason: 'parse-error' }];
    const stats = analyze([p(35), p(35)], DEFAULT_CONFIG, pre);
    expect(stats.total).toBe(2);
    expect(stats.scanned).toBe(3);
    expect(stats.skipped).toContainEqual({ name: 'broken.cr2', reason: 'parse-error' });
    expect(stats.insights.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run packages/core/src/index.test.ts`
Expected: FAIL。

- [ ] **Step 3: 实现 `index.ts`**

```ts
import type { AnalyzeConfig, FocalStats, PhotoExif, SkippedFile } from './types';
import { aggregate } from './aggregate';
import { generateInsights } from './insights';

export function analyze(
  photos: PhotoExif[],
  config: AnalyzeConfig,
  preSkipped: SkippedFile[] = [],
): FocalStats {
  const base = aggregate(photos, config);
  const merged: Omit<FocalStats, 'insights'> = {
    ...base,
    scanned: base.scanned + preSkipped.length,
    skipped: [...preSkipped, ...base.skipped],
  };
  return { ...merged, insights: generateInsights(merged, config) };
}

export * from './types';
export { DEFAULT_CONFIG, parseConfig, validateConfig } from './config';
export { extractExif, mapTags } from './exif';
export { aggregate } from './aggregate';
export { generateInsights } from './insights';
```

- [ ] **Step 4: 运行确认通过 + 全 core 测试 + 覆盖率**

Run: `npx vitest run --coverage packages/core`
Expected: 全部 PASS，core 行覆盖率 ≥ 80%。

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/index.ts packages/core/src/index.test.ts
git commit -m "feat(core): analyze facade merging extraction skips"
```

---

## Phase 2 — CLI

### Task 9: 参数解析 `cli/src/args.ts`

**Files:**
- Create: `packages/cli/src/args.ts`
- Test: `packages/cli/src/args.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
import { describe, expect, it } from 'vitest';
import { parseCliArgs } from './args';

describe('parseCliArgs', () => {
  it('解析路径与默认值', () => {
    const o = parseCliArgs(['/Volumes/SD']);
    expect(o.path).toBe('/Volumes/SD');
    expect(o.format).toBe('text');
    expect(o.config.mode).toBe('equiv35');
    expect(o.headerBytes).toBe(1024 * 1024);
  });

  it('解析自定义分桶/筛选/阈值/格式', () => {
    const o = parseCliArgs([
      '/sd', '--buckets', '24,35,50', '--lens', '24-70',
      '--prime-threshold', '0.7', '--top', '5', '--json',
    ]);
    expect(o.config.bucketBoundaries).toEqual([24, 35, 50]);
    expect(o.config.filterLens).toBe('24-70');
    expect(o.config.primeThreshold).toBe(0.7);
    expect(o.config.topN).toBe(5);
    expect(o.format).toBe('json');
  });

  it('缺路径抛错', () => {
    expect(() => parseCliArgs([])).toThrow(/用法/);
  });

  it('--buckets 含非数字抛错', () => {
    expect(() => parseCliArgs(['/sd', '--buckets', '24,abc'])).toThrow(/非数字/);
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run packages/cli/src/args.test.ts`
Expected: FAIL。

- [ ] **Step 3: 实现 `args.ts`**

```ts
import { parseArgs } from 'node:util';
import { parseConfig } from '@focal-stats/core';
import type { AnalyzeConfig } from '@focal-stats/core';

export interface CliOptions {
  path: string;
  config: AnalyzeConfig;
  format: 'text' | 'json' | 'csv' | 'html';
  headerBytes: number;
}

export function parseCliArgs(argv: string[]): CliOptions {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      mode: { type: 'string' },
      buckets: { type: 'string' },
      lens: { type: 'string' },
      camera: { type: 'string' },
      'prime-threshold': { type: 'string' },
      top: { type: 'string' },
      'header-bytes': { type: 'string' },
      json: { type: 'boolean' },
      csv: { type: 'boolean' },
      html: { type: 'boolean' },
    },
  });

  const path = positionals[0];
  if (!path) throw new Error('用法: focal-stats <文件夹路径> [选项]');

  const partial: Partial<AnalyzeConfig> = {};
  if (values.mode) partial.mode = values.mode as AnalyzeConfig['mode'];
  if (values.buckets) {
    partial.bucketBoundaries = values.buckets.split(',').map((s) => {
      const n = Number(s.trim());
      if (Number.isNaN(n)) throw new Error(`--buckets 含非数字: ${s}`);
      return n;
    });
  }
  if (values.lens) partial.filterLens = values.lens;
  if (values.camera) partial.filterCamera = values.camera;
  if (values['prime-threshold']) partial.primeThreshold = Number(values['prime-threshold']);
  if (values.top) partial.topN = Number(values.top);

  const format = values.json ? 'json' : values.csv ? 'csv' : values.html ? 'html' : 'text';
  const headerBytes = values['header-bytes'] ? Number(values['header-bytes']) : 1024 * 1024;

  return { path, config: parseConfig(partial), format, headerBytes };
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run packages/cli/src/args.test.ts`
Expected: PASS（4 个用例）。

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/args.ts packages/cli/src/args.test.ts
git commit -m "feat(cli): argument parsing mapped to AnalyzeConfig"
```

---

### Task 10: 文件扫描 `cli/src/scan.ts`

**Files:**
- Create: `packages/cli/src/scan.ts`
- Test: `packages/cli/src/scan.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { listPhotoFiles, readHeader } from './scan';

let dir: string;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'fs-scan-'));
  await mkdir(join(dir, 'sub'));
  await writeFile(join(dir, 'a.JPG'), 'AAAAAAAA');
  await writeFile(join(dir, 'b.cr2'), 'BBBB');
  await writeFile(join(dir, 'ignore.txt'), 'x');
  await writeFile(join(dir, 'sub', 'c.nef'), 'CCCC');
});
afterAll(async () => { await rm(dir, { recursive: true, force: true }); });

describe('scan', () => {
  it('递归列出照片扩展名，忽略其它', async () => {
    const files = await listPhotoFiles(dir);
    expect(files.map((f) => f.split('/').pop()).sort()).toEqual(['a.JPG', 'b.cr2', 'c.nef']);
  });

  it('readHeader 只读前 N 字节', async () => {
    const ab = await readHeader(join(dir, 'a.JPG'), 4);
    expect(new TextDecoder().decode(ab)).toBe('AAAA');
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run packages/cli/src/scan.test.ts`
Expected: FAIL。

- [ ] **Step 3: 实现 `scan.ts`**

```ts
import { readdir, open } from 'node:fs/promises';
import { join, extname } from 'node:path';

const PHOTO_EXTS = new Set([
  '.jpg', '.jpeg', '.heic', '.heif', '.tif', '.tiff',
  '.cr2', '.cr3', '.nef', '.nrw', '.arw', '.sr2', '.raf', '.orf', '.rw2', '.dng', '.pef',
]);

export async function listPhotoFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) files.push(...(await listPhotoFiles(full)));
    else if (PHOTO_EXTS.has(extname(e.name).toLowerCase())) files.push(full);
  }
  return files;
}

export async function readHeader(path: string, headerBytes: number): Promise<ArrayBuffer> {
  const fh = await open(path, 'r');
  try {
    const buf = Buffer.alloc(headerBytes);
    const { bytesRead } = await fh.read(buf, 0, headerBytes, 0);
    const slice = buf.subarray(0, bytesRead);
    return slice.buffer.slice(slice.byteOffset, slice.byteOffset + slice.byteLength);
  } finally {
    await fh.close();
  }
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run packages/cli/src/scan.test.ts`
Expected: PASS（2 个用例）。

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/scan.ts packages/cli/src/scan.test.ts
git commit -m "feat(cli): recursive photo scan + header-only read"
```

---

### Task 11: 并发池 `cli/src/pool.ts`

**Files:**
- Create: `packages/cli/src/pool.ts`
- Test: `packages/cli/src/pool.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
import { describe, expect, it } from 'vitest';
import { mapPool } from './pool';

describe('mapPool', () => {
  it('保持顺序并处理全部元素', async () => {
    const out = await mapPool([1, 2, 3, 4, 5], 2, async (n) => n * 10);
    expect(out).toEqual([10, 20, 30, 40, 50]);
  });

  it('并发不超过上限', async () => {
    let active = 0;
    let maxActive = 0;
    await mapPool(Array.from({ length: 10 }, (_, i) => i), 3, async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
      return 0;
    });
    expect(maxActive).toBeLessThanOrEqual(3);
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run packages/cli/src/pool.test.ts`
Expected: FAIL。

- [ ] **Step 3: 实现 `pool.ts`**

```ts
export async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker(): Promise<void> {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  }
  const n = Math.min(Math.max(1, limit), Math.max(1, items.length));
  await Promise.all(Array.from({ length: n }, () => worker()));
  return results;
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run packages/cli/src/pool.test.ts`
Expected: PASS（2 个用例）。

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/pool.ts packages/cli/src/pool.test.ts
git commit -m "feat(cli): bounded-concurrency map pool"
```

---

### Task 12: 渲染与导出 `cli/src/render.ts` + `cli/src/export.ts`

**Files:**
- Create: `packages/cli/src/render.ts`, `packages/cli/src/export.ts`
- Test: `packages/cli/src/output.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
import { describe, expect, it } from 'vitest';
import { analyze, DEFAULT_CONFIG } from '@focal-stats/core';
import type { PhotoExif } from '@focal-stats/core';
import { renderText } from './render';
import { toCsv, toJson, toHtml } from './export';

const p = (f: number): PhotoExif => ({
  name: 'x', focalLength: f, focalLength35mm: f,
  lensModel: null, cameraMake: null, cameraModel: null, fNumber: null,
});
const stats = analyze([p(35), p(35), p(50)], DEFAULT_CONFIG);

describe('output', () => {
  it('renderText 含分布与洞察标题', () => {
    const out = renderText(stats);
    expect(out).toMatch(/焦段分布/);
    expect(out).toMatch(/洞察/);
    expect(out).toMatch(/35/);
  });
  it('toJson 可被解析回结构', () => {
    expect(JSON.parse(toJson(stats)).total).toBe(3);
  });
  it('toCsv 首行为表头', () => {
    expect(toCsv(stats).split('\n')[0]).toBe('focal,count,percentage');
  });
  it('toHtml 是完整 HTML 文档', () => {
    expect(toHtml(stats)).toMatch(/^<!doctype html>/);
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run packages/cli/src/output.test.ts`
Expected: FAIL。

- [ ] **Step 3: 实现 `render.ts`**

```ts
import type { FocalStats } from '@focal-stats/core';

function bar(percentage: number, width = 30): string {
  const filled = Math.round((percentage / 100) * width);
  return '█'.repeat(filled) + '░'.repeat(Math.max(0, width - filled));
}

export function renderText(stats: FocalStats): string {
  const unit = stats.mode === 'equiv35' ? 'mm(等效)' : 'mm';
  const lines: string[] = [];
  lines.push(`扫描 ${stats.scanned} 文件 · ${stats.total} 张含焦段 · 跳过 ${stats.skipped.length}`);
  lines.push('', `焦段分布（${unit}）:`);
  for (const b of stats.buckets) {
    lines.push(`  ${b.label.padStart(8)} | ${bar(b.percentage)} ${b.percentage}% (${b.count})`);
  }
  lines.push('', 'Top 焦段:');
  for (const t of stats.topFocal) {
    lines.push(`  ${String(t.focal).padStart(4)}${unit}: ${t.count} 张 (${t.percentage}%)`);
  }
  lines.push('', '洞察:');
  for (const i of stats.insights) lines.push(`  • ${i.message}`);
  return lines.join('\n');
}
```

- [ ] **Step 4: 实现 `export.ts`**

```ts
import type { FocalStats } from '@focal-stats/core';

export function toJson(stats: FocalStats): string {
  return JSON.stringify(stats, null, 2);
}

export function toCsv(stats: FocalStats): string {
  const rows = ['focal,count,percentage'];
  for (const e of stats.exact) {
    const pct = stats.total === 0 ? 0 : Math.round((e.count / stats.total) * 1000) / 10;
    rows.push(`${e.focal},${e.count},${pct}`);
  }
  return rows.join('\n');
}

export function toHtml(stats: FocalStats): string {
  const bars = stats.buckets
    .map(
      (b) =>
        `<div class="row"><span class="lbl">${b.label}</span>` +
        `<span class="bar" style="width:${b.percentage}%"></span>` +
        `<span class="val">${b.percentage}% (${b.count})</span></div>`,
    )
    .join('');
  const insights = stats.insights.map((i) => `<li>${i.message}</li>`).join('');
  return `<!doctype html><html lang="zh"><head><meta charset="utf-8"><title>焦段统计</title><style>
body{font-family:system-ui;max-width:720px;margin:2rem auto;padding:0 1rem}
.row{display:flex;align-items:center;gap:.5rem;margin:.25rem 0}
.lbl{width:84px;text-align:right;font-variant-numeric:tabular-nums}
.bar{height:1rem;background:#4f8cff;border-radius:3px;min-width:2px}
.val{font-size:.85rem;color:#555}</style></head><body>
<h1>焦段统计</h1>
<p>扫描 ${stats.scanned} 文件 · ${stats.total} 张含焦段 · 跳过 ${stats.skipped.length}</p>
${bars}<h2>洞察</h2><ul>${insights}</ul></body></html>`;
}
```

- [ ] **Step 5: 运行确认通过**

Run: `npx vitest run packages/cli/src/output.test.ts`
Expected: PASS（4 个用例）。

- [ ] **Step 6: Commit**

```bash
git add packages/cli/src/render.ts packages/cli/src/export.ts packages/cli/src/output.test.ts
git commit -m "feat(cli): terminal render + json/csv/html export"
```

---

### Task 13: CLI 主入口 `cli/src/index.ts` + 打包

**Files:**
- Create: `packages/cli/src/index.ts`, `packages/cli/tsup.config.ts`
- Test: `packages/cli/src/e2e.test.ts`

- [ ] **Step 1: 实现 `index.ts`（main/bin）**

```ts
#!/usr/bin/env node
import { analyze, extractExif } from '@focal-stats/core';
import type { PhotoExif, SkippedFile } from '@focal-stats/core';
import { parseCliArgs } from './args';
import { listPhotoFiles, readHeader } from './scan';
import { mapPool } from './pool';
import { renderText } from './render';
import { toCsv, toHtml, toJson } from './export';

export async function run(argv: string[]): Promise<string> {
  const opts = parseCliArgs(argv);
  const files = await listPhotoFiles(opts.path);
  const photos: PhotoExif[] = [];
  const skipped: SkippedFile[] = [];

  const results = await mapPool(files, 8, async (file) => {
    try {
      return extractExif(await readHeader(file, opts.headerBytes), file);
    } catch {
      return { name: file, reason: 'read-error' as const };
    }
  });
  for (const r of results) {
    if ('reason' in r) skipped.push(r);
    else photos.push(r);
  }

  const stats = analyze(photos, opts.config, skipped);
  if (opts.format === 'json') return toJson(stats);
  if (opts.format === 'csv') return toCsv(stats);
  if (opts.format === 'html') return toHtml(stats);
  return renderText(stats);
}

// 直接执行时运行
if (import.meta.url === `file://${process.argv[1]}`) {
  run(process.argv.slice(2))
    .then((out) => process.stdout.write(out + '\n'))
    .catch((err) => {
      console.error(`错误: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    });
}
```

- [ ] **Step 2: 写 e2e 测试（对 core 夹具目录跑 run()）**

```ts
import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { run } from './index';

const fixturesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../core/test/fixtures',
);

describe('cli run (e2e)', () => {
  it('对夹具目录输出 JSON 含焦段', async () => {
    const out = await run([fixturesDir, '--json']);
    const stats = JSON.parse(out);
    expect(stats.total).toBeGreaterThanOrEqual(1);
    expect(stats.topFocal[0].focal).toBe(52); // equiv35 默认
  });

  it('text 模式含洞察', async () => {
    const out = await run([fixturesDir]);
    expect(out).toMatch(/最常用焦段/);
  });
});
```

- [ ] **Step 3: 运行确认通过**

Run: `npx vitest run packages/cli/src/e2e.test.ts`
Expected: PASS（2 个用例）。

- [ ] **Step 4: 写 `tsup.config.ts` 并构建出可执行 bin**

`packages/cli/tsup.config.ts`:
```ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { index: 'packages/cli/src/index.ts' },
  outDir: 'packages/cli/dist',
  format: ['esm'],
  target: 'node20',
  noExternal: ['@focal-stats/core', 'exifreader'],
  banner: { js: '#!/usr/bin/env node' },
  clean: true,
});
```

- [ ] **Step 5: 构建并手动验证（指向 core 夹具目录）**

Run:
```bash
npm run build:cli
node packages/cli/dist/index.js packages/core/test/fixtures
```
Expected: 终端打印焦段分布条形图 + "最常用焦段：52mm(等效)" + 洞察。

- [ ] **Step 6: Commit**

```bash
git add packages/cli/src/index.ts packages/cli/src/e2e.test.ts packages/cli/tsup.config.ts
git commit -m "feat(cli): wire pipeline, bin entry, tsup build"
```

---

## Phase 3 — Web（GitHub Pages）

### Task 14: 纯函数 `web/src/chart.ts` + `web/src/settings.ts`

**Files:**
- Create: `packages/web/src/chart.ts`, `packages/web/src/settings.ts`
- Test: `packages/web/src/web-pure.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
import { describe, expect, it } from 'vitest';
import { analyze, DEFAULT_CONFIG } from '@focal-stats/core';
import type { PhotoExif } from '@focal-stats/core';
import { barChartSvg } from './chart';
import { serializeConfig, parseStoredConfig } from './settings';

const p = (f: number): PhotoExif => ({
  name: 'x', focalLength: f, focalLength35mm: f,
  lensModel: null, cameraMake: null, cameraModel: null, fNumber: null,
});

describe('barChartSvg', () => {
  it('生成 svg 且每桶一个 rect', () => {
    const stats = analyze([p(35), p(50)], DEFAULT_CONFIG);
    const svg = barChartSvg(stats);
    expect(svg.startsWith('<svg')).toBe(true);
    expect((svg.match(/<rect/g) ?? []).length).toBe(stats.buckets.length);
  });
});

describe('settings 序列化', () => {
  it('round-trip 配置', () => {
    const json = serializeConfig({ ...DEFAULT_CONFIG, topN: 7 });
    expect(parseStoredConfig(json).topN).toBe(7);
  });
  it('坏 JSON 回退默认配置', () => {
    expect(parseStoredConfig('{bad').mode).toBe('equiv35');
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run packages/web/src/web-pure.test.ts`
Expected: FAIL。

- [ ] **Step 3: 实现 `chart.ts`**

```ts
import type { FocalStats } from '@focal-stats/core';

export function barChartSvg(stats: FocalStats, width = 600, barH = 28): string {
  const max = Math.max(1, ...stats.buckets.map((b) => b.count));
  const rows = stats.buckets
    .map((b, i) => {
      const w = Math.round((b.count / max) * (width - 130));
      const y = i * barH;
      return (
        `<text x="0" y="${y + barH / 2}" dominant-baseline="middle" font-size="12">${b.label}</text>` +
        `<rect x="70" y="${y + 4}" width="${w}" height="${barH - 8}" fill="#4f8cff" rx="3"/>` +
        `<text x="${78 + w}" y="${y + barH / 2}" dominant-baseline="middle" font-size="11" fill="#555">${b.percentage}% (${b.count})</text>`
      );
    })
    .join('');
  const h = Math.max(barH, stats.buckets.length * barH);
  return `<svg viewBox="0 0 ${width} ${h}" width="100%" xmlns="http://www.w3.org/2000/svg">${rows}</svg>`;
}
```

- [ ] **Step 4: 实现 `settings.ts`**

```ts
import { parseConfig, DEFAULT_CONFIG } from '@focal-stats/core';
import type { AnalyzeConfig } from '@focal-stats/core';

export function serializeConfig(config: AnalyzeConfig): string {
  return JSON.stringify(config);
}

export function parseStoredConfig(json: string): AnalyzeConfig {
  try {
    return parseConfig(JSON.parse(json) as Partial<AnalyzeConfig>);
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}
```

- [ ] **Step 5: 运行确认通过**

Run: `npx vitest run packages/web/src/web-pure.test.ts`
Expected: PASS（4 个用例）。

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/chart.ts packages/web/src/settings.ts packages/web/src/web-pure.test.ts
git commit -m "feat(web): pure SVG chart + config serialization"
```

---

### Task 15: Web Worker 解析 `web/src/worker.ts`

**Files:**
- Create: `packages/web/src/worker.ts`

- [ ] **Step 1: 实现 `worker.ts`（DOM/Worker 环境，单测交由 main 手动验证覆盖）**

```ts
import { extractExif } from '@focal-stats/core';
import type { PhotoExif, SkippedFile } from '@focal-stats/core';

interface ParseRequest { files: File[]; headerBytes: number }

self.onmessage = async (e: MessageEvent<ParseRequest>) => {
  const { files, headerBytes } = e.data;
  const photos: PhotoExif[] = [];
  const skipped: SkippedFile[] = [];
  let done = 0;
  for (const file of files) {
    try {
      const buf = await file.slice(0, headerBytes).arrayBuffer();
      const r = extractExif(buf, file.name);
      if ('reason' in r) skipped.push(r);
      else photos.push(r);
    } catch {
      skipped.push({ name: file.name, reason: 'read-error' });
    }
    done++;
    if (done % 25 === 0 || done === files.length) {
      postMessage({ type: 'progress', done, total: files.length });
    }
  }
  postMessage({ type: 'done', photos, skipped });
};
```

- [ ] **Step 2: Commit**

```bash
git add packages/web/src/worker.ts
git commit -m "feat(web): worker parses files via core (header-only)"
```

---

### Task 16: 页面装配 `index.html` + `web/src/main.ts` + Vite 配置

**Files:**
- Create: `packages/web/index.html`, `packages/web/src/main.ts`, `packages/web/vite.config.ts`

- [ ] **Step 1: 写 `vite.config.ts`（base 默认 `/focal-stats/`，可用环境变量覆盖仓库名）**

```ts
import { defineConfig } from 'vite';

export default defineConfig({
  root: 'packages/web',
  base: process.env.PAGES_BASE ?? '/focal-stats/',
  build: { outDir: 'dist', emptyOutDir: true },
});
```

- [ ] **Step 2: 写 `index.html`**

```html
<!doctype html>
<html lang="zh">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>焦段统计 · Focal Stats</title>
    <style>
      body { font-family: system-ui; max-width: 760px; margin: 2rem auto; padding: 0 1rem; }
      fieldset { border: 1px solid #ddd; border-radius: 8px; margin: 1rem 0; }
      label { display: inline-flex; gap: .35rem; align-items: center; margin: .25rem .75rem .25rem 0; }
      input[type="text"], input[type="number"] { width: 8rem; }
      #status { color: #555; }
      .card { background: #f6f8ff; border-radius: 8px; padding: .75rem 1rem; margin: .5rem 0; }
    </style>
  </head>
  <body>
    <h1>焦段统计</h1>
    <p>选择 SD 卡文件夹，照片<strong>不会上传</strong>，全程浏览器本地解析 EXIF。</p>

    <p><input id="picker" type="file" webkitdirectory multiple /></p>

    <fieldset>
      <legend>设置</legend>
      <label>模式
        <select id="mode"><option value="equiv35">35mm 等效</option><option value="raw">原始焦距</option></select>
      </label>
      <label>分桶边界 <input id="buckets" type="text" value="16,24,35,50,70,100,200" /></label>
      <label>镜头筛选 <input id="lens" type="text" placeholder="如 24-70" /></label>
      <label>机身筛选 <input id="camera" type="text" placeholder="如 A7" /></label>
      <label>定焦阈值 <input id="threshold" type="number" min="0" max="1" step="0.05" value="0.6" /></label>
      <label>Top-N <input id="topn" type="number" min="1" value="3" /></label>
    </fieldset>

    <p id="status"></p>
    <div id="chart"></div>
    <div id="insights"></div>

    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 3: 写 `main.ts`（DOM 装配 + 调用 worker + core analyze）**

```ts
import { analyze, parseConfig } from '@focal-stats/core';
import type { AnalyzeConfig, PhotoExif, SkippedFile } from '@focal-stats/core';
import { barChartSvg } from './chart';
import { parseStoredConfig, serializeConfig } from './settings';

const HEADER_BYTES = 1024 * 1024;
const $ = (id: string) => document.getElementById(id) as HTMLInputElement;

function readConfigFromForm(): AnalyzeConfig {
  return parseConfig({
    mode: $('mode').value as AnalyzeConfig['mode'],
    bucketBoundaries: $('buckets').value.split(',').map((s) => Number(s.trim())),
    filterLens: $('lens').value || null,
    filterCamera: $('camera').value || null,
    primeThreshold: Number($('threshold').value),
    topN: Number($('topn').value),
  });
}

function loadFormFromStorage(): void {
  const cfg = parseStoredConfig(localStorage.getItem('focal-stats-config') ?? '');
  $('mode').value = cfg.mode;
  $('buckets').value = cfg.bucketBoundaries.join(',');
  $('lens').value = cfg.filterLens ?? '';
  $('camera').value = cfg.filterCamera ?? '';
  $('threshold').value = String(cfg.primeThreshold);
  $('topn').value = String(cfg.topN);
}

function render(photos: PhotoExif[], skipped: SkippedFile[]): void {
  let config: AnalyzeConfig;
  try {
    config = readConfigFromForm();
  } catch (err) {
    document.getElementById('status')!.textContent =
      `配置错误：${err instanceof Error ? err.message : String(err)}`;
    return;
  }
  localStorage.setItem('focal-stats-config', serializeConfig(config));
  const stats = analyze(photos, config, skipped);
  document.getElementById('chart')!.innerHTML = barChartSvg(stats);
  document.getElementById('insights')!.innerHTML =
    '<h2>洞察</h2>' + stats.insights.map((i) => `<div class="card">${i.message}</div>`).join('');
}

let lastPhotos: PhotoExif[] = [];
let lastSkipped: SkippedFile[] = [];

function bindReRender(): void {
  for (const id of ['mode', 'buckets', 'lens', 'camera', 'threshold', 'topn']) {
    $(id).addEventListener('change', () => render(lastPhotos, lastSkipped));
  }
}

$('picker').addEventListener('change', async (ev) => {
  const files = Array.from((ev.target as HTMLInputElement).files ?? []);
  const status = document.getElementById('status')!;
  if (files.length === 0) return;
  status.textContent = `读取 ${files.length} 个文件…`;

  const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (e: MessageEvent) => {
    const d = e.data;
    if (d.type === 'progress') status.textContent = `解析中 ${d.done}/${d.total}…`;
    else if (d.type === 'done') {
      lastPhotos = d.photos;
      lastSkipped = d.skipped;
      status.textContent = `完成：${d.photos.length} 张含焦段，跳过 ${d.skipped.length}`;
      render(lastPhotos, lastSkipped);
      worker.terminate();
    }
  };
  worker.postMessage({ files, headerBytes: HEADER_BYTES });
});

loadFormFromStorage();
bindReRender();
```

- [ ] **Step 4: 本地手动验证（指向 core 夹具目录或一张真实 SD 卡）**

Run: `npx vite packages/web`
然后浏览器打开提示的本地地址，点选 `packages/core/test/fixtures` 文件夹。
Expected: 状态显示"完成：1 张含焦段"，图表出现一条 `50–70` 桶（夹具 52mm 等效），洞察卡片出现"最常用焦段：52mm 等效"。改设置（如切到原始焦距/改分桶）图表即时刷新。

- [ ] **Step 5: 构建验证**

Run: `npm run build:web`
Expected: `packages/web/dist/` 生成 `index.html` 及打包后的 JS，无 error。

- [ ] **Step 6: Commit**

```bash
git add packages/web/index.html packages/web/src/main.ts packages/web/vite.config.ts
git commit -m "feat(web): folder picker UI, worker wiring, live re-render"
```

---

## Phase 4 — CI / Pages / 文档

### Task 17: GitHub Actions（测试 + 部署 Pages）

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: 写 workflow**

```yaml
name: CI & Deploy Pages
on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build-deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deploy.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm test
      - name: Build web
        run: PAGES_BASE="/${GITHUB_REPOSITORY#*/}/" npm run build:web
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: packages/web/dist
      - id: deploy
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: test on push + deploy web to GitHub Pages"
```

> **部署前置（人工，一次性）**：在 GitHub 创建仓库（建议名 `focal-stats`，使 `PAGES_BASE` 与默认一致）→ 推送 → 仓库 Settings → Pages → Source 选 "GitHub Actions"。若仓库不叫 `focal-stats`，workflow 已用 `${GITHUB_REPOSITORY#*/}` 自动取仓库名，无需改代码。

### Task 18: README + 根 tsconfig 引用 + 最终校验

**Files:**
- Create: `README.md`, `packages/core/tsconfig.json`, `packages/cli/tsconfig.json`, `packages/web/tsconfig.json`

- [ ] **Step 1: 各子包 `tsconfig.json` 继承 base**

三个文件内容相同：
```json
{ "extends": "../../tsconfig.base.json", "include": ["src"] }
```

- [ ] **Step 2: 写 `README.md`**

```markdown
# Focal-Stats · 焦段统计

读取 SD 卡/文件夹里照片（含 RAW）的 EXIF，统计最常用焦段并给出镜头建议。
照片不上传：CLI 在本地、网页版在浏览器内全程本地解析。

## 网页版
部署在 GitHub Pages：选 SD 卡文件夹 → 即时看到焦段直方图与洞察。

## CLI
\`\`\`bash
npm install
npm run build:cli
node packages/cli/dist/index.js /Volumes/你的SD卡 \
  --mode equiv35 --buckets 24,35,50,85 --lens "24-70" --top 5
# 导出：--json | --csv | --html
\`\`\`

## 自定义
分桶边界、镜头/机身筛选、原始焦距↔35mm 等效、定焦阈值/Top-N。
CLI 用参数，网页版用设置面板（存 localStorage）。

## 性能
只读每个文件头部约 1MB 的 EXIF，不读整张 RAW；CLI 并发读取，网页用 Web Worker 解析。

## 开发
\`\`\`bash
npm test          # 全部单测
npm run build:web # 构建网页
\`\`\`
```

- [ ] **Step 3: 最终全量校验**

Run:
```bash
npx vitest run --coverage
npm run build:cli
npm run build:web
```
Expected: 全部测试 PASS、core 覆盖率 ≥ 80%、两处构建无 error。

- [ ] **Step 4: Commit**

```bash
git add README.md packages/*/tsconfig.json
git commit -m "docs: add README; chore: per-package tsconfig"
```

---

## 验收清单（对照 spec）

- [ ] 读取文件夹（含 RAW 扩展名）EXIF，统计焦段 → Task 7/10/13
- [ ] 35mm 等效归一 + 缺失回退计数 → Task 3/5/6
- [ ] 精确直方图 + 自定义分桶 → Task 4/5
- [ ] Top-N + 按镜头/机身分组 → Task 5
- [ ] 定焦建议（阈值可调） → Task 6
- [ ] 四项自定义（分桶/筛选/raw↔35mm/阈值·TopN）CLI+Web 共用 config → Task 2/9/16
- [ ] CLI：终端图表 + JSON/CSV/HTML 导出 → Task 12/13
- [ ] Web：文件夹选择、本地不上传、Web Worker、设置面板、即时刷新 → Task 14/15/16
- [ ] 性能：只读文件头、CLI 并发、Web Worker → Task 10/11/15
- [ ] 错误处理：解析/读取失败计入 skipped，配置非法 fail-fast → Task 2/5/7/13
- [ ] 部署 GitHub Pages（Actions 自动） → Task 17
- [ ] 测试覆盖率 ≥ 80%（core 为主） → Task 8/18
