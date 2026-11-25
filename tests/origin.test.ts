import {expect,test} from 'vitest'
import {sameOrigin} from '../lib/origin'
test('allow the loopback alias on the same protocol and port',()=>{
 expect(sameOrigin('http://127.0.0.1:3000','http://localhost:3000/api/projects')).toBe(true)
 expect(sameOrigin('http://127.0.0.1:4000','http://localhost:3000/api/projects')).toBe(false)
})
test('reject unrelated origins and malformed scheme or path',()=>{
 for(const value of ['null',null,'https://other.example','https://loop.example/foo'])expect(sameOrigin(value,'https://loop.example/api/projects')).toBe(false)
})
