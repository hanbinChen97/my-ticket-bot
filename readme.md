# 票务自动抢票机器人项目说明

## 项目概述

这个项目是一个基于Playwright的自动化票务抢票工具，可以模拟用户在票务网站上的操作，包括点击按钮、填写表单和提交请求，从而实现自动抢票功能。

## 功能特点

- 自动访问目标票务网站
- 模拟用户点击操作
- 自动填写表单信息
- 处理页面跳转和等待
- 提供丰富的配置选项
- 包含异常处理机制

## 项目结构

```
my-ticket-bot/
├── config.js       # 配置文件，包含目标网站URL、选择器等信息
├── utils.js        # 工具函数，包含等待元素、点击元素等功能
├── main.js         # 主程序，实现抢票逻辑
└── readme.md       # 项目说明文档
```

## 工作流程

1. **配置阶段**：
   - 在`config.js`中设置目标网站和相关参数
   - 配置浏览器启动选项（如无头模式、视口大小等）
   - 设置表单数据和按钮选择器

2. **执行阶段**：
   - 启动浏览器实例
   - 访问目标票务网站
   - 按照预设流程点击按钮、导航页面
   - 填写并提交表单信息
   - 处理提交结果

3. **结束阶段**：
   - 完成抢票流程
   - 关闭浏览器
   - 输出执行结果

## 技术栈

- Node.js
- Playwright (用于浏览器自动化)

## 安装指南

1. 克隆仓库：
```bash
git clone https://github.com/yourusername/my-ticket-bot.git
cd my-ticket-bot
```

2. 安装依赖：
```bash
npm install
```

3. 安装Playwright浏览器：
```bash
npx playwright install chromium
```

## 使用方法

1. 编辑`config.js`文件，设置目标网站和相关参数：
```javascript
module.exports = {
  targetUrl: '你的目标网站URL',
  // 其他配置...
};
```

2. 运行程序：
```bash
node main.js
```

## 调试技巧

- 在`config.js`中设置`headless: false`可以看到浏览器的运行过程
- 使用`console.log()`在关键步骤输出程序状态
- 启用`devtools: true`选项可以打开开发者工具进行调试

## 注意事项

- 使用本工具时请遵守目标网站的使用条款
- 过于频繁的请求可能会导致IP被封禁
- 建议在非高峰时段测试程序
- 实际抢票时可能需要根据具体网站调整选择器和流程


## 许可证

MIT
