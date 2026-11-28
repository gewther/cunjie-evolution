# Download and Verification Report

## 交付状态

本 PR 已建立四类图库目录、图板文档、来源清单、许可记录和角色设计比对规则。

| 项目 | 结果 |
|---|---|
| 四类目录 | 已建立 |
| 当前游戏内芬里尔图集 | 已通过仓库现有路径引用 |
| 公开授权摄影 | 已核对来源页、作者、许可并嵌入远程预览 |
| 官方模型图 | 保留来源链接，未擅自复制受版权保护的产品图 |
| 电影截图 | 未复制；只保留制作方/作品研究链接 |
| 用户脚底母版 | ChatGPT Library 已找到，未同步二进制到本 PR |
| 三姿态锚点图 | ChatGPT Library 已找到，未同步二进制到本 PR |
| AI 概念图 | 已索引并明确标记为概念图，未冒充真实照片或角色母版 |
| SHA-256 | 未对远程链接或 Library-only 文件伪造哈希；待二进制正式入库后补齐 |

## 图片数量口径

- 仓库现有项目图集引用：1。
- ChatGPT Library 中找到的用户项目/AI 概念图：5 张，其中 2 张是脚底母版/三姿态图，3 张是 AI 概念图。
- 工作区找到的城市 AI 概念图：1 张。
- 公开摄影来源：6 张，均以远程预览和原始来源页形式引用，没有复制第三方原图到 Git。
- 外部模型/电影研究链接：Newtype、HPOI、ILM 和 Unsplash 实物大机体摄影页。

## 为什么没有把所有图片二进制复制进仓库

本 PR 的 GitHub 写入通道支持文本文件和 Git 对象提交，但本轮没有可用的二进制文件上传接口。为避免用低清重绘图冒充原始母版，或把来源许可不明的模型/电影图片复制到公开仓库，本次先提交可追溯的图板、远程预览、许可与清单。

`Fenrir-Sole-RGBA.png` 和 `Fenrir-Gemini-three-poses.png` 仍在 ChatGPT Library，需在后续具备本地文件上传能力时按原始字节同步到 `assets/reference/fenrir/04_sole_ground_interaction/canonical/`，再补 SHA-256 和最终文件大小。

## 当前未解决项

详见 [unresolved_sources.md](./unresolved_sources.md)。最重要的缺口是用户原始角色全身图与脚底母版的 GitHub 二进制同步，以及 42869.png、42871.png、42872.png、42873.png 的重新定位。
