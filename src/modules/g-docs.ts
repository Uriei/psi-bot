import {
  GoogleSpreadsheet,
  GoogleSpreadsheetWorksheet,
} from 'google-spreadsheet';

const TWITTER_LAST_TWEET_ID_ROWNAME = 'TwitterLastTweetID';

export class Google {
  private static instance: Google;

  private galnetSheet: GoogleSpreadsheetWorksheet | null = null;
  private eliteDevPostsSheet: GoogleSpreadsheetWorksheet | null = null;
  private eliteDevsListSheet: GoogleSpreadsheetWorksheet | null = null;
  private configsSheet: GoogleSpreadsheetWorksheet | null = null;
  private googleClientEmail: string = '';
  private googlePrivateKey: string = '';
  private googleBotBookId: string = '';
  private testMode: string | undefined;

  private constructor() {}

  public static async getInstance(): Promise<Google> {
    if (Google.instance) {
      return Promise.resolve(Google.instance);
    } else {
      Google.instance = new Google();
      await Google.instance.getBotSheets();
      return Promise.resolve(Google.instance);
    }
  }

  private getCredentialInfo() {
    if (
      process.env.GOOGLE_CLIENT_EMAIL &&
      process.env.GOOGLE_PRIVATE_KEY &&
      process.env.GOOGLE_BOT_BOOK_ID
    ) {
      console.info('Google credentials found on Environment.');
      this.googleClientEmail = process.env.GOOGLE_CLIENT_EMAIL;
      this.googlePrivateKey = process.env.GOOGLE_PRIVATE_KEY;
      this.googleBotBookId = process.env.GOOGLE_BOT_BOOK_ID;
      this.testMode = process.env.GOOGLE_TEST_MODE;
    } else {
      console.error('Google credentials not found on Environment.');
      process.exit(1);
    }
  }

  private async getBotSheets() {
    if (this.galnetSheet && this.eliteDevPostsSheet && this.configsSheet) {
      return {
        galnetSheet: this.galnetSheet,
        eliteDevSheet: this.eliteDevPostsSheet,
        configs: this.configsSheet,
      };
    }
    this.getCredentialInfo();
    const botBook = new GoogleSpreadsheet(this.googleBotBookId);

    // Initialize Auth - see https://theoephraim.github.io/node-google-spreadsheet/#/getting-started/authentication
    await botBook.useServiceAccountAuth({
      client_email: this.googleClientEmail,
      private_key: this.googlePrivateKey,
    });

    await botBook.loadInfo();

    this.galnetSheet = botBook.sheetsByTitle['Galnet'];
    this.eliteDevPostsSheet = botBook.sheetsByTitle['EliteDevPosts'];
    this.eliteDevsListSheet = botBook.sheetsByTitle['EliteDevs'];
    this.configsSheet = botBook.sheetsByTitle['Configs'];

    return await Promise.resolve({
      galnetSheet: this.galnetSheet,
      eliteDevSheet: this.eliteDevPostsSheet,
    });
  }

  public async getGalnetArticles() {
    return this.galnetSheet?.getRows().then((res) => {
      return this.galnetSheet?.loadCells().then(() => {
        const galnetEntries: any[] = [];
        for (const item of res) {
          const entry = {
            guid: this.galnetSheet?.getCell(item.rowIndex - 1, 0)
              .formattedValue,
            date: this.galnetSheet?.getCell(item.rowIndex - 1, 1)
              .formattedValue,
            title: this.galnetSheet?.getCell(item.rowIndex - 1, 2)
              .formattedValue,
            content: this.galnetSheet?.getCell(item.rowIndex - 1, 3)
              .formattedValue,
            link: this.galnetSheet?.getCell(item.rowIndex - 1, 4)
              .formattedValue,
          };
          galnetEntries.push(entry);
        }
        return galnetEntries;
      });
    });
  }

