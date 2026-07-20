import { LightningElement, api, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import createRequest from '@salesforce/apex/StaffingRequestController.createRequest';

const DEFAULT_FORM = {
    facilityId: undefined,
    wardId: undefined,
    role: undefined,
    specialty: undefined,
    shiftDate: undefined,
    startTime: undefined,
    endTime: undefined,
    quantity: 1,
    priority: 'Medium',
    notes: undefined
};

const ROLE_OPTIONS = [
    { label: 'Registered Nurse', value: 'Registered Nurse' },
    { label: 'Enrolled Nurse', value: 'Enrolled Nurse' },
    { label: 'Personal Care Assistant', value: 'Personal Care Assistant' },
    { label: 'Allied Health', value: 'Allied Health' },
    { label: 'Administration', value: 'Administration' },
    { label: 'Other', value: 'Other' }
];

const PRIORITY_OPTIONS = [
    { label: 'Low', value: 'Low' },
    { label: 'Medium', value: 'Medium' },
    { label: 'High', value: 'High' },
    { label: 'Urgent', value: 'Urgent' }
];

export default class RequestStaffForm extends LightningElement {
    roleOptions = ROLE_OPTIONS;
    priorityOptions = PRIORITY_OPTIONS;
    isSubmitting = false;

    @track formData = { ...DEFAULT_FORM };

    _defaultDate;

    /**
     * Set by callers (e.g. requestStaffCalendar) to pre-fill Shift Date.
     * A setter rather than a plain field so a later change - picking a
     * different calendar day while this form instance stays mounted -
     * updates the field live, not just on first render.
     */
    @api
    get defaultDate() {
        return this._defaultDate;
    }

    set defaultDate(value) {
        this._defaultDate = value;
        if (value) {
            this.formData = { ...this.formData, shiftDate: value };
        }
    }

    handleFacilityChange(event) {
        // Wards belong to a single facility, so a wider selection resets any
        // ward chosen for the previous facility.
        this.formData = { ...this.formData, facilityId: event.detail.facilityId, wardId: undefined };
    }

    handleWardChange(event) {
        this.formData = { ...this.formData, wardId: event.detail.wardId };
    }

    handleFieldChange(event) {
        const field = event.target.dataset.field;
        this.formData = { ...this.formData, [field]: event.target.value };
    }

    get isSubmitDisabled() {
        return this.isSubmitting;
    }

    async handleSubmit() {
        this.isSubmitting = true;
        try {
            const newRequest = {
                Facility__c: this.formData.facilityId,
                Ward__c: this.formData.wardId,
                Role__c: this.formData.role,
                Specialty__c: this.formData.specialty,
                Shift_Date__c: this.formData.shiftDate,
                Start_Time__c: this.formData.startTime,
                End_Time__c: this.formData.endTime,
                Quantity__c: this.formData.quantity,
                Priority__c: this.formData.priority,
                Notes__c: this.formData.notes
            };
            const newRequestId = await createRequest({ newRequest });
            // Re-apply defaultDate so a caller (e.g. requestStaffCalendar) can
            // submit multiple requests for the same selected day in a row.
            this.formData = { ...DEFAULT_FORM, shiftDate: this._defaultDate };
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Request submitted',
                    message: 'Your staffing request has been submitted.',
                    variant: 'success'
                })
            );
            this.dispatchEvent(
                new CustomEvent('requestcreated', { detail: { requestId: newRequestId } })
            );
        } catch (error) {
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Unable to submit request',
                    message: (error && error.body && error.body.message) || 'An unexpected error occurred.',
                    variant: 'error'
                })
            );
        } finally {
            this.isSubmitting = false;
        }
    }
}
