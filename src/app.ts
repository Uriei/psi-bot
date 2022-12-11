import * as dotenv from 'dotenv';
dotenv.config();
import { setLogLevel } from './modules/logging';
setLogLevel();
import { Discord } from './modules/discord/discord';
import {
  populateDevPosts,
  populateGalnet,
} from './services/initial-populate-data.service';
import { GalnetService } from './services/rss-galnet.service';
import { DevPostsService } from './services/rss-devposts.service';
import { TwitterService } from './services/twitter.service';

let discord: Discord;
let galnetService: GalnetService;
let devPostsService: DevPostsService;
let twitterService: TwitterService;

async function app() {
  discord = await Discord.getInstance();
  console.info('PSI Bot online.');

  await populateGalnet();
  await populateDevPosts();

  galnetService = await GalnetService.getInstance();
  galnetService.start();

  devPostsService = await DevPostsService.getInstance();
  devPostsService.start();

  twitterService = await TwitterService.getInstance();
  twitterService.start();
}

async function shutdown() {
  console.info('Closing PSI Bot.');
  discord.setPresence('SHUTDOWN');
  // TODO Stop all timeout intervals
  discord.disconnect();
  clearInterval(discord.discordKeepAliveInterval);
  clearTimeout(galnetService.timeoutCallback);
  clearTimeout(devPostsService.timeoutCallback);
  clearTimeout(twitterService.timeoutCallback);

  console.info('PSI Bot offline.');
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

app();
