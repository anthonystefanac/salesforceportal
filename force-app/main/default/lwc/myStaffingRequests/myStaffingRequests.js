import { LightningElement, wire } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import { CurrentPageReference } from 'lightning/navigation';
import { formatTime } from 'c/timeFormatUtils';
import { formatDate, formatDateTime } from 'c/dateFormatUtils';
import { sortRecords, toggleSort, buildSortableColumns } from 'c/sortTableUtils';
import getMyRequests from '@salesforce/apex/StaffingRequestController.getMyRequests';
import createCase from '@salesforce/apex/SupportRequestController.createCase';

const NOT_OPEN_STATUSES = ['Filled', 'Unable to Fill', 'Cancelled'];
const CANCELLATION_BLOCKED_STATUSES = ['Filled', 'Unable to Fill', 'Cancelled'];

const FILTER_LABELS = {
    open: 'Open Requests',
    unfilled: 'Unable to Fill Shifts',
    filled: 'Filled Shifts',
    cancelled: 'Cancelled Shifts'
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
    { key: 'assignedContact', label: 'Assigned Contact' },
    { key: 'status', label: 'Status' },
    { key: 'broadcasted', label: 'Broadcasted' },
    { key: 'cancellationRequested', label: 'Cancellation Requested' },
    { key: 'lastUpdate', label: 'Last Update' }
];

const SEARCH_FIELDS = ['name', 'facilityName', 'wardName', 'role', 'specialty', 'status', 'assignedContact'];
const PAGE_SIZE = 10;

export default class MyStaffingRequests extends LightningElement {
    allRequests = [];
    error;
    activeFilter;
    dateFilter;
    searchTerm = '';
    // Default sort: newest request number first (SR-0004 needs the account's
    // Name auto-number to actually be zero-padded so descending string
    // comparison lines up with numeric order - Staffing_Request__c's is
    // "SR-{0000}", so this holds up to 9999 requests).
    sortField = 'name';
    sortDirection = 'desc';
    currentPage = 1;
    cancellingRequestId;
    bannerMessage;
    bannerVariant;

    @wire(CurrentPageReference)
    setCurrentPageReference(pageReference) {
        const state = pageReference && pageReference.state;
        const filter = state && state.filter;
        this.activeFilter = FILTER_LABELS[filter] ? filter : undefined;
        this.dateFilter = (state && state.shiftDate) || undefined;
        this.currentPage = 1;
    }

    _wiredRequestsResult;

