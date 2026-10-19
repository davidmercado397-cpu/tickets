"""Cálculo de tiempos hábiles (puro, sin BD): vencimientos, pausas y semáforo.

Regla de días hábiles (Ley 1755): el término se cuenta desde el día hábil SIGUIENTE a la radicación,
y vence al cierre de la jornada del último día. Las horas hábiles solo corren dentro del horario
laboral de los días hábiles."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime, time, timedelta, timezone
from functools import lru_cache
from zoneinfo import ZoneInfo

UNITS = ("business_days", "business_hours", "calendar_days", "calendar_hours")
BUSINESS_UNITS = {"business_days", "business_hours"}


@lru_cache(maxsize=64)
def national_holidays(country: str, year: int) -> dict[date, str]:
    import holidays

    try:
        return dict(holidays.country_holidays(country, years=year, language="es"))
    except Exception:  # noqa: BLE001 - idioma no disponible
        return dict(holidays.country_holidays(country, years=year))


@dataclass
class Calendar:
    tz: str = "America/Bogota"
    workdays: frozenset[int] = frozenset({0, 1, 2, 3, 4})  # lunes=0
    work_start: time = time(8, 0)
    work_end: time = time(17, 0)
    country: str | None = "CO"
    custom_holidays: frozenset[date] = field(default_factory=frozenset)

    @property
    def zone(self) -> ZoneInfo:
        return ZoneInfo(self.tz)

    def is_holiday(self, d: date) -> bool:
        if d in self.custom_holidays:
            return True
        return bool(self.country) and d in national_holidays(self.country, d.year)

    def is_business_day(self, d: date) -> bool:
        return d.weekday() in self.workdays and not self.is_holiday(d)

    def _local(self, dt: datetime) -> datetime:
        return dt.astimezone(self.zone)

    def _at(self, d: date, t: time) -> datetime:
        return datetime.combine(d, t, tzinfo=self.zone)

    def next_business_day(self, d: date) -> date:
        d += timedelta(days=1)
        for _ in range(400):
            if self.is_business_day(d):
                return d
            d += timedelta(days=1)
        raise ValueError("Calendario sin días hábiles.")

    # --- Sumas ---

    def add_business_days(self, start: datetime, days: int) -> datetime:
        d = self._local(start).date()
        for _ in range(max(days, 0)):
            d = self.next_business_day(d)
        if days <= 0 and not self.is_business_day(d):
            d = self.next_business_day(d)
        return self._at(d, self.work_end).astimezone(timezone.utc)

    def add_business_minutes(self, start: datetime, minutes: int) -> datetime:
        cur = self._local(start)
        remaining = max(minutes, 0)
        for _ in range(5000):
            d = cur.date()
            if self.is_business_day(d):
                win_start, win_end = self._at(d, self.work_start), self._at(d, self.work_end)
                if cur < win_start:
                    cur = win_start
                if cur < win_end:
                    available = int((win_end - cur).total_seconds() // 60)
                    if remaining <= available:
                        return (cur + timedelta(minutes=remaining)).astimezone(timezone.utc)
                    remaining -= available
            cur = self._at(d + timedelta(days=1), self.work_start)
        raise ValueError("No se pudo calcular el vencimiento (calendario inválido).")

    def add(self, start: datetime, value: int, unit: str) -> datetime:
        if unit == "business_days":
            return self.add_business_days(start, value)
        if unit == "business_hours":
            return self.add_business_minutes(start, value * 60)
        if unit == "calendar_days":
            return start + timedelta(days=value)
        if unit == "calendar_hours":
            return start + timedelta(hours=value)
        raise ValueError(f"Unidad desconocida: {unit}")

    # --- Diferencias (para pausas) ---

    def business_minutes_between(self, a: datetime, b: datetime) -> int:
        if b <= a:
            return 0
        a_l, b_l = self._local(a), self._local(b)
        total = 0
        d = a_l.date()
        while d <= b_l.date():
            if self.is_business_day(d):
                lo = max(a_l, self._at(d, self.work_start))
                hi = min(b_l, self._at(d, self.work_end))
                if hi > lo:
                    total += int((hi - lo).total_seconds() // 60)
            d += timedelta(days=1)
        return total

    def extend(self, due: datetime, paused_from: datetime, paused_to: datetime, unit: str) -> datetime:
        """Corre el vencimiento lo que duró la pausa, medido en la misma clase de tiempo."""
        if unit in BUSINESS_UNITS:
            return self.add_business_minutes(due, self.business_minutes_between(paused_from, paused_to))
        return due + (paused_to - paused_from)


def sla_state(
    *,
    created_at: datetime,
    due_at: datetime | None,
    resolved_at: datetime | None,
    now: datetime,
    warning_percent: int = 80,
) -> str | None:
    """met | missed (cerrados) · on_time | at_risk | overdue (abiertos). Nunca bloquea el caso."""
    if due_at is None:
        return None
    if resolved_at is not None:
        return "met" if resolved_at <= due_at else "missed"
    if now > due_at:
        return "overdue"
    span = (due_at - created_at).total_seconds()
    if span > 0 and (now - created_at).total_seconds() / span * 100 >= warning_percent:
        return "at_risk"
    return "on_time"
