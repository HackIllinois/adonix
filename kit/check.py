#!/usr/bin/env python3
"""Saloon Mercenary local checker.

Grades your plan.json against your world.json with the same rules as the official grader,
so you can test as often as you like before uploading.

    python check.py world.json plan.json

Prints the same report the website shows: score, orders delivered, route errors and,
in Tier 3, coins and power-up errors. Python 3.8+, standard library only.
"""

import heapq
import json
import sys

# ---------- rules ----------

# Speed in hundredths of a block per minute, capacity, congestion handling, blocked edge tag
CLASSES = {
    "disguiser": {"speed": 100, "capacity": 2, "ignores_congestion": True, "forbidden": "exposed"},
    "speedster": {"speed": 200, "capacity": 4, "ignores_congestion": False, "forbidden": None},
    "hauler": {"speed": 150, "capacity": 8, "ignores_congestion": False, "forbidden": "narrow"},
}

POINTS_PER_ORDER = 100
PENALTY_PER_LATE_MINUTE = 5
MIN_POINTS = 20

COINS_ON_TIME = 50
COINS_EARLY = 100
EARLY_MINUTES = 10

POWERUPS = {
    "big_belly_burger": {"cost": 300, "minutes": 30},
    "cactus_cocktail": {"cost": 150, "extra_minutes": 15},
    "extra_satchel": {"cost": 400, "extra_capacity": 2},
}
POWERUPS_DISABLED_MESSAGE = "power-ups aren't available in this tier"


class InvalidPlan(Exception):
    """The plan can't be graded at all."""


def order_points(dropoff_t, deadline):
    late = max(0, dropoff_t - deadline)
    return max(MIN_POINTS, POINTS_PER_ORDER - PENALTY_PER_LATE_MINUTE * late)


def order_coins(dropoff_t, deadline):
    if dropoff_t > deadline:
        return 0
    return COINS_EARLY if deadline - dropoff_t >= EARLY_MINUTES else COINS_ON_TIME


