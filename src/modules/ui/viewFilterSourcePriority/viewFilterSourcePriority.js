import { LightningElement, api } from 'lwc';
import { getRecentSources, searchSources } from 'data/viewFilters';

/** Shorter searches are not run, and the typing delay is what keeps a real API from being called on every key. */
const MIN_SEARCH_LENGTH = 3;
const SEARCH_DELAY_MS = 300;

/**
 * The sources a view filter ranks, in order. A search box adds sources: focusing it offers the ones prioritized most
 * recently, and typing three or more characters searches (after a short delay) the sources not prioritized yet.
 * The prioritized sources are listed below it: drag them to reorder, and remove them with the trash can.
 * Controlled: reports `sourceschange` ({ sources }).
 */
export default class ViewFilterSourcePriority extends LightningElement {
    /** The prioritized sources, highest priority first. */
    @api sources = [];

    searchText = '';
    isOpen = false;
    /** What the menu shows: 'recent' (before typing), 'short' (too few characters), 'searching' or 'results'. */
    mode = 'recent';
    items = [];
    /** The menu item Enter would add; -1 for none, which is how the recent list opens. */
    activeIndex = -1;
    armedName = '';
    dragName = '';
    dropName = '';
    dropPosition = '';

    _timer;
    /** Counts the searches started, so the answer of one that was superseded is ignored. */
    _request = 0;

    disconnectedCallback() {
        clearTimeout(this._timer);
    }

    renderedCallback() {
        this.template.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
    }

    get noPrioritized() {
        return this.sources.length === 0;
    }

    get prioritizedRows() {
        return this.sources.map((name) => ({
            name,
            isArmed: this.armedName === name,
            dragText: `Reorder ${name}`,
            removeText: `Remove ${name}`,
            className: [
                'c-list__row',
                this.dragName === name ? 'c-row_dragging' : '',
                this.dropName === name && this.dropName !== this.dragName ? `c-row_drop-${this.dropPosition}` : ''
            ]
                .filter(Boolean)
                .join(' ')
        }));
    }

    get countText() {
        return `${this.sources.length} item${this.sources.length === 1 ? '' : 's'}`;
    }

    get isShort() {
        return this.mode === 'short';
    }

    get isSearching() {
        return this.mode === 'searching';
    }

    get isEmpty() {
        return this.mode === 'results' && this.items.length === 0;
    }

    get menuRows() {
        return this.items.map((name, index) => {
            const isActive = index === this.activeIndex;
            return {
                name,
                index,
                isActive,
                className: `slds-media slds-listbox__option slds-listbox__option_plain slds-media_center${isActive ? ' slds-has-focus' : ''}`
            };
        });
    }

    emit(sources) {
        this.dispatchEvent(new CustomEvent('sourceschange', { detail: { sources } }));
    }

    /** Shows what the menu should for the current text: the recent sources, a hint, or (after a delay) search results. */
    refresh() {
        clearTimeout(this._timer);
        this._request += 1;
        const term = this.searchText.trim();
        this.isOpen = true;
        this.activeIndex = -1;
        if (term.length >= MIN_SEARCH_LENGTH) {
            this.mode = 'searching';
            this.items = [];
            this._timer = setTimeout(() => this.runSearch(term), SEARCH_DELAY_MS);
            return;
        }
        this.items = term ? [] : getRecentSources().filter((name) => !this.sources.includes(name));
        // With nothing recent to offer, an empty box gets the hint too.
        this.mode = term || this.items.length === 0 ? 'short' : 'recent';
    }

    runSearch(term) {
        const request = this._request;
        searchSources(term, this.sources).then((names) => {
            if (request !== this._request) {
                return;
            }
            this.items = names;
            this.mode = 'results';
            // The best match is ready to be added with Enter.
            this.activeIndex = names.length > 0 ? 0 : -1;
        });
    }

    close() {
        clearTimeout(this._timer);
        this._request += 1;
        this.isOpen = false;
    }

    handleFocus() {
        this.refresh();
    }

    handleClick() {
        if (!this.isOpen) {
            this.refresh();
        }
    }

