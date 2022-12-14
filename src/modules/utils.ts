import { Item as RssItem } from 'rss-parser';
import { APIEmbed, EmbedBuilder, MessageCreateOptions } from 'discord.js';
import moment from 'moment';
import { decode } from 'html-entities';
import { IGalnetArticle } from './models/galnet.model';
import { ICommunityGoalDB } from './models/community-goals.model';
import { get as _get } from 'lodash';
import { CommunityGoalsService } from '../services/community-goals.service';

const DEFAULT_COLOR = 0xff8c0d;
const ELITE_DEV_POST_ICON_URL = 'https://i.imgur.com/e1kHLpN.jpeg';

export function prepareRssGalnetDiscordMessage(
  galnetEntry: RssItem,
): MessageCreateOptions {
  if (
    !galnetEntry ||
    !galnetEntry.contentSnippet ||
    !galnetEntry.title ||
    !galnetEntry.link
  ) {
    throw Error('Invalid Galnet RSS Entry');
  }
  const mainContent = galnetEntry.contentSnippet.replace(
    /(\r\n|\r|\n){2,}/g,
    '$1\n',
  );
  let content = '';
  if (mainContent.length <= 4096) {
    content = mainContent;
  } else {
    const etc = ' [...]';
    content = mainContent.slice(0, 4096 - etc.length) + etc;
  }

  const galnetEmbed = new EmbedBuilder()
    .setColor(0xff8c0d)
    .setTitle(galnetEntry.title)
    .setURL(galnetEntry.link)
    .setAuthor({
      name: 'Galnet News',
      iconURL: 'https://i.imgur.com/lIgmINY.png',
      url: 'https://community.elitedangerous.com/galnet',
    })
    .setDescription(content)
    .setTimestamp();

  return { embeds: [galnetEmbed] };
}

export function prepareDbGalnetDiscordMessage(
  galnetEntry: IGalnetArticle,
): MessageCreateOptions {
  if (
    !galnetEntry ||
    !galnetEntry.content ||
    !galnetEntry.title ||
    !galnetEntry.guid ||
    !galnetEntry.date
  ) {
    throw Error('Invalid Galnet DB Entry');
  }
  const mainContent = galnetEntry.content.replace(/(\r\n|\r|\n){2,}/g, '$1\n');
  let content = '';
  if (mainContent.length <= 4096) {
    content = mainContent;
  } else {
    const etc = ' [...]';
    content = mainContent.slice(0, 4096 - etc.length) + etc;
  }

  const galnetEmbed = new EmbedBuilder()
    .setColor(0xff8c0d)
    .setTitle(galnetEntry.title)

    .setAuthor({
      name: 'Galnet News',
      iconURL: 'https://i.imgur.com/lIgmINY.png',
      url: 'https://community.elitedangerous.com/galnet',
    })
    .setDescription(content)
    .setTimestamp(moment(galnetEntry.date).toDate());

  // TODO Temporary until I get proper urls for really old articles
  if (
    galnetEntry.link &&
    /^https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@%_+.~#?&/=]*)$/g.test(
      galnetEntry.link,
    )
  ) {
    galnetEmbed.setURL(galnetEntry.link);
  } else if (
    !galnetEntry.link &&
    !/^https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@%_+.~#?&/=]*)$/g.test(
      galnetEntry.guid,
    )
  ) {
    const link = `https://community.elitedangerous.com/en/galnet/uid/${galnetEntry.guid}`;
    galnetEmbed.setURL(link);
  }

  return { embeds: [galnetEmbed] };
}

export function prepareRssEliteDevDiscordMessage(eliteDevPost: RssItem) {
  if (
    !eliteDevPost ||
    !eliteDevPost.content ||
    !eliteDevPost.title ||
    !eliteDevPost.link
  ) {
    throw Error('Invalid EliteDevPost RSS Entry');
  }
  const date = moment.utc(eliteDevPost.isoDate);
  date.add(123, 'milliseconds');
  const dateString = `\n\nPosted <t:${date.unix()}:R> on <t:${date.unix()}:F>`;
  const mainContent = cleanContentHTMLFormat(eliteDevPost.content);
  let content = '';
  if ((mainContent + dateString).length <= 4096) {
    content = mainContent + dateString;
  } else {
    const etc = ' [...]';
    content =
      mainContent.slice(0, 4096 - etc.length - dateString.length) +
      etc +
      dateString;
  }

  const devColor = DEFAULT_COLOR;

  const eliteDevPostEmbed = new EmbedBuilder()
    .setColor(devColor)
    .setTitle(eliteDevPost.title)
    .setURL(eliteDevPost.link)
    .setAuthor({
      name: eliteDevPost.creator || '<Unknown>',
      iconURL: ELITE_DEV_POST_ICON_URL,
    })
    .setDescription(content);
  // .setTimestamp(new Date(date.valueOf()));

  return { embeds: [eliteDevPostEmbed] };
}

