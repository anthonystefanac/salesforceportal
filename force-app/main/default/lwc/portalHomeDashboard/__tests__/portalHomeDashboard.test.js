import { createElement } from 'lwc';
import PortalHomeDashboard from 'c/portalHomeDashboard';
import getDashboardSummary from '@salesforce/apex/PortalDashboardController.getDashboardSummary';

const mockSummary = require('./data/getDashboardSummary.json');

jest.mock(
    '@salesforce/apex/PortalDashboardController.getDashboardSummary',
    () => {
        const { createApexTestWireAdapter } = require('@salesforce/sfdx-lwc-jest');
        return {
            default: createApexTestWireAdapter(jest.fn())
        };
    },
    { virtual: true }
);

describe('c-portal-home-dashboard', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
        jest.clearAllMocks();
    });

    it('renders a dashboard tile per summary metric', () => {
        const element = createElement('c-portal-home-dashboard', {
            is: PortalHomeDashboard
        });
        document.body.appendChild(element);

        getDashboardSummary.emit(mockSummary);

        return Promise.resolve().then(() => {
            const tiles = element.shadowRoot.querySelectorAll('c-portal-dashboard-tile');
            expect(tiles).toHaveLength(2);
            expect(tiles[0].value).toBe(mockSummary.openRequestCount);
            expect(tiles[1].value).toBe(mockSummary.atRiskShiftCount);
            expect(tiles[1].variant).toBe('warning');
        });
    });

    it('shows an error message when the wire adapter errors', () => {
        const element = createElement('c-portal-home-dashboard', {
            is: PortalHomeDashboard
        });
        document.body.appendChild(element);

        getDashboardSummary.error();

        return Promise.resolve().then(() => {
            const errorEl = element.shadowRoot.querySelector('.slds-text-color_error');
            expect(errorEl).not.toBeNull();
            expect(element.shadowRoot.querySelectorAll('c-portal-dashboard-tile')).toHaveLength(0);
        });
    });
});
