/**
 * Bishoftu City (Debre Zeit) Administrative Divisions
 * Structure: Bishoftu City → Sub-city → Woreda
 *
 * All guest houses in this system are located under Bishoftu city.
 * The three sub-cities are: Cheleleka, Dibayyu, and Dukem.
 * Under each sub-city there are woreda administrations.
 */

export interface BishoftuWoreda {
  name: string;
}

export interface BishoftuSubcity {
  name: string;
  woredas: BishoftuWoreda[];
}

export const BISHOFTU_SUBCITIES: BishoftuSubcity[] = [
  {
    name: "Cheleleka",
    woredas: [
      { name: "Woreda 01" },
      { name: "Woreda 02" },
      { name: "Woreda 03" },
      { name: "Woreda 04" },
    ],
  },
  {
    name: "Dibayyu",
    woredas: [
      { name: "Woreda 01" },
      { name: "Woreda 02" },
      { name: "Woreda 03" },
      { name: "Woreda 04" },
      { name: "Woreda 05" },
    ],
  },
  {
    name: "Dukem",
    woredas: [
      { name: "Woreda 01" },
      { name: "Woreda 02" },
      { name: "Woreda 03" },
      { name: "Woreda 04" },
      { name: "Woreda 05" },
      { name: "Woreda 06" },
    ],
  },
];

/** Get all woredas for a given sub-city name */
export function getWoredas(subcityName: string): BishoftuWoreda[] {
  const subcity = BISHOFTU_SUBCITIES.find(
    (s) => s.name.toLowerCase() === subcityName.toLowerCase()
  );
  return subcity?.woredas ?? [];
}

/** Get all sub-city names */
export function getSubcityNames(): string[] {
  return BISHOFTU_SUBCITIES.map((s) => s.name);
}

/** Compose a full address string from sub-city and woreda */
export function composeBishoftuAddress(subcity: string, woreda: string): string {
  const parts = ["Bishoftu"];
  if (subcity) parts.push(subcity);
  if (woreda) parts.push(woreda);
  return parts.join(", ");
}
