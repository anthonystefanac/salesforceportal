import { createElement } from 'lwc';
import SupportRequestForm from 'c/supportRequestForm';
import createCase from '@salesforce/apex/SupportRequestController.createCase';

jest.mock(
    '@salesforce/apex/SupportRequestController.createCase',
    () => ({ default: jest.fn() }),
    { virtual: true }
);

// The default lightning/navigation stub's Navigate method is a frozen no-op,
// so it can't be jest.spyOn'd directly - swap in an instrumented mixin instead.
const mockNavigate = jest.fn();
jest.mock('lightning/navigation', () => {
    const Navigate = Symbol('Navigate');
    const NavigationMixin = (Base) =>
        class extends Base {
            [Navigate](pageReference) {
                mockNavigate(pageReference);
            }
        };
    NavigationMixin.Navigate = Navigate;
    return { NavigationMixin };
});

function setInputValue(element, selector, value) {
    const input = element.shadowRoot.querySelector(selector);
    input.value = value;
    input.dispatchEvent(new CustomEvent('change'));
    return input;
}

describe('c-support-request-form', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
        jest.clearAllMocks();
    });

    it('submits the Case as a General Query with the subject and description', async () => {
        createCase.mockResolvedValue('500000000000001AAA');

        const element = createElement('c-support-request-form', { is: SupportRequestForm });
        document.body.appendChild(element);

        setInputValue(element, '[data-field="subject"]', 'Question about a shift');
        setInputValue(element, '[data-field="description"]', 'Just checking on something.');

        const submitButton = element.shadowRoot.querySelector('.support-request-form__submit');
        submitButton.click();

        await Promise.resolve();
        await Promise.resolve();

        expect(createCase).toHaveBeenCalledTimes(1);
        const newCase = createCase.mock.calls[0][0].newCase;
        expect(newCase.Subject).toBe('Question about a shift');
        expect(newCase.Description).toBe('Just checking on something.');
        expect(newCase.Portal_Request_Type__c).toBe('General Query');
        expect(newCase.Related_Staffing_Request__c).toBeUndefined();
    });

    it('does not submit and shows an inline error when Subject is left blank', async () => {
        const element = createElement('c-support-request-form', { is: SupportRequestForm });
        document.body.appendChild(element);

        setInputValue(element, '[data-field="description"]', 'Just checking on something.');

        const submitButton = element.shadowRoot.querySelector('.support-request-form__submit');
        submitButton.click();

        await Promise.resolve();

        expect(createCase).not.toHaveBeenCalled();
        const banner = element.shadowRoot.querySelector('.support-request-form__banner');
        expect(banner.textContent).toBe('Subject is required.');
    });

    it('does not submit when Subject is only whitespace', async () => {
        const element = createElement('c-support-request-form', { is: SupportRequestForm });
        document.body.appendChild(element);

        setInputValue(element, '[data-field="subject"]', '   ');

        const submitButton = element.shadowRoot.querySelector('.support-request-form__submit');
        submitButton.click();

        await Promise.resolve();

        expect(createCase).not.toHaveBeenCalled();
        const banner = element.shadowRoot.querySelector('.support-request-form__banner');
        expect(banner.textContent).toBe('Subject is required.');
    });

    it('shows an inline confirmation and a success toast on successful submission', async () => {
        createCase.mockResolvedValue('500000000000001AAA');

        const element = createElement('c-support-request-form', { is: SupportRequestForm });
        const toastHandler = jest.fn();
        element.addEventListener('lightning__showtoast', toastHandler);
        document.body.appendChild(element);

        setInputValue(element, '[data-field="subject"]', 'Question about a shift');

        const submitButton = element.shadowRoot.querySelector('.support-request-form__submit');
        submitButton.click();

        await Promise.resolve();
        await Promise.resolve();

        expect(toastHandler).toHaveBeenCalledTimes(1);
        expect(toastHandler.mock.calls[0][0].detail.variant).toBe('success');

        const confirmation = element.shadowRoot.querySelector('.support-request-form__confirmation');
        expect(confirmation).not.toBeNull();
        expect(element.shadowRoot.querySelector('.support-request-form__fields')).toBeNull();
    });

    it('shows a visible saving state while the request is being submitted', async () => {
        let resolveCreate;
        createCase.mockReturnValue(
            new Promise((resolve) => {
                resolveCreate = resolve;
            })
        );

        const element = createElement('c-support-request-form', { is: SupportRequestForm });
        document.body.appendChild(element);

        setInputValue(element, '[data-field="subject"]', 'Question about a shift');

        const submitButton = element.shadowRoot.querySelector('.support-request-form__submit');
        submitButton.click();
        await Promise.resolve();

        expect(submitButton.label).toBe('Submitting…');
        expect(submitButton.disabled).toBe(true);
        expect(element.shadowRoot.querySelector('lightning-spinner')).not.toBeNull();

        resolveCreate('500000000000001AAA');
        await Promise.resolve();
        await Promise.resolve();

        expect(element.shadowRoot.querySelector('lightning-spinner')).toBeNull();
    });

    it('navigates to My Requests when "View My Requests" is clicked after submitting', async () => {
        createCase.mockResolvedValue('500000000000001AAA');

        const element = createElement('c-support-request-form', { is: SupportRequestForm });
        document.body.appendChild(element);

        setInputValue(element, '[data-field="subject"]', 'Question about a shift');

        const submitButton = element.shadowRoot.querySelector('.support-request-form__submit');
        submitButton.click();

        await Promise.resolve();
        await Promise.resolve();

        const viewMyRequestsButton = element.shadowRoot.querySelector(
            '.support-request-form__confirmation-actions lightning-button'
        );
        viewMyRequestsButton.click();

        expect(mockNavigate).toHaveBeenCalledTimes(1);
        const pageReference = mockNavigate.mock.calls[0][0];
        expect(pageReference.type).toBe('comm__namedPage');
        expect(pageReference.attributes.name).toBe('My_Requests__c');
    });

    it('returns to the form when "Submit Another Request" is clicked', async () => {
        createCase.mockResolvedValue('500000000000001AAA');

        const element = createElement('c-support-request-form', { is: SupportRequestForm });
        document.body.appendChild(element);

        setInputValue(element, '[data-field="subject"]', 'Question about a shift');

        const submitButton = element.shadowRoot.querySelector('.support-request-form__submit');
        submitButton.click();

        await Promise.resolve();
        await Promise.resolve();

        const buttons = element.shadowRoot.querySelectorAll(
            '.support-request-form__confirmation-actions lightning-button'
        );
        buttons[1].click();

        await Promise.resolve();

        expect(element.shadowRoot.querySelector('.support-request-form__fields')).not.toBeNull();
        expect(element.shadowRoot.querySelector('.support-request-form__confirmation')).toBeNull();
    });

    it('shows an error toast on submission failure and stays on the form', async () => {
        createCase.mockRejectedValue({ body: { message: 'Missing required field' } });

        const element = createElement('c-support-request-form', { is: SupportRequestForm });
        const toastHandler = jest.fn();
        element.addEventListener('lightning__showtoast', toastHandler);
        document.body.appendChild(element);

        setInputValue(element, '[data-field="subject"]', 'Question about a shift');

        const submitButton = element.shadowRoot.querySelector('.support-request-form__submit');
        submitButton.click();

        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();

        expect(toastHandler).toHaveBeenCalledTimes(1);
        expect(toastHandler.mock.calls[0][0].detail.variant).toBe('error');
        expect(toastHandler.mock.calls[0][0].detail.message).toBe('Missing required field');
        expect(element.shadowRoot.querySelector('.support-request-form__fields')).not.toBeNull();

        // The toast above isn't guaranteed to render on every site type this
        // component could be used on (Experience Cloud LWR sites in
        // particular don't render platform toasts at all) - this inline
        // banner is the guaranteed feedback.
        const banner = element.shadowRoot.querySelector('.support-request-form__banner');
        expect(banner.textContent).toBe('Missing required field');
    });

    it('clears a previous error banner when a new submit attempt starts', async () => {
        createCase.mockRejectedValueOnce({ body: { message: 'Missing required field' } });

        const element = createElement('c-support-request-form', { is: SupportRequestForm });
        document.body.appendChild(element);

        setInputValue(element, '[data-field="subject"]', 'Question about a shift');

        const submitButton = element.shadowRoot.querySelector('.support-request-form__submit');
        submitButton.click();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();

        expect(element.shadowRoot.querySelector('.support-request-form__banner')).not.toBeNull();

        createCase.mockResolvedValueOnce('500000000000001AAA');
        submitButton.click();
        await Promise.resolve();

        expect(element.shadowRoot.querySelector('.support-request-form__banner')).toBeNull();
    });
});
