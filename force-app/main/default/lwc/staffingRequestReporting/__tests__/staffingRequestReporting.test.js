import { createElement } from 'lwc';
import StaffingRequestReporting from 'c/staffingRequestReporting';
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

// Today is fixed to Monday 2026-07-27 for every test, so the date-range math
// (Last 7 Days / Last Week / Last Month) is deterministic:
// - Last 7 Days: 2026-07-21 to 2026-07-27 (rolling)
// - Last Week (Mon-Sun): 2026-07-20 to 2026-07-26 (previous calendar week)
// - Last Month: 2026-06-01 to 2026-06-30 (previous calendar month)
const mockRequests = [
    { Id: 'a02000000000001AAA', Name: 'SR-0001', Shift_Date__c: '2026-07-27', Status__c: 'Submitted' }, // today - Last 7 Days only
    { Id: 'a02000000000002AAA', Name: 'SR-0002', Shift_Date__c: '2026-07-21', Status__c: 'Submitted' }, // Last 7 Days AND Last Week
    { Id: 'a02000000000003AAA', Name: 'SR-0003', Shift_Date__c: '2026-07-20', Status__c: 'Submitted' }, // Last Week only
    { Id: 'a02000000000004AAA', Name: 'SR-0004', Shift_Date__c: '2026-06-15', Status__c: 'Submitted' }, // Last Month only
    { Id: 'a02000000000005AAA', Name: 'SR-0005', Shift_Date__c: '2026-05-01', Status__c: 'Submitted' } // outside every preset
];

