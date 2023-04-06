import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('restart-psi-bot')
    .setDescription('Restarts the bot!')
    .setDefaultMemberPermissions(0)
    .setDMPermission(false),
  execute: {
    async execute(interaction: ChatInputCommandInteraction) {
      if (process.env.BOT_ADMIN_IDS) {
        const adminIdList = process.env.BOT_ADMIN_IDS.split(',');

        if (adminIdList.includes(interaction.user.id)) {
          await interaction.reply({
            content: 'Restarting PSI-Bot!',
            ephemeral: true,
          });
          console.log('Received SlashCommand to shutdown!');
          try {
            process.kill(process.pid, 'SIGINT');
          } catch {
            process.kill(process.pid, 'SIGBREAK');
          }
        } else {
          await interaction.reply({
            content: 'YOU ARE NOT MY BOSS!',
            ephemeral: true,
          });
        }
      }
    },
  },
};
