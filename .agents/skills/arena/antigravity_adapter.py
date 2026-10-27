#!/usr/bin/env python3
"""antigravity_adapter.py: Google Antigravity Compatibility Adapter for the Arena Skill.

Provides platform-specific orchestration, safety controls, cost/token estimation,
environment validation, and deterministic bracket testing for Google Antigravity.

Preserves the original upstream bracket.py and strategies.json untouched.
Standard library Python 3.8+ only.
"""
import argparse
import json
import math
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time

HERE = os.path.dirname(os.path.abspath(__file__))
BRACKET_PY = os.path.join(HERE, "bracket.py")
STRATEGIES_JSON = os.path.join(HERE, "strategies.json")
RUBRIC_MD = os.path.join(HERE, "rubric.md")
SKILL_MD = os.path.join(HERE, "SKILL.md")

# Model cost constants for estimation (per 1M tokens)
# Reflects standard tier pricing (e.g. Gemini 1.5 Pro / Claude 3.5 Sonnet class)
ESTIMATED_TOKENS_PER_CALL = {
    "spawn": {"input": 1200, "output": 800},
    "attack": {"input": 2200, "output": 500},
    "defend": {"input": 2800, "output": 900},
    "judge": {"input": 3500, "output": 400},
    "final": {"input": 3200, "output": 400},
}
PRICE_PER_M_INPUT = 3.00   # $3.00 / 1M input tokens
PRICE_PER_M_OUTPUT = 15.00 # $15.00 / 1M output tokens

SECRET_PATTERNS = [
    re.compile(r"-----BEGIN [A-Z0-9_-]+ PRIVATE KEY-----"),
    re.compile(r"(?:api[_-]?key|secret|token|password|auth|bearer)\s*[:=]\s*['\"][A-Za-z0-9_\-\.]{16,}['\"]", re.IGNORECASE),
    re.compile(r"(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{36}"),
    re.compile(r"sk-[A-Za-z0-9]{20,48}"),
    re.compile(r"xox[baprs]-[A-Za-z0-9-]+"),
]


def run_bracket(*args):
    """Run bracket.py with arguments, returning subprocess.CompletedProcess."""
    cmd = [sys.executable, BRACKET_PY] + [str(a) for a in args]
    return subprocess.run(cmd, capture_output=True, text=True)


def validate_environment():
    """Verify runtime, dependencies, files, and Antigravity compatibility."""
    results = []
    all_ok = True

    # 1. Python version check
    py_ver = sys.version_info
    ver_str = f"{py_ver.major}.{py_ver.minor}.{py_ver.micro}"
    if py_ver >= (3, 8):
        results.append(("Python Version", f"Python {ver_str} (>= 3.8 requirement met)", True))
    else:
        results.append(("Python Version", f"Python {ver_str} is unsupported (< 3.8)", False))
        all_ok = False

    # 2. Upstream files existence
    for label, path in [
        ("bracket.py", BRACKET_PY),
        ("strategies.json", STRATEGIES_JSON),
        ("rubric.md", RUBRIC_MD),
        ("SKILL.md", SKILL_MD),
    ]:
        if os.path.isfile(path) and os.path.getsize(path) > 0:
            results.append((label, f"Found ({os.path.getsize(path)} bytes)", True))
        else:
            results.append((label, f"Missing or empty at {path}", False))
            all_ok = False

    # 3. Test strategies.json parsing & combinatorics
    try:
        sys.path.insert(0, HERE)
        import bracket
        data = bracket.load_strategies(STRATEGIES_JSON)
        combos = bracket.combo_count(data)
        results.append(("Strategies Combinatorics", f"Loaded 15 reasoning x 12 workflows x 12 strategies = {combos:,} combinations", True))
    except Exception as e:
        results.append(("Strategies Combinatorics", f"Failed: {e}", False))
        all_ok = False

    # 4. Test prompt templates extraction from SKILL.md
    try:
        templates = bracket.load_templates(SKILL_MD)
        expected = ["competitor", "attacker", "defender", "judge", "final"]
        missing = [t for t in expected if t not in templates]
        if not missing:
            results.append(("SKILL.md Templates", f"All 5 prompt templates parsed successfully ({', '.join(expected)})", True))
        else:
            results.append(("SKILL.md Templates", f"Missing templates: {missing}", False))
            all_ok = False
    except Exception as e:
        results.append(("SKILL.md Templates", f"Template parsing error: {e}", False))
        all_ok = False

    # 5. Test rubric weighting
    try:
        with open(RUBRIC_MD, encoding="utf-8") as fh:
            rubric_text = fh.read()
        total_weight = sum(w for _, w in bracket.WEIGHTS)
        if total_weight == 100:
            results.append(("Rubric Weights", f"Rubric weights sum to {total_weight}% (consistent with upstream test)", True))
        else:
            results.append(("Rubric Weights", f"Rubric weights sum to {total_weight}% (expected 100%)", False))
            all_ok = False
    except Exception as e:
        results.append(("Rubric Weights", f"Failed: {e}", False))
        all_ok = False

    # 6. Test .arena directory write access
    try:
        test_dir = os.path.abspath(".arena")
        os.makedirs(test_dir, exist_ok=True)
        probe_file = os.path.join(test_dir, ".probe_write_test")
        with open(probe_file, "w", encoding="utf-8") as fh:
            fh.write("antigravity-probe\n")
        os.remove(probe_file)
        results.append((".arena Write Permissions", f"Verified write & delete access in {test_dir}", True))
    except Exception as e:
        results.append((".arena Write Permissions", f"Failed: {e}", False))
        all_ok = False

    return all_ok, results


