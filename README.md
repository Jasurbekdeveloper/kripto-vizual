# AES-128 Vizualizatori

AES (Advanced Encryption Standard) algoritmining ishlash prinsipini qadamba-qadam ko'rsatuvchi interaktiv ta'limiy veb-dastur.

## Imkoniyatlar

- Matn va kalitni **ASCII** yoki **HEX** formatda kiritish, tasodifiy qiymat yaratish
- **Key Expansion**: 11 ta raund kaliti (K0…K10) va har bir so'z qanday hosil bo'lgani (RotWord → SubWord → Rcon)
- 0–10 raundlarning barcha qadamlari (jami 42 qadam):
  - **SubBytes** — S-Box jadvalida satr/ustun belgilanadi
  - **ShiftRows** — rangli ustunlar va siljish animatsiyasi
  - **MixColumns** — GF(2⁸) dagi to'liq hisob-kitob (10-raundda o'tkazib yuboriladi)
  - **AddRoundKey** — bit darajasidagi XOR
- Yakuniy shifrmatn HEX / ASCII / Base64 ko'rinishida, Web Crypto API bilan avtomatik tekshiriladi

## Ishga tushirish

```bash
npm install
npm start        # http://localhost:4200
npm run build    # dist/aes-visualizer/browser
```

## Tuzilishi

- `src/app/aes/aes.ts` — AES-128 dvigateli (har bir oraliq natijani saqlaydi)
- `src/app/aes/format.ts` — kirishni tekshirish va formatlash
- `src/app/components/` — State matritsasi va S-Box jadvali komponentlari
- `src/app/app.*` — asosiy sahifa
