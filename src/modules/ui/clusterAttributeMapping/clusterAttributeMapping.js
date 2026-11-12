import { LightningElement, api } from 'lwc';

/*
 * Placeholder Salesforce fields until the org's real schema is available, each with its field
 * type as Salesforce reports it (text, textarea, number, date, picklist, email, phone...).
 * The Contact ones are the standard fields with their default API names and types: the address
 * parts are plain text/textarea (state and country only become picklists when the org turns on
 * state and country picklists), and the compound MailingAddress/OtherAddress fields aren't
 * listed because they can't be mapped, only their parts.
 */
const field = (name, type) => ({ name, type });
const FIELDS = [
    field('Country__c', 'picklist'),
    field('Status__c', 'picklist'),
    field('Start_Date__c', 'date'),
    field('End_Date__c', 'date'),
    field('External_Id__c', 'text'),
    field('Email', 'email'),
    field('Phone', 'phone'),
    field('MobilePhone', 'phone'),
    field('HomePhone', 'phone'),
    field('OtherPhone', 'phone'),
    field('MailingStreet', 'textarea'),
    field('MailingCity', 'text'),
    field('MailingState', 'text'),
    field('MailingPostalCode', 'text'),
    field('MailingCountry', 'text'),
    field('OtherStreet', 'textarea'),
    field('OtherCity', 'text'),
    field('OtherState', 'text'),
    field('OtherPostalCode', 'text'),
    field('OtherCountry', 'text')
];

/** The field menu's first option; choosing it maps the attribute to a static value instead of a field. */
const STATIC_OPTION = { label: 'Static Value…', value: '__static__' };

const toOption = (value) => ({ label: value, value });

/**
 * Code set attributes can only map to picklist fields, and a field can't be mapped by more than one
 * attribute, so the fields `taken` by other rows are left out. A group concatenates its attributes
 * into text, so it can't map to a picklist field.
 */
const fieldOptionsFor = (isCodeSet, taken, isGroup = false) => [
    STATIC_OPTION,
    ...FIELDS.filter(
        (field) =>
            (isGroup ? field.type !== 'picklist' : field.type === 'picklist' || !isCodeSet) && !taken.has(field.name)
    ).map((field) => toOption(field.name))
];

/** How a group's value joins a member to the one after it; the last member has none. */
const SEPARATOR_OPTIONS = [
    { label: 'Line Break', value: 'line-break' },
    { label: 'Comma', value: 'comma' },
    { label: 'Space', value: 'space' },
    { label: 'Hyphen', value: 'hyphen' },
];
const DEFAULT_SEPARATOR = 'line-break';

/**
 * How a Salesforce value is split back into a group's attributes: where each one's part ends. The first
 * attribute takes the value up to the delimiter; every later one takes what is left of it until the next one.
 */
const METHOD_DELIMITERS = [
    { label: 'Line Break', value: 'line-break' },
    { label: 'Comma', value: 'comma' },
    { label: 'Period', value: 'period' },
    { label: 'Space', value: 'space' },
    { label: 'Hyphen', value: 'hyphen' }
];
const CUSTOM_REGEX = 'regex';
const methodOptions = (isFirst) => [
    ...METHOD_DELIMITERS.map(({ label, value }) => ({ label: `${isFirst ? 'Up to Next' : 'From Remaining Value Until Next'} ${label}`, value })),
    { label: 'Custom Regex', value: CUSTOM_REGEX }
];
const FIRST_METHOD_OPTIONS = methodOptions(true);
const LATER_METHOD_OPTIONS = methodOptions(false);
const FIRST_METHOD_HELP = 'Takes the part of the Salesforce value before the first match of the chosen delimiter.';
const LATER_METHOD_HELP = 'Takes what is left of the Salesforce value, after the attributes above, up to the next match of the chosen delimiter.';

/** The icon shown for each attribute type; a type without one (time, date time) keeps its text badge. */
const TYPE_ICONS = {
    TEXT: 'utility:text',
    CODE_SET: 'utility:picklist_type',
    NUMBER: 'utility:number_input',
    DATE: 'utility:date_input',
    BOOLEAN: 'utility:toggle'
};

