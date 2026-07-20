import { LightningElement, wire } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import getMyRequests from '@salesforce/apex/StaffingRequestController.getMyRequests';

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function toIso(year, month, day) {
    const mm = String(month + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return `${year}-${mm}-${dd}`;
}

export default class RequestStaffCalendar extends LightningElement {
    weekdayLabels = WEEKDAY_LABELS;
    currentYear;
    currentMonth;
    selectedDate;
    requestCountsByDate = {};
    wiredRequestsResult;

    connectedCallback() {
        const today = new Date();
        this.currentYear = today.getFullYear();
        this.currentMonth = today.getMonth();
    }

    @wire(getMyRequests)
    wiredRequests(result) {
        this.wiredRequestsResult = result;
        if (result.data) {
            this.requestCountsByDate = result.data.reduce((counts, request) => {
                const iso = request.Shift_Date__c;
                if (iso) {
                    counts[iso] = (counts[iso] || 0) + 1;
                }
                return counts;
            }, {});
        }
    }

    get monthLabel() {
        return new Date(this.currentYear, this.currentMonth, 1).toLocaleDateString('en-AU', {
            month: 'long',
            year: 'numeric'
        });
    }

    get selectedDateLabel() {
        if (!this.selectedDate) {
            return '';
        }
        const [year, month, day] = this.selectedDate.split('-').map(Number);
        return new Date(year, month - 1, day).toLocaleDateString('en-AU', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    }

    get hasSelectedDate() {
        return !!this.selectedDate;
    }

    get calendarWeeks() {
        const year = this.currentYear;
        const month = this.currentMonth;
        const firstOfMonth = new Date(year, month, 1);
        // Convert JS's Sunday-is-0 into a Monday-first week.
        const startWeekday = (firstOfMonth.getDay() + 6) % 7;
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const todayIso = toIso(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());

        const cells = [];
        for (let i = 0; i < startWeekday; i++) {
            cells.push({ key: `blank-lead-${i}`, isBlank: true });
        }
        for (let day = 1; day <= daysInMonth; day++) {
            const iso = toIso(year, month, day);
            const requestCount = this.requestCountsByDate[iso] || 0;
            let cssClass = 'calendar__day';
            if (iso === todayIso) {
                cssClass += ' calendar__day_today';
            }
            if (iso === this.selectedDate) {
                cssClass += ' calendar__day_selected';
            }
            cells.push({
                key: iso,
                iso,
                day,
                requestCount,
                hasRequests: requestCount > 0,
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
        this.selectedDate = toIso(today.getFullYear(), today.getMonth(), today.getDate());
    }

    handleSelectDay(event) {
        this.selectedDate = event.currentTarget.dataset.date;
    }

    handleRequestCreated() {
        return refreshApex(this.wiredRequestsResult);
    }
}
