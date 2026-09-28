# 破烂王模拟器 · Junk King Sim

> 一款像素风的「收废品经营」单机小游戏 (๑•̀ㅂ•́)و✧
>
> 你在街角支起一家废品回收站，白天跟街坊收废品、讲价、过秤，
> 晚上去翻垃圾桶捡漏；收来的破烂拆了卖材料，或者翻新成好货赚差价，
> 攒钱升级工具、去钱庄理财周转，看你能把这间小铺子做多大。

---

## ✨ 有什么好玩的

- 🧺 **收废品讲价**：每天最多 3 批货，逐件报「每斤单价」跟顾客砍价，谈拢了过秤才揭晓真分量
- 🔧 **拆解 / 翻新**：24 种废品各有料，拆了卖材料是稳当买卖，翻新好了能翻几倍卖
- 💰 **特殊商品**：保险柜、售货机这种大件，拆开说不定藏着现金哦
- 🔨 **五级工具**：越升级越厉害——提高修理成功率、省维修费、还能鉴定古董和贵金属含量
- 🏦 **钱庄**：活期吃利息、七天定期、押材料期货、缺钱能贷款
- 🌙 **夜间翻桶**：小区、电子城后巷、高档小区，翻垃圾桶「捡漏」整件破烂
- 🌐 **中英双语**：顶栏一键切换中文 / English
- 💾 **三存档 + 新手教程**：三个独立存档位，可删除；新档第一次进会带你走一遍教程
- 🖥️ **原生窗口 exe**：Windows 单文件、离线免安装、双击即玩，不是浏览器标签页

## 🚀 怎么玩

**方式一 · 下载 exe（推荐）**

到本仓库的 [Releases](../../releases) 页面下载 `破烂王模拟器.exe`，双击即可玩。
需要 Windows 10 / 11（绝大多数机器自带 WebView2 运行时，缺失时会自动回退到浏览器）。

**方式二 · 浏览器直接玩**

下载仓库后，双击 `desktop/app/index.html` 就能在浏览器里玩（自包含单文件，无需联网）。

**方式三 · 开发者跑源码**

```bash
npm start            # 起本地服务，默认 http://localhost:5173
npm run check        # 冒烟检查（模块导入 + 模拟经营 + 钱庄 + 翻桶 + 双语）
npm run render-check # mock DOM 渲染检查
```

## 📁 目录结构

```
├── index.html              # 游戏入口（ES Module 源码）
├── src/                    # 源码：config / data / core / ui / i18n
├── styles/                 # 三份样式（base / layout / components）
├── tools/                  # build / serve / check / render-check 等脚本
├── desktop/                # Windows 桌面版打包
│   ├── launcher.py         # 原生窗口启动器（本地 HTTP + WebView2）
│   ├── build_exe.py        # 一键打包成 exe
│   ├── app/index.html      # 自包含游戏本体（可直接浏览器打开）
│   └── build/icon.ico      # 程序图标
├── .github/workflows/      # 打 tag 自动构建 exe 并发布 Release
└── README.md
```

## 🔨 构建 exe / 发布

exe 二进制**不进 git 仓库**，通过 GitHub Release 单独发布：

- **自动发布**：推到 GitHub 后，打个版本标签 `git tag v1.0.0 && git push origin v1.0.0`，
  Actions 会自动构建并上传 exe 到对应 Release。
- **手动发布**：本地 `pip install -r desktop/requirements.txt && python desktop/build_exe.py`，
  构建出 `desktop/dist/破烂王模拟器.exe`，再到仓库 **Releases → Draft a new release** 上传即可。

## 🎮 关于这个项目

这是我**第一次做游戏** (｡･ω･｡)ﾉ♡
从一份设计文档开始，一路把玩法、像素图标、数值平衡、存档系统、中英双语、
再到打包成桌面 exe，都是边学边做一点点攒出来的。代码和设计肯定还有很多
不成熟的地方，还请大家多多包涵。

**非常欢迎大家提建议**：玩法觉得哪里不平衡、哪里有 bug、或者单纯想聊两句，
都欢迎到 [Issues](../../issues) 提出来，或者直接开 PR 一起改，我会超开心的 ヽ(✿ﾟ▽ﾟ)ノ

## 📜 许可证

开源免费，可自由下载、游玩、二次分发，请保留原作者署名。

---

*English: a tiny pixel-art "junk shop management" sim. Buy scrap by day, scavenge by night, strip or refurbish for profit, and run the pawn bank. Download the exe from Releases, or open `desktop/app/index.html` in any browser. This is my first game ever — feedback and issues are warmly welcome!*