    handleBlur() {
        this.close();
    }

    // Searches as the text changes, not when the box loses focus.
    handleSearch(event) {
        this.searchText = event.detail.value ?? '';
        this.refresh();
    }

    get hasMenuItems() {
        return this.isOpen && (this.mode === 'recent' || this.mode === 'results') && this.items.length > 0;
    }

    handleKeyDown(event) {
        const { key } = event;
        if (key === 'Enter') {
            // Never a search; it only adds the menu item that is focused.
            event.preventDefault();
            if (this.hasMenuItems && this.activeIndex >= 0) {
                this.add(this.items[this.activeIndex]);
            }
        } else if (key === 'ArrowDown' || key === 'ArrowUp') {
            event.preventDefault();
            if (!this.isOpen) {
                this.refresh();
            } else if (this.hasMenuItems) {
                const step = key === 'ArrowDown' ? 1 : -1;
                const start = this.activeIndex === -1 && step === -1 ? 0 : this.activeIndex;
                this.activeIndex = (start + step + this.items.length) % this.items.length;
            }
        } else if (key === 'Escape' && this.isOpen) {
            event.preventDefault();
            this.close();
        }
    }

    // Keeps the focus in the search box while the menu is clicked, so the box's blur doesn't close the menu first.
    handleMenuMouseDown(event) {
        event.preventDefault();
    }

    handleOptionHover(event) {
        this.activeIndex = Number(event.currentTarget.dataset.index);
    }

    handleOptionClick(event) {
        this.add(event.currentTarget.dataset.name);
    }

    /** Adds the source at the end of the prioritized list, and clears the search box and closes the menu. */
    add(name) {
        this.searchText = '';
        this.close();
        this.emit([...this.sources, name]);
    }

    handleRemove(event) {
        this.emit(this.sources.filter((name) => name !== event.currentTarget.dataset.name));
    }

    // A row is only draggable while its handle is held, so text inside it stays selectable.
    handleArm(event) {
        this.armedName = event.currentTarget.dataset.name;
    }

    handleDisarm() {
        this.armedName = '';
    }

    handleDragStart(event) {
        const { name } = event.currentTarget.dataset;
        this._drag = name;
        event.dataTransfer.effectAllowed = 'move';
        // Firefox won't start a drag without data.
        event.dataTransfer.setData('text/plain', name);
        this.setRowDragImage(event);
        // Restyling inside the handler would cancel the drag in some browsers, so wait a tick.
        setTimeout(() => {
            if (this._drag) {
                this.dragName = name;
            }
        }, 0);
    }

    /**
     * Without this the browser draws the row's surroundings along with it, which reads as lifting the whole list.
     * A copy of just the row, on a card-like background, is shown instead; it is removed once the browser has drawn it.
     */
    setRowDragImage(event) {
        const row = event.currentTarget;
        const { width, left, top } = row.getBoundingClientRect();
        const image = row.cloneNode(true);
        image.classList.add('c-drag-image');
        image.style.setProperty('inline-size', `${width}px`);
        this.template.querySelector('.c-list').appendChild(image);
        event.dataTransfer.setDragImage(image, event.clientX - left, event.clientY - top);
        setTimeout(() => image.remove(), 0);
    }

    handleDragOver(event) {
        if (!this._drag) {
            return;
        }
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        const { top, height } = event.currentTarget.getBoundingClientRect();
        this.dropName = event.currentTarget.dataset.name;
        this.dropPosition = event.clientY < top + height / 2 ? 'before' : 'after';
    }

    handleDrop(event) {
        event.preventDefault();
        const target = event.currentTarget.dataset.name;
        const dragged = this._drag;
        const position = this.dropPosition;
        this.handleDragEnd();
        if (!dragged || dragged === target) {
            return;
        }
        const rest = this.sources.filter((name) => name !== dragged);
        rest.splice(rest.indexOf(target) + (position === 'after' ? 1 : 0), 0, dragged);
        this.emit(rest);
    }

    handleDragEnd() {
        this._drag = null;
        this.armedName = '';
        this.dragName = '';
        this.dropName = '';
        this.dropPosition = '';
    }
}