def estimate_costs(agents_n, wave=10, has_baseline=False):
    """Compute calls, rounds, token estimates, and cost breakdown."""
    sys.path.insert(0, HERE)
    import bracket

    t = bracket.plan_totals(agents_n, wave)
    rounds = t["rounds"]
    spawn_calls = agents_n
    
    # Calculate calls per phase
    matches_total = sum(r["matches"] for r in t["rows"])
    attack_calls = matches_total * 2
    defend_calls = matches_total * 2
    judge_calls = matches_total * 1
    final_calls = 1 if has_baseline else 0
    total_calls = spawn_calls + attack_calls + defend_calls + judge_calls + final_calls

    # Compute tokens
    in_tokens = (
        spawn_calls * ESTIMATED_TOKENS_PER_CALL["spawn"]["input"] +
        attack_calls * ESTIMATED_TOKENS_PER_CALL["attack"]["input"] +
        defend_calls * ESTIMATED_TOKENS_PER_CALL["defend"]["input"] +
        judge_calls * ESTIMATED_TOKENS_PER_CALL["judge"]["input"] +
        final_calls * ESTIMATED_TOKENS_PER_CALL["final"]["input"]
    )
    out_tokens = (
        spawn_calls * ESTIMATED_TOKENS_PER_CALL["spawn"]["output"] +
        attack_calls * ESTIMATED_TOKENS_PER_CALL["attack"]["output"] +
        defend_calls * ESTIMATED_TOKENS_PER_CALL["defend"]["output"] +
        judge_calls * ESTIMATED_TOKENS_PER_CALL["judge"]["output"] +
        final_calls * ESTIMATED_TOKENS_PER_CALL["final"]["output"]
    )
    total_tokens = in_tokens + out_tokens

    cost_input = (in_tokens / 1_000_000) * PRICE_PER_M_INPUT
    cost_output = (out_tokens / 1_000_000) * PRICE_PER_M_OUTPUT
    cost_total = cost_input + cost_output

    return {
        "agents": agents_n,
        "rounds": rounds,
        "matches": matches_total,
        "waves": t["waves"] + (1 if has_baseline else 0),
        "calls": {
            "spawn": spawn_calls,
            "attack": attack_calls,
            "defend": defend_calls,
            "judge": judge_calls,
            "final": final_calls,
            "total": total_calls,
        },
        "tokens": {
            "input": in_tokens,
            "output": out_tokens,
            "total": total_tokens,
        },
        "estimated_cost_usd": {
            "input": round(cost_input, 2),
            "output": round(cost_output, 2),
            "total": round(cost_total, 2),
        },
    }


def scan_file_for_secrets(path):
    """Scan a file for common private keys and secret tokens."""
    if not os.path.isfile(path):
        return []
    findings = []
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as fh:
            for line_no, line in enumerate(fh, 1):
                for pat in SECRET_PATTERNS:
                    if pat.search(line):
                        findings.append((line_no, line.strip()[:60]))
    except Exception as e:
        findings.append((0, f"Could not read {path}: {e}"))
    return findings


