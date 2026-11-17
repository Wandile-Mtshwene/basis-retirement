"""Retirement engine: real-terms deterministic benchmark + mode/drawdown behaviour."""

import pytest

from basis import project_retirement

REAL_RETURN = (1.10) / (1.05) - 1.0   # expected_return 10% nominal, inflation 5%


def closed_form_capital(current_savings, C, esc, rr, A):
    fv = current_savings * (1 + rr) ** A
    for yr in range(A):
        fv += C * (1 + esc) ** yr * (1 + rr) ** (A - 1 - yr)
    return fv


def test_deterministic_matches_real_closed_form():
    p = project_retirement(current_age=40, retirement_age=65, current_savings=500_000,
                           annual_contribution=120_000, contribution_escalation=0.0,
                           expected_return=0.10, inflation=0.05,
                           withdrawal_type="amount", withdrawal_value=0, mode="deterministic")
    expected = closed_form_capital(500_000, 120_000, 0.0, REAL_RETURN, 25)
    assert p.capital_at_retirement["p50"] == pytest.approx(expected, rel=1e-6)
    assert p.real_return == pytest.approx(REAL_RETURN, abs=1e-4)


def test_deterministic_has_no_spread():
    p = project_retirement(current_age=40, retirement_age=65, current_savings=500_000,
                           annual_contribution=120_000, mode="deterministic")
    assert p.capital_at_retirement["p5"] == pytest.approx(p.capital_at_retirement["p95"], rel=1e-9)
    assert p.n_sims == 1


def test_monte_carlo_has_spread():
    p = project_retirement(current_age=40, retirement_age=65, current_savings=500_000,
                           annual_contribution=120_000, mode="monte_carlo", n_sims=3000)
    c = p.capital_at_retirement
    assert c["p95"] > c["p50"] > c["p5"]
    assert p.n_sims == 3000


def test_pot_draws_down_in_retirement():
    p = project_retirement(current_age=40, retirement_age=65, current_savings=500_000,
                           annual_contribution=120_000, withdrawal_type="amount",
                           withdrawal_value=400_000, mode="deterministic")
    at_retirement = p.percentiles["p50"][p.ages.index(65)]
    at_end = p.percentiles["p50"][-1]
    assert at_end < at_retirement        # draws down, not grows


def test_higher_withdrawal_can_deplete():
    low = project_retirement(current_age=40, retirement_age=65, current_savings=500_000,
                             annual_contribution=120_000, withdrawal_value=400_000)
    high = project_retirement(current_age=40, retirement_age=65, current_savings=500_000,
                              annual_contribution=120_000, withdrawal_value=1_200_000)
    assert high.success_probability < low.success_probability


def test_percentage_drawdown_never_depletes():
    p = project_retirement(current_age=40, retirement_age=65, current_savings=500_000,
                           annual_contribution=120_000, withdrawal_type="percentage",
                           withdrawal_value=0.05)
    assert p.success_probability == 1.0
    assert p.depletion_age is None
    assert p.first_year_income == pytest.approx(0.05 * p.capital_at_retirement["p50"], rel=1e-6)


def test_shapes_and_reproducible():
    kw = dict(current_age=30, retirement_age=65, end_age=90, current_savings=100_000,
              annual_contribution=50_000, withdrawal_value=300_000, mode="monte_carlo", n_sims=1000)
    a = project_retirement(**kw)
    b = project_retirement(**kw)
    assert len(a.ages) == len(a.percentiles["p50"]) == 61
    assert a.percentiles["p50"] == b.percentiles["p50"]


def test_invalid_ages_raise():
    with pytest.raises(ValueError):
        project_retirement(current_age=70, retirement_age=65)
