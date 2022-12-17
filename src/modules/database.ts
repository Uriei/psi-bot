import * as mongoose from 'mongoose';
mongoose.set('strictQuery', false);
import { deburr as _deburr, upperCase as _upperCase } from 'lodash';
import { ISystemData } from './models/system-data.model';
import { IGalnetArticle } from './models/galnet.model';
import { IDevPost } from './models/devpost.model';
import {
  ICommunityGoalDB,
  ICommunityGoalMessageDB,
} from './models/community-goals.model';
import { isEndedCG } from './utils';
import moment from 'moment';

export class DB {
  private static instance: DB;

  private galnetEntrySchema = new mongoose.Schema({
    guid: { type: String, index: true, unique: true },
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
    upperName: { type: String, index: true },
    systemName: String,
    id: Number,
    id64: { type: Number, index: true, unique: true },
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

  private communityGoalSchema = new mongoose.Schema({
    id: String,
    title: String,
    expiry: Date,
    market_name: String,
    starsystem_name: String,
    activityType: String,
    target_commodity_list: [String],
    target_qty: Number,
    qty: Number,
    objective: String,
    images: String,
    bulletin: String,
  });
  private communityGoalMessageSchema = new mongoose.Schema({
    communityGoalId: String,
    messageId: String,
    communityGoal: this.communityGoalSchema,
    ended: Boolean,
  });
  private communityGoalMessageModel = mongoose.model(
    'CommunityGoalMessage',
    this.communityGoalMessageSchema,
  );

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
    guid = cleanGalnetGuid(guid);
    const newGalnetEntry = new this.galnetEntryModel({
      guid,
      title,
      content,
      date: moment(date).toDate(),
      link,
    });
    return newGalnetEntry.save();
  }

  public async getGalnetAll() {
    return await this.galnetEntryModel.find<IGalnetArticle>().sort({
      date: 'ascending',
    });
  }

  public async findGalnetByGuid(guid: string) {
    guid = cleanGalnetGuid(guid);
    return await this.galnetEntryModel.findOne<IGalnetArticle>({
      guid,
    });
  }

  public async findGalnetByGuidOrTitle(guid: string, title: string) {
    guid = cleanGalnetGuid(guid);
    const result =
      (await this.galnetEntryModel.findOne<IGalnetArticle>({
        guid,
      })) ||
      (await this.galnetEntryModel.find<IGalnetArticle>()).find(
        (g) =>
          cleanGalnetTitle(g.title).localeCompare(cleanGalnetTitle(title)) ===
          0,
      );

    return result;
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
    return await this.eliteDevPostEntryModel.find<IDevPost>().sort({
      date: 'ascending',
    });
  }

  public async findEliteDevPostByGuid(guid: string) {
    return await this.eliteDevPostEntryModel.findOne<IDevPost>({
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
    return await this.edSystemModel.findOne<ISystemData>({
      upperName: _upperCase(systemName),
    });
  }

  public async getEdSystemsAll() {
    return await this.edSystemModel.find<ISystemData>().sort({
      popularity: 'descending',
    });
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

  public async addCommunityGoalMessage(
    messageId: string,
    communityGoal: ICommunityGoalDB,
  ) {
    const cg = new this.communityGoalMessageModel({
      communityGoalId: communityGoal.id,
      messageId,
      communityGoal,
      ended: isEndedCG(communityGoal),
    });
    return await cg.save();
  }

  public async getCommunityGoalMessageAll() {
    return await this.communityGoalMessageModel
      .find<ICommunityGoalMessageDB>()
      .sort({
        communityGoalId: 'ascending',
      });
  }
  public async findCommunityGoalMessageByMessage(messageId: number) {
    return await this.communityGoalMessageModel.findOne<ICommunityGoalMessageDB>(
      {
        messageId,
      },
    );
  }

  public async findCommunityGoalMessageByCgId(communityGoalId: string) {
    return await this.communityGoalMessageModel.findOne<ICommunityGoalMessageDB>(
      {
        communityGoalId,
      },
    );
  }
  public async updateCommunityGoalMessage(communityGoal: ICommunityGoalDB) {
    const result = await this.communityGoalMessageModel.findOne({
      communityGoalId: communityGoal.id,
    });
    if (result) {
      result.communityGoal = communityGoal;
      result.ended = isEndedCG(communityGoal);
      return await result.save();
    }
    return null;
  }
}

function cleanGalnetGuid(guid: string): string {
  let result = guid.substring(guid.lastIndexOf('/') + 1);
  result = result.toLowerCase();
  return result;
}
function cleanGalnetTitle(title: string): string {
  let result = title.toLowerCase();
  result = _deburr(result);
  return result;
}
