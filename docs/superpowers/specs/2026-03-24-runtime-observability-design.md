# Runtime Observability Design

## Goal

Сделать desktop пригодным для повседневного использования без ручного переключения между вкладками: быстрый запрос из popup, живая лента событий и понятный runtime status.

## Scope

Этот срез закрывает три текущие пустоты:

1. `Quick Access` должен реально отправлять запрос в последний активный локальный чат.
2. `Логи` должны показывать человекочитаемую историю событий.
3. `Сервисы` должны показывать фактическое состояние desktop runtime, а не placeholder.

Срез не меняет серверный контракт и не требует новых Telegram API.

## Architecture

### 1. Activity Log Store

Desktop получает новый persisted store `activityLogStore`, который хранит плоскую ленту runtime-событий.

Каждая запись содержит:

- `entryId`
- `kind`: `local_request` | `local_result` | `remote_task`
- `status`: `info` | `success` | `warning` | `error`
- `title`
- `detail`
- `chatId`
- `taskId`
- `createdAt`

Store ограничивает размер ленты, чтобы runtime state не разрастался бесконечно.

### 2. Local Chat Runtime Integration

`localChatRuntime` после каждого локального выполнения пишет в activity log:

- входящий текст пользователя
- итог выполнения
- ожидание локального approve
- ошибка выполнения

Это даёт observable trail для desktop-origin задач.

### 3. Remote Task Polling Integration

Main process уже держит `taskSnapshot`. Теперь polling-cycle дополнительно сравнивает новый snapshot с предыдущим и логирует:

- новую задачу
- смену статуса
- финальный `done/failed/blocked`

Логирование идёт только при появлении новой информации, чтобы не спамить одинаковыми poll results.

### 4. Quick Access Flow

Quick popup получает новый desktop-only API:

- `getQuickAccessState()`
- `submitQuickRequest({ text })`

Поведение:

- если локальных чатов нет, desktop сам создаёт новый `desktop_chat`
- если чаты есть, выбирается самый свежий по `updatedAt`
- запрос уходит в `localChatRuntime`
- popup показывает target chat и последний результат

Quick popup не должен знать про Telegram или server queue; это чисто локальная точка входа.

### 5. Logs View

`Логи` читают activity log через IPC и показывают:

- тип события
- статус
- время
- заголовок
- detail

Это не low-level technical log и не stack trace dump. Цель страницы: быстро понять, что происходило.

### 6. Services View

`Сервисы` получают `getRuntimeStatus()` и показывают:

- `device id`
- `server url`
- pairing status
- auth configured status
- число workspace
- default workspace
- число локальных чатов
- последний активный чат
- размер activity log

Это runtime surface, а не конфиг-редактор.

## Data Flow

### Quick request

`QuickPopupView -> preload IPC -> main -> localChatRuntime -> taskExecutor -> localChatStore/activityLogStore -> response back to popup`

### Remote task audit

`pollTaskState -> new snapshot -> diff against previous snapshot -> activityLogStore.append(...)`

### Services snapshot

`ServicesPage -> preload IPC -> main aggregates auth/pairing/codex/chat/log state -> renderer`

## Error Handling

- Пустой quick request не отправляется.
- Если runtime не может создать/найти локальный чат, popup показывает понятную ошибку.
- Если локальное выполнение падает, ошибка уходит и в chat history, и в activity log.
- Если activity log повреждён на диске, desktop начинает с пустой ленты, как и другие local stores.

## Testing Strategy

### Unit

- `activityLogStore` persistence, trimming, ordering
- `quick access` main-side selection logic

### Renderer

- popup отправляет запрос в последний активный чат
- popup создаёт чат автоматически, если их нет
- `Логи` показывают audit entries
- `Сервисы` показывают runtime snapshot

### Regression

- полный `desktop test`
- `desktop typecheck`
- `desktop package`
- `server pytest`
- `bot pytest`

