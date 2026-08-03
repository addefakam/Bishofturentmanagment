/**
 * Ethiopian Administrative Divisions for guest address normalization.
 * Structure: Region → Zone/Sub-city → Woreda/District → Kebele
 *
 * For Addis Ababa & Dire Dawa (chartered cities), level 2 = Sub-city, level 3 = Woreda.
 * For regions, level 2 = Zone, level 3 = Woreda.
 * Kebele is the smallest administrative unit (neighborhood level).
 */

export interface AdminLevel {
  name: string;
  children?: AdminLevel[];
}

export const ethiopianRegions: AdminLevel[] = [
  {
    name: "Addis Ababa",
    children: [
      { name: "Arada", children: [
        { name: "Woreda 01" }, { name: "Woreda 02" }, { name: "Woreda 03" },
        { name: "Woreda 04" }, { name: "Woreda 05" }, { name: "Woreda 06" },
        { name: "Woreda 07" }, { name: "Woreda 08" }, { name: "Woreda 09" },
        { name: "Woreda 10" }, { name: "Woreda 11" }, { name: "Woreda 12" },
        { name: "Woreda 13" }, { name: "Woreda 14" },
      ]},
      { name: "Bole", children: [
        { name: "Woreda 01" }, { name: "Woreda 02" }, { name: "Woreda 03" },
        { name: "Woreda 04" }, { name: "Woreda 05" }, { name: "Woreda 06" },
        { name: "Woreda 07" }, { name: "Woreda 08" }, { name: "Woreda 09" },
        { name: "Woreda 10" }, { name: "Woreda 11" }, { name: "Woreda 12" },
        { name: "Woreda 13" }, { name: "Woreda 14" },
      ]},
      { name: "Gullele", children: [
        { name: "Woreda 01" }, { name: "Woreda 02" }, { name: "Woreda 03" },
        { name: "Woreda 04" }, { name: "Woreda 05" }, { name: "Woreda 06" },
        { name: "Woreda 07" }, { name: "Woreda 08" }, { name: "Woreda 09" },
        { name: "Woreda 10" }, { name: "Woreda 11" }, { name: "Woreda 12" },
        { name: "Woreda 13" },
      ]},
      { name: "Kirkos", children: [
        { name: "Woreda 01" }, { name: "Woreda 02" }, { name: "Woreda 03" },
        { name: "Woreda 04" }, { name: "Woreda 05" }, { name: "Woreda 06" },
        { name: "Woreda 07" }, { name: "Woreda 08" }, { name: "Woreda 09" },
        { name: "Woreda 10" }, { name: "Woreda 11" }, { name: "Woreda 12" },
      ]},
      { name: "Kolfe Keranio", children: [
        { name: "Woreda 01" }, { name: "Woreda 02" }, { name: "Woreda 03" },
        { name: "Woreda 04" }, { name: "Woreda 05" }, { name: "Woreda 06" },
        { name: "Woreda 07" }, { name: "Woreda 08" }, { name: "Woreda 09" },
        { name: "Woreda 10" }, { name: "Woreda 11" }, { name: "Woreda 12" },
        { name: "Woreda 13" },
      ]},
      { name: "Lideta", children: [
        { name: "Woreda 01" }, { name: "Woreda 02" }, { name: "Woreda 03" },
        { name: "Woreda 04" }, { name: "Woreda 05" }, { name: "Woreda 06" },
        { name: "Woreda 07" }, { name: "Woreda 08" }, { name: "Woreda 09" },
        { name: "Woreda 10" },
      ]},
      { name: "Nifas Silk-Lafto", children: [
        { name: "Woreda 01" }, { name: "Woreda 02" }, { name: "Woreda 03" },
        { name: "Woreda 04" }, { name: "Woreda 05" }, { name: "Woreda 06" },
        { name: "Woreda 07" }, { name: "Woreda 08" }, { name: "Woreda 09" },
        { name: "Woreda 10" }, { name: "Woreda 11" }, { name: "Woreda 12" },
        { name: "Woreda 13" },
      ]},
      { name: "Lemi Kura", children: [
        { name: "Woreda 01" }, { name: "Woreda 02" }, { name: "Woreda 03" },
        { name: "Woreda 04" }, { name: "Woreda 05" }, { name: "Woreda 06" },
        { name: "Woreda 07" }, { name: "Woreda 08" }, { name: "Woreda 09" },
      ]},
      { name: "Akaki Kality", children: [
        { name: "Woreda 01" }, { name: "Woreda 02" }, { name: "Woreda 03" },
        { name: "Woreda 04" }, { name: "Woreda 05" }, { name: "Woreda 06" },
        { name: "Woreda 07" }, { name: "Woreda 08" }, { name: "Woreda 09" },
        { name: "Woreda 10" }, { name: "Woreda 11" }, { name: "Woreda 12" },
        { name: "Woreda 13" },
      ]},
      { name: "Yeka", children: [
        { name: "Woreda 01" }, { name: "Woreda 02" }, { name: "Woreda 03" },
        { name: "Woreda 04" }, { name: "Woreda 05" }, { name: "Woreda 06" },
        { name: "Woreda 07" }, { name: "Woreda 08" }, { name: "Woreda 09" },
        { name: "Woreda 10" }, { name: "Woreda 11" }, { name: "Woreda 12" },
        { name: "Woreda 13" },
      ]},
    ],
  },
  {
    name: "Oromia",
    children: [
      { name: "East Shewa", children: [
        { name: "Ada'a" }, { name: "Bishoftu" }, { name: "Lume" }, { name: "Gimbichu" },
        { name: "Bora" }, { name: "Dugda" }, { name: "Adama" },
      ]},
      { name: "West Shewa", children: [
        { name: "Ambo" }, { name: "Toke Kutaye" }, { name: "Cheliya" }, { name: "Dendi" },
        { name: "Ejerie" }, { name: "Ilu Gelan" },
      ]},
      { name: "North Shewa", children: [
        { name: "Debre Birhan" }, { name: "Ankober" }, { name: "Menz Gera" }, { name: "Menz Mamama" },
        { name: "Bereh" }, { name: "Kewet" },
      ]},
      { name: "South West Shewa", children: [
        { name: "Waliso" }, { name: "Becho" }, { name: "Kersana Malima" }, { name: "Tikur Enchini" },
        { name: "Sebeta Hawas" },
      ]},
      { name: "Jimma", children: [
        { name: "Jimma" }, { name: "Kersa" }, { name: "Mana" }, { name: "Seka Chekorsa" },
        { name: "Omo Nada" }, { name: "Dedo" },
      ]},
      { name: "West Wollega", children: [
        { name: "Gimbi" }, { name: "Nejo" }, { name: "Mao Komo" }, { name: "Jarso" },
      ]},
      { name: "East Wollega", children: [
        { name: "Nekemte" }, { name: "Guto Gida" }, { name: "Wayu Tuka" }, { name: "Diga" },
      ]},
      { name: "Kelam Welega", children: [
        { name: "Dambi Dollo" }, { name: "Gidami" }, { name: "Sayo" },
      ]},
      { name: "Buno Bedele", children: [
        { name: "Bedele" }, { name: "Chora" }, { name: "Dibu" },
      ]},
      { name: "Guji", children: [
        { name: "Nekemte (Girja)" }, { name: "Bore" }, { name: "Adola" }, { name: "Wadera" },
      ]},
      { name: "Borena", children: [
        { name: "Yabelo" }, { name: "Moyale" }, { name: "Teltele" }, { name: "Arero" },
      ]},
      { name: "Horo Gudru", children: [
        { name: "Shambu" }, { name: "Amuru" }, { name: "Horo" },
      ]},
      { name: "Hawassa (Sidama)", children: [
        { name: "Hawassa" }, { name: "Dale" }, { name: "Loka Abaya" }, { name: "Bensa" },
        { name: "Aroresa" },
      ]},
      { name: "Arsi", children: [
        { name: "Asella" }, { name: "Tiyo" }, { name: "Munesa" }, { name: "Digeluna Tijo" },
        { name: "Chole" }, { name: "Gololcha" },
      ]},
      { name: "Bale", children: [
        { name: "Goba" }, { name: "Robe" }, { name: "Sinana" }, { name: "Dinsho" },
        { name: "Gura Damole" },
      ]},
      { name: "West Guji", children: [
        { name: "Bule Hora" }, { name: "Yabelo" }, { name: "Gelana" },
      ]},
      { name: "North Shewa (Oromia)", children: [
        { name: "Fitche" }, { name: "Kuyu" }, { name: "Hidabu Abote" },
      ]},
      { name: "East Guji", children: [
        { name: "Adola" }, { name: "Girja" }, { name: "Wadera" },
      ]},
      { name: "Finfinnee (Special Zone)", children: [
        { name: "Burayu" }, { name: "Sululta" }, { name: "Holeta" }, { name: "Sebeta" },
        { name: "Sendafa" },
      ]},
    ],
  },
  {
    name: "Amhara",
    children: [
      { name: "North Shewa", children: [
        { name: "Debre Markos" }, { name: "Mekane Selam" }, { name: "Gish Abay" },
      ]},
      { name: "South Wollo", children: [
        { name: "Dessie" }, { name: "Kombolcha" }, { name: "Woreilu" }, { name: "Kalu" },
        { name: "Tenta" },
      ]},
      { name: "North Wollo", children: [
        { name: "Woldia" }, { name: "Lalibela" }, { name: "Wag Hemra" },
      ]},
      { name: "South Gondar", children: [
        { name: "Debre Tabor" }, { name: "Wogera" }, { name: "Farta" },
      ]},
      { name: "North Gondar", children: [
        { name: "Gondar" }, { name: "Chilga" }, { name: "Metema" }, { name: "Tegeda" },
      ]},
      { name: "Gojjam", children: [
        { name: "Bahir Dar" }, { name: "Goncha Siso Enese" }, { name: "Enarj Enawga" },
        { name: "Debre Elias" }, { name: "Machakel" },
      ]},
      { name: "Awi", children: [
        { name: "Injibara" }, { name: "Dangila" },
      ]},
      { name: "Oromia (Amhara)", children: [
        { name: "Batu" }, { name: "Zway" }, { name: "Arerti" },
      ]},
      { name: "West Gojjam", children: [
        { name: "Bahir Dar Zuria" }, { name: "Mecha" }, { name: "Achefer" },
      ]},
      { name: "East Gojjam", children: [
        { name: "Debre Markos" }, { name: "Begedech" }, { name: "Debre Sina" },
      ]},
      { name: "South Gondar (Metekel)", children: [
        { name: "Bulen" }, { name: "Dangur" }, { name: "Mandi" },
      ]},
      { name: "North Shewa (Amhara)", children: [
        { name: "Ankober" }, { name: "Menz Gera" },
      ]},
      { name: "Wag Hemra", children: [
        { name: "Sekota" }, { name: "Zikuala" },
      ]},
    ],
  },
  {
    name: "SNNPR",
    children: [
      { name: "Gurage", children: [
        { name: "Wolkite" }, { name: "Butajira" }, { name: "Welkayite" },
      ]},
      { name: "Hadiya", children: [
        { name: "Hosaena" }, { name: "Shashogo" }, { name: "Mirab Badawacho" },
      ]},
      { name: "Sidama", children: [
        { name: "Hawassa" }, { name: "Aleta Wondo" }, { name: "Dale" },
      ]},
      { name: "Wolayita", children: [
        { name: "Sodo" }, { name: "Damot Sore" }, { name: "Damot Pulasa" },
      ]},
      { name: "Kembata Tembaro", children: [
        { name: "Durame" }, { name: "Kedida Gamela" }, { name: "Angacha" },
      ]},
      { name: "Dawro", children: [
        { name: "Tarcha" }, { name: "Gessa" }, { name: "Mareka" },
      ]},
      { name: "Gofa", children: [
        { name: "Sawla" }, { name: "Geze Gofa" },
      ]},
      { name: "Keffa", children: [
        { name: "Bonga" }, { name: "Decha" }, { name: "Chena" },
      ]},
      { name: "Bench Maji", children: [
        { name: "Mizan Teferi" }, { name: "Sheko" }, { name: "Bench" },
      ]},
      { name: "South Omo", children: [
        { name: "Jinka" }, { name: "Turmi" }, { name: "Korem" },
      ]},
      { name: "Yem", children: [
        { name: "Fofa" },
      ]},
      { name: "Silt'e", children: [
        { name: "Worabe" }, { name: "Silt'e" },
      ]},
      { name: "Konso", children: [
        { name: "Karat" }, { name: "Konso" },
      ]},
      { name: "Basketo", children: [
        { name: "Laska" },
      ]},
      { name: "Amaro", children: [
        { name: "Amaro" },
      ]},
      { name: "Burji", children: [
        { name: "Burji" },
      ]},
    ],
  },
  {
    name: "Tigray",
    children: [
      { name: "Central Tigray", children: [
        { name: "Mekelle" }, { name: "Kilte Awlaelo" }, { name: "Enderta" },
      ]},
      { name: "Eastern Tigray", children: [
        { name: "Adigrat" }, { name: "Ganta Afeshum" }, { name: "Saesi Tsaedaemba" },
      ]},
      { name: "Southern Tigray", children: [
        { name: "Axum" }, { name: "Laelay Adiabo" }, { name: "Tahtay Adiabo" },
      ]},
      { name: "Western Tigray", children: [
        { name: "Shire" }, { name: "Tahtay Koraro" }, { name: "Kafta Humera" },
      ]},
      { name: "South Eastern Tigray", children: [
        { name: "Wukro" }, { name: "Kloube" }, { name: "Ofla" },
      ]},
      { name: "North Western Tigray", children: [
        { name: "Shire Endaselassie" }, { name: "Adwa" },
      ]},
      { name: "Mekelle (Special Zone)", children: [
        { name: "Mekelle" },
      ]},
    ],
  },
  {
    name: "Dire Dawa",
    children: [
      { name: "Urban", children: [
        { name: "Woreda 01" }, { name: "Woreda 02" }, { name: "Woreda 03" },
        { name: "Woreda 04" }, { name: "Woreda 05" }, { name: "Woreda 06" },
        { name: "Woreda 07" }, { name: "Woreda 08" }, { name: "Woreda 09" },
      ]},
      { name: "Rural", children: [
        { name: "Woreda 01" }, { name: "Woreda 02" }, { name: "Woreda 03" },
        { name: "Woreda 04" },
      ]},
    ],
  },
  {
    name: "Harari",
    children: [
      { name: "Harar (Urban)", children: [
        { name: "Woreda 01" }, { name: "Woreda 02" }, { name: "Woreda 03" },
        { name: "Woreda 04" }, { name: "Woreda 05" }, { name: "Woreda 06" },
      ]},
    ],
  },
  {
    name: "Somali",
    children: [
      { name: "Jijiga", children: [
        { name: "Jijiga" }, { name: "Kebri Beyah" }, { name: "Babille" },
      ]},
      { name: "Shinile", children: [
        { name: "Shinile" }, { name: "Ayisha" }, { name: "Afdem" },
      ]},
      { name: "Fafan", children: [
        { name: "Wajale" }, { name: "Awbare" }, { name: "Kebri Dahar" },
      ]},
      { name: "Dollo", children: [
        { name: "Wardheer" }, { name: "Godey" }, { name: "Kelafo" },
      ]},
      { name: "Erer", children: [
        { name: "Gursum" }, { name: "Jarar" },
      ]},
      { name: "Nogob", children: [
        { name: "Shilaabo" }, { name: "Ferer" },
      ]},
      { name: "Siti", children: [
        { name: "Shinile (Siti)" }, { name: "Ayesha" },
      ]},
      { name: "Korahe", children: [
        { name: "Kebri Dahar" }, { name: "Shilabo" },
      ]},
      { name: "Dawa", children: [
        { name: "Godey" }, { name: "Adadle" },
      ]},
    ],
  },
  {
    name: "Afar",
    children: [
      { name: "Zone 1 (Awsi Rasu)", children: [
        { name: "Asayita" }, { name: "Afambo" }, { name: "Dubti" },
      ]},
      { name: "Zone 2 (Kilbet Rasu)", children: [
        { name: "Abala" }, { name: "Berhale" }, { name: "Erebti" },
      ]},
      { name: "Zone 3 (Gabbi Rasu)", children: [
        { name: "Semera" }, { name: "Logiya" }, { name: "Dulecha" },
      ]},
      { name: "Zone 4 (Fanti Rasu)", children: [
        { name: "Awash" }, { name: "Gewane" },
      ]},
      { name: "Zone 5 (Hari Rasu)", children: [
        { name: "Artuma" }, { name: "Fursi" },
      ]},
    ],
  },
  {
    name: "Benishangul-Gumuz",
    children: [
      { name: "Assosa", children: [
        { name: "Assosa" }, { name: "Bambasi" }, { name: "Mao Komo" },
      ]},
      { name: "Kamashi", children: [
        { name: "Kamashi" }, { name: "Mansas" },
      ]},
      { name: "Metekel", children: [
        { name: "Gilgil Beles" }, { name: "Dangur" }, { name: "Bulen" },
      ]},
      { name: "Buluqu", children: [
        { name: "Mandura" }, { name: "Dibate" },
      ]},
    ],
  },
  {
    name: "Gambela",
    children: [
      { name: "Gambela", children: [
        { name: "Gambela" }, { name: "Abobo" }, { name: "Gog" },
      ]},
      { name: "Nuer", children: [
        { name: "Lare" }, { name: "Jikawo" },
      ]},
      { name: "Anywaa", children: [
        { name: "Itang" }, { name: "Pinyudo" },
      ]},
    ],
  },
  {
    name: "Sidama",
    children: [
      { name: "Hawassa" }, { name: "Aleta Wondo" }, { name: "Dale" },
      { name: "Loka Abaya" }, { name: "Bensa" },
    ],
  },
];

