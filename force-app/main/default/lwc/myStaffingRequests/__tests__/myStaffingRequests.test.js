import { createElement } from 'lwc';
import MyStaffingRequests from 'c/myStaffingRequests';
import { CurrentPageReference } from 'lightning/navigation';
import getMyRequests from '@salesforce/apex/StaffingRequestController.getMyRequests';
import createCase from '@salesforce/apex/SupportRequestController.createCase';

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

jest.mock(
    '@salesforce/apex/SupportRequestController.createCase',
    () => ({ default: jest.fn() }),
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
            // ..., Assigned Contact, Status, Broadcasted, Cancellation Requested, Last Update
            expect(cells[10].textContent).toBe('—');
            expect(cells[13].textContent).toBe('No');
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
            expect(cells[10].textContent).toBe('Jane Doe');
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
            const shiftDateHeader = Array.from(element.shadowRoot.querySelectorAll('th')).find(
                (th) => th.textContent.includes('Shift Date')
            );
            shiftDateHeader.click();

            return Promise.resolve().then(() => {
                let rows = element.shadowRoot.querySelectorAll('tbody tr');
                expect(rows[0].textContent).toContain('SR-0004'); // 2026-07-22, earliest
                expect(rows[3].textContent).toContain('SR-0001'); // 2026-08-01, latest

                shiftDateHeader.click();

                return Promise.resolve().then(() => {
                    rows = element.shadowRoot.querySelectorAll('tbody tr');
                    expect(rows[0].textContent).toContain('SR-0001');
                    expect(rows[3].textContent).toContain('SR-0004');
                });
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

    it('only shows a Request Cancellation button for cancellable rows', () => {
        const element = createElement('c-my-staffing-requests', { is: MyStaffingRequests });
        document.body.appendChild(element);

        getMyRequests.emit(mockRequests);

        return Promise.resolve().then(() => {
            const rows = element.shadowRoot.querySelectorAll('tbody tr');
            // SR-0001 is Broadcasted (cancellable); SR-0002 Filled, SR-0003
            // Unable to Fill, SR-0004 Cancelled are all terminal statuses.
            expect(rows[0].querySelector('lightning-button')).not.toBeNull();
            expect(rows[1].querySelector('lightning-button')).toBeNull();
            expect(rows[2].querySelector('lightning-button')).toBeNull();
            expect(rows[3].querySelector('lightning-button')).toBeNull();
        });
    });

    it('does not show the button for a request that already has a cancellation requested', () => {
        const element = createElement('c-my-staffing-requests', { is: MyStaffingRequests });
        document.body.appendChild(element);

        getMyRequests.emit([{ ...mockRequests[0], Cancellation_Requested__c: true }]);

        return Promise.resolve().then(() => {
            const row = element.shadowRoot.querySelector('tbody tr');
            expect(row.querySelector('lightning-button')).toBeNull();
        });
    });

    it('requests a cancellation after confirming, and refreshes the list', async () => {
        createCase.mockResolvedValue('500000000000001AAA');
        jest.spyOn(window, 'confirm').mockReturnValue(true);

        const element = createElement('c-my-staffing-requests', { is: MyStaffingRequests });
        document.body.appendChild(element);

        getMyRequests.emit(mockRequests);
        await Promise.resolve();

        const button = element.shadowRoot.querySelector('lightning-button');
        button.click();
        await Promise.resolve();
        await Promise.resolve();

        expect(window.confirm).toHaveBeenCalledTimes(1);
        expect(createCase).toHaveBeenCalledTimes(1);
        const newCase = createCase.mock.calls[0][0].newCase;
        expect(newCase.Portal_Request_Type__c).toBe('Cancellation Request');
        expect(newCase.Related_Staffing_Request__c).toBe(mockRequests[0].Id);
        expect(newCase.Subject).toContain('SR-0001');

        const banner = element.shadowRoot.querySelector('.my-requests__banner_success');
        expect(banner.textContent).toContain('SR-0001');
    });

    it('does not submit a cancellation if the confirmation is declined', async () => {
        jest.spyOn(window, 'confirm').mockReturnValue(false);

        const element = createElement('c-my-staffing-requests', { is: MyStaffingRequests });
        document.body.appendChild(element);

        getMyRequests.emit(mockRequests);
        await Promise.resolve();

        const button = element.shadowRoot.querySelector('lightning-button');
        button.click();
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
        await Promise.resolve();

        const button = element.shadowRoot.querySelector('lightning-button');
        button.click();
        await Promise.resolve();

        expect(button.label).toBe('Cancelling…');
        expect(button.disabled).toBe(true);

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