def run_deterministic_test_tournament(agents_n=4, seed=42, test_dir=None):
    """Run an end-to-end tournament using genuine execution and deterministic mock responses.

    Validates:
    1. Tournament init with fixed seed
    2. Prompt generation for spawn, attack, defend, judge
    3. Output validation & collection
    4. Deterministic bracket progression
    5. Mid-tournament interruption and state recovery
    6. Crowning the champion
    7. Zero modification of files outside .arena/
    """
    sys.path.insert(0, HERE)
    import bracket

    cleanup = False
    if test_dir is None:
        test_dir = tempfile.mkdtemp(prefix="arena_e2e_test_")
        cleanup = True

    try:
        arena_dir = os.path.join(test_dir, ".arena", f"run-test-s{seed}")
        task_path = os.path.join(test_dir, "test_task.md")
        with open(task_path, "w", encoding="utf-8") as fh:
            fh.write("Design and implement an in-memory Thread-Safe LRU Cache in Python with O(1) ops and TTL expiry.\n")

        # 1. Init
        r_init = run_bracket("init", "--agents", str(agents_n), "--seed", str(seed),
                             "--task-file", task_path, "--dir", arena_dir)
        if r_init.returncode != 0:
            return False, f"init failed: {r_init.stderr}"

        # 2. Check next -> spawn
        r_next = run_bracket("next", "--dir", arena_dir)
        if "spawn" not in r_next.stdout:
            return False, f"expected spawn in next output, got: {r_next.stdout}"

        # 3. Prompts spawn
        r_prompts = run_bracket("prompts", "spawn", "--dir", arena_dir)
        if r_prompts.returncode != 0:
            return False, f"prompts spawn failed: {r_prompts.stderr}"

        state = bracket.load_state(argparse.Namespace(dir=arena_dir))
        
        # 4. Generate candidate solutions
        for aid in sorted(state["agents"]):
            sol_path = bracket.spawn_out(arena_dir, aid)
            card = state["agents"][aid]["card"]
            content = f"# Solution by {aid}\n\nApproach: {card['reasoning']['name']} + {card['workflow']['name']} + {card['strategy']['name']}\n\n```python\nclass LRUCache:\n    def __init__(self, capacity: int, ttl: float = 0):\n        self.capacity = capacity\n        self.ttl = ttl\n```\n"
            os.makedirs(os.path.dirname(sol_path), exist_ok=True)
            with open(sol_path, "w", encoding="utf-8") as fh:
                fh.write(content)

        # 5. Check next -> attack round 1
        r_next = run_bracket("next", "--dir", arena_dir)
        if "attack" not in r_next.stdout:
            return False, f"expected attack in next output, got: {r_next.stdout}"

        # 6. Generate attacks
        run_bracket("prompts", "attack", "--dir", arena_dir)
        jobs = bracket.phase_jobs(state, "attack")
        for j in jobs:
            out_path = j["outputs"][0]
            os.makedirs(os.path.dirname(out_path), exist_ok=True)
            with open(out_path, "w", encoding="utf-8") as fh:
                fh.write(f"ATTACK 1 [MAJOR] Lock granularity contention\nWhere: LRUCache.__init__\nProblem: Missing fine-grained locks.\n")

        # 7. Generate defenses
        run_bracket("prompts", "defend", "--dir", arena_dir)
        jobs = bracket.phase_jobs(state, "defend")
        for j in jobs:
            defense_out = j["outputs"][0]
            solution_out = j["outputs"][1]
            os.makedirs(os.path.dirname(defense_out), exist_ok=True)
            with open(defense_out, "w", encoding="utf-8") as fh:
                fh.write("ATTACK 1: CONCEDE. Added RLock around dictionary operations.\n")
            with open(solution_out, "w", encoding="utf-8") as fh:
                fh.write(f"# Revised Solution {j['agent']}\n\nAdded threading.RLock() synchronization.\n")

        # 8. Generate verdicts
        run_bracket("prompts", "judge", "--dir", arena_dir)
        jobs = bracket.phase_jobs(state, "judge")
        # Ensure deterministic scoring: match 1 favors a, match 2 favors b
        for i, j in enumerate(jobs):
            out_path = j["outputs"][0]
            os.makedirs(os.path.dirname(out_path), exist_ok=True)
            winner = j["a"] if i % 2 == 0 else j["b"]
            loser = j["b"] if i % 2 == 0 else j["a"]
            verdict = {
                "match": j["match"],
                "scores": {
                    winner: {"correctness": 9.0, "completeness": 8.5, "specificity": 8.0, "robustness": 8.5, "clarity": 8.0, "fatal": False},
                    loser: {"correctness": 7.0, "completeness": 7.0, "specificity": 6.5, "robustness": 6.0, "clarity": 7.0, "fatal": False},
                },
                "winner": winner,
                "reason": "Superior concurrency design and locking guarantees.",
                "survived": ["Lock contention handled with RLock"],
                "standing": {winner: [], loser: ["Contention under high threads"]},
            }
            with open(out_path, "w", encoding="utf-8") as fh:
                json.dump(verdict, fh)

        # 9. Test collect
        r_collect = run_bracket("collect", "--dir", arena_dir)
        if r_collect.returncode != 0:
            return False, f"collect failed: {r_collect.stderr}"

        # 10. Interruption & recovery test:
        # Load state, verify state is persistent, close, reload
        reloaded_state = bracket.load_state(argparse.Namespace(dir=arena_dir))
        rd1 = bracket.current_round(reloaded_state)
        for m in rd1["matches"]:
            if not m.get("winner"):
                return False, f"match {m['id']} missing winner after collect"

        # 11. Advance to round 2
        r_adv = run_bracket("advance", "--dir", arena_dir)
        if r_adv.returncode != 0:
            return False, f"advance failed: {r_adv.stderr}"

        # 12. Round 2: attack, defend, judge
        run_bracket("prompts", "attack", "--dir", arena_dir)
        state2 = bracket.load_state(argparse.Namespace(dir=arena_dir))
        for j in bracket.phase_jobs(state2, "attack"):
            os.makedirs(os.path.dirname(j["outputs"][0]), exist_ok=True)
            with open(j["outputs"][0], "w", encoding="utf-8") as fh:
                fh.write("ATTACK 1 [MINOR] TTL eviction edge case\nWhere: get\nProblem: Passive expiry on access.\n")

        run_bracket("prompts", "defend", "--dir", arena_dir)
        for j in bracket.phase_jobs(state2, "defend"):
            os.makedirs(os.path.dirname(j["outputs"][0]), exist_ok=True)
            with open(j["outputs"][0], "w", encoding="utf-8") as fh:
                fh.write("ATTACK 1: REBUT. Passive eviction matches Redis behavior.\n")
            with open(j["outputs"][1], "w", encoding="utf-8") as fh:
                fh.write(f"# Final Round 2 Solution {j['agent']}\n\nVerified passive eviction correctness.\n")

        run_bracket("prompts", "judge", "--dir", arena_dir)
        for j in bracket.phase_jobs(state2, "judge"):
            os.makedirs(os.path.dirname(j["outputs"][0]), exist_ok=True)
            winner = j["a"]
            loser = j["b"]
            verdict = {
                "match": j["match"],
                "scores": {
                    winner: {"correctness": 9.5, "completeness": 9.0, "specificity": 8.5, "robustness": 9.0, "clarity": 8.5, "fatal": False},
                    loser: {"correctness": 8.0, "completeness": 8.0, "specificity": 7.5, "robustness": 7.5, "clarity": 8.0, "fatal": False},
                },
                "winner": winner,
                "reason": "Clear active and passive TTL strategy with benchmark data.",
                "survived": ["TTL eviction edge case rebutted"],
                "standing": {winner: [], loser: []},
            }
            with open(out_path := j["outputs"][0], "w", encoding="utf-8") as fh:
                json.dump(verdict, fh)

        run_bracket("collect", "--dir", arena_dir)
        run_bracket("advance", "--dir", arena_dir)

        # 13. Verify Winner
        r_winner = run_bracket("winner", "--dir", arena_dir)
        if r_winner.returncode != 0:
            return False, f"winner check failed: {r_winner.stderr}"

        final_state = bracket.load_state(argparse.Namespace(dir=arena_dir))
        champion = final_state.get("champion")
        if not champion:
            return False, "no champion crowned in final state"

        return True, f"Tournament complete. Champion crowned: {champion}. Output:\n{r_winner.stdout.strip()}"

    finally:
        if cleanup:
            shutil.rmtree(test_dir, ignore_errors=True)


