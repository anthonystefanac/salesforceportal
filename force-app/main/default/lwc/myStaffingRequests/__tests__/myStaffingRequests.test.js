import { createElement } from 'lwc';
import MyStaffingRequests from 'c/myStaffingRequests';
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

    it('renders a row with a status badge per request', () => {
        const element = createElement('c-my-staffing-requests', { is: MyStaffingRequests });
        document.body.appendChild(element);

        getMyRequests.emit(mockRequests);

        return Promise.resolve().then(() => {
            const rows = element.shadowRoot.querySelectorAll('tbody tr');
            expect(rows).toHaveLength(1);

            const badge = element.shadowRoot.querySelector('c-request-status-badge');
            expect(badge.status).toBe('Broadcasted');
        });
    });

    it('shows an empty state message when there are no requests', () => {
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
