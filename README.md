# Kripto Vizual — Zamonaviy kriptografiya

“Zamonaviy kriptografiya” fani (IIAU, magistratura) bo‘yicha algoritmlarni **qadamma-qadam vizual** ko‘rsatuvchi Angular 20 ilova.

## Ishga tushirish

**Eng oson:** `start.bat` faylini ikki marta bosing (Node.js 20.19+ yoki 22+ kerak).

Yoki terminalda:

```bash
npm install
npm start          # http://localhost:4200 avtomatik ochiladi
npm run build      # dist/ papkaga production build
npm run test:vectors   # barcha algoritmlarni rasmiy test vektorlari bilan tekshirish
```

## Nimalar bor

| Mavzu | Algoritmlar |
|---|---|
| 1. Modulli arifmetika | Modular kalkulyator (+ − · / daraja, EKUB, teskari), tezkor daraja, Evklid, kengaytirilgan Evklid |
| 2. Klassik shifrlar | Sezar, Atbash, Monoalfavit, Affin, Vijener, Jadval transpozitsiya, Hill 2×2, XOR |
| 3. Ochiq kalitli | RSA, ElGamal |
| 4. Blokli shifrlar | Kuznechik (to‘liq + S/R/L alohida), Magma / GOST 28147-89 (32 raund), DES (16 raund) |
| 5. AES | AES-128/192/256 shifrlash/deshifrlash, GF(2⁸) va xtime, MixColumns ustun, S-box |
| 6. Xesh | GOST R 34.11-94, Streebog (GOST R 34.11-2012, 256/512), SHA-256 qadamma-qadam, SHA-1/256/512 taqqoslash, Avalanche + Hamming, oddiy xesh |
| 7–8. ERI | RSA imzo, ElGamal imzo, DSA, GOST R 34.10-94, GOST R 34.10-2012 |
| 9–10. ECC | Nuqtalarni qo‘shish, 2P, n·P (Double-and-Add), ECDH |
| 11. Diffie–Hellman | DH kalit almashish |

Tekshirilgan test vektorlari: FIPS-197 (AES), GOST R 34.12-2015 (Kuznechik, Magma), GOST R 34.11-94 va 34.11-2012 (RFC 5831, RFC 6986), FIPS 180-4 (SHA), klassik DES vektori.

## Yangi algoritm qo‘shish (keyingi mavzular uchun)

1. `src/app/algorithms/` ichida yangi fayl yarating va `AlgorithmDef` obyektini eksport qiling:

```ts
import { AlgorithmDef } from '../core/models';
import { big } from '../core/util';

export const myAlgo: AlgorithmDef = {
  id: 'my-algo', topic: 12, name: 'Mening algoritmim', short: 'Qisqa tavsif',
  theory: ['Nazariya paragrafi...'],
  formulas: ['C = M^e mod n'],
  fields: [{ key: 'a', label: 'a', type: 'number', default: '5' }],
  run(v) {
    const a = big(v, 'a');
    return {
      steps: [
        { title: '1-qadam', text: 'Izoh', visuals: [{ kind: 'formula', text: `a = ${a}` }] },
      ],
      output: [{ label: 'Natija', value: String(a) }],
    };
  },
};
```

2. `src/app/algorithms/registry.ts` dagi `ALGORITHMS` massiviga qo‘shing. Menyu, sahifa, forma va qadamlar pleyeri avtomatik paydo bo‘ladi.

Vizual turlari (`core/models.ts` → `Visual`): `formula`, `note`, `kv`, `table`, `grids` (matritsalar), `bytes`, `bits`, `chars`, `flow`, `plot` (egri chiziq nuqtalari).

## Tuzilma

```
src/app/
  core/models.ts        — AlgorithmDef, Step, Visual turlari
  core/util.ts          — BigInt modulli arifmetika, hex/bit yordamchilari
  algorithms/*.ts       — har bir mavzu algoritmlari
  algorithms/registry.ts— mavzular va algoritmlar ro‘yxati
  components/visual.component.ts — vizual bloklarni chizish
  pages/                — bosh sahifa va algoritm sahifasi (qadamlar pleyeri)
```

Klaviatura: ← → — qadamlar, bo‘sh joy — avto rejim. O‘ng yuqorida yorug‘/qorong‘i rejim.

## GitHub Pages

`main` branchiga push qilinganda `.github/workflows/deploy.yml` ilovani GitHub Pages'ga avtomatik build va deploy qiladi. Sayt `https://jasurbekdeveloper.github.io/aes-visualizer/` manzilida ochiladi.
