# Knowledge Vault Foundation Design

## Goal

Сделать в desktop локальный Obsidian-friendly knowledge vault, который хранится в markdown-файлах и разделён на две верхнеуровневые области:

- `user/`
- `assist/`

Система должна:

- тихо пополнять знания в фоне во время работы ассистента
- поддерживать большие, разветвлённые базы знаний без дублей
- использовать обязательные связи между заметками
- быть пригодной для просмотра и редактирования в Obsidian
- не зависеть от серверной базы данных

Это первый subproject. Он не пытается сразу закрыть весь knowledge stack, а создаёт фундамент:

- `vault root`
- структуру `user/` и `assist/`
- правила записи и дописывания
- linking rules
- desktop-local writer
- расширение onboarding/settings

## Existing Context

Сейчас в проекте уже есть узкий read-only browser:

- `desktop/src/main/knowledgeStore.ts`
- `desktop/src/renderer/pages/KnowledgePage.tsx`

Он читает runtime-папки:

- `master_info`
- `knowledge`
- `docs/notes`
- `websites`

и не умеет:

- строить полноценный vault
- записывать знания
- поддерживать связи
- различать память пользователя и память ассистента

Также уже есть готовый local approval flow для значимых изменений:

- `desktop/src/main/localApprovalStore.ts`
- `desktop/src/renderer/pages/BlockedTasksPage.tsx`

Этот механизм нужно переиспользовать для значимых изменений в `assist/skills`, а не строить второй approval subsystem.

## Scope

В этот срез входит:

- настройка одного `vault root` в onboarding и settings
- автоматическое создание `user/` и `assist/` внутри vault
- новый desktop-local knowledge writer
- правила выбора: дописывать существующее или создавать новый файл
- правила обязательных wiki-links
- registry-заметки в `assist/docs/registry/`
- хранение trusted sources и source summaries в `assist/docs/...`
- замена старого knowledge browser на vault browser

Не входит:

- серверная синхронизация содержимого vault
- vector DB, embeddings или отдельная БД
- поиск по semantic similarity
- полноценный rich editor внутри desktop
- массовый re-ingest старых архивов или внешних vault

## Vault Root Model

Пользователь один раз указывает `vault root`:

- на первом запуске
- в `Настройки`

Пример:

- `D:\KarpikVault`

Внутри него desktop гарантирует две верхние папки:

- `user/`
- `assist/`

Других top-level roots приложение не создаёт.

`vault root` является machine-local настройкой. Сервер не хранит содержимое vault и не участвует в записи markdown-файлов.

## Directory Structure

### User

`user/` — это база знаний пользователя. Туда попадает только то, что действительно полезно человеку перечитывать, дополнять и использовать дальше.

Пример структуры:

- `user/AI/models/MCP/MCP.md`
- `user/AI/models/MCP/Концепции.md`
- `user/AI/models/MCP/Примеры.md`
- `user/AI/models/MCP/Подводные камни.md`
- `user/AI/models/MCP/Источники.md`

Принципы:

- человеческие названия файлов, без `index.md`
- одна тема может быть папкой с несколькими заметками
- если нужная тема уже существует, writer дописывает её, а не создаёт дубликат

### Assist

`assist/` — внутренняя память ассистента. Это не пользовательский конспект, а рабочая память для персонализации, source-tracking и будущих ответов.

Базовая структура:

- `assist/profile/`
- `assist/preferences/`
- `assist/skills/`
- `assist/docs/websites/`
- `assist/docs/papers/`
- `assist/docs/registry/`

Примеры:

- `assist/profile/Владелец.md`
- `assist/preferences/Стиль работы.md`
- `assist/preferences/Предпочитаемый стек.md`
- `assist/skills/Навыки ассистента.md`
- `assist/docs/websites/habr.com.md`
- `assist/docs/papers/habr-ru-articles-899088.md`
- `assist/docs/registry/Документации.md`
- `assist/docs/registry/Доверенные сайты.md`

## Writing Policy

### General Rule

Knowledge writing идёт после содержательного взаимодействия в фоне, без отдельного шума в пользовательской переписке.

Pipeline:

1. ассистент отвечает пользователю
2. desktop-local ingest decider решает, стоит ли что-то сохранить
3. writer обновляет `assist/`, `user/` или оба дерева
4. linker обновляет связи и registry-файлы

### User Writes

`user/` пополняется консервативно.

Туда попадает:

- устойчивое полезное знание
- выжимка, к которой человек реально может вернуться позже
- структурированная документация по запросу пользователя
- темы, которые пользователь явно хочет сохранить

Туда не попадает:

- сырой внутренний reasoning
- мелкие одноразовые операционные детали
- повтор одной и той же информации в новых файлах

### Assist Writes

`assist/` пополняется активнее.

Туда попадает:

- краткая память о предпочтениях владельца
- trusted sources
- summaries статей и сайтов
- какие источники уже использовались
- внутренние навыки и наблюдения
- metadata для будущего retrieval

