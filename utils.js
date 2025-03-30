/**
 * 票务机器人工具函数
 */

const config = require('./config');
const fs = require('fs');
const path = require('path');

/**
 * 简单日志记录函数
 * @param {string} message - 日志消息
 * @param {string} level - 日志级别 (debug, info, warn, error)
 */
function log(message, level = 'info') {
  if (!config.logging.enabled) return;
  
  const levels = ['debug', 'info', 'warn', 'error'];
  const configLevelIndex = levels.indexOf(config.logging.level);
  const currentLevelIndex = levels.indexOf(level);
  
  if (currentLevelIndex >= configLevelIndex) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`);
  }
}

/**
 * 等待元素出现在页面中
 * @param {Object} page - Playwright页面对象
 * @param {string} selector - 要等待的元素选择器
 * @param {number} timeout - 超时时间（毫秒）
 * @returns {Promise<ElementHandle>} 元素句柄
 */
async function waitForElement(page, selector, timeout = config.browser.timeout) {
  try {
    log(`等待元素出现: ${selector}`, 'debug');
    // 使用state: 'attached'而不是默认的'visible'可以提高速度
    return await page.waitForSelector(selector, { 
      timeout,
      state: 'attached' // 只要元素存在于DOM中就继续，不必等待可见
    });
  } catch (error) {
    log(`等待元素超时: ${selector}`, 'error');
    throw new Error(`等待元素超时: ${selector}`);
  }
}

/**
 * 点击元素并等待导航完成
 * @param {Object} page - Playwright页面对象
 * @param {string} selector - 要点击的元素选择器
 * @returns {Promise<void>}
 */
async function clickAndWaitForNavigation(page, selector) {
  try {
    log(`点击元素并等待导航: ${selector}`, 'debug');
    const element = await waitForElement(page, selector);
    
    // 同时处理点击和等待导航
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle' }),
      element.click()
    ]);
    
    log(`导航完成`, 'debug');
  } catch (error) {
    log(`点击导航失败: ${selector}, 错误: ${error.message}`, 'error');
    throw new Error(`点击导航失败: ${selector}`);
  }
}

/**
 * 安全点击元素（重试几次）
 * @param {Object} page - Playwright页面对象
 * @param {string} selector - 要点击的元素选择器
 * @param {number} retries - 最大重试次数
 * @returns {Promise<boolean>} 是否成功点击
 */
async function safeClick(page, selector, retries = 3) {
  let attempt = 0;
  
  while (attempt < retries) {
    try {
      log(`尝试点击元素 (尝试 ${attempt + 1}/${retries}): ${selector}`, 'debug');
      const element = await waitForElement(page, selector);
      await element.click();
      log(`成功点击元素: ${selector}`, 'debug');
      return true;
    } catch (error) {
      attempt++;
      if (attempt >= retries) {
        log(`点击元素失败，已达到最大重试次数: ${selector}`, 'error');
        return false;
      }
      
      // 在重试前等待一段时间
      log(`点击失败，将在1秒后重试: ${selector}`, 'warn');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return false;
}

/**
 * 填写表单字段
 * @param {Object} page - Playwright页面对象
 * @param {string} selector - 输入字段选择器
 * @param {string} value - 要输入的值
 * @returns {Promise<void>}
 */
async function fillFormField(page, selector, value) {
  try {
    log(`填写表单字段: ${selector}`, 'debug');
    const element = await waitForElement(page, selector);
    await element.fill(value);
    log(`表单字段填写完成: ${selector}`, 'debug');
  } catch (error) {
    log(`填写表单字段失败: ${selector}, 错误: ${error.message}`, 'error');
    throw new Error(`填写表单字段失败: ${selector}`);
  }
}

/**
 * 获取页面元素文本
 * @param {Object} page - Playwright页面对象
 * @param {string} selector - 元素选择器
 * @returns {Promise<string>} 元素文本内容
 */
async function getElementText(page, selector) {
  try {
    log(`获取元素文本: ${selector}`, 'debug');
    const element = await waitForElement(page, selector);
    const text = await element.textContent();
    log(`获取到元素文本: ${text.substring(0, 30)}${text.length > 30 ? '...' : ''}`, 'debug');
    return text.trim();
  } catch (error) {
    log(`获取元素文本失败: ${selector}, 错误: ${error.message}`, 'error');
    return '';
  }
}

/**
 * 保存页面HTML内容到文件
 * @param {Object} page - Playwright页面对象 
 * @param {string} filename - 保存文件名称
 * @returns {Promise<string>} 保存的文件路径
 */
async function saveHtml(page, filename) {
  try {
    // 确保目录存在
    if (!fs.existsSync(config.saveHtml.path)) {
      fs.mkdirSync(config.saveHtml.path, { recursive: true });
    }
    
    const htmlContent = await page.content();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filePath = path.join(config.saveHtml.path, `${filename}_${timestamp}.html`);
    
    fs.writeFileSync(filePath, htmlContent);
    log(`HTML内容已保存至: ${filePath}`, 'info');
    return filePath;
  } catch (error) {
    log(`保存HTML内容失败: ${error.message}`, 'error');
    return null;
  }
}

/**
 * 截取页面截图并保存
 * @param {Object} page - Playwright页面对象
 * @param {string} path - 截图保存路径
 * @returns {Promise<void>}
 */
async function takeScreenshot(page, path) {
  try {
    log(`正在截取页面截图: ${path}`, 'debug');
    await page.screenshot({ path });
    log(`截图已保存至: ${path}`, 'info');
  } catch (error) {
    log(`截图失败: ${error.message}`, 'error');
  }
}

/**
 * 截取完整网页大小的截图并保存
 * @param {Object} page - Playwright页面对象
 * @param {string} path - 截图保存路径
 * @returns {Promise<void>}
 */
async function takeFullPageScreenshot(page, path) {
  try {
    log(`正在截取完整网页截图: ${path}`, 'debug');
    await page.screenshot({ 
      path,
      fullPage: true // 设置为true，捕获完整网页而不仅是视窗
    });
    log(`完整网页截图已保存至: ${path}`, 'info');
  } catch (error) {
    log(`完整网页截图失败: ${error.message}`, 'error');
  }
}

/**
 * 保存错误页面截图（完整网页大小）
 * @param {Object} page - Playwright页面对象
 * @param {string} errorName - 错误名称
 * @returns {Promise<string>} - 保存的截图路径
 */
async function saveErrorFullPageScreenshot(page, errorName) {
  try {
    // 创建保存截图的目录
    const screenshotDir = path.join(__dirname, 'screenshots');
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }
    
    // 生成带时间戳的文件名
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const screenshotPath = path.join(screenshotDir, `${errorName}_${timestamp}.png`);
    
    // 保存错误截图（完整网页大小）
    log(`保存完整网页错误截图: ${screenshotPath}`, 'info');
    await takeFullPageScreenshot(page, screenshotPath);
    
    return screenshotPath;
  } catch (error) {
    log(`保存完整网页错误截图失败: ${error.message}`, 'error');
    return null;
  }
}

/**
 * 等待新窗口打开并获取窗口对象
 * @param {Object} context - Playwright浏览器上下文对象
 * @returns {Promise<Object>} 新打开的页面对象
 */
async function waitForNewPage(context) {
  try {
    log('等待新窗口打开', 'debug');
    
    // 获取当前已打开的所有页面
    const beforePages = context.pages();
    const beforeCount = beforePages.length;
    
    // 等待新页面事件
    const newPagePromise = new Promise(resolve => {
      context.once('page', async page => {
        log('检测到新窗口打开', 'info');
        // 使用domcontentloaded而不是networkidle
        await page.waitForLoadState('domcontentloaded');
        resolve(page);
      });
    });
    
    // 设置更短的超时时间
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('等待新窗口超时')), 
        Math.min(config.browser.timeout, 10000)); // 最多等待10秒
    });
    
    // 等待新窗口或超时
    return await Promise.race([newPagePromise, timeoutPromise]);
  } catch (error) {
    log(`等待新窗口失败: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * 查找特定时间段的课程
 * @param {Object} page - Playwright页面对象
 * @param {string} targetDay - 目标日期 (例如: "Mo")
 * @param {string} targetTime - 目标时间段 (例如: "10:30-11:55")
 * @returns {Promise<{found: boolean, element: ElementHandle|null, buttonSelector: string|null, buttonName: string|null}>}
 */
async function findTargetCourse(page, targetDay, targetTime) {
  try {
    log(`正在查找目标课程: ${targetDay}, ${targetTime}`, 'info');
    
    // 查找表格行
    const rows = await page.$$('table.bs_kurse tbody tr');
    log(`找到 ${rows.length} 个课程行`, 'debug');
    
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      
      // 获取日期信息
      const dayCell = await row.$('.bs_stag');
      if (!dayCell) continue;
      const dayText = await dayCell.textContent();
      const day = dayText.trim();
      
      // 获取时间信息
      const timeCell = await row.$('.bs_szeit');
      if (!timeCell) continue;
      const timeText = await timeCell.textContent();
      const time = timeText.trim();
      
      log(`检查课程行 ${i+1}, 日期: ${day}, 时间: ${time}`, 'debug');
      
      // 检查日期和时间是否匹配
      if (day === targetDay && time === targetTime) {
        log(`找到匹配的课程!`, 'info');
        
        // 查找预订按钮单元格
        const bookCell = await row.$('.bs_sbuch');
        if (!bookCell) continue;
        
        // 查找预订按钮
        const bookButton = await bookCell.$('.bs_btn_buchen');
        if (bookButton) {
          // 获取按钮的name属性
          const buttonName = await bookButton.getAttribute('name');
          
          // 获取行ID，用于构建更精确的选择器
          const rowId = await row.getAttribute('id');
          const buttonSelector = rowId 
            ? `#${rowId} .bs_sbuch .bs_btn_buchen` 
            : `table.bs_kurse tbody tr:nth-child(${i+1}) .bs_sbuch .bs_btn_buchen`;
          
          log(`找到预订按钮，选择器: ${buttonSelector}`, 'info');
          
          return {
            found: true,
            element: row,
            buttonSelector,
            buttonName
          };
        } else {
          // 可能是等待列表按钮或自动启动信息
          const waitlistButton = await bookCell.$('.bs_btn_warteliste');
          const autoStartSpan = await bookCell.$('.bs_btn_autostart');
          
          let buttonType = 'unknown';
          if (waitlistButton) buttonType = 'waitlist';
          if (autoStartSpan) buttonType = 'autostart';
          
          log(`找到匹配课程，但没有预订按钮，而是: ${buttonType}`, 'warn');
        }
      }
    }
    
    log(`未找到匹配的目标课程`, 'warn');
    return { found: false, element: null, buttonSelector: null, buttonName: null };
  } catch (error) {
    log(`查找目标课程失败: ${error.message}`, 'error');
    return { found: false, element: null, buttonSelector: null, buttonName: null };
  }
}

