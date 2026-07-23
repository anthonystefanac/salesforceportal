import { LightningElement, wire } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import getMyRequests from '@salesforce/apex/StaffingRequestController.getMyRequests';

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Placeholder until the Request Staff page exists in Experience Builder -
// confirm/update this the same way My_Requests__c and Invoices__c were
// confirmed for portalHomeDashboard's TILE_NAVIGATION.
const REQUEST_STAFF_PAGE_NAME = 'Request_Staff__c';

// Real, confirmed page API name - same one portalHomeDashboard's
// TILE_NAVIGATION uses.
const MY_REQUESTS_PAGE_NAME = 'My_Requests__c';

function toIso(year, month, day) {
    const mm = String(month + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return `${year}-${mm}-${dd}`;
}

export default class RequestStaffCalendar extends NavigationMixin(LightningElement) {
    weekdayLabels = WEEKDAY_LABELS;
    currentYear;
    currentMonth;
    selectedDate;
    requestsByDate = {};

    connectedCallback() {
        const today = new Date();
        this.currentYear = today.getFullYear();
        this.currentMonth = today.getMonth();
    }

    @wire(getMyRequests)
    wiredRequests({ data }) {
        if (data) {
            this.requestsByDate = data.reduce((byDate, request) => {
                const iso = request.Shift_Date__c;
                if (iso) {
                    if (!byDate[iso]) {
                        byDate[iso] = [];
                    }
                    byDate[iso].push({
                        id: request.Id,
                        facilityName: request.Facility__r ? request.Facility__r.Name : '',
                        wardName: request.Ward__r ? request.Ward__r.Name : '—',
                        quantity: request.Quantity__c,
                        role: request.Role__c,
                        status: request.Status__c
                    });
                }
                return byDate;
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

    get selectedDateRequests() {
        return this.selectedDate ? this.requestsByDate[this.selectedDate] || [] : [];
    }

    get hasSelectedDateRequests() {
        return this.selectedDateRequests.length > 0;
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
            const requestCount = (this.requestsByDate[iso] || []).length;
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

    handleRequestStaffClick() {
        this[NavigationMixin.Navigate]({
            type: 'comm__namedPage',
            attributes: { name: REQUEST_STAFF_PAGE_NAME },
            state: { defaultDate: this.selectedDate }
        });
    }

    handleBookingClick() {
        this[NavigationMixin.Navigate]({
            type: 'comm__namedPage',
            attributes: { name: MY_REQUESTS_PAGE_NAME },
            state: { shiftDate: this.selectedDate }
        });
    }
}
