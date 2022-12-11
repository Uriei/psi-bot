export interface IGalnetRssItemGoneGeeky {
  guid: string;
  title: string;
  content: string;
  contentSnippet: string;
  pubDate: string;
  link: string;
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
