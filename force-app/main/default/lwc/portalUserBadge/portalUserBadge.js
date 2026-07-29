import { LightningElement, wire } from 'lwc';
import basePath from '@salesforce/community/basePath';
import getCurrentUserBadge from '@salesforce/apex/PortalUserBadgeController.getCurrentUserBadge';

export default class PortalUserBadge extends LightningElement {
    userName;
    accountName;
    isMenuOpen = false;

    @wire(getCurrentUserBadge)
    wiredBadge({ data }) {
        if (data) {
            this.userName = data.userName;
            this.accountName = data.accountName;
        }
    }

    boundHandleDocumentClick = this.handleDocumentClick.bind(this);

    disconnectedCallback() {
        document.removeEventListener('click', this.boundHandleDocumentClick);
    }

    get initials() {
        if (!this.userName) {
            return '';
        }
        return this.userName
            .split(/\s+/)
            .filter(Boolean)
            .map((part) => part.charAt(0).toUpperCase())
            .slice(0, 2)
            .join('');
    }

    get hasAccountName() {
        return !!this.accountName;
    }

    // Guards the whole badge, not just the account line - the Apex side
    // returns an empty (null userName) badge for the Guest User running
    // context (see PortalUserBadgeController), so this hides the avatar,
    // name, and Log Out action entirely on any page reached before a real
    // portal user has logged in, rather than showing a Log Out button that
    // makes no sense pre-authentication.
    get hasUser() {
        return !!this.userName;
    }

    get expandedState() {
        return this.isMenuOpen ? 'true' : 'false';
    }

    handleDocumentClick() {
        this.closeMenu();
    }

    handleToggleMenu() {
        if (this.isMenuOpen) {
            this.closeMenu();
        } else {
            this.openMenu();
        }
    }

    openMenu() {
        this.isMenuOpen = true;
        // Defer attaching the listener so the click that opened the menu -
        // still bubbling up to document as this runs - doesn't immediately
        // close it again. Node-identity checks (e.g. composedPath().includes)
        // aren't reliable here because Lightning Web Security proxies DOM
        // references, so this timing-based approach is used instead.
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        setTimeout(() => {
            document.addEventListener('click', this.boundHandleDocumentClick);
        }, 0);
    }

    closeMenu() {
        this.isMenuOpen = false;
        document.removeEventListener('click', this.boundHandleDocumentClick);
    }

    handleLogout() {
        this.closeMenu();
        window.location.href = `${basePath}/secur/logout.jsp`;
    }
}
