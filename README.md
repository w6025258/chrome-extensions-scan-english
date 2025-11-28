# Chrome 选词字数统计扩展

这是一个基于 Manifest V3 标准的 Chrome 扩展程序。当你选中网页上的文本并点击右键菜单时，它会通过现代化的弹窗显示字数统计信息。

## 项目结构

*   `manifest.json` - Chrome 扩展必需的配置文件。
*   `background.js` - 在后台运行，用于处理右键菜单的点击事件。
*   `content.js` - 注入到网页中运行，负责计算统计数据并渲染 UI 界面。

## 如何安装

1.  在你的电脑上创建一个新文件夹（例如 `word-counter-extension`）。
2.  将 `manifest.json`、`background.js` 和 `content.js` 保存到该文件夹中。
3.  （可选）如果你想要工具栏图标，请在该文件夹中添加名为 `icon16.png`、`icon48.png`、`icon128.png` 的标准图标文件，否则请从 `manifest.json` 中删除 "icons" 字段。
4.  打开 Chrome 浏览器，在地址栏输入 `chrome://extensions` 并回车。
5.  在右上角开启 **开发者模式 (Developer mode)**。
6.  点击左上角的 **加载已解压的扩展程序 (Load unpacked)**。
7.  选择你刚才创建的文件夹。

## 使用方法

1.  打开任意网页。
2.  选中一段文字。
3.  在选区上点击鼠标右键。
4.  在菜单中点击 **"统计字数与字符"**。
5.  屏幕右上角将会出现一个毛玻璃风格的弹窗，显示词数、字符数等统计信息。
