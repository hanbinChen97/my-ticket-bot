/**
 * 票务自动抢票机器人主程序
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const utils = require('./utils');

/**
 * 主函数 - 运行抢票流程
 */
async function main() {
  utils.log('开始运行票务机器人', 'info');
  
  // 修改浏览器配置，加快速度
  const browserConfig = {
    ...config.browser,
    slowMo: 0 // 移除慢动作模拟
  };
  
  // 启动浏览器
  utils.log('启动浏览器', 'info');
  const browser = await chromium.launch({
    headless: browserConfig.headless,
    slowMo: browserConfig.slowMo,
    devtools: browserConfig.devtools,
  });
  
  const context = await browser.newContext({
    viewport: browserConfig.viewport,
  });
  
  // 创建主页面
  const page = await context.newPage();
  
  try {
    // 导航到目标网站
    utils.log(`导航到目标网站: ${config.targetUrl}`, 'info');
    await page.goto(config.targetUrl, { timeout: browserConfig.timeout });
    
    // 等待页面加载完成
    utils.log('等待页面加载完成', 'info');
    await page.waitForLoadState('domcontentloaded');
    
    utils.log('成功加载目标网站', 'info');
    
    // 获取页面标题
    const title = await page.title();
    utils.log(`页面标题: ${title}`, 'info');
    
    // 检查课程表格是否存在
    const tableExists = await page.$('table.bs_kurse') !== null;
    if (!tableExists) {
      utils.log('未找到课程表格，可能需要调整选择器', 'warn');
      await utils.saveHtml(page, 'error_not_found_table');
      // 保存完整网页大小的截图
      await utils.saveErrorFullPageScreenshot(page, 'error_not_found_table');
      return;
    }
    
    // 查找特定时间段的课程
    utils.log(`开始查找目标课程: ${config.targetCourse.day}, ${config.targetCourse.time}`, 'info');
    const targetCourse = await utils.findTargetCourse(
      page, 
      config.targetCourse.day, 
      config.targetCourse.time
    );
    
    if (!targetCourse.found) {
      utils.log('未找到目标课程，请检查时间设置或尝试其他时间段', 'error');
      await utils.saveHtml(page, 'error_target_not_found');
      // 保存完整网页大小的截图
      await utils.saveErrorFullPageScreenshot(page, 'error_target_not_found');
      return;
    }
    
    utils.log(`成功找到目标课程!`, 'info');
    utils.log(`按钮选择器: ${targetCourse.buttonSelector}`, 'info');
    utils.log(`按钮名称: ${targetCourse.buttonName}`, 'info');
    
    // 点击预订按钮，这可能会打开新窗口
    utils.log('准备点击预订按钮', 'info');
    
    // 设置事件监听器，等待新窗口打开
    const popupPromise = utils.waitForNewPage(context);
    
    // 点击预订按钮
    await utils.safeClick(page, targetCourse.buttonSelector);
    utils.log('已点击预订按钮', 'info');
    
    // 获取新打开的窗口
    let popupPage;
    try {
      popupPage = await popupPromise;
      utils.log('成功获取新窗口', 'info');
    } catch (error) {
      utils.log(`无法获取新窗口: ${error.message}`, 'error');
      await utils.saveHtml(page, 'error_no_popup');
      // 保存完整网页大小的截图
      await utils.saveErrorFullPageScreenshot(page, 'error_no_popup');
      return;
    }
    
    // 等待弹出窗口加载完成
    await popupPage.waitForLoadState('domcontentloaded');
    utils.log('弹出窗口加载完成', 'info');
    
    // 保存弹出窗口的HTML内容
    await utils.saveHtml(popupPage, 'popup_window');
    
    // 获取弹出窗口的页面标题
    const popupTitle = await popupPage.title();
    utils.log(`弹出窗口标题: ${popupTitle}`, 'info');
    
    // 分析弹出窗口内的按钮
    utils.log('分析弹出窗口内的按钮', 'info');
    const popupButtons = await utils.analyzeButtons(popupPage, config.selectors.popupButtons);
    
    // 查找确认按钮
    let confirmButton = null;
    for (const button of popupButtons) {
      if (button.name === 'buchen' || button.text.includes('Buchen') || button.text.includes('预订')) {
        confirmButton = button;
        utils.log(`找到确认预订按钮: ${button.text}`, 'info');
        break;
      }
    }
    
    if (!confirmButton) {
      utils.log('未找到确认按钮', 'warn');
      // 尝试更通用的按钮查找策略
      utils.log('尝试查找提交按钮或其他可能的确认按钮', 'info');
      for (const button of popupButtons) {
        if (button.type === 'submit' || 
            ['submit', 'ok', 'confirm', 'next', 'continue'].includes(button.name?.toLowerCase()) || 
            ['提交', '确认', '下一步', '继续', '预订'].some(text => button.text.toLowerCase().includes(text))) {
          confirmButton = button;
          utils.log(`找到可能的提交按钮: ${button.text}`, 'info');
          break;
        }
      }
    }
    
    if (!confirmButton) {
      utils.log('无法找到确认按钮，无法继续', 'error');
      await utils.saveHtml(popupPage, 'error_no_confirm_button');
      // 保存完整网页大小的截图
      await utils.saveErrorFullPageScreenshot(popupPage, 'error_no_confirm_button');
      return;
    }
    
    // 准备点击确认按钮进入下一个页面
    utils.log(`准备点击确认按钮: ${confirmButton.text || confirmButton.name}`, 'info');
    
    // 构建确认按钮的选择器
    let confirmButtonSelector;
    if (confirmButton.id) {
      confirmButtonSelector = `#${confirmButton.id}`;
    } else if (confirmButton.name) {
      confirmButtonSelector = `[name="${confirmButton.name}"]`;
    } else if (confirmButton.className) {
      confirmButtonSelector = `.${confirmButton.className.replace(/\s+/g, '.')}`;
    } else {
      // 使用索引构建选择器
      confirmButtonSelector = `${config.selectors.popupButtons}:nth-child(${confirmButton.index + 1})`;
    }
    
    utils.log('点击确认按钮并等待页面导航', 'info');
    
    // 使用waitForNavigation等待页面导航完成
    await Promise.all([
      popupPage.waitForNavigation({ waitUntil: 'networkidle' }),
      popupPage.click(confirmButtonSelector)
    ]);
    
    utils.log('导航完成，页面已加载', 'info');
    
    // 使用当前窗口作为表单页面
    const formPage = popupPage;
    
    // 获取表单页面标题
    const formPageTitle = await formPage.title();
    utils.log(`表单页面标题: ${formPageTitle}`, 'info');
    
    // 分析表单页面中的所有表单字段
    utils.log('开始分析表单页面中的字段', 'info');
    const formFields = await utils.analyzeFormFields(formPage);
    
    // 输出表单信息 - 简化日志输出，加快处理速度
    utils.log('已完成表单分析', 'info');
    
    // 准备填写表单
    utils.log('准备填写表单', 'info');
    
    // 使用utils.fillRegistrationForm函数填写表单
    const formFilled = await utils.fillRegistrationForm(formPage, config.userInfo);
    
    if (!formFilled) {
      utils.log('表单填写失败，无法继续', 'error');
      await utils.saveHtml(formPage, 'error_form_fill');
      // 保存完整网页大小的截图，这是重点需求
      await utils.saveErrorFullPageScreenshot(formPage, 'error_form_fill');
      return;
    }
    
    utils.log('表单已成功填写，准备提交', 'info');
    
    // 提交表单
    const submitResult = await utils.submitForm(formPage);
    
    if (!submitResult) {
      utils.log('表单提交可能有问题，但仍继续尝试处理最终确认页面', 'warn');
      // 在表单提交错误时保存完整网页截图
      await utils.saveErrorFullPageScreenshot(formPage, 'error_form_submit');
    }
    
    // 添加最终确认步骤：处理确认页面，点击最终确认按钮
    utils.log('开始处理最终确认页面...', 'info');
    const confirmResult = await utils.handleFinalConfirmation(formPage);
    
    if (confirmResult) {
      utils.log('🎉🎉🎉 恭喜！整个预订流程已成功完成', 'info');
    } else {
      utils.log('预订流程遇到问题，可能未成功完成', 'warn');
      // 在最终确认页面出现问题时保存完整网页截图
      await utils.saveErrorFullPageScreenshot(formPage, 'error_final_confirmation');
    }
    
  } catch (error) {
    utils.log(`发生错误: ${error.message}`, 'error');
    await utils.saveHtml(page, 'error_page');
    // 在发生任何意外错误时保存完整网页截图
    await utils.saveErrorFullPageScreenshot(page, 'error_unexpected');
  } finally {
    // 关闭浏览器
    utils.log('关闭浏览器', 'info');
    await browser.close();
  }
}

// 运行主函数
main().catch(error => {
  utils.log(`程序运行失败: ${error.message}`, 'error');
  process.exit(1);
});