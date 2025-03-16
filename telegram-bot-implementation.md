# Реализация управления подписками в Telegram-боте

Ниже представлены изменения, которые необходимо внести в код Telegram-бота для реализации управления подписками.

## 1. Добавление команды для просмотра информации о подписке

```javascript
// Команда для просмотра информации о текущей подписке
bot.command('subscription', async (ctx) => {
  try {
    const telegramId = ctx.from.id;
    
    // Проверяем, есть ли у пользователя активная подписка
    if (!ctx.state.hasActiveSubscription) {
      return ctx.reply(
        'У вас нет активной подписки. Вы можете оформить подписку с помощью команды /subscribe.',
        Markup.inlineKeyboard([
          Markup.button.callback('Оформить подписку', 'subscribe')
        ])
      );
    }
    
    // Получаем информацию о подписке
    const subscription = await getUserSubscription(telegramId);
    
    if (!subscription) {
      return ctx.reply('Не удалось получить информацию о вашей подписке. Пожалуйста, попробуйте позже.');
    }
    
    // Получаем информацию о плане подписки
    const plan = await getSubscriptionPlan(subscription.plan_id);
    
    if (!plan) {
      return ctx.reply('Не удалось получить информацию о вашем плане подписки. Пожалуйста, попробуйте позже.');
    }
    
    // Форматируем дату окончания подписки
    const endDate = subscription.end_date && !isNaN(new Date(subscription.end_date)) 
      ? new Date(subscription.end_date).toLocaleDateString('ru-RU', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        })
      : 'Бессрочно';
    
    // Форматируем информацию о подписке
    let message = `🔹 *Ваша подписка:* ${plan.name}\n`;
    message += `🔹 *Описание:* ${plan.description}\n`;
    message += `🔹 *Срок действия:* ${endDate}\n`;
    message += `🔹 *Лимит запросов:* ${plan.request_limit === -1 ? 'Безлимитно' : plan.request_limit}\n`;
    
    // Добавляем список доступных моделей
    message += '\n*Доступные модели:*\n';
    if (plan.models_access && Array.isArray(plan.models_access)) {
      plan.models_access.forEach(model => {
        message += `• ${model}\n`;
      });
    } else {
      message += '• Нет доступных моделей\n';
    }
    
    // Добавляем кнопки для управления подпиской
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('Изменить подписку', 'change_subscription')],
      plan.price === 0 ? [] : [Markup.button.callback('Отменить подписку', 'cancel_subscription')]
    ].filter(row => row.length > 0));
    
    ctx.replyWithMarkdown(message, keyboard);
    
    logger.info(`User ${ctx.from.id} viewed subscription info`);
  } catch (error) {
    logger.error('Error in subscription command:', error);
    ctx.reply('Произошла ошибка при получении информации о подписке. Пожалуйста, попробуйте позже.');
  }
});
```

## 2. Обработчик для изменения подписки

```javascript
// Обработчик для изменения подписки
bot.action('change_subscription', async (ctx) => {
  try {
    await ctx.answerCbQuery();
    
    // Получаем список доступных планов
    const plans = await getSubscriptionPlans();
    
    if (!plans || plans.length === 0) {
      return ctx.reply('В данный момент нет доступных планов подписки. Пожалуйста, попробуйте позже.');
    }
    
    // Создаем сообщение с описанием планов
    let message = 'Выберите план подписки:\n\n';
    
    // Создаем клавиатуру с планами
    const buttons = plans.map(plan => {
      message += `*${plan.name}*\n`;
      message += `Цена: ${plan.price} руб.\n`;
      message += `Длительность: ${plan.duration_days} дней\n`;
      message += `Описание: ${plan.description}\n\n`;
      
      return [Markup.button.callback(`${plan.name} - ${plan.price} руб.`, `select_plan:${plan.id}`)];
    });
    
    // Добавляем кнопку отмены
    buttons.push([Markup.button.callback('Отмена', 'cancel_subscription')]);
    
    // Отправляем сообщение с выбором плана
    await ctx.replyWithMarkdown(message, Markup.inlineKeyboard(buttons));
    
    // Сохраняем текущее действие в сессии
    ctx.session.user.currentAction = 'selecting_plan';
    
    logger.info(`User ${ctx.from.id} requested to change subscription`);
  } catch (error) {
    logger.error('Error in change subscription handler:', error);
    ctx.reply('Произошла ошибка при получении списка планов. Пожалуйста, попробуйте позже.');
  }
});
```

