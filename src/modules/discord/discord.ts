import {
  Client,
  GatewayIntentBits,
  ActivityType,
  Channel,
  MessagePayload,
  Events,
  REST,
  Routes,
  MessageCreateOptions,
  MessageEditOptions,
} from 'discord.js';
import { TweetV2 } from 'twitter-api-v2';
import * as fs from 'fs';
import * as path from 'path';
import { get as _get, set as _set, has as _has } from 'lodash';

class Discord {
  private static _discordKeepAliveInterval: NodeJS.Timer;
  public get discordKeepAliveInterval(): NodeJS.Timer {
    return Discord._discordKeepAliveInterval;
  }

  private static instance: Discord;
  private client: Client;
  private slashCommands: {
    [key: string]: {
      data: any;
      execute: any;
      autocomplete: any;
    };
  };
  private slashCommandsAdmin: {
    [key: string]: {
      data: any;
      execute: any;
      autocomplete: any;
    };
  };
  private botToken: string = '';
  private botClientId: string = '';
  private galnetChannelID: string = '';
  private eliteDevPostsChannelID: string = '';
  private twitterDevPostsChannelID: string = '';
  private communityGoalChannelID: string = '';

  private constructor() {
    this.getCredentialInfo();
    this.client = new Client({ intents: [GatewayIntentBits.Guilds] });
    this.client.on('warn', console.debug);
    this.slashCommands = {};
    this.slashCommandsAdmin = {};
    this.fillSlashCommands();
    this.registerSlashCommandsDiscord();
    this.registerSlashCommandsAdminDiscord();
    this.registerSlashCommandsInteractions();

    this.login().then().catch();

    Discord._discordKeepAliveInterval = setInterval(() => {
      if (!this.client.isReady()) {
        this.login().then().catch();
      }
    }, 300000);
  }

  public static getInstance(): Promise<Discord> {
    if (Discord.instance) {
      return Promise.resolve(Discord.instance);
    } else {
      Discord.instance = new Discord();
      return Promise.resolve(Discord.instance);
    }
  }

  private fillSlashCommands() {
    const commandsPath = path.join(__dirname, 'commands');
    const commandFiles = fs
      .readdirSync(commandsPath)
      .filter((file) => file.endsWith('.js'));

    for (const file of commandFiles) {
      const filePath = path.join(commandsPath, file);
      const command = require(filePath)?.default || {};
      // Set a new item in the Collection with the key as the command name and the value as the exported module
      if ('data' in command && 'execute' in command) {
        _set(
          filePath.includes('admin-')
            ? this.slashCommandsAdmin
            : this.slashCommands,
          [command.data.name, 'execute'],
          command.execute,
        );
        _set(
          filePath.includes('admin-')
            ? this.slashCommandsAdmin
            : this.slashCommands,
          [command.data.name, 'autocomplete'],
          command.autocomplete,
        );
        _set(
          filePath.includes('admin-')
            ? this.slashCommandsAdmin
            : this.slashCommands,
          [command.data.name, 'data'],
          command.data,
        );
      } else {
        console.log(
          `[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`,
        );
      }
    }
  }

  private registerSlashCommandsInteractions() {
    this.client.on(Events.InteractionCreate, async (interaction) => {
      if (interaction.isChatInputCommand()) {
        const command = _get(
          { ...this.slashCommands, ...this.slashCommandsAdmin },
          [interaction.commandName, 'execute'],
        );
        if (!command) {
          console.error(
            `No command matching ${interaction.commandName} was found.`,
          );
          return;
        }

        try {
          await command.execute(interaction);
        } catch (error) {
          console.error(error);
          await interaction.reply({
            content: 'There was an error while executing this command!',
            ephemeral: true,
          });
        }
      } else if (interaction.isAutocomplete()) {
        const command = _get(
          { ...this.slashCommands, ...this.slashCommandsAdmin },
          [interaction.commandName, 'autocomplete'],
        );
        if (!command) {
          return;
        }

        try {
          await command.autocomplete(interaction);
        } catch (error) {
          console.error(error);
        }
      } else {
        return;
      }
    });
  }

