import { LightningElement, api } from 'lwc';

/**
 * lightning-combobox with a search box: typing narrows the list to the options whose label contains
 * the text. lightning-combobox itself can't filter, so this wraps lightning-base-combobox (the
 * element it is built on), which supports typing and leaves the filtering to its owner.
 * Takes the same label, variant, placeholder, options and value as lightning-combobox, reports
 * `change` ({ value }) and has its setCustomValidity() and reportValidity().
 */
export default class SearchableCombobox extends LightningElement {
    @api label = '';
    @api variant = 'standard';
    @api placeholder = '';
    @api options = [];
    @api value = '';

    /** The text being typed, or null while the box shows the selected option's label. */
    searchText = null;
    message = '';
    isReported = false;

    @api
    setCustomValidity(message) {
        this.message = message;
        if (!message) {
            this.isReported = false;
        }
    }

    @api
    reportValidity() {
        this.isReported = Boolean(this.message);
        return !this.message;
    }

    get selectedLabel() {
        return this.options.find((option) => option.value === this.value)?.label ?? '';
    }

    get inputText() {
        return this.searchText ?? this.selectedLabel;
    }

    get items() {
        const search = (this.searchText ?? '').trim().toLowerCase();
        return this.options
            .filter((option) => option.label.toLowerCase().includes(search))
            .map((option) => ({
                type: 'option-inline',
                text: option.label,
                value: option.value,
                highlight: option.value === this.value,
                iconName: option.value === this.value ? 'utility:check' : undefined,
                iconSize: 'x-small'
            }));
    }

    get errorMessage() {
        return this.isReported ? this.message : '';
    }

    get ariaInvalid() {
        return this.errorMessage ? 'true' : undefined;
    }

    get formElementClass() {
        return this.errorMessage ? 'slds-form-element slds-has-error' : 'slds-form-element';
    }

    get labelClass() {
        return this.variant === 'label-hidden'
            ? 'slds-form-element__label slds-assistive-text'
            : 'slds-form-element__label';
    }

    handleTextInput(event) {
        this.searchText = event.detail.text;
    }

    handleSelect(event) {
        this.searchText = null;
        if (event.detail.value !== this.value) {
            this.dispatchEvent(new CustomEvent('change', { detail: { value: event.detail.value } }));
        }
    }

    /** Leaving the box without picking drops what was typed and goes back to the selected label. */
    handleBlur() {
        this.searchText = null;
    }
}
