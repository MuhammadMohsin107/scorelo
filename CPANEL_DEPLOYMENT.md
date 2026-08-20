# Frontend-Only Deployment on cPanel

Abhi sirf frontend deploy karna hai. Backend, PostgreSQL, `DATABASE_URL`, cPanel Node.js App, aur migrations ki zaroorat nahi.

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
