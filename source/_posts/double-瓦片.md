---
title: double 瓦片
date: 2026-11-23 21:30:41
tags:
  - tracker
  - godot
  - 瓦片地图
---
模仿b站视频绘制了水流的16tileset，再用double-tile插件实现了双网格系统，虽然还有很多不懂。
https://www.bilibili.com/video/BV1KyjN6iEzq?spm_id_from=333.788.videopod.sections&vd_source=cdf01a26d73c513408e18f10cbab38f3

听着有些眉目，但是还要整理一下
首先，我希望实现一个动态水面效果，用shader

color是输出的颜色

首先，fragment函数是对应每个单独的像素的。

视频里的深度图是什么意思？

做完了，总结一下

shader代码还有些不懂，不，应该说所有代码都是ai生成的，不过起码复现的差不多了。明天理解一下代码。