/**
 * 分析页面所有按钮并记录
 * @param {Object} page - Playwright页面对象
 * @param {string} selector - 按钮选择器
 * @returns {Promise<Array>} 按钮信息数组
 */
async function analyzeButtons(page, selector) {
  try {
    log(`分析页面按钮: ${selector}`, 'debug');
    const buttons = await page.$$(selector);
    
    const buttonsInfo = [];
    for (let i = 0; i < buttons.length; i++) {
      const button = buttons[i];
      
      // 获取按钮文本
      const text = await button.textContent().catch(() => '');
      
      // 获取按钮类型和名称属性
      const type = await button.getAttribute('type').catch(() => '');
      const name = await button.getAttribute('name').catch(() => '');
      const id = await button.getAttribute('id').catch(() => '');
      const className = await button.getAttribute('class').catch(() => '');
      
      buttonsInfo.push({
        index: i,
        text: text ? text.trim() : '',
        type,
        name,
        id,
        className
      });
      
      log(`按钮 ${i+1}: ${text ? text.trim() : '(无文本)'}, 类型: ${type || '(无类型)'}, 名称: ${name || '(无名称)'}`, 'debug');
    }
    
    log(`共找到 ${buttonsInfo.length} 个按钮`, 'info');
    return buttonsInfo;
  } catch (error) {
    log(`分析按钮失败: ${error.message}`, 'error');
    return [];
  }
}

