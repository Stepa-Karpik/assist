# Remote Task Control and UI Refresh Design

## Goal

Закрыть два системных пробела одновременно:

1. Оператор должен уметь видеть и останавливать зависшие или лишние задачи из GUI и Telegram.
2. Desktop UI должен перестать выглядеть как технический черновик и стать рабочим операторским интерфейсом: понятный chat UX, аккуратный quick popup, единая визуальная система и отсутствие битой локализации.

## Scope

В этот срез входят:

- kill/cancel для активных задач из GUI и Telegram;
- Telegram-операторские ответы для статуса ПК, очереди и последних 5 команд;
- local chat intent flow без `Unsupported task intent.` на обычных сообщениях;
- переработка main window и quick popup;
- фиксы tray popup positioning/hide behavior;
- выравнивание русских строк и удаление битой кодировки в затронутых экранах и bot responses.

В этот срез не входят:

- новая серверная архитектура;
- новый transport;
- полный conversational LLM-agent для GUI;
- новые сложные capabilities beyond cancel/status/queue/history.

## Current Problems

### Task/process control

- Сервер знает только про `queued/running/...`, но не про явный операторский stop request.
- Desktop runtime не держит отдельный registry активных исполнений, поэтому нет надёжного способа прервать `codex` и другие долгие операции по `task_id`.
- GUI умеет только `retry`, но не умеет `cancel/kill`.
- Telegram умеет только заводить и смотреть отдельную задачу, но не даёт оператору реальную панель управления очередью.

### Local chat UX

- Local chat runtime передаёт raw user text прямо в task executor.
- Task executor понимает только structured intents, поэтому обычный текст валится в `Unsupported task intent.`
- Для desktop-переписки это нерабочая модель: пользователь пишет естественным языком, а получает системную ошибку вместо нормального результата.

### Visual/UI quality

- Main window стилистически разнороден, с устаревшими блоками и поломанной русской кодировкой.
- Local chats не выглядят как переписка.
- Quick popup открывается как обычное окно по центру экрана, а не как tray-attached surface.
- Popup переполнен и скроллится, хотя должен быть компактным operator widget.

## Design Overview

### 1. Unified task control model

Добавляем явный операторский контроль над задачей.

Новые состояния и действия:

- `cancel_requested`: серверное намерение остановить задачу, если она уже стартовала на ПК;
- `cancelled`: терминальное состояние для успешно остановленной задачи;
- `stalled` остаётся отдельным состоянием для runtime-проблем, но оператор должен уметь превратить его либо в `retry`, либо в `cancelled`.

Новые операции:

- `POST /api/tasks/{task_id}/cancel`:
  - если задача `queued` или `awaiting_auth`, она сразу становится `cancelled`;
  - если задача `running` или `awaiting_local_approval`, она получает `cancel_requested`, а desktop runtime завершает локальный процесс и финализирует её как `cancelled`;
  - если задача уже терминальная, сервер возвращает `409`.

Desktop runtime получает process registry:

- `task_id -> execution handle`
- handle поддерживает best-effort `cancel()`
- для `codex` это вызывает остановку дочернего процесса;
- для быстрых builtin действий cancel просто игнорируется или завершает задачу до запуска.

### 2. Telegram operator surface

Telegram должен работать без формальных `/task ...` почти всегда.

Поведение:

- произвольный текст по-прежнему идёт через intent resolution;
- отдельные operator-команды добавляются как явные shortcuts:
  - `/pc` или `/device`: краткий статус ПК;
  - `/queue`: активная очередь;
  - `/last`: последние 5 команд;
  - `/kill <task_id>`: явное завершение;
- дополнительно bot должен понимать естественные фразы:
  - `что с пк`
  - `какие задачи в очереди`
  - `останови задачу <id>`

Ответы:

- статус ПК: online/offline, last heartbeat, pending/running/awaiting approval count;
- очередь: компактный список активных задач с `task_id`, статусом и укороченным intent;
- последние 5: самые свежие записи history для этого device;
- для queue/history bot добавляет inline-кнопки `Остановить` у задач, которые ещё можно завершить.

