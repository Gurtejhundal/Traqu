// Dependency-free static build. All asset URLs remain relative for GitHub Pages.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'website', 'dist');
fs.rmSync(out, {recursive:true, force:true}); fs.mkdirSync(out, {recursive:true});
for (const name of ['index.html','download.html','docs.html','style.css','site.js']) fs.copyFileSync(path.join(root,'website',name),path.join(out,name));
for (const [source,target] of [
 ['docs/screenshots','media/screenshots'], ['docs/readme','media/readme'],
 ['frontend/public/characters','media/characters'], ['frontend/public/os','media/os'],
 ['frontend/public/agents','agents'],
]) {
 fs.mkdirSync(path.dirname(path.join(out,target)),{recursive:true});
 fs.cpSync(path.join(root,source),path.join(out,target),{recursive:true,filter: name=>!name.endsWith('.html')});
}
fs.mkdirSync(path.join(out,'manual'),{recursive:true});
for(const name of fs.readdirSync(path.join(root,'docs')).filter(name=>name.endsWith('.md'))) fs.copyFileSync(path.join(root,'docs',name),path.join(out,'manual',name));
fs.copyFileSync(path.join(root,'frontend/public/traqu-mark.svg'),path.join(out,'mark.svg'));
fs.writeFileSync(path.join(out,'.nojekyll'),'');
fs.writeFileSync(path.join(out,'robots.txt'),'User-agent: *\nAllow: /\nSitemap: https://traqu.vercel.app/sitemap.xml\n');
fs.writeFileSync(path.join(out,'sitemap.xml'),'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+['','download','docs'].map(p=>`<url><loc>https://traqu.vercel.app/${p}</loc></url>`).join('')+'</urlset>');
console.log('Static Traqu website built in website/dist.');