/**
 * 分析页面中的表单字段
 * @param {Object} page - Playwright页面对象
 * @returns {Promise<Array>} 表单字段信息数组
 */
async function analyzeFormFields(page) {
  try {
    log('分析页面表单字段', 'info');
    
    // 使用页面评估执行脚本获取表单字段信息
    const formFields = await page.evaluate(() => {
      // 获取所有表单
      const forms = Array.from(document.querySelectorAll('form'));
      
      // 收集所有表单的字段信息
      const allFields = [];
      
      forms.forEach((form, formIndex) => {
        // 收集表单基本信息
        const formInfo = {
          formIndex,
          formId: form.id || `匿名表单_${formIndex}`,
          formAction: form.action || '无',
          formMethod: form.method || 'get',
          fields: []
        };
        
        // 收集所有输入字段
        const inputElements = form.querySelectorAll('input, select, textarea');
        
        Array.from(inputElements).forEach((input, inputIndex) => {
          // 获取字段标签
          let label = '';
          
          // 尝试通过for属性查找标签
          if (input.id) {
            const labelElement = document.querySelector(`label[for="${input.id}"]`);
            if (labelElement) {
              label = labelElement.textContent.trim();
            }
          }
          
          // 如果没有找到标签，尝试查找最近的标签或上一个同级元素
          if (!label) {
            // 查找父元素下的标签
            const parentLabel = input.closest('div,p,li')?.querySelector('label');
            if (parentLabel && !parentLabel.getAttribute('for')) {
              label = parentLabel.textContent.trim();
            }
            
            // 尝试获取上一个同级元素作为标签
            if (!label && input.previousElementSibling) {
              const prev = input.previousElementSibling;
              if (prev.tagName === 'LABEL' || prev.tagName === 'SPAN' || prev.tagName === 'DIV') {
                label = prev.textContent.trim();
              }
            }
          }
          
          // 尝试从placeholder获取标签
          if (!label && input.placeholder) {
            label = input.placeholder;
          }
          
          // 获取字段名称
          const name = input.name || '';
          const type = input.type || input.tagName.toLowerCase();
          const value = input.value || '';
          const required = input.required || false;
          const disabled = input.disabled || false;
          const readOnly = input.readOnly || false;
          
          // 收集选择框选项
          let options = [];
          if (input.tagName === 'SELECT') {
            options = Array.from(input.options).map(option => ({
              value: option.value,
              text: option.text,
              selected: option.selected
            }));
          }
          
          // 收集字段信息
          formInfo.fields.push({
            index: inputIndex,
            name,
            type,
            label,
            value,
            id: input.id || '',
            className: input.className || '',
            required,
            disabled,
            readOnly,
            placeholder: input.placeholder || '',
            options: options.length > 0 ? options : undefined
          });
        });
        
        // 添加到所有字段集合
        allFields.push(formInfo);
      });
      
      return allFields;
    });
    
    // 记录找到的表单字段数量
    let totalFields = 0;
    formFields.forEach(form => {
      totalFields += form.fields.length;
      log(`表单 ${form.formId} 包含 ${form.fields.length} 个字段`, 'info');
    });
    
    log(`共找到 ${formFields.length} 个表单, 总计 ${totalFields} 个字段`, 'info');
    return formFields;
  } catch (error) {
    log(`分析表单字段失败: ${error.message}`, 'error');
    return [];
  }
}

