# dsh 皮肤管理器（自包含离线移植包）

为 DeepSeek Harness Web GUI（`dsh web`）准备的**皮肤管理器 + 三套皮肤 + 一键安装脚本**仓库。
把整个仓库复制到任意机器，跑一遍脚本即可用；之后切换皮肤全部走配置 HMR，**无需重启服务**。

- 管理器插件：`@dsh-external/dsh-client-ui-skin-manager`
  - 在 设置 > 外观 · 皮肤 里列出已装皮肤、预览图、一键切换/恢复官方默认界面
- 内置皮肤：
  - `@dsh-external/dsh-client-ui-skin-deep-whale-day-night`（鲸鱼娘昼夜工坊，v0.1.10 独立模式）
  - `@dsh-external/dsh-client-ui-skin-maid-atelier`（深海女仆工坊，v0.0.1）
  - `@dsh-external/dsh-ads`（2005 门户整活皮肤，BSD-3-Clause）
- 安装脚本：`install-skin.ps1`（任意新皮肤一条命令安装）

> 验证环境：rc.7 开发服务（`apps/cli/src/bin.ts web`）与 rc.6 npm 部署均可用。
> 皮肤版权归原作者（见 `THIRD-PARTY.md`），管理器本体 MIT。

## 目录结构

```text
skin-manager/
├── install-skin.ps1            # 通用皮肤安装脚本（本地目录 / GitHub 仓库）
├── 皮肤新增指南.md              # 以后如何加新皮肤（含皮肤包最小契约）
├── THIRD-PARTY.md              # 内置皮肤的来源、提交版本与改动说明
└── packages/
    └── @dsh-external/
        ├── dsh-client-ui-skin-manager/             # 管理器插件（node 半 + 浏览器半）
        ├── dsh-client-ui-skin-deep-whale-day-night/ # 昼夜鲸鱼娘（独立模式修补版）
        ├── dsh-client-ui-skin-maid-atelier/         # 深海女仆工坊（原样上游）
        └── dsh-ads/                                 # 2005 门户整活皮肤（精简版 + 补 skin.json）
```

## 快速开始（新机器）

```powershell
# 1. 安装内置皮肤（顺序无关）
.\install-skin.ps1 -PackageDir ".\packages\@dsh-external\dsh-client-ui-skin-deep-whale-day-night"
.\install-skin.ps1 -PackageDir ".\packages\@dsh-external\dsh-client-ui-skin-maid-atelier"
.\install-skin.ps1 -PackageDir ".\packages\@dsh-external\dsh-ads"

# 2. 重启一次 dsh 服务（注册行属于安装期操作）
#    （自己的开发服务：kill 后重新运行启动命令；rc.6 npm 部署同理）

# 3. 刷新页面 → 设置 > 外观 · 皮肤
```

> 注意：注册行是"安装期"操作，装完**重启一次**就好了；之后在管理器里切换皮肤
> 走 home 层 `disabled` 标志 + HMR，**不要再重启**。

## 以后加新皮肤

一条命令：

```powershell
.\install-skin.ps1 -PackageDir "C:\path\to\皮肤包目录"          # 本地目录
.\install-skin.ps1 -Repo "https://github.com/user/repo" [-SubDir "皮肤子目录"] [-Tag v1.0]
.\install-skin.ps1 -PackageDir "..." -Active                    # 装完立即作为当前皮肤
.\install-skin.ps1 -PackageDir "..." -WhatIf                    # 只预览
```

新皮肤需要满足最小契约（`package.json` + `skin.json` + `exports["./client"]` + `lib/client.js`），
详见 [`皮肤新增指南.md`](皮肤新增指南.md)。

## 工作原理（一句话版）

- **行（row）放 profile 层**：`profiles/web/cordis.patch.yml` 注册管理器行和每个皮肤行（安装期写，幂等）。
- **开关放 home 层**：`~/.dsh/cordis.patch.yml` 只写 `disabled: true|false` 标志（运行期由管理器负责，
  永远幂等，切换走配置 HMR 热应用 + 页面自动刷新）。
- 客户端启动图（`/plugins/<pkg>/client.js`）按"启用行"重算，页面刷新即换肤，服务进程不需要重启。

## 许可

- 管理器 `dsh-client-ui-skin-manager`：MIT（本仓库作者的原创代码）
- 两款皮肤：CC BY-NC-SA 4.0，仅限个人及非商业用途；画师 上善 / ZipZipPipe，
  作者 Small-tailqwq、GGBond2424648901 —— 详见 `THIRD-PARTY.md` 与各包内 LICENSE/NOTICE。