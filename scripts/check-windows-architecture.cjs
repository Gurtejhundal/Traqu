const {readFileSync}=require('node:fs');
const [arch,...files]=process.argv.slice(2);
const expected={x64:0x8664,arm64:0xaa64}[arch];
if(!expected || files.length===0)throw new Error('Pass x64/arm64 and the Electron/backend executable paths.');
for(const file of files){
  const bytes=readFileSync(file);
  if(bytes.toString('ascii',0,2)!=='MZ')throw new Error(`${file}: not a Windows executable`);
  const offset=bytes.readUInt32LE(0x3c);
  if(bytes.toString('ascii',offset,offset+4)!=='PE\0\0')throw new Error(`${file}: no PE header`);
  if(bytes.readUInt16LE(offset+4)!==expected)throw new Error(`${file}: expected native ${arch}`);
  console.log(`Verified native ${arch}: ${file}`);
}
