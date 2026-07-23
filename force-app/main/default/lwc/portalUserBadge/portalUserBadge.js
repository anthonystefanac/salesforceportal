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

    connectedCallback() {
        this.boundHandleDocumentClick = this.handleDocumentClick.bind(this);
        document.addEventListener('click', this.boundHandleDocumentClick);
    }

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

    handleDocumentClick(event) {
        if (!this.isMenuOpen) {
            return;
        }
        // event.target is retargeted to the host by shadow DOM, so compare
        // against the full dispatch path instead to detect outside clicks.
        const wrapper = this.template.querySelector('.portal-user-badge');
        if (wrapper && !event.composedPath().includes(wrapper)) {
            this.isMenuOpen = false;
        }
    }

    handleToggleMenu() {
        this.isMenuOpen = !this.isMenuOpen;
    }

    handleViewProfile() {
        this.isMenuOpen = false;
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
        this.isMenuOpen = false;
        window.location.href = `${basePath}/secur/logout.jsp`;
    }
}
