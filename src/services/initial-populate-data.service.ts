import { DB } from '../modules/database';
import { Google } from '../modules/g-docs';

export async function populateGalnet() {
  const db = await DB.getInstance();
  if ((await db.getGalnetAll()).length < 1) {
    const gdocs = await Google.getInstance();

    const galnetArticles = (await gdocs.getGalnetArticles()) || [];
    console.info('Populate Service: Populating Galnet Articles');
    for (const item of galnetArticles) {
      if (item.guid) {
        try {
          await db.addGalnetEntry(
            item.guid,
            item.title,
            item.content,
            item.date,
            item.link,
          );
        } catch (error: any) {
          if (error.code === 11000) {
            console.error(
              `DB: Duplicated Galnet Article with GUID=${error.keyValue.guid}`,
            );
          } else {
            throw error;
          }
        }
      }
    }
    console.info('Populate Service: Galnet population done');
  } else {
    console.debug('Populate Service: DB is populated with Galnet Articles');
  }
}

export async function populateDevPosts() {
  const db = await DB.getInstance();
  if ((await db.getEliteDevPostAll()).length < 1) {
    const gdocs = await Google.getInstance();

    const devPosts = (await gdocs.getEliteDevPosts()) || [];
    console.info('Populate Service: Populating Elite Dev Posts');
    for (const item of devPosts) {
      if (item.guid) {
        try {
          await db.addEliteDevPostEntry(
            item.guid,
            item.author,
            item.title,
            item.content,
            item.date,
          );
        } catch (error: any) {
          if (error.code === 11000) {
            console.error(
              `DB: Duplicated DevPost Article with GUID=${error.keyValue.guid}`,
            );
          } else {
            throw error;
          }
        }
      }
    }
    console.info('Populate Service: Elite Dev Posts population done');
  } else {
    console.debug('Populate Service: DB is populated with Elite Dev Posts');
  }
}