### Existing Topic vs New Topic

При каждом write writer сначала пытается найти существующую тему.

Правило:

- если подходящий файл уже есть, информация дописывается туда
- новый файл создаётся только если появляется действительно новый подузел темы

Цель:

- не плодить дублей
- выращивать крупные, связанные деревья знаний

## Source Ingestion

Если пользователь даёт внешний источник, например статью, система пишет данные в обе стороны:

### In `user/`

Обновляется пользовательская тема, например:

- `user/AI/models/MCP/...`

Туда идёт полезная для человека выжимка по теме.

### In `assist/`

Пишутся source records:

- `assist/docs/papers/<slug>.md` — заметка по конкретной статье
- `assist/docs/websites/<domain>.md` — заметка по домену как trusted source

Также обновляются registry-файлы:

- `assist/docs/registry/Документации.md`
- `assist/docs/registry/Доверенные сайты.md`

Это нужно, чтобы:

- не вскрывать один и тот же сайт заново без необходимости
- помнить, каким источникам уже можно доверять
- строить retrieval сначала на своей памяти, а потом уже на внешнем вебе

## Linking Rules

Связи обязательны без исключений.

Каждая тематическая заметка должна содержать wiki-links хотя бы на:

- связанную основную тему
- источники
- соседние подтемы

Каждая source note в `assist/docs/...` должна содержать ссылки:

- на темы, которые из неё были выведены
- на домен или registry

Registry-файлы в `assist/docs/registry/` служат обзорными картами:

- перечисляют известные документации
- перечисляют trusted websites
- связывают темы и источники

Файл не должен появляться в isolation. У него должен быть как минимум один путь входа через другую заметку или registry.

## Skills Policy

Для `assist/skills` используется уже существующий local approval flow.

Правило:

- незначительные skill-изменения ассистент пишет сам
- значительные новые навыки сначала фиксируются в draft
- потом создаётся local approval item
- только после approve навык записывается в `assist/skills/...`

Таким образом, навык не теряется, но и не внедряется silently, если это крупное изменение поведения.

## App Integration

### Onboarding

На первом запуске onboarding должен требовать:

- путь к `vault root`

После этого desktop:

- создаёт `user/`
- создаёт `assist/`
- подготавливает базовые registry-файлы

### Settings

В `Настройки` пользователь может:

- увидеть текущий `vault root`
- сменить его
- проверить, что структура валидна

### Knowledge UI

Текущий `Knowledge / Review` должен эволюционировать из runtime-browser в vault-browser.

Новый UI должен уметь:

- показывать дерево `user/` и `assist/`
- открывать markdown preview
- показывать связи и source references

Редактирование вручную остаётся задачей Obsidian. Desktop в этом subproject остаётся viewer/writer, а не полноценным markdown IDE.

## Retrieval Order

Для будущей работы ассистента фиксируется такой порядок обращения к знаниям:

1. `assist/` как память ассистента
2. релевантные заметки из `user/`
3. внешние источники, web, docs, codex — только если локальной памяти не хватает

Это не означает, что retrieval целиком реализуется в этом срезе, но эта иерархия должна определять модель данных уже сейчас.

## Error Handling

Нужно корректно обрабатывать:

- отсутствующий `vault root`
- недоступный путь
- невозможность создать папки
- невозможность записать файл
- битые ссылки и registry drift
- конфликт между ручным редактированием в Obsidian и фоновым append/update

Поведение:

- ошибки записи не должны ломать основной пользовательский ответ
- knowledge write failures должны логироваться отдельно
- UI должен показывать состояние vault в `Настройки` и `Knowledge / Review`, но без лишнего шума

## Testing

### Desktop Main

- создание структуры `user/` и `assist/`
- write/update decision
- append в существующую тему
- создание нового подузла
- source note creation
- registry updates
- mandatory link generation
- approval gate для значимых `assist/skills`

### Renderer

- onboarding для `vault root`
- settings для `vault root`
- vault browser state
- preview тем и source notes

### Regression

- старый onboarding не ломается
- existing local approval flow остаётся рабочим
- packaging и обычный desktop runtime не ломаются

## Migration Strategy

Старый `knowledgeStore` не нужно выбрасывать сразу.

Переход должен быть staged:

1. добавить `vault root` и новый writer
2. научить UI читать новый vault
3. затем решить, нужно ли мигрировать старые runtime-папки `master_info/knowledge/notes/websites`

На первом этапе допустимо:

- показывать только новый vault
- старые runtime-разделы оставить как legacy или скрыть

## Success Criteria

Срез считается успешным, если:

- пользователь может указать `vault root`
- desktop автоматически создаёт `user/` и `assist/`
- после содержательного взаимодействия появляются связанные markdown-заметки
- существующие темы дописываются вместо создания дублей
- `assist/docs/registry/` поддерживает trusted docs/websites
- `Knowledge / Review` показывает новый vault
- крупные изменения в `assist/skills` проходят через existing local approval flow