## 3. Обработчик для выбора плана подписки

```javascript
// Обработчик для выбора плана подписки
bot.action(/select_plan:(\d+)/, async (ctx) => {
  try {
    await ctx.answerCbQuery();
    
    // Получаем ID выбранного плана из callback_data
    const planId = parseInt(ctx.callbackQuery.data.split(':')[1]);
    
    // Получаем информацию о плане
    const plan = await getSubscriptionPlan(planId);
    
    if (!plan) {
      return ctx.reply('Выбранный план подписки не найден. Пожалуйста, попробуйте снова.');
    }
    
    // Подтверждение выбора плана
    const message = `Вы выбрали план "${plan.name}":\n\n` +
                   `📝 ${plan.description}\n` +
                   `💰 Стоимость: ${plan.price === 0 ? 'Бесплатно' : `${plan.price} руб.`}\n` +
                   `⏱️ Срок действия: ${plan.duration_days} дней\n` +
                   `🔢 Лимит запросов: ${plan.request_limit === -1 ? 'Безлимитно' : plan.request_limit}\n\n` +
                   `Подтвердите оформление подписки:`;
    
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('Подтвердить', `confirm_plan:${planId}`)],
      [Markup.button.callback('Отмена', 'cancel_plan_selection')]
    ]);
    
    ctx.reply(message, keyboard);
    
    logger.info(`User ${ctx.from.id} selected plan ${planId}`);
  } catch (error) {
    logger.error('Error in plan selection handler:', error);
    ctx.reply('Произошла ошибка при выборе плана. Пожалуйста, попробуйте позже.');
  }
});
```

## 4. Обработчик для подтверждения выбора плана

```javascript
// Обработчик для подтверждения выбора плана
bot.action(/confirm_plan:(\d+)/, async (ctx) => {
  try {
    await ctx.answerCbQuery();
    
    // Получаем ID выбранного плана из callback_data
    const planId = parseInt(ctx.callbackQuery.data.split(':')[1]);
    
    // Получаем информацию о плане
    const plan = await getSubscriptionPlan(planId);
    
    if (!plan) {
      return ctx.reply('Выбранный план подписки не найден. Пожалуйста, попробуйте снова.');
    }
    
    // Проверяем, является ли план бесплатным
    const price = parseFloat(plan.price);
    
    if (price === 0) {
      // Для бесплатного плана не создаем платеж, а сразу активируем подписку
      try {
        // Проверяем, есть ли у пользователя неактивная подписка
        const subscriptionResult = await query(
          'SELECT * FROM user_subscriptions WHERE user_id = $1',
          [ctx.session.user.dbId]
        );
        
        // Генерируем уникальный ID платежа
        const paymentId = Date.now().toString();
        
        // Создаем запись о "платеже" со статусом "completed"
        const paymentResult = await query(
          `INSERT INTO payments 
           (user_id, plan_id, amount, status, payment_id) 
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id`,
          [
            ctx.session.user.dbId, 
            planId, 
            0, 
            'completed', 
            paymentId
          ]
        );
        
        const dbPaymentId = paymentResult.rows[0].id;
        
        // Активируем подписку через API функцию
        await activateSubscription(ctx.session.user.dbId, planId, dbPaymentId);
        
        // Отправляем сообщение об успешной активации
        await ctx.reply(
          `✅ Бесплатный план "${plan.name}" успешно активирован!\n\n` +
          `Срок действия: ${plan.duration_days} дней\n` +
          `Лимит запросов: ${plan.request_limit === -1 ? 'Безлимитно' : plan.request_limit}\n\n` +
          `Доступные модели: ${Array.isArray(plan.models_access) ? plan.models_access.join(', ') : 'Нет'}`
        );
        
        logger.info(`Free plan ${planId} activated for user ${ctx.from.id}`);
      } catch (error) {
        logger.error(`Error activating free plan for user ${ctx.from.id}:`, error);
        return ctx.reply('Произошла ошибка при активации бесплатного плана. Пожалуйста, попробуйте позже или обратитесь в поддержку.');
      }
    } else {
      // Для платных планов создаем платеж через Telegram
      try {
        // Создаем инвойс для оплаты
        const invoice = await createTelegramInvoice(ctx.session.user.dbId, planId);
        
        if (!invoice || !invoice.invoice_link) {
          return ctx.reply('Не удалось создать ссылку для оплаты. Пожалуйста, попробуйте позже.');
        }
        
        // Отправляем сообщение со ссылкой на оплату
        await ctx.reply(
          `Для оформления подписки "${plan.name}" перейдите по ссылке ниже:\n\n` +
          `${invoice.invoice_link}\n\n` +
          'После успешной оплаты ваша подписка будет активирована автоматически.',
          { disable_web_page_preview: true }
        );
        
        logger.info(`Payment invoice created for user ${ctx.from.id}, plan ${planId}`);
      } catch (error) {
        logger.error(`Error creating payment for user ${ctx.from.id}:`, error);
        await ctx.reply('Произошла ошибка при создании платежа. Пожалуйста, попробуйте позже или обратитесь в поддержку.');
      }
    }
  } catch (error) {
    logger.error('Error in confirm plan handler:', error);
    ctx.reply('Произошла ошибка при оформлении подписки. Пожалуйста, попробуйте позже.');
  }
});
```

