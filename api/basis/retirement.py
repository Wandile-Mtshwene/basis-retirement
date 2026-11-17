"""Retirement outcome projection, in today's money (real terms).

Everything is shown in today's rand so the numbers stay intuitive: the pot grows
through the saving years and is drawn down in retirement, instead of a nominal
figure that balloons with inflation. The real return used is
``(1 + expected_return) / (1 + inflation) - 1``.

Two modes:
  * deterministic (default) - one projected path on the expected real return.
  * monte_carlo - thousands of paths with volatility, summarised as a percentile
    fan with the probability the money lasts.

Two ways to set the drawdown:
  * amount     - a fixed income in today's money (can run the pot out).
  * percentage - a percentage of the remaining balance each year (living-annuity
    style; draws the pot down but never to exactly zero).

A zero-volatility run reproduces the closed-form real future value, which the
tests check.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

PCTILES = {"p5": 5, "p25": 25, "p50": 50, "p75": 75, "p95": 95}


@dataclass
class RetirementProjection:
    mode: str
    withdrawal_type: str
    deterministic: bool
    ages: list[int]
    percentiles: dict[str, list[float]]        # today's money; in deterministic mode all equal
    capital_at_retirement: dict[str, float]
    success_probability: float                 # P(money lasts); 1.0 for percentage drawdown
    depletion_age: int | None
    first_year_income: float                   # today's money
    cashflows: list[float] = field(default_factory=list)  # +contribution / -drawdown per age
    real_return: float = 0.0
    inputs: dict = field(default_factory=dict)
    n_sims: int = 0


def _annual_factors(rng, real_return, volatility, shape):
    """Lognormal real growth factors with mean (1 + real_return)."""
    if volatility <= 0:
        return np.full(shape, 1.0 + real_return)
    sigma = np.log(1.0 + (volatility / (1.0 + real_return)) ** 2) ** 0.5
    mu = np.log(1.0 + real_return) - 0.5 * sigma**2
    return np.exp(rng.normal(mu, sigma, size=shape))


def project_retirement(
    *,
    current_age: int,
    retirement_age: int,
    end_age: int = 95,
    current_savings: float = 0.0,
    annual_contribution: float = 0.0,
    contribution_escalation: float = 0.0,   # real escalation above inflation
    expected_return: float = 0.10,          # nominal
    return_volatility: float = 0.12,
    inflation: float = 0.05,
    withdrawal_type: str = "amount",        # "amount" | "percentage"
    withdrawal_value: float = 400_000.0,    # today's rand (amount) or fraction e.g. 0.05
    mode: str = "deterministic",            # "deterministic" | "monte_carlo"
    n_sims: int = 10_000,
    seed: int | None = 42,
) -> RetirementProjection:
    if not (current_age < retirement_age <= end_age):
        raise ValueError("require current_age < retirement_age <= end_age")

    deterministic = mode != "monte_carlo"
    sims = 1 if deterministic else n_sims
    vol = 0.0 if deterministic else return_volatility
    real_return = (1.0 + expected_return) / (1.0 + inflation) - 1.0

    rng = np.random.default_rng(seed)
    accum_years = retirement_age - current_age
    total_years = end_age - current_age
    ages = list(range(current_age, end_age + 1))

    factors = _annual_factors(rng, real_return, vol, (sims, total_years))
    wealth = np.full(sims, float(current_savings))
    paths = np.zeros((sims, total_years + 1))
    paths[:, 0] = wealth
    depleted_age = np.full(sims, -1)
    capital_vec = wealth.copy()

    for yr in range(total_years):
        age = current_age + yr
        if yr < accum_years:
            contrib = annual_contribution * (1.0 + contribution_escalation) ** yr
            wealth = wealth * factors[:, yr] + contrib
        elif withdrawal_type == "percentage":
            draw = withdrawal_value * wealth
            wealth = np.maximum((wealth - draw) * factors[:, yr], 0.0)
        else:  # fixed real income
            wealth = np.maximum(wealth - withdrawal_value, 0.0) * factors[:, yr]

        newly = (wealth <= 0.0) & (depleted_age < 0)
        depleted_age[newly] = age + 1
        paths[:, yr + 1] = wealth
        if yr + 1 == accum_years:
            capital_vec = wealth.copy()

    fan = np.empty((total_years + 1, len(PCTILES)))
    for ti in range(total_years + 1):
        fan[ti] = np.percentile(paths[:, ti], list(PCTILES.values()))
    percentiles = {k: fan[:, i].round(2).tolist() for i, k in enumerate(PCTILES)}
    capital_at_retirement = {k: float(np.percentile(capital_vec, p)) for k, p in PCTILES.items()}

    ruined = depleted_age >= 0
    if withdrawal_type == "percentage":
        success, depletion = 1.0, None
    else:
        success = float(1.0 - ruined.mean())
        depletion = int(np.median(depleted_age[ruined])) if ruined.any() else None

    first_income = (withdrawal_value * capital_at_retirement["p50"]
                    if withdrawal_type == "percentage" else withdrawal_value)

    # Per-age cashflow: contributions (+) while saving, drawdowns (-) in retirement.
    cashflows = [0.0] * (total_years + 1)
    for yr in range(total_years):
        if yr < accum_years:
            cashflows[yr] = round(annual_contribution * (1.0 + contribution_escalation) ** yr, 2)
        elif withdrawal_type == "percentage":
            median_balance = float(np.percentile(paths[:, yr], 50))
            cashflows[yr] = round(-withdrawal_value * median_balance, 2)
        else:
            cashflows[yr] = round(-withdrawal_value, 2)

    return RetirementProjection(
        mode="deterministic" if deterministic else "monte_carlo",
        withdrawal_type=withdrawal_type,
        deterministic=deterministic,
        ages=ages,
        percentiles=percentiles,
        capital_at_retirement=capital_at_retirement,
        success_probability=round(success, 4),
        depletion_age=depletion,
        first_year_income=round(first_income, 2),
        cashflows=cashflows,
        real_return=round(real_return, 4),
        inputs={
            "current_age": current_age, "retirement_age": retirement_age, "end_age": end_age,
            "current_savings": current_savings, "annual_contribution": annual_contribution,
            "contribution_escalation": contribution_escalation, "expected_return": expected_return,
            "return_volatility": vol, "inflation": inflation,
            "withdrawal_type": withdrawal_type, "withdrawal_value": withdrawal_value,
        },
        n_sims=sims,
    )