  private async registerSlashCommandsDiscord() {
    const rest = new REST({ version: '10' }).setToken(this.botToken);
    const commands = [];
    for (const command of Object.keys(this.slashCommands)) {
      if (_has(this.slashCommands, [command, 'data'])) {
        commands.push(_get(this.slashCommands, [command, 'data']));
      }
    }

    try {
      const data = (await rest.put(
        Routes.applicationCommands(this.botClientId),
        {
          body: commands,
        },
      )) as Array<any>;
      console.log(`Loaded ${data.length} SlashCommands.`);
    } catch (error) {
      console.error('Error loading SlashCommands', error);
    }
  }
  private async registerSlashCommandsAdminDiscord() {
    const DEV_GUILD_ID = process.env.DEV_GUILD_ID || '';
    if (!DEV_GUILD_ID) {
      return;
    }
    const rest = new REST({ version: '10' }).setToken(this.botToken);
    const commands = [];
    for (const command of Object.keys(this.slashCommandsAdmin)) {
      if (_has(this.slashCommandsAdmin, [command, 'data'])) {
        commands.push(_get(this.slashCommandsAdmin, [command, 'data']));
      }
    }

    try {
      const data = (await rest.put(
        Routes.applicationGuildCommands(this.botClientId, DEV_GUILD_ID),
        {
          body: commands,
        },
      )) as Array<any>;
      console.log(`Loaded ${data.length} admin SlashCommands.`);
    } catch (error) {
      console.error('Error loading Admin SlashCommands', error);
    }
  }

  private getCredentialInfo() {
    if (process.env.DISCORD_BOT_TOKEN && process.env.DISCORD_CLIENT_ID) {
      console.info('Discord credentials found on Environment.');
      this.botToken = process.env.DISCORD_BOT_TOKEN || '';
      this.botClientId = process.env.DISCORD_CLIENT_ID || '';
      this.galnetChannelID = process.env.DISCORD_GALNET_CHANNEL_ID || '';
      this.eliteDevPostsChannelID =
        process.env.DISCORD_ELITEDEV_CHANNEL_ID || '';
      this.twitterDevPostsChannelID =
        process.env.DISCORD_TWITTERDEV_CHANNEL_ID || '';
      this.communityGoalChannelID =
        process.env.DISCORD_COMMUNITYGOAL_CHANNEL_ID || '';
    } else {
      console.error('Discord credentials not found on Environment.');
      process.exit(1);
    }
  }

  async login() {
    if (!this.botToken) {
      this.getCredentialInfo();
    }
    const res = await this.client.login(this.botToken);

    if (res) {
      console.info('Discord logged in.');
      this.setPresence('ONLINE');
    } else {
      console.error('Discord login failed.');
    }
    return res;
  }

  public disconnect() {
    this.client.destroy();
  }

  public setPresence(status: 'ONLINE' | 'SHUTDOWN' | 'OFFLINE'): void {
    switch (status) {
      case 'ONLINE':
        this.client.user?.setPresence({
          status: 'online',
          afk: false,
          activities: [
            {
              name: 'Galnet News',
              type: ActivityType.Watching,
            },
          ],
        });
        break;
      case 'SHUTDOWN':
        this.client.user?.setPresence({
          status: 'idle',
          afk: true,
          activities: [{ name: 'Shutting down...' }],
        });
        break;
      case 'OFFLINE':
      default:
        this.client.user?.setPresence({
          status: 'invisible',
          afk: true,
          activities: [{ name: 'Offline', type: undefined }],
        });
        break;
    }
  }

