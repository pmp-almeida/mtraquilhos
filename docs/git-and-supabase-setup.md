# Git and Supabase setup

The project is an independent Git repository. To publish it, create an empty
GitHub repository and run:

```text
git remote add origin https://github.com/<owner>/<repository>.git
git add .
git commit -m "Bootstrap Table Football Ranked app"
git branch -M main
git push -u origin main
```

In the GitHub repository settings, add `SUPABASE_URL` and
`SUPABASE_ANON_KEY` as Actions secrets. These are the only values injected into
the browser build. Apply the SQL migration in `supabase/migrations` before
using the deployed application.