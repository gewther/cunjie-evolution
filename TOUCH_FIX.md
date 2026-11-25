# 手动触屏修复 v1

仅手动触摸：纵向增益降低、目标位移限速、防快速滑动排队、独立竖直速度/加速度上限、半空停稳与接地后连续施压。AI/键盘保持原分支；碰撞、伤害公式、素材、场景和存档结构未修改。接触力度沿用实际碰撞速度；额外声音/命中强度仅在手动触摸分支按该速度缩放。

当前入口 `/` 与 `/impact.html`；修复前回退 `/rollback.html` 与 `/impact-rollback.html`。独立预览 `/touch-baseline-preview.html` 与 `/touch-preview.html`。

检查：8项控制器测试；经典/AJ6候选各9项TouchEvent与20ms引擎更新回放。浏览器回放不等于Android实机。测试调度仅存在于touch-check.html内存注入，不进入正式引擎。

冻结修复：主循环改用显式的 window 只读桥接判断触控所有权，避免首次触摸后因跨作用域调用报错而终止 iframe 动画。完整宿主页检查确认触摸后宿主时钟、引擎时钟与 NPC 世界继续推进，且无运行时错误。

构建 `python3 tools/build_touch.py`；控制器检查 `node tools/test_touch.cjs`。
