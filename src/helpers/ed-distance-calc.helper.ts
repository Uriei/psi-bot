import { DB, ISystemData } from '../modules/database';
import { first as _first, upperCase as _upperCase } from 'lodash';

const EDSM_API_SYSTEMS = 'https://www.edsm.net/api-v1/systems';

export async function calculateDistance(
  origin: string,
  destination: string,
): Promise<number> {
  const systemsData = await getSystemData(origin, destination);

  if (systemsData.length !== 2) {
    throw Error('ERROR-NOTFOUND');
  }

  const result =
    ((systemsData[0].x - systemsData[1].x) ** 2 +
      (systemsData[0].y - systemsData[1].y) ** 2 +
      (systemsData[0].z - systemsData[1].z) ** 2) **
    (1 / 2);
  const roundedResult = Math.round((result + Number.EPSILON) * 100) / 100;
  return roundedResult;
}

export async function getSystemData(...systems: Array<string>) {
  const db = await DB.getInstance();
  const systemsData: Array<ISystemData> = [];
  const systemsNotInDB: Array<string> = [];

  for (const s of systems) {
    const sys = s.trim();
    const system = await db.findEdSystemByName(sys);
    if (system) {
      systemsData.push(system as ISystemData);
    } else {
      systemsNotInDB.push(sys);
    }
  }

  if (systemsNotInDB.length > 0) {
    const SYSTEM_PARAM = '&systemName[]=';
    const baseUrl = `${EDSM_API_SYSTEMS}?showCoordinates=1&showId=1&showPermit=1&showInformation=1${SYSTEM_PARAM}`;
    const suffixPerSystem = systemsNotInDB.join(SYSTEM_PARAM);

    const url = `${baseUrl}${suffixPerSystem}`;

    const edsmResponse: Array<IEdsmSystemData> = await fetch(url).then((res) =>
      res.json(),
    );

    for (const edsmSystem of edsmResponse) {
      const system: ISystemData = {
        upperName: _upperCase(edsmSystem.name),
        systemName: edsmSystem.name,
        id: edsmSystem.id,
        id64: edsmSystem.id64,
        x: edsmSystem.coords.x || 0,
        y: edsmSystem.coords.y || 0,
        z: edsmSystem.coords.z || 0,
        requirePermit: edsmSystem.requirePermit,
        permitName: edsmSystem.permitName,
        allegiance: edsmSystem.information?.allegiance,
        government: edsmSystem.information?.government,
        population: edsmSystem.information?.population,
        security: edsmSystem.information?.security,
        economy: edsmSystem.information?.economy,
        secondEconomy: edsmSystem.information?.secondEconomy,
        reserve: edsmSystem.information?.reserve,
        popularity: 1,
      };
      systemsData.push(system);
      if (edsmSystem.coordsLocked) {
        await db.addEdSystem(system);
      }
    }
  }

  return Promise.resolve(systemsData);
}

export async function getFormattedSystemName(systemName: string) {
  const systems = await getSystemData(systemName);
  const system = _first(systems);
  return system?.systemName;
}

export interface IEdsmSystemData {
  name: string;
  id: number;
  id64: number;
  coords: IEdsmSystemCoords;
  coordsLocked: boolean;
  requirePermit: boolean;
  permitName: string;
  information: IEdsmSystemInfo;
}

export interface IEdsmSystemCoords {
  x: number;
  y: number;
  z: number;
}
export interface IEdsmSystemInfo {
  allegiance: string;
  government: string;
  population: number;
  security: string;
  economy: string;
  secondEconomy: string;
  reserve: string;
  faction: string;
  factionState: string;
}
