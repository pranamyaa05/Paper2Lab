import asyncio

import pytest

from app.core.efficiency import CallResult, CoolDown, Efficiency, RateLimiter, retry_delay_s, route_models


def r(text="ok"):
    return CallResult(text, "m", 100, 20, 0)


def test_cache_reuses_answers():
    eff = Efficiency(None, 10)
    calls = 0

    async def send():
        nonlocal calls
        calls += 1
        return r()

    async def go():
        await eff.run("analyze", {"image": "x"}, send)
        return await eff.run("analyze", {"image": "x"}, send)

    _, cached = asyncio.run(go())
    assert calls == 1 and cached and eff.stats.cache_hits == 1


def test_coalesces_simultaneous_requests():
    eff = Efficiency(None, 10)
    calls = 0

    async def send():
        nonlocal calls
        calls += 1
        await asyncio.sleep(0.02)
        return r()

    async def go():
        await asyncio.gather(*(eff.run("ask", {"q": 1}, send) for _ in range(3)))

    asyncio.run(go())
    assert calls == 1 and eff.stats.coalesced == 2


def test_failures_are_not_cached():
    eff = Efficiency(None, 10)

    async def bad():
        raise RuntimeError("busy")

    async def good():
        return r("fine")

    async def go():
        with pytest.raises(RuntimeError):
            await eff.run("ask", {"q": 2}, bad)
        return await eff.run("ask", {"q": 2}, good)

    res, cached = asyncio.run(go())
    assert res.text == "fine" and not cached


def test_disk_cache_survives_restart(tmp_path):
    a = Efficiency(tmp_path, 10)
    a.store("translate", {"t": "Hello", "lang": "Hindi"}, r("नमस्ते"))
    b = Efficiency(tmp_path, 10)
    assert b.lookup("translate", {"t": "Hello", "lang": "Hindi"}).text == "नमस्ते"


def test_rate_limit_and_cooldown():
    now = [0.0]
    rl = RateLimiter(2, lambda: now[0])
    rl.take(); rl.take()
    assert rl.wait_time() > 59
    now[0] = 61
    assert rl.wait_time() == 0
    cd = CoolDown(lambda: now[0])
    cd.mark("m", 45)
    assert cd.is_cooling("m")
    now[0] = 200
    assert not cd.is_cooling("m")


def test_routing_and_retry_delay():
    assert route_models("big", ["big", "small-lite", "other"]) == ["small-lite", "big", "other"]
    assert retry_delay_s('"retryDelay": "63880s"') == 63880
