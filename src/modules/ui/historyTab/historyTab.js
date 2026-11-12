import { LightningElement } from 'lwc';
import { getSyncEvents } from 'data/syncHistory';
import { getAllClusters } from 'data/clusters';
import { getAllVeratoDomains } from 'data/veratoDomains';
import {
    ALL,
    applyFilters,
    loadFilters,
    periodLabel,
    saveFilters,
    STATUSES
} from 'data/historyFilters';

const COLUMNS = [
    {
        label: 'Record',
        fieldName: 'recordName',
        type: 'button',
        initialWidth: 165,
        typeAttributes: { label: { fieldName: 'recordName' }, variant: 'base', name: 'open' }
    },
    { label: 'Status', fieldName: 'statusLabel', type: 'statusBadge', initialWidth: 100, typeAttributes: { theme: { fieldName: 'statusTheme' } } },
    { label: 'Changed clusters', fieldName: 'changedClusters', initialWidth: 300 },
    { label: 'Last payload', fieldName: 'lastPayload', initialWidth: 400 },
    { label: 'Posts / skipped', fieldName: 'postsSkipped', initialWidth: 110 },
    { label: 'Last posted', fieldName: 'lastPostedText', initialWidth: 195 },
    { label: 'Link ID', fieldName: 'linkId', initialWidth: 195, cellAttributes: { class: 'slds-text-font_monospace' } }
];

const STATUS_THEMES = {
    pending: 'slds-theme_warning',
    sent: 'slds-theme_success',
    skipped: 'slds-theme_info',
    failed: 'slds-theme_error'
};

const STATUS_ICONS = {
    pending: 'standard:today',
    sent: 'action:check',
    skipped: 'standard:outcome',
    failed: 'action:close'
};

/**
 * "History" tab: a log of records sent to (or skipped for) Verato MDM Cloud, so users can watch
 * the sync while testing a mapping or chasing an issue. Everything is filtered client-side.
 */
export default class HistoryTab extends LightningElement {
    columns = COLUMNS;
    filters = loadFilters();
    events = [];
    domains = [];
    clusters = [];
    lastUpdated = Date.now();

    connectedCallback() {
        this.refresh();
    }

    async refresh() {
        [this.events, this.domains, this.clusters] = await Promise.all([
            getSyncEvents(),
            getAllVeratoDomains(),
            getAllClusters()
        ]);
        this.lastUpdated = Date.now();
    }

    // ---- Filter options -------------------------------------------------------

    get sourceOptions() {
        const sources = [...new Set(this.events.map((event) => event.sourceName))].sort();
        return [{ value: ALL, label: 'All Sources' }, ...sources.map((source) => ({ value: source, label: source }))];
    }

    /** Only domains with a loaded schema, and only clusters that schema contains, grouped by domain. */
    get clusterOptions() {
        const groups = this.domains
            .filter((domain) => domain.hasSchema)
            .map((domain) => ({
                label: domain.name,
                options: this.clusters
                    .filter((cluster) => cluster.domainId === domain.id)
                    .map((cluster) => ({ value: cluster.id, label: cluster.name }))
            }))
            .filter((group) => group.options.length > 0);
        return [{ value: ALL, label: 'All Clusters' }, ...groups];
    }

    // ---- Rows and header text -------------------------------------------------

    get rows() {
        return applyFilters(this.events, this.filters).map((event) => ({
            ...event,
            statusLabel: event.status.toUpperCase(),
            statusTheme: STATUS_THEMES[event.status]
        }));
    }

    get hasNoRows() {
        return this.rows.length === 0;
    }

    get eventCountText() {
        const count = this.rows.length;
        return `${count} event${count === 1 ? '' : 's'} in the ${periodLabel(this.filters)}`;
    }

    /**
     * One KPI card per status. Counts follow every filter except status, so the cards keep
     * showing what each status would add; the card matching the status filter is highlighted.
     */
    get statusCards() {
        const counts = applyFilters(this.events, { ...this.filters, statuses: STATUSES.map((s) => s.value) }).reduce(
            (totals, event) => ({ ...totals, [event.status]: (totals[event.status] ?? 0) + 1 }),
            {}
        );
        const onlyStatus = this.filters.statuses.length === 1 ? this.filters.statuses[0] : null;
        return STATUSES.map(({ value, label }) => {
            const isActive = onlyStatus === value;
            return {
                value,
                label,
                count: counts[value] ?? 0,
                iconName: STATUS_ICONS[value],
                iconClass: `c-kpi__icon c-kpi__icon_${value}`,
                // Action icons draw their own padded circle; standard icons fill the whole size.
                iconSize: STATUS_ICONS[value].startsWith('action:') ? 'x-small' : 'medium',
                isActive,
                title: `Show only ${label.toLowerCase()} events`,
                className: isActive ? 'c-kpi c-kpi_active' : 'c-kpi'
            };
        });
    }

    // ---- Events ---------------------------------------------------------------

    handleFilterChange(event) {
        this.filters = event.detail;
        saveFilters(this.filters);
    }

    handleStatusCard(event) {
        this.handleFilterChange({ detail: { ...this.filters, statuses: [event.currentTarget.dataset.status] } });
    }
}
