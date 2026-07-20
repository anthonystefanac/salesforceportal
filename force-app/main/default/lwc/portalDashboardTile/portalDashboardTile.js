import { LightningElement, api } from 'lwc';

export default class PortalDashboardTile extends LightningElement {
    @api label;
    @api value;
    @api variant = 'default';

    get tileClass() {
        return this.variant === 'warning'
            ? 'portal-tile portal-tile_warning'
            : 'portal-tile';
    }
}
