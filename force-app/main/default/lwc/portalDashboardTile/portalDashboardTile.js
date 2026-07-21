import { LightningElement, api } from 'lwc';

export default class PortalDashboardTile extends LightningElement {
    @api label;
    @api value;
    @api variant = 'default';

    /**
     * Optional. When set, the tile is clickable and dispatches 'tileclick'
     * with this value in detail.filterKey - callers decide what it means
     * (e.g. portalHomeDashboard uses it to navigate to a filtered list).
     * Tiles without a filterKey render as plain, non-interactive summaries.
     */
    @api filterKey;

    get tileClass() {
        const base = this.variant === 'warning' ? 'portal-tile portal-tile_warning' : 'portal-tile';
        return this.isClickable ? `${base} portal-tile_clickable` : base;
    }

    get isClickable() {
        return !!this.filterKey;
    }

    get isNotClickable() {
        return !this.isClickable;
    }

    handleClick() {
        if (this.filterKey) {
            this.dispatchEvent(new CustomEvent('tileclick', { detail: { filterKey: this.filterKey } }));
        }
    }
}
