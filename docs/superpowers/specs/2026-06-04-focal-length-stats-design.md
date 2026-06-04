# Focal-Stats 设计文档

- **日期**: 2026-06-04
- **状态**: 待用户评审
- **一句话**: 读取 SD 卡（或任意文件夹）里照片的 EXIF，统计最常用焦段，给出可执行的镜头建议。一套 TypeScript 核心，同时驱动本地 CLI 和部署在 GitHub Pages 的网页版。

---

## 1. 背景与目标

摄影师想知道自己"最常用的焦段"，从而决定买哪支定焦、是否需要某段变焦。需求拆解：

1. 读取 SD 卡里照片的 EXIF（含 RAW），统计焦段分布。
2. 既要本地命令行工具，也要能"上线"的 GitHub 服务（网页版）。
3. 比现有工具做得更好（性能、RAW 支持、可执行洞察、零上传）。

**成功标准**：
- 把工具指向一张满是 RAW/JPEG 的 SD 卡，秒级～十几秒内得到焦段直方图 + Top 焦段 + 定焦建议。
- 网页版部署在 GitHub Pages，照片**不上传**，纯浏览器本地解析。
- 统计逻辑只写一次，CLI 和 Web 复用。

## 2. 现有工具调研 & 差异化

| 工具 | 形态 | 主要短板 |
|---|---|---|
| exif-stats (Python) | 脚本 | 只读 JPEG |
| Focal-length-analyzer | 脚本 | 仅基础直方图 |
| FocalLengthAnalyzer (.NET) | 控制台 | 只读 JPEG |
| photo-histogram | macOS | 绑定 Apple 照片库 |
| ExposurePlot | Windows GUI | 明确只扫 JPEG，需安装 |
| PhotoStatistica | iOS/macOS App | 付费、闭源 |
| Jeffrey Friedl LR 插件 | LR 插件 | 必须有 Lightroom |

**差异化（= 我们的优化点，逐条对标上表短板）**：

1. **支持 RAW**：CR2/NEF/ARW/DNG/ORF 等都内嵌标准 EXIF/TIFF IFD，可直接读。
2. **零安装 / 零上传 / 零服务器成本**：网页版部署 GitHub Pages，浏览器本地解析 EXIF。
3. **35mm 等效归一**：跨画幅（全画幅 / APS-C / M43）可横向比较。
4. **可执行洞察**：不只给图，还给"78% 落在 24–35mm 等效 → 适合 35mm 定焦"这类结论。
5. **性能**：只读文件头的 EXIF 字节（默认前 ~1MB），不读整张 50MB RAW —— 满卡场景相对现有工具的最大提速点。

## 3. 总体架构（npm workspaces 单仓库）

```
focal-stats/
├─ packages/
│  ├─ core/            # 纯逻辑：EXIF 解析 + 归一 + 分桶 + 聚合 + 洞察 + 配置
│  ├─ cli/             # Node 命令行；读文件、调用 core、终端图表 + 导出
│  └─ web/             # Vite 静态站 → GitHub Pages；浏览器读文件、调用 core
├─ .github/workflows/  # CI：测试 + 自动部署 web 到 Pages
├─ docs/superpowers/specs/
└─ package.json        # workspaces 根
```

**关键边界原则**：`core` 不碰文件系统、不碰 DOM。读取"文件头字节"这个平台相关动作由 cli（`fs`）和 web（`File.slice`）各自实现，向 core 传入 `ArrayBuffer`。这样 core 可在 Node 和浏览器里 100% 复用，也最好测。

## 4. 数据模型（core 类型）

> 遵循不可变原则：所有聚合函数返回新对象，绝不原地修改输入。

