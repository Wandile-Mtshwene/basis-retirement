"""Monte Carlo retirement outcome projection.

Simulates a saver through an accumulation phase (contributions + stochastic
investment growth) and a decumulation phase (inflation-linked income drawdown),
then summarises the distribution of outcomes: the fan of wealth over time, the
spread of capital at retirement, and the probability of the money lasting.

Investment returns are modelled as lognormal annual factors calibrated so the
expected simple return matches ``expected_return`` with standard deviation
``return_volatility``.  Working in nominal terms keeps contributions, growth and
inflation-linked income on the same footing.

A deterministic run (``return_volatility = 0``) reproduces the closed-form
future value, which is exactly what the test-suite checks.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

PCTILES = {"p5": 5, "p25": 25, "p50": 50, "p75": 75, "p95": 95}


@dataclass
class RetirementProjection:
    ages: list[int]
    percentiles: dict[str, list[float]]        # wealth fan by age
    capital_at_retirement: dict[str, float]    # percentiles of retirement pot
    success_probability: float                 # P(money lasts to end_age)
    probability_of_ruin: float
    median_depletion_age: int | None
    target_income_first_year: float            # nominal income drawn in year 1 of retirement
    inputs: dict = field(default_factory=dict)
    n_sims: int = 0


def _annual_factors(rng, expected_return, volatility, shape):
    """Lognormal annual growth factors with mean (1+expected_return)."""
    if volatility <= 0:
        return np.full(shape, 1.0 + expected_return)
    sigma = np.log(1.0 + (volatility / (1.0 + expected_return)) ** 2) ** 0.5
    mu = np.log(1.0 + expected_return) - 0.5 * sigma**2
    return np.exp(rng.normal(mu, sigma, size=shape))


def project_retirement(
    *,
    current_age: int,
    retirement_age: int,
    end_age: int = 95,
    current_savings: float = 0.0,
    annual_contribution: float = 0.0,
    contribution_escalation: float = 0.05,
    expected_return: float = 0.10,
    return_volatility: float = 0.12,
    inflation: float = 0.05,
    target_income: float = 0.0,     # desired retirement income per year, in today's money
    n_sims: int = 10_000,
    seed: int | None = 42,
) -> RetirementProjection:
    if not (current_age < retirement_age <= end_age):
        raise ValueError("require current_age < retirement_age <= end_age")

    rng = np.random.default_rng(seed)
    accum_years = retirement_age - current_age
    total_years = end_age - current_age
    ages = list(range(current_age, end_age + 1))

    factors = _annual_factors(rng, expected_return, return_volatility, (n_sims, total_years))

    wealth = np.full(n_sims, float(current_savings))
    fan = np.empty((total_years + 1, len(PCTILES)))
    fan[0] = np.percentile(wealth, list(PCTILES.values()))

    depleted_age = np.full(n_sims, -1)          # age at which a path first hit zero
    capital_at_retirement = None

    for yr in range(total_years):
        age = current_age + yr
        if yr < accum_years:
            # accumulation: grow, then add this year's escalating contribution
            contrib = annual_contribution * (1.0 + contribution_escalation) ** yr
            wealth = wealth * factors[:, yr] + contrib
        else:
            # decumulation: draw inflation-linked income at the start, then grow
            years_from_now = yr
            draw = target_income * (1.0 + inflation) ** years_from_now
            wealth = np.maximum(wealth - draw, 0.0) * factors[:, yr]

        newly_depleted = (wealth <= 0.0) & (depleted_age < 0)
        depleted_age[newly_depleted] = age + 1

        fan[yr + 1] = np.percentile(wealth, list(PCTILES.values()))
        if yr + 1 == accum_years:
            capital_at_retirement = {
                k: float(np.percentile(wealth, p)) for k, p in PCTILES.items()
            }

    percentiles = {k: fan[:, i].round(2).tolist() for i, k in enumerate(PCTILES)}
    ruined = depleted_age >= 0
    prob_ruin = float(ruined.mean())
    med_depletion = int(np.median(depleted_age[ruined])) if ruined.any() else None

    return RetirementProjection(
        ages=ages,
        percentiles=percentiles,
        capital_at_retirement=capital_at_retirement or {},
        success_probability=round(1.0 - prob_ruin, 4),
        probability_of_ruin=round(prob_ruin, 4),
        median_depletion_age=med_depletion,
        target_income_first_year=round(target_income * (1.0 + inflation) ** accum_years, 2),
        inputs={
            "current_age": current_age, "retirement_age": retirement_age, "end_age": end_age,
            "current_savings": current_savings, "annual_contribution": annual_contribution,
            "contribution_escalation": contribution_escalation, "expected_return": expected_return,
            "return_volatility": return_volatility, "inflation": inflation,
            "target_income": target_income,
        },
        n_sims=n_sims,
    )
