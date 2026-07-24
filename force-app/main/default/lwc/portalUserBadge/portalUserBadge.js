import { LightningElement, wire } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import userId from '@salesforce/user/Id';
import basePath from '@salesforce/community/basePath';
import getCurrentUserBadge from '@salesforce/apex/PortalUserBadgeController.getCurrentUserBadge';

export default class PortalUserBadge extends NavigationMixin(LightningElement) {
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

    handleViewProfile() {
        this.closeMenu();
        this[NavigationMixin.Navigate]({
            type: 'standard__recordPage',
            attributes: {
                recordId: userId,
                objectApiName: 'User',
                actionName: 'view'
            }
        });
    }

    handleLogout() {
        this.closeMenu();
        window.location.href = `${basePath}/secur/logout.jsp`;
    }
}