```ts
// 单张照片提取出的原始 EXIF（已规整）
interface PhotoExif {
  name: string;                     // 文件名或相对路径
  focalLength: number | null;       // mm，原始
  focalLength35mm: number | null;   // 35mm 等效（来自 EXIF 标签）
  lensModel: string | null;
  cameraMake: string | null;
  cameraModel: string | null;
  fNumber: number | null;           // 光圈（辅助维度）
}

interface SkippedFile {
  name: string;
  reason: 'no-exif' | 'no-focal-length' | 'parse-error' | 'read-error';
}

interface Bucket {
  label: string;      // 如 "24–35"
  min: number;        // 含
  max: number;        // 不含；最后一桶 max=Infinity
  count: number;
  percentage: number; // 占 total 比例 0–100
}

interface GroupStat {
  key: string;        // 镜头名 / 机身名
  count: number;
  topFocal: number;   // 该组最常用焦段
}

interface Insight {
  type: 'most-used' | 'prime-suggestion' | 'concentration';
  message: string;    // 人类可读（中文）
  data?: Record<string, unknown>;
}

interface FocalStats {
  mode: 'raw' | 'equiv35';                       // 本次用了哪种焦距
  total: number;                                 // 有可用焦段的照片数
  scanned: number;                               // 实际扫描的文件数
  equivFallbackCount: number;                    // equiv35 模式下因无等效标签而回退原始焦距的张数
  skipped: SkippedFile[];                        // 跳过清单（不静默吞）
  buckets: Bucket[];                             // 分组直方图
  exact: { focal: number; count: number }[];     // 精确值直方图（降序）
  topFocal: { focal: number; count: number; percentage: number }[]; // Top-N
  byLens: GroupStat[];
  byCamera: GroupStat[];
  insights: Insight[];
}

// 用户可自定义的全部配置（CLI 参数 / config 文件 / Web 设置面板共用同一 schema）
interface AnalyzeConfig {
  mode: 'raw' | 'equiv35';          // ① 原始焦距 vs 35mm 等效切换；默认 equiv35
  bucketBoundaries: number[];       // ② 自定义分桶边界（升序断点，如 [16,24,35,50,70,100,200]）
  filterLens: string | null;        // ③ 仅统计镜头名包含此子串的照片
  filterCamera: string | null;      // ③ 仅统计机身名包含此子串的照片
  primeThreshold: number;           // ④ 集中度达到多少才推荐定焦，0–1，默认 0.6
  topN: number;                     // ④ 展示前几名焦段，默认 3
}
```

## 5. `core` 包模块划分（每个文件单一职责，<400 行）

| 文件 | 职责 | 关键导出 |
|---|---|---|
| `types.ts` | 上面的类型定义 | 全部 interface |
| `config.ts` | 默认配置 + 校验（边界升序、阈值 0–1 等，非法即抛错） | `DEFAULT_CONFIG`, `parseConfig`, `validateConfig` |
| `exif.ts` | 包 `exifreader`，输入 `ArrayBuffer` → `PhotoExif \| SkippedFile` | `extractExif` |
| `normalize.ts` | 取 raw / equiv35 焦距；equiv35 缺失则回退 raw 并标注 | `normalizeFocal` |
| `bucket.ts` | 按 `bucketBoundaries` 把焦距数组分桶 | `bucketize` |
| `aggregate.ts` | 过滤 + 分桶 + 精确直方图 + Top-N + 按镜头/机身分组 | `aggregate` |
| `insights.ts` | 众数、集中度、定焦建议 | `generateInsights` |
| `index.ts` | 对外门面：`analyze(photos, config)` | `analyze` |

**核心入口**：`analyze(photos: PhotoExif[], config: AnalyzeConfig): FocalStats`，纯函数。

**EXIF 字段映射**（exifreader → PhotoExif）：
- `focalLength` ← `FocalLength`
- `focalLength35mm` ← `FocalLengthIn35mmFilm`（部分相机写作 `FocalLengthIn35mmFormat`，都尝试）
- `lensModel` ← `LensModel` / `Lens`
- `cameraMake/Model` ← `Make` / `Model`
- `fNumber` ← `FNumber`

**35mm 等效策略**：优先用 EXIF 等效标签；缺失时回退原始焦距。`aggregate` 在 equiv35 模式下统计回退张数写入 `FocalStats.equivFallbackCount`，洞察里据此提示"部分照片无等效信息，已按原始焦距计"。**不自建裁切系数数据库**（见非目标）。

## 6. `cli` 包

- 命令：`focal-stats <path> [options]`，可 `npx` 运行。
- 读取：递归扫描目录，按扩展名过滤（jpg/jpeg/heic/cr2/cr3/nef/arw/raf/orf/rw2/dng/tif…），对每个文件**只读前 `--header-bytes`（默认 1MB）**，转 `ArrayBuffer` 交给 `core.extractExif`。
- 并发：用有上限的并发池（默认并发 8）读文件，避免一次性打开成千上万句柄。
- 输出：
  - 默认：终端彩色条形图 + Top 焦段表 + 洞察 + "跳过 N 张"统计。
  - `--json` / `--csv`：导出结构化数据。
  - `--html`：生成单文件可分享报告（内联同一套图表渲染）。
- 配置参数（映射 `AnalyzeConfig`）：
  - `--mode raw|equiv35`
  - `--buckets 16,24,35,50,70,100,200`（① 自定义分桶）
  - `--lens "24-70"` / `--camera "A7"`（③ 筛选）
  - `--prime-threshold 0.6` / `--top 3`（④）
  - `--config focal-stats.config.json`（从文件读全部配置）
  - `--header-bytes 1048576`（性能旋钮）

## 7. `web` 包（GitHub Pages）