/** Get the label for level 2 (Sub-city for chartered cities, Zone for regions) */
export function getLevel2Label(region: string): string {
  if (region === "Addis Ababa" || region === "Dire Dawa" || region === "Harari") {
    return "Sub-city";
  }
  return "Zone";
}

/** Compose a full address string from normalized fields */
export function composeAddress(fields: {
  region?: string;
  zone?: string;
  woreda?: string;
  kebele?: string;
  houseNumber?: string;
  streetName?: string;
}): string {
  const parts: string[] = [];
  if (fields.houseNumber) parts.push(fields.houseNumber);
  if (fields.streetName) parts.push(fields.streetName);
  if (fields.kebele) parts.push(`Kebele ${fields.kebele}`);
  if (fields.woreda) parts.push(fields.woreda);
  if (fields.zone) parts.push(fields.zone);
  if (fields.region) parts.push(fields.region);
  return parts.join(", ");
}

/** Get zones/sub-cities for a given region */
export function getZones(regionName: string): string[] {
  const region = ethiopianRegions.find(r => r.name === regionName);
  return region?.children?.map(c => c.name) || [];
}

/** Get woredas for a given region + zone */
export function getWoredas(regionName: string, zoneName: string): string[] {
  const region = ethiopianRegions.find(r => r.name === regionName);
  const zone = region?.children?.find(c => c.name === zoneName);
  return zone?.children?.map(c => c.name) || [];
}
