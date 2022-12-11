import { TwitterApi, TwitterApiReadOnly } from 'twitter-api-v2';
import moment from 'moment';
import { Google } from './g-docs';
import { DB } from './database';

export class Twitter {
  private static instance: Twitter;
  private twitterToken: string = '';
  private currentLastTweetID: string | undefined;
  private readOnlyClient: TwitterApiReadOnly | undefined;
  private db: DB | null = null;

  constructor() {
    if (process.env.TWITTER_TOKEN) {
      console.info('Twitter credentials found on Environment.');
      this.twitterToken = process.env.TWITTER_TOKEN;
    } else {
      console.error('Twitter credentials not found on Environment.');
      throw Error('ERROR-TWITTER');
    }
  }

  public static async getInstance(): Promise<Twitter> {
    if (Twitter.instance) {
      return Promise.resolve(Twitter.instance);
    } else {
      Twitter.instance = new Twitter();
      Twitter.instance.db = await DB.getInstance();
      // Instantiate with desired auth type (here's Bearer v2 auth)
      const twitterClient = new TwitterApi(Twitter.instance.twitterToken);

      // Tell typescript it's a readonly app
      Twitter.instance.readOnlyClient = twitterClient.readOnly;
      return Promise.resolve(Twitter.instance);
    }
  }

  public async getLatestTweets() {
    const gdocs = await Google.getInstance();
    if (!this.readOnlyClient) {
      return [];
    }
    if (!this.currentLastTweetID) {
      this.currentLastTweetID = await this.db?.getTwitterLastId();
    }

    const replies = true;
    const retweets = false;
    const quotes = true;
    // I need to move the list out of the code, when I have the time and mood
    const authors = await gdocs.getDevsList();

    // https://developer.twitter.com/en/docs/twitter-api/tweets/search/integrate/build-a-query
    let authorsString = `(${authors
      .map((a) => `from:${a.twitter}`)
      .join(' OR ')})`;
    let search = [authorsString];
    let searchString = `(${search.join(' AND ')})`;

    const results = await this.readOnlyClient.v2.search(searchString, {
      'tweet.fields': [
        'in_reply_to_user_id',
        'entities',
        'attachments',
        'referenced_tweets',
        'context_annotations',
        'withheld',
        'author_id',
      ],
      'user.fields': ['name', 'url', 'profile_image_url', 'username'],
      since_id: this.currentLastTweetID,
      start_time: !this.currentLastTweetID
        ? moment().subtract(1, 'days').toISOString()
        : undefined,
    });
    const tweetsToReturn = [];

    while (!results.done) {
      await results.fetchNext();
    }

    let lastTweetID = '0';

    for (const tweet of results) {
      let addTweet = true;
      if (!replies && tweet.in_reply_to_user_id) {
        addTweet = false;
      }
      if (
        !retweets &&
        tweet.referenced_tweets &&
        tweet.referenced_tweets.find((rt) => rt.type === 'retweeted')
      ) {
        addTweet = false;
      }
      if (
        !quotes &&
        tweet.referenced_tweets &&
        tweet.referenced_tweets.find((rt) => rt.type === 'quoted')
      ) {
        addTweet = false;
      }

      if (addTweet) {
        tweetsToReturn.push(tweet);
      }

      lastTweetID =
        parseInt(tweet.id) > parseInt(lastTweetID) || !lastTweetID
          ? tweet.id
          : lastTweetID;
    }

    if (lastTweetID !== this.currentLastTweetID && lastTweetID !== '0') {
      await this.db?.setTwitterLastId(lastTweetID);
      this.currentLastTweetID = lastTweetID;
    }
    return Promise.resolve(
      tweetsToReturn.sort((a, b) => parseInt(a.id) - parseInt(b.id)),
    );
  }
}
