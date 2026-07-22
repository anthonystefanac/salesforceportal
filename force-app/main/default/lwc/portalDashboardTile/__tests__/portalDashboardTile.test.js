import { createElement } from 'lwc';
import PortalDashboardTile from 'c/portalDashboardTile';

describe('c-portal-dashboard-tile', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
    });

    it('renders the label and value', () => {
        const element = createElement('c-portal-dashboard-tile', {
            is: PortalDashboardTile
        });
        element.label = 'Open Requests';
        element.value = 5;
        document.body.appendChild(element);

        const valueEl = element.shadowRoot.querySelector('.portal-tile__value');
        const labelEl = element.shadowRoot.querySelector('.portal-tile__label');
        expect(valueEl.textContent).toBe('5');
        expect(labelEl.textContent).toBe('Open Requests');
    });

    it('applies the default class when no variant is specified', () => {
        const element = createElement('c-portal-dashboard-tile', {
            is: PortalDashboardTile
        });
        element.label = 'Open Requests';
        element.value = 5;
        document.body.appendChild(element);

        const tile = element.shadowRoot.querySelector('.portal-tile');
        expect(tile.classList.contains('portal-tile_warning')).toBe(false);
    });

    it('applies the warning variant class when specified', () => {
        const element = createElement('c-portal-dashboard-tile', {
            is: PortalDashboardTile
        });
        element.label = 'Unfilled Shifts';
        element.value = 2;
        element.variant = 'warning';
        document.body.appendChild(element);

        const tile = element.shadowRoot.querySelector('.portal-tile');
        expect(tile.classList.contains('portal-tile_warning')).toBe(true);
    });

    it('is disabled and non-clickable when no filterKey is given', () => {
        const element = createElement('c-portal-dashboard-tile', {
            is: PortalDashboardTile
        });
        element.label = 'Open Requests';
        element.value = 5;
        document.body.appendChild(element);

        const tile = element.shadowRoot.querySelector('.portal-tile');
        expect(tile.disabled).toBe(true);
        expect(tile.classList.contains('portal-tile_clickable')).toBe(false);
    });

    it('dispatches tileclick with the filterKey when clicked', () => {
        const element = createElement('c-portal-dashboard-tile', {
            is: PortalDashboardTile
        });
        element.label = 'Open Requests';
        element.value = 5;
        element.filterKey = 'open';
        const handler = jest.fn();
        element.addEventListener('tileclick', handler);
        document.body.appendChild(element);

        const tile = element.shadowRoot.querySelector('.portal-tile');
        expect(tile.disabled).toBe(false);
        expect(tile.classList.contains('portal-tile_clickable')).toBe(true);

        tile.click();

        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler.mock.calls[0][0].detail.filterKey).toBe('open');
    });
});
