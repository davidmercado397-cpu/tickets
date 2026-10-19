from datetime import datetime, time, timezone
from zoneinfo import ZoneInfo

from app.modules.sla.calendar import Calendar, sla_state

BOG = ZoneInfo("America/Bogota")


def at(y, m, d, h=10, mi=0):
    return datetime(y, m, d, h, mi, tzinfo=BOG).astimezone(timezone.utc)


def test_business_days_skip_weekend_and_colombian_holidays():
    cal = Calendar()
    # Viernes 9-oct-2026 → el lunes 12-oct es festivo (Día de la Raza): cuenta desde el martes 13.
    due = cal.add(at(2026, 10, 9), 1, "business_days").astimezone(BOG)
    assert due.date().isoformat() == "2026-10-13"
    assert due.time() == time(17, 0)


def test_fifteen_business_days():
    cal = Calendar()
    due = cal.add(at(2026, 10, 1), 15, "business_days").astimezone(BOG)
    # Oct-2026: festivo el 12. Del 2 al 23 hay 15 días hábiles.
    assert due.date().isoformat() == "2026-10-23"


def test_business_hours_roll_to_next_day():
    cal = Calendar()
    due = cal.add(at(2026, 10, 8, 16, 0), 4, "business_hours").astimezone(BOG)
    # 1 h el jueves (16→17) + 3 h el viernes (8→11).
    assert (due.date().isoformat(), due.time()) == ("2026-10-09", time(11, 0))


def test_custom_holiday_and_pause_extension():
    cal = Calendar(custom_holidays=frozenset({datetime(2026, 10, 14).date()}))
    assert not cal.is_business_day(datetime(2026, 10, 14).date())
    due = at(2026, 10, 20, 17, 0)
    extended = cal.extend(due, at(2026, 10, 15, 8, 0), at(2026, 10, 15, 17, 0), "business_days")
    # 9 h hábiles en pausa → el vencimiento se corre un día hábil completo.
    assert extended.astimezone(BOG).date().isoformat() == "2026-10-21"


def test_sla_state_traffic_light():
    created, due = at(2026, 10, 1), at(2026, 10, 11)
    assert sla_state(created_at=created, due_at=due, resolved_at=None, now=at(2026, 10, 2)) == "on_time"
    assert sla_state(created_at=created, due_at=due, resolved_at=None, now=at(2026, 10, 10)) == "at_risk"
    assert sla_state(created_at=created, due_at=due, resolved_at=None, now=at(2026, 10, 12)) == "overdue"
    assert sla_state(created_at=created, due_at=due, resolved_at=at(2026, 10, 5), now=at(2026, 10, 12)) == "met"
    assert sla_state(created_at=created, due_at=due, resolved_at=at(2026, 10, 15), now=at(2026, 10, 16)) == "missed"
