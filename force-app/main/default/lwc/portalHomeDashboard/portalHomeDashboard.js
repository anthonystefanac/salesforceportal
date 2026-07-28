import { LightningElement, wire } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import getDashboardSummary from '@salesforce/apex/PortalDashboardController.getDashboardSummary';

// Page names match the actual Experience Builder pages' API Name, as built
// in the org (Setup -> Digital Experiences -> Builder -> page settings).
// Reporting__c is a placeholder until that page exists in Experience
// Builder - confirm/update it the same way Request_Staff__c was confirmed
// in requestStaffCalendar.js.
const REPORTING_PAGE_NAME = 'Reporting__c';

// My Requests now only shows today-onwards shifts (see myStaffingRequests),
// and Unable to Fill is only ever set on a shift once its date has already
// passed - so that tile alone routes to Reporting instead, where it'd
// actually find something.
const TILE_NAVIGATION = {
    open: { pageName: 'My_Requests__c', state: { filter: 'open' } },
    unfilled: { pageName: REPORTING_PAGE_NAME },
    filled: { pageName: 'My_Requests__c', state: { filter: 'filled' } },
    cancelled: { pageName: 'My_Requests__c', state: { filter: 'cancelled' } },
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

    get unfilledShiftCount() {
        return this.summary ? this.summary.unfilledShiftCount : 0;
    }

    get filledShiftCount() {
        return this.summary ? this.summary.filledShiftCount : 0;
    }

    get cancelledShiftCount() {
        return this.summary ? this.summary.cancelledShiftCount : 0;
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
