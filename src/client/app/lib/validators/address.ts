import { sanitizeTextInput } from "./common";

export const INDIA_COUNTRY_NAME = "India";

export const INDIA_STATE_CITY_MAP: Record<string, string[]> = {
  "Andaman and Nicobar Islands": [
    "Port Blair",
    "Diglipur",
    "Mayabunder",
    "Rangat",
    "Havelock Island",
  ],
  "Andhra Pradesh": ["Visakhapatnam", "Vijayawada", "Guntur", "Tirupati", "Kurnool"],
  "Arunachal Pradesh": ["Itanagar", "Naharlagun", "Pasighat", "Tawang", "Ziro"],
  Assam: ["Guwahati", "Silchar", "Dibrugarh", "Jorhat", "Tezpur"],
  Bihar: ["Patna", "Gaya", "Bhagalpur", "Muzaffarpur", "Darbhanga"],
  Chandigarh: ["Chandigarh"],
  Chhattisgarh: ["Raipur", "Bilaspur", "Durg", "Korba", "Jagdalpur"],
  "Dadra and Nagar Haveli and Daman and Diu": ["Daman", "Diu", "Silvassa"],
  Delhi: ["New Delhi", "Delhi", "Dwarka", "Rohini", "Karol Bagh"],
  Goa: ["Panaji", "Margao", "Vasco da Gama", "Mapusa", "Ponda"],
  Gujarat: ["Ahmedabad", "Surat", "Vadodara", "Rajkot", "Bhavnagar"],
  Haryana: ["Gurugram", "Faridabad", "Panipat", "Ambala", "Hisar"],
  "Himachal Pradesh": ["Shimla", "Dharamshala", "Solan", "Mandi", "Kullu"],
  "Jammu and Kashmir": ["Srinagar", "Jammu", "Anantnag", "Baramulla", "Udhampur"],
  Jharkhand: ["Ranchi", "Jamshedpur", "Dhanbad", "Bokaro", "Hazaribagh"],
  Karnataka: ["Bengaluru", "Mysuru", "Mangaluru", "Hubballi", "Belagavi"],
  Kerala: ["Thiruvananthapuram", "Kochi", "Kozhikode", "Thrissur", "Kollam"],
  Ladakh: ["Leh", "Kargil", "Nubra", "Diskit", "Nyoma"],
  Lakshadweep: ["Kavaratti", "Agatti", "Amini", "Andrott", "Minicoy"],
  "Madhya Pradesh": ["Bhopal", "Indore", "Jabalpur", "Gwalior", "Ujjain"],
  Maharashtra: ["Mumbai", "Pune", "Nagpur", "Nashik", "Aurangabad"],
  Manipur: ["Imphal", "Thoubal", "Churachandpur", "Ukhrul", "Kakching"],
  Meghalaya: ["Shillong", "Tura", "Jowai", "Nongstoin", "Williamnagar"],
  Mizoram: ["Aizawl", "Lunglei", "Champhai", "Kolasib", "Serchhip"],
  Nagaland: ["Kohima", "Dimapur", "Mokokchung", "Tuensang", "Wokha"],
  Odisha: ["Bhubaneswar", "Cuttack", "Rourkela", "Sambalpur", "Berhampur"],
  Puducherry: ["Puducherry", "Karaikal", "Mahe", "Yanam", "Oulgaret"],
  Punjab: ["Ludhiana", "Amritsar", "Jalandhar", "Patiala", "Bathinda"],
  Rajasthan: ["Jaipur", "Jodhpur", "Udaipur", "Kota", "Ajmer"],
  Sikkim: ["Gangtok", "Namchi", "Mangan", "Gyalshing", "Soreng"],
  "Tamil Nadu": ["Chennai", "Coimbatore", "Madurai", "Tiruchirappalli", "Salem"],
  Telangana: ["Hyderabad", "Warangal", "Nizamabad", "Karimnagar", "Khammam"],
  Tripura: ["Agartala", "Udaipur", "Dharmanagar", "Kailasahar", "Belonia"],
  "Uttar Pradesh": ["Lucknow", "Kanpur", "Ghaziabad", "Agra", "Varanasi"],
  Uttarakhand: ["Dehradun", "Haridwar", "Haldwani", "Roorkee", "Rudrapur"],
  "West Bengal": ["Kolkata", "Howrah", "Durgapur", "Siliguri", "Asansol"],
};

const normalizeLookupKey = (value: string): string =>
  value.replace(/\s+/g, " ").trim().toLowerCase();

const normalizeText = (value: string): string => sanitizeTextInput(value);

const STATE_LOOKUP = new Map<string, string>(
  Object.keys(INDIA_STATE_CITY_MAP).map((state) => [normalizeLookupKey(state), state])
);

const CITY_LOOKUP_BY_STATE = new Map<string, Map<string, string>>(
  Object.entries(INDIA_STATE_CITY_MAP).map(([state, cities]) => [
    state,
    new Map(cities.map((city) => [normalizeLookupKey(city), city])),
  ])
);

export const ADDRESS_STATE_OPTIONS = Object.keys(INDIA_STATE_CITY_MAP);

