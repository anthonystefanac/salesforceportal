import { LightningElement, api, wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getTimesheetHistory from '@salesforce/apex/TimesheetController.getTimesheetHistory';
import approveTimesheet from '@salesforce/apex/TimesheetController.approveTimesheet';
import queryTimesheet from '@salesforce/apex/TimesheetController.queryTimesheet';

export default class TimesheetApprovalDetail extends LightningElement {
    @api timesheetId;
    @api staffingRequestId;

    history = [];
    error;
    queryComment = '';
    isSubmitting = false;

    @wire(getTimesheetHistory, { staffingRequestId: '$staffingRequestId' })
    wiredHistory({ data, error }) {
        if (data) {
            this.history = data;
            this.error = undefined;
        } else if (error) {
            this.error = error;
            this.history = [];
        }
    }

    get hasHistory() {
        return this.history.length > 0;
    }

    get isActionDisabled() {
        return this.isSubmitting;
    }

    handleCommentChange(event) {
        this.queryComment = event.target.value;
    }

    async handleApprove() {
        this.isSubmitting = true;
        try {
            await approveTimesheet({ timesheetId: this.timesheetId });
            this.dispatchEvent(new ShowToastEvent({ title: 'Timesheet approved', variant: 'success' }));
            this.dispatchEvent(new CustomEvent('timesheetupdated'));
        } catch (error) {
            this.showError('Unable to approve timesheet', error);
        } finally {
            this.isSubmitting = false;
        }
    }

    async handleQuery() {
        this.isSubmitting = true;
        try {
            await queryTimesheet({ timesheetId: this.timesheetId, comment: this.queryComment });
            this.dispatchEvent(new ShowToastEvent({ title: 'Query submitted', variant: 'success' }));
            this.dispatchEvent(new CustomEvent('timesheetupdated'));
        } catch (error) {
            this.showError('Unable to submit query', error);
        } finally {
            this.isSubmitting = false;
        }
    }

    showError(title, error) {
        this.dispatchEvent(
            new ShowToastEvent({
                title,
                message: (error && error.body && error.body.message) || 'An unexpected error occurred.',
                variant: 'error'
            })
        );
    }
}
