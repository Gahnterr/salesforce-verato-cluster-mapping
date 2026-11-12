import { shouldHandleLink } from '../../../router';
import { LightningElement, api } from 'lwc';

const VARIANT_CONSOLE = 'console';

export default class GlobalNavigation extends LightningElement {
    @api currentPage = 'home';
    @api navItems = [];
    @api appItems = [];
    @api variant = 'standard';
    @api hideWaffle = false;

    isWaffleMenuOpen = false;

    get isConsole() {
        return this.variant === VARIANT_CONSOLE;
    }

    /** Waffle app-launcher trigger is hidden when the vertical nav rail replaces it. */
    get showWaffle() {
        return !this.hideWaffle;
    }

    get contextBarClass() {
        return this.isConsole
            ? 'slds-context-bar slds-context-bar_tabs'
            : 'slds-context-bar';
    }

    get waffleDropdownTriggerClass() {
        const base = 'slds-context-bar__item slds-context-bar__dropdown-trigger slds-dropdown-trigger slds-dropdown-trigger_click slds-no-hover';
        return this.isWaffleMenuOpen ? `${base} slds-is-open` : base;
    }

    /** App Launcher entries with selected-state derived from `current` flag. */
    get appItemsWithCurrent() {
        return (this.appItems || []).map((item) => ({
            ...item,
            ariaCurrent: item.isCurrent ? 'true' : null,
        }));
    }

    /** Label of the active app (shown next to the waffle in the context bar). */
    get currentAppLabel() {
        const current = (this.appItems || []).find((a) => a.isCurrent);
        return current?.label ?? '';
    }

    /** Nav items with isActive and tabClass derived from currentPage. */
    get navItemsWithActive() {
        return (this.navItems || []).map((item) => {
            const isActive = item.page === this.currentPage;
            const base = 'slds-context-bar__item';
            return {
                ...item,
                isActive,
                tabClass: isActive ? `${base} slds-is-active` : base,
                ariaCurrent: isActive ? 'page' : null,
            };
        });
    }

    handleNavItemClick(event) {
        if (!shouldHandleLink(event)) return;
        event.preventDefault();
        const page = event.currentTarget.dataset.page;
        this._dispatchNavigate(page);
    }

    handleWaffleOpen(event) {
        // Stop the click from immediately bubbling to the document handler that closes the menu.
        event?.stopPropagation?.();
        const wasOpen = this.isWaffleMenuOpen;
        this.isWaffleMenuOpen = !this.isWaffleMenuOpen;
        if (!wasOpen && this.isWaffleMenuOpen) {
            this._focusOnNextRender = 'waffle';
        }
    }

    handleWaffleMenuItemClick(event) {
        if (!shouldHandleLink(event)) return;
        event.preventDefault();
        this.isWaffleMenuOpen = false;
        const appId = event.currentTarget.dataset.value;
        this.dispatchEvent(
            new CustomEvent('appswitch', {
                detail: { app: appId },
                bubbles: true,
                composed: true,
            })
        );
    }

    handleWaffleMenuKeydown(event) {
        const menu = this._waffleMenuElement();
        if (!menu || !menu.contains(event.target)) return;

        const key = event.key;
        if (key === 'Escape') {
            event.preventDefault();
            this.isWaffleMenuOpen = false;
            setTimeout(() => this._focusWaffleTrigger(), 0);
            return;
        }
        if (key === 'Tab') {
            this.isWaffleMenuOpen = false;
            return;
        }
        if (key === 'ArrowDown' || key === 'ArrowUp') {
            event.preventDefault();
            const items = Array.from(menu.querySelectorAll('[role="menuitem"]'));
            const currentIndex = items.indexOf(event.target);
            if (currentIndex === -1) return;
            const nextIndex = key === 'ArrowDown'
                ? (currentIndex < items.length - 1 ? currentIndex + 1 : 0)
                : (currentIndex > 0 ? currentIndex - 1 : items.length - 1);
            items[nextIndex].focus();
        }
    }

    _waffleMenuElement() {
        return this.template.querySelector(
            '.slds-context-bar__primary > .slds-no-hover .slds-dropdown'
        );
    }

    _focusWaffleTrigger() {
        const trigger = this.template.querySelector(
            '.slds-context-bar__primary > .slds-no-hover .slds-context-bar__icon-action lightning-dynamic-icon'
        );
        if (trigger?.focus) trigger.focus();
    }

    _dispatchNavigate(page) {
        if (!page) return;
        this.dispatchEvent(
            new CustomEvent('navigate', {
                detail: { page },
                bubbles: true,
                composed: true,
            })
        );
    }

    connectedCallback() {
        this._handleDocumentClickBound = this._handleDocumentClick.bind(this);
        document.addEventListener('click', this._handleDocumentClickBound);
    }

    disconnectedCallback() {
        document.removeEventListener('click', this._handleDocumentClickBound);
    }

    renderedCallback() {
        if (!this._focusOnNextRender) return;
        const target = this._focusOnNextRender;
        this._focusOnNextRender = null;
        if (target === 'waffle') {
            const first = this._waffleMenuElement()?.querySelector('[role="menuitem"]');
            if (first) setTimeout(() => first.focus(), 0);
        }
    }

    _handleDocumentClick(event) {
        if (!this.isWaffleMenuOpen) return;
        const path = event.composedPath ? event.composedPath() : [];
        const waffle = this.template.querySelector('.slds-context-bar__primary > .slds-no-hover');
        if (waffle && !path.includes(waffle)) {
            this.isWaffleMenuOpen = false;
        }
    }
}
