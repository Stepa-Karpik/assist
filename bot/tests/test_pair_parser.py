from app.handlers.pair import parse_pair_command


def test_parse_pair_command():
    assert parse_pair_command("/pair 123456") == "123456"