- 技术：Vite + 原生 TypeScript（不引框架，bundle 最小）。
- 选文件：`<input type="file" webkitdirectory multiple>` 选整个 SD 卡文件夹（Chrome/Edge/Safari/Firefox 都支持，递归拿到文件）+ 拖拽兜底。
- 解析：**Web Worker** 里跑 EXIF 解析（每文件 `File.slice(0, headerBytes)` → `arrayBuffer()` → `core.extractExif`），主线程只更新进度条，保证大文件夹下 UI 不卡（性能优化）。
- 照片**绝不上传**，全程浏览器本地。
- 展示：交互式焦段直方图 + 分组饼图 + 洞察卡片 + "跳过 N 张"提示。
- 设置面板（映射同一 `AnalyzeConfig`，存 localStorage）：分桶编辑、镜头/机身筛选、raw/35mm 切换、阈值/Top-N。
- 图表：手写轻量 SVG/CSS 条形图（零依赖，bundle 最小）。

## 8. 自定义/配置（四项，CLI 与 Web 共用 `AnalyzeConfig`）

1. **自定义分桶边界** → `bucketBoundaries`（CLI `--buckets`，Web 设置面板可增删断点）。
2. **按镜头/机身筛选** → `filterLens` / `filterCamera`（子串匹配，大小写不敏感）。
3. **原始焦距 / 35mm 等效切换** → `mode`。
4. **定焦建议阈值 / Top-N 可调** → `primeThreshold` / `topN`。

非法配置（如边界非升序、阈值越界）在 `validateConfig` 处 **fail fast** 报清晰错误。

## 9. 错误处理

- 单文件读取/解析失败 → 记入 `skipped`（带 reason），不影响整体，不静默吞。
- 无 EXIF / 无焦段 → 计入 `skipped`，最终汇总展示"跳过 N 张（无焦段信息）"。
- Web 选文件夹被拒/为空 → 友好提示。
- 配置非法 → 启动即报错并指出哪项。
- 全部文件都无焦段 → 明确告知"未发现任何含焦段的照片"，而非画空图。

## 10. 性能优化（对标"需要考虑优化"）

1. **只读文件头**：默认前 1MB，不读整张 RAW —— 最大提速点。
2. **并发读取**（CLI）/ **Web Worker 解析**（Web）。
3. core 为纯函数、零 IO，便于缓存与测试。
4. Web bundle 零运行时框架依赖，首屏快。

## 11. 测试策略（TDD，目标覆盖率 80%+）

- 框架：Vitest（Node + 浏览器逻辑通用）。
- `core`（重点）：`normalize` / `bucket` / `aggregate` / `insights` / `config` 全部纯函数单元测试，先写测试（RED）再实现（GREEN）。
- `exif.ts`：用少量小体积样片 fixture（JPEG + 1 张小 DNG/RAW）做提取集成测试，置于 `packages/core/test/fixtures/`。
- `cli`：对 fixtures 目录跑端到端，断言输出 JSON。
- `web`：解析/聚合逻辑走 core 测试覆盖；文件夹选择 → 渲染的 e2e（Playwright）列为 v1 的 TODO（非阻塞）。

## 12. 部署（GitHub Actions → Pages）

- workflow：push 到 main → 安装依赖 → 跑全部测试 → 构建 `web`（Vite `base` 设为 `/<repo>/`）→ `actions/deploy-pages` 部署。
- CLI：v1 通过仓库内 `npx`/本地构建运行；发布 npm 列为后续可选项（非 v1 目标）。

## 13. 技术选型清单

- 语言：TypeScript（strict）。
- 包管理：npm workspaces（内置，无需额外工具）。
- EXIF：`exifreader`（Node + 浏览器通用，支持只读头部、TIFF/RAW）。
- 构建：web 用 Vite；cli 用 tsup（或 tsx 直接运行）。
- 测试：Vitest；可选 Playwright（web e2e）。
- CLI 参数：轻量 arg 解析（如 `node:util` 的 `parseArgs`，避免重依赖）。

## 14. 范围与非目标（YAGNI）

**非目标（v1 不做）**：
- ISO / 快门速度统计（结构已预留 `fNumber`，后续可扩展维度）。
- 自建相机裁切系数数据库（依赖 EXIF 自带的 35mm 等效标签）。
- 写入 / 修改 EXIF。
- 云端上传、账号体系。
- 移动原生 App。

## 15. 里程碑/分期

- **P1 — core（TDD）**：types/config/exif/normalize/bucket/aggregate/insights/index + 单测达标。
- **P2 — CLI**：文件读取适配器、并发、终端图表、JSON/CSV/HTML 导出、参数映射。
- **P3 — Web**：文件夹选择、Web Worker 解析、图表、设置面板、Pages 部署。
- **P4 — 打磨**：性能旋钮、洞察文案、README/截图、可选 Playwright e2e。
