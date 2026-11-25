# 寸界 · 完整工程交接

导出日期：2026-11-13。当前实验站点版本 9，对应提交 26618e52abdda3434796f492eadf7c81cf1a955b。这是当前工作版本，不是从零开发模板。

## 启动

在工程根目录执行 `python3 -m http.server 8000 --directory dist`，浏览器打开 `http://localhost:8000/impact.html`。需要通过 HTTP 服务运行，不建议直接双击 HTML，因为游戏使用嵌套文档和资源请求。

主入口 dist/impact.html。dist/index.html 是历史原样迁移入口，不代表最新功能；dist/impact-rollback.html 是更早回退入口。dist/contact-before.html、dist/residue-before.html 是局部实验对照。baseline 内是原迁移基线。

## 文件关系

- dist/data/touch-v1-impact.js：当前剧情/练习用的实际内嵌引擎（JSON 字符串包裹 HTML/JS）。
- dist/data/touch-v1-free.js：独立自由模式引擎，未同步全部实验改动。
- dist/scripts/touch-v1-impact-host-1.js、host-2.js、impact-host-3.js：主入口使用的宿主逻辑。
- dist/data/04-images.js、05-audio.js：含已有内嵌图像与音效；其他 data 文件含对白、NPC 与过场数据。
- dist/assets：新增鞋图、材质、卧室背景。
- src：实验源码；tools：生成脚本与测试；其余 MD/JSON：历史说明与记录。

## 当前功能和问题

保留 AJ5、AJ6 与乔丹鞋；首幕新增午后暖光/雨夜背景选择；绝对触屏位置控制、踩压声音、鞋底独立残留、拖擦痕迹、12 秒非露骨倒地轮廓、普通 NPC 位移约 .76 倍、原拉丝绘制适配。

用户主要关注：跟手性、踩中后拉丝断裂、鞋底血迹贴合与强度、后脚跟压实、地面材质和小人速度。用户希望减少非必要验收，把主观实机体验交给他本人；应做最小必要检查，不得声称已通过未做的安卓测试。

当前拉丝改动有语法与针对逻辑验证，但尚无安卓视觉验收。背景已在浏览器中观察；其他历史 QA 文件描述各自版本，不应整体视为当前版本全部通过。

## 构建注意

这些历史工具并非统一打包器。不要直接运行 tools/build_impact.py 或 build_touch.py 覆盖现行宿主和入口，它们可能退回旧实验状态。

需要重建当前实验内嵌引擎时，按下列顺序执行并核对差异：

1. `node tools/build_contact.cjs`
2. `node tools/build_experience.cjs`
3. `node tools/build_residue.cjs`
4. `node tools/build_direct.cjs`
5. `node tools/build_strands.cjs`

检查示例：`node tools/test_direct.cjs`。旧 test_touch.cjs 验证的是保留的相对控制器分支，旧 touch-check.html 部分断言已不适用于当前绝对定位，不能据此宣布新手动控制通过。

## 修改要求

优先在现有游戏上局部修改，保留语料、原始素材和对照入口。交回修改后的完整工程或明确补丁，并说明改变的文件。不要只做一款外观相近的新游戏。

本导出不含 Git 凭证、访问令牌、正式站点绑定或部署权限。私密权限由托管平台控制，不属于这个静态文件包；本地存档也不包含在源码中。
