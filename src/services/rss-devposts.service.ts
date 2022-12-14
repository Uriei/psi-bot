// TODO Remember that dates in unix need 000 at the end for mongodb

import { DB } from '../modules/database';
import { Discord } from '../modules/discord/discord';
import { Google } from '../modules/g-docs';
import {
  IDevPostsRssResponse,
  IDevPostsRssItem,
} from '../modules/models/rss.model';
import { getEliteDevPostsFeed } from '../modules/rss';
import { prepareRssEliteDevDiscordMessage } from '../modules/utils';

export class DevPostsService {
  private static instance: DevPostsService;
  private interval: number = -1;
  private static _timeoutCallback: NodeJS.Timeout;
  public get timeoutCallback(): NodeJS.Timeout {
    return DevPostsService._timeoutCallback;
  }
  private set timeoutCallback(value: NodeJS.Timeout) {
    DevPostsService._timeoutCallback = value;
  }
  private db: DB | undefined;
  private gdoc: Google | undefined;
  private discord: Discord | undefined;

  private constructor() {}

  public static async getInstance(): Promise<DevPostsService> {
    if (DevPostsService.instance) {
      return DevPostsService.instance;
    } else {
      DevPostsService.instance = new DevPostsService();
      DevPostsService.instance.db = await DB.getInstance();
      DevPostsService.instance.gdoc = await Google.getInstance();
      DevPostsService.instance.discord = await Discord.getInstance();
      return DevPostsService.instance;
    }
  }

  public async start(interval: number = 300000) {
    if (interval < 60000) {
      console.error("Interval can't be lower than 60000ms, 1 minute.");
    } else {
      this.interval = interval;
    }

    this.runEliteDevPostsService();
  }

  private async runEliteDevPostsService() {
    console.debug('DevPosts Service: Checking for new DevPosts.');
    const latestDevPosts = await this.getLatestDevPostsRss();
    const newDevPosts = await this.findNewDevPosts(latestDevPosts, 'MiggyRSS');
    let newDevPostsAddedCount = 0;
    if (newDevPosts.length > 0) {
      newDevPostsAddedCount = await this.addNewDevPosts(newDevPosts);
    }

    console.debug(
      'DevPosts Service: Added ' + newDevPostsAddedCount + ' new DevPosts',
    );
    this.scheduleNextRun();
  }

  private scheduleNextRun() {
    if (this.timeoutCallback) {
      clearTimeout(this.timeoutCallback);
    }
    this.timeoutCallback = setTimeout(() => {
      this.runEliteDevPostsService();
    }, this.interval);
  }

  private async getLatestDevPostsRss() {
    const devPostRss = await getEliteDevPostsFeed();
    return devPostRss;
  }

  private async findNewDevPosts(
    latestDevPostsResponse: IDevPostsRssResponse,
    filterSource: 'MiggyRSS' | 'Reddit' = 'MiggyRSS',
  ) {
    if (!this.db) {
      throw Error('DevPosts Service: Database not detected.');
    }

    let newEntries: Array<IDevPostsRssItem> = [];
    for (const item of latestDevPostsResponse.items) {
      if (
        ((filterSource && item.categories.includes(filterSource)) ||
          !filterSource) &&
        !(await this.db?.findEliteDevPostByGuid(item.guid))
      ) {
        newEntries.push(item);
      }
    }

    return newEntries;
  }

  private async addNewDevPosts(newDevPosts: Array<IDevPostsRssItem>) {
    if (!this.db) {
      throw Error('DevPosts Service: Database not detected.');
    }
    let count = 0;
    for (const entry of newDevPosts) {
      if (!(await this.db.findEliteDevPostByGuid(entry.guid))) {
        console.debug('DevPosts Service: Adding new entry: ');
        console.debug(entry);
        await this.db.addEliteDevPostEntry(
          entry.guid,
          entry.creator,
          entry.title,
          entry.contentSnippet,
          entry.isoDate,
        );
        count++;
      }
    }
    await this.addNewDevPostsToGoogle(newDevPosts);
    await this.sendDevPostsToDiscord(newDevPosts);
    return count;
  }

  private async addNewDevPostsToGoogle(
    newGalnetEntries: Array<IDevPostsRssItem>,
  ) {
    for (const entry of newGalnetEntries) {
      await this.gdoc?.addNewEliteDevPostEntry(
        entry.guid,
        entry.isoDate,
        entry.creator,
        entry.title,
        entry.contentSnippet,
      );
    }
  }

  private async sendDevPostsToDiscord(newDevPosts: Array<IDevPostsRssItem>) {
    for (const entry of newDevPosts) {
      const preparedDiscordMessage = prepareRssEliteDevDiscordMessage(entry);
      await this.discord?.sendEliteDevPost(preparedDiscordMessage);
    }
  }
}
