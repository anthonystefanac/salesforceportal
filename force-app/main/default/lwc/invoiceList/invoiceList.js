import { LightningElement, wire } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import { NavigationMixin, CurrentPageReference } from 'lightning/navigation';
import getInvoices from '@salesforce/apex/InvoiceController.getInvoices';

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

        if (!this.sortField) {
            return searched;
        }
        const field = this.sortField;
        const direction = this.sortDirection === 'desc' ? -1 : 1;
        return [...searched].sort((a, b) => {
            const valueA = a[field];
            const valueB = b[field];
            if (valueA == null && valueB == null) {
                return 0;
            }
            if (valueA == null) {
                return -1 * direction;
            }
            if (valueB == null) {
                return 1 * direction;
            }
            if (typeof valueA === 'number' && typeof valueB === 'number') {
                return (valueA - valueB) * direction;
            }
            return String(valueA).localeCompare(String(valueB)) * direction;
        });
    }

    get columns() {
        return COLUMNS.map((column) => {
            const isSorted = this.sortField === column.key;
            const direction = isSorted ? this.sortDirection : undefined;
            return {
                ...column,
                cssClass: isSorted ? 'invoice-list__th invoice-list__th_sorted' : 'invoice-list__th',
                ariaSort: isSorted ? (direction === 'desc' ? 'descending' : 'ascending') : 'none',
                indicator: isSorted ? (direction === 'desc' ? '▼' : '▲') : ''
            };
        });
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
        if (this.sortField === field) {
            this.sortDirection = this.sortDirection === 'desc' ? 'asc' : 'desc';
        } else {
            this.sortField = field;
            this.sortDirection = 'asc';
        }
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
