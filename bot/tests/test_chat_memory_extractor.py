from app.chat_memory_extractor import extract_memory_writes, serialize_memory_writes


def test_extract_memory_writes_captures_hardware_interests_and_sources() -> None:
    writes = serialize_memory_writes(
        extract_memory_writes(
        "Мне нравится изучать нейросети. У меня AMD Radeon RX 5700 XT, процессор Ryzen 5 3600 6-core, "
        "32gb ozu и диск на 512 гб. Читаю на хабре https://habr.com/ru/articles/912576/."
        )
    )

    assert {"target": "assist/preferences", "key": "interests", "value": "Нейросети"} in writes
    assert {"target": "assist/profile", "key": "gpu", "value": "AMD Radeon RX 5700 XT"} in writes
    assert {"target": "assist/profile", "key": "cpu", "value": "Ryzen 5 3600 6-core"} in writes
    assert {"target": "assist/profile", "key": "ram", "value": "32 GB"} in writes
    assert {"target": "assist/profile", "key": "storage", "value": "512 GB"} in writes
    assert {
        "target": "assist/docs/websites",
        "key": "https://habr.com",
        "value": "habr.com",
    } in writes
    assert {
        "target": "assist/docs/papers",
        "key": "https://habr.com/ru/articles/912576/",
        "value": "https://habr.com/ru/articles/912576/",
    } in writes
