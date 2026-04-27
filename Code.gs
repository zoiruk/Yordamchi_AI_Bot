// ============================================
// ZOIR UK - Verification Bot Backend
// Google Apps Script (Code.gs)
// ============================================

// ⚙️ НАСТРОЙКИ
const TOKEN = "YOUR_BOT_TOKEN_HERE"; // API токен из @BotFather
const SHEET_ID = "YOUR_SHEET_ID_HERE"; // ID Google Таблицы
const GROUP_ID = -1001234567890; // ID группы (отрицательное число)
const MINI_APP_URL = "YOUR_WEB_APP_URL_HERE"; // Ссылка на веб-приложение
const COOLDOWN_DAYS = 30; // Кулдаун после неудачной верификации

// ============================================
// 📋 МЕНЮ АДМИНИСТРАТОРА
// ============================================

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🤖 Bot Admin')
    .addItem('Init', 'initSheet')
    .addItem('Статистика', 'showStats')
    .addItem('Рассылка', 'broadcastMessage')
    .addItem('Обновить Webhook', 'updateWebhook')
    .addToUi();
}

function initSheet() {
  const sheet = getSheet('Users');
  const headers = ['Date', 'User ID', 'First Name', 'Last Name', 'Username', 'Farm', 'Operator', 'Seasons', 'Status', 'Notes'];
  
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    SpreadsheetApp.getUi().alert('✅ Заголовки созданы!');
  } else {
    SpreadsheetApp.getUi().alert('ℹ️ Заголовки уже существуют.');
  }
}

function showStats() {
  const sheet = getSheet('Users');
  const data = sheet.getDataRange().getValues();
  const total = data.length - 1; // Минус заголовки
  
  let okCount = 0;
  let noCount = 0;
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][8] === '✅ OK') okCount++;
    if (data[i][8] === '❌ No') noCount++;
  }
  
  const message = `📊 Статистика верификаций:\n\n` +
                  `Всего заявок: ${total}\n` +
                  `✅ Одобрено: ${okCount}\n` +
                  `❌ Отклонено: ${noCount}`;
  
  SpreadsheetApp.getUi().alert(message);
}

function broadcastMessage() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt('Рассылка сообщений', 'Введите текст сообщения:', ui.ButtonSet.OK_CANCEL);
  
  if (response.getSelectedButton() === ui.Button.OK) {
    const message = response.getResponseText();
    sendBroadcast(message);
    ui.alert('✅ Рассылка запущена!');
  }
}

function updateWebhook() {
  const url = `https://api.telegram.org/bot${TOKEN}/setWebhook?url=${ScriptApp.getService().getUrl()}`;
  const response = UrlFetchApp.fetch(url);
  const result = JSON.parse(response.getContentText());
  
  if (result.ok) {
    SpreadsheetApp.getUi().alert('✅ Webhook обновлен успешно!');
  } else {
    SpreadsheetApp.getUi().alert('❌ Ошибка: ' + result.description);
  }
}

// ============================================
// 🔄 TELEGRAM WEBHOOK HANDLERS
// ============================================

function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  
  // Дедупликация через CacheService
  const cache = CacheService.getScriptCache();
  const cacheKey = 'update_' + data.update_id;
  
  if (cache.get(cacheKey)) {
    return ContentService.createTextOutput('{"ok": true}');
  }
  cache.put(cacheKey, '1', 60); // Кэш на 60 секунд
  
  try {
    // Обработка callback query
    if (data.callback_query) {
      handleCallbackQuery(data.callback_query);
    }
    
    // Обработка новых участников
    if (data.message && data.message.new_chat_members) {
      handleNewChatMember(data.message);
    }
    
    // Обработка команд
    if (data.message && data.message.text) {
      handleMessage(data.message);
    }
    
    return ContentService.createTextOutput('{"ok": true}');
  } catch (error) {
    Logger.log('Error: ' + error.toString());
    return ContentService.createTextOutput('{"ok": false}');
  }
}

function doGet(e) {
  return ContentService.createTextOutput('Bot is running!');
}

// ============================================
// 👥 ОБРАБОТКА НОВЫХ УЧАСТНИКОВ
// ============================================

function handleNewChatMember(message) {
  const chatId = message.chat.id;
  
  for (let user of message.new_chat_members) {
    const userId = user.id;
    const firstName = user.first_name || '';
    const lastName = user.last_name || '';
    const username = user.username || '';
    
    // Проверяем, был ли пользователь верифицирован
    const userData = getUserData(userId);
    
    if (userData && userData.status === '✅ OK') {
      // Пользователь уже верифицирован - ограничиваем права
      restrictAndWelcome(chatId, userId, firstName);
    } else {
      // Пользователь не верифицирован - отправляем ссылку
      sendVerificationLink(userId, firstName);
    }
  }
}

