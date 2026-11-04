import { ALGORITHMS, byId } from '../src/app/algorithms/registry';
import { createHash, generateKeyPairSync, verify } from 'crypto';
const run = (id: string, v: Record<string, string>) => { const a = byId(id)!; const vals: Record<string,string> = {}; a.fields.forEach(f => vals[f.key] = f.default); Object.assign(vals, v); return a.run(vals); };
const out = (id: string, v: Record<string,string>, label?: string) => { const r = run(id, v); return (label ? r.output.find(o=>o.label===label) : r.output[r.output.length-1])!.value; };
const check = (name: string, got: string, exp: string) => console.log((got===exp?'OK  ':'FAIL')+' '+name+'  got='+got+(got===exp?'':'  exp='+exp));
check('AES-128 FIPS', out('aes',{mode:'enc',text:'3243f6a8885a308d313198a2e0370734',key:'2b7e151628aed2a6abf7158809cf4f3c'}), '3925841d02dc09fbdc118597196a0b32');
check('AES-128 C1', out('aes',{mode:'enc'}), '69c4e0d86a7b0430d8cdb78070b4c55a');
check('AES-128 dec', out('aes',{mode:'dec',text:'69c4e0d86a7b0430d8cdb78070b4c55a'}), '00112233445566778899aabbccddeeff');
check('AES-192', out('aes',{mode:'enc',key:'000102030405060708090a0b0c0d0e0f1011121314151617'}), 'dda97ca4864cdfe06eaf70a0ec0d7191');
check('AES-256', out('aes',{mode:'enc',key:'000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f'}), '8ea2b7ca516745bfeafc49904b496089');
check('AES-256 dec', out('aes',{mode:'dec',text:'8ea2b7ca516745bfeafc49904b496089',key:'000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f'}), '00112233445566778899aabbccddeeff');
check('MixCol', out('mixcolumn',{}), '04 66 81 e5');
check('gf 57*13', out('gf256',{}), 'fe');
check('Kuz S', out('kuz-transforms',{op:'S',text:'ffeeddccbbaa99881122334455667700'}), 'b66cd8887d38e8d77765aeea0c9a7efc');
check('Kuz R', out('kuz-transforms',{op:'R',text:'00000000000000000000000000000100'}), '94000000000000000000000000000001');
check('Kuz L', out('kuz-transforms',{op:'L',text:'64a59400000000000000000000000000'}), 'd456584dd0e3e84cc3166e4b7fa2890d');
check('Kuz Linv', out('kuz-transforms',{op:'Linv',text:'d456584dd0e3e84cc3166e4b7fa2890d'}), '64a59400000000000000000000000000');
check('Kuz enc', out('kuznechik',{mode:'enc'}), '7f679d90bebc24305a468d42b9d4edcd');
check('Kuz dec', out('kuznechik',{mode:'dec',text:'7f679d90bebc24305a468d42b9d4edcd'}), '1122334455667700ffeeddccbbaa9988');
check('DES enc', out('des',{mode:'enc'}), '85e813540f0ab405');
check('DES dec', out('des',{mode:'dec',text:'85e813540f0ab405'}), '0123456789abcdef');
for (const m of ['abc','','SALOM','The quick brown fox jumps over the lazy dog'.repeat(3)]) {
  const r = run('sha-compare',{text:m}).output;
  check('sha1 '+m.slice(0,8), r[0].value, createHash('sha1').update(m).digest('hex'));
  check('sha256 '+m.slice(0,8), r[1].value, createHash('sha256').update(m).digest('hex'));
  check('sha512 '+m.slice(0,8), r[2].value, createHash('sha512').update(m).digest('hex'));
  check('sha256 steps '+m.slice(0,8), out('sha256',{text:m}), createHash('sha256').update(m).digest('hex'));
}
check('avalanche', out('avalanche',{},'Hamming masofasi'), out('avalanche',{},'Hamming masofasi'));
check('RSA d', out('rsa',{},'d'), '27'); check('RSA C', out('rsa',{},'Shifrmatn C'), '13'); check('RSA M', out('rsa',{},'Deshifrlangan M'), '7');
check('ElGamal', out('elgamal',{},'(c₁, c₂)'), '(10, 14)'); check('ElGamal k7', out('elgamal',{k:'7'},'(c₁, c₂)'), '(17, 5)');
check('DH', out('dh',{},'K'), '2');
check('fastpow 5^117 mod 19', out('fast-pow',{}), String(5n**117n % 19n));
check('7^123 mod 55', out('fast-pow',{a:'7',e:'123',n:'55'}), '13');
check('inv 17 mod 43', out('ext-euclid',{}), '38'); check('inv 6 mod 15', out('ext-euclid',{a:'6',n:'15'}), 'mavjud emas');
check('23^-1 mod 100', out('ext-euclid',{a:'23',n:'100'}), '87');
check('gcd', out('euclid',{},'EKUB'), '21');
check('modcalc sub', out('mod-calc',{op:'sub',a:'1234',b:'9876',n:'101'}), '44');
check('modcalc div', out('mod-calc',{op:'div',a:'10',b:'3',n:'7'}), '1');
check('modcalc mul', out('mod-calc',{op:'mul',a:'12345',b:'6789',n:'101'}), '1');
check('Caesar', out('caesar',{}), 'KHOOR'); check('Atbash', out('atbash',{}), 'SVOOL'); check('Mono', out('mono',{}), 'ITSSG');
check('Affine', out('affine',{}), 'RCLLA'); check('Affine dec', out('affine',{mode:'dec',text:'RCLLA'}), 'HELLO');
check('Vigenere', out('vigenere',{}), 'RIJVSUYVJN'); check('Vig dec', out('vigenere',{mode:'dec',text:'RIJVSUYVJN'}), 'HELLOWORLD');
check('Columnar nokey', out('columnar',{text:'KRIPTOGRAFIYA',key:'',cols:'4'}), 'KTAAROFXIGIXPRYX');
const ce = out('columnar',{}); check('Columnar roundtrip', out('columnar',{mode:'dec',text:ce}), 'INFORMATIONSECURITYX');
check('Hill', out('hill',{}), 'TC'); check('Hill dec', out('hill',{mode:'dec',text:'TC'}), 'HI');
check('XOR', out('xor',{}), '65');
check('ECC add', out('ecc',{op:'add'}), '(10, 6)'); check('ECC dbl', out('ecc',{op:'dbl'}), '(6, 3)'); check('ECC 9P', out('ecc',{op:'mul',n:'9'}), '(7, 6)');
console.log('ecdh', run('ecdh',{}).output.map(o=>o.label+'='+o.value).join(' '));
console.log('rsa-sign', run('rsa-sign',{}).output.map(o=>o.label+'='+o.value).join(' '));
console.log('elg-sign', run('elgamal-sign',{}).output.map(o=>o.label+'='+o.value).join(' '));
console.log('sbox', out('aes-sbox',{}));
console.log('algos', ALGORITHMS.length, 'steps aes', run('aes',{}).steps.length);
for (const a of ALGORITHMS) { try { const r = run(a.id, {}); if (!r.steps.length) console.log('NO STEPS', a.id); for (const ex of a.examples ?? []) run(a.id, ex.values); } catch (e) { console.log('ERR', a.id, (e as Error).message); } }

