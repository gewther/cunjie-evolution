# Fenrir Visual Reference Library

《寸界 Cunjie Evolution》芬里尔视觉参考图库。用于角色一致性、全身开场镜头、城市背景与足底接地效果的设计、审查和后续素材制作。

> **核心锁定：** 游戏芬里尔身高为 30 m，是具有独立人格的少年型超智能 AI。用户原始设计与游戏内已验证资产优先级最高。外部模型、电影和摄影只提供观察角度，不得反向改写角色设定。

## 四类参考

| 分类 | 内容 | 入口 |
|---|---|---|
| 01. 角色母版 | 游戏内角色图集、官方模型研究链接、造型一致性规则 | [01_character_master](./01_character_master/README.md) |
| 02. 全身开场镜头 | 实物大机体尺度、低机位、人物/建筑比例、电影摄影研究 | [02_fullbody_opening_shot](./02_fullbody_opening_shot/README.md) |
| 03. 城市背景 | 日本城市夜景、住宅区、高架道路、现有视差背景 | [03_city_background](./03_city_background/README.md) |
| 04. 足底与地面交互 | 脚底母版索引、姿态锚点、液压机构、柏油/积水/泥地 | [04_sole_ground_interaction](./04_sole_ground_interaction/README.md) |

## 当前游戏资产基准

- [芬里尔动作图集 V3](../../../dist-release/game/assets/fenrir/fenrir-motion-v3.png)
- [城市远景 SVG](../../fenrir/city-far.svg) · [城市中景 SVG](../../fenrir/city-mid.svg) · [城市近景 SVG](../../fenrir/city-near.svg)
- [蓝调城市背景 WebP](../../../dist-release/game/assets/fenrir/fenrir-city-blue-hour.webp)
- [场景尺度规范 FENRIR_SCENE_SCALE_V2.md](../../../FENRIR_SCENE_SCALE_V2.md)

## 视觉方向

- 现实主义城市环境 + 超规格未来机械体 + 日本动画电影式摄影。
- 普通住宅、办公楼、路灯、电线杆、车辆、栏杆和行人承担尺度参照。
- 城市采用雨后湿路、真实窗灯、自然雾气与克制的青色机体自发光。
- 避免霓虹赛博朋克城市吞没角色、过度蓝紫色发光建筑、无意义 HUD。
- 全身镜头使用独立的开场构图。现有 400 × 240 px 游戏视口是下半身接地视口，不能通过拉伸当前场景来硬塞完整 30 m 机体。

## 资产和版权分层

1. **Canonical / 项目母版：** 游戏内现有图集和用户原始设计。严禁被外部图片覆盖。
2. **Licensed photo references：** 只嵌入来源页明确许可的公开摄影，并在清单中保留作者、许可和来源。
3. **Research links：** 官方产品页、电影制作页和未明确再分发许可的图片只保留链接。
4. **AI concept only：** AI 生成概念图只用于构图和氛围讨论，必须单独标记，不能冒充真实模型照片或角色母版。

本图库是研究资料，不是运行时资源目录。任何第三方图片进入游戏发行包之前，都必须重新核对许可、署名、改编和发行条件。

## 元数据与审查

- [图片总清单](./99_metadata/reference_manifest.csv)
- [交付与核验报告](./99_metadata/download_report.md)
- [未解决来源](./99_metadata/unresolved_sources.md)
- [芬里尔造型比对](./99_metadata/fenrir_design_comparison.md)
- [第三方图片署名与许可](./99_metadata/THIRD_PARTY_LICENSES.md)
- [在线参考板索引](./90_contact_sheets/INDEX.md)

## 本次 PR 范围

本次只增加参考图库目录、文档、来源链接和在线预览，不修改游戏逻辑、场景 SVG、角色图集、构建脚本或部署工作流。部分用户母版图仍保存在 ChatGPT Library，已在 manifest 中明确标记为尚未同步到仓库，未用占位图冒充已上传文件。
