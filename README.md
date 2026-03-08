# Kernel Arch Labs - Website

Research foundation website built with React + Vite.

## Local Development

```bash
npm install
npm run dev
```

Opens at http://localhost:5173

## Deploy to Vercel

### Step 1: Push to GitHub

```bash
git init
git add .
git commit -m "initial site"
git branch -M main
git remote add origin https://github.com/YOUR_ORG/website.git
git push -u origin main
```

### Step 2: Connect Vercel

1. Go to https://vercel.com and sign in with GitHub
2. Click "Add New Project"
3. Import your repository
4. Vercel auto-detects Vite -- click "Deploy"
5. Wait ~60 seconds. Your site is live.

### Step 3: Connect kernelarch.com (GoDaddy)

In Vercel:
1. Go to your project > Settings > Domains
2. Add `kernelarch.com`
3. Also add `www.kernelarch.com`
4. Vercel shows you the DNS records to add

In GoDaddy:
1. Go to https://dcc.godaddy.com > kernelarch.com > DNS Management
2. Delete any existing A records for @ (the default GoDaddy parked page ones)
3. Add these records:

| Type  | Name | Value                  | TTL     |
|-------|------|------------------------|---------|
| A     | @    | 76.76.21.21            | 600     |
| CNAME | www  | cname.vercel-dns.com   | 1 Hour  |

4. Save. Wait 5-30 minutes for DNS propagation.

### Step 4: Done

- Vercel auto-issues SSL certificate for kernelarch.com
- Every push to main branch auto-deploys
- www.kernelarch.com redirects to kernelarch.com automatically

## Pages

- Home page: mission, research, projects, publications, collaborate
- Papers page (#/papers): full papers listing with filtering by status

## Adding Content

### New papers (when published)
Edit PAPERS_DATA in src/kernel-arch-labs.jsx:
- Change szStatus from "Planned" to "Published"
- Add szPdfUrl with the download link
- Place PDFs in public/papers/ folder

### New projects
Add an object to PROJECTS_DATA array.

### New research domains
Add to RESEARCH_DOMAINS array.