export const toCanonicalAddressState = (value: string): string | null => {
  const key = normalizeLookupKey(value);
  if (!key) {
    return null;
  }
  return STATE_LOOKUP.get(key) || null;
};

export const getAddressCitiesByState = (state: string): string[] => {
  const canonicalState = toCanonicalAddressState(state);
  if (!canonicalState) {
    return [];
  }
  return INDIA_STATE_CITY_MAP[canonicalState] || [];
};

export const toCanonicalAddressCity = (
  state: string,
  city: string
): string | null => {
  const canonicalState = toCanonicalAddressState(state);
  if (!canonicalState) {
    return null;
  }

  const cityLookup = CITY_LOOKUP_BY_STATE.get(canonicalState);
  if (!cityLookup) {
    return null;
  }

  const cityKey = normalizeLookupKey(city);
  if (!cityKey) {
    return null;
  }

  return cityLookup.get(cityKey) || null;
};

export const isSupportedAddressState = (state: string): boolean =>
  toCanonicalAddressState(state) !== null;

export const isSupportedAddressCity = (state: string, city: string): boolean =>
  toCanonicalAddressCity(state, city) !== null;

export type AddressValidationInput = {
  fullName: string;
  phoneNumber: string;
  line1: string;
  line2?: string | null;
  landmark?: string | null;
  city: string;
  state: string;
  country: string;
  pincode: string;
};

export type AddressFieldErrors = Partial<
  Record<
    | "fullName"
    | "phoneNumber"
    | "line1"
    | "line2"
    | "landmark"
    | "city"
    | "state"
    | "country"
    | "pincode",
    string
  >
>;

export const normalizeAddressPhone = (value: string): string =>
  value.replace(/\D/g, "").slice(0, 10);

export const normalizeAddressPincode = (value: string): string =>
  value.replace(/\D/g, "").slice(0, 6);

export const normalizeAddressPayload = (
  input: AddressValidationInput
): AddressValidationInput => {
  const state = toCanonicalAddressState(input.state) || normalizeText(input.state);
  const city =
    toCanonicalAddressCity(state, input.city) || normalizeText(input.city);
  const normalizedCountry = normalizeText(input.country);

  return {
    fullName: normalizeText(input.fullName),
    phoneNumber: normalizeAddressPhone(input.phoneNumber),
    line1: normalizeText(input.line1),
    line2: normalizeText(String(input.line2 ?? "")),
    landmark: normalizeText(String(input.landmark ?? "")),
    city,
    state,
    country: normalizedCountry,
    pincode: normalizeAddressPincode(input.pincode),
  };
};

export const getAddressValidationError = (
  input: AddressValidationInput
): string | null => {
  const fieldErrors = getAddressFieldErrors(input);
  const fieldOrder: Array<keyof AddressFieldErrors> = [
    "fullName",
    "phoneNumber",
    "line1",
    "line2",
    "landmark",
    "state",
    "city",
    "country",
    "pincode",
  ];

  for (const field of fieldOrder) {
    const message = fieldErrors[field];
    if (message) {
      return message;
    }
  }

  return null;
};

export const getAddressFieldErrors = (
  input: AddressValidationInput
): AddressFieldErrors => {
  const normalized = normalizeAddressPayload(input);
  const errors: AddressFieldErrors = {};

  if (!normalized.fullName) {
    errors.fullName = "Full name is required.";
  } else if (normalized.fullName.length < 2 || normalized.fullName.length > 120) {
    errors.fullName = "Full name must be between 2 and 120 characters.";
  }

  if (!normalized.phoneNumber) {
    errors.phoneNumber = "Phone number is required.";
  } else if (!/^\d{10}$/.test(normalized.phoneNumber)) {
    errors.phoneNumber = "Phone number must be exactly 10 digits.";
  }

  if (!normalized.line1) {
    errors.line1 = "Address line 1 is required.";
  } else if (normalized.line1.length < 5 || normalized.line1.length > 255) {
    errors.line1 = "Address line 1 must be between 5 and 255 characters.";
  }

  if (normalized.line2 && normalized.line2.length > 255) {
    errors.line2 = "Address line 2 cannot exceed 255 characters.";
  }

  if (normalized.landmark && normalized.landmark.length > 255) {
    errors.landmark = "Landmark cannot exceed 255 characters.";
  }

  if (!normalized.state) {
    errors.state = "State is required.";
  } else if (!isSupportedAddressState(normalized.state)) {
    errors.state = "Select a valid state from the list.";
  }

  if (!normalized.city) {
    errors.city = "City is required.";
  } else if (
    normalized.state &&
    isSupportedAddressState(normalized.state) &&
    !isSupportedAddressCity(normalized.state, normalized.city)
  ) {
    errors.city = "Select a valid city for the selected state.";
  }

  if (!normalized.country) {
    errors.country = "Country is required.";
  } else if (normalizeLookupKey(normalized.country) !== normalizeLookupKey(INDIA_COUNTRY_NAME)) {
    errors.country = `Country must be ${INDIA_COUNTRY_NAME}.`;
  }

  if (!normalized.pincode) {
    errors.pincode = "Pincode is required.";
  } else if (!/^\d{6}$/.test(normalized.pincode)) {
    errors.pincode = "Pincode must be exactly 6 digits.";
  }

  return errors;
};
