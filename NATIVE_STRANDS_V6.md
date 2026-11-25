# 原版拉丝源码复用

找回 Library 文件 Stompgame_Author_Source_Local_Adapter_v5_3.html（libfile_e5b84c529da48191a4b64f8c8cc10697），其 1611–1686 行包含 add_strand / update_strands / draw_strand / draw_strands。与当前保留的原引擎相关代码核对：底端世界坐标、上端 get_sticker_pos、逐扫描行 quad 弯曲拉伸、断后纹理帧与下坠逻辑仍保留。

根因：原更新在 paw_state==2 才更新附着端，在 paw_state<=1 直接断开。绝对触屏可能跳过状态 2，导致看不到连续拉伸。首幕改成每帧读取真实附着点，以长度、横向位移和最长持续时间判断断裂。快速姿态跳变后仍保留有界断丝，使用原版贴图与断后帧渲染。最多 18 条。未生成新拉丝图片，后续幕保留原更新。

静态语法与五项针对逻辑通过：跳过中间姿态仍能短距附着、拉长断裂、断后下坠、帧结束清理、后续幕委派原方法。未声称安卓实机或视觉手感已通过。

基线 f6762e919950cc43ab27433f31f015b271b6b71a，实验站点版本 8 可回退。新生成工具 build_strands.cjs，在 build_direct.cjs 后运行。
