/**
 * Country rule configuration.
 * This is intentionally a plain module (not a DB collection yet) so Phase 1
 * can consult it immediately. In Phase 5 we migrate this into the
 * CountryRule model so admins can edit it without a redeploy.
 *
 * currency: the account currency assigned automatically at registration
 * basicInfo: fields collected at Tier 1
 * tier2/tier3: additional fields required to upgrade
 */

const COUNTRY_RULES = {
  US: {
    name: 'United States',
    currency: 'USD',
    basicInfo: ['firstName', 'lastName', 'dateOfBirth', 'address', 'phone'],
    tier2: ['ssnLast4', 'proofOfAddress', 'governmentId'],
    tier3: ['sourceOfFunds', 'employerInfo', 'expectedActivity']
  },
  GB: {
    name: 'United Kingdom',
    currency: 'GBP',
    basicInfo: ['firstName', 'lastName', 'dateOfBirth', 'address', 'phone'],
    tier2: ['nationalInsuranceNumber', 'proofOfAddress', 'governmentId'],
    tier3: ['sourceOfFunds', 'employerInfo', 'expectedActivity']
  },
  DE: { name: 'Germany', currency: 'EUR', basicInfo: ['firstName', 'lastName', 'dateOfBirth', 'address', 'phone'], tier2: ['governmentId', 'proofOfAddress'], tier3: ['sourceOfFunds', 'employerInfo'] },
  FR: { name: 'France', currency: 'EUR', basicInfo: ['firstName', 'lastName', 'dateOfBirth', 'address', 'phone'], tier2: ['governmentId', 'proofOfAddress'], tier3: ['sourceOfFunds', 'employerInfo'] },
  IE: { name: 'Ireland', currency: 'EUR', basicInfo: ['firstName', 'lastName', 'dateOfBirth', 'address', 'phone'], tier2: ['governmentId', 'proofOfAddress'], tier3: ['sourceOfFunds', 'employerInfo'] },
  ES: { name: 'Spain', currency: 'EUR', basicInfo: ['firstName', 'lastName', 'dateOfBirth', 'address', 'phone'], tier2: ['governmentId', 'proofOfAddress'], tier3: ['sourceOfFunds', 'employerInfo'] },
  OTHER: {
    name: 'Other',
    currency: 'USD',
    basicInfo: ['firstName', 'lastName', 'dateOfBirth', 'address', 'phone'],
    tier2: ['governmentId', 'proofOfAddress'],
    tier3: ['sourceOfFunds', 'employerInfo', 'expectedActivity']
  }
};

function getCountryRule(countryCode) {
  return COUNTRY_RULES[countryCode] || COUNTRY_RULES.OTHER;
}

function getCurrencyForCountry(countryCode) {
  return getCountryRule(countryCode).currency;
}

function listCountries() {
  return Object.entries(COUNTRY_RULES).map(([code, rule]) => ({ code, name: rule.name }));
}

module.exports = { COUNTRY_RULES, getCountryRule, getCurrencyForCountry, listCountries };
