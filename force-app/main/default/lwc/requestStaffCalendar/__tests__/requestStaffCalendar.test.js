import { createElement } from 'lwc';
import RequestStaffCalendar from 'c/requestStaffCalendar';
import getMyRequests from '@salesforce/apex/StaffingRequestController.getMyRequests';

jest.mock(
    '@salesforce/apex/StaffingRequestController.getMyRequests',
    () => {
        const { createApexTestWireAdapter } = require('@salesforce/sfdx-lwc-jest');
        return {
            default: createApexTestWireAdapter(jest.fn())
        };
    },
    { virtual: true }
);

// The default lightning/navigation stub's Navigate method is a frozen no-op,
// so it can't be jest.spyOn'd directly - swap in an instrumented mixin instead.
const mockNavigate = jest.fn();
jest.mock('lightning/navigation', () => {
    const Navigate = Symbol('Navigate');
    const NavigationMixin = (Base) =>
        class extends Base {
            [Navigate](pageReference) {
                mockNavigate(pageReference);
            }
        };
    NavigationMixin.Navigate = Navigate;
    return { NavigationMixin };
});

function toIso(date) {
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${mm}-${dd}`;
}

describe('c-request-staff-calendar', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
        jest.clearAllMocks();
    });

    it('shows the current month by default and hides the day detail until a day is selected', () => {
        const element = createElement('c-request-staff-calendar', { is: RequestStaffCalendar });
        document.body.appendChild(element);

        const expectedLabel = new Date().toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });
        expect(element.shadowRoot.querySelector('.calendar__month').textContent).toBe(expectedLabel);
        expect(element.shadowRoot.querySelector('.calendar-screen__day-detail')).toBeNull();
    });

    it('selecting a day reveals a Request Staff button that navigates with that date in state', () => {
        const element = createElement('c-request-staff-calendar', { is: RequestStaffCalendar });
        document.body.appendChild(element);

        const today = new Date();
        const dayFifteen = new Date(today.getFullYear(), today.getMonth(), 15);
        const iso = toIso(dayFifteen);

        const dayButton = element.shadowRoot.querySelector(`button[data-date="${iso}"]`);
        expect(dayButton).not.toBeNull();
        dayButton.click();

        return Promise.resolve().then(() => {
            const requestStaffButton = element.shadowRoot.querySelector(
                '.calendar-screen__day-detail lightning-button'
            );
            expect(requestStaffButton).not.toBeNull();

            requestStaffButton.click();

            expect(mockNavigate).toHaveBeenCalledTimes(1);
            const pageReference = mockNavigate.mock.calls[0][0];
            expect(pageReference.type).toBe('comm__namedPage');
            expect(pageReference.attributes.name).toBe('Request_Staff__c');
            expect(pageReference.state.defaultDate).toBe(iso);
        });
    });

    it('navigates to the next month', () => {
        const element = createElement('c-request-staff-calendar', { is: RequestStaffCalendar });
        document.body.appendChild(element);

        const today = new Date();
        const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
        const expectedLabel = nextMonth.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });

        const nextButton = element.shadowRoot.querySelector('[data-action="next"]');
        nextButton.click();

        return Promise.resolve().then(() => {
            expect(element.shadowRoot.querySelector('.calendar__month').textContent).toBe(expectedLabel);
        });
    });

    it('shows a request-count badge on a day with existing requests', () => {
        const element = createElement('c-request-staff-calendar', { is: RequestStaffCalendar });
        document.body.appendChild(element);

        const today = new Date();
        const dayTen = new Date(today.getFullYear(), today.getMonth(), 10);
        const iso = toIso(dayTen);

        getMyRequests.emit([
            {
                Id: 'a02000000000001AAA',
                Name: 'SR-0001',
                Facility__r: { Name: 'Test Hospital' },
                Ward__r: { Name: 'Ward A' },
                Role__c: 'Registered Nurse',
                Shift_Date__c: iso,
                Status__c: 'Broadcasted'
            }
        ]);

        return Promise.resolve().then(() => {
            const dayButton = element.shadowRoot.querySelector(`button[data-date="${iso}"]`);
            const badge = dayButton.querySelector('.calendar__day-count');
            expect(badge.textContent).toBe('1');
        });
    });

    it('lists the existing bookings for a selected day', () => {
        const element = createElement('c-request-staff-calendar', { is: RequestStaffCalendar });
        document.body.appendChild(element);

        const today = new Date();
        const dayTen = new Date(today.getFullYear(), today.getMonth(), 10);
        const iso = toIso(dayTen);

        getMyRequests.emit([
            {
                Id: 'a02000000000001AAA',
                Name: 'SR-0001',
                Facility__r: { Name: 'Test Hospital' },
                Ward__r: { Name: 'Ward A' },
                Role__c: 'Registered Nurse',
                Shift_Date__c: iso,
                Status__c: 'Broadcasted'
            }
        ]);

        return Promise.resolve().then(() => {
            const dayButton = element.shadowRoot.querySelector(`button[data-date="${iso}"]`);
            dayButton.click();

            return Promise.resolve().then(() => {
                const bookings = element.shadowRoot.querySelectorAll('.calendar-screen__booking');
                expect(bookings).toHaveLength(1);
                expect(bookings[0].textContent).toContain('Registered Nurse');
                expect(bookings[0].textContent).toContain('Test Hospital');
                expect(bookings[0].textContent).toContain('Ward A');
                expect(element.shadowRoot.querySelector('.calendar-screen__empty')).toBeNull();
            });
        });
    });

    it('shows an empty-state message when the selected day has no bookings', () => {
        const element = createElement('c-request-staff-calendar', { is: RequestStaffCalendar });
        document.body.appendChild(element);

        const today = new Date();
        const dayTwelve = new Date(today.getFullYear(), today.getMonth(), 12);
        const iso = toIso(dayTwelve);

        const dayButton = element.shadowRoot.querySelector(`button[data-date="${iso}"]`);
        dayButton.click();

        return Promise.resolve().then(() => {
            const empty = element.shadowRoot.querySelector('.calendar-screen__empty');
            expect(empty).not.toBeNull();
            expect(empty.textContent).toBe('No requests for this day yet.');
            expect(element.shadowRoot.querySelectorAll('.calendar-screen__booking')).toHaveLength(0);
        });
    });

    it('jumps to today and selects it when the Today button is clicked', () => {
        const element = createElement('c-request-staff-calendar', { is: RequestStaffCalendar });
        document.body.appendChild(element);

        const todayButton = element.shadowRoot.querySelector('.calendar__today-button');
        todayButton.click();

        return Promise.resolve().then(() => {
            expect(element.shadowRoot.querySelector('.calendar-screen__day-detail')).not.toBeNull();
        });
    });
});
