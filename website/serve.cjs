// Minimal preview server for the static output; not used in production.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname,'dist');
const mime = {'.html':'text/html','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.png':'image/png','.gif':'image/gif','.md':'text/plain','.json':'application/json'};
http.createServer((request,response)=>{
 try{
  let pathname = decodeURIComponent(new URL(request.url,'http://localhost').pathname);
  if(pathname === '/') pathname='/index.html';
  if(!path.extname(pathname)) pathname+='.html';
  const file=path.resolve(root,'.'+pathname);
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){response.writeHead(404);response.end('Not found');return;}
  response.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(response);
 }catch{response.writeHead(400);response.end('Bad request');}
}).listen(4174,'127.0.0.1',()=>console.log('Website preview on 4174'));