## 5. Обработчик для отмены выбора плана

```javascript
// Обработчик для отмены выбора плана
bot.action('cancel_plan_selection', async (ctx) => {
  try {
    await ctx.answerCbQuery();
    await ctx.reply('Выбор плана отменен.');
    
    // Очищаем текущее действие в сессии
    ctx.session.user.currentAction = null;
    
    logger.info(`User ${ctx.from.id} canceled plan selection`);
  } catch (error) {
    logger.error('Error in cancel plan selection handler:', error);
    ctx.reply('Произошла ошибка при отмене выбора плана. Пожалуйста, попробуйте позже.');
  }
});
```

## 6. Обработчик для отмены подписки

```javascript
// Обработчик для отмены подписки
bot.action('cancel_subscription', async (ctx) => {
  try {
    await ctx.answerCbQuery();
    
    // Запрашиваем подтверждение отмены
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('Да, отменить подписку', 'confirm_cancel_subscription')],
      [Markup.button.callback('Нет, оставить подписку', 'keep_subscription')]
    ]);
    
    await ctx.reply(
      'Вы уверены, что хотите отменить текущую подписку? После отмены вы потеряете доступ к сервису.',
      keyboard
    );
    
    // Сохраняем текущее действие в сессии
    ctx.session.user.currentAction = 'canceling_subscription';
    
    logger.info(`User ${ctx.from.id} requested to cancel subscription`);
  } catch (error) {
    logger.error('Error in cancel subscription handler:', error);
    ctx.reply('Произошла ошибка. Пожалуйста, попробуйте позже.');
  }
});
```

## 7. Обработчик для подтверждения отмены подписки

```javascript
// Обработчик для подтверждения отмены подписки
bot.action('confirm_cancel_subscription', async (ctx) => {
  try {
    await ctx.answerCbQuery();
    
    const telegramId = ctx.from.id;
    
    // Отменяем подписку
    const result = await cancelSubscription(telegramId);
    
    if (result) {
      await ctx.reply('Ваша подписка успешно отменена. Вы можете оформить новую подписку в любое время.');
    } else {
      await ctx.reply('Не удалось отменить подписку. Возможно, у вас нет активной подписки.');
    }
    
    // Очищаем текущее действие в сессии
    ctx.session.user.currentAction = null;
    
    logger.info(`User ${ctx.from.id} canceled subscription`);
  } catch (error) {
    logger.error('Error in confirm cancel subscription handler:', error);
    ctx.reply('Произошла ошибка при отмене подписки. Пожалуйста, попробуйте позже.');
  }
});
```

## 8. Обработчик для отмены отмены подписки

```javascript
// Обработчик для отмены отмены подписки
bot.action('keep_subscription', async (ctx) => {
  try {
    await ctx.answerCbQuery();
    await ctx.reply('Операция отменена. Ваша подписка остается активной.');
    
    // Очищаем текущее действие в сессии
    ctx.session.user.currentAction = null;
    
    logger.info(`User ${ctx.from.id} kept subscription`);
  } catch (error) {
    logger.error('Error in keep subscription handler:', error);
    ctx.reply('Произошла ошибка при отмене операции. Пожалуйста, попробуйте позже.');
  }
});
```

## 9. Добавление пункта меню для управления подпиской

