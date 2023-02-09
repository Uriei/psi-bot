import { DB } from '../modules/database';
import { Discord } from '../modules/discord/discord';
import * as xml2js from 'xml2js';
import {
  ICommunityGoalDB,
  ICommunityGoalsXML,
} from '../modules/models/community-goals.model';
import moment from 'moment';
import { prepareCGDiscordMessage } from '../modules/utils';

const communityGoalsFeedURL =
  'https://api.orerve.net/2.0/website/initiatives/list?lang=en';

export class CommunityGoalsService {
  private static instance: CommunityGoalsService;
  private _interval = -1;
  public static get interval() {
    return CommunityGoalsService.instance._interval;
  }
  public get interval() {
    return this._interval;
  }
  private set interval(value) {
    this._interval = value;
  }
  private static _timeoutCallback: NodeJS.Timeout;
  public get timeoutCallback(): NodeJS.Timeout {
    return CommunityGoalsService._timeoutCallback;
  }
  private set timeoutCallback(value: NodeJS.Timeout) {
    CommunityGoalsService._timeoutCallback = value;
  }
  private db: DB | undefined;
  private discord: Discord | undefined;

  private constructor() {}

  public static async getInstance(): Promise<CommunityGoalsService> {
    if (CommunityGoalsService.instance) {
      return CommunityGoalsService.instance;
    } else {
      CommunityGoalsService.instance = new CommunityGoalsService();
      CommunityGoalsService.instance.db = await DB.getInstance();
      CommunityGoalsService.instance.discord = await Discord.getInstance();
      return CommunityGoalsService.instance;
    }
  }

  public async start(interval: number = 900000) {
    if (interval < 60000) {
      console.error("Interval can't be lower than 60000ms, 1 minute.");
    } else {
      this.interval = interval;
    }

    this.runCgService();
  }

  private async runCgService() {
    try {
      console.debug('CommunityGoals Service: Checking for new CG updates.');
      const currentCGs = await this.getCommunityGoalsData();
      await this.updateCGsDiscord(currentCGs);
    } catch (error) {
      console.error('CommunityGoals Service: ERROR:', error);
    }

    this.scheduleNextRun();
  }

  private async getCommunityGoalsData() {
    const parser = new xml2js.Parser({ explicitArray: false });
    const response: ICommunityGoalsXML = await new Promise((resolve) => {
      fetch(communityGoalsFeedURL, {
        headers: {
          Accept: 'text/xml',
        },
      })
        .then((response) => response.text())
        .then((response) =>
          parser.parseString(response, (err, result) => {
            if (err) resolve({ data: { activeInitiatives: { item: [] } } });
            if (
              !result ||
              !result.data ||
              !result.activeInitiatives ||
              !Array.isArray(result.activeInitiatives.item)
            )
              resolve({ data: { activeInitiatives: { item: [] } } });
            resolve(result);
          }),
        )
        .catch(() => resolve({ data: { activeInitiatives: { item: [] } } }));
    });

    const communityGoals: Array<ICommunityGoalDB> =
      response.data.activeInitiatives.item
        .map((cg) => ({
          id: cg.id,
          title: cg.title,
          bulletin: cg.bulletin,
          starsystem_name: cg.starsystem_name,
          market_name: cg.market_name,
          activityType: cg.activityType,
          expiry: moment(cg.expiry).toDate(),
          objective: cg.objective,
          qty: Number(cg.qty),
          target_qty: Number(cg.target_qty),
          target_commodity_list: cg.target_commodity_list?.split(', ') || [],
          images: cg.images,
        }))
        .sort((a, b) => a.id.localeCompare(b.id));

    return communityGoals;
  }

  private async updateCGsDiscord(currentCGs: ICommunityGoalDB[]) {
    for (const cg of currentCGs) {
      try {
        const message = await this.db?.findCommunityGoalMessageByCgId(cg.id);
        if (message) {
          if (!message.ended) {
            await this.discord?.updateCG(
              message.messageId,
              prepareCGDiscordMessage(cg),
            );
            await this.db?.updateCommunityGoalMessage(cg);
          }
        } else if (!message) {
          const newMessageId = await this.discord?.createCG(
            prepareCGDiscordMessage(cg),
          );
          if (newMessageId && newMessageId.id) {
            await this.db?.addCommunityGoalMessage(newMessageId.id, cg);
          }
        }
      } catch (error) {
        console.error(
          'ERROR - CommunityGoals Service: Error processing CG',
          cg,
        );
      }
    }
  }

  private scheduleNextRun() {
    if (this.timeoutCallback) {
      clearTimeout(this.timeoutCallback);
    }
    this.timeoutCallback = setTimeout(() => {
      this.runCgService();
    }, this.interval);
  }
}
