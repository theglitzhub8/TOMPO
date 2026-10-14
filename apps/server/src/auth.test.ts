import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword,verifyPassword,credentials } from './auth.ts';
test('passwords have unique salts and verify securely',async()=>{const a=await hashPassword('a-long-private-password');const b=await hashPassword('a-long-private-password');assert.notEqual(a,b);assert.equal(await verifyPassword('a-long-private-password',a),true);assert.equal(await verifyPassword('incorrect-password',a),false);});
test('credentials normalize email and reject invalid inputs',()=>{assert.equal(credentials({email:' USER@example.com ',password:'long-password-123'}).email,'user@example.com');assert.throws(()=>credentials({email:'invalid',password:'short'}));});