```javascript
// Добавление пункта меню для управления подпиской
const mainMenu = Markup.keyboard([
  ['💬 Новый чат', '📂 Мои чаты'],
  ['👤 Профиль', '📊 Статистика'],
  ['💳 Подписка', '❓ Помощь']
]).resize();

// Обработчик для кнопки "Подписка"
bot.hears('💳 Подписка', async (ctx) => {
  try {
    // Проверяем, есть ли у пользователя активная подписка
    if (ctx.state.hasActiveSubscription) {
      // Получаем информацию о подписке
      const subscription = await getUserSubscription(ctx.from.id);
      
      if (!subscription) {
        return ctx.reply('Не удалось получить информацию о вашей подписке. Пожалуйста, попробуйте позже.');
      }
      
      // Получаем информацию о плане подписки
      const plan = await getSubscriptionPlan(subscription.plan_id);
      
      if (!plan) {
        return ctx.reply('Не удалось получить информацию о вашем плане подписки. Пожалуйста, попробуйте позже.');
      }
      
      // Форматируем дату окончания подписки
      const endDate = subscription.end_date && !isNaN(new Date(subscription.end_date)) 
        ? new Date(subscription.end_date).toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
          })
        : 'Бессрочно';
      
      // Форматируем информацию о подписке
      let message = `🔹 *Ваша подписка:* ${plan.name}\n`;
      message += `🔹 *Описание:* ${plan.description}\n`;
      message += `🔹 *Срок действия:* ${endDate}\n`;
      message += `🔹 *Лимит запросов:* ${plan.request_limit === -1 ? 'Безлимитно' : plan.request_limit}\n`;
      
      // Добавляем список доступных моделей
      message += '\n*Доступные модели:*\n';
      if (plan.models_access && Array.isArray(plan.models_access)) {
        plan.models_access.forEach(model => {
          message += `• ${model}\n`;
        });
      } else {
        message += '• Нет доступных моделей\n';
      }
      
      // Добавляем кнопки для управления подпиской
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('Изменить подписку', 'change_subscription')],
        plan.price === 0 ? [] : [Markup.button.callback('Отменить подписку', 'cancel_subscription')]
      ].filter(row => row.length > 0));
      
      ctx.replyWithMarkdown(message, keyboard);
    } else {
      // Если у пользователя нет активной подписки, предлагаем оформить
      await ctx.reply(
        'У вас нет активной подписки. Вы можете оформить подписку с помощью команды /subscribe.',
        Markup.inlineKeyboard([
          Markup.button.callback('Оформить подписку', 'subscribe')
        ])
      );
    }
    
    logger.info(`User ${ctx.from.id} viewed subscription via menu`);
  } catch (error) {
    logger.error('Error in subscription menu handler:', error);
    ctx.reply('Произошла ошибка при получении информации о подписке. Пожалуйста, попробуйте позже.');
  }
});
```

## 10. Обновление приветственного сообщения

```javascript
// Обновление приветственного сообщения с информацией о подписке
bot.start(async (ctx) => {
  try {
    const telegramId = ctx.from.id;
    
    // Проверяем, есть ли у пользователя активная подписка
    if (ctx.state.hasActiveSubscription) {
      // Получаем информацию о подписке
      const subscription = await getUserSubscription(telegramId);
      
      if (!subscription) {
        return ctx.reply('Не удалось получить информацию о вашей подписке. Пожалуйста, попробуйте позже.');
      }
      
      // Получаем информацию о плане подписки
      const plan = await getSubscriptionPlan(subscription.plan_id);
      
      // Приветственное сообщение с информацией о подписке
      let message = `Привет, ${ctx.from.first_name}! 👋\n\n`;
      message += `Ваш текущий план: *${plan ? plan.name : 'Стандартный'}*\n`;
      
      if (subscription.end_date && !isNaN(new Date(subscription.end_date))) {
        const daysLeft = Math.ceil((new Date(subscription.end_date) - new Date()) / (1000 * 60 * 60 * 24));
        message += `Осталось дней: ${daysLeft > 0 ? daysLeft : 0}\n\n`;
      }
      
      message += 'Используйте меню для навигации:';
      
      ctx.replyWithMarkdown(message, mainMenu);
    } else {
      // Если у пользователя нет активной подписки
      let message = `Привет, ${ctx.from.first_name}! 👋\n\n`;
      message += 'У вас нет активной подписки. Вы можете оформить подписку с помощью команды /subscribe.\n\n';
      message += 'Используйте меню для навигации:';
      
      ctx.replyWithMarkdown(message, mainMenu);
    }
    
    logger.info(`User ${ctx.from.id} started bot`);
  } catch (error) {
    logger.error('Error in start command:', error);
    ctx.reply('Произошла ошибка. Пожалуйста, попробуйте позже.');
  }
});
``` 