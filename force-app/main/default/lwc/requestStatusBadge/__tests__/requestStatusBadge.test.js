import { createElement } from 'lwc';
import RequestStatusBadge from 'c/requestStatusBadge';

describe('c-request-status-badge', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
    });

    it('renders the status text', () => {
        const element = createElement('c-request-status-badge', {
            is: RequestStatusBadge
        });
        element.status = 'Broadcasted';
        document.body.appendChild(element);

        const badge = element.shadowRoot.querySelector('span');
        expect(badge.textContent).toBe('Broadcasted');
    });

    it('applies the success style for Filled', () => {
        const element = createElement('c-request-status-badge', {
            is: RequestStatusBadge
        });
        element.status = 'Filled';
        document.body.appendChild(element);

        const badge = element.shadowRoot.querySelector('span');
        expect(badge.classList.contains('status-badge_success')).toBe(true);
    });

    it('applies the warning style for Unable to Fill', () => {
        const element = createElement('c-request-status-badge', {
            is: RequestStatusBadge
        });
        element.status = 'Unable to Fill';
        document.body.appendChild(element);

        const badge = element.shadowRoot.querySelector('span');
        expect(badge.classList.contains('status-badge_warning')).toBe(true);
    });

    it('falls back to the neutral style for an unrecognized status', () => {
        const element = createElement('c-request-status-badge', {
            is: RequestStatusBadge
        });
        element.status = 'Something Unexpected';
        document.body.appendChild(element);

        const badge = element.shadowRoot.querySelector('span');
        expect(badge.classList.contains('status-badge_neutral')).toBe(true);
    });
});