/** Menu items always show an icon, so the types that have none in the grid (they keep a text badge there) get one here. */
const MENU_ICONS = { ...TYPE_ICONS, TIME: 'utility:clock', 'DATE-TIME': 'utility:date_time' };

const GROUP_PREFIX = 'group:';
const DIVIDER = 'slds-border_bottom c-row_divided';

/** The info text beside an attribute: its example value. Code sets list their valid values instead, so they have none. */
const exampleTextOf = (attribute) =>
    attribute?.example && !Array.isArray(attribute.codeSetValues) ? `Example: ${attribute.example}` : '';

/** The Add Attribute menu's "Add all attributes" item; no attribute is named like this. */
const ADD_ALL = '__add-all__';
/** The share of a group row's height, at its top and bottom, where a dragged attribute lands next to the group instead of in it. */
const GROUP_EDGE = 0.25;
const ALL_MAPPED_TITLE = 'All attributes are now mapped.';
const NEW_GROUP_NAME = 'Untitled Group';
const EMPTY_ROW = { mapTo: 'field', field: '', staticValue: '' };

/**
 * Grid of the attributes a cluster maps. Attributes are added from a menu of those not yet in the grid;
 * each row maps its attribute to a Salesforce field, or to a static value when "Static Value…" is picked
 * from the field menu. A group is a row of its own that concatenates the attributes inside it (shown
 * below it while it is expanded) into one value with its own field or static value. Attributes are
 * dragged into, out of and within groups, and ticked rows can be grouped from the header toolbar.
 * Controlled: reports every change as `attributeschange` ({ attributes, groups }).
 */
export default class ClusterAttributeMapping extends LightningElement {
    /** The cluster's schema attributes ({ name, typeLabel, codeSetValues }). */
    @api attributes = [];
    /** Mapped rows keyed by attribute name ({ mapTo, field, staticValue }). */
    @api mapped = {};
    /** Validation problems ({ target, message }); a row's shows on its field, the grid's under the empty state. */
    @api issues = [];
    /** The cluster's direction ('inbound' | 'outbound' | 'both'); sets which way the arrow in the header points. */
    @api direction = 'inbound';
    /** Attribute groups ({ id, name, members, mapTo, field, staticValue }); their members aren't in `mapped`. */
    @api
    get groups() {
        return this._groups;
    }
    set groups(value) {
        this._groups = Array.isArray(value) ? value : [];
    }

    /**
     * The order the grid's rows and groups are shown in, as keys ('row|<attribute>' / 'group|<id>');
     * what isn't listed (a mapping saved without it) follows in the order it was added.
     */
    @api order = [];

    _groups = [];
    /** Keys ('row|<attribute>' / 'group|<id>') of the ticked rows and groups. */
    selectedKeys = [];
    /** Ids of the groups that are collapsed (groups start out expanded). */
    collapsedIds = [];
    /** The row being dragged ({ group: its group's id or '', name }); not reactive, it only has to survive until the drop. */
    _drag = null;
    /** Keys of the dragged row and of the row it would land next to, and on which side. */
    dragKey = '';
    /** The row whose handle is held down: rows are draggable only then, so their inputs keep text selection. */
    armedKey = '';
    dropKey = '';
    dropPosition = '';
    /** The group whose name input gets focus once it is rendered (a group just added). */
    _focusGroupId = '';

    // Inbound is Verato -> Salesforce, left to right; outbound the other way.
    get showArrowRight() {
        return this.direction !== 'outbound';
    }

    get showArrowLeft() {
        return this.direction !== 'inbound';
    }

    /** The Salesforce fields that rows and groups other than `key` already map to. */
    fieldsTakenExcept(key) {
        const mappings = [
            ...Object.entries(this.mapped),
            ...this.groups.map((group) => [`${GROUP_PREFIX}${group.id}`, group])
        ];
        return new Set(
            mappings
                .filter(([other, mapping]) => other !== key && mapping.mapTo === 'field' && mapping.field)
                .map(([, mapping]) => mapping.field)
        );
    }

    get selectedSet() {
        const shown = this.displayOrder;
        return new Set(this.selectedKeys.filter((key) => shown.includes(key)));
    }

