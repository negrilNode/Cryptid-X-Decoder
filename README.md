# Cryptid X Decoder

A client-side web app that decrypts Encrypt X protected Lua scripts by fetching from GitHub and performing Base32 + XOR decryption — all in the browser, no backend required.

## How It Works

1. User pastes an Encrypt X URL (`https://encrypt-x.pages.dev/Scripts?Id=XXXX`) or just the Script ID
2. The app fetches the raw JSON file from `https://raw.githubusercontent.com/ScriptObfuscator2/Scripts/main/{ID}`
3. The JSON contains `Key`, `Date`, and `Script` fields
4. The `Script` field is Base32-decoded (RFC 4648: A-Z + 2-7)
5. The decoded bytes are XOR'd with the `Key` string cyclically
6. The result is a valid Lua script, shown in a preview and available for download as `{ID}_decrypted.lua`

## Files

```
cryptid-x-decoder/
├── index.html      — Main HTML structure
├── style.css       — Dark hacker terminal UI styles
├── app.js          — Decryption logic + all interactivity
├── vercel.json     — Vercel deployment config
└── _redirects      — Netlify deployment config
```

## Deploy

### Vercel
```bash
npx vercel --prod
```

### Netlify
Drag the folder to [app.netlify.com/drop](https://app.netlify.com/drop)

### GitHub Pages
Push to a repo, go to Settings → Pages → Deploy from branch (main / root).

### Local
```bash
# Any static file server works:
npx serve .
# or
python3 -m http.server 8080
```

## Adjusting the Decryption Algorithm

The decryption is clearly separated in `app.js` under the `DECRYPTION ALGORITHM` comment block. The key functions are:

- `base32Decode(input)` — Standard RFC 4648 Base32 decode
- `xorDecrypt(data, key)` — XOR each byte with the key cyclically
- `decrypt(scriptField, keyField)` — Calls both in sequence

If Encrypt X changes its algorithm, update these functions.

## Features

- Paste URL or raw Script ID
- Auto-fetches from GitHub raw CDN
- Decrypts entirely client-side (no data sent anywhere)
- Code preview with syntax highlighting
- One-click copy to clipboard
- Download as `{ID}_decrypted.lua`
- Recent decryptions history (localStorage, up to 10 entries)
- Responsive — works on mobile
- Dark terminal UI with cyan/green accents
