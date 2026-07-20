import { LightningElement, wire } from 'lwc';
import getMyRequests from '@salesforce/apex/StaffingRequestController.getMyRequests';

export default class MyStaffingRequests extends LightningElement {
    requests = [];
    error;

    @wire(getMyRequests)
    wiredRequests({ data, error }) {
        if (data) {
            this.requests = data.map((request) => ({
                id: request.Id,
                name: request.Name,
                facilityName: request.Facility__r ? request.Facility__r.Name : '',
                role: request.Role__c,
                shiftDate: request.Shift_Date__c,
                status: request.Status__c,
                broadcasted: request.Broadcasted_Date__c ? 'Yes' : 'No',
                lastUpdate: request.Last_Status_Update__c
            }));
            this.error = undefined;
        } else if (error) {
            this.error = error;
            this.requests = [];
        }
    }

    get hasRequests() {
        return this.requests.length > 0;
    }

    get hasError() {
        return !!this.error;
    }
}
