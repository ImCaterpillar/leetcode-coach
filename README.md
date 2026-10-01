# Hot 100 极简刷题台（LeetCode Coach Lite）

[![Deploy](https://github.com/ImCaterpillar/leetcode-coach/actions/workflows/deploy.yml/badge.svg)](https://github.com/ImCaterpillar/leetcode-coach/actions/workflows/deploy.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-37e4d4.svg)](LICENSE)

**在线试用：https://imcaterpillar.github.io/leetcode-coach/**

打开后只关注三件事：今天做哪题、这题做得怎样、下一步复习什么。基于 **Vite + React**
的纯前端单页应用，用**间隔重复（Spaced Repetition）**安排 Hot 100 的复习节奏；
数据只存在浏览器本地（localStorage），无后端、无账号、无追踪。

## 核心能力

- **今日队列**：新题 / 复习 / 上限均可配置，推荐题给出推荐原因。
- **计时器**：重复开始保护、切题自动保存、刷新恢复、过短时长忽略。
- **复习反馈**：Again / Hard / Good / Easy 四档，按反馈推进下次复习；同日反馈防过度推进。
- **进度拆分**：已接触 / 独立 AC / 薄弱题；薄弱题按严重程度排序，支持错因标签。
- **数据安全**：导入前预览 + 确认弹窗，并自动下载当前数据备份；兼容旧版本地存储键。
- 手机端极简单列任务流，桌面/移动均可用。

## 本地运行

```bash
npm install
npm run dev        # 开发
npm run build      # 构建到 dist/（相对路径 base，可部署到任意子路径）
npm test           # node 断言：题库 100 题、统计与推荐逻辑
```

## 数据与隐私

记录保存在浏览器 localStorage（键名 `leetcode-hot100-static-records-v1` 等），
不上传任何服务器；清除浏览器数据即删除。本仓库不含任何密钥或后端配置。

## License

[MIT](LICENSE)
