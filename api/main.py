"""Retirement Outcome Illustrator - FastAPI service."""
from __future__ import annotations

from dataclasses import asdict
from typing import Literal

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from basis.retirement import project_retirement

app = FastAPI(title="Retirement Outcome Illustrator", version="1.0.0",
    docs_url="/api/docs", openapi_url="/api/openapi.json",
    description="Monte Carlo projection of retirement savings and drawdown.")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
router = APIRouter(prefix="/api")


@router.get("/health", tags=["meta"])
def health() -> dict:
    return {"status": "ok", "service": "basis-retirement"}


class RetirementRequest(BaseModel):
    current_age: int = Field(40, ge=18, le=74)
    retirement_age: int = Field(65, ge=45, le=75)
    end_age: int = Field(95, ge=75, le=110)
    current_savings: float = Field(500_000, ge=0)
    annual_contribution: float = Field(120_000, ge=0)
    contribution_escalation: float = Field(0.05, ge=0, le=0.2)
    expected_return: float = Field(0.10, ge=0, le=0.3)
    return_volatility: float = Field(0.12, ge=0, le=0.5)
    inflation: float = Field(0.05, ge=0, le=0.2)
    target_income: float = Field(300_000, ge=0)
    n_sims: int = Field(10_000, ge=500, le=50_000)


@router.post("/retirement/project", tags=["pricing"])
def retirement(req: RetirementRequest) -> dict:
    if req.retirement_age <= req.current_age or req.end_age < req.retirement_age:
        from fastapi import HTTPException
        raise HTTPException(422, "need current_age < retirement_age <= end_age")
    return project_retirement(**req.model_dump()).__dict__

app.include_router(router)
