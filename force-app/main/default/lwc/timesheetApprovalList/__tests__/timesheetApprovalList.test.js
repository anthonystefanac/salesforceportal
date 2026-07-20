import { createElement } from 'lwc';
import TimesheetApprovalList from 'c/timesheetApprovalList';
import getPendingTimesheets from '@salesforce/apex/TimesheetController.getPendingTimesheets';

const mockTimesheets = require('./data/getPendingTimesheets.json');

jest.mock(
    '@salesforce/apex/TimesheetController.getPendingTimesheets',
    () => {
        const { createApexTestWireAdapter } = require('@salesforce/sfdx-lwc-jest');
        return {
            default: createApexTestWireAdapter(jest.fn())
        };
    },
    { virtual: true }
);

// timesheetApprovalList composes c-timesheet-approval-detail, whose module
// graph is resolved statically even when if:true keeps it unrendered, so its
// Apex imports need a mock here too.
jest.mock(
    '@salesforce/apex/TimesheetController.getTimesheetHistory',
    () => {
        const { createApexTestWireAdapter } = require('@salesforce/sfdx-lwc-jest');
        return {
            default: createApexTestWireAdapter(jest.fn())
        };
    },
    { virtual: true }
);
jest.mock(
    '@salesforce/apex/TimesheetController.approveTimesheet',
    () => ({ default: jest.fn() }),
    { virtual: true }
);
jest.mock(
    '@salesforce/apex/TimesheetController.queryTimesheet',
    () => ({ default: jest.fn() }),
    { virtual: true }
);

jest.mock('@salesforce/apex', () => ({ refreshApex: jest.fn() }), { virtual: true });

describe('c-timesheet-approval-list', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
        jest.clearAllMocks();
    });

    it('renders one item per pending timesheet', () => {
        const element = createElement('c-timesheet-approval-list', { is: TimesheetApprovalList });
        document.body.appendChild(element);

        getPendingTimesheets.emit(mockTimesheets);

        return Promise.resolve().then(() => {
            const items = element.shadowRoot.querySelectorAll('.timesheet-approval-list__item');
            expect(items).toHaveLength(1);
        });
    });

    it('shows the detail component with the correct ids once a timesheet is selected', () => {
        const element = createElement('c-timesheet-approval-list', { is: TimesheetApprovalList });
        document.body.appendChild(element);

        getPendingTimesheets.emit(mockTimesheets);

        return Promise.resolve().then(() => {
            const item = element.shadowRoot.querySelector('.timesheet-approval-list__item');
            item.dispatchEvent(new CustomEvent('click'));

            return Promise.resolve().then(() => {
                const detail = element.shadowRoot.querySelector('c-timesheet-approval-detail');
                expect(detail).not.toBeNull();
                expect(detail.timesheetId).toBe(mockTimesheets[0].Id);
                expect(detail.staffingRequestId).toBe(mockTimesheets[0].Staffing_Request__c);
            });
        });
    });

    it('shows an empty state message when there are no pending timesheets', () => {
        const element = createElement('c-timesheet-approval-list', { is: TimesheetApprovalList });
        document.body.appendChild(element);

        getPendingTimesheets.emit([]);

        return Promise.resolve().then(() => {
            const empty = element.shadowRoot.querySelector('.timesheet-approval-list__empty');
            expect(empty).not.toBeNull();
        });
    });
});