    /** A row's classes: dimmed while dragged, with a line on the side where the dragged row would land. */
    rowClass(key, kind) {
        const classes = ['c-row'];
        if (kind === 'member' || kind === 'footer') {
            classes.push('c-row_member');
        }
        if (key === this.dragKey) {
            classes.push('c-row_dragging');
        }
        if (key === this.dropKey && key !== this.dragKey) {
            if (kind === 'group' && this.dropPosition === 'into') {
                classes.push('c-row_drop-into');
            } else {
                classes.push(this.dropPosition === 'before' ? 'c-row_drop-before' : 'c-row_drop-after');
            }
        }
        return classes.join(' ');
    }

    get rows() {
        const selected = this.selectedSet;
        return Object.entries(this.mapped)
            .map(([name, mapping]) => ({ attribute: this.attributes.find((a) => a.name === name), mapping }))
            .filter(({ attribute }) => attribute)
            .map(({ attribute, mapping }) => {
                const key = `row|${attribute.name}`;
                return {
                    key,
                    className: this.rowClass(key, 'row'),
                    isArmed: this.armedKey === key,
                    name: attribute.name,
                    isSelected: selected.has(key),
                    typeLabel: attribute.typeLabel,
                    typeIcon: TYPE_ICONS[attribute.type],
                    codeSetText: attribute.codeSetValues ? attribute.codeSetValues.join(', ') : '',
                    isCodeSet: Array.isArray(attribute.codeSetValues),
                    exampleText: exampleTextOf(attribute),
                    fieldOptions: fieldOptionsFor(
                        Array.isArray(attribute.codeSetValues),
                        this.fieldsTakenExcept(attribute.name)
                    ),
                    fieldClass: mapping.mapTo === 'static' ? 'c-static-select' : 'slds-col',
                    staticOptions: (attribute.codeSetValues ?? []).map(toOption),
                    isStatic: mapping.mapTo === 'static',
                    selection: mapping.mapTo === 'static' ? STATIC_OPTION.value : mapping.field,
                    staticValue: mapping.staticValue
                };
            });
    }

    get groupRows() {
        return this.groups.map((group) => {
            const valueKey = `${GROUP_PREFIX}${group.id}`;
            const key = `group|${group.id}`;
            const isStatic = group.mapTo === 'static';
            const isExpanded = !this.collapsedIds.includes(group.id);
            return {
                key,
                valueKey,
                id: group.id,
                footerKey: `footer|${group.id}`,
                name: group.name,
                className: this.rowClass(key, 'group'),
                isSelected: this.selectedSet.has(key),
                isExpanded,
                chevronIcon: isExpanded ? 'utility:chevrondown' : 'utility:chevronright',
                chevronLabel: isExpanded ? 'Collapse group' : 'Expand group',
                members: group.members.map((name, index) => {
                    const memberKey = `member|${group.id}|${name}`;
                    return {
                        key: memberKey,
                        className: this.rowClass(memberKey, 'member'),
                        isArmed: this.armedKey === memberKey,
                        name,
                        groupId: group.id,
                        hasSeparator: index < group.members.length - 1,
                        separator: group.separators?.[name] ?? DEFAULT_SEPARATOR,
                        // Splitting needs a Salesforce field to split; a static value or no field leaves nothing to split,
                        // and an inbound cluster only writes to Salesforce, so it never splits anything back.
                        hasMethod: !isStatic && Boolean(group.field) && this.direction !== 'inbound',
                        methodOptions: index === 0 ? FIRST_METHOD_OPTIONS : LATER_METHOD_OPTIONS,
                        methodHelp: index === 0 ? FIRST_METHOD_HELP : LATER_METHOD_HELP,
                        method: group.methods?.[name] ?? '',
                        isRegex: group.methods?.[name] === CUSTOM_REGEX,
                        regex: group.regexes?.[name] ?? '',
                        typeLabel: this.attributes.find((a) => a.name === name)?.typeLabel ?? '',
                        typeIcon: TYPE_ICONS[this.attributes.find((a) => a.name === name)?.type],
                        exampleText: exampleTextOf(this.attributes.find((a) => a.name === name))
                    };
                }),
                fieldOptions: fieldOptionsFor(false, this.fieldsTakenExcept(valueKey), true),
                fieldClass: isStatic ? 'c-static-select' : 'slds-col',
                isStatic,
                selection: isStatic ? STATIC_OPTION.value : group.field,
                staticValue: group.staticValue
            };
        });
    }

