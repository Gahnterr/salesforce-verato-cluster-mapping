/**
 * Code sets (value lists) behind the CODE_SET attributes of the Core Person schema.
 * Modeled loosely on FHIR terminology: each set has a code system URI and coded
 * values ({ code, display }). Values are illustrative, not complete or authoritative.
 *
 * `usedBy` lists the attributes that take the set, as `<domainId>:<cluster path>.<attribute>`.
 */
const set = (id, name, system, values, usedBy) => ({
    id,
    name,
    system,
    values: values.map(([code, display]) => ({ code, display })),
    usedBy: usedBy.map((path) => `core-person:${path}`)
});

export const CODE_SETS = [
    set(
        'name-use',
        'Name Use',
        'http://hl7.org/fhir/name-use',
        [['usual', 'Usual'], ['official', 'Official'], ['temp', 'Temp'], ['nickname', 'Nickname'], ['anonymous', 'Anonymous'], ['old', 'Old'], ['maiden', 'Maiden']],
        ['names.use']
    ),
    set(
        'address-type',
        'Address Type',
        'http://hl7.org/fhir/address-type',
        [['postal', 'Postal'], ['physical', 'Physical'], ['both', 'Postal & Physical']],
        ['addresses.type']
    ),
    set(
        'administrative-gender',
        'Administrative Gender',
        'http://hl7.org/fhir/administrative-gender',
        [['male', 'Male'], ['female', 'Female'], ['other', 'Other'], ['unknown', 'Unknown']],
        ['genders.gender']
    ),
    set(
        'gender-identity',
        'Gender Identity',
        'http://hl7.org/fhir/gender-identity',
        [['female', 'Female'], ['male', 'Male'], ['non-binary', 'Non-Binary'], ['transgender-female', 'Transgender Female'], ['transgender-male', 'Transgender Male'], ['other', 'Other'], ['non-disclose', 'Non-Disclose']],
        ['genderIdentities.genderIdentity']
    ),
    set(
        'contact-point-use',
        'Contact Point Use',
        'http://hl7.org/fhir/contact-point-use',
        [['home', 'Home'], ['work', 'Work'], ['temp', 'Temp'], ['old', 'Old'], ['mobile', 'Mobile']],
        ['phoneNumbers.type', 'emails.type']
    ),
    set(
        'contact-point-system',
        'Contact Point System',
        'http://hl7.org/fhir/contact-point-system',
        [['phone', 'Phone'], ['fax', 'Fax'], ['email', 'Email'], ['pager', 'Pager'], ['url', 'URL'], ['sms', 'SMS'], ['other', 'Other']],
        ['preferences.channels.type']
    ),
    set(
        'days-of-week',
        'Days of the Week',
        'http://hl7.org/fhir/days-of-week',
        [['mon', 'Monday'], ['tue', 'Tuesday'], ['wed', 'Wednesday'], ['thu', 'Thursday'], ['fri', 'Friday'], ['sat', 'Saturday'], ['sun', 'Sunday']],
        ['phoneNumbers.bestTimeToContact.day']
    ),
    set(
        'yes-no-indicator',
        'Yes/No Indicator',
        'http://terminology.hl7.org/CodeSystem/v2-0136',
        [['Y', 'Yes'], ['N', 'No']],
        ['deathDetails.deceased']
    ),
    set(
        'identifier-type',
        'Identifier Type',
        'http://terminology.hl7.org/CodeSystem/v2-0203',
        [['MR', 'Medical Record Number'], ['SS', 'Social Security Number'], ['DL', "Driver's License Number"], ['PPN', 'Passport Number'], ['TAX', 'Tax ID Number'], ['NI', 'National Identifier']],
        ['alternateIdentifiers.type']
    ),
    set(
        'country',
        'Country',
        'urn:iso:std:iso:3166',
        [['US', 'United States'], ['CA', 'Canada'], ['MX', 'Mexico'], ['GB', 'United Kingdom'], ['DE', 'Germany'], ['FR', 'France'], ['ES', 'Spain'], ['IT', 'Italy'], ['IN', 'India'], ['CN', 'China'], ['JP', 'Japan'], ['BR', 'Brazil'], ['AU', 'Australia']],
        ['citizenships.citizenship']
    ),
    set(
        'sexual-orientation',
        'Sexual Orientation',
        'http://snomed.info/sct',
        [['heterosexual', 'Heterosexual'], ['homosexual', 'Homosexual'], ['bisexual', 'Bisexual'], ['asexual', 'Asexual'], ['pansexual', 'Pansexual'], ['other', 'Other'], ['unknown', 'Unknown']],
        ['sexualOrientations.sexualOrientation']
    ),
    set(
        'race',
        'Race',
        'urn:oid:2.16.840.1.113883.6.238',
        [['1002-5', 'American Indian or Alaska Native'], ['2028-9', 'Asian'], ['2054-5', 'Black or African American'], ['2076-8', 'Native Hawaiian or Other Pacific Islander'], ['2106-3', 'White'], ['2131-1', 'Other Race']],
        ['races.race']
    ),
    set(
        'ethnicity',
        'Ethnicity',
        'urn:oid:2.16.840.1.113883.6.238',
        [['2135-2', 'Hispanic or Latino'], ['2186-5', 'Not Hispanic or Latino']],
        ['ethnicities.ethnicity']
    ),
    set(
        'religious-affiliation',
        'Religious Affiliation',
        'http://terminology.hl7.org/CodeSystem/v3-ReligiousAffiliation',
        [['1007', 'Atheism'], ['1013', 'Buddhism'], ['1028', 'Christianity'], ['1041', 'Hinduism'], ['1023', 'Islam'], ['1034', 'Judaism'], ['1051', 'Sikhism']],
        ['religiousAffiliations.religiousAffiliation']
    ),
    set(
        'marital-status',
        'Marital Status',
        'http://terminology.hl7.org/CodeSystem/v3-MaritalStatus',
        [['A', 'Annulled'], ['D', 'Divorced'], ['L', 'Legally Separated'], ['M', 'Married'], ['S', 'Never Married'], ['T', 'Domestic Partner'], ['W', 'Widowed']],
        ['maritalStatuses.maritalStatus']
    ),
    set(
        'language',
        'Language',
        'urn:ietf:bcp:47',
        [['en', 'English'], ['es', 'Spanish'], ['fr', 'French'], ['de', 'German'], ['zh', 'Chinese'], ['vi', 'Vietnamese'], ['ar', 'Arabic'], ['hi', 'Hindi'], ['pt', 'Portuguese'], ['ru', 'Russian']],
        ['communicationLanguages.language']
    ),
    set(
        'qualification-type',
        'Qualification Type',
        'http://example.org/fhir/CodeSystem/qualification-type',
        [['license', 'License'], ['certification', 'Certification'], ['degree', 'Degree'], ['board-certification', 'Board Certification'], ['residency', 'Residency']],
        ['qualifications.type']
    ),
    set(
        'qualification-code',
        'Qualification',
        'http://terminology.hl7.org/CodeSystem/v2-0360',
        [['MD', 'Doctor of Medicine'], ['DO', 'Doctor of Osteopathy'], ['NP', 'Nurse Practitioner'], ['PA', 'Physician Assistant'], ['RN', 'Registered Nurse'], ['PharmD', 'Doctor of Pharmacy'], ['PhD', 'Doctor of Philosophy']],
        ['qualifications.qualification']
    ),
    set(
        'qualification-status',
        'Qualification Status',
        'http://example.org/fhir/CodeSystem/qualification-status',
        [['active', 'Active'], ['inactive', 'Inactive'], ['pending', 'Pending'], ['expired', 'Expired'], ['revoked', 'Revoked']],
        ['qualifications.status']
    ),
    set(
        'consent-category',
        'Consent Category',
        'http://terminology.hl7.org/CodeSystem/consentcategorycodes',
        [['acd', 'Advance Directive'], ['dnr', 'Do Not Resuscitate'], ['npp', 'Notice of Privacy Practices'], ['polst', 'POLST'], ['research', 'Research Information Access'], ['patient-privacy', 'Patient Privacy']],
        ['consents.type']
    ),
    set(
        'consent-state',
        'Consent State',
        'http://hl7.org/fhir/consent-state-codes',
        [['draft', 'Pending'], ['proposed', 'Proposed'], ['active', 'Active'], ['rejected', 'Rejected'], ['inactive', 'Inactive'], ['entered-in-error', 'Entered in Error']],
        ['consents.status']
    ),
    set(
        'consent-provision-type',
        'Consent Provision Type',
        'http://hl7.org/fhir/consent-provision-type',
        [['deny', 'Opt Out'], ['permit', 'Opt In']],
        ['consents.decision']
    ),
    set(
        'regulatory-basis',
        'Regulatory Basis',
        'http://example.org/fhir/CodeSystem/regulatory-basis',
        [['HIPAA', 'HIPAA'], ['42CFRPart2', '42 CFR Part 2'], ['GDPR', 'GDPR'], ['CCPA', 'CCPA'], ['state-law', 'State Law']],
        ['consents.regulatoryBasis']
    )
];
