import { createElement } from 'lwc';
import PortalUserBadge from 'c/portalUserBadge';
import getCurrentUserBadge from '@salesforce/apex/PortalUserBadgeController.getCurrentUserBadge';

jest.mock(
    '@salesforce/apex/PortalUserBadgeController.getCurrentUserBadge',
    () => {
        const { createApexTestWireAdapter } = require('@salesforce/sfdx-lwc-jest');
        return {
            default: createApexTestWireAdapter(jest.fn())
        };
    },
    { virtual: true }
);

jest.mock(
    '@salesforce/community/basePath',
    () => ({ __esModule: true, default: '/portal' }),
    { virtual: true }
);

const mockBadge = {
    userName: 'Jordan Michaels',
    accountName: 'Riverside Aged Care Group'
};

describe('c-portal-user-badge', () => {
    let originalLocation;

    beforeEach(() => {
        originalLocation = window.location;
        delete window.location;
        window.location = { href: '' };
    });

    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
        window.location = originalLocation;
        jest.clearAllMocks();
    });

    it('renders the initials, name, and account from the wire data', () => {
        const element = createElement('c-portal-user-badge', { is: PortalUserBadge });
        document.body.appendChild(element);

        getCurrentUserBadge.emit(mockBadge);

        return Promise.resolve().then(() => {
            const avatar = element.shadowRoot.querySelector('.portal-user-badge__avatar');
            const name = element.shadowRoot.querySelector('.portal-user-badge__name');
            const account = element.shadowRoot.querySelector('.portal-user-badge__account');

            expect(avatar.textContent).toBe('JM');
            expect(name.textContent).toBe('Jordan Michaels');
            expect(account.textContent).toBe('Riverside Aged Care Group');
        });
    });

    it('does not render an account line when there is no linked Account', () => {
        const element = createElement('c-portal-user-badge', { is: PortalUserBadge });
        document.body.appendChild(element);

        getCurrentUserBadge.emit({ userName: 'Jordan Michaels', accountName: null });

        return Promise.resolve().then(() => {
            expect(element.shadowRoot.querySelector('.portal-user-badge__account')).toBeNull();
        });
    });

    it('opens the menu on trigger click and closes it on an outside click', async () => {
        const element = createElement('c-portal-user-badge', { is: PortalUserBadge });
        document.body.appendChild(element);

        getCurrentUserBadge.emit(mockBadge);
        await Promise.resolve();

        element.shadowRoot.querySelector('.portal-user-badge__trigger').click();
        await Promise.resolve();

        expect(element.shadowRoot.querySelector('.portal-user-badge__menu')).not.toBeNull();

        // The outside-click listener is attached via a deferred setTimeout
        // (see portalUserBadge.js), so let that macrotask run before
        // simulating the outside click.
        await new Promise((resolve) => setTimeout(resolve, 0));
        document.body.click();
        await Promise.resolve();

        expect(element.shadowRoot.querySelector('.portal-user-badge__menu')).toBeNull();
    });

    it('renders View Profile as a disabled "coming soon" item', () => {
        const element = createElement('c-portal-user-badge', { is: PortalUserBadge });
        document.body.appendChild(element);

        getCurrentUserBadge.emit(mockBadge);

        return Promise.resolve().then(() => {
            element.shadowRoot.querySelector('.portal-user-badge__trigger').click();

            return Promise.resolve().then(() => {
                const viewProfile = element.shadowRoot.querySelectorAll(
                    '.portal-user-badge__menu-item'
                )[0];
                expect(viewProfile.disabled).toBe(true);
            });
        });
    });

    it('redirects to the logout URL when Log Out is clicked', () => {
        const element = createElement('c-portal-user-badge', { is: PortalUserBadge });
        document.body.appendChild(element);

        getCurrentUserBadge.emit(mockBadge);

        return Promise.resolve().then(() => {
            element.shadowRoot.querySelector('.portal-user-badge__trigger').click();

            return Promise.resolve().then(() => {
                element.shadowRoot
                    .querySelectorAll('.portal-user-badge__menu-item')[1]
                    .click();

                expect(window.location.href).toBe('/portal/secur/logout.jsp');
            });
        });
    });
});
