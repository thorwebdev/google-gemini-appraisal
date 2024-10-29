# Google Gemini API Flea Market Value Appraisal

Use the Gemini API with structured output to create a flea market object appraisal app.

## Setup

- `cp supabase/functions/.env. example supabase/functions/.env`
- Set your [Gemini API key](https://ai.google.dev/gemini-api/docs/api-key) in `supabase/functions/.env`

## Run locally

```bash
supabase start
supabase functions serve
# In another terminal
python3 -m http.server
```

Open http://localhost:8000/