function handleMessage(message) {
  const chatId = message.chat.id;
  const userId = message.from.id;
  const text = message.text;
  
  // Команда /start
  if (text === '/start') {
    if (chatId === userId) {
      // Личные сообщения
      sendWelcomeMessage(userId);
    } else {
      // Групповой чат
      restrictAndWelcome(chatId, userId, message.from.first_name);
    }
  }
  
  // Команда /verify
  if (text === '/verify' || text === 'Верификация') {
    sendVerificationLink(userId, message.from.first_name);
  }
}

function handleCallbackQuery(callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const userId = callbackQuery.from.id;
  const data = callbackQuery.data;
  
  if (data === 'verify_now') {
    sendVerificationLink(userId, callbackQuery.from.first_name);
    
    TelegramAPI.answerCallbackQuery(callbackQuery.id, 'Открываю анкету...');
  }
  
  if (data === 'i_was_in_uk') {
    // Пользователь был в Британии - одобряем
    saveVerification(userId, callbackQuery.from, '✅ OK', 'Быстрый доступ');
    TelegramAPI.answerCallbackQuery(callbackQuery.id, '✅ Верификация пройдена!');
    
    // Разрешаем писать в группе
    TelegramAPI.restrictChatMember(GROUP_ID, userId, {
      can_send_messages: true,
      can_send_media_messages: true,
      can_send_polls: true,
      can_send_other_messages: true,
      can_add_web_page_previews: true,
      can_change_info: false,
      can_invite_users: false,
      can_pin_messages: false
    });
    
    TelegramAPI.sendMessage(chatId, `✅ @${callbackQuery.from.username || userId} прошел верификацию!`);
  }
  
  if (data === 'not_in_uk') {
    // Проверяем кулдаун
    if (isOnCooldown(userId)) {
      TelegramAPI.answerCallbackQuery(callbackQuery.id, '⏳ Вы можете пройти верификацию позже.', {show_alert: true});
      return;
    }
    
    // Пользователь еще не был в Британии - отклоняем
    saveVerification(userId, callbackQuery.from, '❌ No', 'Еще не был в Британии');
    TelegramAPI.answerCallbackQuery(callbackQuery.id, '❌ Верификация отклонена. Кулдаун: 30 дней.', {show_alert: true});
    
    setCooldown(userId);
  }
}

// ============================================
// 📝 ВЕРИФИКАЦИЯ ЧЕРЕЗ MINI APP
// ============================================

function sendVerificationLink(userId, firstName) {
  const message = `👋 Привет, ${firstName || 'друг'}!\n\n` +
                  `Для доступа к группе необходимо пройти верификацию.\n\n` +
                  `Нажмите кнопку ниже, чтобы заполнить анкету:`;
  
  const keyboard = {
    inline_keyboard: [[
      {text: '📝 Пройти верификацию', url: MINI_APP_URL + '?user_id=' + userId}
    ]]
  };
  
  TelegramAPI.sendMessage(userId, message, {reply_markup: JSON.stringify(keyboard)});
}

function sendWelcomeMessage(userId) {
  const message = `👋 Добро пожаловать в бот верификации Zoir UK!\n\n` +
                  `Этот бот поможет вам получить доступ к нашей группе сезонных рабочих.\n\n` +
                  `Нажмите /verify или кнопку в группе, чтобы начать.`;
  
  const keyboard = {
    inline_keyboard: [[
      {text: '📝 Верификация', url: MINI_APP_URL + '?user_id=' + userId}
    ]]
  };
  
  TelegramAPI.sendMessage(userId, message, {reply_markup: JSON.stringify(keyboard)});
}

function restrictAndWelcome(chatId, userId, firstName) {
  // Ограничиваем права пользователя
  TelegramAPI.restrictChatMember(chatId, userId, {
    can_send_messages: false,
    can_send_media_messages: false,
    can_send_polls: false,
    can_send_other_messages: false,
    can_add_web_page_previews: false,
    can_change_info: false,
    can_invite_users: false,
    can_pin_messages: false
  });
  
  // Отправляем приветственное сообщение
  const message = `👋 Привет, ${firstName || 'друг'}!\n\n` +
                  `Добро пожаловать в группу Zoir UK!\n\n` +
                  `Чтобы получить возможность писать сообщения, необходимо пройти верификацию.\n` +
                  `Нажмите кнопку ниже:`;
  
  const keyboard = {
    inline_keyboard: [[
      {text: '✅ Верификация', callback_data: 'verify_now'}
    ]]
  };
  
  TelegramAPI.sendMessage(chatId, message, {reply_markup: JSON.stringify(keyboard)});
}

// ============================================
// 💾 РАБОТА С ТАБЛИЦЕЙ
// ============================================

function getSheet(sheetName) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  
  return sheet;
}

function getUserData(userId) {
  const sheet = getSheet('Users');
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][1] == userId) {
      return {
        date: data[i][0],
        userId: data[i][1],
        firstName: data[i][2],
        lastName: data[i][3],
        username: data[i][4],
        farm: data[i][5],
        operator: data[i][6],
        seasons: data[i][7],
        status: data[i][8],
        notes: data[i][9]
      };
    }
  }
  
  return null;
}

