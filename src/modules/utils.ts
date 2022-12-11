import { Item as RssItem } from 'rss-parser';
import { EmbedBuilder, MessageCreateOptions } from 'discord.js';
import moment from 'moment';
import { decode } from 'html-entities';

const DEFAULT_COLOR = 0xff8c0d;
const ELITE_DEV_POST_ICON_URL = 'https://i.imgur.com/e1kHLpN.jpeg';

export function prepareGalnetDiscordMessage(
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

export function prepareEliteDevDiscordMessage(eliteDevPost: RssItem) {
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
