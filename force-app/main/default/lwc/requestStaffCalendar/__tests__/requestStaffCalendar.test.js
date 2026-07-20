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

jest.mock('@salesforce/apex', () => ({ refreshApex: jest.fn() }), { virtual: true });

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

    it('shows the current month by default and hides the form until a day is selected', () => {
        const element = createElement('c-request-staff-calendar', { is: RequestStaffCalendar });
        document.body.appendChild(element);

        const expectedLabel = new Date().toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });
        expect(element.shadowRoot.querySelector('.calendar__month').textContent).toBe(expectedLabel);
        expect(element.shadowRoot.querySelector('c-request-staff-form')).toBeNull();
    });

    it('selects a day and reveals the request form with a matching default date', () => {
        const element = createElement('c-request-staff-calendar', { is: RequestStaffCalendar });
        document.body.appendChild(element);

        const today = new Date();
        const dayFifteen = new Date(today.getFullYear(), today.getMonth(), 15);
        const iso = toIso(dayFifteen);

        const dayButton = element.shadowRoot.querySelector(`button[data-date="${iso}"]`);
        expect(dayButton).not.toBeNull();
        dayButton.click();

        return Promise.resolve().then(() => {
            const form = element.shadowRoot.querySelector('c-request-staff-form');
            expect(form).not.toBeNull();
            expect(form.defaultDate).toBe(iso);
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

    it('jumps to today and selects it when the Today button is clicked', () => {
        const element = createElement('c-request-staff-calendar', { is: RequestStaffCalendar });
        document.body.appendChild(element);

        const todayIso = toIso(new Date());
        const todayButton = element.shadowRoot.querySelector('.calendar__today-button');
        todayButton.click();

        return Promise.resolve().then(() => {
            const form = element.shadowRoot.querySelector('c-request-staff-form');
            expect(form.defaultDate).toBe(todayIso);
        });
    });
});