### 3. Local chat request resolution

GUI-origin сообщения проходят через local intent resolver до task executor.

Правило:

- сначала rule-based resolver, совместимый с Telegram resolver;
- затем optional codex fallback;
- если сообщение не мапится в известную capability, desktop создаёт assistant-style ответ через `codex <prompt>` вместо системной ошибки.

Это даёт:

- `привет` -> нормальный assistant reply;
- `что сейчас с задачами` -> status/queue response;
- `скинь скриншот` -> structured task;
- `прочитай файл ...` -> structured task.

`Unsupported task intent.` остаётся только как internal guardrail, но не должен больше всплывать в основном пользовательском потоке.

### 4. Main window redesign

UI переводится в минималистичный operator dashboard с чёткой иерархией.

Визуальное направление:

- графитовый/стальной фон, акценты cyan/green;
- более плотный layout без случайного воздуха;
- единая карточная система с мягкими границами и умеренной анимацией;
- typography без визуального мусора, с упором на читаемость статусов и команд.

Main shell:

- слева фиксированная аккуратная sidebar;
- справа контент в full-height panel;
- `Chats` становятся messenger layout:
  - список чатов слева внутри секции;
  - message thread справа;
  - user bubble справа;
  - assistant/system bubble слева;
  - composer фиксирован снизу;
- `Blocked/Queue` становятся operator board с карточками задач и быстрыми actions `Retry / Kill / Open chat`;
- `Services` и `Settings` сохраняются, но приводятся к тому же стилю и нормальной русской локализации.

### 5. Quick popup redesign

Quick popup становится tray-attached compact surface.

Поведение:

- открывается рядом с bounds tray icon;
- не появляется в центре экрана;
- скрывается по blur/outside click/escape;
- не скроллится;
- содержит только:
  - active counts;
  - last active chat;
  - 3-4 recent runtime items;
  - single-line quick input;
  - primary actions.

Если контента больше, он урезается, а не раздувает popup.

## Data Flow

### Cancel from GUI/Telegram

1. GUI button or Telegram command/callback вызывает server cancel API.
2. Server меняет task state:
   - `queued/awaiting_auth` -> `cancelled`
   - `running/awaiting_local_approval` -> `cancel_requested`
3. Desktop polling видит `cancel_requested`, находит execution handle, вызывает `cancel()`.
4. Runtime публикует `cancelled` с `error_text = "Cancelled by operator."` или отдельным `result_text`.
5. Delivery layer шлёт итог в Telegram и обновляет GUI snapshot.

### Local chat

1. User text -> local intent resolver.
2. Resolver возвращает:
   - structured task;
   - clarification;
   - codex fallback.
3. Runtime выполняет задачу и пишет assistant/system message уже в conversational form.

## Error Handling

- Если cancel не может прервать локальный процесс, runtime фейлит задачу как `stalled` с явным текстом, а не молча оставляет её running.
- Если Telegram пытается kill уже завершённую задачу, bot отвечает короткой диагностикой.
- Если local resolver не уверен, он уходит в codex fallback, а не в raw executor failure.
- Если popup нельзя точно привязать к tray icon bounds на конкретной платформе, используется лучший доступный near-tray placement, но никогда не центр экрана.

## Testing Strategy

- Server:
  - cancel API for queued/running/terminal tasks;
  - queue/history summaries for Telegram operator surface.
- Bot:
  - `/pc`, `/queue`, `/last`, `/kill`;
  - inline kill callbacks;
  - natural-language status/queue/kill mapping.
- Desktop main/runtime:
  - process registry cancel for codex and long-running tasks;
  - local chat fallback on plain text;
  - popup hide/position behavior;
  - message-thread rendering and compact popup snapshots.
- Renderer:
  - chat bubbles left/right;
  - blocked tasks kill button;
  - no broken Russian strings on touched screens.
