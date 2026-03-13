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

const STATE_LOOKUP = new Map<string, string>(
  Object.keys(INDIA_STATE_CITY_MAP).map((state) => [normalizeLookupKey(state), state])
);

const CITY_LOOKUP_BY_STATE = new Map<string, Map<string, string>>(
  Object.entries(INDIA_STATE_CITY_MAP).map(([state, cities]) => [
    state,
    new Map(cities.map((city) => [normalizeLookupKey(city), city])),
  ])
);

export const canonicalizeAddressState = (value: string): string | null => {
  const key = normalizeLookupKey(value);
  if (!key) {
    return null;
  }

  return STATE_LOOKUP.get(key) || null;
};

export const canonicalizeAddressCity = (
  state: string,
  city: string
): string | null => {
  const canonicalState = canonicalizeAddressState(state);
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

export const isIndiaCountry = (value: string): boolean =>
  normalizeLookupKey(value) === normalizeLookupKey(INDIA_COUNTRY_NAME);
