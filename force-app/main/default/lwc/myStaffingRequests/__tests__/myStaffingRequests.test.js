import { createElement } from 'lwc';
import MyStaffingRequests from 'c/myStaffingRequests';
import { CurrentPageReference } from 'lightning/navigation';
import getMyRequests from '@salesforce/apex/StaffingRequestController.getMyRequests';

const mockRequests = require('./data/getMyRequests.json');

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

describe('c-my-staffing-requests', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
        jest.clearAllMocks();
    });

    it('renders a row per request with a status badge, unfiltered by default', () => {
        const element = createElement('c-my-staffing-requests', { is: MyStaffingRequests });
        document.body.appendChild(element);

        getMyRequests.emit(mockRequests);

        return Promise.resolve().then(() => {
            const rows = element.shadowRoot.querySelectorAll('tbody tr');
            expect(rows).toHaveLength(4);
            expect(element.shadowRoot.querySelector('.my-requests__filter-banner')).toBeNull();
        });
    });

    it('formats Start Time/End Time from milliseconds-since-midnight into HH:MM', () => {
        const element = createElement('c-my-staffing-requests', { is: MyStaffingRequests });
        document.body.appendChild(element);

        getMyRequests.emit(mockRequests);

        return Promise.resolve().then(() => {
            const firstRow = element.shadowRoot.querySelector('tbody tr');
            const cells = firstRow.querySelectorAll('td');
            // Request, Facility, Ward, Role, Specialty, Shift Date, Start Time, End Time, ...
            expect(cells[6].textContent).toBe('07:00');
            expect(cells[7].textContent).toBe('15:00');
        });
    });

    it('shows Specialty, Quantity, and Priority columns, with a placeholder for a blank Specialty', () => {
        const element = createElement('c-my-staffing-requests', { is: MyStaffingRequests });
        document.body.appendChild(element);

        getMyRequests.emit(mockRequests);

        return Promise.resolve().then(() => {
            const firstRow = element.shadowRoot.querySelector('tbody tr');
            const cells = firstRow.querySelectorAll('td');
            // Request, Facility, Ward, Role, Specialty, Shift Date, Start Time, End Time, Quantity, Priority, ...
            expect(cells[4].textContent).toBe('—');
            expect(cells[8].textContent).toBe('1');
            expect(cells[9].textContent).toBe('Medium');
        });
    });

    it('shows only open requests when the page reference filter is "open"', () => {
        const element = createElement('c-my-staffing-requests', { is: MyStaffingRequests });
        document.body.appendChild(element);

        CurrentPageReference.emit({ state: { filter: 'open' } });
        getMyRequests.emit(mockRequests);

        return Promise.resolve().then(() => {
            const rows = element.shadowRoot.querySelectorAll('tbody tr');
            // Filled, Unable to Fill and Cancelled are excluded from "open" - only Broadcasted remains.
            expect(rows).toHaveLength(1);
            const badge = element.shadowRoot.querySelector('c-request-status-badge');
            expect(badge.status).toBe('Broadcasted');

            const banner = element.shadowRoot.querySelector('.my-requests__filter-banner');
            expect(banner.textContent).toContain('Open Requests');
        });
    });

    it('shows only unfilled shifts when the page reference filter is "unfilled"', () => {
        const element = createElement('c-my-staffing-requests', { is: MyStaffingRequests });
        document.body.appendChild(element);

        CurrentPageReference.emit({ state: { filter: 'unfilled' } });
        getMyRequests.emit(mockRequests);

        return Promise.resolve().then(() => {
            const rows = element.shadowRoot.querySelectorAll('tbody tr');
            expect(rows).toHaveLength(1);
            const badge = element.shadowRoot.querySelector('c-request-status-badge');
            expect(badge.status).toBe('Unable to Fill');
        });
    });

    it('shows only requests matching the shiftDate carried in page state', () => {
        const element = createElement('c-my-staffing-requests', { is: MyStaffingRequests });
        document.body.appendChild(element);

        CurrentPageReference.emit({ state: { shiftDate: '2026-07-29' } });
        getMyRequests.emit(mockRequests);

        return Promise.resolve().then(() => {
            const rows = element.shadowRoot.querySelectorAll('tbody tr');
            expect(rows).toHaveLength(1);
            expect(rows[0].textContent).toContain('SR-0002');

            const banner = element.shadowRoot.querySelector('.my-requests__filter-banner');
            expect(banner.textContent).toContain('Shift Date: 2026-07-29');
        });
    });

    it('clears the filter and shows all requests when "Show all requests" is clicked', () => {
        const element = createElement('c-my-staffing-requests', { is: MyStaffingRequests });
        document.body.appendChild(element);

        CurrentPageReference.emit({ state: { filter: 'open' } });
        getMyRequests.emit(mockRequests);

        return Promise.resolve().then(() => {
            const clearButton = element.shadowRoot.querySelector('.my-requests__clear-filter');
            clearButton.click();

            return Promise.resolve().then(() => {
                const rows = element.shadowRoot.querySelectorAll('tbody tr');
                expect(rows).toHaveLength(4);
                expect(element.shadowRoot.querySelector('.my-requests__filter-banner')).toBeNull();
            });
        });
    });

    it('shows a filter-aware empty state message when the filter matches nothing', () => {
        const element = createElement('c-my-staffing-requests', { is: MyStaffingRequests });
        document.body.appendChild(element);

        CurrentPageReference.emit({ state: { filter: 'unfilled' } });
        getMyRequests.emit([]);

        return Promise.resolve().then(() => {
            const empty = element.shadowRoot.querySelector('.my-requests__empty');
            expect(empty.textContent).toContain('Unfilled Shifts');
        });
    });

    it('shows an empty state message when there are no requests and no filter', () => {
        const element = createElement('c-my-staffing-requests', { is: MyStaffingRequests });
        document.body.appendChild(element);

        getMyRequests.emit([]);

        return Promise.resolve().then(() => {
            const empty = element.shadowRoot.querySelector('.my-requests__empty');
            expect(empty).not.toBeNull();
            expect(element.shadowRoot.querySelector('table')).toBeNull();
        });
    });

    it('shows an error message when the wire adapter errors', () => {
        const element = createElement('c-my-staffing-requests', { is: MyStaffingRequests });
        document.body.appendChild(element);

        getMyRequests.error();

        return Promise.resolve().then(() => {
            const errorEl = element.shadowRoot.querySelector('.slds-text-color_error');
            expect(errorEl).not.toBeNull();
        });
    });
});
