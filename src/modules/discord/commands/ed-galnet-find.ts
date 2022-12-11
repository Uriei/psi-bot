import {
  AutocompleteInteraction,
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
    .setDescription('Shows a Galnet Article by Title')

    .addStringOption((stringOption) =>
      stringOption
        .setName('title')
        .setDescription('Title of the Article')
        .setMinLength(2)
        .setMaxLength(255)
        .setAutocomplete(true)
        .setRequired(true),
    ),
  execute: {
    async execute(interaction: ChatInputCommandInteraction) {
      const title = interaction.options.getString('title', true);
      const db = await DB.getInstance();
      const article = (await db.getGalnetAll()).find((g) => g.title === title);

      let reply: MessageCreateOptions | string = {};

      try {
        if (!article) {
          reply = 'You need to enter an existing article title';
        } else {
          reply = prepareDbGalnetDiscordMessage(article);
        }
      } catch (error) {
        reply = 'There was an error while trying to find the article.';
      }

      let send: InteractionReplyOptions = {};
      if ('string' === typeof reply) {
        send = { content: reply };
      } else {
        send = { ...reply, ephemeral: true } as InteractionReplyOptions;
      }

      await interaction.reply(send);
    },
  },
  autocomplete: {
    async autocomplete(interaction: AutocompleteInteraction) {
      const db = await DB.getInstance();
      const focusedValue = _upperCase(interaction.options.getFocused());
      const focusedValuePerWord = focusedValue.split(/[\n\r\s\-'":!]/g);
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
          choice && focusedValuePerWord.every((w) => choice.includes(w)),
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
    },
  },
};