    get separatorOptions() {
        return SEPARATOR_OPTIONS;
    }

    get selectedCount() {
        return this.selectedSet.size;
    }

    get hasSelection() {
        return this.selectedCount > 0;
    }

    get selectedLabel() {
        return `${this.selectedCount} Selected`;
    }

    get selectedRowNames() {
        return [...this.selectedSet].filter((key) => key.startsWith('row|')).map((key) => key.slice('row|'.length));
    }

    get selectedGroupIds() {
        return [...this.selectedSet].filter((key) => key.startsWith('group|')).map((key) => key.slice('group|'.length));
    }

    /** Grouping needs two or more attributes, and groups can't be grouped, so any ticked group rules it out. */
    get showGroupAction() {
        return this.selectedRowNames.length >= 2 && this.selectedGroupIds.length === 0;
    }

    get showUngroupAction() {
        return this.selectedGroupIds.length > 0;
    }

    get isSelectAllDisabled() {
        return this.displayOrder.length === 0;
    }

    get allSelected() {
        return this.displayOrder.length > 0 && this.displayOrder.every((key) => this.selectedSet.has(key));
    }

    get someSelected() {
        return this.hasSelection && !this.allSelected;
    }

    issueFor(target) {
        return this.issues.find((issue) => issue.target === target)?.message ?? '';
    }

    get gridIssue() {
        return this.issueFor('attributes');
    }

    renderedCallback() {
        // The select-all checkbox is a half-ticked dash while only some rows are ticked, which only the
        // native input can show (lightning-input has no such state).
        const selectAll = this.template.querySelector('[data-select-all]');
        if (selectAll) {
            selectAll.indeterminate = this.someSelected;
        }
        // Show (or clear) each row's validation message on the input it is about: the field menu
        // while the row maps to a field, the static value input while it maps to a static value.
        this.template.querySelectorAll('[data-value-input]').forEach((input) => {
            const { name, kind } = input.dataset;
            const isGroup = name.startsWith(GROUP_PREFIX);
            const mapping = isGroup ? this.groups.find((group) => `${GROUP_PREFIX}${group.id}` === name) : this.mapped[name];
            const isActive = (mapping?.mapTo === 'static') === (kind === 'static');
            const message = isActive ? this.issueFor(isGroup ? name : `attribute:${name}`) : '';
            input.setCustomValidity(message);
            if (message) {
                input.reportValidity();
            }
        });
        // The same for a group member's mapping method and custom regex; reporting even with no message clears an earlier error.
        this.template.querySelectorAll('[data-method-input]').forEach((input) => {
            input.setCustomValidity(this.issueFor(`${input.dataset.methodInput}:${input.dataset.group}|${input.dataset.name}`));
            input.reportValidity();
        });
        // A group that was just added opens with its name focused and selected, ready to be replaced.
        if (this._focusGroupId) {
            const input = this.template.querySelector(`[data-group-name="${this._focusGroupId}"]`);
            if (input) {
                this._focusGroupId = '';
                input.focus();
                input.selectionStart = 0;
                input.selectionEnd = input.value.length;
            }
        }
    }

    get displayOrder() {
        const existing = [
            ...Object.keys(this.mapped).map((name) => `row|${name}`),
            ...this.groups.map((group) => `group|${group.id}`)
        ];
        const listed = (this.order ?? []).filter((key) => existing.includes(key));
        return [...listed, ...existing.filter((key) => !listed.includes(key))];
    }

    /** The grid's rows and groups interleaved in the order they were added (a new one always lands at the bottom). */
    get entries() {
        const items = new Map([...this.rows, ...this.groupRows].map((item) => [item.key, item]));
        const keys = this.displayOrder.filter((key) => items.has(key));
        return keys.map((key, index) => {
            // Every top-level row but the last has a bottom border; an open group has it on its last row.
            const divided = index < keys.length - 1;
            const item = items.get(key);
            if (key.startsWith('row|')) {
                return { key, row: { ...item, className: divided ? `${item.className} ${DIVIDER}` : item.className } };
            }
            return {
                key,
                group: {
                    ...item,
                    className: divided && !item.isExpanded ? `${item.className} ${DIVIDER}` : item.className,
                    footerClass: divided && item.isExpanded ? `${this.rowClass(`footer|${item.id}`, 'footer')} ${DIVIDER}` : this.rowClass(`footer|${item.id}`, 'footer')
                }
            };
        });
    }

