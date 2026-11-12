import { LightningElement, api } from 'lwc';
import {
    SORT_BY_OPTIONS,
    SORT_FIRST_OPTIONS,
    defaultViewFilter,
    describeFilter,
    describeSort,
    parseViewFilterYaml,
    smartViewAttributeName,
    viewFilterToYaml
} from 'data/viewFilters';

const BOOLEAN_OPTIONS = [
    { label: 'True', value: 'true' },
    { label: 'False', value: 'false' }
];

const INPUT_TYPES = { NUMBER: 'number', DATE: 'date', TIME: 'time', 'DATE-TIME': 'datetime' };

/** The words of the copy that depend on the cluster's direction: outbound values are sent, inbound ones received, and both ways either. */
const DIRECTION_WORDS = {
    outbound: { verb: 'Send', pastParticiple: 'sent', cardinalityWords: { all: 'Sent', one: 'Sent' } },
    inbound: { verb: 'Receive', pastParticiple: 'received', cardinalityWords: { all: 'Received', one: 'Received' } },
    both: { verb: 'Send or Receive', pastParticiple: 'sent or received', cardinalityWords: { all: 'Sent and Received', one: 'Sent or Received' } }
};

const DETAIL_TITLES = { filter: 'Filter by Attribute Value', sort: 'Sort Attribute Values by' };

/**
 * The view filter part of a cluster mapping: active-only checkbox, attribute filter and sort order.
 * Controlled: edits are sent as `filterchange` ({ filter }) and the owner passes the new filter back in.
 */
export default class ClusterMappingViewFilter extends LightningElement {
    sortByOptions = SORT_BY_OPTIONS;
    sortFirstOptions = SORT_FIRST_OPTIONS;

    /** Which part of the Visual Editor is open: 'overview', or the 'filter' or 'sort' editor. */
    view = 'overview';
    /** What the YAML editor holds while it is being typed in (null: show the filter as YAML), and what is wrong with it. */
    yamlDraft = null;
    yamlError = '';

    _filter = defaultViewFilter();
    _attributes = [];

    /** Schema attributes of the cluster ({ name, type, codeSetValues }); what the filter can refer to. */
    @api
    get attributes() {
        return this._attributes;
    }
    set attributes(value) {
        this._attributes = Array.isArray(value) ? value : [];
    }

    /** The cluster's name (the YAML names the rule after it), and whether the view has rules for other clusters before / after it. */
    @api clusterName = '';
    /** Whether the cluster has a child object, which makes it multi-valued: the YAML's cardinality is -1 then, 1 otherwise. */
    @api multiValued = false;
    /** The cluster's direction ('inbound' | 'outbound' | 'both'); the copy says sent, received or both to match. */
    @api direction = 'both';
    @api hasRulesBefore = false;
    @api hasRulesAfter = false;

    @api
    get filter() {
        return this._filter;
    }
    set filter(value) {
        this._filter = value ?? defaultViewFilter();
    }

    get isOverview() {
        return this.view === 'overview';
    }

    get isFilter() {
        return this.view === 'filter';
    }

    get isSort() {
        return this.view === 'sort';
    }

    get detailTitle() {
        return DETAIL_TITLES[this.view];
    }

    /** Set by the cluster's child object switch, never edited here: "All Values Sent" with a child object (cardinality -1), "1 Value Sent" otherwise. */
    get cardinalitySummary() {
        const { cardinalityWords } = this.directionWords;
        return this.multiValued ? `All Values ${cardinalityWords.all}` : `1 Value ${cardinalityWords.one}`;
    }

    get directionWords() {
        return DIRECTION_WORDS[this.direction] ?? DIRECTION_WORDS.both;
    }

    /** "sent", "received" or "sent or received", for use mid-sentence. */
    get sentOrReceived() {
        return this.directionWords.pastParticiple;
    }

    get activeOnlyLabel() {
        return `Only ${this.directionWords.verb} Active Values`;
    }

    get filterSummary() {
        return describeFilter(this._filter.filter);
    }

    get sortSummary() {
        return describeSort(this._filter.sort);
    }

    get isSortBoth() {
        return this._filter.sort.by === 'both';
    }

    get usesPriority() {
        return this._filter.sort.by !== 'recent';
    }

    get attributeOptions() {
        return this._attributes.map(({ name }) => ({ label: name, value: name }));
    }

    get filterAttribute() {
        return this._attributes.find(({ name }) => name === this._filter.filter.attribute);
    }

    get noFilterAttribute() {
        return !this.filterAttribute;
    }

    get isFilterEmpty() {
        return !this._filter.filter.attribute && !this._filter.filter.value;
    }

    /** Code sets and booleans offer their values; any other attribute takes typed text. */
    get valueOptions() {
        const attribute = this.filterAttribute;
        if (attribute?.type === 'CODE_SET') {
            return attribute.codeSetValues.map((value) => ({ label: value, value }));
        }
        return attribute?.type === 'BOOLEAN' ? BOOLEAN_OPTIONS : null;
    }

    get hasValueOptions() {
        return Boolean(this.valueOptions);
    }

    get valueInputType() {
        return INPUT_TYPES[this.filterAttribute?.type] ?? 'text';
    }

    get yamlText() {
        return (
            this.yamlDraft ??
            viewFilterToYaml(this._filter, {
                attributeName: this.attributeName,
                multiValued: this.multiValued,
                hasRulesBefore: this.hasRulesBefore,
                hasRulesAfter: this.hasRulesAfter
            })
        );
    }

    get attributeName() {
        return smartViewAttributeName(this.clusterName);
    }

    emit(changes) {
        this.dispatchEvent(new CustomEvent('filterchange', { detail: { filter: { ...this._filter, ...changes } } }));
    }

    handleOpen(event) {
        this.view = event.currentTarget.dataset.view;
    }

    handleBack() {
        this.view = 'overview';
    }

    /** Typing is applied as soon as it parses; until then the error is shown and the last good filter stays. */
    handleYaml(event) {
        this.yamlDraft = event.detail.value;
        const { filter, error } = parseViewFilterYaml(this.yamlDraft, this._filter, this.attributeName);
        this.yamlError = error ?? '';
        if (filter) {
            this.emit(filter);
        }
    }

    /** Leaving the editor rewrites the text from the filter, which restores a cardinality line that was edited or deleted. */
    handleYamlBlur() {
        if (!this.yamlError) {
            this.yamlDraft = null;
        }
    }

    handleActiveOnly(event) {
        this.emit({ activeOnly: event.target.checked });
    }

    // A new attribute has its own values, so the value starts over.
    handleFilterAttribute(event) {
        this.emit({ filter: { attribute: event.detail.value, value: '' } });
    }

    handleFilterValue(event) {
        this.emit({ filter: { ...this._filter.filter, value: event.detail.value } });
    }

    handleClearFilter() {
        this.emit({ filter: { attribute: '', value: '' } });
    }

    emitSort(changes) {
        this.emit({ sort: { ...this._filter.sort, ...changes } });
    }

    handleSortBy(event) {
        this.emitSort({ by: event.detail.value });
    }

    handleSortFirst(event) {
        this.emitSort({ first: event.detail.value });
    }

    handleIncludeUnprioritized(event) {
        this.emitSort({ includeUnprioritized: event.target.checked });
    }

    handleSources(event) {
        this.emitSort({ sources: event.detail.sources });
    }
}
