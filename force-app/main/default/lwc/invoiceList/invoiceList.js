import { LightningElement, wire } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import { NavigationMixin, CurrentPageReference } from 'lightning/navigation';
import getInvoices from '@salesforce/apex/InvoiceController.getInvoices';

const FILTER_LABELS = {
    overdue: 'Overdue Invoices'
};

export default class InvoiceList extends NavigationMixin(LightningElement) {
    allInvoices = [];
    error;
    activeFilter;

    @wire(CurrentPageReference)
    setCurrentPageReference(pageReference) {
        const filter = pageReference && pageReference.state && pageReference.state.filter;
        this.activeFilter = FILTER_LABELS[filter] ? filter : undefined;
    }

    _wiredInvoicesResult;

    @wire(getInvoices)
    wiredInvoices(result) {
        this._wiredInvoicesResult = result;
        const { data, error } = result;
        if (data) {
            this.allInvoices = data;
            this.error = undefined;
        } else if (error) {
            this.error = error;
            this.allInvoices = [];
        }
    }

    // A cacheable wire can otherwise serve a stale result on a fresh page
    // navigation - force a real server round-trip every time this component
    // (re)mounts.
    connectedCallback() {
        if (this._wiredInvoicesResult) {
            refreshApex(this._wiredInvoicesResult);
        }
    }

    get invoices() {
        if (this.activeFilter === 'overdue') {
            return this.allInvoices.filter((invoice) => invoice.Status__c === 'Overdue');
        }
        return this.allInvoices;
    }

    get hasActiveFilter() {
        return !!this.activeFilter;
    }

    get activeFilterLabel() {
        return this.activeFilter ? FILTER_LABELS[this.activeFilter] : '';
    }

    get hasInvoices() {
        return this.invoices.length > 0;
    }

    get emptyStateMessage() {
        return this.hasActiveFilter ? `No invoices match "${this.activeFilterLabel}".` : 'No invoices yet.';
    }

    get hasError() {
        return !!this.error;
    }

    handleClearFilter() {
        this.activeFilter = undefined;
    }

    handleView(event) {
        const invoiceId = event.currentTarget.dataset.id;
        this[NavigationMixin.Navigate]({
            type: 'standard__recordPage',
            attributes: {
                recordId: invoiceId,
                objectApiName: 'Invoice__c',
                actionName: 'view'
            }
        });
    }
}