  async sendGalnetPost(entry: MessagePayload | MessageCreateOptions) {
    if (!this.galnetChannelID) return null;
    if (!entry) {
      return Promise.reject(`ERROR: Send Galnet - No valid entry`);
    }

    const channel = (await this.client.channels.fetch(
      this.galnetChannelID,
    )) as Channel;
    if (!channel || !channel.isTextBased()) {
      return Promise.reject(`ERROR: Send Galnet - No channel found`);
    }

    if (!this.client.isReady()) {
      await this.login().then().catch();
    }

    if (this.client.isReady()) {
      return channel.send(entry).then((res) => {
        if (res.crosspostable) {
          res.crosspost().then(() => {});
        }
        return Promise.resolve(res);
      });
    } else {
      return Promise.reject(`ERROR: Send Galnet - Client not ready`);
    }
  }

  async sendEliteDevPost(entry: MessagePayload | MessageCreateOptions) {
    if (!this.eliteDevPostsChannelID) return null;
    if (!entry) {
      return Promise.reject(`ERROR: Send EliteDevPost - No valid entry`);
    }

    const channel = (await this.client.channels.fetch(
      this.eliteDevPostsChannelID,
    )) as Channel;
    if (!channel || !channel.isTextBased()) {
      return Promise.reject(`ERROR: Send EliteDevPost - No channel found`);
    }

    if (!this.client.isReady()) {
      await this.login().then().catch();
    }

    if (this.client.isReady()) {
      return channel.send(entry).then((res) => {
        if (res.crosspostable) {
          res.crosspost().then(() => {});
        }
        return Promise.resolve(res);
      });
    } else {
      return Promise.reject(`ERROR: Send EliteDevPost - Client not ready`);
    }
  }

  async sendTwitterDevPost(tweet: TweetV2) {
    if (!this.twitterDevPostsChannelID) return null;
    if (!tweet) {
      return Promise.reject(`ERROR: Send TwitterDevPost - No valid Tweet`);
    }
    const tweetUrl = tweet.id
      ? `https://twitter.com/twitter/status/${tweet.id}`
      : '';
    if (!tweetUrl) {
      return Promise.reject(`ERROR: Send TwitterDevPost - No valid Tweet URL`);
    }

    const channel = (await this.client.channels.fetch(
      this.twitterDevPostsChannelID,
    )) as Channel;
    if (!channel || !channel.isTextBased()) {
      return Promise.reject(`ERROR: Send TwitterDevPost - No channel found`);
    }

    if (!this.client.isReady()) {
      await this.login().then().catch();
    }

    if (this.client.isReady()) {
      return await channel.send(tweetUrl).then(async (res) => {
        if (res.crosspostable) {
          res.crosspost().then(() => {});
        }
        return Promise.resolve(res);
      });
    } else {
      return Promise.reject(`ERROR: Send TwitterDevPost - Client not ready`);
    }
  }

  async createCG(communityGoal: MessageCreateOptions) {
    if (!this.communityGoalChannelID) return null;

    if (!communityGoal) {
      return Promise.reject(`ERROR: Send CG - No valid entry`);
    }

    const channel = (await this.client.channels.fetch(
      this.communityGoalChannelID,
    )) as Channel;
    if (!channel || !channel.isTextBased()) {
      return Promise.reject(`ERROR: Send CG - No channel found`);
    }

    if (!this.client.isReady()) {
      await this.login().then().catch();
    }

    if (this.client.isReady()) {
      return channel.send(communityGoal);
    } else {
      return Promise.reject(`ERROR: Send CG - Client not ready`);
    }
  }

  async updateCG(messageId: string, communityGoal: MessageEditOptions) {
    if (!this.communityGoalChannelID || !messageId) return null;

    if (!communityGoal) {
      return Promise.reject(`ERROR: Send CG - No valid entry`);
    }

    const message = await this.client.channels
      .fetch(this.communityGoalChannelID)
      .then(
        async (c) => c?.isTextBased() && (await c.messages.fetch(messageId)),
      );

    if (message && message.editable) {
      if (!this.client.isReady()) {
        await this.login().then().catch();
      }

      if (this.client.isReady()) {
        return await message.edit(communityGoal);
      } else {
        return Promise.reject(`ERROR: Send CG - Client not ready`);
      }
    } else {
      return Promise.reject(`ERROR: Update CG - No channel or message found`);
    }
  }
}

export { Discord };
