# Zhen-Hai HUD Manager

> 前身为 **Void HUD Manager**，现已全面重构并正式更名为 **Zhen-Hai HUD Manager**。

“镇海（ZhenHai）”一名源自中国浙江海宁的占鳌塔。

---

## 简介

Zhen-Hai HUD Manager 是一款面向 CS 赛事直播场景的 HUD 管理工具，用于管理比赛、队伍、玩家以及 Overlay 显示内容。本次重构对原有项目架构、界面交互和使用流程进行了全面优化，使其更加清晰、稳定且易于上手。

相较于旧版 Void HUD Manager，Zhen-Hai HUD Manager 在架构设计、功能体验和操作流程上均有较大改进。

---

## 主要特性

### 赛事管理

支持创建和切换多个赛事，无需重复填写大量表单，提升赛事配置效率。

### 更完善的表单体验

对比赛、队伍、玩家相关表单进行了重新设计，使字段结构更清晰，操作逻辑更直观。

### 自动放置 GSI 文件

可自动识别游戏路径，并自动放置 GSI 配置文件，减少手动操作。

### 自动更新

内置自动更新能力，并在原有基础上进一步优化更新体验。

### UI 自定义

支持自定义 Overlay 界面的颜色、圆角、安全区域以及显示组件，方便用户根据直播画面进行个性化配置。

---

## 技术架构

本次重构后，项目由原来的双仓库结构：

- `Void-HUD-Manager`
- `Void-HUD-Overlay`

升级为单仓库管理：

- `ZhenHai-HUD-Manager`

项目采用 **Turborepo** 进行多包管理。

### Electron 前端

使用以下技术构建：

- Vue 3
- Pinia
- Nuxt UI
- TailwindCSS
- Vue Router

### Electron 后端

使用以下技术构建：

- Electron
- Express
- LowDB
- [osztenkurden/csgogsi](https://github.com/osztenkurden/csgogsi)

### Overlay 层

使用以下技术构建：

- Vue 3
- Pinia
- TailwindCSS

---

## 快速开始

### 1. 下载并安装

下载并安装 Zhen-Hai HUD Manager。

### 2. 运行应用

启动应用后，跟随内置的 **Setup Wizard** 完成初始化配置。

### 3. 配置赛事数据

依次添加以下内容：

- 玩家
- 队伍
- 比赛

完成后，将对应比赛设置为 **Live** 状态。

### 4. 进入游戏

启动游戏并确保 GSI 配置生效。

### 5. 开启 Overlay

在应用中点击 **Overlay** 按钮。

### 6. 添加直播源

在 OBS 或 vMix 中添加浏览器源，推荐配置如下：

- 宽度：`1920`
- 高度：`1080`
- 源地址：参考应用中 **Commands & Links** 里的 **Overlay** 卡片
- *通常默认为 `http://127.0.0.1:1469/overlay/`

完成上述步骤后，即可在直播画面中使用 Zhen-Hai HUD Manager。

---

## 项目改进概览

相比旧版本，Zhen-Hai HUD Manager 主要带来以下变化：

- 从双 GitHub 仓库迁移至单一 Turborepo 仓库
- 重构项目结构，提升代码可维护性
- 优化赛事、队伍、玩家和比赛管理流程
- 支持自动识别游戏路径并放置 GSI 文件
- 改进自动更新机制
- 提供更灵活的 Overlay UI 自定义能力

---

## 致谢

感谢以下项目与社区的支持：

- [cshuds.com](https://cshuds.com)
- [JTsHM / OpenHUD](https://github.com/JohnTimmermann/OpenHud)
- [drweissbrot / cs-hud](https://github.com/drweissbrot/cs-hud)
- 以及所有为该项目提供帮助和支持的人们