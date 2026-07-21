import json
import logging

from utils.logging import JsonFormatter


def test_json_formatter_includes_standard_and_extra_fields():
    record = logging.LogRecord(
        name="irlobby.test",
        level=logging.INFO,
        pathname=__file__,
        lineno=10,
        msg="nearby query finished",
        args=(),
        exc_info=None,
    )
    record.user_id = 42
    record.duration_ms = 12.5

    payload = json.loads(JsonFormatter().format(record))

    assert payload["level"] == "INFO"
    assert payload["logger"] == "irlobby.test"
    assert payload["message"] == "nearby query finished"
    assert payload["user_id"] == 42
    assert payload["duration_ms"] == 12.5


def test_json_formatter_stringifies_non_json_extra_values():
    record = logging.LogRecord(
        name="irlobby.test",
        level=logging.WARNING,
        pathname=__file__,
        lineno=10,
        msg="cache warning",
        args=(),
        exc_info=None,
    )
    record.cache_key = {"not-json-serializable"}

    payload = json.loads(JsonFormatter().format(record))

    assert payload["cache_key"] == "{'not-json-serializable'}"
