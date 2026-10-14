import {createClient} from '@libsql/client/web';

export const schema = [
  'CREATE TABLE IF NOT EXISTS admin_login_attempts (key TEXT PRIMARY KEY NOT NULL, attempts INTEGER NOT NULL, last_attempt_at INTEGER NOT NULL)',
  'CREATE TABLE IF NOT EXISTS admin_sessions (token_hash TEXT PRIMARY KEY NOT NULL, expires_at INTEGER NOT NULL)',
  'CREATE TABLE IF NOT EXISTS event_settings (id TEXT PRIMARY KEY NOT NULL, content TEXT NOT NULL, revision INTEGER DEFAULT 1 NOT NULL, updated_at INTEGER NOT NULL)'
];

// Match the existing database interface without changing booking/admin APIs.
export function databaseAdapter(client) {
  const prepare = sql => {
    const statement = {sql, args: []};
    return {
      statement,
      bind(...args) {statement.args=args;return this;},
      async first() {return (await client.execute(statement)).rows[0] || null;},
      async run() {return {meta:{changes:(await client.execute(statement)).rowsAffected}};}
    };
  };
  return {
    prepare,
    async batch(queries) {
      const results=await client.batch(queries.map(query=>query.statement),'write');
      return results.map(result=>({meta:{changes:result.rowsAffected}}));
    }
  };
}

let environmentPromise;
export function getEnvironment() {
  if (!environmentPromise) {
    environmentPromise=(async()=>{
      const {TURSO_DATABASE_URL:url,TURSO_AUTH_TOKEN:authToken,ADMIN_USERNAME,ADMIN_PASSWORD_HASH}=process.env;
      if (!url || !authToken || !/^(libsql|https):\/\//.test(url))
        throw Error('Configure the hosted database environment variables.');
      if (!ADMIN_USERNAME || !/^pbkdf2:100000:[a-f0-9]{32}:[a-f0-9]{64}$/.test(ADMIN_PASSWORD_HASH||''))
        throw Error('Configure the organiser environment variables.');
      const client=createClient({url,authToken});
      try {
        await client.batch(schema,'write');
        return {DB:databaseAdapter(client),ADMIN_USERNAME,ADMIN_PASSWORD_HASH};
      } catch(error) {client.close();throw error;}
    })().catch(error=>{environmentPromise=undefined;throw error;});
  }
  return environmentPromise;
}
