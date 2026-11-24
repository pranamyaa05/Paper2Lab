"""
Safe evaluator for AI-written motion and readout formulas, mirroring src/lib/expr.ts.
Formulas are parsed with Python's ast and only arithmetic, names and a fixed set of math
functions are allowed, so nothing the AI writes can ever run as code.
"""
from __future__ import annotations

import ast
import math
from typing import Callable, Mapping

FUNCS: dict[str, Callable[..., float]] = {
    "sin": math.sin, "cos": math.cos, "tan": math.tan, "sqrt": math.sqrt, "abs": abs,
    "min": min, "max": max, "pow": pow, "exp": math.exp, "log": math.log, "floor": math.floor,
    "sign": lambda x: (x > 0) - (x < 0),
    "clamp": lambda x, lo=0.0, hi=1.0: min(hi, max(lo, x)),
}
CONSTS = {"pi": math.pi, "e": math.e}
_BINOPS = {ast.Add: lambda a, b: a + b, ast.Sub: lambda a, b: a - b, ast.Mult: lambda a, b: a * b, ast.Div: lambda a, b: a / b, ast.Pow: lambda a, b: a ** b, ast.BitXor: lambda a, b: a ** b}


class FormulaError(ValueError):
    pass


def parse(src: str | float | int) -> ast.Expression:
    if isinstance(src, (int, float)):
        src = repr(float(src))
    if len(src) > 200:
        raise FormulaError("formula too long")
    try:
        tree = ast.parse(src.replace("^", "**"), mode="eval")
    except SyntaxError as e:
        raise FormulaError(f"cannot parse {src!r}") from e
    for node in ast.walk(tree):
        if isinstance(node, (ast.Expression, ast.BinOp, ast.UnaryOp, ast.Constant, ast.Name, ast.Load, ast.Call,
                             ast.Add, ast.Sub, ast.Mult, ast.Div, ast.Pow, ast.USub, ast.UAdd)):
            if isinstance(node, ast.Call) and not (isinstance(node.func, ast.Name) and node.func.id.lower() in FUNCS and not node.keywords):
                raise FormulaError("only the allowed math functions may be called")
            if isinstance(node, ast.Constant) and not isinstance(node.value, (int, float)):
                raise FormulaError("only numbers are allowed")
            continue
        raise FormulaError(f"{type(node).__name__} is not allowed")
    return tree


def evaluate(tree: ast.Expression, variables: Mapping[str, float]) -> float:
    def ev(n: ast.AST) -> float:
        if isinstance(n, ast.Expression):
            return ev(n.body)
        if isinstance(n, ast.Constant):
            return float(n.value)
        if isinstance(n, ast.Name):
            key = n.id
            if key.lower() in CONSTS:
                return CONSTS[key.lower()]
            return float(variables.get(key, 0.0))
        if isinstance(n, ast.UnaryOp):
            v = ev(n.operand)
            return -v if isinstance(n.op, ast.USub) else v
        if isinstance(n, ast.BinOp):
            return _BINOPS[type(n.op)](ev(n.left), ev(n.right))
        if isinstance(n, ast.Call):
            return float(FUNCS[n.func.id.lower()](*[ev(a) for a in n.args]))  # type: ignore[attr-defined]
        raise FormulaError(type(n).__name__)

    try:
        out = ev(tree)
    except (ZeroDivisionError, ValueError, OverflowError, TypeError):
        return float("nan")
    return out if math.isfinite(out) else float("nan")


def names(tree: ast.Expression) -> set[str]:
    return {n.id for n in ast.walk(tree) if isinstance(n, ast.Name) and n.id.lower() not in CONSTS and not _is_func(tree, n)}


def _is_func(tree: ast.Expression, name: ast.Name) -> bool:
    return any(isinstance(c, ast.Call) and c.func is name for c in ast.walk(tree))
