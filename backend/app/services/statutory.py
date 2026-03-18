"""
Indian statutory payroll calculations — EPF, ESI, TDS, Professional Tax, Gratuity.
"""

from decimal import Decimal, ROUND_HALF_UP

Q = Decimal("0.01")


# ── EPF (Employee Provident Fund) ────────────────────────────────────────────
EPF_EMPLOYEE_RATE = Decimal("0.12")  # 12% of basic + DA
EPF_EMPLOYER_RATE = Decimal("0.12")
EPF_WAGE_CEILING  = Decimal("15000")  # Monthly ceiling for EPF


def calculate_epf(basic: Decimal, da: Decimal = Decimal("0")) -> dict:
    """Calculate EPF contributions. Capped at ₹15,000 basic+DA."""
    epf_wages = min(basic + da, EPF_WAGE_CEILING)
    employee = (epf_wages * EPF_EMPLOYEE_RATE).quantize(Q, ROUND_HALF_UP)
    employer = (epf_wages * EPF_EMPLOYER_RATE).quantize(Q, ROUND_HALF_UP)
    return {"employee": employee, "employer": employer, "wages": epf_wages}


# ── ESI (Employee State Insurance) ──────────────────────────────────────────
ESI_EMPLOYEE_RATE = Decimal("0.0075")   # 0.75%
ESI_EMPLOYER_RATE = Decimal("0.0325")   # 3.25%
ESI_GROSS_CEILING = Decimal("21000")    # Monthly gross ceiling


def calculate_esi(gross: Decimal) -> dict:
    """Calculate ESI contributions. Only applicable if gross <= ₹21,000."""
    if gross > ESI_GROSS_CEILING:
        return {"employee": Decimal("0"), "employer": Decimal("0"), "applicable": False}
    employee = (gross * ESI_EMPLOYEE_RATE).quantize(Q, ROUND_HALF_UP)
    employer = (gross * ESI_EMPLOYER_RATE).quantize(Q, ROUND_HALF_UP)
    return {"employee": employee, "employer": employer, "applicable": True}


# ── Professional Tax (state-wise) ───────────────────────────────────────────
# Simplified: Karnataka/Maharashtra/Telangana-style slabs
PT_SLABS = [
    (Decimal("15000"), Decimal("0")),
    (Decimal("20000"), Decimal("150")),
    (Decimal("999999999"), Decimal("200")),
]


def calculate_professional_tax(gross_monthly: Decimal) -> Decimal:
    """Calculate monthly professional tax based on gross salary slab."""
    for ceiling, tax in PT_SLABS:
        if gross_monthly <= ceiling:
            return tax
    return Decimal("200")


# ── TDS (Tax Deducted at Source) ─────────────────────────────────────────────
# FY 2024-25 New Regime slabs (default)
NEW_REGIME_SLABS = [
    (Decimal("300000"),  Decimal("0")),
    (Decimal("700000"),  Decimal("0.05")),
    (Decimal("1000000"), Decimal("0.10")),
    (Decimal("1200000"), Decimal("0.15")),
    (Decimal("1500000"), Decimal("0.20")),
    (Decimal("999999999"), Decimal("0.30")),
]

# Old Regime slabs
OLD_REGIME_SLABS = [
    (Decimal("250000"),  Decimal("0")),
    (Decimal("500000"),  Decimal("0.05")),
    (Decimal("1000000"), Decimal("0.20")),
    (Decimal("999999999"), Decimal("0.30")),
]

STANDARD_DEDUCTION = Decimal("75000")  # New regime FY 2024-25
CESS_RATE = Decimal("0.04")  # 4% health & education cess


def calculate_annual_tax(
    annual_gross: Decimal,
    regime: str = "new",
    section_80c: Decimal = Decimal("0"),
    hra_exempt: Decimal = Decimal("0"),
    other_deductions: Decimal = Decimal("0"),
) -> Decimal:
    """Calculate annual income tax for given regime."""
    slabs = NEW_REGIME_SLABS if regime == "new" else OLD_REGIME_SLABS

    # Taxable income
    taxable = annual_gross - STANDARD_DEDUCTION
    if regime == "old":
        taxable -= min(section_80c, Decimal("150000"))  # 80C cap
        taxable -= hra_exempt
        taxable -= other_deductions
    taxable = max(taxable, Decimal("0"))

    # Calculate tax
    tax = Decimal("0")
    prev_ceiling = Decimal("0")
    for ceiling, rate in slabs:
        if taxable <= prev_ceiling:
            break
        slab_amount = min(taxable, ceiling) - prev_ceiling
        tax += (slab_amount * rate).quantize(Q, ROUND_HALF_UP)
        prev_ceiling = ceiling

    # Add cess
    tax += (tax * CESS_RATE).quantize(Q, ROUND_HALF_UP)

    # Rebate u/s 87A: if taxable income <= 7L (new) or 5L (old), tax = 0
    rebate_limit = Decimal("700000") if regime == "new" else Decimal("500000")
    if taxable <= rebate_limit:
        tax = Decimal("0")

    return tax


def calculate_monthly_tds(
    annual_gross: Decimal,
    months_remaining: int = 12,
    tds_paid_ytd: Decimal = Decimal("0"),
    regime: str = "new",
    **kwargs,
) -> Decimal:
    """Calculate monthly TDS based on annual projection."""
    annual_tax = calculate_annual_tax(annual_gross, regime, **kwargs)
    remaining_tax = max(annual_tax - tds_paid_ytd, Decimal("0"))
    if months_remaining <= 0:
        return Decimal("0")
    monthly = (remaining_tax / months_remaining).quantize(Q, ROUND_HALF_UP)
    return monthly


# ── Gratuity ─────────────────────────────────────────────────────────────────
def calculate_gratuity(last_drawn_salary: Decimal, years_of_service: int) -> Decimal:
    """Gratuity = 15/26 * last drawn salary * years of service."""
    if years_of_service < 5:
        return Decimal("0")
    gratuity = (Decimal("15") / Decimal("26") * last_drawn_salary * years_of_service).quantize(Q, ROUND_HALF_UP)
    return min(gratuity, Decimal("2000000"))  # Max ₹20 lakh


# ── Full statutory calculation ───────────────────────────────────────────────
def calculate_all_statutory(
    basic: Decimal,
    gross: Decimal,
    annual_gross: Decimal,
    months_remaining: int = 12,
    tds_paid_ytd: Decimal = Decimal("0"),
    regime: str = "new",
) -> dict:
    """Calculate all statutory deductions for a month."""
    epf = calculate_epf(basic)
    esi = calculate_esi(gross)
    pt = calculate_professional_tax(gross)
    tds = calculate_monthly_tds(annual_gross, months_remaining, tds_paid_ytd, regime)

    total_employee = epf["employee"] + esi["employee"] + pt + tds
    total_employer = epf["employer"] + esi["employer"]

    return {
        "epf_employee": epf["employee"],
        "epf_employer": epf["employer"],
        "esi_employee": esi["employee"],
        "esi_employer": esi["employer"],
        "professional_tax": pt,
        "tds": tds,
        "total_employee_statutory": total_employee,
        "total_employer_statutory": total_employer,
    }