// ---- GOST ----
check('Magma', out('magma',{}), '4ee901e5c2d8ca3d');
check('Magma dec', out('magma',{mode:'dec',text:'4ee901e5c2d8ca3d'}), 'fedcba9876543210');
check('GOST 34.11-94 abc', out('gost-3411-94',{text:'abc'}), 'f3134348c44fb1b2a277729e2285ebb5cb5e0f29c975bc753b70497c06a4d51d');
check('GOST 34.11-94 32b', out('gost-3411-94',{text:'This is message, length=32 bytes'}), 'b1c466d37519b82e8319819ff32595e047a28cb6f83eff1c6916a815a637fffa');
check('Streebog-512', out('streebog',{}), '1b54d01a4af5b9d5cc3d86d68d285462b19abc2475222f35c085122be4ba1ffa00ad30f8767b3a82384c6574f024c311e2a481332b08ef7f41797891c1646f48');
check('Streebog-256', out('streebog',{bits:'256'}), '9d151eefd8590b89daa6ba6cb74af9275dd051026bb149a452fd84e5e57b5500');
check('GOST 34.10-94', out('gost-3410-94',{},'u'), '8');
check('GOST 34.10-2012', out('gost-3410-2012',{},'Tekshiruv'), 'to‘g‘ri');

// ---- DSA ----
check('DSA darslik', out('dsa',{m:'',h:'5'},'(r, s)'), '(8, 1)');
check('DSA 283', out('dsa',{p:'283',q:'47',g:'60',x:'24',k:'15',m:'',h:'41'},'(r, s)'), '(19, 30)');
check('DSA 7879', out('dsa',{p:'7879',q:'101',g:'170',x:'75',k:'50',m:'',h:'22'},'(r, s)'), '(94, 97)');
check('DSA default', out('dsa',{},'Tekshiruv'), 'to‘g‘ri');
// Haqiqiy 2048/256 bitli kalit: bizning imzoni OpenSSL tekshiradi
{
  const { privateKey, publicKey } = generateKeyPairSync('dsa', { modulusLength: 2048, divisorLength: 256 });
  const der = (b: Buffer, at: number): { body: Buffer; end: number } => {
    let len = b[at + 1], off = at + 2;
    if (len & 0x80) { const n = len & 0x7f; len = 0; for (let i = 0; i < n; i++) len = len * 256 + b[off++]; }
    return { body: b.subarray(off, off + len), end: off + len };
  };
  const ints = (b: Buffer): bigint[] => { const o: bigint[] = []; let i = 0; while (i < b.length) { const e = der(b, i); o.push(BigInt('0x' + e.body.toString('hex'))); i = e.end; } return o; };
  const pk = der(privateKey.export({ type: 'pkcs8', format: 'der' }) as Buffer, 0).body;
  const ver = der(pk, 0), algo = der(pk, ver.end), oct = der(pk, algo.end);
  const [P, Q, G] = ints(der(algo.body, der(algo.body, 0).end).body);
  const X = ints(oct.body)[0];
  const msg = 'Kriptografiya';
  const K = (X * 7n + 12345n) % (Q - 1n) + 1n;
  const res = run('dsa', { p: String(P), q: String(Q), g: String(G), x: String(X), k: String(K), m: msg, h: '' });
  const [R, S] = res.output.find((o) => o.label === '(r, s)')!.value.replace(/[()\s]/g, '').split(',').map(BigInt);
  const enc = (n: bigint): Buffer => { let h = n.toString(16); if (h.length % 2) h = '0' + h; if (parseInt(h[0], 16) >= 8) h = '00' + h; const v = Buffer.from(h, 'hex'); return Buffer.concat([Buffer.from([2, v.length]), v]); };
  const body = Buffer.concat([enc(R), enc(S)]);
  const sig = Buffer.concat([Buffer.from([0x30, body.length]), body]);
  check('DSA 2048 ichki', res.output.find((o) => o.label === 'Tekshiruv')!.value, 'to‘g‘ri');
  check('DSA 2048 OpenSSL', String(verify('sha256', Buffer.from(msg), publicKey, sig)), 'true');
  check('DSA 2048 OpenSSL soxta', String(verify('sha256', Buffer.from(msg + '!'), publicKey, sig)), 'false');
  console.log('dsa 2048 qadamlar', res.steps.length);
}
console.log('dsa qadamlar', run('dsa', {}).steps.length, run('dsa', {}).output.map((o) => o.label + '=' + o.value).join(' '));
