import { LightningElement, wire } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import getDashboardSummary from '@salesforce/apex/PortalDashboardController.getDashboardSummary';

// Page names must match the Experience Builder pages' Name once the site is
// built in Setup - those pages don't exist until then, so these are
// placeholders. Confirm/update them after running through the README's
// "Experience Cloud site setup" section.
const TILE_NAVIGATION = {
    open: { pageName: 'My-Requests', state: { filter: 'open' } },
    'at-risk': { pageName: 'My-Requests', state: { filter: 'at-risk' } },
    overdue: { pageName: 'Invoices', state: { filter: 'overdue' } }
};

export default class PortalHomeDashboard extends NavigationMixin(LightningElement) {
    summary;
    error;

    @wire(getDashboardSummary)
    wiredSummary({ data, error }) {
        if (data) {
            this.summary = data;
            this.error = undefined;
        } else if (error) {
            this.error = error;
            this.summary = undefined;
        }
    }

    get openRequestCount() {
        return this.summary ? this.summary.openRequestCount : 0;
    }

    get atRiskShiftCount() {
        return this.summary ? this.summary.atRiskShiftCount : 0;
    }

    get overdueInvoiceCount() {
        return this.summary ? this.summary.overdueInvoiceCount : 0;
    }

    get hasError() {
        return !!this.error;
    }

    handleTileClick(event) {
        const target = TILE_NAVIGATION[event.detail.filterKey];
        if (!target) {
            return;
        }
        this[NavigationMixin.Navigate]({
            type: 'comm__namedPage',
            attributes: { name: target.pageName },
            state: target.state
        });
    }
}
