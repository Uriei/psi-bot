import * as mongoose from 'mongoose';
import { upperCase as _upperCase } from 'lodash';
import { ISystemData } from './models/system-data.model';
import { IGalnetArticle } from './models/galnet.model';
import { IDevPost } from './models/devpost.model';

export class DB {
  private static instance: DB;

  private galnetEntrySchema = new mongoose.Schema({
    guid: String,
    title: String,
    content: String,
    date: Date,
    link: String,
  });
  private galnetEntryModel = mongoose.model(
    'GalnetEntry',
    this.galnetEntrySchema,
  );

  private eliteDevPostEntrySchema = new mongoose.Schema({
    guid: String,
    author: String,
    title: String,
    content: String,
    date: Date,
  });
  private eliteDevPostEntryModel = mongoose.model(
    'EliteDevPost',
    this.eliteDevPostEntrySchema,
  );

  private dataSchema = new mongoose.Schema({
    key: String,
    value: mongoose.Schema.Types.Mixed,
  });
  private dataModel = mongoose.model('Data', this.dataSchema);

  private edSystemSchema = new mongoose.Schema({
    upperName: String,
    systemName: String,
    id: Number,
    id64: Number,
    x: Number,
    y: Number,
    z: Number,
    requirePermit: Boolean,
    permitName: String,
    allegiance: String,
    government: String,
    population: Number,
    security: String,
    economy: String,
    secondEconomy: String,
    reserve: String,
    popularity: Number,
  });
  private edSystemModel = mongoose.model('EdSystem', this.edSystemSchema);

  private constructor() {}

  public static async getInstance(): Promise<DB> {
    if (DB.instance) {
      return Promise.resolve(DB.instance);
    } else {
      DB.instance = new DB();
      await DB.connect();
      return Promise.resolve(DB.instance);
    }
  }

  private static async connect() {
    const MONGODB_URL = process.env.MONGODB_URL;
    if (!MONGODB_URL) {
      throw Error('ERROR: MongoDB URL not found on Environment.');
    }
    if (DB.isConnected() === mongoose.ConnectionStates?.connected) {
      return Promise.resolve(DB.isConnected());
    } else if (
      DB.isConnected() === mongoose.ConnectionStates?.disconnected ||
      DB.isConnected() === mongoose.ConnectionStates?.disconnecting
    ) {
      return await mongoose.connect(MONGODB_URL);
    } else {
      await mongoose.disconnect();
      return await mongoose.connect(MONGODB_URL);
    }
  }

  public static isConnected(): mongoose.ConnectionStates {
    return mongoose.connection?.readyState || 99;
  }

  public static disconnect() {
    return mongoose.disconnect();
  }

  public async getTwitterLastId(): Promise<string | undefined> {
    const value = await this.dataModel.findOne<{ key: string; value: string }>({
      key: 'TwitterLastID',
    });
    if (value) {
      return Promise.resolve(value.value);
    } else {
      return Promise.resolve(undefined);
    }
  }

  public async setTwitterLastId(id: string) {
    let lastId =
      (await this.dataModel.findOne({ key: 'TwitterLastID' })) || undefined;

    if (lastId) {
      lastId.value = id;
      return lastId.save();
    } else {
      lastId = new this.dataModel({
        key: 'TwitterLastID',
        value: id,
      });
      return lastId.save();
    }
  }

  public addGalnetEntry(
    guid: string,
    title: string,
    content: string,
    date: string,
    link: string,
  ) {
    const newGalnetEntry = new this.galnetEntryModel({
      guid,
      title,
      content,
      date,
      link,
    });
    return newGalnetEntry.save();
  }

  public async getGalnetAll() {
    return this.galnetEntryModel.find<IGalnetArticle>().sort({
      date: 'ascending',
    });
  }

  public async findGalnetByGuid(guid: string) {
    return this.galnetEntryModel.findOne<IGalnetArticle>({
      guid,
    });
  }

  public addEliteDevPostEntry(
    guid: string,
    author: string,
    title: string,
    content: string,
    date: string,
  ) {
    const newEliteDevPostEntry = new this.eliteDevPostEntryModel({
      guid,
      author,
      title,
      content,
      date,
    });
    return newEliteDevPostEntry.save();
  }

  public async getEliteDevPostAll() {
    return this.eliteDevPostEntryModel.find<IDevPost>().sort({
      date: 'ascending',
    });
  }

  public async findEliteDevPostByGuid(guid: string) {
    return this.eliteDevPostEntryModel.findOne<IDevPost>({
      guid,
    });
  }

  public addEdSystem(systemData: ISystemData) {
    const newEdSystem = new this.edSystemModel({
      ...systemData,
    });
    return newEdSystem.save();
  }

  public async findEdSystemByName(systemName: string) {
    const result = await this.edSystemModel.findOne<ISystemData>({
      upperName: _upperCase(systemName),
    });

    return result;
  }

  public async getEdSystemsAll() {
    const result = await this.edSystemModel.find<ISystemData>().sort({
      popularity: 'descending',
    });

    return result;
  }

  public async addEdSystemPopularity(systemName: string) {
    const system = await this.edSystemModel.findOne({
      upperName: _upperCase(systemName),
    });
    if (system) {
      if ('number' === typeof system.popularity) {
        system.popularity++;
      } else {
        system.popularity = 1;
      }
      return await system.save();
    }
    return;
  }
}
