import { Discord } from '../modules/discord/discord';
import { Twitter } from '../modules/twitter';

export class TwitterService {
  private static instance: TwitterService;
  private interval: number = -1;
  private static _timeoutCallback: NodeJS.Timeout;
  public get timeoutCallback(): NodeJS.Timeout {
    return TwitterService._timeoutCallback;
  }
  private set timeoutCallback(value: NodeJS.Timeout) {
    TwitterService._timeoutCallback = value;
  }
  private twitter: Twitter | null = null;
  private discord: Discord | null = null;

  private constructor() {}

  public static async getInstance(): Promise<TwitterService> {
    if (TwitterService.instance) {
      return TwitterService.instance;
    } else {
      TwitterService.instance = new TwitterService();
      TwitterService.instance.discord = await Discord.getInstance();
      TwitterService.instance.twitter = await Twitter.getInstance();
      return TwitterService.instance;
    }
  }

  public async start(interval: number = 120000) {
    if (interval < 60000) {
      console.error("Interval can't be lower than 60000ms, 1 minute.");
    } else {
      this.interval = interval;
    }
    this.runTwitterService();
  }

  private async runTwitterService() {
    try {
      console.debug('Twitter Service: Checking for new Tweets.');
      const latestDevPosts = await this.getLatestTweets();

      if (latestDevPosts.length > 0) {
        for (let index = 0; index < latestDevPosts.length; index++) {
          const element = latestDevPosts[index];
          await this.discord?.sendTwitterDevPost(element).then(() => {});
        }
      }

      console.debug(
        'Twitter Service: Added ' + latestDevPosts.length + ' new Tweets',
      );
    } catch (error) {
      console.error('Twitter Service: ERROR:', error);
    }

    this.scheduleNextRun();
  }

  private scheduleNextRun() {
    if (this.timeoutCallback) {
      clearTimeout(this.timeoutCallback);
    }
    this.timeoutCallback = setTimeout(() => {
      this.runTwitterService();
    }, this.interval);
  }

  private async getLatestTweets() {
    if (!this.twitter) {
      return [];
    }
    const devPostRss = await this.twitter.getLatestTweets();
    return devPostRss;
  }
}
