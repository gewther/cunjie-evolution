# 首幕接触残留 v3

基线：实验站点版本 4，源码 d65a80fc315f968f83b06063a165e48a49c80ebb。原私密游戏站点未改。

观察：现有 impact-atlas-v1.png 的压痕和附着图为灰色毛絮质感；部分效果绘制在独立覆盖层，覆盖鞋子与场景的顺序容易不自然。AJ6 单独的灰色覆盖层会压制原引擎的地面和附着绘制。

原引擎对照：源码中的 draw_stains 按地面位置绘制，draw_stickers 使用 get_sticker_pos 和贴脚相对坐标，draw_strands 使用原有拉伸逻辑。公开资料没有验证原版所有贴图算法，此处只描述工程内保留的实现。

调整：生成透明暗红色卡通压印素材 assets/impact/floor-residue-v3.png；只在首幕被消灭的目标触发地面压印，位置为世界坐标，最多 24 条，28 秒淡出，并绘制在原地面层、鞋子和角色之前。恢复原版鞋底附着点和拉伸逻辑，在实际附着点增加少量新材质；不改碰撞、触控、血量或存档。移除首幕灰色与点状覆盖层，保留素材和回退页。素材加载失败时回退原地面绘制，设置关闭时遵循原选项。该视觉方案覆盖剧情与练习首幕，独立自由模式未改。

验证：脚本语法检查；接触控制 9 项和触控单元 8 项通过；浏览器内真实引擎 AJ6 与乔丹鞋各 11 项手势回放通过，包含测试内模拟命中并移动鞋子后地面标记坐标不变；乔丹鞋最后一次验证包括新附着渲染代码。尚未在安卓实机验证，也没有逐帧验证每个鞋底贴图、纹理与画风或听觉主观体验。

素材生成提示：transparent background, single flattened horizontally elongated dark burgundy and brick-red ink stain, restrained wet sheen and directional smears, thin grounded silhouette, stylized 2D arcade art, no dust, text, people, or anatomy. 已打包为 512x512 透明 PNG（约 28KB）。

回退：residue-before.html 使用修改前引擎；Sites 版本历史可恢复站点版本 4。复现：node tools/build_residue.cjs；node tools/test_contact.cjs；node tools/test_touch.cjs；touch-check.html 分别点击 AJ6 与乔丹候选。

## 后续：独立鞋底残留

命中时复制原生附着点的 F1/F2 坐标，最多保存 10 个独立材质记录，重复命中加深、20 秒后消失。不再依赖目标持续附着。跟随原生 get_sticker_pos 投影；不改碰撞或人物状态。最小逻辑检查通过：目标脱落后残留存在、鞋横移 50 时残留同步横移 50、场景重置清空。内嵌脚本语法通过。没有进行新一轮视觉或安卓验收；按用户要求交由用户试玩。回退可恢复此次更新前的实验站点版本 5。
