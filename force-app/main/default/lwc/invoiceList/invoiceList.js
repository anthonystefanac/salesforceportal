import { LightningElement, wire } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import getInvoices from '@salesforce/apex/InvoiceController.getInvoices';

export default class InvoiceList extends NavigationMixin(LightningElement) {
    invoices = [];
    error;

    @wire(getInvoices)
    wiredInvoices({ data, error }) {
        if (data) {
            this.invoices = data;
            this.error = undefined;
        } else if (error) {
            this.error = error;
            this.invoices = [];
        }
    }

    get hasInvoices() {
        return this.invoices.length > 0;
    }

    get hasError() {
        return !!this.error;
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
