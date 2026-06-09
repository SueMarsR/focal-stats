# 贡献指南 / Contributing

感谢你对 **focal-stats** 的兴趣！这是一个开源（AGPL-3.0）小工具，欢迎 issue 与 PR。

## 开发环境
```bash
npm install          # Node >= 20
npm test             # 全部单测（Vitest）
npm run typecheck    # 类型检查
npm run build:web    # 构建网页
npm run build:cli    # 构建 CLI
```

## 提交约定
- 分支开发，不直接提交到 `main`。
- 提交信息用 [Conventional Commits](https://www.conventionalcommits.org/)：`feat: …` / `fix: …` / `docs: …` / `chore: …` / `test: …`。
- 改动遵循 TDD：先写失败测试再实现；保持核心逻辑 ≥ 80% 覆盖率（CI 强制）。
- 代码风格：不可变数据、错误显式处理、小而专注的文件。

## Pull Request
1. Fork → 新建分支 → 提交。
2. 确保 `npm run typecheck && npm run test:coverage && npm run build:web` 全绿。
3. 描述清楚动机与改动；关联相关 issue。

## 许可
提交即表示你同意你的贡献以 **AGPL-3.0** 授权（见 [LICENSE](./LICENSE)）。
