import { LightningElement, wire } from 'lwc';
import getDashboardSummary from '@salesforce/apex/PortalDashboardController.getDashboardSummary';

export default class PortalHomeDashboard extends LightningElement {
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
}
