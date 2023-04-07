import {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from 'discord.js';
import {
  calculateDistance,
  getFormattedSystemName,
} from '../../../helpers/ed-distance-calc.helper';
import { DB } from '../../database';
import { upperCase as _upperCase } from 'lodash';
import { ISystemData } from '../../models/system-data.model';

export default {
  data: new SlashCommandBuilder()
    .setName('distance')
    .setDescription('Tells the distance between two Systems')

    .addStringOption((stringOption) =>
      stringOption
        .setName('origin')
        .setDescription('System name of origin')
        .setMinLength(2)
        .setMaxLength(70)
        .setAutocomplete(true)
        .setRequired(true),
    )
    .addStringOption((stringOption) =>
      stringOption
        .setName('destination')
        .setDescription('System name of destination')
        .setMinLength(2)
        .setMaxLength(70)
        .setAutocomplete(true)
        .setRequired(true),
    ),

  execute: {
    async execute(interaction: ChatInputCommandInteraction) {
      await interaction.deferReply({ ephemeral: true });
      const systemOrigin = interaction.options.getString('origin', true);
      const systemDestination = interaction.options.getString(
        'destination',
        true,
      );

      let reply = '';

      try {
        const db = await DB.getInstance();
        db.addEdSystemPopularity(systemOrigin);
        db.addEdSystemPopularity(systemDestination);
        const distanceResult = await calculateDistance(
          systemOrigin,
          systemDestination,
        );

        reply = `Distance between **${await getFormattedSystemName(
          systemOrigin,
        )}** and **${await getFormattedSystemName(
          systemDestination,
        )}**: ${distanceResult.toLocaleString('en')} ly.`;
      } catch (error) {
        if (error === 'ERROR-NOTFOUND') {
          reply = 'You need to enter two existing System Names';
        } else {
          reply = 'There was an error while trying to calculate the distance.';
        }
      }
      await interaction.editReply({ content: reply });
    },
  },
  autocomplete: {
    async autocomplete(interaction: AutocompleteInteraction) {
      const db = await DB.getInstance();
      const focusedValue = interaction.options.getFocused();
      const choices: Array<ISystemData> = await db.getEdSystemsAll();
      const filteredStartsWith: Array<ISystemData> = choices.filter(
        (choice) =>
          choice &&
          _upperCase(choice.systemName).startsWith(_upperCase(focusedValue)),
      );
      const filteredIncludes: Array<ISystemData> = choices.filter(
        (choice) =>
          choice &&
          _upperCase(choice.systemName).includes(_upperCase(focusedValue)),
      );
      const filteredConcat: Array<ISystemData> = filteredIncludes.filter(
        (f) =>
          !filteredStartsWith
            .map((fsw) => fsw.systemName)
            .includes(f.systemName),
      );
      const filteredFinal: Array<ISystemData> = [
        ...filteredStartsWith,
        ...filteredConcat,
      ].slice(0, 25);

      await interaction.respond(
        filteredFinal.map((choice) => ({
          name: choice.systemName,
          value: choice.systemName,
        })),
      );
    },
  },
};