    @wire(getMyRequests)
    wiredRequests(result) {
        this._wiredRequestsResult = result;
        const { data, error } = result;
        if (data) {
            this.allRequests = data.map((request) => {
                const cancellationRequested = !!request.Cancellation_Requested__c;
                return {
                    id: request.Id,
                    name: request.Name,
                    facilityName: request.Facility__r ? request.Facility__r.Name : '',
                    wardName: request.Ward__r ? request.Ward__r.Name : '—',
                    role: request.Role__c,
                    specialty: request.Specialty__c || '—',
                    // shiftDate/lastUpdate stay in their raw, lexicographically
                    // sortable/comparable form (ISO) - the *Display variants
                    // below are DD/MM/YYYY purely for what's shown in the
                    // table, computed once here rather than at render time.
                    shiftDate: request.Shift_Date__c,
                    shiftDateDisplay: formatDate(request.Shift_Date__c),
                    startTime: formatTime(request.Start_Time__c),
                    endTime: formatTime(request.End_Time__c),
                    quantity: request.Quantity__c,
                    priority: request.Priority__c,
                    assignedContact: request.Assigned_Contact__c || '—',
                    status: request.Status__c,
                    broadcasted: request.Broadcasted_Date__c ? 'Yes' : 'No',
                    cancellationRequested: cancellationRequested ? 'Yes' : 'No',
                    lastUpdate: request.Last_Status_Update__c,
                    lastUpdateDisplay: formatDateTime(request.Last_Status_Update__c),
                    canCancel: !cancellationRequested && !CANCELLATION_BLOCKED_STATUSES.includes(request.Status__c)
                };
            });
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
        if (this.activeFilter === 'filled') {
            return this.allRequests.filter((request) => request.status === 'Filled');
        }
        if (this.activeFilter === 'cancelled') {
            return this.allRequests.filter((request) => request.status === 'Cancelled');
        }
        return this.allRequests;
    }

    get sortedRequests() {
        const term = this.searchTerm.trim().toLowerCase();
        const searched = term
            ? this.filteredRequests.filter((request) =>
                  SEARCH_FIELDS.some((field) => {
                      const value = request[field];
                      return value && String(value).toLowerCase().includes(term);
                  })
              )
            : this.filteredRequests;

        return sortRecords(searched, this.sortField, this.sortDirection);
    }

    get totalPages() {
        return Math.max(1, Math.ceil(this.sortedRequests.length / PAGE_SIZE));
    }

    get safeCurrentPage() {
        return Math.min(this.currentPage, this.totalPages);
    }

    get requests() {
        const start = (this.safeCurrentPage - 1) * PAGE_SIZE;
        return this.sortedRequests.slice(start, start + PAGE_SIZE).map((request) => ({
            ...request,
            isCancelling: this.cancellingRequestId === request.id,
            cancelMenuLabel: this.cancellingRequestId === request.id ? 'Cancelling…' : 'Request Cancellation'
        }));
    }

    get hasMultiplePages() {
        return this.totalPages > 1;
    }

    get isFirstPage() {
        return this.safeCurrentPage <= 1;
    }

    get isLastPage() {
        return this.safeCurrentPage >= this.totalPages;
    }

    get paginationSummary() {
        const total = this.sortedRequests.length;
        if (total === 0) {
            return '';
        }
        const start = (this.safeCurrentPage - 1) * PAGE_SIZE + 1;
        const end = Math.min(start + PAGE_SIZE - 1, total);
        return `Showing ${start}–${end} of ${total}`;
    }

    get columns() {
        return buildSortableColumns(COLUMNS, this.sortField, this.sortDirection, 'my-requests__th');
    }

    get hasActiveFilter() {
        return !!this.activeFilter || !!this.dateFilter;
    }

    get activeFilterLabel() {
        if (this.dateFilter) {
            return `Shift Date: ${formatDate(this.dateFilter)}`;
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

    get hasBanner() {
        return !!this.bannerMessage;
    }

    get bannerClass() {
        return this.bannerVariant === 'success'
            ? 'my-requests__banner my-requests__banner_success'
            : 'my-requests__banner my-requests__banner_error';
    }

    handleClearFilter() {
        this.activeFilter = undefined;
        this.dateFilter = undefined;
        this.currentPage = 1;
    }

    handleSearchChange(event) {
        this.searchTerm = event.target.value || '';
        this.currentPage = 1;
    }

    handleSort(event) {
        const field = event.currentTarget.dataset.field;
        if (!field) {
            return;
        }
        const next = toggleSort(this.sortField, this.sortDirection, field);
        this.sortField = next.field;
        this.sortDirection = next.direction;
        this.currentPage = 1;
    }

    handlePreviousPage() {
        if (!this.isFirstPage) {
            this.currentPage = this.safeCurrentPage - 1;
        }
    }

    handleNextPage() {
        if (!this.isLastPage) {
            this.currentPage = this.safeCurrentPage + 1;
        }
    }

    async handleRequestCancellation(event) {
        if (event.detail.value !== 'cancel') {
            return;
        }
        const requestId = event.currentTarget.dataset.id;
        const request = this.allRequests.find((candidate) => candidate.id === requestId);
        if (!request) {
            return;
        }

        // eslint-disable-next-line no-alert
        const confirmed = window.confirm(
            `Request cancellation for ${request.name} (${request.shiftDateDisplay})? ` +
                `This will notify our team and email you a confirmation.`
        );
        if (!confirmed) {
            return;
        }

        this.bannerMessage = undefined;
        this.cancellingRequestId = requestId;
        try {
            const newCase = {
                Portal_Request_Type__c: 'Cancellation Request',
                Related_Staffing_Request__c: requestId,
                Subject: `Cancellation Request - ${request.name}`,
                Description:
                    `Cancellation requested via My Requests for the ${request.role} shift ` +
                    `at ${request.facilityName} on ${request.shiftDateDisplay}.`
            };
            await createCase({ newCase });
            this.bannerVariant = 'success';
            this.bannerMessage = `Cancellation requested for ${request.name}. Our team will follow up shortly.`;
            if (this._wiredRequestsResult) {
                await refreshApex(this._wiredRequestsResult);
            }
        } catch (error) {
            this.bannerVariant = 'error';
            this.bannerMessage = (error && error.body && error.body.message) || 'An unexpected error occurred.';
        } finally {
            this.cancellingRequestId = undefined;
        }
    }
}
