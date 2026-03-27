# Conversational Routing, App Launch, and UI Polish Design

## Goal

Довести Karpik до режима, где Telegram и GUI воспринимаются как единый живой ассистентский интерфейс, а не набор технических команд. Пользователь должен уметь писать естественным языком, получать русские humanized ответы, запускать сайты и приложения, останавливать ассистентские процессы, видеть состояние ПК и работать с аккуратным минималистичным UI без визуальных и поведенческих багов.

## Scope

В этот срез входят:

- разговорный router для Telegram и local GUI chat;
- DeepSeek как primary chat/router model для неоператорских сообщений;
- явная эскалация в Codex для file/project-sensitive запросов и при явной приписке `codex/кодекс`;
- открытие сайтов без предварительной настройки;
- запуск приложений по alias, реестр приложений в GUI и fallback-выбор через Telegram;
- операторские команды Telegram для статуса ПК, очереди, последних команд и списка приложений;
- kill-flow только для процессов, запущенных самим ассистентом;
- полная русификация пользовательских сообщений и ошибок;
- refresh основного UI, messenger-style chats, новый раздел `Приложения`, исправление scroll policy;
- compact tray popup без scroll, с открытием возле tray icon и скрытием по blur/outside click.

В этот срез не входят:

- остановка произвольных системных процессов, не запущенных Karpik;
- открытие сайтов через поиск, если точный сайт не распознан;
- локальный confirm для `open-site` и `launch-app`;
- ручная настройка сайтов в GUI;
- показ raw stderr/stdout пользователю.

## Product Principles

- Telegram и GUI должны вести себя как два клиента одного ассистента.
- Пользовательские ответы должны быть только на русском.
- Никаких сырых англоязычных ошибок наружу.
- Если действие можно распознать детерминированно, его не нужно отправлять в LLM.
- Если запрос не похож на capability, ассистент должен отвечать conversationally, а не ломаться `Unsupported task intent.`.
- `Quick popup` должен быть маленьким operator widget, а не вторым большим окном.

## Architecture Overview

Система остаётся построенной вокруг текущего backbone:

- `bot` принимает сообщения и callback-ы;
- `server` остаётся control plane для задач, auth, delivery и статусов;
- `desktop` остаётся единственным местом, где реально исполняются локальные действия;
- `GUI` и `Telegram` разделяют один routing policy и одну картину task state.

Поверх этого backbone добавляется новый слой:

- `assistant router`
  - pending conversational state handling;
  - operator command recognition;
  - deterministic capability resolution;
  - DeepSeek chat/router fallback;
  - Codex escalation rules.

## Unified Routing Model

### Input order

Любое входящее сообщение в Telegram или локальном чате проходит через одни и те же логические этапы:

1. Проверка pending-state.
2. Проверка operator intents.
3. Проверка deterministic capabilities.
4. Проверка explicit Codex override.
5. DeepSeek conversational/router fallback.
6. Final Codex fallback only when request is file/project-sensitive.

### Pending states

Поддерживаются такие pending-состояния:

- `pending_auth_password`
- `pending_auth_totp`
- `pending_confirm`
- `pending_screenshot_scope`
- `pending_app_selection`

Правило: пока активен pending-state, следующее сообщение пользователя интерпретируется в рамках этого состояния, а не как новая произвольная задача.

## DeepSeek vs Codex Policy

### DeepSeek path

DeepSeek обрабатывает:

- обычные conversational сообщения;
- простые общие вопросы, не завязанные на локальные файлы и проект;
- fuzzy intent parsing, если deterministic resolver не дал результата;
- humanized wording для ответов и некоторых ошибок.

Примеры:

- `привет`
- `как дела`
- `придумай три названия`
- `объясни ошибку` без указания локального файла

### Codex path

Codex используется, если:

- в тексте явно есть `codex`, `кодекс`, `через codex`;
- запрос касается локального файла, проекта, workspace или кода;
- запрос должен читать или модифицировать содержимое на ПК;
- это явный `codex-write`.

Примеры:

- `кодекс, объясни этот стек`
- `объясни ошибку в файле app/main.py`
- `покажи что не так в этом проекте`
- `/task high codex-write update readme`

### History rule

Ответы DeepSeek записываются в историю как ответы ассистента. Для последующих Codex-обращений история выглядит единой, без разделения на “ответил DeepSeek” и “ответил Codex”.

## Telegram Operator Surface

### Slash commands

Остаются и поддерживаются:

- `/start`
- `/help`
- `/pair <code>`
- `/pc`
- `/device`
- `/queue`
- `/last`
- `/apps`
- `/kill <task_id>`
- `/status [task_id]`
- `/task <low|medium|high> <intent>`

`/auth`, `/confirm`, `/decline` остаются как compatibility fallback, но в нормальном пользовательском потоке бот должен обходиться без них.

