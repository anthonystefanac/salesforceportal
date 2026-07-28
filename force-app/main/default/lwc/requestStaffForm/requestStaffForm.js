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

// Must exactly match Staffing_Request__c.Role__c's restricted picklist
// values - a mismatch here means the option would submit fine client-side
// but fail server-side with a picklist validation error.
const ROLE_OPTIONS = [
    { label: 'Clinical Nurse', value: 'Clinical Nurse' },
    { label: 'Registered Nurse', value: 'Registered Nurse' },
    { label: 'Registered Midwife', value: 'Registered Midwife' },
    { label: 'Enrolled Nurse', value: 'Enrolled Nurse' },
    { label: 'Nursing Assistant (AIN)', value: 'Nursing Assistant (AIN)' },
    { label: 'Personal Care Assistant', value: 'Personal Care Assistant' },
    { label: 'Kitchen Hand', value: 'Kitchen Hand' },
    { label: 'Pantry', value: 'Pantry' },
    { label: 'Food Services Assistant', value: 'Food Services Assistant' },
    { label: 'Cleaner', value: 'Cleaner' },
    { label: 'Laundry', value: 'Laundry' },
    { label: 'Assistant Cook', value: 'Assistant Cook' },
    { label: 'Cook', value: 'Cook' },
    { label: 'Chef', value: 'Chef' },
    { label: 'Head Chef Supervisor', value: 'Head Chef Supervisor' },
    { label: 'Allied Health', value: 'Allied Health' }
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

function todayIso() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Mirrors Staffing_Request__c's own required fields (Facility__c is a
// required Master-Detail relationship; Role__c/Shift_Date__c/Start_Time__c/
// End_Time__c/Priority__c/Quantity__c are all required=true on the object).
// Ward__c, Specialty__c, and Notes__c are genuinely optional, so they're
// left out. Quantity/Priority always carry a default value, so in practice
// they can't go blank through normal use - included anyway so this stays
// correct if those defaults ever change.
const REQUIRED_FIELDS = [
    { key: 'facilityId', label: 'Facility' },
    { key: 'role', label: 'Role' },
    { key: 'shiftDate', label: 'Shift Date' },
    { key: 'startTime', label: 'Start Time' },
    { key: 'endTime', label: 'End Time' },
    { key: 'quantity', label: 'Quantity' },
    { key: 'priority', label: 'Priority' }
];

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

    get minShiftDate() {
        return todayIso();
    }

    get bannerClass() {
        return this.bannerVariant === 'success'
            ? 'request-staff-form__banner request-staff-form__banner_success'
            : 'request-staff-form__banner request-staff-form__banner_error';
    }

    get missingRequiredFieldLabels() {
        return REQUIRED_FIELDS.filter((field) => !this.formData[field.key]).map((field) => field.label);
    }

    async handleSubmit() {
        this.bannerMessage = undefined;

        // `required` on these inputs only drives native validation UI when
        // something calls reportValidity() - report it for the "Complete
        // this field" styling on the fields owned directly by this
        // component (Facility/Ward live inside their own child components,
        // whose internal validity can't be reached from here). The actual
        // gate is the value check below, not this call's return value -
        // same reasoning as the Subject fix on the Support form: native
        // validity alone isn't trusted on this site type.
        this.template.querySelectorAll('lightning-input, lightning-combobox').forEach((element) => {
            element.reportValidity();
        });

        const missingLabels = this.missingRequiredFieldLabels;
        if (missingLabels.length > 0) {
            const message = `Please fill in: ${missingLabels.join(', ')}.`;
            this.showBanner('error', message);
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Unable to submit request',
                    message,
                    variant: 'error'
                })
            );
            return;
        }

        if (this.formData.shiftDate && this.formData.shiftDate < todayIso()) {
            this.showBanner('error', 'Shift date cannot be in the past.');
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Unable to submit request',
                    message: 'Shift date cannot be in the past.',
                    variant: 'error'
                })
            );
            return;
        }

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
