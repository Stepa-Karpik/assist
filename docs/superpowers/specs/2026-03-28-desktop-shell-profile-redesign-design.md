# Desktop Shell, Home, and Owner Profile Redesign Design

## Goal

Перенести desktop-клиент на новый визуальный shell по референсу `design-demo.png`, сделать `Главную` максимально близкой к макету, добавить отдельную страницу `Профиль` владельца с синхронизацией и встроить этот профиль в conversational context Telegram и локальных DeepSeek-чатов без передачи персональных полей в Codex.

## Non-Goals

- Не переписывать task/auth/runtime transport без прямой необходимости.
- Не менять core execution semantics задач, если их можно переиспользовать.
- Не передавать личные поля владельца в Codex prompt context.

## Visual Direction

- `Главная` должна быть pixel-close к `C:\Users\TBG\Desktop\new_design\design-demo.png`.
- Остальные страницы используют тот же shell: тёмная база, неоновое свечение, glass cards, тонкий sidebar, аккуратный top bar, единая типографика и состояния.
- `design.css` используется как визуальный референс по композиции, цветам и отступам, но не как production-ready stylesheet.
- `design-logo.png` становится основным brand asset для shell и `Главной`.

## IA and Navigation

Новый sidebar должен содержать:

- `Главная`
- `Чаты`
- `Чаты Telegram`
- `Невыполненное`
- `Приложения`
- `Knowledge`
- `Логи`
- `Сервисы`
- `Профиль`
- `Настройки`

`Главная` становится стартовым экраном desktop-приложения. Existing pages остаются, но переезжают в новый shell.

## Home Page

`Главная` должна содержать:

- точный hero-блок с приветствием и logo orb
- top bar с поиском и быстрыми действиями
- большой input для быстрого запроса
- краткий operational summary: статус ПК, активные задачи, последние действия, быстрые переходы

Запрос из `Главной` должен использовать существующий локальный conversational/runtime path, а не отдельный новый backend.

## Chats UX

- `Чаты` становятся полноценным messenger layout
- список чатов слева, активный тред справа
- пользовательские сообщения справа
- ответы ассистента слева
- task/system events отображаются как service bubbles/cards
- continuation из Telegram остаётся, но визуально интегрируется в тот же layout

## Owner Profile

`Профиль` — отдельная страница, не секция настроек.

Содержит:

- avatar
- ФИО
- пол
- возраст
- город
- часовой пояс
- язык
- контакты
- род деятельности
- краткое описание
- дополнительные заметки

Правила:

- в view-mode показываются только заполненные поля
- если профиль почти пустой, остаётся базовый avatar state и CTA на редактирование
- edit-mode показывает все editable controls

## Profile Data Flow

- Профиль хранится локально в desktop
- desktop синхронизирует профиль на server control plane
- Telegram conversational layer и локальные DeepSeek-чаты получают owner profile как часть user context
- Codex получает только project/workspace context, но не личные поля владельца
- Если поле пустое, оно не должно попадать в composed conversational context

## Tray Popup

Tray popup — отдельный compact surface:

- без scroll
- привязывается к tray icon, а не к центру экрана
- скрывается по blur/outside click
- показывает только компактный статус, быстрый input, последние действия и переход в главное окно

## Technical Scope

### Desktop renderer

- refactor `App.tsx` into new app shell
- add `Главная` and `Профиль`
- migrate all existing pages to new shell classes/components
- update popup view to dedicated compact layout

### Desktop main

- add owner profile store and IPC
- sync owner profile to server
- expose profile to renderer and conversational runtime

### Server

- add durable owner profile endpoint bound to device
- expose profile state for desktop sync

### Bot / conversational layer

- include synced owner profile in Telegram and local DeepSeek context
- keep Codex context free of owner PII

## Risks

- Visual parity on `Главная` can drift if raw Figma CSS is copied instead of adapted.
- Existing renderer tests may be tightly coupled to old layout and need broad updates.
- Profile sync must not break existing device/pairing/task flows.
- Popup compactness must be solved as a separate surface, not by shrinking the main layout.

## Acceptance Criteria

- `Главная` visually matches the reference closely enough to be recognizable as the same design.
- All existing pages use the same design language and sidebar shell.
- `Профиль` is a separate tab with editable and readable states.
- Empty profile fields are hidden in view-mode.
- Owner profile syncs and influences Telegram plus local DeepSeek behavior.
- Codex context does not receive owner profile fields.
- Main window scroll behaves normally; tray popup has no scroll and hides on blur.