### Natural-language operator commands

Telegram должен понимать естественные фразы для:

- статуса ПК;
- очереди задач;
- последних 5 команд;
- списка приложений;
- остановки запущенной задачи;
- открытия сайта;
- запуска приложения.

Примеры:

- `что с пк`
- `что сейчас с задачами`
- `последние команды`
- `приложения`
- `останови osu`
- `открой ютуб`
- `запусти осу`

### Inline interactions

Бот использует inline-кнопки для:

- `confirm / decline`;
- выбора экрана для screenshot;
- списка связанных приложений по `/apps`;
- выбора одного из найденных кандидатов приложения;
- kill действий рядом с задачей в queue/last responses.

## Site Opening

### Behavior

Открытие сайтов не требует предварительной настройки в GUI.

Desktop поддерживает встроенный site alias registry, кодом:

- `ютуб`, `youtube`, `utube` -> `https://youtube.com`
- `гугл`, `google` -> `https://google.com`
- `гитхаб`, `github` -> `https://github.com`
- `openai` -> `https://openai.com`

Список может расширяться, но первый срез делает ставку на самые очевидные и частые сайты.

### Matching policy

- если найдено одно уверенное совпадение, создаётся `medium` task `open-site <url>`;
- если уверенного совпадения нет, сайт не открывается;
- бот отвечает: `Не понял, какой сайт открыть.`
- поисковый переход вместо точного сайта не используется.

### Risk

`open-site` имеет риск `medium` и должен проходить через парольный auth flow, но без локального confirm.

## Application Launch

### App registry in GUI

В основном окне появляется новый раздел sidebar: `Приложения`.

Он показывает локальный реестр приложений:

- `appId`
- `displayName`
- `launchPath`
- `aliases[]`
- `source` (`manual`, `shortcut`, `start_menu`, `program_files`)

Пользователь может:

- добавить приложение вручную;
- указать путь до `.exe` или `.lnk`;
- задать набор alias;
- удалять и редактировать alias.

### Alias normalization

Alias нормализуются в единый compare key:

- lower-case;
- без лишней пунктуации;
- без различия `е/ё`;
- кириллица и латиница приводятся к удобной fuzzy-форме;
- шумовые слова удаляются.

Это позволяет:

- `osu`
- `осу`
- `осу лазер`
- `osu lazer`
- `osu!`
- `osu! lazer`

вести к одной записи.

### Discovery fallback

Если alias в GUI не настроен, desktop ищет кандидатов в:

- `Desktop`
- `Start Menu`
- `Program Files`
- `Program Files (x86)`

Ищутся:

- `.lnk`
- `.exe`

### Telegram fallback selection

Если найдено несколько кандидатов, бот:

- отправляет пронумерованный список;
- сохраняет `pending_app_selection`;
- ждёт следующее числовое сообщение пользователя;
- по выбору создаёт alias-link и сразу запускает приложение.

Если найден ровно один кандидат, он может быть использован сразу.

Если кандидатов нет, бот отвечает по-русски, что приложение не найдено.

### `/apps` and verbal app listing

Команда `/apps` и фразы вроде:

- `приложения`
- `программы`
- `какие приложения доступны`

должны возвращать список уже связанных приложений как inline-кнопки. Нажатие кнопки запускает приложение.

### Risk

`launch-app` имеет риск `medium` и требует парольного auth flow, но не требует локального confirm.

## Process Registry and Kill Flow

### Scope

Останавливать можно только процессы, которые стартовал сам ассистент:

- Codex-run jobs;
- Codex-write preview jobs;
- launch-app процессы, поднятые через Karpik.

### Desktop runtime registry

Desktop хранит `launched process registry`:

- `taskId`
- `kind` (`codex`, `codex-write`, `app`)
- `appId | null`
- `displayName`
- `pid | null`
- `startedAt`
- `status`
- `killHandle`

### Kill behavior

- GUI может остановить задачу или ассистентский app-process по кнопке.
- Telegram может остановить по `task_id` и по natural-language request.
- Если приложение было запущено через alias, бот может остановить его по имени.
- Если задача уже завершена, возвращается корректный русский ответ, без системного stderr.

### Safety rule

Если процесс не найден в ассистентском registry, Karpik не должен пытаться убить его как “любой системный процесс”.

## GUI Refresh

### Main window

Главное окно перестраивается в современный минималистичный operator console:

- тёмная база;
- аккуратные стеклянные/матовые панели;
- технологичный cyan/green accent;
- плотная, но читаемая сетка;
- единый визуальный язык для sidebar, чатов, задач, сервисов.

### Chat layout

`Чаты` становятся настоящей перепиской:

