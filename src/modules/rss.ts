import Parser from 'rss-parser';

const galnetClassicFeedURL = 'http://proxy.gonegeeky.com/edproxy/';
//const galnetNewFeedURL = 'https://www.elitedangerous.com/en-GB/rss/galnet.xml';
const eliteDevPostsFeedURL = 'https://developertracker.com/elite/rss';

export async function getGalnetFeed(): Promise<IGalnetRssResponseGoneGeeky> {
  const parser = new Parser();
  return await parser
    .parseURL(galnetClassicFeedURL)
    .then((res) => {
      return res as IGalnetRssResponseGoneGeeky;
    })
    .catch((err) => {
      console.trace(err);
      throw err;
    });
}
export async function getEliteDevPostsFeed(): Promise<IDevPostsRssResponse> {
  const parser = new Parser();
  return await parser
    .parseURL(eliteDevPostsFeedURL)
    .then((res) => {
      return res as IDevPostsRssResponse;
    })
    .catch((err) => {
      console.trace(err);
      throw err;
    });
}

export interface IGalnetRssItemGoneGeeky {
  guid: string;
  title: string;
  content: string;
  contentSnippet: string;
  isoDate: string;
  pubDate: string;
}
export interface IGalnetRssResponseGoneGeeky {
  title: string;
  link: string;
  feedUrl: string;
  items: Array<IGalnetRssItemGoneGeeky>;
  paginationLinks: any;
  language: string;
  description: string;
}

export interface IDevPostsRssItem {
  guid: string;
  title: string;
  content: string;
  contentSnippet: string;
  isoDate: string;
  pubDate: string;
  categories: Array<string>;
  creator: string;
  'dc:creator': string;
  link: string;
}
export interface IDevPostsRssResponse {
  title: string;
  link: string;
  feedUrl: string;
  items: Array<IDevPostsRssItem>;
  paginationLinks: any;
  language: string;
  generator: string;
  lastBuildDate: string;
  pubDate: string;
  ttl: string;
}
