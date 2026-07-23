import { LightningElement, wire } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import { CurrentPageReference } from 'lightning/navigation';
import getMyRequests from '@salesforce/apex/StaffingRequestController.getMyRequests';

const NOT_OPEN_STATUSES = ['Filled', 'Unable to Fill', 'Cancelled'];

const FILTER_LABELS = {
    open: 'Open Requests',
    unfilled: 'Unfilled Shifts'
};

// Apex Time fields come back over the wire as milliseconds since midnight
// (a number, not a time string), so format it ourselves rather than relying
// on lightning-formatted-time's expected input shape.
function formatTime(value) {
    if (value === null || value === undefined || value === '') {
        return '';
    }
    if (typeof value === 'string' && value.includes(':')) {
        const [hours, minutes] = value.split(':');
        return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`;
    }
    const totalMillis = Number(value);
    if (Number.isNaN(totalMillis)) {
        return '';
    }
    const totalMinutes = Math.floor(totalMillis / 60000);
    const hours = Math.floor(totalMinutes / 60) % 24;
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export default class MyStaffingRequests extends LightningElement {
    allRequests = [];
    error;
    activeFilter;

    @wire(CurrentPageReference)
    setCurrentPageReference(pageReference) {
        const filter = pageReference && pageReference.state && pageReference.state.filter;
        this.activeFilter = FILTER_LABELS[filter] ? filter : undefined;
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

    get requests() {
        if (this.activeFilter === 'open') {
            return this.allRequests.filter((request) => !NOT_OPEN_STATUSES.includes(request.status));
        }
        if (this.activeFilter === 'unfilled') {
            return this.allRequests.filter((request) => request.status === 'Unable to Fill');
        }
        return this.allRequests;
    }

    get hasActiveFilter() {
        return !!this.activeFilter;
    }

    get activeFilterLabel() {
        return this.activeFilter ? FILTER_LABELS[this.activeFilter] : '';
    }

    get hasRequests() {
        return this.requests.length > 0;
    }

    get emptyStateMessage() {
        return this.hasActiveFilter
            ? `No requests match "${this.activeFilterLabel}".`
            : 'No staffing requests yet.';
    }

    get hasError() {
        return !!this.error;
    }

    handleClearFilter() {
        this.activeFilter = undefined;
    }
}
