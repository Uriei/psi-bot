import Parser from 'rss-parser';
import {
  IGalnetRssResponseGoneGeeky,
  IDevPostsRssResponse,
  IGalnetRssResponseFrontier,
} from './models/rss.model';

const galnetClassicFeedURL = 'http://proxy.gonegeeky.com/edproxy/';
const galnetNewFeedURL = 'https://www.elitedangerous.com/en-GB/rss/galnet.xml';
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

export async function getGalnetNewFeed(): Promise<IGalnetRssResponseFrontier> {
  const parser = new Parser();
  return await parser
    .parseURL(galnetNewFeedURL)
    .then((res) => {
      return res as unknown as IGalnetRssResponseFrontier;
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
