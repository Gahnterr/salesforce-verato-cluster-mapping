import { LightningElement, api } from 'lwc';

// The SLDS empty-state illustrations (copied from @salesforce-ux/design-system).
const ILLUSTRATIONS = {
    assistant: new URL('./illustrations/empty-state-assistant.svg', import.meta.url).href,
    events: new URL('./illustrations/empty-state-events.svg', import.meta.url).href,
    tasks: new URL('./illustrations/empty-state-tasks.svg', import.meta.url).href
};

/**
 * Empty state, built from the SLDS Illustration blueprint (no base component covers it).
 * An SLDS illustration, a header and optional supporting text; `illustration` is
 * "assistant" (default), "events" or "tasks". `size` is "small" (default, for cards and
 * panels) or "large" (for a page's main area).
 */
export default class EmptyState extends LightningElement {
    @api title = '';
    @api message = '';
    @api size = 'small';
    @api illustration = 'assistant';

    get illustrationSrc() {
        return ILLUSTRATIONS[this.illustration] ?? ILLUSTRATIONS.assistant;
    }

    get computedClass() {
        const size = this.size === 'large' ? 'slds-illustration_large' : 'slds-illustration_small';
        return `slds-illustration ${size} slds-p-around_x-large`;
    }
}
