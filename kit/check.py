#!/usr/bin/env python3
"""Saloon Rush local checker.

Grades your plan.json against your world.json with the same rules as the official grader,
so you can test as often as you like before uploading.

    python check.py world.json plan.json

Prints the same report the website shows: score, contracts completed, route errors and,
in Tier 3, coins and bar order errors. Python 3.8+, standard library only.
"""

import heapq
import json
import sys

# ---------- rules ----------

# Speed in hundredths of a pace per minute, satchel size, crowd handling, blocked tag
CLASSES = {
    "disguiser": {"speed": 100, "capacity": 2, "ignores_crowd": True, "forbidden": "main_floor"},
    "pickpocket": {"speed": 200, "capacity": 4, "ignores_crowd": False, "forbidden": None},
    "heavy_lifter": {"speed": 150, "capacity": 8, "ignores_crowd": False, "forbidden": "crawlspace"},
}

POINTS_PER_CONTRACT = 100
PENALTY_PER_LATE_MINUTE = 5
MIN_POINTS = 20

COINS_ON_TIME = 50
COINS_EARLY = 100
EARLY_MINUTES = 10

BAR_MENU = {
    "beer": {"cost": 150, "extra_minutes": 15},
    "big_belly_burger": {"cost": 300, "minutes": 30},
    "backpack": {"cost": 400, "extra_capacity": 2},
}
BAR_CLOSED_MESSAGE = "bar orders aren't on the menu in this tier"


class InvalidPlan(Exception):
    """The plan can't be graded at all."""


def contract_points(dropoff_t, deadline):
    late = max(0, dropoff_t - deadline)
    return max(MIN_POINTS, POINTS_PER_CONTRACT - PENALTY_PER_LATE_MINUTE * late)


def contract_coins(dropoff_t, deadline):
    if dropoff_t > deadline:
        return 0
    return COINS_EARLY if deadline - dropoff_t >= EARLY_MINUTES else COINS_ON_TIME


