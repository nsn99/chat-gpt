import {cp,mkdir,rm} from 'node:fs/promises';
// Ship only runtime assets, never tests, repository metadata or the dev server.
await rm(new URL('dist/',import.meta.url),{recursive:true,force:true});
await mkdir(new URL('dist/',import.meta.url),{recursive:true});
for(const path of ['index.html','style.css','src'])await cp(new URL(path,import.meta.url),new URL('dist/'+path,import.meta.url),{recursive:true});
console.log('Static game built in dist/');
