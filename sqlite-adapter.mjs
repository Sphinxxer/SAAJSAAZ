import {DatabaseSync} from 'node:sqlite';
import {readdirSync,readFileSync} from 'node:fs';
export function database(filename=':memory:'){
  const sqlite=new DatabaseSync(filename);
  sqlite.exec('CREATE TABLE IF NOT EXISTS __local_migrations (name TEXT PRIMARY KEY)');
  for(const name of readdirSync(new URL('../drizzle/',import.meta.url)).filter(n=>n.endsWith('.sql')).sort()){
    if(sqlite.prepare('SELECT name FROM __local_migrations WHERE name = ?').get(name))continue;
    sqlite.exec('BEGIN');
    try{
      sqlite.exec(readFileSync(new URL('../drizzle/'+name,import.meta.url),'utf8').replace(/CREATE TABLE /g,'CREATE TABLE IF NOT EXISTS '));
      sqlite.prepare('INSERT INTO __local_migrations (name) VALUES (?)').run(name);
      sqlite.exec('COMMIT');
    }catch(error){sqlite.exec('ROLLBACK');throw error;}
  }
  const prepare=sql=>{
    let args=[];
    const query={bind(...values){args=values;return query;},async first(){return sqlite.prepare(sql).get(...args)||null;},
      async run(){const result=sqlite.prepare(sql).run(...args);return {meta:{changes:Number(result.changes)}};}};
    return query;
  };
  return {prepare,async batch(queries){sqlite.exec('BEGIN');try{const result=[];for(const query of queries)result.push(await query.run());sqlite.exec('COMMIT');return result;}catch(e){sqlite.exec('ROLLBACK');throw e;}},close(){sqlite.close();}};
}
