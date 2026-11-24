import math

import pytest

from app.core import expr


def test_arithmetic_and_functions():
    assert expr.evaluate(expr.parse("1 + 2 * 3 ^ 2"), {}) == 19
    assert expr.evaluate(expr.parse("sqrt(g / L)"), {"g": 9.8, "L": 2.45}) == pytest.approx(2)
    assert expr.evaluate(expr.parse("2 * pi"), {}) == pytest.approx(2 * math.pi)


@pytest.mark.parametrize("src", ["__import__('os')", "a.b", "x[0]", "lambda: 1", "'text'", "open('f')", "(1).real"])
def test_refuses_code(src):
    with pytest.raises(expr.FormulaError):
        expr.parse(src)


def test_undefined_values_are_nan():
    assert math.isnan(expr.evaluate(expr.parse("1 / x"), {"x": 0}))
    assert math.isnan(expr.evaluate(expr.parse("sqrt(-1)"), {}))


def test_names_exclude_functions_and_constants():
    assert expr.names(expr.parse("sqrt(g / L) * pi + t")) == {"g", "L", "t"}
