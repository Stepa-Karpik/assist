# Knowledge Browser Design

## Goal

Сделать `Knowledge / Review` рабочей desktop-вкладкой, где видны пользовательские материалы из runtime-папок и можно быстро открыть текстовый preview.

## Scope

Срез остаётся полностью локальным. Он не меняет сервер, Telegram или task protocol.

Покрываем четыре runtime-источника:

- `master_info`
- `knowledge`
- `docs/notes`
- `websites`

## Architecture

### Main-side knowledge store

Desktop получает отдельный `knowledgeStore`, который знает allowlisted roots и умеет:

- перечислить доступные файлы по секциям
- безопасно читать конкретный файл по `section + relativePath`

Store не редактирует файлы. Это browser/read-only слой.

### Safe path model

У каждой секции свой root:

- `master_info -> docs/user/master_info`
- `knowledge -> docs/user/knowledge`
- `notes -> docs/user/docs/notes`
- `websites -> docs/user/websites`

Любая попытка traversal за пределы секции отклоняется.

### Renderer flow

`KnowledgePage` грузит список секций и файлов, выбирает первый доступный файл и показывает preview. При выборе другого файла renderer делает отдельный запрос на чтение.

### Non-goals

- редактирование файлов
- binary preview
- rich markdown rendering
- server sync

## UX

Страница состоит из двух колонок:

- слева секции и список файлов
- справа preview выбранного файла

Если секция пуста, показывается пустой state. Если файл не читается, показывается короткая ошибка.

## Testing

- unit tests для safe listing/reading
- renderer test для knowledge page с выбором файла и preview
- полный regression desktop/server/bot после реализации

