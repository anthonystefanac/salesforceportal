import { LightningElement, api, track, wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { CurrentPageReference } from 'lightning/navigation';
import createRequest from '@salesforce/apex/StaffingRequestController.createRequest';

const DEFAULT_FORM = {
    facilityId: undefined,
    wardId: undefined,
    role: undefined,
    specialty: undefined,
    shiftDate: undefined,
    startTime: undefined,
    endTime: undefined,
    quantity: '1',
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

const MAX_QUANTITY = 10;
const QUANTITY_OPTIONS = Array.from({ length: MAX_QUANTITY }, (_, index) => {
    const value = String(index + 1);
    return { label: value, value };
});

export default class RequestStaffForm extends LightningElement {
    roleOptions = ROLE_OPTIONS;
    priorityOptions = PRIORITY_OPTIONS;
    quantityOptions = QUANTITY_OPTIONS;
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

    // The Calendar screen no longer embeds this form directly - it navigates
    // here with the chosen date in page state instead, so pick it up the
    // same way myStaffingRequests/invoiceList read their filter state.
    @wire(CurrentPageReference)
    setCurrentPageReference(pageReference) {
        const dateFromState = pageReference && pageReference.state && pageReference.state.defaultDate;
        if (dateFromState) {
            this.defaultDate = dateFromState;
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
        const value = event.target.value;
        const updates = { [field]: value };
        // Pre-fill End Time with the new Start Time as a starting point, but
        // only while End Time hasn't been set yet - don't clobber a value
        // the user already chose.
        if (field === 'startTime' && !this.formData.endTime) {
            updates.endTime = value;
        }
        this.formData = { ...this.formData, ...updates };
    }

    bannerMessage;
    bannerVariant;

    get isSubmitDisabled() {
        return this.isSubmitting;
    }

    get submitButtonLabel() {
        return this.isSubmitting ? 'Submitting…' : 'Submit Request';
    }

    get hasBanner() {
        return !!this.bannerMessage;
    }

    get bannerClass() {
        return this.bannerVariant === 'success'
            ? 'request-staff-form__banner request-staff-form__banner_success'
            : 'request-staff-form__banner request-staff-form__banner_error';
    }

    async handleSubmit() {
        this.bannerMessage = undefined;

        if (this.formData.startTime && this.formData.startTime === this.formData.endTime) {
            this.showBanner('error', 'End time cannot be the same as start time.');
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Unable to submit request',
                    message: 'End time cannot be the same as start time.',
                    variant: 'error'
                })
            );
            return;
        }

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
                Quantity__c: Number(this.formData.quantity),
                Priority__c: this.formData.priority,
                Notes__c: this.formData.notes
            };
            await createRequest({ newRequest });
            // Re-apply defaultDate so a caller (e.g. requestStaffCalendar) can
            // submit multiple requests for the same selected day in a row.
            this.formData = { ...DEFAULT_FORM, shiftDate: this._defaultDate };
            this.showBanner('success', 'Your staffing request has been submitted.');
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Request submitted',
                    message: 'Your staffing request has been submitted.',
                    variant: 'success'
                })
            );
        } catch (error) {
            const message = (error && error.body && error.body.message) || 'An unexpected error occurred.';
            this.showBanner('error', message);
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Unable to submit request',
                    message,
                    variant: 'error'
                })
            );
        } finally {
            this.isSubmitting = false;
        }
    }

    // The toast dispatches above are kept alongside this banner in case
    // ShowToastEvent does render in some context this component ends up in,
    // but this banner is the guaranteed feedback: Experience Cloud LWR
    // sites (this portal's site type) don't render platform toasts at all,
    // which is why a blocked submit could otherwise look like it silently
    // did nothing.
    showBanner(variant, message) {
        this.bannerVariant = variant;
        this.bannerMessage = message;
    }
}
