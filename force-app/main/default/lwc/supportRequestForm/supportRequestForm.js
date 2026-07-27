import { LightningElement, wire } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { formatTime } from 'c/timeFormatUtils';
import getMyRequests from '@salesforce/apex/StaffingRequestController.getMyRequests';
import createCase from '@salesforce/apex/SupportRequestController.createCase';

const MY_REQUESTS_PAGE_NAME = 'My_Requests__c';

// Cancellation requests now come from a per-row action on My Requests
// instead - this form only ever submits General Query cases.
const REQUEST_TYPE = 'General Query';

const DEFAULT_FORM = {
    relatedRequestId: undefined,
    subject: undefined,
    description: undefined
};

export default class SupportRequestForm extends NavigationMixin(LightningElement) {
    myRequests = [];
    formData = { ...DEFAULT_FORM };
    isSubmitting = false;
    submitted = false;

    @wire(getMyRequests)
    wiredRequests({ data }) {
        if (data) {
            this.myRequests = data;
        }
    }

    get relatedRequestOptions() {
        return this.myRequests.map((request) => ({
            label: `${request.Name} — ${request.Shift_Date__c} — ${
                request.Facility__r ? request.Facility__r.Name : ''
            }`,
            value: request.Id
        }));
    }

    get selectedRelatedRequest() {
        return this.myRequests.find((request) => request.Id === this.formData.relatedRequestId);
    }

    get hasSelectedRelatedRequest() {
        return !!this.selectedRelatedRequest;
    }

    get selectedRelatedRequestShiftDate() {
        return this.selectedRelatedRequest ? this.selectedRelatedRequest.Shift_Date__c : '';
    }

    get selectedRelatedRequestFacility() {
        const request = this.selectedRelatedRequest;
        return request && request.Facility__r ? request.Facility__r.Name : '';
    }

    get selectedRelatedRequestWard() {
        const request = this.selectedRelatedRequest;
        return request && request.Ward__r ? request.Ward__r.Name : '—';
    }

    get selectedRelatedRequestRole() {
        return this.selectedRelatedRequest ? this.selectedRelatedRequest.Role__c : '';
    }

    get selectedRelatedRequestStartTime() {
        return this.selectedRelatedRequest ? formatTime(this.selectedRelatedRequest.Start_Time__c) : '';
    }

    errorMessage;

    get isSubmitDisabled() {
        return this.isSubmitting;
    }

    get submitButtonLabel() {
        return this.isSubmitting ? 'Submitting…' : 'Submit Request';
    }

    get hasError() {
        return !!this.errorMessage;
    }

    handleRelatedRequestChange(event) {
        this.formData = { ...this.formData, relatedRequestId: event.detail.value };
    }

    handleFieldChange(event) {
        const field = event.target.dataset.field;
        this.formData = { ...this.formData, [field]: event.target.value };
    }

    async handleSubmit() {
        this.errorMessage = undefined;
        this.isSubmitting = true;
        try {
            const newCase = {
                Portal_Request_Type__c: REQUEST_TYPE,
                Related_Staffing_Request__c: this.formData.relatedRequestId,
                Subject: this.formData.subject,
                Description: this.formData.description
            };
            await createCase({ newCase });
            this.submitted = true;
            this.formData = { ...DEFAULT_FORM };
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Request submitted',
                    message: 'Our team will follow up shortly.',
                    variant: 'success'
                })
            );
        } catch (error) {
            // The toast below isn't guaranteed to render on every site type
            // this component could be used on (Experience Cloud LWR sites in
            // particular don't render platform toasts at all) - errorMessage
            // drives a guaranteed inline banner instead.
            this.errorMessage = (error && error.body && error.body.message) || 'An unexpected error occurred.';
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Unable to submit request',
                    message: this.errorMessage,
                    variant: 'error'
                })
            );
        } finally {
            this.isSubmitting = false;
        }
    }

    handleSubmitAnother() {
        this.submitted = false;
    }

    handleViewMyRequests() {
        this[NavigationMixin.Navigate]({
            type: 'comm__namedPage',
            attributes: { name: MY_REQUESTS_PAGE_NAME }
        });
    }
}
