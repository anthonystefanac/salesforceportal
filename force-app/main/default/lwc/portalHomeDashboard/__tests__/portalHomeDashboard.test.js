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

    it('navigates to My Requests with the matching filter when a tile is clicked', () => {
        const element = createElement('c-portal-home-dashboard', {
            is: PortalHomeDashboard
        });
        document.body.appendChild(element);

        getDashboardSummary.emit(mockSummary);

        return Promise.resolve().then(() => {
            const tiles = element.shadowRoot.querySelectorAll('c-portal-dashboard-tile');
            tiles[1].dispatchEvent(new CustomEvent('tileclick', { detail: { filterKey: 'at-risk' } }));

            expect(mockNavigate).toHaveBeenCalledTimes(1);
            const pageReference = mockNavigate.mock.calls[0][0];
            expect(pageReference.type).toBe('comm__namedPage');
            expect(pageReference.state.filter).toBe('at-risk');
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
