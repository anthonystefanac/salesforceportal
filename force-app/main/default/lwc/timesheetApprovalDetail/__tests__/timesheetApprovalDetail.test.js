import { createElement } from 'lwc';
import TimesheetApprovalDetail from 'c/timesheetApprovalDetail';
import getTimesheetHistory from '@salesforce/apex/TimesheetController.getTimesheetHistory';
import approveTimesheet from '@salesforce/apex/TimesheetController.approveTimesheet';
import queryTimesheet from '@salesforce/apex/TimesheetController.queryTimesheet';

const mockHistory = require('./data/getTimesheetHistory.json');

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

describe('c-timesheet-approval-detail', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
        jest.clearAllMocks();
    });

    it('renders the audit trail history', () => {
        const element = createElement('c-timesheet-approval-detail', { is: TimesheetApprovalDetail });
        element.timesheetId = 'a03000000000001AAA';
        element.staffingRequestId = 'a02000000000001AAA';
        document.body.appendChild(element);

        getTimesheetHistory.emit(mockHistory);

        return Promise.resolve().then(() => {
            const items = element.shadowRoot.querySelectorAll('.timesheet-detail__history li');
            expect(items).toHaveLength(1);
        });
    });

    it('calls approveTimesheet and dispatches timesheetupdated on approve', async () => {
        approveTimesheet.mockResolvedValue();

        const element = createElement('c-timesheet-approval-detail', { is: TimesheetApprovalDetail });
        element.timesheetId = 'a03000000000001AAA';
        const updatedHandler = jest.fn();
        element.addEventListener('timesheetupdated', updatedHandler);
        document.body.appendChild(element);

        const approveButton = element.shadowRoot.querySelectorAll('lightning-button')[0];
        approveButton.click();

        await Promise.resolve();
        await Promise.resolve();

        expect(approveTimesheet).toHaveBeenCalledWith({ timesheetId: 'a03000000000001AAA' });
        expect(updatedHandler).toHaveBeenCalledTimes(1);
    });

    it('calls queryTimesheet with the entered comment on query', async () => {
        queryTimesheet.mockResolvedValue();

        const element = createElement('c-timesheet-approval-detail', { is: TimesheetApprovalDetail });
        element.timesheetId = 'a03000000000001AAA';
        document.body.appendChild(element);

        const textarea = element.shadowRoot.querySelector('lightning-textarea');
        textarea.value = 'Please double check the hours.';
        textarea.dispatchEvent(new CustomEvent('change'));

        const queryButton = element.shadowRoot.querySelectorAll('lightning-button')[1];
        queryButton.click();

        await Promise.resolve();
        await Promise.resolve();

        expect(queryTimesheet).toHaveBeenCalledWith({
            timesheetId: 'a03000000000001AAA',
            comment: 'Please double check the hours.'
        });
    });
});