- список чатов в аккуратной боковой колонке;
- пользовательские сообщения справа;
- ответы ассистента слева;
- system messages визуально отделены;
- composer снизу;
- continuation chats из Telegram живут в том же списке.

### Applications page

Новый раздел `Приложения` показывает:

- связанные приложения;
- aliases;
- путь запуска;
- source;
- кнопки edit/remove;
- ручное добавление нового приложения или ярлыка.

### Telegram page

`Чаты Telegram` сохраняют operator role, но получают:

- тот же стиль;
- нормальные русские подписи;
- queue/history cards;
- workspace binding;
- inline actions;
- связанный список приложений при необходимости.

## Scroll Policy

### Main window

Скролл должен работать в основном окне:

- chat list;
- chat thread;
- queue/history pages;
- logs;
- services/settings, если контент длиннее viewport.

### Quick popup

В quick popup скролла не должно быть.

Это достигается не блокировкой колесика как таковой, а ограничением состава popup:

- status summary;
- active task counts;
- last active chat;
- 2-3 последних события;
- quick input;
- компактные основные action-кнопки.

Если чего-то не хватает, пользователь открывает основное окно.

## Tray Popup Behavior

Quick popup должен:

- открываться рядом с tray icon, а не по центру экрана;
- иметь фиксированный компактный размер;
- скрываться по blur;
- скрываться по клику вне окна;
- скрываться по escape;
- не создавать внутренний scroll.

Если точные bounds tray icon недоступны платформенно, используется best-effort near-tray placement, но не центр экрана.

## Localization and Error Normalization

### User-facing rule

Все humanized сообщения в Telegram и GUI должны быть на русском.

Запрещено показывать raw ошибки вида:

- `error: unexpected argument 'osu' found`
- stack trace
- `ENOENT`
- `spawn failed`

### Normalization layer

Добавляется error normalizer для:

- Codex CLI;
- app launch failures;
- site open failures;
- screenshot failures;
- task execution guardrails.

Он преобразует типовые англоязычные ошибки в короткие русские сообщения:

- `Ошибка: аргумент 'osu' не найден.`
- `Ошибка: приложение не найдено.`
- `Ошибка: не удалось открыть сайт.`
- `Ошибка: файл не найден.`

Если точный разбор невозможен, наружу идёт общая русская формулировка без raw stderr.

### Logs policy

Пользователь видит только русскую humanized форму. Raw stderr не показывается ни в Telegram, ни в GUI.

## Local Chat Behavior

Local GUI chat больше не является thin wrapper над task executor.

Теперь:

- обычные разговорные сообщения идут в DeepSeek;
- capability-like фразы превращаются в structured tasks;
- project/file-sensitive запросы эскалируются в Codex;
- ответ всегда выглядит как нормальная реплика ассистента.

Это устраняет текущий баг, где `привет` или похожее сообщение отдаёт `Unsupported task intent.`.

## Data Model Changes

### Bot conversation state

Новые chat-bound states:

- `pending_auth_password`
- `pending_auth_totp`
- `pending_confirm`
- `pending_screenshot_scope`
- `pending_app_selection`

`pending_app_selection` хранит:

- исходный пользовательский текст;
- найденные кандидаты;
- chat id;
- created at / expires at.

### Desktop stores

Новые или расширенные desktop stores:

- `appRegistryStore`
- `launchedProcessStore`
- `siteAliasMap`
- `errorNormalizer`

## Testing Strategy

### Bot

Нужны тесты на:

- `/apps`
- natural-language `приложения/программы`
- status/queue/last/kill natural-language handling;
- pending app selection and numeric choice;
- screenshot scope clarification;
- DeepSeek chat vs Codex escalation.

### Desktop main/runtime

Нужны тесты на:

- app registry CRUD;
- alias normalization;
- candidate discovery;
- launch-app execution;
- open-site execution;
- process registry and kill flow;
- kill refusal for non-assistant processes;
- error normalization to Russian.

### Renderer

Нужны тесты на:

- новый sidebar с `Приложения`;
- chat bubble alignment;
- scroll in main window;
- no-scroll quick popup;
- tray popup hide behavior;
- Russian strings on touched screens.

### Full verification

Полный набор перед завершением:

- `desktop`: `npm run test`
- `desktop`: `npm run typecheck`
- `desktop`: `npm run make`
- `server`: `pytest`
- `bot`: `pytest`

## Implementation Notes

- Это отдельный продуктовый срез поверх уже внедрённых task-control и UI-refresh основ.
- Нельзя пытаться решить всё одним giant LLM-router. Deterministic capabilities должны остаться первыми в цепочке.
- `open-site` и `launch-app` должны встроиться в существующий auth/trust model без локального confirm.
- UI polish и routing changes нужно делать так, чтобы не сломать уже работающие pairing/auth/task execution paths.
