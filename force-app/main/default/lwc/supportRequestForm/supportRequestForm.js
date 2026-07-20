import { LightningElement } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class SupportRequestForm extends LightningElement {
    handleSuccess() {
        this.dispatchEvent(
            new ShowToastEvent({
                title: 'Request submitted',
                message: 'Our team will follow up shortly.',
                variant: 'success'
            })
        );
        this.dispatchEvent(new CustomEvent('caseCreated'));
    }

    handleError(event) {
        this.dispatchEvent(
            new ShowToastEvent({
                title: 'Unable to submit request',
                message:
                    (event.detail && (event.detail.message || event.detail.detail)) ||
                    'An unexpected error occurred.',
                variant: 'error'
            })
        );
    }
}
