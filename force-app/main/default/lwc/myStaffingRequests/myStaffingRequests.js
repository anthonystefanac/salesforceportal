import { LightningElement, wire } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import { CurrentPageReference } from 'lightning/navigation';
import { formatTime } from 'c/timeFormatUtils';
import getMyRequests from '@salesforce/apex/StaffingRequestController.getMyRequests';

const NOT_OPEN_STATUSES = ['Filled', 'Unable to Fill', 'Cancelled'];

const FILTER_LABELS = {
    open: 'Open Requests',
    unfilled: 'Unfilled Shifts'
};

const COLUMNS = [
    { key: 'name', label: 'Request' },
    { key: 'facilityName', label: 'Facility' },
    { key: 'wardName', label: 'Ward' },
    { key: 'role', label: 'Role' },
    { key: 'specialty', label: 'Specialty' },
    { key: 'shiftDate', label: 'Shift Date' },
    { key: 'startTime', label: 'Start Time' },
    { key: 'endTime', label: 'End Time' },
    { key: 'quantity', label: 'Quantity' },
    { key: 'priority', label: 'Priority' },
    { key: 'status', label: 'Status' },
    { key: 'broadcasted', label: 'Broadcasted' },
    { key: 'cancellationRequested', label: 'Cancellation Requested' },
    { key: 'lastUpdate', label: 'Last Update' }
];

const SEARCH_FIELDS = ['name', 'facilityName', 'wardName', 'role', 'specialty', 'status'];

export default class MyStaffingRequests extends LightningElement {
    allRequests = [];
    error;
    activeFilter;
    dateFilter;
    searchTerm = '';
    sortField;
    sortDirection = 'asc';

    @wire(CurrentPageReference)
    setCurrentPageReference(pageReference) {
        const state = pageReference && pageReference.state;
        const filter = state && state.filter;
        this.activeFilter = FILTER_LABELS[filter] ? filter : undefined;
        this.dateFilter = (state && state.shiftDate) || undefined;
    }

    _wiredRequestsResult;

    @wire(getMyRequests)
    wiredRequests(result) {
        this._wiredRequestsResult = result;
        const { data, error } = result;
        if (data) {
            this.allRequests = data.map((request) => ({
                id: request.Id,
                name: request.Name,
                facilityName: request.Facility__r ? request.Facility__r.Name : '',
                wardName: request.Ward__r ? request.Ward__r.Name : '—',
                role: request.Role__c,
                specialty: request.Specialty__c || '—',
                shiftDate: request.Shift_Date__c,
                startTime: formatTime(request.Start_Time__c),
                endTime: formatTime(request.End_Time__c),
                quantity: request.Quantity__c,
                priority: request.Priority__c,
                status: request.Status__c,
                broadcasted: request.Broadcasted_Date__c ? 'Yes' : 'No',
                cancellationRequested: request.Cancellation_Requested__c ? 'Yes' : 'No',
                lastUpdate: request.Last_Status_Update__c
            }));
            this.error = undefined;
        } else if (error) {
            this.error = error;
            this.allRequests = [];
        }
    }

    // A cacheable wire can otherwise serve a stale result on a fresh page
    // navigation - force a real server round-trip every time this component
    // (re)mounts, e.g. arriving here right after submitting a new request.
    connectedCallback() {
        if (this._wiredRequestsResult) {
            refreshApex(this._wiredRequestsResult);
        }
    }

    get filteredRequests() {
        if (this.dateFilter) {
            return this.allRequests.filter((request) => request.shiftDate === this.dateFilter);
        }
        if (this.activeFilter === 'open') {
            return this.allRequests.filter((request) => !NOT_OPEN_STATUSES.includes(request.status));
        }
        if (this.activeFilter === 'unfilled') {
            return this.allRequests.filter((request) => request.status === 'Unable to Fill');
        }
        return this.allRequests;
    }

    get requests() {
        const term = this.searchTerm.trim().toLowerCase();
        const searched = term
            ? this.filteredRequests.filter((request) =>
                  SEARCH_FIELDS.some((field) => {
                      const value = request[field];
                      return value && String(value).toLowerCase().includes(term);
                  })
              )
            : this.filteredRequests;

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
                cssClass: isSorted ? 'my-requests__th my-requests__th_sorted' : 'my-requests__th',
                ariaSort: isSorted ? (direction === 'desc' ? 'descending' : 'ascending') : 'none',
                indicator: isSorted ? (direction === 'desc' ? '▼' : '▲') : ''
            };
        });
    }

    get hasActiveFilter() {
        return !!this.activeFilter || !!this.dateFilter;
    }

    get activeFilterLabel() {
        if (this.dateFilter) {
            return `Shift Date: ${this.dateFilter}`;
        }
        return this.activeFilter ? FILTER_LABELS[this.activeFilter] : '';
    }

    get hasRequests() {
        return this.requests.length > 0;
    }

    get emptyStateMessage() {
        if (this.searchTerm.trim()) {
            return `No requests match "${this.searchTerm.trim()}".`;
        }
        return this.hasActiveFilter
            ? `No requests match "${this.activeFilterLabel}".`
            : 'No staffing requests yet.';
    }

    get hasError() {
        return !!this.error;
    }

    handleClearFilter() {
        this.activeFilter = undefined;
        this.dateFilter = undefined;
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
}