    get hasRows() {
        return this.rows.length > 0 || this.groups.length > 0;
    }

    get availableAttributes() {
        const grouped = new Set(this.groups.flatMap((group) => group.members));
        return this.attributes
            .filter((attribute) => !this.mapped[attribute.name] && !grouped.has(attribute.name))
            .map((attribute) => ({
                name: attribute.name,
                label: attribute.name,
                icon: MENU_ICONS[attribute.type] ?? 'utility:text'
            }));
    }

    get addAllValue() {
        return ADD_ALL;
    }

    /** Adding everything is only worth its own item when the cluster has more than one attribute. */
    get showAddAll() {
        return this.attributes.length > 1 && this.availableAttributes.length > 0;
    }

    get isAddDisabled() {
        return this.availableAttributes.length === 0;
    }

    get addTitle() {
        return this.isAddDisabled && this.hasRows ? ALL_MAPPED_TITLE : '';
    }

    emit(attributes, groups = this.groups, shownOrder = this.displayOrder) {
        // Keep the shown order, drop what is gone, and put whatever is new at the end.
        const existing = [
            ...Object.keys(attributes).map((name) => `row|${name}`),
            ...groups.map((group) => `group|${group.id}`)
        ];
        const kept = shownOrder.filter((key) => existing.includes(key));
        const order = [...kept, ...existing.filter((key) => !kept.includes(key))];
        this.dispatchEvent(new CustomEvent('attributeschange', { detail: { attributes, groups, order } }));
    }

    update(key, changes) {
        if (key.startsWith(GROUP_PREFIX)) {
            this.updateGroup(key.slice(GROUP_PREFIX.length), changes);
        } else {
            this.emit({ ...this.mapped, [key]: { ...this.mapped[key], ...changes } });
        }
    }

    updateGroup(id, changes) {
        this.emit(
            this.mapped,
            this.groups.map((group) => (group.id === id ? { ...group, ...changes } : group))
        );
    }

    handleAdd(event) {
        if (event.detail.value === ADD_ALL) {
            const added = Object.fromEntries(this.availableAttributes.map(({ name }) => [name, { ...EMPTY_ROW }]));
            this.emit({ ...this.mapped, ...added });
            return;
        }
        this.emit({ ...this.mapped, [event.detail.value]: { ...EMPTY_ROW } });
    }

    handleAddToGroup(event) {
        const group = this.groups.find((candidate) => candidate.id === event.target.dataset.group);
        const added = event.detail.value === ADD_ALL ? this.availableAttributes.map(({ name }) => name) : [event.detail.value];
        this.updateGroup(group.id, { members: [...group.members, ...added] });
    }

    /**
     * Adds a group, expanded, with the given members; its name input takes focus once it renders. It lands
     * at the bottom, or, when `placeAt` (a row key in the shown order) is given, in that row's place.
     */
    addGroup(members, attributes = this.mapped, placeAt = '') {
        const number = Math.max(0, ...this.groups.map((group) => Number(group.id.replace('group-', '')))) + 1;
        const id = `group-${number}`;
        this._focusGroupId = id;
        const shownOrder = placeAt
            ? this.displayOrder.map((key) => (key === placeAt ? `group|${id}` : key))
            : this.displayOrder;
        this.emit(attributes, [...this.groups, { id, name: NEW_GROUP_NAME, members, ...EMPTY_ROW }], shownOrder);
    }

    handleAddGroup() {
        this.addGroup([]);
    }

    /** Moves the ticked attributes out of the grid's rows into a new group, in the order the rows are shown, where the first of them was. */
    handleGroup() {
        const selected = this.selectedSet;
        const keys = this.displayOrder.filter((key) => key.startsWith('row|') && selected.has(key));
        if (keys.length < 2) {
            return;
        }
        const members = keys.map((key) => key.slice('row|'.length));
        const attributes = { ...this.mapped };
        members.forEach((name) => delete attributes[name]);
        this.selectedKeys = [];
        this.addGroup(members, attributes, keys[0]);
    }

