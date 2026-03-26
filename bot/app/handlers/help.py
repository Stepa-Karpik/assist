def get_help_text() -> str:
    return "\n".join(
        [
            "Karpik принимает обычные сообщения и сам пытается определить задачу.",
            "Примеры:",
            "скинь скриншот",
            "скинь файл с рабочего стола hack.pptx",
            "придумай три названия для фичи",
            "",
            "Ручные команды:",
            "/pair <code>",
            "/task low status",
            "/task low screenshot screen-1",
            "/task low screenshot screen-2",
            "/task medium send-file desktop::hack.pptx",
            "/task low read docs/notes/<file>",
            "/task low list docs/notes",
            "/task low write-note <name> :: <text>",
            "/task high codex <prompt>",
            "/task high codex-write <prompt>",
            "/status [task_id]",
            "",
            "Пароль и TOTP вводятся обычными сообщениями, а подтверждение приходит inline-кнопками.",
            "Codex и codex-write всегда идут через high-risk auth flow.",
        ]
    )