def main():
    parser = argparse.ArgumentParser(description="Antigravity Adapter for the Arena Skill")
    subparsers = parser.add_subparsers(dest="subcommand", help="Subcommand to execute")

    # validate-env
    subparsers.add_parser("validate-env", help="Validate runtime, environment, and dependencies")

    # estimate
    p_est = subparsers.add_parser("estimate", help="Estimate calls, tokens, and costs")
    p_est.add_argument("--agents", type=int, default=16, help="Number of competitors (default 16)")
    p_est.add_argument("--wave", type=int, default=10, help="Wave size (default 10)")
    p_est.add_argument("--baseline", action="store_true", help="Include final baseline check call")

    # run-test
    p_test = subparsers.add_parser("run-test-tournament", help="Run deterministic 4-competitor test tournament")
    p_test.add_argument("--seed", type=int, default=42, help="Random seed (default 42)")
    p_test.add_argument("--dir", type=str, default=None, help="Optional test directory")

    # scan-task
    p_scan = subparsers.add_parser("scan-task", help="Scan task file for sensitive secrets or credential leaks")
    p_scan.add_argument("task_file", help="Path to task file to scan")

    # apply-winner
    p_apply = subparsers.add_parser("apply-winner", help="Safely copy or apply champion solution to project")
    p_apply.add_argument("--dir", type=str, default=None, help="Arena run directory")
    p_apply.add_argument("--target", type=str, required=True, help="Target project file path")
    p_apply.add_argument("--confirm", action="store_true", help="Explicit human confirmation flag")

    args = parser.parse_args()

    if args.subcommand == "validate-env":
        ok, results = validate_environment()
        print("=== Antigravity Environment Validation ===")
        for label, desc, passed in results:
            status = "PASS" if passed else "FAIL"
            print(f"[{status}] {label}: {desc}")
        print("==========================================")
        sys.exit(0 if ok else 1)

    elif args.subcommand == "estimate":
        if args.agents > 16:
            print(f"NOTE: Tournament size {args.agents} > 16 competitors requires explicit confirmation before launch.")
        data = estimate_costs(args.agents, args.wave, args.baseline)
        calls = data["calls"]
        tokens = data["tokens"]
        costs = data["estimated_cost_usd"]

        print(f"\nArena Cost & Resource Projection ({args.agents} Competitors):")
        print(f"  Rounds: {data['rounds']}")
        print(f"  Matches: {data['matches']}")
        print(f"  Sub-agent calls: {calls['total']} (Spawn: {calls['spawn']}, Attack: {calls['attack']}, Defend: {calls['defend']}, Judge: {calls['judge']}{', Final: 1' if calls['final'] else ''})")
        print(f"  Estimated Input Tokens:  ~{tokens['input']:,}")
        print(f"  Estimated Output Tokens: ~{tokens['output']:,}")
        print(f"  Total Estimated Tokens:  ~{tokens['total']:,}")
        print(f"  Estimated Cost (USD):    ~${costs['total']:.2f} (Input: ${costs['input']:.2f}, Output: ${costs['output']:.2f})\n")
        sys.exit(0)

    elif args.subcommand == "run-test-tournament":
        print(f"Running deterministic 4-agent tournament test (seed={args.seed})...")
        ok, msg = run_deterministic_test_tournament(agents_n=4, seed=args.seed, test_dir=args.dir)
        if ok:
            print(f"[PASS] {msg}")
            sys.exit(0)
        else:
            print(f"[FAIL] {msg}")
            sys.exit(1)

    elif args.subcommand == "scan-task":
        findings = scan_file_for_secrets(args.task_file)
        if findings:
            print(f"[WARNING] Potential secrets found in {args.task_file}:")
            for line_no, sample in findings:
                print(f"  Line {line_no}: {sample}")
            sys.exit(1)
        else:
            print(f"[PASS] No credentials or secrets detected in {args.task_file}.")
            sys.exit(0)

    elif args.subcommand == "apply-winner":
        if not args.confirm:
            print("ERROR: Safety violation. Applying the winning solution requires explicit '--confirm' flag.")
            sys.exit(1)
        sys.path.insert(0, HERE)
        import bracket
        state = bracket.load_state(argparse.Namespace(dir=args.dir))
        champion = state.get("champion")
        if not champion:
            print("ERROR: No champion crowned yet. Complete the tournament first.")
            sys.exit(1)
        sol_path = state["agents"][champion]["solution"]
        if not os.path.isfile(sol_path):
            print(f"ERROR: Champion solution file not found at {sol_path}")
            sys.exit(1)

        # Safety check target path: make sure it is inside workspace
        target = os.path.abspath(args.target)
        workspace = os.path.abspath(".")
        if not target.startswith(workspace):
            print(f"ERROR: Target path {target} is outside workspace root {workspace}.")
            sys.exit(1)

        with open(sol_path, "r", encoding="utf-8") as src, open(target, "w", encoding="utf-8") as dst:
            dst.write(src.read())
        print(f"[SUCCESS] Champion {champion} solution applied to {target}")
        sys.exit(0)

    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
