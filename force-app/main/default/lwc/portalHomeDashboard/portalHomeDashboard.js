import { LightningElement, wire } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import getDashboardSummary from '@salesforce/apex/PortalDashboardController.getDashboardSummary';

// Page names match the actual Experience Builder pages' API Name, as built
// in the org (Setup -> Digital Experiences -> Builder -> page settings).
const TILE_NAVIGATION = {
    open: { pageName: 'My_Requests__c', state: { filter: 'open' } },
    'at-risk': { pageName: 'My_Requests__c', state: { filter: 'at-risk' } },
    overdue: { pageName: 'Invoices__c', state: { filter: 'overdue' } }
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