/**
 * 随机延迟一段时间，模拟人类行为
 * @param {number} min - 最小延迟时间（毫秒）
 * @param {number} max - 最大延迟时间（毫秒）
 * @returns {Promise<void>}
 */
async function randomDelay(min = 300, max = 800) {
  // 减少随机延迟的时间范围
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  log(`随机延迟 ${delay}ms`, 'debug');
  return new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * 填写注册表单
 * @param {Object} page - Playwright页面对象
 * @param {Object} userInfo - 用户信息对象
 * @returns {Promise<boolean>} - 填写表单是否成功
 */
async function fillRegistrationForm(page, userInfo) {
  try {
    log('开始填写注册表单', 'info');
    
    // 1. 选择性别
    if (userInfo.gender === 'männlich') {
      // 选择男性选项 (männlich)
      await page.click('input[name="sex"][value="M"]');
      log('已选择性别: 男', 'info');
    } else if (userInfo.gender === 'weiblich') {
      // 选择女性选项 (weiblich)
      await page.click('input[name="sex"][value="W"]');
      log('已选择性别: 女', 'info');
    }
    
    // 2. 填写姓名
    await fillFormField(page, '#BS_F1100', userInfo.firstName);
    log(`已填写名字: ${userInfo.firstName}`, 'info');
    
    await fillFormField(page, '#BS_F1200', userInfo.lastName);
    log(`已填写姓氏: ${userInfo.lastName}`, 'info');
    
    // 3. 填写地址
    await fillFormField(page, '#BS_F1300', userInfo.address);
    log(`已填写地址: ${userInfo.address}`, 'info');
    
    // 4. 填写邮编和城市
    await fillFormField(page, '#BS_F1400', userInfo.zipCity);
    log(`已填写邮编和城市: ${userInfo.zipCity}`, 'info');
    
    // 5. 选择身份状态
    await page.selectOption('#BS_F1600', userInfo.status);
    log(`已选择身份状态: ${userInfo.status}`, 'info');
    
    // 改进：处理动态显示的学号字段
    if (userInfo.status === 'S-RWTH') {
      log('正在等待学号字段显示...', 'info');
      
      // 可能的学号字段选择器
      const matricNrSelectors = ['#BS_F1610', '#BS_F4101', '[name="matric_nr"]', 'input[placeholder*="Matrikelnummer"]', 'input[name*="matric"]'];
      
      // 等待DOM变化完成（最多等待3秒）
      await page.waitForTimeout(500);  // 先等待初始DOM更新
      
      // 尝试查找学号字段 - 使用轮询方式，最多尝试5次，每次间隔500ms
      let matricFieldFound = false;
      let attempts = 0;
      const maxAttempts = 5;
      
      while (!matricFieldFound && attempts < maxAttempts) {
        log(`尝试查找学号字段 (尝试 ${attempts + 1}/${maxAttempts})`, 'debug');
        
        // 检查页面是否有任何网络活动
        if (attempts > 0) {
          await page.waitForLoadState('networkidle', { timeout: 1000 }).catch(() => {});
        }
        
        // 遍历所有可能的选择器
        for (const selector of matricNrSelectors) {
          const isVisible = await page.isVisible(selector).catch(() => false);
          
          if (isVisible) {
            log(`找到学号字段: ${selector}`, 'info');
            await fillFormField(page, selector, userInfo.studentId);
            log(`已填写学号: ${userInfo.studentId}`, 'info');
            matricFieldFound = true;
            break;
          }
        }
        
        if (!matricFieldFound) {
          attempts++;
          if (attempts < maxAttempts) {
            log(`未找到学号字段，等待500ms后重试...`, 'debug');
            await page.waitForTimeout(500);  // 等待500ms后重试
          }
        }
      }
      
      if (!matricFieldFound) {
        // 如果还是没找到，尝试查找任何新出现的输入字段
        log('尝试查找任何新出现的输入字段...', 'warn');
        
        // 获取所有可见的输入字段
        const visibleInputs = await page.$$('input:visible');
        
        for (const input of visibleInputs) {
          const inputType = await input.getAttribute('type');
          const inputName = await input.getAttribute('name') || '';
          const inputId = await input.getAttribute('id') || '';
          
          // 如果是文本输入框且不是我们已经填写过的字段
          if (inputType === 'text' && 
              !['BS_F1100', 'BS_F1200', 'BS_F1300', 'BS_F1400', 'BS_F2000', 'BS_F2100'].includes(inputId)) {
            
            log(`可能的学号字段: id=${inputId}, name=${inputName}`, 'info');
            
            // 尝试填写
            const selector = inputId ? `#${inputId}` : `[name="${inputName}"]`;
            await fillFormField(page, selector, userInfo.studentId);
            log(`已尝试填写学号到字段: ${selector}`, 'info');
            matricFieldFound = true;
            break;
          }
        }
      }
      
      if (!matricFieldFound) {
        log('警告: 未能找到学号字段，请检查表单是否正确填写', 'warn');
      }
    }
    
    // 6. 填写邮箱
    await fillFormField(page, '#BS_F2000', userInfo.email);
    log(`已填写邮箱: ${userInfo.email}`, 'info');
    
    // 7. 填写电话
    await fillFormField(page, '#BS_F2100', userInfo.phone);
    log(`已填写电话: ${userInfo.phone}`, 'info');
    
    // 8. 勾选接受条款
    if (userInfo.acceptTerms) {
      await page.check('input[name="tnbed"]');
      log('已接受条款和条件', 'info');
    }
    
    log('表单填写完成', 'info');
    return true;
  } catch (error) {
    log(`填写表单失败: ${error.message}`, 'error');
    return false;
  }
}

/**
 * 提交表单并处理结果
 * @param {Object} page - Playwright页面对象 
 * @returns {Promise<boolean>} - 提交是否成功
 */
async function submitForm(page) {
  try {
    log('准备提交表单', 'info');
    
    // 保存提交前的表单状态
    await saveHtml(page, 'before_submit');
    
    // 等待提交按钮变为可点击状态
    log('等待提交按钮变为可点击状态...', 'info');
    
    // 定义提交按钮选择器
    const submitButtonSelector = '#bs_submit';
    
    // 等待按钮出现在DOM中
    await page.waitForSelector(submitButtonSelector, { timeout: 10000 })
      .catch(err => {
        log(`等待提交按钮出现超时: ${err.message}`, 'warn');
      });
    
    // 轮询等待按钮变为可点击状态，最多等待10秒
    let buttonReady = false;
    let attempts = 0;
    const maxAttempts = 20; // 20次尝试，每次间隔500毫秒
    
    while (!buttonReady && attempts < maxAttempts) {
      // 检查按钮是否已启用并可见
      buttonReady = await page.evaluate(selector => {
        const button = document.querySelector(selector);
        if (!button) return false;
        
        // 检查按钮是否可见并已启用
        const styles = window.getComputedStyle(button);
        const isVisible = styles.display !== 'none' && 
                         styles.visibility !== 'hidden' && 
                         styles.opacity !== '0';
        const isEnabled = !button.disabled;
        
        return isVisible && isEnabled;
      }, submitButtonSelector);
      
      if (buttonReady) {
        log('提交按钮已准备就绪', 'info');
        break;
      }
      
      // 如果按钮还未准备好，等待并重试
      attempts++;
      log(`等待提交按钮可交互，尝试 ${attempts}/${maxAttempts}...`, 'debug');
      await page.waitForTimeout(500);
    }
    
    if (!buttonReady) {
      log('警告：提交按钮可能仍未准备就绪，但将尝试点击', 'warn');
    }
    
    // 点击提交按钮
    await page.click(submitButtonSelector);
    log('已点击提交按钮', 'info');
    
    // 等待页面加载完成或导航
    await Promise.race([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 }),
      page.waitForTimeout(3000)
    ]).catch(() => {
      log('等待页面导航完成后超时，但继续执行', 'warn');
    });
    
    log('提交后页面加载完成', 'info');
    
    // 保存提交后的页面状态
    await saveHtml(page, 'after_submit');
    
    // 检查是否提交成功
    const successText = await page.textContent('body');
    const isSuccess = successText.includes('erfolgreich') || 
                      successText.includes('successful') || 
                      successText.includes('Anmeldung');
    
    if (isSuccess) {
      log('表单提交成功！', 'info');
    } else {
      log('表单可能未成功提交，请检查页面响应', 'warn');
    }
    
    return isSuccess;
  } catch (error) {
    log(`提交表单失败: ${error.message}`, 'error');
    return false;
  }
}

