import {createInterface} from 'node:readline/promises';
import {stdin,stdout} from 'node:process';
import {hashPassword} from '../server/auth.mjs';
const terminal=createInterface({input:stdin,output:stdout});
try {
  const password=await terminal.question('Enter the organiser password to hash (local terminal only): ');
  if(!password)throw Error('Enter a password.');
  console.log('\nADMIN_PASSWORD_HASH='+await hashPassword(password));
} finally {terminal.close();}
