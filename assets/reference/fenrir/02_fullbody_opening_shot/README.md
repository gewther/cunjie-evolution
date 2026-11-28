# 02. Full-body Opening Shot References

目标是让玩家在开场镜头中一眼理解：芬里尔是一台 **30 m** 高的机体，周围的建筑、车辆和人类都处于真实尺度。全身开场镜头应使用独立摄影构图，不挤占现有下半身接地视口。

## 实物大机体与尺度摄影

![Life-size robot statue with building and crane](https://images.unsplash.com/photo-1631791440984-dfad1c779742?auto=format&fit=crop&w=1800&q=85)

- 摄影者：hidefumi ohmichi
- [Unsplash 原图页面](https://unsplash.com/photos/a-giant-statue-of-a-robot-that-is-standing-in-front-of-a-building-sj1HxVw9SHI)
- 页面标注：Unsplash License。
- 观察重点：机体全身轮廓、建筑和吊装设施、人类公共空间之间的尺度关系。

![Life-size Gundam at night](https://images.unsplash.com/photo-1733982780460-575f0760ded9?auto=format&fit=crop&w=1800&q=85)

- 摄影者：Ken Cheung
- [Unsplash 原图页面](https://unsplash.com/photos/a-giant-statue-of-a-giant-robot-in-front-of-a-building-q8XbJlaJ_4c)
- 页面标注：Unsplash License。
- 观察重点：夜间机体照明、底座、建筑体量和远近层次。

**权利提醒：** 摄影作品的 Unsplash 许可不自动清除照片中 Gundam 造型本身的第三方权利。以上只作为比例和摄影研究入口，不得直接作为芬里尔素材、贴图或发行截图。

## 电影摄影研究

- [ILM: Pacific Rim VFX](https://www.ilm.com/vfx/pacific-rim/)
  - 研究巨型机体的运动惯性、城市尺度、接地反馈和环境交互。
  - 不复制电影正片截图或宣传图。
- [Patlabor / Fami-geki 作品资料](https://fami-geki.com/patlabor/)
  - 研究机器人如何进入普通城市基础设施和日常生活空间。
  - 电影截图只保留研究链接，不进入仓库素材。

## 推荐开场镜头构图

1. **低机位建立镜头：** 摄影机贴近地面，保留路面纹理和近景参照物。
2. **完整轮廓：** 让头部、背包、双腿和双脚尽量处于同一镜头，避免只拍到膝部以下。
3. **尺度锚点：** 同框保留住宅/办公楼、路灯、电线杆、汽车和一名普通成年人。
4. **前景压迫：** 可以让一只脚或小腿进入前景，但仍须保留躯干和头部信息。
5. **自然光色：** 阴雨天冷环境光、窗户暖光和芬里尔自身青色发光形成层次。
6. **避免误导：** 不要通过把汽车、路灯缩小或把芬里尔拉长来伪造 30 m 尺度。

## 尺度换算

现有场景规范采用 16 px/m，芬里尔 30 m 对应约 480 px。当前逻辑视口为 400 × 240 px，定位为地面接触和下半身近景。完整全身镜头必须单独定义更高的构图范围或独立开场相机，不能拉伸现有 240 px 高视口。

## AI 概念图索引

此前工作中已生成以下构图草图，原图保留在项目工作区/Library，当前没有同步到本 PR：
- `雨街仰望巨型机甲.png`
- `雨夜巨型机甲与仰望者.png`
- `雨夜都市中的巨型机甲芬里尔.png`

它们属于 AI 概念图，部分结构可能偏离角色母版（例如附属结构或足部形态），只用于人物尺度、镜头角度和画面节奏参考。
