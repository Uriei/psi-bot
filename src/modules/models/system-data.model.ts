export interface ISystemData {
  upperName: string;
  systemName: string;
  id: number;
  id64: number;
  x: number;
  y: number;
  z: number;
  requirePermit: boolean;
  permitName?: string;
  allegiance?: string;
  government?: string;
  population?: number;
  security?: string;
  economy?: string;
  secondEconomy?: string;
  reserve?: string;
  popularity: number;
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