def connection_minutes(connection, spec):
    """ceil(length / speed * crowd) with integer math. None if the class can't use the connection."""
    if spec["forbidden"] and spec["forbidden"] in connection.get("tags", []):
        return None
    crowd_tenths = 10 if spec["ignores_crowd"] else round(connection["crowd"] * 10)
    return -(-(connection["length"] * crowd_tenths * 10) // spec["speed"])


class TravelTimes:
    """Shortest walking times for one class (optionally burger-fast), computed lazily per starting spot."""

    def __init__(self, world, spec):
        self.adjacency = {node["id"]: [] for node in world["nodes"]}
        for connection in world["connections"]:
            minutes = connection_minutes(connection, spec)
            if minutes is None:
                continue
            self.adjacency[connection["a"]].append((connection["b"], minutes))
            self.adjacency[connection["b"]].append((connection["a"], minutes))
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


COMMAND_FIELDS = {"go": "to", "pickup": "contract", "dropoff": "contract"}
BAR_FIELDS = {"beer": "contract", "big_belly_burger": "mercenary", "backpack": "mercenary"}


def check_shape(plan):
    """Same checks as the official parser. Raises InvalidPlan with the first problem found."""

    def fail(path, problem):
        raise InvalidPlan(f"plan.json has the wrong shape: {path}: {problem}")

    if not isinstance(plan, dict):
        fail("(root)", "expected an object")
    extra = set(plan) - {"instance", "gang", "routes", "bar_orders"}
    if extra:
        fail("(root)", f"unrecognized key(s) {sorted(extra)}")
    if not _is_id(plan.get("instance")):
        fail("instance", "expected a string id")
    if "gang" in plan and not isinstance(plan["gang"], str):
        fail("gang", "expected a string")
    if not isinstance(plan.get("routes"), dict):
        fail("routes", "expected an object of mercenary id -> list of commands")
    for mercenary_id, commands in plan["routes"].items():
        if not isinstance(commands, list):
            fail(f"routes.{mercenary_id}", "expected a list")
        for i, cmd in enumerate(commands):
            path = f"routes.{mercenary_id}[{i}]"
            if not isinstance(cmd, dict) or cmd.get("cmd") not in COMMAND_FIELDS:
                fail(f"{path}.cmd", "expected go, pickup or dropoff")
            field = COMMAND_FIELDS[cmd["cmd"]]
            if set(cmd) != {"t", "cmd", field}:
                fail(path, f"a {cmd['cmd']} needs exactly t, cmd and {field}")
            if not _is_minute(cmd["t"]):
                fail(f"{path}.t", "expected a whole minute >= 0")
            if not _is_id(cmd[field]):
                fail(f"{path}.{field}", "expected a string id")
    if "bar_orders" in plan:
        if not isinstance(plan["bar_orders"], list):
            fail("bar_orders", "expected a list")
        for i, order in enumerate(plan["bar_orders"]):
            path = f"bar_orders[{i}]"
            if not isinstance(order, dict) or order.get("item") not in BAR_FIELDS:
                fail(f"{path}.item", "expected beer, big_belly_burger or backpack")
            field = BAR_FIELDS[order["item"]]
            if set(order) != {"t", "item", field}:
                fail(path, f"a {order['item']} needs exactly t, item and {field}")
            if not _is_minute(order["t"]):
                fail(f"{path}.t", "expected a whole minute >= 0")
            if not _is_id(order[field]):
                fail(f"{path}.{field}", "expected a string id")


def check_references(world, plan):
    if plan["instance"] != world["instance"]:
        raise InvalidPlan(f'plan.instance is "{plan["instance"]}", but your floor plan is "{world["instance"]}"')
    mercenary_ids = {m["id"] for m in world["mercenaries"]}
    node_ids = {n["id"] for n in world["nodes"]}
    contract_ids = {c["id"] for c in world["contracts"]}
    for mercenary_id, commands in plan["routes"].items():
        if mercenary_id not in mercenary_ids:
            raise InvalidPlan(f'routes has unknown mercenary "{mercenary_id}"')
        for i, cmd in enumerate(commands):
            if cmd["cmd"] == "go" and cmd["to"] not in node_ids:
                raise InvalidPlan(f'{mercenary_id}[{i}]: unknown spot "{cmd["to"]}"')
            if cmd["cmd"] != "go" and cmd["contract"] not in contract_ids:
                raise InvalidPlan(f'{mercenary_id}[{i}]: unknown contract "{cmd["contract"]}"')
    bar_orders = plan.get("bar_orders", [])
    if bar_orders and not world.get("bar_open", False):
        raise InvalidPlan(BAR_CLOSED_MESSAGE)
    for i, order in enumerate(bar_orders):
        if order["item"] == "beer":
            if order["contract"] not in contract_ids:
                raise InvalidPlan(f'bar_orders[{i}]: unknown contract "{order["contract"]}"')
        elif order["mercenary"] not in mercenary_ids:
            raise InvalidPlan(f'bar_orders[{i}]: unknown mercenary "{order["mercenary"]}"')


# ---------- grading ----------


def grade(world, plan):
    """Replays the plan and returns the report. Raises InvalidPlan if the file can't be graded."""
    check_shape(plan)
    check_references(world, plan)

    bar_open = world.get("bar_open", False)
    shift_end = world["shift_end"]
    travel_cache = {}

    def travel_times(cls, burger):
        if (cls, burger) not in travel_cache:
            spec = dict(CLASSES[cls])
            if burger:
                spec["speed"] = spec["speed"] * 3 // 2
            travel_cache[(cls, burger)] = TravelTimes(world, spec)
        return travel_cache[(cls, burger)]

    contracts = {
        c["id"]: {"contract": c, "lifted_by": None, "completed_at": None, "extension": 0} for c in world["contracts"]
    }
    mercenaries = []
    for m in world["mercenaries"]:
        mercenaries.append(
            {
                "id": m["id"],
                "class": m["class"],
                "commands": plan["routes"].get(m["id"], []),
                "next": 0,
                "cut": False,
                "node": m["hideout"],
                "t": 0,
                "carrying": set(),
                "capacity": CLASSES[m["class"]]["capacity"],
                "burgers": [],
            }
        )
    by_id = {m["id"]: m for m in mercenaries}
    bar_queue = sorted(enumerate(plan.get("bar_orders", [])), key=lambda pair: (pair[1]["t"], pair[0]))
    next_bar = 0

    errors, bar_errors = [], []
    report = {"travel": 0, "earned": world.get("coins", 0) if bar_open else 0, "spent": 0}

    def deadline_of(state):
        return state["contract"]["deadline"] + state["extension"]

    def has_burger(merc, start):
        return any(b <= start < b + BAR_MENU["big_belly_burger"]["minutes"] for b in merc["burgers"])

    def apply_command(merc, cmd):
        if cmd["t"] < merc["t"]:
            return f'{cmd["cmd"]} at t={cmd["t"]} is earlier than the previous command at t={merc["t"]}'
        if cmd["t"] > shift_end:
            return f'{cmd["cmd"]} at t={cmd["t"]} is after shift_end={shift_end}'
        if cmd["cmd"] == "go":
            minutes = travel_times(merc["class"], has_burger(merc, merc["t"])).between(merc["node"], cmd["to"])
            if minutes is None:
                return f'go to {cmd["to"]}: no path from {merc["node"]} this mercenary can use'
            earliest = merc["t"] + minutes
            if cmd["t"] < earliest:
                return f'go to {cmd["to"]} at t={cmd["t"]}, earliest possible t={earliest}'
            merc["node"] = cmd["to"]
            report["travel"] += minutes
        else:
            state = contracts[cmd["contract"]]
            c = state["contract"]
            if cmd["cmd"] == "pickup":
                if merc["node"] != c["table"]:
                    return f'pickup {c["id"]} at {merc["node"]}, but its game table is {c["table"]}'
                if cmd["t"] < c["ready_at"]:
                    return f'pickup {c["id"]} at t={cmd["t"]}, but the bag isn\'t ready until t={c["ready_at"]}'
                if state["lifted_by"] is not None:
                    return f'pickup {c["id"]}, but it was already lifted by {state["lifted_by"]}'
                if len(merc["carrying"]) >= merc["capacity"]:
                    return f'pickup {c["id"]}, but the satchel is full ({merc["capacity"]}/{merc["capacity"]})'
                state["lifted_by"] = merc["id"]
                merc["carrying"].add(c["id"])
            else:
                if c["id"] not in merc["carrying"]:
                    return f'dropoff {c["id"]}, but this mercenary isn\'t carrying it'
                if merc["node"] != c["back_room"]:
                    return f'dropoff {c["id"]} at {merc["node"]}, but its back room is {c["back_room"]}'
                merc["carrying"].remove(c["id"])
                state["completed_at"] = cmd["t"]
                if bar_open:
                    report["earned"] += contract_coins(cmd["t"], deadline_of(state))
        merc["t"] = cmd["t"]
        return None

    def apply_bar_order(order):
        item = order["item"]
        if order["t"] > shift_end:
            return f'{item} at t={order["t"]} is after shift_end={shift_end}'
        cost = BAR_MENU[item]["cost"]
        balance = report["earned"] - report["spent"]
        if balance < cost:
            return f'{item} at t={order["t"]} costs {cost} coins, only {balance} available'
        if item == "beer":
            state = contracts[order["contract"]]
            if state["completed_at"] is not None:
                return (
                    f'beer for {order["contract"]} at t={order["t"]}, '
                    f'but it was already delivered at t={state["completed_at"]}'
                )
            state["extension"] += BAR_MENU["beer"]["extra_minutes"]
        elif item == "big_belly_burger":
            by_id[order["mercenary"]]["burgers"].append(order["t"])
        else:
            by_id[order["mercenary"]]["capacity"] += BAR_MENU["backpack"]["extra_capacity"]
        report["spent"] += cost
        return None

    def head(merc):
        if merc["cut"] or merc["next"] >= len(merc["commands"]):
            return None
        return merc["commands"][merc["next"]]

    def run_next(merc):
        index = merc["next"]
        merc["next"] += 1
        message = apply_command(merc, merc["commands"][index])
        if message is not None:
            merc["cut"] = True
            errors.append({"mercenary": merc["id"], "index": index, "message": f'{merc["id"]}[{index}]: {message}'})

    # Minute by minute: dropoffs first (with whatever must come before them for that mercenary),
    # then bar orders, then everything else in crew order.
    minutes = sorted({c["t"] for m in mercenaries for c in m["commands"]} | {o["t"] for _, o in bar_queue})
    for minute in minutes:
        for merc in mercenaries:
            while head(merc) is not None and head(merc)["t"] < minute:
                run_next(merc)
        for merc in mercenaries:
            last_dropoff = -1
            i = merc["next"]
            while i < len(merc["commands"]) and merc["commands"][i]["t"] == minute:
                if merc["commands"][i]["cmd"] == "dropoff":
                    last_dropoff = i
                i += 1
            while head(merc) is not None and merc["next"] <= last_dropoff:
                run_next(merc)
        while next_bar < len(bar_queue) and bar_queue[next_bar][1]["t"] == minute:
            index, order = bar_queue[next_bar]
            next_bar += 1
            message = apply_bar_order(order)
            if message is not None:
                bar_errors.append({"index": index, "message": f"bar_orders[{index}]: {message}"})
        for merc in mercenaries:
            while head(merc) is not None and head(merc)["t"] == minute:
                run_next(merc)
    for merc in mercenaries:
        while head(merc) is not None:
            run_next(merc)

    score = completed = on_time = late_minutes = 0
    for state in contracts.values():
        if state["completed_at"] is None:
            continue
        completed += 1
        late = max(0, state["completed_at"] - deadline_of(state))
        on_time += late == 0
        late_minutes += late
        score += contract_points(state["completed_at"], deadline_of(state))

    return {
        "instance": world["instance"],
        "score": score,
        "totalContracts": len(world["contracts"]),
        "completed": completed,
        "onTime": on_time,
        "lateMinutes": late_minutes,
        "travelMinutes": report["travel"],
        "errors": errors,
        "coinsEarned": report["earned"],
        "coinsSpent": report["spent"],
        "barErrors": bar_errors,
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