/**
 * 处理最终确认页面
 * @param {Object} page - Playwright页面对象
 * @returns {Promise<boolean>} - 确认是否成功
 */
async function handleFinalConfirmation(page) {
  try {
    log('处理最终确认页面', 'info');
    
    // 保存确认页面HTML
    await saveHtml(page, 'final_confirmation_page');
    
    // 等待页面加载完成
    await page.waitForLoadState('networkidle');
    
    // 查找最终确认按钮 - 基于HTML分析，按钮值为"verbindlich buchen"
    const finalButtonSelector = 'input[type="submit"][value="verbindlich buchen"]';
    
    // 检查按钮是否存在
    const buttonExists = await page.$(finalButtonSelector) !== null;
    
    if (!buttonExists) {
      log('未找到指定的最终确认按钮，尝试其他可能的选择器', 'warn');
      
      // 尝试其他可能的选择器
      const alternativeSelectors = [
        '.sub[type="submit"]',
        'input.sub[type="submit"]',
        'input[type="submit"]',
        'button[type="submit"]'
      ];
      
      let finalSelector = '';
      for (const selector of alternativeSelectors) {
        if (await page.$(selector) !== null) {
          finalSelector = selector;
          log(`找到替代的确认按钮选择器: ${selector}`, 'info');
          break;
        }
      }
      
      if (!finalSelector) {
        log('无法找到最终确认按钮，预订无法完成', 'error');
        return false;
      }
    } else {
      log('找到最终确认按钮', 'info');
    }
    
    // 使用找到的选择器或默认选择器
    const confirmSelector = buttonExists ? finalButtonSelector : 'input[type="submit"]';
    
    // 等待按钮可交互
    log('等待最终确认按钮变为可点击状态...', 'info');
    await page.waitForSelector(confirmSelector, { state: 'visible' });
    
    // 点击最终确认按钮
    log('点击最终确认按钮', 'info');
    
    // 使用Promise.all同时处理导航和点击
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle' }).catch(() => {}),
      page.click(confirmSelector)
    ]);
    
    // 等待页面加载完成
    await page.waitForLoadState('networkidle');
    
    // 保存最终结果页面
    await saveHtml(page, 'booking_complete');
    
    // 检查是否预订成功
    const pageContent = await page.content();
    const isSuccess = pageContent.includes('erfolgreich') || 
                     pageContent.includes('success') || 
                     pageContent.includes('bestätigt') ||
                     pageContent.includes('Buchungsbestätigung');
    
    if (isSuccess) {
      log('🎉 恭喜！预订已成功完成', 'info');
    } else {
      log('预订流程已完成，但无法确认是否成功', 'warn');
    }
    
    return true;
  } catch (error) {
    log(`处理最终确认页面时出错: ${error.message}`, 'error');
    return false;
  }
}

