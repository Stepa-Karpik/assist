def get_help_text() -> str:
    return "\n".join(
        [
            "Karpik remote commands:",
            "/pair <code>",
            "/task low status",
            "/task low screenshot",
            "/task low read docs/notes/<file>",
            "/task low list docs/notes",
            "/task low write-note <name> :: <text>",
            "/task high codex <prompt>",
            "/task high codex-write <prompt>",
            "/status [task_id]",
            "/auth <value>",
            "/confirm",
            "/decline",
            "Codex and codex-write always go through the high-risk auth flow.",
        ]
    )
