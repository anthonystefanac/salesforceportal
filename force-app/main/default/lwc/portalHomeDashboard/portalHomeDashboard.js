import { LightningElement, wire } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import getDashboardSummary from '@salesforce/apex/PortalDashboardController.getDashboardSummary';

// Must match the Experience Builder page's Name for My Requests once the
// site is built in Setup - that page doesn't exist until then, so this is a
// placeholder. Confirm/update it after running through the README's
// "Experience Cloud site setup" section.
const MY_REQUESTS_PAGE_NAME = 'My-Requests';

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

    get hasError() {
        return !!this.error;
    }

    handleTileClick(event) {
        this[NavigationMixin.Navigate]({
            type: 'comm__namedPage',
            attributes: { name: MY_REQUESTS_PAGE_NAME },
            state: { filter: event.detail.filterKey }
        });
    }
}
