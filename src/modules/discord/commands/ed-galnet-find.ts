import {
  ActionRowBuilder,
  APIEmbed,
  AutocompleteInteraction,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  InteractionReplyOptions,
  MessageCreateOptions,
  ModalActionRowComponentBuilder,
  ModalBuilder,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
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
        )
        .addBooleanOption((booleanOption) =>
          booleanOption
            .setName('public')
            .setDescription(
              'Optional: Posts the Article publicly for everyone to see',
            )
            .setRequired(false),
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
        const publicSearch = interaction.options.getBoolean('public', false);
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
          send = { content: reply, ephemeral: true };
        } else {
          send = {
            ...reply,
            ephemeral: !publicSearch,
          } as InteractionReplyOptions;
        }
        await interaction.reply(send);
      } else if (subCommand === 'by-text') {
        let wordsArray: Array<string> = [];
        let inputWords = interaction.options.getString('words', true);
        const wordsQuoted =
          inputWords
            .match(/(?<quoted>"(.+?)")/gi)
            ?.map((w) => w.replace(/"/g, ''))
            .filter((w) => w) || [];
        inputWords = inputWords.replace(/"/g, '');
        let wordsToRemove: Array<string> = [];
        for (const word of wordsQuoted) {
          wordsToRemove = wordsToRemove.concat(word.split(/\s/g));
        }
        wordsToRemove = wordsToRemove.concat(inputWords);
        for (const wordToRemove of wordsToRemove) {
          inputWords = inputWords
            .replace(new RegExp(wordToRemove, 'gi'), '')
            .trim();
        }
        const singleWords = inputWords.split(/\s/g).filter((w) => w);
        wordsArray = wordsArray.concat(wordsQuoted, singleWords);

        const wordsRegex: Array<RegExp> = wordsArray.map(
          (w) => new RegExp(`\\b(${w})\\b`, 'gi'),
        );
        const articles = (await db.getGalnetAll()).filter((g) => {
          const wholeText = g.title + '\n' + g.content;
          return wordsRegex.every((w) => w.test(wholeText));
        });

        try {
          if (articles.length <= 0) {
            await interaction.reply({
              content: 'No articles found.',
              ephemeral: true,
            });
            return;
          } else {
            const galnetArticlesFormattedDiscord = articles.map((g) =>
              prepareDbGalnetDiscordMessage(g, wordsRegex),
            );

            let galnetIndex = 0;

            const interactionReply = await interaction.reply(
              generateReply(galnetArticlesFormattedDiscord[galnetIndex], [
                ...generateButtonsGalnetByText(galnetIndex, articles.length),
              ]),
            );

            interactionReply
              .createMessageComponentCollector({
                time: 600000,
              })
              .on('collect', async (c) => {
                switch (c.customId) {
                  case 'galnet_first':
                    galnetIndex = 0;
                    await interaction.editReply(
                      generateReply(
                        galnetArticlesFormattedDiscord[galnetIndex],
                        [
                          ...generateButtonsGalnetByText(
                            galnetIndex,
                            articles.length,
                          ),
                        ],
                      ),
                    );
                    await c.update({});
                    break;

                  case 'galnet_previous':
                    galnetIndex = galnetIndex > 0 ? galnetIndex - 1 : 0;
                    await interaction.editReply(
                      generateReply(
                        galnetArticlesFormattedDiscord[galnetIndex],
                        [
                          ...generateButtonsGalnetByText(
                            galnetIndex,
                            articles.length,
                          ),
                        ],
                      ),
                    );
                    await c.update({});
                    break;

                  case 'galnet_next':
                    galnetIndex =
                      galnetIndex < articles.length - 1
                        ? galnetIndex + 1
                        : articles.length - 1;
                    await interaction.editReply(
                      generateReply(
                        galnetArticlesFormattedDiscord[galnetIndex],
                        [
                          ...generateButtonsGalnetByText(
                            galnetIndex,
                            articles.length,
                          ),
                        ],
                      ),
                    );
                    await c.update({});
                    break;

                  case 'galnet_last':
                    galnetIndex = articles.length - 1;
                    await interaction.editReply(
                      generateReply(
                        galnetArticlesFormattedDiscord[galnetIndex],
                        [
                          ...generateButtonsGalnetByText(
                            galnetIndex,
                            articles.length,
                          ),
                        ],
                      ),
                    );
                    await c.update({});
                    break;
                  case 'post_public':
                    await interaction.editReply(
                      generateReply(
                        galnetArticlesFormattedDiscord[galnetIndex],
                        [],
                      ),
                    );
                    await interaction.followUp(
                      generateReply(
                        galnetArticlesFormattedDiscord[galnetIndex],
                        [],
                        false,
                      ),
                    );

                    break;
                  case 'galnet_page':
                    var modalPageSelector = new TextInputBuilder()
                      .setCustomId('galnet_modal_page_input')
                      .setLabel(`Select page: (Max: ${articles.length})`)
                      .setStyle(TextInputStyle.Short);
                    var modal = new ModalBuilder()
                      .setCustomId(`galnet_modal_page`)
                      .setTitle(`Galnet Find`);

                    modal.addComponents(
                      new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
                        modalPageSelector,
                      ),
                    );

                    await c.showModal(modal);
                    var modalSubmitted = await c
                      .awaitModalSubmit({
                        time: 60000,
                        filter: (i) => i.user.id === c.user.id,
                      })
                      .catch((error) => {
                        console.error(error);
                        return null;
                      });
                    var newPage = 0;
                    if (modalSubmitted) {
                      newPage =
                        Number(
                          modalSubmitted.fields.getTextInputValue(
                            'galnet_modal_page_input',
                          ),
                        ) - 1;
                      await modalSubmitted.deferReply({ ephemeral: true });
                      await modalSubmitted.deleteReply();
                    }

                    if (newPage < 0) {
                      galnetIndex = 0;
                    } else if (newPage > articles.length - 1) {
                      galnetIndex = articles.length - 1;
                    } else {
                      galnetIndex = newPage;
                    }
                    await interaction.editReply(
                      generateReply(
                        galnetArticlesFormattedDiscord[galnetIndex],
                        [
                          ...generateButtonsGalnetByText(
                            galnetIndex,
                            articles.length,
                          ),
                        ],
                      ),
                    );
                    break;

                  default:
                    await c.update({});
                    break;
                }
              })
              .on('end', async () => {
                interaction.editReply(
                  generateReply(
                    galnetArticlesFormattedDiscord[galnetIndex],
                    [],
                  ),
                );
              });
          }
        } catch (error) {
          await interaction.reply({
            content: 'There was an error while trying to find the article.',
            ephemeral: true,
          });
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

function generateButtonsGalnetByText(
  index: number,
  maxIndex: number,
  buttonsEnabled = true,
) {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
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
    ),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('post_public')
        .setLabel('Post in channel')
        .setStyle(ButtonStyle.Primary),
    ),
  ];
}

function generateReply(
  article: MessageCreateOptions,
  components: Array<ActionRowBuilder<ButtonBuilder>>,
  ephemeral = true,
) {
  return {
    embeds: article.embeds as Array<APIEmbed>,
    components,
    ephemeral,
  };
}
