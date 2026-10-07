import { hash, verify } from '@node-rs/argon2'

const ARGON2ID_OPTIONS = {
  algorithm: 2, // argon2id
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const

export function hashPassword(plaintext: string): Promise<string> {
  return hash(plaintext, ARGON2ID_OPTIONS)
}

export function verifyPassword(passwordHash: string, plaintext: string): Promise<boolean> {
  return verify(passwordHash, plaintext)
}
