import { LightningElement, wire } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import { formatTime } from 'c/timeFormatUtils';
import { formatDate, formatDateTime } from 'c/dateFormatUtils';
import { sortRecords, toggleSort, buildSortableColumns } from 'c/sortTableUtils';
import getMyRequests from '@salesforce/apex/StaffingRequestController.getMyRequests';

const PRESETS = [
    { key: 'all', label: 'All' },
    { key: 'last7', label: 'Last 7 Days' },
    { key: 'lastWeek', label: 'Last Week' },
    { key: 'lastMonth', label: 'Last Month' },
    { key: 'custom', label: 'Custom Range' }
];

const CSV_COLUMNS = [
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

function toIso(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}

function escapeCsvValue(value) {
    const stringValue = value === null || value === undefined ? '' : String(value);
    return `"${stringValue.replace(/"/g, '""')}"`;
}

export default class StaffingRequestReporting extends LightningElement {
    allRequests = [];
    error;
    activePreset = 'last7';
    customFrom;
    customTo;
    sortField;
    sortDirection = 'asc';

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
                // shiftDate/lastUpdate stay raw ISO (used for date-range
                // filtering/comparison, sorting, and the CSV export); the
                // *Display variants are DD/MM/YYYY purely for the on-screen
                // table cells.
                shiftDate: request.Shift_Date__c,
                shiftDateDisplay: formatDate(request.Shift_Date__c),
                startTime: formatTime(request.Start_Time__c),
                endTime: formatTime(request.End_Time__c),
                quantity: request.Quantity__c,
                priority: request.Priority__c,
                assignedContact: request.Assigned_Contact__c || '—',
                status: request.Status__c,
                broadcasted: request.Broadcasted_Date__c ? 'Yes' : 'No',
                cancellationRequested: request.Cancellation_Requested__c ? 'Yes' : 'No',
                lastUpdate: request.Last_Status_Update__c,
                lastUpdateDisplay: formatDateTime(request.Last_Status_Update__c)
            }));
            this.error = undefined;
        } else if (error) {
            this.error = error;
            this.allRequests = [];
        }
    }

    // A cacheable wire can otherwise serve a stale result on a fresh page
    // navigation - force a real server round-trip every time this component
    // (re)mounts, matching myStaffingRequests' pattern.
    connectedCallback() {
        if (this._wiredRequestsResult) {
            refreshApex(this._wiredRequestsResult);
        }
    }

    get presetButtons() {
        return PRESETS.map((preset) => ({
            ...preset,
            cssClass:
                this.activePreset === preset.key
                    ? 'reporting__preset reporting__preset_active'
                    : 'reporting__preset'
        }));
    }

    get isCustomActive() {
        return this.activePreset === 'custom';
    }

    // "Last 7 Days" is a rolling window ending today; "Last Week" and "Last
    // Month" are the most recently *completed* calendar week (Mon-Sun) and
    // month, not rolling windows - deliberately different shapes, matching
    // what was asked for.
    get effectiveRange() {
        const today = new Date();
        if (this.activePreset === 'all') {
            return { from: undefined, to: undefined };
        }
        if (this.activePreset === 'last7') {
            return { from: toIso(addDays(today, -6)), to: toIso(today) };
        }
        if (this.activePreset === 'lastWeek') {
            const dayOfWeek = today.getDay();
            const diffToMonday = (dayOfWeek + 6) % 7;
            const thisMonday = addDays(today, -diffToMonday);
            const lastMonday = addDays(thisMonday, -7);
            const lastSunday = addDays(lastMonday, 6);
            return { from: toIso(lastMonday), to: toIso(lastSunday) };
        }
        if (this.activePreset === 'lastMonth') {
            const firstOfThisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
            const lastMonthLastDay = addDays(firstOfThisMonth, -1);
            const lastMonthFirstDay = new Date(lastMonthLastDay.getFullYear(), lastMonthLastDay.getMonth(), 1);
            return { from: toIso(lastMonthFirstDay), to: toIso(lastMonthLastDay) };
        }
        return { from: this.customFrom, to: this.customTo };
    }

    get hasCompleteRange() {
        const { from, to } = this.effectiveRange;
        return !!from && !!to;
    }

    get rangeLabel() {
        const { from, to } = this.effectiveRange;
        return this.hasCompleteRange ? `${formatDate(from)} to ${formatDate(to)}` : '';
    }

    get filteredRequests() {
        if (this.activePreset === 'all') {
            return this.allRequests;
        }
        if (!this.hasCompleteRange) {
            return [];
        }
        const { from, to } = this.effectiveRange;
        return this.allRequests.filter(
            (request) => request.shiftDate && request.shiftDate >= from && request.shiftDate <= to
        );
    }

    // Same sort implementation as myStaffingRequests (shared via
    // sortTableUtils) - sorts on top of whatever the date-range filter
    // above has already narrowed down to.
    get sortedRequests() {
        return sortRecords(this.filteredRequests, this.sortField, this.sortDirection);
    }

    get columns() {
        return buildSortableColumns(CSV_COLUMNS, this.sortField, this.sortDirection, 'reporting__th');
    }

    get hasRequests() {
        return this.filteredRequests.length > 0;
    }

    get hasError() {
        return !!this.error;
    }

    get downloadDisabled() {
        return !this.hasRequests;
    }

    get emptyStateMessage() {
        if (this.isCustomActive && !this.hasCompleteRange) {
            return 'Select both a From and To date to see results.';
        }
        if (this.activePreset === 'all') {
            return 'No staffing requests yet.';
        }
        return `No staffing requests between ${this.rangeLabel}.`;
    }

    handleSelectPreset(event) {
        this.activePreset = event.currentTarget.dataset.preset;
    }

    handleCustomFromChange(event) {
        this.customFrom = event.target.value;
    }

    handleCustomToChange(event) {
        this.customTo = event.target.value;
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

    handleDownload() {
        const rows = this.sortedRequests;
        const header = CSV_COLUMNS.map((column) => escapeCsvValue(column.label)).join(',');
        const body = rows
            .map((row) => CSV_COLUMNS.map((column) => escapeCsvValue(row[column.key])).join(','))
            .join('\n');
        const csvContent = `${header}\n${body}`;

        // A Blob + URL.createObjectURL "blob:" link looked right but didn't
        // actually download anything on this Experience Cloud LWR site - the
        // anchor navigated to a blank page instead of triggering a save,
        // most likely the site's CSP (or Lightning Web Security's DOM
        // sandboxing) not treating blob: URLs the way a plain web app would.
        // A data: URI avoids that extra moving part entirely - the whole
        // file is encoded directly into the href, no separate object-URL
        // lifecycle (and thus no possible early-revocation race) involved.
        const rangeSuffix =
            this.activePreset === 'all' ? 'all' : `${this.effectiveRange.from}-to-${this.effectiveRange.to}`;

        const link = document.createElement('a');
        link.href = `data:text/csv;charset=utf-8,${encodeURIComponent(csvContent)}`;
        link.download = `staffing-requests-${rangeSuffix}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}