  public async addNewGalnetEntry(
    guid: string,
    date: string,
    title: string,
    content: string,
    link: string,
  ) {
    if (this.testMode) return;
    const entry = [guid, date, title, content, link];
    if (this.galnetSheet && entry) {
      return this.galnetSheet
        .addRow(entry)
        .then((res) => {
          return Promise.resolve(res);
        })
        .catch((err) => {
          console.trace(err);
          return Promise.reject(err);
        });
    } else {
      console.error('No sheet or entry');
      return Promise.reject('No sheet or entry');
    }
  }

  public async getEliteDevPosts() {
    return this.eliteDevPostsSheet?.getRows().then((res) => {
      return this.eliteDevPostsSheet?.loadCells().then(() => {
        const devPostsEntries: any[] = [];
        for (const item of res) {
          const entry = {
            guid: this.eliteDevPostsSheet?.getCell(item.rowIndex - 1, 0)
              .formattedValue,
            date:
              this.eliteDevPostsSheet?.getCell(item.rowIndex - 1, 1)
                .formattedValue + '000',
            author: this.eliteDevPostsSheet?.getCell(item.rowIndex - 1, 2)
              .formattedValue,
            title: this.eliteDevPostsSheet?.getCell(item.rowIndex - 1, 3)
              .formattedValue,
            content: this.eliteDevPostsSheet?.getCell(item.rowIndex - 1, 4)
              .formattedValue,
          };
          devPostsEntries.push(entry);
        }
        return devPostsEntries;
      });
    });
  }

  public async addNewEliteDevPostEntry(
    guid: string,
    date: string,
    author: string,
    title: string,
    content: string,
  ) {
    if (this.testMode) return;
    const entry = [guid, date, author, title, content];
    if (this.eliteDevPostsSheet && entry) {
      return this.eliteDevPostsSheet
        .addRow(entry)
        .then((res) => {
          return Promise.resolve(res);
        })
        .catch((err) => {
          console.trace(err);
          return Promise.reject(err);
        });
    } else {
      console.error('No sheet or entry');
      return Promise.reject('No sheet or entry');
    }
  }

  public async getDevsList() {
    const devsData = [];
    if (!this.eliteDevsListSheet) {
      return Promise.resolve([]);
    }

    const allDevsRaw = await this.eliteDevsListSheet.getRows().then((r) => r);

    for (const dev of allDevsRaw) {
      const rowIndex = dev.rowIndex - 1;
      try {
        this.eliteDevsListSheet.getCell(rowIndex, 0);
        this.eliteDevsListSheet.getCell(rowIndex, 1);
        this.eliteDevsListSheet.getCell(rowIndex, 2);
      } catch (error) {
        await this.eliteDevsListSheet.loadCells();
      }
      if (
        this.eliteDevsListSheet.getCell(rowIndex, 0) &&
        this.eliteDevsListSheet.getCell(rowIndex, 0).value
      ) {
        const devData = {
          name: this.eliteDevsListSheet.getCell(rowIndex, 0).value.toString(),
          jobPosition: this.eliteDevsListSheet
            .getCell(rowIndex, 1)
            .value.toString(),
          twitter: this.eliteDevsListSheet
            .getCell(rowIndex, 2)
            .value.toString(),
        };
        devsData.push(devData);
      }
    }

    return Promise.resolve(devsData);
  }

  public async getLastTweetID() {
    if (!this.configsSheet) {
      return Number.MAX_VALUE;
    }
    return await this.configsSheet.loadCells().then(async () => {
      return await this.configsSheet?.getRows().then((res) => {
        for (const row of res) {
          if (
            this.configsSheet?.getCell(row.rowIndex - 1, 0).value ===
            TWITTER_LAST_TWEET_ID_ROWNAME
          ) {
            const cell = this.configsSheet?.getCell(row.rowIndex - 1, 1);
            return cell.value ? cell.value.toString() : undefined;
          }
        }
        return undefined;
      });
    });
  }
}