export function prepareCGDiscordMessage(
  communityGoal: ICommunityGoalDB,
): MessageCreateOptions {
  const embed: APIEmbed = {
    title: communityGoal.title,
    description: communityGoal.bulletin,
    color: isEndedCG(communityGoal) ? 0xff0000 : 0x00ff00,
    fields: [
      {
        name: `Solar System`,
        value: communityGoal.starsystem_name,
        inline: true,
      },
      {
        name: `Station`,
        value: communityGoal.market_name,
        inline: true,
      },
      {
        name: `Activity`,
        value: mapCgActivity(communityGoal.activityType),
        inline: true,
      },
      {
        name:
          communityGoal.target_commodity_list.length > 0 ? `Commodities` : `\b`,
        value:
          communityGoal.target_commodity_list.length > 0
            ? communityGoal.target_commodity_list.join(', ')
            : `\b`,
        inline: false,
      },
      {
        name: `Time Left`,
        value: isEndedCG(communityGoal)
          ? 'GOAL REACHED'
          : calculateTimeLeft(communityGoal.expiry),
        inline: true,
      },
      {
        name: `Expires`,
        value: isEndedCG(communityGoal)
          ? 'GOAL REACHED'
          : `<t:${moment(communityGoal.expiry).unix()}:F>`,
        inline: true,
      },
      {
        name: `\b`,
        value: `\b`,
        inline: true,
      },
      {
        name: communityGoal.qty ? `Quantity Delivered` : `\b`,
        value: communityGoal.qty
          ? communityGoal.qty.toLocaleString('en')
          : `\b`,
        inline: true,
      },
      {
        name: communityGoal.target_qty ? `Quantity Requested` : `\b`,
        value: communityGoal.target_qty
          ? communityGoal.target_qty.toLocaleString('en')
          : `\b`,
        inline: true,
      },
      {
        name: `\b`,
        value: `\b`,
        inline: true,
      },
      {
        name: cgProgressBar(communityGoal),
        value: `\b`,
        inline: false,
      },
    ],
  };

  if (!isEndedCG(communityGoal)) {
    embed.fields?.push({
      name: `Next update`,
      value: getNextUpdate(CommunityGoalsService.interval),
      inline: false,
    });
  }
  return { embeds: [embed] };
}

export function checkIsJestTest() {
  if (process.env.JEST_WORKER_ID !== undefined) {
    console.debug('WE ARE IN A JEST TEST!');
    return true;
  }
  return false;
}

