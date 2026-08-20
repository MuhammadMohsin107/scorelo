# Frontend-Only Deployment on cPanel

Abhi sirf frontend deploy karna hai. Backend, PostgreSQL, `DATABASE_URL`, cPanel Node.js App, aur migrations ki zaroorat nahi.

## Important: 502 Bad Gateway fix

`502 Bad Gateway` ka matlab hai ke aapka domain nginx se cPanel Node.js application ko proxy kar raha hai, lekin upstream application run nahi ho rahi. Is project mein frontend ko cPanel Node.js App ke through serve karne ke liye `server.cjs` already included hai.

502 fix karne ke liye cPanel mein yeh values use karein:

| cPanel field             | Value                                 |
| ------------------------ | ------------------------------------- |
| Node.js version          | 20 or newer                           |
| Application mode         | Production                            |
| Application root         | `scorelo-frontend`                    |
| Application URL          | `https://scorelo-staging.tlxapps.com` |
| Application startup file | `server.cjs`                          |

Application root ke andar yeh files/folders honi chahiye:

```text
scorelo-frontend/
  server.cjs
  package.json
  package-lock.json
  dist/
    index.html
    assets/
    fonts/
```

Node.js App create karne ke baad cPanel Terminal mein run karein:

```bash
cd ~/scorelo-frontend
npm ci --omit=dev
```

`dist` folder local machine par `npm run build` se pehle hi generate karein aur cPanel application root mein upload karein. Server par `npm run build` na chalayein jab `--omit=dev` use kiya ho.

Phir cPanel **Setup Node.js App** mein **Restart** press karein. `PORT` manually set na karein; cPanel khud `PORT` provide karta hai.

Agar purani broken Node.js application isi domain par lagi hui hai, us application ko delete/recreate karein ya uska startup file `server.cjs` karein. Ek hi domain ko simultaneously static `public_html` aur Node.js proxy dono par configure na karein.

## 1. Local build

Project root mein terminal open karein:

```powershell
Set-Location "M:\projects\scorelo2\frontend"
node --version
npm --version
npm ci
npm run build
```

Node.js 20 ya newer recommended hai. Build ke baad ready files yahan hongi:

```text
M:\projects\scorelo2\frontend\dist
```

Node.js App deployment ke liye `frontend` folder ki `server.cjs`, `package.json`, `package-lock.json`, aur `dist` upload karein. Static deployment ke liye sirf `dist` ki contents upload karna kaafi hai.

Optional local preview:

```powershell
npm run preview
```

Browser mein normally `http://localhost:4173` open karein. Preview band karne ke liye `Ctrl + C` press karein.

## 2. cPanel File Manager upload

1. cPanel mein **File Manager** open karein.
2. Domain ke document root mein jayein, normally `public_html`.
3. Local `frontend/dist` ke **andar ki sari files aur folders** upload karein.
4. `dist` folder ko as a folder upload na karein.

Correct structure:

```text
public_html/
  index.html
  .htaccess
  assets/
  fonts/
```

`index.html` directly `public_html` ke andar hona chahiye.

## 3. React routes ke liye `.htaccess`

`.htaccess` project mein already generate hoti hai. `npm run build` ke baad yeh file yahan milegi:

```text
M:\projects\scorelo2\frontend\dist\.htaccess
```

Is file ko bhi `public_html` mein upload karein.

Agar manually banani ho to cPanel ke `public_html` folder mein **New File** banayein, naam:

```text
.htaccess
```

Content:

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /

  RewriteCond %{REQUEST_FILENAME} -f [OR]
  RewriteCond %{REQUEST_FILENAME} -d
  RewriteRule ^ - [L]

  RewriteRule ^ index.html [L]
</IfModule>
```

Agar `.htaccess` nazar na aaye to File Manager **Settings** mein **Show Hidden Files (dotfiles)** enable karein.

## 4. Website test

```text
https://your-domain.com
https://your-domain.com/seo
https://your-domain.com/settings
```

Main page aur direct routes refresh par open hone chahiye. Route par `404` aaye to check karein:

- `index.html` directly `public_html` mein hai
- `.htaccess` directly `public_html` mein hai
- `.htaccess` ka naam exactly `.htaccess` hai
- Apache/mod_rewrite hosting par enabled hai

## Optional: cPanel Terminal se build/upload

Agar repository server par clone karni ho:

```bash
cd ~
git clone YOUR_REPOSITORY_URL scorelo2
cd ~/scorelo2/frontend
npm ci
npm run build
cp -R dist/. /home/CPANEL_USER/public_html/
```

`YOUR_REPOSITORY_URL` aur `CPANEL_USER` ko apni values se replace karein.

## Permissions

Normally cPanel upload ke baad permissions automatically correct hoti hain:

```text
Folders: 755
Files:   644
```

## Checklist

- [ ] `npm ci` complete
- [ ] `npm run build` successful
- [ ] `frontend/dist` ki contents `public_html` mein uploaded
- [ ] `index.html` directly `public_html` mein
- [ ] `.htaccess` directly `public_html` mein
- [ ] Main domain open
- [ ] `/seo` aur `/settings` refresh par open