    /** Turns each ticked group back into plain rows, in the place the group was. */
    handleUngroup() {
        const ungrouped = this.groups.filter((group) => this.selectedGroupIds.includes(group.id));
        const attributes = { ...this.mapped };
        ungrouped.forEach((group) => group.members.forEach((name) => (attributes[name] = { ...EMPTY_ROW })));
        const shownOrder = this.displayOrder.flatMap((key) => {
            const group = ungrouped.find((candidate) => `group|${candidate.id}` === key);
            return group ? group.members.map((name) => `row|${name}`) : [key];
        });
        this.selectedKeys = [];
        this.emit(
            attributes,
            this.groups.filter((group) => !ungrouped.includes(group)),
            shownOrder
        );
    }

    /** Deletes the ticked rows and groups (a group's attributes go with it). */
    handleDeleteSelected() {
        const attributes = { ...this.mapped };
        this.selectedRowNames.forEach((name) => delete attributes[name]);
        const groupIds = this.selectedGroupIds;
        this.selectedKeys = [];
        this.emit(
            attributes,
            this.groups.filter((group) => !groupIds.includes(group.id))
        );
    }

    handleGroupName(event) {
        this.updateGroup(event.target.dataset.groupName, { name: event.target.value });
    }

    handleToggleGroup(event) {
        const { group } = event.currentTarget.dataset;
        this.collapsedIds = this.collapsedIds.includes(group)
            ? this.collapsedIds.filter((id) => id !== group)
            : [...this.collapsedIds, group];
    }

    handleField(event) {
        const { value } = event.detail;
        this.update(
            event.target.dataset.name,
            value === STATIC_OPTION.value ? { mapTo: 'static' } : { mapTo: 'field', field: value }
        );
    }

    handleSeparator(event) {
        const { group, name } = event.target.dataset;
        const { separators } = this.groups.find((candidate) => candidate.id === group);
        this.updateGroup(group, { separators: { ...separators, [name]: event.detail.value } });
    }

    handleMethod(event) {
        const { group, name } = event.target.dataset;
        const { methods } = this.groups.find((candidate) => candidate.id === group);
        this.updateGroup(group, { methods: { ...methods, [name]: event.detail.value } });
    }

    handleRegex(event) {
        const { group, name } = event.target.dataset;
        const { regexes } = this.groups.find((candidate) => candidate.id === group);
        this.updateGroup(group, { regexes: { ...regexes, [name]: event.detail.value } });
    }

    handleStaticValue(event) {
        this.update(event.target.dataset.name, { staticValue: event.target.value });
    }

    handleRemoveAll() {
        this.selectedKeys = [];
        this.emit({}, []);
    }

    handleDelete(event) {
        const { name } = event.target.dataset;
        if (name.startsWith(GROUP_PREFIX)) {
            this.emit(this.mapped, this.groups.filter((group) => `${GROUP_PREFIX}${group.id}` !== name));
        } else {
            const { [name]: removed, ...rest } = this.mapped;
            this.emit(rest);
        }
    }

    /** Takes an attribute out of its group altogether (it goes back to the Add Attribute menu). */
    handleDeleteMember(event) {
        const { group, name } = event.target.dataset;
        this.updateGroup(group, { members: this.groups.find((g) => g.id === group).members.filter((m) => m !== name) });
    }

    handleSelectRow(event) {
        const { key } = event.target.dataset;
        const others = this.selectedKeys.filter((selected) => selected !== key);
        this.selectedKeys = event.target.checked ? [...others, key] : others;
    }

    handleSelectAll(event) {
        this.selectedKeys = event.target.checked ? this.displayOrder : [];
    }

    handleClearSelection() {
        this.selectedKeys = [];
    }

    handleArm(event) {
        this.armedKey = event.currentTarget.dataset.key;
    }

    handleDisarm() {
        this.armedKey = '';
    }

