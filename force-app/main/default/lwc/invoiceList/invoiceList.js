import { LightningElement, wire } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import { NavigationMixin, CurrentPageReference } from 'lightning/navigation';
import { formatDate } from 'c/dateFormatUtils';
import { sortRecords, toggleSort, buildSortableColumns } from 'c/sortTableUtils';
import getInvoices from '@salesforce/apex/InvoiceController.getInvoices';
import getInvoiceFileIds from '@salesforce/apex/InvoiceController.getInvoiceFileIds';

const FILTER_LABELS = {
    overdue: 'Overdue Invoices'
};

const COLUMNS = [
    { key: 'Invoice_Number__c', label: 'Invoice Number' },
    { key: 'Invoice_Date__c', label: 'Invoice Date' },
    { key: 'Due_Date__c', label: 'Due Date' },
    { key: 'Amount__c', label: 'Amount' },
    { key: 'Status__c', label: 'Status' }
];

const SEARCH_FIELDS = ['Invoice_Number__c', 'Status__c'];

export default class InvoiceList extends NavigationMixin(LightningElement) {
    allInvoices = [];
    fileIdsByInvoiceId = {};
    error;
    activeFilter;
    searchTerm = '';
    sortField;
    sortDirection = 'asc';

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
            // Invoice_Date__c/Due_Date__c stay raw ISO (sorting depends on
            // lexicographic = chronological order) - the Display fields are
            // DD/MM/YYYY purely for the table cells.
            this.allInvoices = data.map((invoice) => ({
                ...invoice,
                invoiceDateDisplay: formatDate(invoice.Invoice_Date__c),
                dueDateDisplay: formatDate(invoice.Due_Date__c)
            }));
            this.error = undefined;
        } else if (error) {
            this.error = error;
            this.allInvoices = [];
        }
    }

    _wiredFileIdsResult;

    // A separate wire (rather than folding into getInvoices' own query)
    // since the file itself is a standard ContentVersion/ContentDocumentLink,
    // not a field on Invoice__c - keyed by invoice Id, merged onto each row
    // in the invoices getter below so it stays correct regardless of which
    // of the two wires resolves first.
    @wire(getInvoiceFileIds)
    wiredFileIds(result) {
        this._wiredFileIdsResult = result;
        const { data } = result;
        if (data) {
            this.fileIdsByInvoiceId = data;
        }
    }

    // A cacheable wire can otherwise serve a stale result on a fresh page
    // navigation - force a real server round-trip every time this component
    // (re)mounts.
    connectedCallback() {
        if (this._wiredInvoicesResult) {
            refreshApex(this._wiredInvoicesResult);
        }
        if (this._wiredFileIdsResult) {
            refreshApex(this._wiredFileIdsResult);
        }
    }

    get filteredInvoices() {
        if (this.activeFilter === 'overdue') {
            return this.allInvoices.filter((invoice) => invoice.Status__c === 'Overdue');
        }
        return this.allInvoices;
    }

    get invoices() {
        const term = this.searchTerm.trim().toLowerCase();
        const searched = term
            ? this.filteredInvoices.filter((invoice) =>
                  SEARCH_FIELDS.some((field) => {
                      const value = invoice[field];
                      return value && String(value).toLowerCase().includes(term);
                  })
              )
            : this.filteredInvoices;

        return sortRecords(searched, this.sortField, this.sortDirection).map((invoice) => {
            const fileId = this.fileIdsByInvoiceId[invoice.Id];
            return {
                ...invoice,
                fileId,
                viewLabel: fileId ? 'Download PDF' : 'View'
            };
        });
    }

    get columns() {
        return buildSortableColumns(COLUMNS, this.sortField, this.sortDirection, 'invoice-list__th');
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
        if (this.searchTerm.trim()) {
            return `No invoices match "${this.searchTerm.trim()}".`;
        }
        return this.hasActiveFilter ? `No invoices match "${this.activeFilterLabel}".` : 'No invoices yet.';
    }

    get hasError() {
        return !!this.error;
    }

    handleClearFilter() {
        this.activeFilter = undefined;
    }

    handleSearchChange(event) {
        this.searchTerm = event.target.value || '';
    }

    handleSort(event) {
        const field = event.currentTarget.dataset.field;
        if (!field) {
            return;
        }
        const next = toggleSort(this.sortField, this.sortDirection, field);
        this.sortField = next.field;
        this.sortDirection = next.direction;
    }

    handleView(event) {
        const invoiceId = event.currentTarget.dataset.id;
        const fileId = event.currentTarget.dataset.fileId;

        if (fileId) {
            // Salesforce's own file-download servlet path - a first-party,
            // same-origin URL, so a plain anchor click triggers a real
            // browser download here the same reliable way Reporting's CSV
            // download does. This is not the blob: URL approach that failed
            // on this site type (see Reporting's CSV download note) - it's
            // a normal navigation to a same-origin path, which behaves
            // exactly as it would in any web app.
            const link = document.createElement('a');
            link.href = `/sfc/servlet.shepherd/document/download/${fileId}`;
            link.target = '_blank';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            return;
        }

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