def edge_minutes(edge, spec):
    """ceil(length / speed * congestion) with integer math. None if the class can't use the edge."""
    if spec["forbidden"] and spec["forbidden"] in edge.get("tags", []):
        return None
    congestion_tenths = 10 if spec["ignores_congestion"] else round(edge["congestion"] * 10)
    return -(-(edge["length"] * congestion_tenths * 10) // spec["speed"])


class TravelTimes:
    """Shortest travel times for one class (optionally burger-fast), computed lazily per starting node."""

    def __init__(self, world, spec):
        self.adjacency = {node["id"]: [] for node in world["nodes"]}
        for edge in world["edges"]:
            minutes = edge_minutes(edge, spec)
            if minutes is None:
                continue
            self.adjacency[edge["a"]].append((edge["b"], minutes))
            self.adjacency[edge["b"]].append((edge["a"], minutes))
        self.cache = {}

    def between(self, a, b):
        if a not in self.adjacency or b not in self.adjacency:
            return None
        if a not in self.cache:
            best = {a: 0}
            heap = [(0, a)]
            while heap:
                d, node = heapq.heappop(heap)
                if d > best[node]:
                    continue
                for to, minutes in self.adjacency[node]:
                    if d + minutes < best.get(to, float("inf")):
                        best[to] = d + minutes
                        heapq.heappush(heap, (d + minutes, to))
            self.cache[a] = best
        return self.cache[a].get(b)


# ---------- file checks ----------


def _is_minute(value):
    return isinstance(value, int) and not isinstance(value, bool) and value >= 0


def _is_id(value):
    return isinstance(value, str) and 1 <= len(value) <= 64


COMMAND_FIELDS = {"go": "to", "pickup": "order", "dropoff": "order"}
POWERUP_FIELDS = {"big_belly_burger": "driver", "cactus_cocktail": "order", "extra_satchel": "driver"}


def check_shape(plan):
    """Same checks as the official parser. Raises InvalidPlan with the first problem found."""

    def fail(path, problem):
        raise InvalidPlan(f"plan.json has the wrong shape: {path}: {problem}")

    if not isinstance(plan, dict):
        fail("(root)", "expected an object")
    extra = set(plan) - {"instance", "team", "routes", "powerups"}
    if extra:
        fail("(root)", f"unrecognized key(s) {sorted(extra)}")
    if not _is_id(plan.get("instance")):
        fail("instance", "expected a string id")
    if "team" in plan and not isinstance(plan["team"], str):
        fail("team", "expected a string")
    if not isinstance(plan.get("routes"), dict):
        fail("routes", "expected an object of driver id -> list of commands")
    for driver_id, commands in plan["routes"].items():
        if not isinstance(commands, list):
            fail(f"routes.{driver_id}", "expected a list")
        for i, cmd in enumerate(commands):
            path = f"routes.{driver_id}[{i}]"
            if not isinstance(cmd, dict) or cmd.get("cmd") not in COMMAND_FIELDS:
                fail(f"{path}.cmd", "expected go, pickup or dropoff")
            field = COMMAND_FIELDS[cmd["cmd"]]
            if set(cmd) != {"t", "cmd", field}:
                fail(path, f"a {cmd['cmd']} needs exactly t, cmd and {field}")
            if not _is_minute(cmd["t"]):
                fail(f"{path}.t", "expected a whole minute >= 0")
            if not _is_id(cmd[field]):
                fail(f"{path}.{field}", "expected a string id")
    if "powerups" in plan:
        if not isinstance(plan["powerups"], list):
            fail("powerups", "expected a list")
        for i, powerup in enumerate(plan["powerups"]):
            path = f"powerups[{i}]"
            if not isinstance(powerup, dict) or powerup.get("type") not in POWERUP_FIELDS:
                fail(f"{path}.type", "expected big_belly_burger, cactus_cocktail or extra_satchel")
            field = POWERUP_FIELDS[powerup["type"]]
            if set(powerup) != {"t", "type", field}:
                fail(path, f"a {powerup['type']} needs exactly t, type and {field}")
            if not _is_minute(powerup["t"]):
                fail(f"{path}.t", "expected a whole minute >= 0")
            if not _is_id(powerup[field]):
                fail(f"{path}.{field}", "expected a string id")


def check_references(world, plan):
    if plan["instance"] != world["instance"]:
        raise InvalidPlan(f'plan.instance is "{plan["instance"]}", but your world is "{world["instance"]}"')
    driver_ids = {d["id"] for d in world["drivers"]}
    node_ids = {n["id"] for n in world["nodes"]}
    order_ids = {o["id"] for o in world["orders"]}
    for driver_id, commands in plan["routes"].items():
        if driver_id not in driver_ids:
            raise InvalidPlan(f'routes has unknown driver "{driver_id}"')
        for i, cmd in enumerate(commands):
            if cmd["cmd"] == "go" and cmd["to"] not in node_ids:
                raise InvalidPlan(f'{driver_id}[{i}]: unknown node "{cmd["to"]}"')
            if cmd["cmd"] != "go" and cmd["order"] not in order_ids:
                raise InvalidPlan(f'{driver_id}[{i}]: unknown order "{cmd["order"]}"')
    powerups = plan.get("powerups", [])
    if powerups and not world.get("powerups_enabled", False):
        raise InvalidPlan(POWERUPS_DISABLED_MESSAGE)
    for i, powerup in enumerate(powerups):
        if powerup["type"] == "cactus_cocktail":
            if powerup["order"] not in order_ids:
                raise InvalidPlan(f'powerups[{i}]: unknown order "{powerup["order"]}"')
        elif powerup["driver"] not in driver_ids:
            raise InvalidPlan(f'powerups[{i}]: unknown driver "{powerup["driver"]}"')


# ---------- grading ----------


def grade(world, plan):
    """Replays the plan and returns the report. Raises InvalidPlan if the file can't be graded."""
    check_shape(plan)
    check_references(world, plan)

    powerups_enabled = world.get("powerups_enabled", False)
    shift_end = world["shift_end"]
    travel_cache = {}

    def travel_times(cls, burger):
        if (cls, burger) not in travel_cache:
            spec = dict(CLASSES[cls])
            if burger:
                spec["speed"] = spec["speed"] * 3 // 2
            travel_cache[(cls, burger)] = TravelTimes(world, spec)
        return travel_cache[(cls, burger)]

    orders = {o["id"]: {"order": o, "stolen_by": None, "delivered_at": None, "extension": 0} for o in world["orders"]}
    drivers = []
    for d in world["drivers"]:
        drivers.append(
            {
                "id": d["id"],
                "class": d["class"],
                "commands": plan["routes"].get(d["id"], []),
                "next": 0,
                "cut": False,
                "node": d["start"],
                "t": 0,
                "carrying": set(),
                "capacity": CLASSES[d["class"]]["capacity"],
                "burgers": [],
            }
        )
    by_id = {d["id"]: d for d in drivers}
    powerup_queue = sorted(enumerate(plan.get("powerups", [])), key=lambda pair: (pair[1]["t"], pair[0]))
    next_powerup = 0

    errors, powerup_errors = [], []
    report = {"travel": 0, "earned": world.get("coins", 0) if powerups_enabled else 0, "spent": 0}

    def deadline_of(state):
        return state["order"]["deadline"] + state["extension"]

    def has_burger(driver, start):
        return any(b <= start < b + POWERUPS["big_belly_burger"]["minutes"] for b in driver["burgers"])

    def apply_command(driver, cmd):
        if cmd["t"] < driver["t"]:
            return f'{cmd["cmd"]} at t={cmd["t"]} is earlier than the previous command at t={driver["t"]}'
        if cmd["t"] > shift_end:
            return f'{cmd["cmd"]} at t={cmd["t"]} is after shift_end={shift_end}'
        if cmd["cmd"] == "go":
            minutes = travel_times(driver["class"], has_burger(driver, driver["t"])).between(driver["node"], cmd["to"])
            if minutes is None:
                return f'go to {cmd["to"]}: no path from {driver["node"]} this driver can use'
            earliest = driver["t"] + minutes
            if cmd["t"] < earliest:
                return f'go to {cmd["to"]} at t={cmd["t"]}, earliest possible t={earliest}'
            driver["node"] = cmd["to"]
            report["travel"] += minutes
        else:
            state = orders[cmd["order"]]
            o = state["order"]
            if cmd["cmd"] == "pickup":
                if driver["node"] != o["target"]:
                    return f'pickup {o["id"]} at {driver["node"]}, but its target is {o["target"]}'
                if cmd["t"] < o["ready_at"]:
                    return f'pickup {o["id"]} at t={cmd["t"]}, but the jewelry isn\'t ready until t={o["ready_at"]}'
                if state["stolen_by"] is not None:
                    return f'pickup {o["id"]}, but it was already stolen by {state["stolen_by"]}'
                if len(driver["carrying"]) >= driver["capacity"]:
                    return f'pickup {o["id"]}, but the satchel is full ({driver["capacity"]}/{driver["capacity"]})'
                state["stolen_by"] = driver["id"]
                driver["carrying"].add(o["id"])
            else:
                if o["id"] not in driver["carrying"]:
                    return f'dropoff {o["id"]}, but this driver isn\'t carrying it'
                if driver["node"] != o["fence"]:
                    return f'dropoff {o["id"]} at {driver["node"]}, but its fence is {o["fence"]}'
                driver["carrying"].remove(o["id"])
                state["delivered_at"] = cmd["t"]
                if powerups_enabled:
                    report["earned"] += order_coins(cmd["t"], deadline_of(state))
        driver["t"] = cmd["t"]
        return None

    def apply_powerup(powerup):
        kind = powerup["type"]
        if powerup["t"] > shift_end:
            return f'{kind} at t={powerup["t"]} is after shift_end={shift_end}'
        cost = POWERUPS[kind]["cost"]
        balance = report["earned"] - report["spent"]
        if balance < cost:
            return f'{kind} at t={powerup["t"]} costs {cost} coins, only {balance} available'
        if kind == "cactus_cocktail":
            state = orders[powerup["order"]]
            if state["delivered_at"] is not None:
                return (
                    f'cactus_cocktail for {powerup["order"]} at t={powerup["t"]}, '
                    f'but it was already delivered at t={state["delivered_at"]}'
                )
            state["extension"] += POWERUPS["cactus_cocktail"]["extra_minutes"]
        elif kind == "big_belly_burger":
            by_id[powerup["driver"]]["burgers"].append(powerup["t"])
        else:
            by_id[powerup["driver"]]["capacity"] += POWERUPS["extra_satchel"]["extra_capacity"]
        report["spent"] += cost
        return None

    def head(driver):
        if driver["cut"] or driver["next"] >= len(driver["commands"]):
            return None
        return driver["commands"][driver["next"]]

    def run_next(driver):
        index = driver["next"]
        driver["next"] += 1
        message = apply_command(driver, driver["commands"][index])
        if message is not None:
            driver["cut"] = True
            errors.append({"driver": driver["id"], "index": index, "message": f'{driver["id"]}[{index}]: {message}'})

    # Minute by minute: dropoffs first (with whatever must come before them for that driver),
    # then power-ups, then everything else in driver order.
    minutes = sorted({c["t"] for d in drivers for c in d["commands"]} | {p["t"] for _, p in powerup_queue})
    for minute in minutes:
        for driver in drivers:
            while head(driver) is not None and head(driver)["t"] < minute:
                run_next(driver)
        for driver in drivers:
            last_dropoff = -1
            i = driver["next"]
            while i < len(driver["commands"]) and driver["commands"][i]["t"] == minute:
                if driver["commands"][i]["cmd"] == "dropoff":
                    last_dropoff = i
                i += 1
            while head(driver) is not None and driver["next"] <= last_dropoff:
                run_next(driver)
        while next_powerup < len(powerup_queue) and powerup_queue[next_powerup][1]["t"] == minute:
            index, powerup = powerup_queue[next_powerup]
            next_powerup += 1
            message = apply_powerup(powerup)
            if message is not None:
                powerup_errors.append({"index": index, "message": f"powerups[{index}]: {message}"})
        for driver in drivers:
            while head(driver) is not None and head(driver)["t"] == minute:
                run_next(driver)
    for driver in drivers:
        while head(driver) is not None:
            run_next(driver)

    score = completed = on_time = late_minutes = 0
    for state in orders.values():
        if state["delivered_at"] is None:
            continue
        completed += 1
        late = max(0, state["delivered_at"] - deadline_of(state))
        on_time += late == 0
        late_minutes += late
        score += order_points(state["delivered_at"], deadline_of(state))

    return {
        "instance": world["instance"],
        "score": score,
        "totalOrders": len(world["orders"]),
        "completed": completed,
        "onTime": on_time,
        "lateMinutes": late_minutes,
        "travelMinutes": report["travel"],
        "errors": errors,
        "coinsEarned": report["earned"],
        "coinsSpent": report["spent"],
        "powerupErrors": powerup_errors,
    }


def main(argv):
    if len(argv) != 3:
        print("Usage: python check.py world.json plan.json", file=sys.stderr)
        return 2
    with open(argv[1], encoding="utf8") as f:
        world = json.load(f)
    try:
        with open(argv[2], encoding="utf8") as f:
            plan = json.load(f)
    except json.JSONDecodeError as err:
        print(json.dumps({"error": "InvalidPlan", "reason": f"plan.json is not valid JSON: {err}"}, indent=2))
        return 1
    try:
        report = grade(world, plan)
    except InvalidPlan as err:
        print(json.dumps({"error": "InvalidPlan", "reason": str(err)}, indent=2))
        return 1
    print(json.dumps(report, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