function saveVerification(userId, user, status, notes) {
  const sheet = getSheet('Users');
  const now = new Date();
  
  // Проверяем, есть ли уже запись
  const existingData = getUserData(userId);
  
  if (existingData) {
    // Обновляем существующую запись
    const row = sheet.getDataRange().getValues().findIndex(r => r[1] == userId) + 1;
    sheet.getRange(row, 9).setValue(status);
    sheet.getRange(row, 10).setValue(notes);
    sheet.getRange(row, 1).setValue(now);
  } else {
    // Создаем новую запись
    sheet.appendRow([
      now,
      userId,
      user.first_name || '',
      user.last_name || '',
      user.username || '',
      '', // Farm - будет заполнено через Mini App
      '', // Operator - будет заполнено через Mini App
      '', // Seasons - будет заполнено через Mini App
      status,
      notes
    ]);
  }
}

function saveFullVerification(userId, user, farm, operator, seasons, status, notes) {
  const sheet = getSheet('Users');
  const now = new Date();
  
  // Проверяем, есть ли уже запись
  const existingData = getUserData(userId);
  
  if (existingData) {
    // Обновляем существующую запись
    const row = sheet.getDataRange().getValues().findIndex(r => r[1] == userId) + 1;
    sheet.getRange(row, 1).setValue(now);
    sheet.getRange(row, 5).setValue(farm);
    sheet.getRange(row, 6).setValue(operator);
    sheet.getRange(row, 7).setValue(seasons);
    sheet.getRange(row, 8).setValue(status);
    sheet.getRange(row, 9).setValue(notes);
  } else {
    // Создаем новую запись
    sheet.appendRow([
      now,
      userId,
      user.first_name || '',
      user.last_name || '',
      user.username || '',
      farm,
      operator,
      seasons,
      status,
      notes
    ]);
  }
}

// ============================================
// ⏳ КУЛДАУН СИСТЕМА
// ============================================

function isOnCooldown(userId) {
  const cooldowns = PropertiesService.getUserProperties();
  const key = 'cooldown_' + userId;
  const cooldownData = cooldowns.getProperty(key);
  
  if (!cooldownData) return false;
  
  const cooldownEnd = new Date(JSON.parse(cooldownData).end);
  return new Date() < cooldownEnd;
}

function setCooldown(userId) {
  const cooldowns = PropertiesService.getUserProperties();
  const key = 'cooldown_' + userId;
  
  const cooldownEnd = new Date();
  cooldownEnd.setDate(cooldownEnd.getDate() + COOLDOWN_DAYS);
  
  cooldowns.setProperty(key, JSON.stringify({
    start: new Date().toISOString(),
    end: cooldownEnd.toISOString()
  }));
}

// ============================================
// 📢 РАССЫЛКА
// ============================================

function sendBroadcast(message) {
  const sheet = getSheet('Users');
  const data = sheet.getDataRange().getValues();
  
  let successCount = 0;
  let failCount = 0;
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][8] === '✅ OK') {
      const userId = data[i][1];
      
      try {
        TelegramAPI.sendMessage(userId, message);
        successCount++;
        Utilities.sleep(100); // Небольшая задержка между сообщениями
      } catch (e) {
        failCount++;
        Logger.log('Failed to send to ' + userId + ': ' + e.toString());
      }
    }
  }
  
  Logger.log('Broadcast complete: ' + successCount + ' sent, ' + failCount + ' failed');
}

// ============================================
// 🔧 TELEGRAM API HELPER
// ============================================

const TelegramAPI = {
  baseUrl: function() {
    return 'https://api.telegram.org/bot' + TOKEN;
  },
  
  sendMessage: function(chatId, text, options) {
    const payload = {
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML'
    };
    
    if (options) {
      Object.assign(payload, options);
    }
    
    UrlFetchApp.fetch(this.baseUrl() + '/sendMessage', {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
  },
  
  answerCallbackQuery: function(callbackQueryId, text, options) {
    const payload = {
      callback_query_id: callbackQueryId,
      text: text || ''
    };
    
    if (options) {
      Object.assign(payload, options);
    }
    
    UrlFetchApp.fetch(this.baseUrl() + '/answerCallbackQuery', {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
  },
  
  restrictChatMember: function(chatId, userId, permissions) {
    const payload = {
      chat_id: chatId,
      user_id: userId,
      permissions: JSON.stringify(permissions)
    };
    
    UrlFetchApp.fetch(this.baseUrl() + '/restrictChatMember', {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
  },
  
  promoteChatMember: function(chatId, userId) {
    const payload = {
      chat_id: chatId,
      user_id: userId,
      can_change_info: false,
      can_post_messages: false,
      can_edit_messages: false,
      can_delete_messages: false,
      can_invite_users: true,
      can_restrict_members: false,
      can_pin_messages: false,
      can_promote_members: false
    };
    
    UrlFetchApp.fetch(this.baseUrl() + '/promoteChatMember', {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
  }
};
