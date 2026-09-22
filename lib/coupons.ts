import { createHash } from 'node:crypto'

export const COUPON_DISCOUNT_PERCENT = 100

const couponHashes = new Set([
  '06788486650a70ef0d7da09123b20ca44c85da7d1a6771add324204f13a687c5',
  'd6b8cee464e31bce32ce446c593cb04286cbde544338655e2181b90db37ba352',
  '5e47c6bea09e632d65b9d251c0cc6a726aa759846f8aa71763eeea63b478374f',
  '2baeb4c3237d7bbde4cbe65ca334afb9e3f54f65198843dd5c5caf52e5161355',
  'ea04c23281068502762464bae23bcfb4c58c7c024bf6895622487167f564b0ee',
  'f9c74fb0663f26ef979bad1c2f214d3801e8d5fa416928662103ade58e7b94ce',
  'a0480596a6f490587a1725c46adf872dab22504f1472b4e1e60351f4d67e806d',
  'ffbd41e437bbbb812daaf8d5ab88522f8bf944c088db89c7f251c7a82382f58f',
  'f62f379cd4af1caf8805d0b7a3ea4a3f326ddf0f70b6872c572c1a0548b50461',
  '055cd8dee71c93afac930b7571244944d1c1509f227867ade069b46e1b49c0c2',
  'c95031206f11a0a89c9e23a9304854ebcc2da8bc64b4495c68bc97221edb28bc',
  '43bda4d7a11f4b4178fbc6ee38f17b36cb2b84e7b49b3558f77a6df4721927c7',
  '263e805f45ca447eb9dd08c9cdf726d846a8f00bb47e8ade903bd077c96244d9',
  'b36ad4df42ace92851c23a658207eede79fd273ac2fccdcd26763d77d3e62d89',
  'bc39822545e96084c40b136942c0f4c04d54d13f9f68bb150c6fa29ffa1d7921',
  'ec83aec287d95c27d6257bd43259d166e6cf79ce8de81bb8932f3c8cd60d53cd',
  '50becb4fd93f0493b1738e58ccc14a39a232bb0b1333ee0aacf2e0a8b6de1201',
  '605d3e360538ee183978f8def6acb882f1e21685370a9c0c7d161911758564b6',
  '518a022aba191fce9f2ecb044752886d4a3d9a61d67a9deb5b045360e2b4536d',
  '340d61b3a257163d6ca96ce6b79c59be0925f08f1aa33240ed658f6fa0114a66',
])

export function normalizeCoupon(code: string) {
  return code.trim().toUpperCase().replace(/\s+/g, '')
}

export function couponHash(code: string) {
  return createHash('sha256').update(normalizeCoupon(code)).digest('hex')
}

export function isKnownCouponHash(hash: string) {
  return couponHashes.has(hash)
}
