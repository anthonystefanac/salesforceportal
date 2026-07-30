import { createElement } from 'lwc';
import MyStaffingRequests from 'c/myStaffingRequests';
import { CurrentPageReference } from 'lightning/navigation';
import { formatDate, formatDateTime } from 'c/dateFormatUtils';
import getMyRequests from '@salesforce/apex/StaffingRequestController.getMyRequests';
import createCase from '@salesforce/apex/SupportRequestController.createCase';
import getCurrentUserBadge from '@salesforce/apex/PortalUserBadgeController.getCurrentUserBadge';

const rawMockRequests = require('./data/getMyRequests.json');

function isoOffset(days) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Shift_Date__c now gates visibility (myStaffingRequests hides anything
// before today), so the fixture's dates can't be static year-2026 literals -
// they're recomputed relative to whenever the suite actually runs. SR-0004
// stays unambiguously in the past (the "excluded" case); SR-0003 lands
// exactly on today (the inclusive boundary); the rest are in the future.
const SHIFT_DATE_OFFSET_DAYS = {
    'SR-0001': 30,
    'SR-0002': 1,
    'SR-0003': 0,
    'SR-0004': -6,
    'SR-0005': 2
};

const mockRequests = rawMockRequests.map((request) => ({
    ...request,
    Shift_Date__c: isoOffset(SHIFT_DATE_OFFSET_DAYS[request.Name])
}));

function findByName(name) {
    return mockRequests.find((request) => request.Name === name);
}

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

jest.mock(
    '@salesforce/apex/SupportRequestController.createCase',
    () => ({ default: jest.fn() }),
    { virtual: true }
);

jest.mock(
    '@salesforce/apex/PortalUserBadgeController.getCurrentUserBadge',
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
        if (window.confirm && window.confirm.mockRestore) {
            window.confirm.mockRestore();
        }
    });

    it('renders a row per upcoming request with a status badge, unfiltered by default', () => {
        const element = createElement('c-my-staffing-requests', { is: MyStaffingRequests });
        document.body.appendChild(element);

        getMyRequests.emit(mockRequests);

        return Promise.resolve().then(() => {
            const rows = element.shadowRoot.querySelectorAll('tbody tr');
            // SR-0004 is the only fixture row dated before today - excluded.
            expect(rows).toHaveLength(4);
            expect(Array.from(rows).some((row) => row.textContent.includes('SR-0004'))).toBe(false);
            expect(element.shadowRoot.querySelector('.my-requests__filter-banner')).toBeNull();
        });
    });

    it('defaults to sorting by shift date ascending, soonest first', () => {
        const element = createElement('c-my-staffing-requests', { is: MyStaffingRequests });
        document.body.appendChild(element);

        getMyRequests.emit(mockRequests);

        return Promise.resolve().then(() => {
            const rows = element.shadowRoot.querySelectorAll('tbody tr');
            // Ascending by shift date: SR-0003 (today), SR-0002 (+1),
            // SR-0005 (+2), SR-0001 (+30). SR-0004 (before today) is excluded.
            expect(rows[0].textContent).toContain('SR-0003');
            expect(rows[1].textContent).toContain('SR-0002');
            expect(rows[2].textContent).toContain('SR-0005');
            expect(rows[3].textContent).toContain('SR-0001');

            const shiftDateHeader = Array.from(element.shadowRoot.querySelectorAll('th')).find((th) =>
                th.textContent.includes('Shift Date')
            );
            expect(shiftDateHeader.getAttribute('aria-sort')).toBe('ascending');
        });
    });

    it('excludes a shiftDate deep link that points to a date before today', () => {
        const element = createElement('c-my-staffing-requests', { is: MyStaffingRequests });
        document.body.appendChild(element);

        CurrentPageReference.emit({ state: { shiftDate: findByName('SR-0004').Shift_Date__c } });
        getMyRequests.emit(mockRequests);

        return Promise.resolve().then(() => {
            const rows = element.shadowRoot.querySelectorAll('tbody tr');
            expect(rows).toHaveLength(0);
        });
    });

    it('mentions Reporting in the default empty state message', () => {
        const element = createElement('c-my-staffing-requests', { is: MyStaffingRequests });
        document.body.appendChild(element);

        getMyRequests.emit([]);

        return Promise.resolve().then(() => {
            const empty = element.shadowRoot.querySelector('.my-requests__empty');
            expect(empty.textContent).toContain('Reporting');
        });
    });

    it('formats Shift Date and Last Update as DD/MM/YYYY for display, regardless of Locale', () => {
        const element = createElement('c-my-staffing-requests', { is: MyStaffingRequests });
        document.body.appendChild(element);

        getMyRequests.emit(mockRequests);

        return Promise.resolve().then(() => {
            // Default sort is ascending by shift date, so the first row is SR-0003 (today).
            const firstRow = element.shadowRoot.querySelector('tbody tr');
            const cells = firstRow.querySelectorAll('td');
            const sr0003 = findByName('SR-0003');
            // Action, Request, Facility, Ward, Role, Specialty, Shift Date, Start Time, ...
            expect(cells[6].textContent).toBe(formatDate(sr0003.Shift_Date__c));
            expect(cells[6].textContent).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
            // ..., Assigned Contact, Status, Broadcasted, Cancellation Requested, Requested By,
            // Cancelled By, Last Update, then the mobile card layout's per-row "Show more" toggle
            // (final column, desktop-hidden).
            expect(cells[17].textContent).toBe(formatDateTime(sr0003.Last_Status_Update__c));
        });
    });

    it('formats Start Time/End Time from milliseconds-since-midnight into HH:MM', () => {
        const element = createElement('c-my-staffing-requests', { is: MyStaffingRequests });
        document.body.appendChild(element);

        getMyRequests.emit(mockRequests);

        return Promise.resolve().then(() => {
            const firstRow = element.shadowRoot.querySelector('tbody tr');
            const cells = firstRow.querySelectorAll('td');
            // Action, Request, Facility, Ward, Role, Specialty, Shift Date, Start Time, End Time, ...
            expect(cells[7].textContent).toBe('07:00');
            expect(cells[8].textContent).toBe('15:00');
        });
    });

    it('shows Specialty, Quantity, and Priority columns, with a placeholder for a blank Specialty', () => {
        const element = createElement('c-my-staffing-requests', { is: MyStaffingRequests });
        document.body.appendChild(element);

        getMyRequests.emit(mockRequests);

        return Promise.resolve().then(() => {
            // Default sort is ascending by shift date, so the first row is SR-0003 (today).
            const firstRow = element.shadowRoot.querySelector('tbody tr');
            const cells = firstRow.querySelectorAll('td');
            // Action, Request, Facility, Ward, Role, Specialty, Shift Date, Start Time, End Time, Quantity, Priority, ...
            expect(cells[5].textContent).toBe('—');
            expect(cells[9].textContent).toBe('1');
            expect(cells[10].textContent).toBe('Urgent');
            // ..., Assigned Contact, Status, Broadcasted, Cancellation Requested, Last Update
            expect(cells[11].textContent).toBe('—');
            expect(cells[14].textContent).toBe('No');
        });
    });

    it('shows Requested By and Cancelled By values', () => {
        const element = createElement('c-my-staffing-requests', { is: MyStaffingRequests });
        document.body.appendChild(element);

        getMyRequests.emit([{ ...mockRequests[0], Requested_By__c: 'Jane Doe', Cancelled_By__c: 'Pat Nguyen' }]);

        return Promise.resolve().then(() => {
            const cells = element.shadowRoot.querySelector('tbody tr').querySelectorAll('td');
            // ..., Cancellation Requested, Requested By, Cancelled By, Last Update.
            expect(cells[15].textContent).toBe('Jane Doe');
            expect(cells[16].textContent).toBe('Pat Nguyen');
        });
    });

    it('shows a placeholder for blank Requested By / Cancelled By', () => {
        const element = createElement('c-my-staffing-requests', { is: MyStaffingRequests });
        document.body.appendChild(element);

        getMyRequests.emit([{ ...mockRequests[0], Requested_By__c: null, Cancelled_By__c: null }]);

        return Promise.resolve().then(() => {
            const cells = element.shadowRoot.querySelector('tbody tr').querySelectorAll('td');
            expect(cells[15].textContent).toBe('—');
            expect(cells[16].textContent).toBe('—');
        });
    });

    it('toggles a row\'s secondary (mobile card layout) fields via its Show more/Show less button', () => {
        const element = createElement('c-my-staffing-requests', { is: MyStaffingRequests });
        document.body.appendChild(element);

        getMyRequests.emit(mockRequests);

        return Promise.resolve().then(() => {
            const firstRow = element.shadowRoot.querySelector('tbody tr');
            expect(firstRow.classList).not.toContain('my-requests__row_expanded');
            const toggle = firstRow.querySelector('.my-requests__toggle');
            expect(toggle.textContent).toBe('Show more');

            toggle.click();

            return Promise.resolve().then(() => {
                const expandedRow = element.shadowRoot.querySelector('tbody tr');
                expect(expandedRow.classList).toContain('my-requests__row_expanded');
                expect(expandedRow.querySelector('.my-requests__toggle').textContent).toBe('Show less');

                expandedRow.querySelector('.my-requests__toggle').click();

                return Promise.resolve().then(() => {
                    const collapsedRow = element.shadowRoot.querySelector('tbody tr');
                    expect(collapsedRow.classList).not.toContain('my-requests__row_expanded');
                    expect(collapsedRow.querySelector('.my-requests__toggle').textContent).toBe('Show more');
                });
            });
        });
    });

    it('shows the Assigned Contact once a shift is filled', () => {
        const element = createElement('c-my-staffing-requests', { is: MyStaffingRequests });
        document.body.appendChild(element);

        getMyRequests.emit([
            { ...mockRequests[0], Assigned_Contact__c: 'Jane Doe' }
        ]);

        return Promise.resolve().then(() => {
            const firstRow = element.shadowRoot.querySelector('tbody tr');
            const cells = firstRow.querySelectorAll('td');
            expect(cells[11].textContent).toBe('Jane Doe');
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

    it('shows only filled shifts when the page reference filter is "filled"', () => {
        const element = createElement('c-my-staffing-requests', { is: MyStaffingRequests });
        document.body.appendChild(element);

        CurrentPageReference.emit({ state: { filter: 'filled' } });
        getMyRequests.emit(mockRequests);

        return Promise.resolve().then(() => {
            const rows = element.shadowRoot.querySelectorAll('tbody tr');
            expect(rows).toHaveLength(1);
            const badge = element.shadowRoot.querySelector('c-request-status-badge');
            expect(badge.status).toBe('Filled');
        });
    });

    it('shows only cancelled shifts when the page reference filter is "cancelled"', () => {
        const element = createElement('c-my-staffing-requests', { is: MyStaffingRequests });
        document.body.appendChild(element);

        CurrentPageReference.emit({ state: { filter: 'cancelled' } });
        getMyRequests.emit(mockRequests);

        return Promise.resolve().then(() => {
            const rows = element.shadowRoot.querySelectorAll('tbody tr');
            expect(rows).toHaveLength(1);
            const badge = element.shadowRoot.querySelector('c-request-status-badge');
            expect(badge.status).toBe('Cancelled');
        });
    });

    it('shows only requests matching the shiftDate carried in page state', () => {
        const element = createElement('c-my-staffing-requests', { is: MyStaffingRequests });
        document.body.appendChild(element);

        const sr0002 = findByName('SR-0002');
        CurrentPageReference.emit({ state: { shiftDate: sr0002.Shift_Date__c } });
        getMyRequests.emit(mockRequests);

        return Promise.resolve().then(() => {
            const rows = element.shadowRoot.querySelectorAll('tbody tr');
            expect(rows).toHaveLength(1);
            expect(rows[0].textContent).toContain('SR-0002');

            const banner = element.shadowRoot.querySelector('.my-requests__filter-banner');
            expect(banner.textContent).toContain(`Shift Date: ${formatDate(sr0002.Shift_Date__c)}`);
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
            expect(empty.textContent).toContain('Unable to Fill Shifts');
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

    it('filters rows by search term across request, facility, ward, role, specialty, and status', () => {
        const element = createElement('c-my-staffing-requests', { is: MyStaffingRequests });
        document.body.appendChild(element);

        getMyRequests.emit(mockRequests);

        return Promise.resolve().then(() => {
            const searchInput = element.shadowRoot.querySelector('lightning-input');
            searchInput.value = 'Enrolled';
            searchInput.dispatchEvent(new CustomEvent('change'));

            return Promise.resolve().then(() => {
                const rows = element.shadowRoot.querySelectorAll('tbody tr');
                expect(rows).toHaveLength(1);
                expect(rows[0].textContent).toContain('SR-0003');
            });
        });
    });

    it('shows a search-aware empty state message when the search term matches nothing', () => {
        const element = createElement('c-my-staffing-requests', { is: MyStaffingRequests });
        document.body.appendChild(element);

        getMyRequests.emit(mockRequests);

        return Promise.resolve().then(() => {
            const searchInput = element.shadowRoot.querySelector('lightning-input');
            searchInput.value = 'no-such-request';
            searchInput.dispatchEvent(new CustomEvent('change'));

            return Promise.resolve().then(() => {
                const empty = element.shadowRoot.querySelector('.my-requests__empty');
                expect(empty.textContent).toContain('no-such-request');
            });
        });
    });

    it('sorts by a clicked column, toggling direction on a second click', () => {
        const element = createElement('c-my-staffing-requests', { is: MyStaffingRequests });
        document.body.appendChild(element);

        getMyRequests.emit(mockRequests);

        return Promise.resolve().then(() => {
            // Shift Date is already the default sort, so exercise the toggle
            // via a different column - Request (name).
            const requestHeader = Array.from(element.shadowRoot.querySelectorAll('th')).find((th) =>
                th.textContent.includes('Request')
            );
            requestHeader.click();

            return Promise.resolve().then(() => {
                let rows = element.shadowRoot.querySelectorAll('tbody tr');
                expect(rows[0].textContent).toContain('SR-0001'); // ascending, earliest name
                expect(rows[3].textContent).toContain('SR-0005'); // ascending, latest name

                requestHeader.click();

                return Promise.resolve().then(() => {
                    rows = element.shadowRoot.querySelectorAll('tbody tr');
                    expect(rows[0].textContent).toContain('SR-0005');
                    expect(rows[3].textContent).toContain('SR-0001');
                });
            });
        });
    });

    it('toggles Shift Date to descending when its already-sorted header is clicked', () => {
        const element = createElement('c-my-staffing-requests', { is: MyStaffingRequests });
        document.body.appendChild(element);

        getMyRequests.emit(mockRequests);

        return Promise.resolve().then(() => {
            const shiftDateHeader = Array.from(element.shadowRoot.querySelectorAll('th')).find((th) =>
                th.textContent.includes('Shift Date')
            );
            shiftDateHeader.click();

            return Promise.resolve().then(() => {
                const rows = element.shadowRoot.querySelectorAll('tbody tr');
                expect(rows[0].textContent).toContain('SR-0001'); // +30 days, latest
                expect(rows[3].textContent).toContain('SR-0003'); // today, earliest
                expect(shiftDateHeader.getAttribute('aria-sort')).toBe('descending');
            });
        });
    });

    it('paginates at 10 rows per page and steps through pages', () => {
        const manyRequests = Array.from({ length: 23 }, (_, index) => ({
            ...mockRequests[0],
            Id: `a02000000000${String(index + 100).padStart(3, '0')}AAA`,
            Name: `SR-${String(index + 100).padStart(4, '0')}`
        }));

        const element = createElement('c-my-staffing-requests', { is: MyStaffingRequests });
        document.body.appendChild(element);

        getMyRequests.emit(manyRequests);

        return Promise.resolve().then(() => {
            expect(element.shadowRoot.querySelectorAll('tbody tr')).toHaveLength(10);
            expect(element.shadowRoot.querySelector('.my-requests__pagination-summary').textContent).toBe(
                'Showing 1–10 of 23'
            );
            expect(element.shadowRoot.querySelector('.my-requests__pagination-page').textContent).toBe(
                'Page 1 of 3'
            );

            const [prevButton, nextButton] = element.shadowRoot.querySelectorAll('lightning-button-icon');
            expect(prevButton.disabled).toBe(true);
            expect(nextButton.disabled).toBe(false);

            nextButton.click();

            return Promise.resolve().then(() => {
                expect(element.shadowRoot.querySelectorAll('tbody tr')).toHaveLength(10);
                expect(element.shadowRoot.querySelector('.my-requests__pagination-page').textContent).toBe(
                    'Page 2 of 3'
                );

                nextButton.click();

                return Promise.resolve().then(() => {
                    expect(element.shadowRoot.querySelectorAll('tbody tr')).toHaveLength(3);
                    expect(element.shadowRoot.querySelector('.my-requests__pagination-page').textContent).toBe(
                        'Page 3 of 3'
                    );
                    expect(nextButton.disabled).toBe(true);
                });
            });
        });
    });

    it('resets to page 1 when the search term changes', () => {
        const manyRequests = Array.from({ length: 15 }, (_, index) => ({
            ...mockRequests[0],
            Id: `a02000000000${String(index + 200).padStart(3, '0')}AAA`,
            Name: `SR-${String(index + 200).padStart(4, '0')}`,
            Role__c: index === 12 ? 'Enrolled Nurse' : 'Registered Nurse'
        }));

        const element = createElement('c-my-staffing-requests', { is: MyStaffingRequests });
        document.body.appendChild(element);

        getMyRequests.emit(manyRequests);

        return Promise.resolve().then(() => {
            const [, nextButton] = element.shadowRoot.querySelectorAll('lightning-button-icon');
            nextButton.click();

            return Promise.resolve().then(() => {
                expect(element.shadowRoot.querySelector('.my-requests__pagination-page').textContent).toBe(
                    'Page 2 of 2'
                );

                const searchInput = element.shadowRoot.querySelector('lightning-input');
                searchInput.value = 'Enrolled';
                searchInput.dispatchEvent(new CustomEvent('change'));

                return Promise.resolve().then(() => {
                    const rows = element.shadowRoot.querySelectorAll('tbody tr');
                    expect(rows).toHaveLength(1);
                    expect(
                        element.shadowRoot.querySelector('.my-requests__pagination-summary').textContent
                    ).toBe('Showing 1–1 of 1');
                });
            });
        });
    });

    function selectCancel(buttonMenu) {
        buttonMenu.dispatchEvent(new CustomEvent('select', { detail: { value: 'cancel' } }));
    }

    it('only shows an actions dropdown for cancellable rows', () => {
        const element = createElement('c-my-staffing-requests', { is: MyStaffingRequests });
        document.body.appendChild(element);

        getMyRequests.emit(mockRequests);

        return Promise.resolve().then(() => {
            const rows = element.shadowRoot.querySelectorAll('tbody tr');
            // Default sort is by shift date ascending, so rows render SR-0003,
            // SR-0002, SR-0005, SR-0001. SR-0001 is Broadcasted (cancellable);
            // SR-0003 Unable to Fill, SR-0002 Filled, SR-0005 Cancelled are
            // all terminal statuses.
            expect(rows[0].querySelector('lightning-button-menu')).toBeNull();
            expect(rows[1].querySelector('lightning-button-menu')).toBeNull();
            expect(rows[2].querySelector('lightning-button-menu')).toBeNull();
            expect(rows[3].querySelector('lightning-button-menu')).not.toBeNull();
        });
    });

    it('does not show the actions dropdown for a request that already has a cancellation requested', () => {
        const element = createElement('c-my-staffing-requests', { is: MyStaffingRequests });
        document.body.appendChild(element);

        getMyRequests.emit([{ ...mockRequests[0], Cancellation_Requested__c: true }]);

        return Promise.resolve().then(() => {
            const row = element.shadowRoot.querySelector('tbody tr');
            expect(row.querySelector('lightning-button-menu')).toBeNull();
        });
    });

    it('requests a cancellation after confirming, auto-filling Cancelled By with the logged-in user, and refreshes the list', async () => {
        createCase.mockResolvedValue('500000000000001AAA');
        jest.spyOn(window, 'confirm').mockReturnValue(true);

        const element = createElement('c-my-staffing-requests', { is: MyStaffingRequests });
        document.body.appendChild(element);

        getMyRequests.emit(mockRequests);
        getCurrentUserBadge.emit({ userName: 'Jordan Michaels', accountName: 'Riverside Aged Care Group' });
        await Promise.resolve();

        const buttonMenu = element.shadowRoot.querySelector('lightning-button-menu');
        selectCancel(buttonMenu);
        await Promise.resolve();
        await Promise.resolve();

        expect(window.confirm).toHaveBeenCalledTimes(1);
        expect(createCase).toHaveBeenCalledTimes(1);
        const newCase = createCase.mock.calls[0][0].newCase;
        expect(newCase.Portal_Request_Type__c).toBe('Cancellation Request');
        expect(newCase.Related_Staffing_Request__c).toBe(mockRequests[0].Id);
        expect(newCase.Cancelled_By__c).toBe('Jordan Michaels');
        expect(newCase.Subject).toContain('SR-0001');

        const banner = element.shadowRoot.querySelector('.my-requests__banner_success');
        expect(banner.textContent).toContain('SR-0001');
    });

    it('does not submit a cancellation if the confirm dialog is declined', async () => {
        jest.spyOn(window, 'confirm').mockReturnValue(false);

        const element = createElement('c-my-staffing-requests', { is: MyStaffingRequests });
        document.body.appendChild(element);

        getMyRequests.emit(mockRequests);
        getCurrentUserBadge.emit({ userName: 'Jordan Michaels', accountName: 'Riverside Aged Care Group' });
        await Promise.resolve();

        const buttonMenu = element.shadowRoot.querySelector('lightning-button-menu');
        selectCancel(buttonMenu);
        await Promise.resolve();

        expect(createCase).not.toHaveBeenCalled();
    });

    it('blocks the cancellation and shows an error banner if the logged-in user\'s name is not yet known', async () => {
        jest.spyOn(window, 'confirm').mockReturnValue(true);

        const element = createElement('c-my-staffing-requests', { is: MyStaffingRequests });
        document.body.appendChild(element);

        getMyRequests.emit(mockRequests);
        await Promise.resolve();

        const buttonMenu = element.shadowRoot.querySelector('lightning-button-menu');
        selectCancel(buttonMenu);
        await Promise.resolve();

        expect(createCase).not.toHaveBeenCalled();
        const banner = element.shadowRoot.querySelector('.my-requests__banner_error');
        expect(banner.textContent).toBe(
            'Unable to determine your name to record this cancellation - please try again in a moment.'
        );
    });

    it('ignores a select event for anything other than the cancel menu item', async () => {
        const element = createElement('c-my-staffing-requests', { is: MyStaffingRequests });
        document.body.appendChild(element);

        getMyRequests.emit(mockRequests);
        await Promise.resolve();

        const buttonMenu = element.shadowRoot.querySelector('lightning-button-menu');
        buttonMenu.dispatchEvent(new CustomEvent('select', { detail: { value: 'something-else' } }));
        await Promise.resolve();

        expect(createCase).not.toHaveBeenCalled();
    });

    it('shows a saving state and an error banner if the cancellation request fails', async () => {
        jest.spyOn(window, 'confirm').mockReturnValue(true);
        let rejectCreate;
        createCase.mockReturnValue(
            new Promise((_resolve, reject) => {
                rejectCreate = reject;
            })
        );

        const element = createElement('c-my-staffing-requests', { is: MyStaffingRequests });
        document.body.appendChild(element);

        getMyRequests.emit(mockRequests);
        getCurrentUserBadge.emit({ userName: 'Jordan Michaels', accountName: 'Riverside Aged Care Group' });
        await Promise.resolve();

        const buttonMenu = element.shadowRoot.querySelector('lightning-button-menu');
        selectCancel(buttonMenu);
        await Promise.resolve();

        expect(buttonMenu.disabled).toBe(true);

        rejectCreate({ body: { message: 'Unable to create case' } });
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();

        const banner = element.shadowRoot.querySelector('.my-requests__banner_error');
        expect(banner.textContent).toBe('Unable to create case');
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
