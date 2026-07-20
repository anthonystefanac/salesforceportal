import { createElement } from 'lwc';
import SupportRequestForm from 'c/supportRequestForm';

describe('c-support-request-form', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
    });

    it('shows a success toast and dispatches caseCreated on successful submit', () => {
        const element = createElement('c-support-request-form', { is: SupportRequestForm });
        const toastHandler = jest.fn();
        const createdHandler = jest.fn();
        element.addEventListener('lightning__showtoast', toastHandler);
        element.addEventListener('caseCreated', createdHandler);
        document.body.appendChild(element);

        const form = element.shadowRoot.querySelector('lightning-record-edit-form');
        form.dispatchEvent(new CustomEvent('success'));

        expect(toastHandler).toHaveBeenCalledTimes(1);
        expect(toastHandler.mock.calls[0][0].detail.variant).toBe('success');
        expect(createdHandler).toHaveBeenCalledTimes(1);
    });

    it('shows an error toast on submit error', () => {
        const element = createElement('c-support-request-form', { is: SupportRequestForm });
        const toastHandler = jest.fn();
        element.addEventListener('lightning__showtoast', toastHandler);
        document.body.appendChild(element);

        const form = element.shadowRoot.querySelector('lightning-record-edit-form');
        form.dispatchEvent(
            new CustomEvent('error', { detail: { message: 'Missing required field' } })
        );

        expect(toastHandler).toHaveBeenCalledTimes(1);
        expect(toastHandler.mock.calls[0][0].detail.variant).toBe('error');
        expect(toastHandler.mock.calls[0][0].detail.message).toBe('Missing required field');
    });
});
