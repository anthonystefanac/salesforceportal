import { LightningElement, wire } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { formatTime } from 'c/timeFormatUtils';
import getMyRequests from '@salesforce/apex/StaffingRequestController.getMyRequests';
import createCase from '@salesforce/apex/SupportRequestController.createCase';

const MY_REQUESTS_PAGE_NAME = 'My_Requests__c';

const REQUEST_TYPE_OPTIONS = [
    { label: 'General Query', value: 'General Query' },
    { label: 'Cancellation Request', value: 'Cancellation Request' }
];

const DEFAULT_FORM = {
    requestType: 'General Query',
    relatedRequestId: undefined,
    subject: undefined,
    description: undefined
};

export default class SupportRequestForm extends NavigationMixin(LightningElement) {
    requestTypeOptions = REQUEST_TYPE_OPTIONS;
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

    get isSubmitDisabled() {
        return this.isSubmitting;
    }

    handleRequestTypeChange(event) {
        // Changing Request Type resets any Related Request already picked,
        // rather than carrying a possibly-stale selection across types.
        this.formData = { ...this.formData, requestType: event.detail.value, relatedRequestId: undefined };
    }

    handleRelatedRequestChange(event) {
        this.formData = { ...this.formData, relatedRequestId: event.detail.value };
    }

    handleFieldChange(event) {
        const field = event.target.dataset.field;
        this.formData = { ...this.formData, [field]: event.target.value };
    }

    async handleSubmit() {
        this.isSubmitting = true;
        try {
            const newCase = {
                Portal_Request_Type__c: this.formData.requestType,
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
