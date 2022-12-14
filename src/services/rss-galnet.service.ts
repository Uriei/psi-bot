import moment from 'moment';
import { DB } from '../modules/database';
import { Discord } from '../modules/discord/discord';
import { Google } from '../modules/g-docs';
import {
  IGalnetRssResponseFrontier,
  IGalnetRssItemFrontier,
} from '../modules/models/rss.model';
import { getGalnetNewFeed } from '../modules/rss';
import { prepareRssGalnetDiscordMessage } from '../modules/utils';

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

  public async start(interval: number = 300000) {
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
    const galnetRss = await getGalnetNewFeed();
    return Promise.resolve(galnetRss);
  }

  private async findNewGalnetArticles(
    latestGalnetRssResponse: IGalnetRssResponseFrontier,
  ) {
    if (!this.db) {
      throw Error('Galnet Service: Database not detected.');
    }

    let newEntries: Array<IGalnetRssItemFrontier> = [];
    for (const item of latestGalnetRssResponse.items) {
      if (!(await this.db?.findGalnetByGuidOrTitle(item.guid, item.title))) {
        newEntries.push(item);
      }
    }

    return newEntries;
  }

  private async addNewGalnetEntries(
    newGalnetEntries: Array<IGalnetRssItemFrontier>,
  ) {
    if (!this.db) {
      throw Error('Galnet Service: Database not detected.');
    }
    let count = 0;
    for (const entry of newGalnetEntries) {
      const entryDate = moment(entry.isoDate);
      entry.isoDate = entryDate.isAfter(moment().add(1, 'day'))
        ? entryDate.subtract(1286, 'years').toISOString()
        : entryDate.toISOString();

      entry.contentSnippet = entry.contentSnippet
        .replace(/(\r\n|\r|\n){1,}/g, '\n\n')
        .replace(/(\r\n|\r|\n){2,}/g, '$1\n');

      console.debug('Galnet Service: Adding new entry: ');
      console.debug(entry);
      await this.db.addGalnetEntry(
        entry.guid,
        entry.title,
        entry.contentSnippet,
        entry.isoDate,
        entry.link,
      );
      count++;
    }
    await this.addNewGalnetEntriesToGoogle(newGalnetEntries);
    await this.sendNewGalnetEntriesToDiscord(newGalnetEntries);
    return count;
  }

  private async addNewGalnetEntriesToGoogle(
    newGalnetEntries: Array<IGalnetRssItemFrontier>,
  ) {
    for (const entry of newGalnetEntries) {
      await this.gdoc?.addNewGalnetEntry(
        entry.guid,
        moment(entry.isoDate).format('YYYY/MM/DD'),
        entry.title,
        entry.contentSnippet,
        entry.link,
      );
    }
  }

  private async sendNewGalnetEntriesToDiscord(
    newGalnetEntries: Array<IGalnetRssItemFrontier>,
  ) {
    for (const entry of newGalnetEntries) {
      const preparedDiscordMessage = prepareRssGalnetDiscordMessage(entry);
      await this.discord?.sendGalnetPost(preparedDiscordMessage);
    }
  }
}