    handleDragStart(event) {
        const { group = '', name } = event.currentTarget.dataset;
        this._drag = { group, name };
        event.dataTransfer.effectAllowed = 'move';
        // Firefox won't start a drag without data.
        event.dataTransfer.setData('text/plain', name);
        this.setDragImage(event);
        const key = group ? `member|${group}|${name}` : `row|${name}`;
        // Restyling inside the handler would cancel the drag in some browsers, so wait a tick.
        setTimeout(() => {
            if (this._drag) {
                this.dragKey = key;
            }
        }, 0);
    }

    /**
     * The browser's own snapshot of a subgrid row also picks up what sits below it, so the drag image is built
     * from a copy of just this row, in a copy of the grid with the same column widths, kept off screen for a tick.
     */
    setDragImage(event) {
        const row = event.currentTarget;
        const grid = row.closest('.c-grid');
        const { left, top, width } = row.getBoundingClientRect();
        const image = grid.cloneNode(false);
        image.classList.add('c-drag-image');
        image.style.setProperty('--c-drag-width', `${width}px`);
        image.style.setProperty('--c-drag-columns', getComputedStyle(grid).gridTemplateColumns);
        image.appendChild(row.cloneNode(true));
        document.body.appendChild(image);
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
        const { key, kind, group: groupId } = event.currentTarget.dataset;
        let position = event.clientY < top + height / 2 ? 'before' : 'after';
        if (kind === 'group') {
            // The edges of a group row place the dragged attribute above / below the group; the middle drops it into the group.
            // (An open group's lower edge is its footer's job.)
            const ratio = (event.clientY - top) / height;
            const isOpen = !this.collapsedIds.includes(groupId);
            position = ratio < GROUP_EDGE ? 'before' : ratio > 1 - GROUP_EDGE && !isOpen ? 'after' : 'into';
        } else if (kind === 'footer') {
            position = 'after';
        }
        if (key !== this.dropKey || position !== this.dropPosition) {
            this.dropKey = key;
            this.dropPosition = position;
        }
    }

    /**
     * Dropping on the middle of a group's row adds the dragged attribute to the end of that group; on one of its members,
     * next to that member. Anywhere else (an ungrouped row, the edge of a group, an open group's footer) it lands at that spot
     * of the top-level list: above or below the row or group, taken out of its group if it was in one.
     */
    handleDrop(event) {
        event.preventDefault();
        const { kind, group: targetGroup = '', name: target } = event.currentTarget.dataset;
        const drag = this._drag;
        const position = this.dropPosition;
        this.handleDragEnd();
        if (!drag || (kind === 'member' && drag.group === targetGroup && drag.name === target)) {
            return;
        }
        let attributes = this.mapped;
        // The members arrays are read-only (they came in through @api), so each group gets its own copy to splice.
        let groups = this.groups.map((group) => ({ ...group, members: [...group.members] }));
        const source = groups.find((group) => group.id === drag.group);
        if (source) {
            source.members = source.members.filter((name) => name !== drag.name);
        }
        const isTopLevel = kind === 'row' || kind === 'footer' || (kind === 'group' && position !== 'into');
        if (isTopLevel) {
            const dragKey = `row|${drag.name}`;
            const targetKey = kind === 'row' ? `row|${target}` : `group|${targetGroup}`;
            if (dragKey === targetKey) {
                return;
            }
            if (source) {
                attributes = { ...attributes, [drag.name]: { ...EMPTY_ROW } };
            }
            const order = this.displayOrder.filter((key) => key !== dragKey);
            order.splice(order.indexOf(targetKey) + (position === 'after' ? 1 : 0), 0, dragKey);
            this.emit(attributes, groups, order);
            return;
        }
        if (!source) {
            attributes = { ...this.mapped };
            delete attributes[drag.name];
        }
        const destination = groups.find((group) => group.id === targetGroup);
        const index = kind === 'group' ? destination.members.length : destination.members.indexOf(target) + (position === 'after' ? 1 : 0);
        destination.members.splice(index, 0, drag.name);
        this.emit(attributes, groups);
    }

    handleDragEnd() {
        this._drag = null;
        this.armedKey = '';
        this.dragKey = '';
        this.dropKey = '';
        this.dropPosition = '';
    }
}
