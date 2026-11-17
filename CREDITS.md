# 致谢与来源声明 / Credits & Attribution

## 原创作者

本项目的**全部原创设计与实现**属于：

- **麦当（mdldm）** — GitHub [@CzzzzzzJ](https://github.com/CzzzzzzJ)

原作仓库：

| 仓库 | 说明 | 许可证 |
|---|---|---|
| [CzzzzzzJ/mdldm-maitian](https://github.com/CzzzzzzJ/mdldm-maitian) | 麦田：自媒体多平台发布中控与数据监控 | MIT |
| [CzzzzzzJ/mdldm-maitian-publisher](https://github.com/CzzzzzzJ/mdldm-maitian-publisher) | 麦田发布助手：Chrome 插件，各平台适配器 | Apache-2.0 |

作者把它自用的整套工作台完整开源——包括分发计划、调度防重、同龄对比复盘、转化漏斗、飞书卡片通知，以及各平台适配器的风控取舍。本仓库只是在此之上做了 Windows 平台适配。

**如果你觉得这个项目有价值，请去原作仓库点 Star、提 Issue、给作者反馈。** 那才是对原创者最直接的支持。

## 本分支的改动范围

仅平台适配，不含产品功能改动。完整清单见 [README.md](README.md#本分支做了什么)。

新增文件：`src/win.mjs`（平台适配层）。
修改文件：`src/chrome-shim.mjs`、`src/hub.mjs`、`src/tunnel.mjs`、`src/web.mjs`、`src/init.mjs`、`src/bridge.mjs`、`src/driver.mjs`、`publisher/video.js`。

## 许可证

- 主仓（本仓库根目录）：MIT，见 [LICENSE](LICENSE)。原始版权归 麦当 mdldm 所有；Windows 适配部分版权归 5616760，同样以 MIT 发布。
- 发布助手（`publisher/`）：Apache-2.0，见 [publisher/LICENSE](publisher/LICENSE)，保持原样未改。

两处许可证均要求保留原始版权声明，本仓库已完整保留。

## 商标与平台声明

「麦田」「mdldm」为原作者使用的名称，本分支沿用仅为说明来源，不代表原作者对本分支背书。
B站、抖音、小红书、视频号、YouTube、X、Instagram 等名称与商标归各自所有者。