describe('c-staffing-request-reporting', () => {
    let createdLinks;
    let originalCreateElement;

    beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date(2026, 6, 27, 12, 0, 0));

        createdLinks = [];
        originalCreateElement = document.createElement.bind(document);
        jest.spyOn(document, 'createElement').mockImplementation((tag) => {
            const el = originalCreateElement(tag);
            if (tag === 'a') {
                jest.spyOn(el, 'click').mockImplementation(() => {});
                createdLinks.push(el);
            }
            return el;
        });
    });

    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
        jest.clearAllMocks();
        jest.useRealTimers();
        if (document.createElement.mockRestore) {
            document.createElement.mockRestore();
        }
    });

    it('defaults to Last 7 Days and shows only requests in that rolling window', () => {
        const element = createElement('c-staffing-request-reporting', { is: StaffingRequestReporting });
        document.body.appendChild(element);

        getMyRequests.emit(mockRequests);

        return Promise.resolve().then(() => {
            const rows = element.shadowRoot.querySelectorAll('tbody tr');
            expect(rows).toHaveLength(2);
            expect(element.shadowRoot.querySelector('.reporting__table').textContent).toContain('SR-0001');
            expect(element.shadowRoot.querySelector('.reporting__table').textContent).toContain('SR-0002');
        });
    });

    it('shows every request regardless of date when All is selected', () => {
        const element = createElement('c-staffing-request-reporting', { is: StaffingRequestReporting });
        document.body.appendChild(element);

        getMyRequests.emit(mockRequests);

        return Promise.resolve().then(() => {
            const allButton = Array.from(element.shadowRoot.querySelectorAll('.reporting__preset')).find(
                (button) => button.textContent === 'All'
            );
            allButton.click();

            return Promise.resolve().then(() => {
                const rows = element.shadowRoot.querySelectorAll('tbody tr');
                expect(rows).toHaveLength(mockRequests.length);

                const downloadButton = element.shadowRoot.querySelector('lightning-button');
                downloadButton.click();

                expect(createdLinks).toHaveLength(1);
                expect(createdLinks[0].download).toBe('staffing-requests-all.csv');
            });
        });
    });

    it('sorts by a clicked column, toggling direction on a second click', () => {
        const element = createElement('c-staffing-request-reporting', { is: StaffingRequestReporting });
        document.body.appendChild(element);

        getMyRequests.emit(mockRequests);

        return Promise.resolve().then(() => {
            const allButton = Array.from(element.shadowRoot.querySelectorAll('.reporting__preset')).find(
                (button) => button.textContent === 'All'
            );
            allButton.click();

            return Promise.resolve().then(() => {
                const shiftDateHeader = Array.from(element.shadowRoot.querySelectorAll('th')).find((th) =>
                    th.textContent.includes('Shift Date')
                );
                shiftDateHeader.click();

                return Promise.resolve().then(() => {
                    let rows = element.shadowRoot.querySelectorAll('tbody tr');
                    expect(rows[0].textContent).toContain('SR-0005'); // 2026-05-01, earliest
                    expect(rows[4].textContent).toContain('SR-0001'); // 2026-07-27, latest

                    shiftDateHeader.click();

                    return Promise.resolve().then(() => {
                        rows = element.shadowRoot.querySelectorAll('tbody tr');
                        expect(rows[0].textContent).toContain('SR-0001');
                        expect(rows[4].textContent).toContain('SR-0005');
                    });
                });
            });
        });
    });

    it('downloads the CSV in the currently sorted order', () => {
        const element = createElement('c-staffing-request-reporting', { is: StaffingRequestReporting });
        document.body.appendChild(element);

        getMyRequests.emit(mockRequests);

        return Promise.resolve().then(() => {
            const allButton = Array.from(element.shadowRoot.querySelectorAll('.reporting__preset')).find(
                (button) => button.textContent === 'All'
            );
            allButton.click();

            return Promise.resolve().then(() => {
                const shiftDateHeader = Array.from(element.shadowRoot.querySelectorAll('th')).find((th) =>
                    th.textContent.includes('Shift Date')
                );
                shiftDateHeader.click();

                return Promise.resolve().then(() => {
                    const downloadButton = element.shadowRoot.querySelector('lightning-button');
                    downloadButton.click();

                    const csvContent = decodeURIComponent(createdLinks[0].href);
                    const firstDataRow = csvContent.split('\n')[1];
                    expect(firstDataRow).toContain('SR-0005');
                });
            });
        });
    });

    it('shows the previous calendar week (Mon-Sun) when Last Week is selected', () => {
        const element = createElement('c-staffing-request-reporting', { is: StaffingRequestReporting });
        document.body.appendChild(element);

        getMyRequests.emit(mockRequests);

        return Promise.resolve().then(() => {
            const lastWeekButton = Array.from(element.shadowRoot.querySelectorAll('.reporting__preset')).find(
                (button) => button.textContent === 'Last Week'
            );
            lastWeekButton.click();

            return Promise.resolve().then(() => {
                const tableText = element.shadowRoot.querySelector('.reporting__table').textContent;
                expect(tableText).toContain('SR-0002');
                expect(tableText).toContain('SR-0003');
                expect(tableText).not.toContain('SR-0001');
                expect(tableText).not.toContain('SR-0004');
            });
        });
    });

    it('shows the previous calendar month when Last Month is selected', () => {
        const element = createElement('c-staffing-request-reporting', { is: StaffingRequestReporting });
        document.body.appendChild(element);

        getMyRequests.emit(mockRequests);

        return Promise.resolve().then(() => {
            const lastMonthButton = Array.from(element.shadowRoot.querySelectorAll('.reporting__preset')).find(
                (button) => button.textContent === 'Last Month'
            );
            lastMonthButton.click();

            return Promise.resolve().then(() => {
                const rows = element.shadowRoot.querySelectorAll('tbody tr');
                expect(rows).toHaveLength(1);
                expect(rows[0].textContent).toContain('SR-0004');
            });
        });
    });

    it('prompts for both dates when Custom Range is selected with nothing entered yet', () => {
        const element = createElement('c-staffing-request-reporting', { is: StaffingRequestReporting });
        document.body.appendChild(element);

        getMyRequests.emit(mockRequests);

        return Promise.resolve().then(() => {
            const customButton = Array.from(element.shadowRoot.querySelectorAll('.reporting__preset')).find(
                (button) => button.textContent === 'Custom Range'
            );
            customButton.click();

            return Promise.resolve().then(() => {
                const empty = element.shadowRoot.querySelector('.reporting__empty');
                expect(empty.textContent).toBe('Select both a From and To date to see results.');
            });
        });
    });

    it('filters by a custom date range once both From and To are set', () => {
        const element = createElement('c-staffing-request-reporting', { is: StaffingRequestReporting });
        document.body.appendChild(element);

        getMyRequests.emit(mockRequests);

        return Promise.resolve().then(() => {
            const customButton = Array.from(element.shadowRoot.querySelectorAll('.reporting__preset')).find(
                (button) => button.textContent === 'Custom Range'
            );
            customButton.click();

            return Promise.resolve().then(() => {
                const [fromInput, toInput] = element.shadowRoot.querySelectorAll('lightning-input');
                fromInput.value = '2026-04-01';
                fromInput.dispatchEvent(new CustomEvent('change'));
                toInput.value = '2026-05-31';
                toInput.dispatchEvent(new CustomEvent('change'));

                return Promise.resolve().then(() => {
                    const rows = element.shadowRoot.querySelectorAll('tbody tr');
                    expect(rows).toHaveLength(1);
                    expect(rows[0].textContent).toContain('SR-0005');
                });
            });
        });
    });

    it('disables Download CSV when there are no results, and downloads a CSV when there are', () => {
        const element = createElement('c-staffing-request-reporting', { is: StaffingRequestReporting });
        document.body.appendChild(element);

        getMyRequests.emit(mockRequests);

        return Promise.resolve().then(() => {
            const customButton = Array.from(element.shadowRoot.querySelectorAll('.reporting__preset')).find(
                (button) => button.textContent === 'Custom Range'
            );
            customButton.click();

            return Promise.resolve().then(() => {
                const downloadButton = element.shadowRoot.querySelector('lightning-button');
                expect(downloadButton.disabled).toBe(true);

                const lastWeekButton = Array.from(
                    element.shadowRoot.querySelectorAll('.reporting__preset')
                ).find((button) => button.textContent === 'Last Week');
                lastWeekButton.click();

                return Promise.resolve().then(() => {
                    expect(downloadButton.disabled).toBe(false);

                    downloadButton.click();

                    expect(createdLinks).toHaveLength(1);
                    expect(createdLinks[0].download).toBe('staffing-requests-2026-07-20-to-2026-07-26.csv');
                    expect(createdLinks[0].href.startsWith('data:text/csv;charset=utf-8,')).toBe(true);
                    expect(decodeURIComponent(createdLinks[0].href)).toContain('SR-0002');
                    expect(decodeURIComponent(createdLinks[0].href)).toContain('SR-0003');
                    expect(createdLinks[0].click).toHaveBeenCalledTimes(1);
                });
            });
        });
    });

    it('shows an error message when the wire adapter errors', () => {
        const element = createElement('c-staffing-request-reporting', { is: StaffingRequestReporting });
        document.body.appendChild(element);

        getMyRequests.error();

        return Promise.resolve().then(() => {
            const errorEl = element.shadowRoot.querySelector('.slds-text-color_error');
            expect(errorEl).not.toBeNull();
        });
    });
});
