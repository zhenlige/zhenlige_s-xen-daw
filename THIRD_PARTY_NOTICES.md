# 第三方组件、素材与署名

本项目的非商业授权只覆盖权利人有权授权的原创部分，不将下列内容
重新授权，也不限制第三方许可证已经授予的权利。

## 代码依赖

| 组件 | 本项目使用版本 | 原许可证 | 说明 |
| --- | --- | --- | --- |
| `@gwegash/sf2-player` | 0.1.0 | MIT | Copyright (c) 2026 George Ash；本项目的修改见 `patches/`，使用与分发该组件及修改仍须保留 MIT 声明。 |
| `@breezystack/lamejs` | 1.2.7 | LGPL-3.0 | MP3 编码组件，原项目为 <https://github.com/shijinyu/lamejs>；LGPL/GPL 文本随本仓库 `licenses/` 提供。分发包含该组件的版本时，须另行遵守其源码、修改和重新组合等要求。 |
| Electron | 44.4.3 | MIT 及其打包组件许可证 | Electron/Chromium 等依赖各自的版权与许可；通过 `npm install` 获取的运行时须保留随附法律声明。 |
| TypeScript | 5.9.x | Apache-2.0 | 开发依赖；实际锁定版本见 `package-lock.json`。 |
| Vite / patch-package | 锁定文件所示版本 | MIT | 开发依赖，保留随包附带的原始条款。 |

依赖应从 `package-lock.json` 安装。`node_modules/`、Electron 安装包和
生成的 `dist/` 不作为本次源码发布的一部分。本声明不替代依赖中完整的
版权和许可证文件；根目录的非商业限制不改写上述依赖的原许可。

## 乐器采样与 SoundFont

| 路径 | 已知来源 / 权利信息 | 授权边界 |
| --- | --- | --- |
| `sound/salamander/` | Salamander Grand Piano，Alexander Holm；本地文件是抽取或转换后的 MP3 子集，具体转换版本来源待进一步核实。 | 上游 Salamander 项目标明 CC BY 3.0；须保留作者署名，不能把采样改称本项目原创。 |
| `sound/strumstick/`、`sound/vibraphone/`、`sound/ksharp/`、`sound/pipeorgan/` | Versilian Community Sample Library，Versilian Studios LLC；本地为转换后的 OGG 子集。 | 上游 VCSL 为 CC0-1.0；仍保留来源说明，本项目不对其添加新的独占权利。 |
| `sound/PC-98 Soundfont.sf2` | 文件内 `IENG` 为 `Youmu Konpaku`，`ICOP` 为 `2020`；注释写有部分采样来自 Sega Mega Drive、Mega CD、32X。 | 文件内未包含明确再分发许可证。现有文件与名称不构成原采样权利人的授权证明；不纳入本项目的非商业源码许可。 |
| `sound/Touhou.sf2` 及网页版对应分块 | 文件内包含 `SynthFont Viena` 等制作工具信息，没有明确的素材授权条款。 | 制作工具元数据不能证明音乐、采样或音源版权归属；不纳入本项目源码许可。分发或使用应另行核实权利。 |

非商业或同人用途不自动免除第三方授权要求。获取和使用上述音源时，
应遵守其作者和底层采样权利人的条款；本项目没有授予商业使用、官方
素材提取或任意再发布的许可，也不保证未知来源素材的权利状态。

来源参考：

- Salamander 作者与许可：<https://freepats.zenvoid.org/Piano/acoustic-grand-piano.html#SalamanderGrandPiano>
- VCSL：<https://github.com/sgossner/VCSL>
- 东方 Project 二次创作规范：<https://touhou-project.news/guidelines_en/>

东方原作的二创规范与 SoundFont 作者的条款是分别适用的；两者均不能
替代其他游戏、硬件或样本权利人可能要求的授权。

## 既有上游与其他素材

界面中的和音图设计与配色参考 Nafchanaphata 及 LΛMPLIGHT 的相关资料。
Nafchanaphata 作者为 Rtt，原项目：<https://github.com/Rtt398/nafchanaphata>。
本地遗留 `js/`、`shasav.otf`、`favicon.ico` 及网页版内相同素材保留其
原有权利状态；在核实到适用许可证前，不将其声称为本项目非商业协议
覆盖的原创作品。本项目不声称获得这些作者的合作、推荐或官方认可。

`DEMO.jidaw`、其他示例工程及测试音频可能包含第三方音乐的编配或片段。
工程文件的存在不授予其中乐曲、录音或原作的版权许可；如用于公开
演出、分发、二次创作或商业活动，应分别核实相关权利。

若权利信息需要纠正，请通过仓库 Issue 提供作品名称、具体路径和可核实
的权利说明。请勿公开敏感身份证明或私人资料。
