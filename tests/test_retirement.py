"""Monte Carlo retirement engine: deterministic benchmark + distribution behaviour."""

import pytest

from basis import project_retirement


def closed_form_capital(current_savings, C, g, r, A):
    """Future value at retirement with no volatility: savings compounded plus
    year-end escalating contributions, matching the engine's recursion."""
    fv = current_savings * (1 + r) ** A
    for yr in range(A):
        fv += C * (1 + g) ** yr * (1 + r) ** (A - 1 - yr)
    return fv


def test_zero_volatility_matches_closed_form():
    kw = dict(current_age=40, retirement_age=65, current_savings=500_000,
              annual_contribution=120_000, contribution_escalation=0.05,
              expected_return=0.10, return_volatility=0.0, inflation=0.05,
              target_income=0, n_sims=200)
    proj = project_retirement(**kw)
    expected = closed_form_capital(500_000, 120_000, 0.05, 0.10, 25)
    assert proj.capital_at_retirement["p50"] == pytest.approx(expected, rel=1e-6)
    # with no volatility every percentile collapses to the same value
    assert proj.capital_at_retirement["p5"] == pytest.approx(proj.capital_at_retirement["p95"], rel=1e-9)


def test_higher_expected_return_grows_more():
    base = dict(current_age=35, retirement_age=65, current_savings=200_000,
                annual_contribution=60_000, return_volatility=0.12, n_sims=3000, seed=1)
    low = project_retirement(expected_return=0.07, **base).capital_at_retirement["p50"]
    high = project_retirement(expected_return=0.12, **base).capital_at_retirement["p50"]
    assert high > low


def test_more_volatility_widens_the_fan():
    base = dict(current_age=35, retirement_age=65, current_savings=200_000,
                annual_contribution=60_000, expected_return=0.10, n_sims=5000, seed=7)
    def spread(vol):
        c = project_retirement(return_volatility=vol, **base).capital_at_retirement
        return c["p95"] - c["p5"]
    assert spread(0.18) > spread(0.06)


def test_generous_plan_succeeds_modest_plan_can_ruin():
    strong = project_retirement(
        current_age=40, retirement_age=65, end_age=95, current_savings=2_000_000,
        annual_contribution=200_000, expected_return=0.10, return_volatility=0.1,
        inflation=0.05, target_income=150_000, n_sims=4000)
    weak = project_retirement(
        current_age=40, retirement_age=65, end_age=95, current_savings=100_000,
        annual_contribution=20_000, expected_return=0.08, return_volatility=0.14,
        inflation=0.06, target_income=400_000, n_sims=4000)
    assert strong.success_probability > weak.success_probability
    assert weak.probability_of_ruin > 0.0
    assert 0.0 <= strong.success_probability <= 1.0


def test_output_shapes_and_reproducibility():
    kw = dict(current_age=30, retirement_age=65, end_age=90,
              current_savings=100_000, annual_contribution=50_000,
              target_income=250_000, n_sims=1000, seed=123)
    a = project_retirement(**kw)
    b = project_retirement(**kw)
    assert a.ages[0] == 30 and a.ages[-1] == 90
    assert len(a.ages) == len(a.percentiles["p50"]) == 61
    assert a.percentiles["p50"] == b.percentiles["p50"]        # deterministic by seed
    assert a.success_probability == b.success_probability


def test_invalid_ages_raise():
    with pytest.raises(ValueError):
        project_retirement(current_age=70, retirement_age=65)
