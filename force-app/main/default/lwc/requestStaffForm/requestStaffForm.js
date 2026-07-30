import { LightningElement, api, track, wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { CurrentPageReference } from 'lightning/navigation';
import createRequest from '@salesforce/apex/StaffingRequestController.createRequest';

const DEFAULT_FORM = {
    facilityId: undefined,
    wardId: undefined,
    role: undefined,
    specialty: undefined,
    shiftDates: [],
    startTime: undefined,
    endTime: undefined,
    quantity: '1',
    priority: 'Standard',
    requestedBy: undefined,
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

// Must exactly match Staffing_Request__c.Priority__c's restricted picklist
// values - a mismatch here means the option would submit fine client-side
// but fail server-side with a picklist validation error.
const PRIORITY_OPTIONS = [
    { label: 'Standard', value: 'Standard' },
    { label: 'Urgent', value: 'Urgent' }
];

const MAX_QUANTITY = 10;
const QUANTITY_OPTIONS = Array.from({ length: MAX_QUANTITY }, (_, index) => {
    const value = String(index + 1);
    return { label: value, value };
});

function extractErrorMessage(error) {
    return (error && error.body && error.body.message) || 'an unexpected error occurred';
}

// Mirrors Staffing_Request__c's own required fields (Facility__c is a
// required Master-Detail relationship; Role__c/Shift_Date__c/Start_Time__c/
// End_Time__c/Priority__c/Quantity__c/Requested_By__c are all required=true
// on the object), in the same order they appear on the form. Ward__c,
// Specialty__c, and Notes__c are genuinely optional, so they're left out.
// Quantity/Priority always carry a default value, so in practice they can't
// go blank through normal use - included anyway so this stays correct if
// those defaults ever change. Shift Date is marked isArray: formData.shiftDates
// is an array of selected dates from c-block-date-picker, not a single
// truthy/falsy value, so "missing" means empty rather than falsy.
const REQUIRED_FIELDS = [
    { key: 'facilityId', label: 'Facility' },
    { key: 'role', label: 'Role' },
    { key: 'shiftDates', label: 'Shift Date', isArray: true },
    { key: 'priority', label: 'Priority' },
    { key: 'startTime', label: 'Start Time' },
    { key: 'endTime', label: 'End Time' },
    { key: 'quantity', label: 'Quantity' },
    { key: 'requestedBy', label: 'Requested By' }
];

export default class RequestStaffForm extends LightningElement {
    roleOptions = ROLE_OPTIONS;
    priorityOptions = PRIORITY_OPTIONS;
    quantityOptions = QUANTITY_OPTIONS;
    isSubmitting = false;

    @track formData = { ...DEFAULT_FORM };

    _defaultDate;

    /**
     * Set by callers (e.g. requestStaffCalendar) to pre-fill a Shift Date.
     * A setter rather than a plain field so a later change - picking a
     * different calendar day while this form instance stays mounted -
     * updates the field live, not just on first render. Passed straight
     * through to c-block-date-picker's own default-date, which is what
     * actually adds it to the selected-dates list and pre-selects it - this
     * component only tracks the raw value so the template binding stays
     * reactive.
     */
    @api
    get defaultDate() {
        return this._defaultDate;
    }

    set defaultDate(value) {
        this._defaultDate = value;
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

    handleDatesChange(event) {
        this.formData = { ...this.formData, shiftDates: event.detail.dates };
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

    get missingRequiredFieldLabels() {
        return REQUIRED_FIELDS.filter((field) => {
            const value = this.formData[field.key];
            return field.isArray ? !value || value.length === 0 : !value;
        }).map((field) => field.label);
    }

    async handleSubmit() {
        this.bannerMessage = undefined;

        // `required` on these inputs only drives native validation UI when
        // something calls reportValidity() - report it for the "Complete
        // this field" styling on the fields owned directly by this
        // component (Facility/Ward/Shift Date live inside their own child
        // components, whose internal validity can't be reached from here).
        // The actual gate is the value check below, not this call's return
        // value - same reasoning as the Subject fix on the Support form:
        // native validity alone isn't trusted on this site type.
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
            const baseRequest = {
                Facility__c: this.formData.facilityId,
                Ward__c: this.formData.wardId,
                Role__c: this.formData.role,
                Specialty__c: this.formData.specialty,
                Start_Time__c: this.formData.startTime,
                End_Time__c: this.formData.endTime,
                Quantity__c: Number(this.formData.quantity),
                Priority__c: this.formData.priority,
                Requested_By__c: this.formData.requestedBy,
                Notes__c: this.formData.notes
            };
            const shiftDates = this.formData.shiftDates;

            // One Apex call per selected date, all in flight together rather
            // than sequentially - a "block booking" of many days shouldn't
            // take N times as long as a single-date submit. Promise.allSettled
            // (not Promise.all) so one bad date - a stale Facility, an
            // unexpected server error - doesn't wipe out the rest, which
            // otherwise perfectly valid dates in the same block don't
            // deserve to be punished for.
            const results = await Promise.allSettled(
                shiftDates.map((shiftDate) =>
                    createRequest({ newRequest: { ...baseRequest, Shift_Date__c: shiftDate } })
                )
            );

            const succeededDates = shiftDates.filter((date, index) => results[index].status === 'fulfilled');
            const failedEntries = shiftDates
                .map((shiftDate, index) => ({ shiftDate, result: results[index] }))
                .filter((entry) => entry.result.status === 'rejected');

            if (failedEntries.length === 0) {
                const message =
                    shiftDates.length === 1
                        ? 'Your staffing request has been submitted.'
                        : `${shiftDates.length} staffing requests have been submitted.`;
                this.resetAfterSuccess();
                this.showBanner('success', message);
                this.dispatchEvent(
                    new ShowToastEvent({ title: 'Request submitted', message, variant: 'success' })
                );
            } else {
                const failureList = failedEntries
                    .map((entry) => `${entry.shiftDate} (${extractErrorMessage(entry.result.reason)})`)
                    .join('; ');
                const message =
                    succeededDates.length > 0
                        ? `${succeededDates.length} of ${shiftDates.length} staffing requests submitted. ` +
                          `Still failed: ${failureList}.`
                        : `Unable to submit: ${failureList}.`;
                this.showBanner('error', message);
                this.dispatchEvent(
                    new ShowToastEvent({ title: 'Some requests could not be submitted', message, variant: 'error' })
                );

                // Only drop the dates that actually succeeded, so a retry
                // doesn't re-submit (and duplicate) ones that already went
                // through - the failed dates stay selected for another try.
                if (succeededDates.length > 0) {
                    this.formData = {
                        ...this.formData,
                        shiftDates: shiftDates.filter((date) => !succeededDates.includes(date))
                    };
                    const picker = this.template.querySelector('c-block-date-picker');
                    if (picker) {
                        picker.removeDates(succeededDates);
                    }
                }
            }
        } catch (error) {
            const message = extractErrorMessage(error);
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

    // Re-apply defaultDate so a caller (e.g. requestStaffCalendar) can submit
    // more requests for the same selected day in a row.
    resetAfterSuccess() {
        this.formData = { ...DEFAULT_FORM, shiftDates: this._defaultDate ? [this._defaultDate] : [] };
        const picker = this.template.querySelector('c-block-date-picker');
        if (picker) {
            picker.clearSelection();
            if (this._defaultDate) {
                picker.defaultDate = this._defaultDate;
            }
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