/**
 * 获取当前时间
 * @returns {string} 当前时间字符串，格式为 "HH:mm"
 */
function getCurrentTime() {
  const now = new Date();
  return now.toTimeString().slice(0, 5);
}

/**
 * 检查是否是抢票时间
 * @param {string} targetTime - 目标时间，格式为 "HH:mm"
 * @returns {boolean} 是否是抢票时间
 */
function isTimeToBook(targetTime) {
  const currentTime = getCurrentTime();
  return currentTime === targetTime;
}

/**
 * 处理抢票过程
 * @returns {Promise<void>}
 */
async function bookTicket() {
  try {
    log('开始抢票流程', 'info');
    await main();
    log('抢票流程完成', 'info');
  } catch (error) {
    log(`抢票过程失败: ${error.message}`, 'error');
  }
}

module.exports = {
  log,
  waitForElement,
  clickAndWaitForNavigation,
  safeClick,
  fillFormField,
  getElementText,
  saveHtml,
  waitForNewPage,
  findTargetCourse,
  analyzeButtons,
  analyzeFormFields,
  takeScreenshot,
  takeFullPageScreenshot,
  randomDelay,
  fillRegistrationForm,
  submitForm,
  handleFinalConfirmation,
  saveErrorFullPageScreenshot,
  getCurrentTime,
  isTimeToBook,
  bookTicket
};