function cleanContentHTMLFormat(input: string) {
  let output = '' + input;

  // Duped linebreaks
  output = output.replace(/(\r\n|\r|\n){2,}/gs, '$1<br />');
  output = output.replace(/(<br\s*\/?>){2,}/gi, '$1<br />');

  // Quotes
  output = output.replace(
    /(<div class="bbcode_quote_header">)(.+?)(<div class="bbcode_quote_body">)/gis,
    '$1$2<br /><br />$3',
  );
  output = output.replace(
    /(<blockquote>.*?)(\(source\) ?)(.*?<div class="bbcode_quote_body">)/gis,
    '$1(Quote)$3',
  );

  // Lists
  output = output.replace(/<li>/gis, ' • ');

  // Media tags, like twitter and stuff (?) needs more testing
  output = output.replace(
    /\[MEDIA.*?twitter.*?\].*?(\d+).*?\[\/MEDIA\]/gis,
    '<https://twitter.com/twitter/status/$1>',
  );
  output = output.replace(
    /\[MEDIA.*?\].*?<a href.*?rel="nofollow">Source:\s*(.*?)<\/a>/gis,
    '<$1>',
  );
  // Image tags
  output = output.replace(/<img\s+.*?src="(.*?)".*?\/\s?>/gis, '<$1>');
  // Lines
  output = output.replace(/\[HR\]/gis, '――――――――――――――――――――');

  // Cleaning '+'
  const regexValues = [
    '<div(\\s?.*?)>',
    '<\\/div>',
    '<span(\\s?.*?)>',
    '<\\/span>',
    '<a(\\s?.*?)>',
    '<\\/a>',
    '<\\/li>',
    '<\\/?ul>',
    '<\\/?table>',
    '\\[\\/?TABLE\\]',
    '\\[\\/?TR\\]',
    '<\\/?tr>',
    '\\[\\/?TD\\]',
    '<\\/?td>',
    '\\[\\/?ATTACH(\\s?.*?)\\]',
    '\\[\\/?FONT(\\s?.*?)\\]',
    '\\[\\/?COLOR(\\s?.*?)\\]',
    '\\[\\/?LEFT(\\s?.*?)\\]',
    '\\[\\/?HR(\\s?.*?)\\]',
  ];
  const regex = new RegExp(`(${regexValues.join('|')})`, 'gis');
  output = output.replace(regex, '');

  // Linebreaks
  output = output
    .replace(/(<br\s*\/?>)/gis, '\n')
    .replace(/(\r\n|\r|\n)+/gs, '$1\n');

  // Styles
  output = output.replace(/<\/?u>/gis, '__');
  output = output.replace(/<\/?b>/gis, '**');
  output = output.replace(/\[\/?HEADING.*?\]/gis, '**');
  output = output.replace(/\[\/?ISPOILER.*?\]/gis, '||');
  output = output.replace(/<\/?i>/gis, '*');
  output = output.replace(/(&rsquo;|&#39;)/gis, "'");
  output = output.replace(/(&quot;)/gis, '"');

  //HTML Entities
  output = decode(output);

  // Quotes part deux
  const outputMultiline = output.split(/(\r\n|\r|\n)+/gis);
  let outputMultilineOut = [];
  let isQuote = false;
  for (const line of outputMultiline) {
    if (line.includes('<blockquote>')) {
      isQuote = true;
    }
    outputMultilineOut.push((isQuote ? '> ' : '') + line.trim());
    if (line.includes('</blockquote>')) {
      isQuote = false;
    }
  }
  output = outputMultilineOut.join('\n');
  output = output.replace(/(<blockquote>|<\/blockquote>)/gi, '');

  return output;
}
function calculateTimeLeft(expiry: Date) {
  const MINUTE = 60;
  const HOUR = MINUTE * 60;
  const DAY = HOUR * 24;
  const WEEK = DAY * 7;

  const now = moment();
  let left = moment(expiry).unix() - now.unix();

  let leftString = '';

  if (left / WEEK > 0) {
    const weeks = Math.trunc(left / WEEK);
    left -= weeks * WEEK;
    leftString += `${leftString ? ' ' : ''}${weeks}W`;
  }

  if (left / DAY > 0) {
    const hours = Math.trunc(left / DAY);
    left -= hours * DAY;
    leftString += `${leftString ? ' ' : ''}${hours}D`;
  }

  if (left / HOUR > 0) {
    const hours = Math.trunc(left / HOUR);
    left -= hours * HOUR;
    leftString += `${leftString ? ' ' : ''}${hours}H`;
  }

  if (left / MINUTE > 0) {
    const minutes = Math.trunc(left / MINUTE);
    left -= minutes * MINUTE;
    leftString += `${leftString ? ' ' : ''}${minutes}M`;
  }

  return leftString;
}
function mapCgActivity(activityType: string): string {
  const activities = {
    tradelist: 'Trade',
  };
  return _get(activities, [activityType], activityType);
}
function cgProgressBar(communityGoal: ICommunityGoalDB): string {
  const CHAR_EMPTY = '⬜';
  const CHAR_FULL = '🟩';
  const MAX_LENGTH = 20;
  let result = '';

  if (communityGoal.target_qty && communityGoal.qty) {
    const max = communityGoal.target_qty;
    const current = communityGoal.qty;
    const percent = (current * MAX_LENGTH) / max;

    for (let index = 1; index <= MAX_LENGTH; index++) {
      result += index < percent ? CHAR_FULL : CHAR_EMPTY;
    }
  } else {
    result = '\b';
  }

  return result;
}
export function isEndedCG(communityGoal: ICommunityGoalDB): boolean {
  return communityGoal.qty && communityGoal.target_qty
    ? communityGoal.qty >= communityGoal.target_qty
    : false || communityGoal.expiry.getTime() <= Date.now();
}
function getNextUpdate(interval: number): string {
  const nextUpdate = moment().add(interval, 'milliseconds');
  return `<t:${nextUpdate.unix()}:R>`;
}
