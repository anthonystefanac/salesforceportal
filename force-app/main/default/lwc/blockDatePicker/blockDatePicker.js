import { LightningElement, api } from 'lwc';

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function toIso(year, month, day) {
    const mm = String(month + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return `${year}-${mm}-${dd}`;
}

function todayIso() {
    const now = new Date();
    return toIso(now.getFullYear(), now.getMonth(), now.getDate());
}

function formatChipLabel(iso) {
    const [year, month, day] = iso.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('en-AU', {
        weekday: 'short',
        day: 'numeric',
        month: 'short'
    });
}

/**
 * Lets a Request Staff submission cover a "block" of shifts - the same
 * Facility/Role/Times/etc, across any number of (not necessarily
 * consecutive) dates - by picking them off a month calendar instead of one
 * lightning-input[type=date] per shift. Reuses requestStaffCalendar's own
 * month-grid math (see that component), adapted here for multi-select
 * (click toggles a day in/out of selectedDates) instead of read-only
 * booking display.
 */
export default class BlockDatePicker extends LightningElement {
    weekdayLabels = WEEKDAY_LABELS;
    currentYear;
    currentMonth;
    selectedDates = [];

    connectedCallback() {
        // Guarded rather than unconditional: a defaultDate set by the
        // parent (e.g. requestStaffCalendar's chosen day, carried through
        // requestStaffForm) can run its setter before this lifecycle hook
        // fires, and that setter already picks the right month to jump to -
        // this must not then stomp back over it with "today".
        if (this.currentYear === undefined) {
            const today = new Date();
            this.currentYear = today.getFullYear();
            this.currentMonth = today.getMonth();
        }
    }

    _defaultDate;

    /**
     * Set by requestStaffForm (itself set by requestStaffCalendar's chosen
     * day, or page state) to pre-select one date and jump the visible month
     * to it. A setter, not a plain field, so picking a different Calendar
     * day while this component stays mounted adds that date too, live.
     */
    @api
    get defaultDate() {
        return this._defaultDate;
    }

    set defaultDate(value) {
        this._defaultDate = value;
        if (!value) {
            return;
        }
        const [year, month] = value.split('-').map(Number);
        this.currentYear = year;
        this.currentMonth = month - 1;
        if (!this.selectedDates.includes(value)) {
            this.selectedDates = [...this.selectedDates, value].sort();
            this.notifyChange();
        }
    }

    // Lets the parent clear the whole selection after a successful submit,
    // without needing to know anything about this component's internal
    // month/selection state.
    @api
    clearSelection() {
        this.selectedDates = [];
        this.notifyChange();
    }

    // Lets the parent drop just the dates that already succeeded after a
    // partial submit failure, leaving the still-failed ones selected so a
    // retry doesn't re-submit (and duplicate) the ones that went through.
    @api
    removeDates(datesToRemove) {
        const removeSet = new Set(datesToRemove);
        this.selectedDates = this.selectedDates.filter((iso) => !removeSet.has(iso));
        this.notifyChange();
    }

    get monthLabel() {
        return new Date(this.currentYear, this.currentMonth, 1).toLocaleDateString('en-AU', {
            month: 'long',
            year: 'numeric'
        });
    }

    get hasSelectedDates() {
        return this.selectedDates.length > 0;
    }

    get selectedCountLabel() {
        const count = this.selectedDates.length;
        return count === 1 ? '1 date selected' : `${count} dates selected`;
    }

    get selectedDateChips() {
        return this.selectedDates.map((iso) => ({ iso, label: formatChipLabel(iso) }));
    }

    get calendarWeeks() {
        const year = this.currentYear;
        const month = this.currentMonth;
        const firstOfMonth = new Date(year, month, 1);
        // Convert JS's Sunday-is-0 into a Monday-first week, matching
        // requestStaffCalendar.
        const startWeekday = (firstOfMonth.getDay() + 6) % 7;
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const today = todayIso();

        const cells = [];
        for (let i = 0; i < startWeekday; i++) {
            cells.push({ key: `blank-lead-${i}`, isBlank: true });
        }
        for (let day = 1; day <= daysInMonth; day++) {
            const iso = toIso(year, month, day);
            const isPast = iso < today;
            const isSelected = this.selectedDates.includes(iso);
            let cssClass = 'block-date-picker__day';
            if (iso === today) {
                cssClass += ' block-date-picker__day_today';
            }
            if (isSelected) {
                cssClass += ' block-date-picker__day_selected';
            }
            if (isPast) {
                cssClass += ' block-date-picker__day_disabled';
            }
            cells.push({
                key: iso,
                iso,
                day,
                isPast,
                cssClass,
                isBlank: false
            });
        }
        while (cells.length % 7 !== 0) {
            cells.push({ key: `blank-trail-${cells.length}`, isBlank: true });
        }

        const weeks = [];
        for (let i = 0; i < cells.length; i += 7) {
            weeks.push({ key: `week-${i}`, days: cells.slice(i, i + 7) });
        }
        return weeks;
    }

    handlePrevMonth() {
        this.changeMonth(-1);
    }

    handleNextMonth() {
        this.changeMonth(1);
    }

    changeMonth(delta) {
        let month = this.currentMonth + delta;
        let year = this.currentYear;
        if (month < 0) {
            month = 11;
            year -= 1;
        } else if (month > 11) {
            month = 0;
            year += 1;
        }
        this.currentMonth = month;
        this.currentYear = year;
    }

    handleToday() {
        const today = new Date();
        this.currentYear = today.getFullYear();
        this.currentMonth = today.getMonth();
    }

    handleToggleDay(event) {
        const iso = event.currentTarget.dataset.date;
        // Belt-and-suspenders: past days are already rendered disabled
        // (see calendarWeeks), but guard here too in case a future change
        // ever lets a disabled button's click through.
        if (iso < todayIso()) {
            return;
        }
        if (this.selectedDates.includes(iso)) {
            this.selectedDates = this.selectedDates.filter((d) => d !== iso);
        } else {
            this.selectedDates = [...this.selectedDates, iso].sort();
        }
        this.notifyChange();
    }

    handleRemoveChip(event) {
        const iso = event.currentTarget.dataset.date;
        this.selectedDates = this.selectedDates.filter((d) => d !== iso);
        this.notifyChange();
    }

    handleClearAll() {
        this.selectedDates = [];
        this.notifyChange();
    }

    notifyChange() {
        this.dispatchEvent(new CustomEvent('datechange', { detail: { dates: [...this.selectedDates] } }));
    }
}
