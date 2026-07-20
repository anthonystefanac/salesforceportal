import { LightningElement, wire } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import getPendingTimesheets from '@salesforce/apex/TimesheetController.getPendingTimesheets';

export default class TimesheetApprovalList extends LightningElement {
    timesheets = [];
    error;
    selectedTimesheetId;
    selectedStaffingRequestId;
    wiredResult;

    @wire(getPendingTimesheets)
    wiredTimesheets(result) {
        this.wiredResult = result;
        const { data, error } = result;
        if (data) {
            this.timesheets = data.map((timesheet) => ({
                id: timesheet.Id,
                name: timesheet.Name,
                requestId: timesheet.Staffing_Request__c,
                requestName: timesheet.Staffing_Request__r ? timesheet.Staffing_Request__r.Name : '',
                facilityName:
                    timesheet.Staffing_Request__r && timesheet.Staffing_Request__r.Facility__r
                        ? timesheet.Staffing_Request__r.Facility__r.Name
                        : '',
                workerName: timesheet.Contact__r ? timesheet.Contact__r.Name : '',
                shiftDate: timesheet.Shift_Date__c,
                hoursWorked: timesheet.Hours_Worked__c
            }));
            this.error = undefined;
        } else if (error) {
            this.error = error;
            this.timesheets = [];
        }
    }

    get hasTimesheets() {
        return this.timesheets.length > 0;
    }

    get hasError() {
        return !!this.error;
    }

    get hasSelection() {
        return !!this.selectedTimesheetId;
    }

    handleSelect(event) {
        const timesheetId = event.currentTarget.dataset.id;
        const selected = this.timesheets.find((timesheet) => timesheet.id === timesheetId);
        this.selectedTimesheetId = timesheetId;
        this.selectedStaffingRequestId = selected ? selected.requestId : undefined;
    }

    handleTimesheetUpdated() {
        this.selectedTimesheetId = undefined;
        this.selectedStaffingRequestId = undefined;
        return refreshApex(this.wiredResult);
    }
}
