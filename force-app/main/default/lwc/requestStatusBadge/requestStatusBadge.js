import { LightningElement, api } from 'lwc';

const STATUS_STYLE_MAP = {
    Submitted: 'status-badge status-badge_neutral',
    'Being Worked': 'status-badge status-badge_info',
    Broadcasted: 'status-badge status-badge_info',
    Filled: 'status-badge status-badge_success',
    'Unable to Fill': 'status-badge status-badge_warning',
    Cancelled: 'status-badge status-badge_error'
};

export default class RequestStatusBadge extends LightningElement {
    @api status;

    get badgeClass() {
        return STATUS_STYLE_MAP[this.status] || 'status-badge status-badge_neutral';
    }
}
