# Third-party assets / 第三方皮肤来源与改动说明

本仓库内置的两款皮肤均来自第三方仓库，版权归原作者所有，许可证为 **CC BY-NC-SA 4.0**
（个人及非商业用途可用，禁止商用，衍生作品必须同许可证共享）。它们只是被**收录进本离线包**，
用于在 dsh 皮肤管理器里直接安装/切换；授权信息以各包内 `LICENSE` / `NOTICE` 为准。

## 1. 鲸鱼娘昼夜工坊（Deep Whale Day & Night）

| 项 | 值 |
|---|---|
| 来源 | https://github.com/GGBond2424648901/deep-whale-day-night-theme |
| 收录版本 | v0.1.10（提交 `09976a1eb252a609cf6a94ff3e2bfa9a5756e3f3`） |
| 包名（本仓库） | `@dsh-external/dsh-client-ui-skin-deep-whale-day-night` |
| 作者/贡献 | Small-tailqwq & Deep Whale contributors；画师 上善 / ZipZipPipe |
| 许可 | CC BY-NC-SA 4.0（包内 LICENSE/NOTICE） |

**本仓库的改动（为兼容而做的离线修补，非上游行为）：**

1. `lib/index.js`（宿主半）被替换为"独立模式"空实现。
   原因：上游 v0.1.10 通过 rc.6 不存在的 `themeCatalog` 主机服务注册；rc.6 上没有
   `dsh-host-theme-catalog` / `dsh-client-ui-theme-plugins`（npm 404），宿主半会一直挂起。
   独立模式让浏览器皮肤包（自包含、无 require 依赖）按普通客户端插件加载即可生效。
2. `skin.json` 的 `wiring.id` 改为 `ui-skin-deep-whale-day-night`（上游沿用家族 id
   `ui-skin-maid-atelier`，会与女仆工坊皮肤撞行 id；本仓库按包名推导唯一行 id）。
3. `package.json` 的 `dsh.client.inject` 精简为 `["@deepseek-ai/dsh-client-ui-theme"]`
   （移除 rc.6 缺失的 theme-plugins 依赖声明；皮肤包本身不 require 它）。
4. 已删除调试用 `lib/client.js.map`（约 10MB，分发无用）。

> rc.7 环境由用户侧 `dsh-skin-rc7-bridge` 提供 `themePlugins` 适配与 strict RPC 描述符；
> 该桥接包不在本仓库内（属于部署定制）。

## 2. 深海女仆工坊（Maid Atelier）

| 项 | 值 |
|---|---|
| 来源 | https://github.com/Small-tailqwq/dsh-deep-whale |
| 收录版本 | v0.0.1（提交 `1b65506759241e75a94fb1a23b8c11d10fe293de`） |
| 包名（本仓库） | `@dsh-external/dsh-client-ui-skin-maid-atelier` |
| 作者 | Small-tailqwq |
| 许可 | CC BY-NC-SA 4.0（包内 LICENSE/NOTICE） |

**改动：** 无（原样收录；`skin.json` 的 `wiring.id` 恰好与其按包名推导的行 id 一致）。

## 署名要求

按 CC BY-NC-SA 4.0 要求保留署名。若转发/再分发本仓库，请保留：
- 各包内 `LICENSE` / `NOTICE` 文件；
- 画师署名：上善（Shangshan）/ ZipZipPipe；
- 皮肤作者：Small-tailqwq、GGBond2424648901；
- 本 `THIRD-PARTY.md` 的来源与改动说明。

## 版权声明

皮肤资源（角色立绘、装饰、预览图等）版权归原作者。本仓库**不是**皮肤的授权代理；
商用、修改后商用等超出 CC BY-NC-SA 4.0 范围的使用请直接联系原作者。