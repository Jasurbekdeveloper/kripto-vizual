import { AlgorithmDef, Topic } from '../core/models';
import { T1 } from './t1-modular';
import { T2 } from './t2-classic';
import { TPUB } from './t-public';
import { TDSA } from './t-dsa';
import { T4 } from './t4-kuznechik';
import { T4DES } from './t4-des';
import { T5 } from './t5-aes';
import { T6 } from './t6-sha';
import { T9 } from './t9-ecc';
import { T9CRYPTO } from './t9-ecc-crypto';
import { TGOST } from './t-gost';

/**
 * FAN MAVZULARI.
 * Yangi mavzu qo'shish: shu ro'yxatga yozing.
 */
export const TOPICS: Topic[] = [
  { n: 1, title: 'Modulli arifmetika va kriptografik hisoblashlar', kind: 'A' },
  { n: 2, title: 'Simmetrik kriptotizimlar: klassik shifrlash algoritmlari', kind: 'A' },
  { n: 3, title: 'RSA va ElGamal: kalit generatsiyasi, shifrlash, deshifrlash', kind: 'A' },
  { n: 4, title: '«Kuznechik», Magma va DES — blokli shifrlar', kind: 'A' },
  { n: 5, title: 'AES raund amallari', kind: 'A' },
  { n: 6, title: 'SHA oilasi va GOST R 34.11 xesh funksiyalari', kind: 'A' },
  { n: 7, title: 'Elektron raqamli imzo (RSA, ElGamal)', kind: 'M' },
  { n: 8, title: 'DSA, GOST R 34.10-94 va GOST R 34.10-2012 imzolari', kind: 'M' },
  { n: 9, title: 'Elliptik egri chiziqlar ustida nuqtalar arifmetikasi', kind: 'M' },
  { n: 10, title: 'Elliptik egri chiziqlar asosida kalit almashish', kind: 'M' },
  { n: 11, title: 'Diffie–Hellman kalit almashish protokoli', kind: 'M' },
  { n: 12, title: 'Kriptografik kalitlarning bardoshliligi', kind: 'M' },
];

/**
 * BARCHA ALGORITMLAR.
 * Yangi algoritm qo'shish uchun:
 *   1) algorithms/ papkasida AlgorithmDef obyektini yozing (run() qadamlar ro'yxatini qaytaradi)
 *   2) shu massivga qo'shing — menyu, sahifa va vizualizatsiya avtomatik paydo bo'ladi.
 */
export const ALGORITHMS: AlgorithmDef[] = [...T1, ...T2, ...TPUB, ...TDSA, ...T4, ...T4DES, ...T5, ...T6, ...T9, ...T9CRYPTO, ...TGOST];

export const byId = (id: string): AlgorithmDef | undefined => ALGORITHMS.find((a) => a.id === id);
export const byTopic = (n: number): AlgorithmDef[] => ALGORITHMS.filter((a) => a.topic === n);
