/**
 * Example values for the Core Person attributes, shown as "Example: ..." help in the mapping UI.
 * One synthetic person throughout. Values follow FHIR's primitive formats (date YYYY-MM-DD, dateTime
 * ISO 8601 with offset, time hh:mm:ss, decimal, boolean) and, for code sets, the code from the set's
 * code system (see codeSets.js) rather than its display name.
 *
 * Keyed by `<cluster path>.<attribute>`; the domain id is added by `ATTRIBUTE_EXAMPLES`.
 */
const CORE_PERSON_EXAMPLES = {
    'names.use': 'official',
    'names.prefix': 'Dr.',
    'names.first': 'Maria',
    'names.middle': 'Elena',
    'names.last': 'Garcia',
    'names.suffix': 'Jr.',
    'names.credential': 'MD',

    'addresses.type': 'both',
    'addresses.line1': '742 Evergreen Terrace',
    'addresses.line2': 'Apt 4B',
    'addresses.city': 'Springfield',
    'addresses.district': 'Sangamon',
    'addresses.state': 'IL',
    'addresses.postalCode': '62704',
    'addresses.country': 'US',
    'addresses.latitude': '39.7817',
    'addresses.longitude': '-89.6501',
    'addresses.validFrom': '2020-01-15',
    'addresses.validTo': '2026-12-31',

    'datesOfBirth.dateOfBirth': '1985-07-23',
    'ssns.ssn': '123-45-6789',
    'genders.gender': 'female',
    'genderIdentities.genderIdentity': 'female',

    'phoneNumbers.type': 'mobile',
    'phoneNumbers.countryCode': '+1',
    'phoneNumbers.areaCode': '217',
    'phoneNumbers.number': '555-0143',
    'phoneNumbers.extension': '204',
    'phoneNumbers.validFrom': '2021-03-01',
    'phoneNumbers.validTo': '2027-03-01',
    'phoneNumbers.bestTimeToContact.day': 'mon',
    'phoneNumbers.bestTimeToContact.startTime': '09:00:00',
    'phoneNumbers.bestTimeToContact.endTime': '17:00:00',
    'phoneNumbers.bestTimeToContact.allDay': 'false',

    'emails.type': 'home',
    'emails.email': 'maria.garcia@example.org',
    'emails.validFrom': '2019-06-01',
    'emails.validTo': '2027-06-01',

    'deathDetails.deceased': 'Y',
    'deathDetails.dateOfDeath': '2024-11-02T08:30:00-06:00',
    'deathDetails.city': 'Springfield',
    'deathDetails.county': 'Sangamon',
    'deathDetails.state': 'IL',
    'deathDetails.country': 'US',

    'externalUniqueIdentifier.issuer': 'Springfield General Hospital',
    'externalUniqueIdentifier.value': 'EXT-000123456',
    'externalUniqueIdentifier.status': 'active',
    'externalUniqueIdentifier.startDate': '2018-04-12',
    'externalUniqueIdentifier.endDate': '2028-04-12',

    'alternateIdentifiers.description': 'Hospital medical record number',
    'alternateIdentifiers.type': 'MR',
    'alternateIdentifiers.value': 'MRN-0048213',
    'alternateIdentifiers.status': 'active',
    'alternateIdentifiers.issuer': 'Springfield General Hospital',
    'alternateIdentifiers.issueDate': '2018-04-12',
    'alternateIdentifiers.startDate': '2018-04-12',
    'alternateIdentifiers.endDate': '2028-04-12',

    'multipleBirthIndicator.multipleBirthIndicator': 'true',
    'multipleBirthIndicator.multipleBirthInteger': '2',
    'multipleBirthIndicator.birthPlurality': '2',

    'citizenships.citizenship': 'US',
    'photos.url': 'https://example.org/photos/maria-garcia.jpg',
    'sexualOrientations.sexualOrientation': 'heterosexual',
    'races.race': '2106-3',
    'ethnicities.ethnicity': '2135-2',
    'religiousAffiliations.religiousAffiliation': '1028',
    'maritalStatuses.maritalStatus': 'M',
    'communicationLanguages.language': 'es',
    'communicationLanguages.preferred': 'true',

    'qualifications.type': 'license',
    'qualifications.qualification': 'MD',
    'qualifications.status': 'active',
    'qualifications.issuer': 'Illinois Department of Financial and Professional Regulation',
    'qualifications.issueDate': '2012-06-01',
    'qualifications.validFrom': '2012-06-01',
    'qualifications.validTo': '2027-05-31',

    'consents.name': 'Notice of Privacy Practices',
    'consents.type': 'npp',
    'consents.status': 'active',
    'consents.isRequired': 'true',
    'consents.decision': 'permit',
    'consents.validFrom': '2023-01-10',
    'consents.validTo': '2028-01-10',
    'consents.source': 'Patient portal',
    'consents.regulatoryBasis': 'HIPAA',

    'preferences.name': 'Appointment reminders',
    'preferences.type': 'communication',
    'preferences.channels.type': 'sms',
    'preferences.channels.isOptedIn': 'true',
    'preferences.channels.lastOptedInDate': '2024-02-20',
    'preferences.channels.frequency': 'weekly',
    'preferences.channels.preferredStartTime': '08:00:00',
    'preferences.channels.preferredEndTime': '20:00:00'
};

const keyed = (domainId, examples) =>
    Object.entries(examples).map(([path, example]) => ({ id: `${domainId}:${path}`, example }));

/** One row per attribute: { id: '<domainId>:<cluster path>.<attribute>', example }. */
export const ATTRIBUTE_EXAMPLES = keyed('core-person', CORE_PERSON_EXAMPLES);
