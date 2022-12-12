import {
  ActionRowBuilder,
  APIEmbed,
  AutocompleteInteraction,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  InteractionReplyOptions,
  MessageCreateOptions,
  SlashCommandBuilder,
} from 'discord.js';
import { DB } from '../../database';
import { upperCase as _upperCase } from 'lodash';
import { prepareDbGalnetDiscordMessage } from '../../utils';

export default {
  data: new SlashCommandBuilder()
    .setName('galnet')
    .setDescription('Returns a Galnet article')
    .addSubcommand((subCommand) =>
      subCommand
        .setName('by-title')
        .setDescription('Search by title')
        .addStringOption((stringOption) =>
          stringOption
            .setName('title')
            .setDescription('Title of the Article')
            .setMinLength(2)
            .setMaxLength(255)
            .setAutocomplete(true)
            .setRequired(true),
        ),
    )
    .addSubcommand((subCommand) =>
      subCommand
        .setName('by-text')
        .setDescription('Search by text')
        .addStringOption((stringOption) =>
          stringOption
            .setName('words')
            .setDescription('Words to find')
            .setMinLength(2)
            .setMaxLength(255)
            .setRequired(true),
        ),
    ),

  execute: {
    async execute(interaction: ChatInputCommandInteraction) {
      const db = await DB.getInstance();
      const subCommand = interaction.options.getSubcommand();
      let send: InteractionReplyOptions = {};
      if (subCommand === 'by-title') {
        const title = interaction.options.getString('title', true);
        const article = (await db.getGalnetAll()).find(
          (g) => g.title === title,
        );

        let reply: MessageCreateOptions | string = {};

        try {
          if (!article) {
            reply = 'You need to enter an existing article title';
          } else {
            reply = prepareDbGalnetDiscordMessage(
              article,
            ) as MessageCreateOptions;
          }
        } catch (error) {
          reply = 'There was an error while trying to find the article.';
        }

        if ('string' === typeof reply) {
          send = { content: reply };
        } else {
          send = { ...reply, ephemeral: true } as InteractionReplyOptions;
        }
        await interaction.reply(send);
      } else if (subCommand === 'by-text') {
        const words = _upperCase(interaction.options.getString('words', true));
        const articles = (await db.getGalnetAll()).filter((g) => {
          const wholeText = _upperCase(g.title + ' ' + g.content);
          const wordsArray = words.split(/\W/g);
          return wordsArray.every((w) => wholeText.includes(w));
        });

        try {
          if (articles.length <= 0) {
            await interaction.reply('No articles found.');
            return;
          } else {
            const galnetArticlesFormattedDiscord = articles.map((g) =>
              prepareDbGalnetDiscordMessage(g),
            );

            let galnetIndex = 0;

            const interactionReply = await interaction.reply(
              generateReply(galnetArticlesFormattedDiscord[galnetIndex], [
                generateButtons(galnetIndex, articles.length),
              ]),
            );

            interactionReply
              .createMessageComponentCollector({
                //  filter: (c) => c.isButton(),
                time: 600000,
              })
              .on('collect', async (c) => {
                console.debug('Galnet by-text collector interacted.');
                console.debug(c);
                switch (c.customId) {
                  case 'galnet_first':
                    galnetIndex = 0;
                    await interaction.editReply(
                      generateReply(
                        galnetArticlesFormattedDiscord[galnetIndex],
                        [generateButtons(galnetIndex, articles.length)],
                      ),
                    );
                    break;

                  case 'galnet_previous':
                    galnetIndex = galnetIndex > 0 ? galnetIndex - 1 : 0;
                    await interaction.editReply(
                      generateReply(
                        galnetArticlesFormattedDiscord[galnetIndex],
                        [generateButtons(galnetIndex, articles.length)],
                      ),
                    );
                    break;

                  case 'galnet_next':
                    galnetIndex =
                      galnetIndex < articles.length - 1
                        ? galnetIndex + 1
                        : articles.length - 1;
                    await interaction.editReply(
                      generateReply(
                        galnetArticlesFormattedDiscord[galnetIndex],
                        [generateButtons(galnetIndex, articles.length)],
                      ),
                    );
                    break;

                  case 'galnet_last':
                    galnetIndex = articles.length - 1;
                    await interaction.editReply(
                      generateReply(
                        galnetArticlesFormattedDiscord[galnetIndex],
                        [generateButtons(galnetIndex, articles.length)],
                      ),
                    );
                    break;

                  default:
                    break;
                }
                await c.update({});
              })
              .on('end', async () => {
                console.debug('Galnet by-text collector ended.');
                interaction.editReply(
                  generateReply(
                    galnetArticlesFormattedDiscord[galnetIndex],
                    [],
                  ),
                );
              });
          }
        } catch (error) {
          await interaction.reply(
            'There was an error while trying to find the article.',
          );
        }
      }
    },
  },
  autocomplete: {
    async autocomplete(interaction: AutocompleteInteraction) {
      const db = await DB.getInstance();
      const subCommand = interaction.options.getSubcommand();
      if (subCommand === 'by-title') {
        const focusedValue = _upperCase(interaction.options.getFocused());
        const focusedValuePerWord = focusedValue.split(/\W/g);
        const choices: Array<string> = (await db.getGalnetAll()).map(
          (g) => g.title,
        );

        const filteredStartsWith: Array<string> = choices.filter(
          (choice) => choice && _upperCase(choice).startsWith(focusedValue),
        );
        const filteredIncludes: Array<string> = choices.filter(
          (choice) => choice && _upperCase(choice).includes(focusedValue),
        );

        // This one finds the words anywhere in the title without checking the order
        const filteredIncludesSplitted: Array<string> = choices.filter(
          (choice) =>
            choice &&
            focusedValuePerWord.every((w) => _upperCase(choice).includes(w)),
        );

        // This one finds the words anywhere in the title in the same order
        // const filteredIncludesSplitted: Array<string> = choices.filter(
        //   (choice) => {
        //     let result = false;
        //     if (choice) {
        //       const regExString = focusedValuePerWord.join('.*');
        //       const regEx = new RegExp(regExString);
        //       result = regEx.test(_upperCase(choice));
        //     }
        //     return result;
        //   },
        // );

        const filteredFinal: Array<string> = [
          ...new Set([
            ...filteredStartsWith,
            ...filteredIncludes,
            ...filteredIncludesSplitted,
          ]),
        ].slice(0, 25);

        await interaction.respond(
          filteredFinal.map((choice) => ({
            name: choice,
            value: choice,
          })),
        );
      } else {
        await interaction.respond([]);
      }
    },
  },
};

function generateButtons(
  index: number,
  maxIndex: number,
  buttonsEnabled = true,
) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('galnet_first')
      .setLabel('<<')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(!buttonsEnabled || index <= 0),
    new ButtonBuilder()
      .setCustomId('galnet_previous')
      .setLabel('<')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(!buttonsEnabled || index <= 0),
    new ButtonBuilder()
      .setCustomId('galnet_page')
      .setLabel(`${index + 1} / ${maxIndex}`)
      .setStyle(ButtonStyle.Success)
      .setDisabled(!buttonsEnabled),
    new ButtonBuilder()
      .setCustomId('galnet_next')
      .setLabel('>')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(!buttonsEnabled || index >= maxIndex - 1),
    new ButtonBuilder()
      .setCustomId('galnet_last')
      .setLabel('>>')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(!buttonsEnabled || index >= maxIndex - 1),
  );
}

function generateReply(
  article: MessageCreateOptions,
  components: Array<ActionRowBuilder<ButtonBuilder>>,
) {
  return {
    embeds: article.embeds as Array<APIEmbed>,
    components,
    ephemeral: true,
  };
}
