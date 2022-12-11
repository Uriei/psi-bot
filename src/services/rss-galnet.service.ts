import { DB } from '../modules/database';
import { Discord } from '../modules/discord/discord';
import { Google } from '../modules/g-docs';
import {
  getGalnetFeed,
  IGalnetRssItemGoneGeeky,
  IGalnetRssResponseGoneGeeky,
} from '../modules/rss';
import { prepareGalnetDiscordMessage } from '../modules/utils';

export class GalnetService {
  private static instance: GalnetService;
  private interval = -1;
  private static _timeoutCallback: NodeJS.Timeout;
  public get timeoutCallback(): NodeJS.Timeout {
    return GalnetService._timeoutCallback;
  }
  private set timeoutCallback(value: NodeJS.Timeout) {
    GalnetService._timeoutCallback = value;
  }
  private db: DB | undefined;
  private gdoc: Google | undefined;
  private discord: Discord | undefined;

  private constructor() {}

  public static async getInstance(): Promise<GalnetService> {
    if (GalnetService.instance) {
      return GalnetService.instance;
    } else {
      GalnetService.instance = new GalnetService();
      GalnetService.instance.db = await DB.getInstance();
      GalnetService.instance.gdoc = await Google.getInstance();
      GalnetService.instance.discord = await Discord.getInstance();
      return GalnetService.instance;
    }
  }

  public async start(interval: number = 60000) {
    if (interval < 60000) {
      console.error("Interval can't be lower than 60000ms, 1 minute.");
    } else {
      this.interval = interval;
    }

    this.runGalnetService();
  }

  private async runGalnetService() {
    console.debug('Galnet Service: Checking for new Galnet Articles.');
    const latestGalnetArticles = await this.getLatestGalnetArticles();
    const newGalnetEntries = await this.findNewGalnetArticles(
      latestGalnetArticles,
    );
    let newGalnetEntriesAddedCount = 0;
    if (newGalnetEntries.length > 0) {
      newGalnetEntriesAddedCount = await this.addNewGalnetEntries(
        newGalnetEntries,
      );
    }

    console.debug(
      'Galnet Service: Added ' +
        newGalnetEntriesAddedCount +
        ' new galnet Articles',
    );
    this.scheduleNextRun();
  }

  private scheduleNextRun() {
    if (this.timeoutCallback) {
      clearTimeout(this.timeoutCallback);
    }
    this.timeoutCallback = setTimeout(() => {
      this.runGalnetService();
    }, this.interval);
  }

  private async getLatestGalnetArticles() {
    const galnetRss = await getGalnetFeed();
    return Promise.resolve(galnetRss);
  }

  private async findNewGalnetArticles(
    latestGalnetRssResponse: IGalnetRssResponseGoneGeeky,
  ) {
    if (!this.db) {
      throw Error('Galnet Service: Database not detected.');
    }

    let newEntries: Array<IGalnetRssItemGoneGeeky> = [];
    for (const item of latestGalnetRssResponse.items) {
      if (!(await this.db?.findGalnetByGuid(item.guid))) {
        newEntries.push(item);
      }
    }

    return newEntries;
  }

  private async addNewGalnetEntries(
    newGalnetEntries: Array<IGalnetRssItemGoneGeeky>,
  ) {
    if (!this.db) {
      throw Error('Galnet Service: Database not detected.');
    }
    let count = 0;
    for (const entry of newGalnetEntries) {
      if (!(await this.db.findGalnetByGuid(entry.guid))) {
        console.debug('Galnet Service: Adding new entry: ');
        console.debug(entry);
        await this.db.addGalnetEntry(
          entry.guid,
          entry.title,
          entry.contentSnippet,
          entry.isoDate,
        );
        count++;
      }
      await this.addNewGalnetEntriesToGoogle(newGalnetEntries);
      await this.sendNewGalnetEntriesToDiscord(newGalnetEntries);
    }
    return count;
  }

  private async addNewGalnetEntriesToGoogle(
    newGalnetEntries: Array<IGalnetRssItemGoneGeeky>,
  ) {
    for (const entry of newGalnetEntries) {
      const date = new Date();
      const entryDate = `${date.getFullYear()}/${
        date.getMonth() + 1
      }/${date.getDate()}`;
      await this.gdoc?.addNewGalnetEntry(
        entry.guid,
        entryDate,
        entry.title,
        entry.contentSnippet,
      );
    }
  }

  private async sendNewGalnetEntriesToDiscord(
    newGalnetEntries: Array<IGalnetRssItemGoneGeeky>,
  ) {
    for (const entry of newGalnetEntries) {
      const preparedDiscordMessage = prepareGalnetDiscordMessage(entry);
      await this.discord?.sendGalnetPost(preparedDiscordMessage);
    }
  }
}
